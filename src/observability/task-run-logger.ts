import { randomBytes } from 'node:crypto'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { TaskRunLogSchema } from '../data/contracts.ts'
import type {
  TaskRunLog,
  TaskRunLogStatus,
  TaskRunLogTaskName
} from '../data/contracts.ts'

// 元数据值只允许可 JSON 序列化的原始类型，避免运行日志写入时出现不可逆对象
type MetadataValue = string | number | boolean | null
type Metadata = Record<string, MetadataValue>

export interface TaskRunLoggerOptions {
  taskName: TaskRunLogTaskName
  logDirectory: string
  clock?: () => Date
  metadata?: Metadata
}

export interface TaskRunSummary {
  status: TaskRunLogStatus
  processedCount: number
  successCount: number
  failureCount: number
  errors: string[]
  metadata?: Metadata
}

const formatError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

// 递归收集目录下所有 JSON 文件，与 collection-inbox 的扫描逻辑保持一致
const listJsonFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async entry => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return listJsonFiles(path)
    return entry.isFile() && extname(entry.name).toLowerCase() === '.json' ? [path] : []
  }))
  return nested.flat().sort()
}

// 生成符合 StableIdSchema 的稳定 ID：task_run_{task_slug}_{timestamp}_{random}
const buildLogId = (taskName: TaskRunLogTaskName, finishedAt: Date): string => {
  const slug = taskName.replace(/:/gu, '_')
  const stamp = finishedAt.toISOString()
    .replace(/[-:]/gu, '')
    .replace('T', '_')
    .slice(0, 15)
  const suffix = randomBytes(3).toString('hex')
  return `task_run_${slug}_${stamp}_${suffix}`
}

export class TaskRunLogger {
  private readonly taskName: TaskRunLogTaskName
  private readonly logDirectory: string
  private readonly clock: () => Date
  private readonly startedAt: Date
  private readonly baseMetadata: Metadata
  private readonly command: string

  constructor(options: TaskRunLoggerOptions) {
    this.taskName = options.taskName
    this.logDirectory = options.logDirectory
    this.clock = options.clock ?? (() => new Date())
    this.startedAt = this.clock()
    this.baseMetadata = options.metadata ?? {}
    // 记录实际调用命令，便于回溯；不包含密钥（项目规范禁止在命令行传入密钥）
    this.command = process.argv.slice(1).join(' ')
  }

  // 写入运行日志到本地文件，返回已校验的日志对象
  async finish(summary: TaskRunSummary): Promise<TaskRunLog> {
    const finishedAt = this.clock()
    const log = TaskRunLogSchema.parse({
      schema_version: 1,
      id: buildLogId(this.taskName, finishedAt),
      task_name: this.taskName,
      started_at: this.startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
      duration_ms: finishedAt.getTime() - this.startedAt.getTime(),
      status: summary.status,
      processed_count: summary.processedCount,
      success_count: summary.successCount,
      failure_count: summary.failureCount,
      errors: summary.errors,
      metadata: { ...this.baseMetadata, ...(summary.metadata ?? {}) },
      environment: {
        node_version: process.versions.node,
        command: this.command
      }
    })

    // 按日期分目录写入，与 collection-inbox 的不可覆盖批次规则一致
    const [year, month, day] = this.startedAt.toISOString().slice(0, 10).split('-')
    const dir = join(this.logDirectory, year, month, day)
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, `${log.id}.json`), `${JSON.stringify(log, null, 2)}\n`, 'utf8')
    return log
  }

  // 快捷方法：任务完全成功
  async succeed(summary: Omit<TaskRunSummary, 'status' | 'errors'>): Promise<TaskRunLog> {
    return this.finish({ ...summary, status: 'success', errors: [] })
  }

  // 快捷方法：部分失败，必须提供 errors
  async partial(summary: Omit<TaskRunSummary, 'status'>): Promise<TaskRunLog> {
    return this.finish({ ...summary, status: 'partial' })
  }

  // 快捷方法：完全失败，自动从 error 提取错误信息
  async fail(
    error: unknown,
    summary?: Partial<Omit<TaskRunSummary, 'status'>>
  ): Promise<TaskRunLog> {
    return this.finish({
      status: 'failed',
      processedCount: summary?.processedCount ?? 0,
      successCount: summary?.successCount ?? 0,
      failureCount: summary?.failureCount ?? 1,
      errors: summary?.errors ?? [formatError(error)],
      metadata: summary?.metadata
    })
  }
}

export const createTaskRunLogger = (options: TaskRunLoggerOptions): TaskRunLogger =>
  new TaskRunLogger(options)

export interface ListTaskRunLogsOptions {
  logDirectory: string
  taskName?: TaskRunLogTaskName
  status?: TaskRunLogStatus
  startDate?: string
  endDate?: string
}

// 查询持久化的运行日志，按 started_at 降序返回（最新在前）
export const listTaskRunLogs = async (options: ListTaskRunLogsOptions): Promise<TaskRunLog[]> => {
  let files: string[] = []
  try {
    files = await listJsonFiles(options.logDirectory)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    return []
  }

  const logs: TaskRunLog[] = []
  for (const file of files) {
    try {
      const raw = await readFile(file, 'utf8')
      const log = TaskRunLogSchema.parse(JSON.parse(raw) as unknown)
      if (options.taskName && log.task_name !== options.taskName) continue
      if (options.status && log.status !== options.status) continue
      if (options.startDate && log.started_at.slice(0, 10) < options.startDate) continue
      if (options.endDate && log.started_at.slice(0, 10) > options.endDate) continue
      logs.push(log)
    } catch {
      // 跳过损坏的日志文件，不阻止其他日志读取
    }
  }
  return logs.sort((left, right) => right.started_at.localeCompare(left.started_at))
}
