import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { test } from 'node:test'
import { TaskRunLogSchema } from '../src/data/contracts.ts'
import { createTaskRunLogger, listTaskRunLogs } from '../src/observability/task-run-logger.ts'

// 可变固定时钟：确保测试可重复，同时允许前进时间验证 duration_ms
const createFixedClock = (initial: string = '2026-07-31T12:00:00.000Z') => {
  let current = new Date(initial)
  return {
    now: () => new Date(current),
    advance: (ms: number) => {
      current = new Date(current.getTime() + ms)
    },
  }
}

const withTemporaryDirectory = async (callback: (directory: string) => Promise<void>): Promise<void> => {
  const directory = await mkdtemp(join(tmpdir(), 'linggan-logs-'))
  try {
    await callback(directory)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

// 构造一个合法的日志对象用于 Schema 校验测试
const buildValidLog = (overrides: Record<string, unknown> = {}) => ({
  schema_version: 1,
  id: 'task_run_collect_wikipedia_20260731_120000_abc123',
  task_name: 'collect:wikipedia',
  started_at: '2026-07-31T12:00:00.000Z',
  finished_at: '2026-07-31T12:00:01.000Z',
  duration_ms: 1000,
  status: 'success',
  processed_count: 5,
  success_count: 5,
  failure_count: 0,
  errors: [],
  metadata: {},
  environment: { node_version: '24.14.0', command: 'scripts/collect-wikipedia.ts' },
  ...overrides,
})

test('schema accepts a valid success log', () => {
  assert.equal(TaskRunLogSchema.safeParse(buildValidLog()).success, true)
})

test('schema rejects missing required fields', () => {
  assert.equal(TaskRunLogSchema.safeParse({ ...buildValidLog(), task_name: undefined }).success, false)
  assert.equal(TaskRunLogSchema.safeParse({ ...buildValidLog(), started_at: undefined }).success, false)
  assert.equal(TaskRunLogSchema.safeParse({ ...buildValidLog(), duration_ms: undefined }).success, false)
  assert.equal(TaskRunLogSchema.safeParse({ ...buildValidLog(), environment: undefined }).success, false)
})

test('schema rejects unknown task names', () => {
  assert.equal(TaskRunLogSchema.safeParse({ ...buildValidLog(), task_name: 'unknown:task' }).success, false)
})

test('schema rejects invalid status values', () => {
  assert.equal(TaskRunLogSchema.safeParse({ ...buildValidLog(), status: 'completed' }).success, false)
})

test('schema rejects status-error inconsistency', () => {
  // success 状态不能有错误
  assert.equal(TaskRunLogSchema.safeParse({ ...buildValidLog(), status: 'success', errors: ['err'] }).success, false)
  // partial 状态必须有错误
  assert.equal(TaskRunLogSchema.safeParse({ ...buildValidLog(), status: 'partial', errors: [] }).success, false)
  // failed 状态必须有错误
  assert.equal(TaskRunLogSchema.safeParse({ ...buildValidLog(), status: 'failed', errors: [] }).success, false)
})

test('schema rejects finished_at preceding started_at', () => {
  assert.equal(
    TaskRunLogSchema.safeParse({
      ...buildValidLog(),
      started_at: '2026-07-31T12:00:02.000Z',
      finished_at: '2026-07-31T12:00:01.000Z',
    }).success,
    false,
  )
})

test('succeed writes a valid success log to dated directory', async () => {
  await withTemporaryDirectory(async (logDir) => {
    const clock = createFixedClock()
    const logger = createTaskRunLogger({
      taskName: 'collect:wikipedia',
      logDirectory: logDir,
      clock: clock.now,
      metadata: { language: 'zh', date: '2026-07-31' },
    })
    clock.advance(500)
    const log = await logger.succeed({
      processedCount: 5,
      successCount: 5,
      failureCount: 0,
    })

    assert.equal(log.status, 'success')
    assert.equal(log.task_name, 'collect:wikipedia')
    assert.equal(log.processed_count, 5)
    assert.equal(log.duration_ms, 500)
    assert.equal(log.errors.length, 0)
    assert.equal(log.metadata.language, 'zh')

    // 验证文件写入到按日期分目录
    const files = await readdir(join(logDir, '2026', '07', '31'))
    assert.equal(files.length, 1)
    assert.match(files[0], /^task_run_collect_wikipedia_.*\.json$/)

    // 验证文件内容可通过 Schema 校验
    const raw = await readFile(join(logDir, '2026', '07', '31', files[0]), 'utf8')
    TaskRunLogSchema.parse(JSON.parse(raw) as unknown)
  })
})

test('partial writes a log with errors for partial failure', async () => {
  await withTemporaryDirectory(async (logDir) => {
    const logger = createTaskRunLogger({
      taskName: 'migrate:trends',
      logDirectory: logDir,
      clock: createFixedClock().now,
    })
    const log = await logger.partial({
      processedCount: 3,
      successCount: 2,
      failureCount: 1,
      errors: ['bad.json: invalid JSON'],
    })

    assert.equal(log.status, 'partial')
    assert.equal(log.failure_count, 1)
    assert.deepEqual(log.errors, ['bad.json: invalid JSON'])
  })
})

test('fail writes a log with error extracted from exception', async () => {
  await withTemporaryDirectory(async (logDir) => {
    const logger = createTaskRunLogger({
      taskName: 'pipeline:daily',
      logDirectory: logDir,
      clock: createFixedClock().now,
    })
    const log = await logger.fail(new Error('database connection failed'))

    assert.equal(log.status, 'failed')
    assert.equal(log.failure_count, 1)
    assert.equal(log.errors[0], 'database connection failed')
  })
})

test('fail handles non-Error throwables', async () => {
  await withTemporaryDirectory(async (logDir) => {
    const logger = createTaskRunLogger({
      taskName: 'export:trends',
      logDirectory: logDir,
      clock: createFixedClock().now,
    })
    const log = await logger.fail('string error')
    assert.equal(log.errors[0], 'string error')
  })
})

test('listTaskRunLogs filters by task name', async () => {
  await withTemporaryDirectory(async (logDir) => {
    const clock = createFixedClock()
    const logger1 = createTaskRunLogger({
      taskName: 'collect:wikipedia',
      logDirectory: logDir,
      clock: clock.now,
    })
    await logger1.succeed({ processedCount: 1, successCount: 1, failureCount: 0 })
    clock.advance(1000)
    const logger2 = createTaskRunLogger({
      taskName: 'migrate:trends',
      logDirectory: logDir,
      clock: clock.now,
    })
    await logger2.succeed({ processedCount: 1, successCount: 1, failureCount: 0 })

    const wikipediaLogs = await listTaskRunLogs({ logDirectory: logDir, taskName: 'collect:wikipedia' })
    assert.equal(wikipediaLogs.length, 1)
    assert.equal(wikipediaLogs[0].task_name, 'collect:wikipedia')

    const migrateLogs = await listTaskRunLogs({ logDirectory: logDir, taskName: 'migrate:trends' })
    assert.equal(migrateLogs.length, 1)

    const allLogs = await listTaskRunLogs({ logDirectory: logDir })
    assert.equal(allLogs.length, 2)
  })
})

test('listTaskRunLogs filters by status', async () => {
  await withTemporaryDirectory(async (logDir) => {
    const clock = createFixedClock()
    const successLogger = createTaskRunLogger({
      taskName: 'export:trends',
      logDirectory: logDir,
      clock: clock.now,
    })
    await successLogger.succeed({ processedCount: 5, successCount: 5, failureCount: 0 })
    clock.advance(1000)
    const failedLogger = createTaskRunLogger({
      taskName: 'export:trends',
      logDirectory: logDir,
      clock: clock.now,
    })
    await failedLogger.fail(new Error('export failed'))

    const successLogs = await listTaskRunLogs({ logDirectory: logDir, status: 'success' })
    assert.equal(successLogs.length, 1)
    assert.equal(successLogs[0].status, 'success')

    const failedLogs = await listTaskRunLogs({ logDirectory: logDir, status: 'failed' })
    assert.equal(failedLogs.length, 1)
    assert.equal(failedLogs[0].status, 'failed')
  })
})

test('listTaskRunLogs filters by date range', async () => {
  await withTemporaryDirectory(async (logDir) => {
    for (const date of ['2026-07-30', '2026-07-31', '2026-08-01']) {
      const logger = createTaskRunLogger({
        taskName: 'collect:wikipedia',
        logDirectory: logDir,
        clock: () => new Date(`${date}T12:00:00.000Z`),
      })
      await logger.succeed({ processedCount: 1, successCount: 1, failureCount: 0 })
    }

    const july31Only = await listTaskRunLogs({
      logDirectory: logDir,
      startDate: '2026-07-31',
      endDate: '2026-07-31',
    })
    assert.equal(july31Only.length, 1)

    const allJuly = await listTaskRunLogs({
      logDirectory: logDir,
      startDate: '2026-07-01',
      endDate: '2026-07-31',
    })
    assert.equal(allJuly.length, 2)
  })
})

test('listTaskRunLogs returns empty array when directory does not exist', async () => {
  const logs = await listTaskRunLogs({
    logDirectory: join(tmpdir(), `nonexistent-logs-${Date.now()}`),
  })
  assert.deepEqual(logs, [])
})

test('each run produces an independent log file with unique id', async () => {
  await withTemporaryDirectory(async (logDir) => {
    const clock = createFixedClock()
    for (let i = 0; i < 3; i++) {
      const logger = createTaskRunLogger({
        taskName: 'pipeline:daily',
        logDirectory: logDir,
        clock: clock.now,
      })
      await logger.succeed({ processedCount: i, successCount: i, failureCount: 0 })
      clock.advance(1000)
    }

    const logs = await listTaskRunLogs({ logDirectory: logDir })
    assert.equal(logs.length, 3)
    const ids = new Set(logs.map((log) => log.id))
    assert.equal(ids.size, 3)
  })
})

test('listTaskRunLogs skips corrupted log files', async () => {
  await withTemporaryDirectory(async (logDir) => {
    const logger = createTaskRunLogger({
      taskName: 'collect:wikipedia',
      logDirectory: logDir,
      clock: createFixedClock().now,
    })
    await logger.succeed({ processedCount: 1, successCount: 1, failureCount: 0 })

    // 在同一日期目录写入损坏的 JSON 文件
    const dir = join(logDir, '2026', '07', '31')
    await writeFile(join(dir, 'corrupted.json'), '{broken json')

    const logs = await listTaskRunLogs({ logDirectory: logDir })
    assert.equal(logs.length, 1)
  })
})

test('listTaskRunLogs returns logs sorted by started_at descending', async () => {
  await withTemporaryDirectory(async (logDir) => {
    const clock = createFixedClock()
    const timestamps: string[] = []
    for (let i = 0; i < 3; i++) {
      const logger = createTaskRunLogger({
        taskName: 'export:candidates',
        logDirectory: logDir,
        clock: clock.now,
      })
      const log = await logger.succeed({ processedCount: i, successCount: i, failureCount: 0 })
      timestamps.push(log.started_at)
      clock.advance(2000)
    }

    const logs = await listTaskRunLogs({ logDirectory: logDir })
    assert.equal(logs.length, 3)
    assert.equal(logs[0].started_at, timestamps[2])
    assert.equal(logs[2].started_at, timestamps[0])
  })
})

test('metadata is merged from constructor and finish summary', async () => {
  await withTemporaryDirectory(async (logDir) => {
    const logger = createTaskRunLogger({
      taskName: 'collect:wikipedia',
      logDirectory: logDir,
      clock: createFixedClock().now,
      metadata: { language: 'zh', date: '2026-07-31' },
    })
    const log = await logger.succeed({
      processedCount: 5,
      successCount: 5,
      failureCount: 0,
      metadata: { items_written: 5, dry_run: false },
    })

    assert.equal(log.metadata.language, 'zh')
    assert.equal(log.metadata.date, '2026-07-31')
    assert.equal(log.metadata.items_written, 5)
    assert.equal(log.metadata.dry_run, false)
  })
})

test('environment records node version and command', async () => {
  await withTemporaryDirectory(async (logDir) => {
    const logger = createTaskRunLogger({
      taskName: 'migrate:trends',
      logDirectory: logDir,
      clock: createFixedClock().now,
    })
    const log = await logger.succeed({ processedCount: 1, successCount: 1, failureCount: 0 })

    assert.equal(log.environment.node_version, process.versions.node)
    assert.ok(log.environment.command.length > 0)
  })
})
