import { resolve } from 'node:path'
import { loadDatabaseConfig, parseSqliteUrl } from '../src/config/database.ts'
import { migrateDatabase } from '../src/database/migrate.ts'
import { migrateCollectionInbox } from '../src/ingestion/migrate-collection-inbox.ts'
import { SqliteTrendStore } from '../src/storage/sqlite-trend-store.ts'
import { createTaskRunLogger } from '../src/observability/task-run-logger.ts'

const argumentsByName = new Map<string, string>()
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index]
  const value = process.argv[index + 1]
  if (!key?.startsWith('--') || !value) {
    throw new Error('usage: migrate-trends --inbox <directory> --database <file:URL>')
  }
  argumentsByName.set(key.slice(2), value)
}

const inboxDirectory = resolve(argumentsByName.get('inbox') ?? 'data/collection-inbox')
const config = loadDatabaseConfig()
const databaseUrl = argumentsByName.get('database') ?? config.url

const logger = createTaskRunLogger({
  taskName: 'migrate:trends',
  logDirectory: resolve(argumentsByName.get('logs') ?? 'data/run-logs'),
  metadata: { inbox: inboxDirectory, database: databaseUrl }
})

try {
  const { database, applied } = await migrateDatabase({
    filePath: parseSqliteUrl(databaseUrl),
    migrationsDirectory: config.migrationsDirectory
  })

  try {
    const report = await migrateCollectionInbox({
      inboxDirectory,
      store: new SqliteTrendStore(database)
    })
    database.close()

    process.stdout.write(`${JSON.stringify({ ...report, applied_migrations: applied }, null, 2)}\n`)

    // 坏批次被隔离时记为部分失败，否则记为成功
    if (report.files_failed > 0) {
      process.exitCode = 2
      await logger.partial({
        processedCount: report.files_discovered,
        successCount: report.files_processed,
        failureCount: report.files_failed,
        errors: report.failures.map(failure => `${failure.file}: ${failure.error}`),
        metadata: {
          inserted: report.inserted,
          updated: report.updated,
          deduplicated: report.deduplicated,
          total_trends: report.total_trends
        }
      })
    } else {
      await logger.succeed({
        processedCount: report.files_discovered,
        successCount: report.files_processed,
        failureCount: 0,
        metadata: {
          inserted: report.inserted,
          updated: report.updated,
          deduplicated: report.deduplicated,
          total_trends: report.total_trends
        }
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
