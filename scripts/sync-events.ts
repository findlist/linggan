import { resolve } from 'node:path'
import { loadDatabaseConfig, parseSqliteUrl } from '../src/config/database.ts'
import { migrateDatabase } from '../src/database/migrate.ts'
import { syncEventInbox } from '../src/ingestion/sync-events.ts'
import { SqliteEventStore } from '../src/storage/sqlite-event-store.ts'
import { createTaskRunLogger } from '../src/observability/task-run-logger.ts'

// 解析命令行参数：支持 --inbox <dir> --database <file:URL> --logs <dir>
const argumentsByName = new Map<string, string>()
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index]
  const value = process.argv[index + 1]
  if (!key?.startsWith('--') || !value) {
    throw new Error('usage: sync-events --inbox <directory> --database <file:URL> --logs <directory>')
  }
  argumentsByName.set(key.slice(2), value)
}

const inboxDirectory = resolve(argumentsByName.get('inbox') ?? 'data/event-inbox')
const config = loadDatabaseConfig()
const databaseUrl = argumentsByName.get('database') ?? config.url

const logger = createTaskRunLogger({
  taskName: 'sync:events',
  logDirectory: resolve(argumentsByName.get('logs') ?? 'data/run-logs'),
  metadata: { inbox: inboxDirectory, database: databaseUrl },
})

try {
  // 确保数据库迁移已应用（product_events 表存在）
  const { database, applied } = await migrateDatabase({
    filePath: parseSqliteUrl(databaseUrl),
    migrationsDirectory: config.migrationsDirectory,
  })

  try {
    const report = await syncEventInbox({
      inboxDirectory,
      store: new SqliteEventStore(database),
    })
    database.close()

    process.stdout.write(`${JSON.stringify({ ...report, applied_migrations: applied }, null, 2)}\n`)

    // 有文件失败或事件失败时记为部分失败，否则记为成功
    if (report.files_failed > 0 || report.events_failed > 0) {
      process.exitCode = 2
      await logger.partial({
        processedCount: report.files_discovered,
        successCount: report.files_processed,
        failureCount: report.files_failed,
        errors: report.failures.map((failure) => `${failure.file}: ${failure.error}`),
        metadata: {
          events_discovered: report.events_discovered,
          events_recorded: report.events_recorded,
          events_skipped: report.events_skipped,
          events_failed: report.events_failed,
        },
      })
    } else {
      await logger.succeed({
        processedCount: report.files_discovered,
        successCount: report.files_processed,
        failureCount: 0,
        metadata: {
          events_discovered: report.events_discovered,
          events_recorded: report.events_recorded,
          events_skipped: report.events_skipped,
        },
      })
    }
  } catch (error) {
    database.close()
    throw error
  }
} catch (error) {
  await logger.fail(error)
  throw error
}
