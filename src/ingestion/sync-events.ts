// 事件回收入库：扫描 event-inbox 目录的前端导出 JSON 文件，
// 逐个事件经 ProductEventSchema 校验后写入 EventStore（SQLite），幂等键 event_id 去重。
//
// 设计与 migrate-collection-inbox 一致：
// - 递归扫描目录下所有 .json 文件
// - 文件级用 EventQueueExportSchema 校验结构，坏文件隔离报告
// - 事件级逐个 store.record，单条坏事件不阻止同文件其他事件
// - 幂等：重复 sync 同一文件，event_id 冲突时 INSERT OR IGNORE 跳过

import { readdir, readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { EventQueueExportSchema } from '../data/contracts.ts'
import type { EventStore } from '../storage/event-store.ts'

export interface SyncFailure {
  file: string
  error: string
}

export interface SyncReport {
  files_discovered: number
  files_processed: number
  files_failed: number
  events_discovered: number
  events_recorded: number // 新写入
  events_skipped: number // event_id 幂等跳过
  events_failed: number // Schema 校验或写入失败
  failures: SyncFailure[]
}

const listJsonFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) return listJsonFiles(path)
      return entry.isFile() && extname(entry.name).toLowerCase() === '.json' ? [path] : []
    }),
  )
  return nested.flat().sort()
}

const formatError = (error: unknown): string => (error instanceof Error ? error.message : String(error))

/**
 * 扫描 event-inbox 目录，把前端导出的事件回收到 EventStore。
 * 坏文件和坏事件被隔离报告，不阻止其他有效数据入库。
 */
export const syncEventInbox = async (input: { inboxDirectory: string; store: EventStore }): Promise<SyncReport> => {
  let files: string[] = []
  try {
    files = await listJsonFiles(input.inboxDirectory)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }

  const failures: SyncFailure[] = []
  let filesProcessed = 0
  let eventsDiscovered = 0
  let eventsRecorded = 0
  let eventsSkipped = 0
  let eventsFailed = 0

  for (const file of files) {
    try {
      const raw = await readFile(file, 'utf8')
      const doc = EventQueueExportSchema.parse(JSON.parse(raw) as unknown)
      filesProcessed += 1
      eventsDiscovered += doc.events.length

      // 逐个事件写入；store.record 内部做 ProductEventSchema 校验和幂等判断
      for (const event of doc.events) {
        try {
          const result = await input.store.record(event as Parameters<EventStore['record']>[0])
          if (result.recorded > 0) {
            eventsRecorded += 1
          } else {
            eventsSkipped += 1
          }
        } catch {
          // 单条事件校验或写入失败：计入失败数，继续处理其他事件
          eventsFailed += 1
        }
      }
    } catch (error) {
      failures.push({ file, error: formatError(error) })
    }
  }

  return {
    files_discovered: files.length,
    files_processed: filesProcessed,
    files_failed: failures.length,
    events_discovered: eventsDiscovered,
    events_recorded: eventsRecorded,
    events_skipped: eventsSkipped,
    events_failed: eventsFailed,
    failures,
  }
}
