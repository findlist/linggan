import { resolve } from 'node:path'
import { loadDatabaseConfig, parseSqliteUrl } from '../src/config/database.ts'
import { migrateDatabase } from '../src/database/migrate.ts'
import { migrateCollectionInbox } from '../src/ingestion/migrate-collection-inbox.ts'
import { SqliteTrendStore } from '../src/storage/sqlite-trend-store.ts'

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
const { database, applied } = await migrateDatabase({
  filePath: parseSqliteUrl(databaseUrl),
  migrationsDirectory: config.migrationsDirectory
})
const report = await migrateCollectionInbox({
  inboxDirectory,
  store: new SqliteTrendStore(database)
})
database.close()

process.stdout.write(`${JSON.stringify({ ...report, applied_migrations: applied }, null, 2)}\n`)
if (report.files_failed > 0) process.exitCode = 2
