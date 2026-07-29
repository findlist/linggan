import { resolve } from 'node:path'
import { migrateCollectionInbox } from '../src/ingestion/migrate-collection-inbox.ts'
import { JsonTrendStore } from '../src/storage/trend-store.ts'

const argumentsByName = new Map<string, string>()
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index]
  const value = process.argv[index + 1]
  if (!key?.startsWith('--') || !value) {
    throw new Error('usage: migrate-trends --inbox <directory> --store <file>')
  }
  argumentsByName.set(key.slice(2), value)
}

const inboxDirectory = resolve(argumentsByName.get('inbox') ?? 'data/collection-inbox')
const storePath = resolve(argumentsByName.get('store') ?? 'data/stores/trends.json')
const report = await migrateCollectionInbox({
  inboxDirectory,
  store: new JsonTrendStore(storePath)
})

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
if (report.files_failed > 0) process.exitCode = 2
