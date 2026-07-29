import { readFile } from 'node:fs/promises'
import { SeedEntitiesSchema, TrendInboxSchema } from '../src/data/contracts.ts'
import type { CandidateGenerationConfig } from '../src/generation/candidate-generator.ts'
import { generateDailyCandidates } from '../src/generation/candidate-generator.ts'
import { storedTrendsToTrends } from '../src/generation/trend-adapter.ts'
import { loadDatabaseConfig, parseSqliteUrl } from '../src/config/database.ts'
import { migrateDatabase } from '../src/database/migrate.ts'
import { SqliteTrendStore } from '../src/storage/sqlite-trend-store.ts'
import { SqliteCandidateStore } from '../src/storage/sqlite-candidate-store.ts'

const root = new URL('../', import.meta.url)
const readJson = async (path: string): Promise<unknown> =>
  JSON.parse(await readFile(new URL(path, root), 'utf8')) as unknown

const useExample = process.argv.includes('--example')
const persist = !process.argv.includes('--no-persist')

const [rawConfig, rawSeeds] = await Promise.all([
  readJson('config/pipeline.json'),
  readJson('data/seed-entities.json')
])

let trends
let candidateStore: SqliteCandidateStore | null = null
let database: import('node:sqlite').DatabaseSync | null = null

if (useExample) {
  // Explicit example input for fixed-sample testing and demos
  trends = TrendInboxSchema.parse(await readJson('data/trend-inbox.example.json'))
} else {
  // Default: read from SQLite formal trend store
  const dbConfig = loadDatabaseConfig()
  const migrated = await migrateDatabase({
    filePath: parseSqliteUrl(dbConfig.url),
    migrationsDirectory: dbConfig.migrationsDirectory
  })
  database = migrated.database

  try {
    const store = new SqliteTrendStore(database)
    const storedTrends = await store.list()
    trends = storedTrendsToTrends(storedTrends)
  } catch (error) {
    database.close()
    throw error
  }
}

if (persist && database) {
  candidateStore = new SqliteCandidateStore(database)
}

const report = generateDailyCandidates({
  config: rawConfig as CandidateGenerationConfig,
  seeds: SeedEntitiesSchema.parse(rawSeeds),
  trends,
  clock: () => new Date()
})

// Persist candidates to SQLite if database is available
if (candidateStore && database) {
  const idempotencyPrefix = `pipeline_${report.date}`
  const result = await candidateStore.insert(report.candidates, idempotencyPrefix)
  process.stderr.write(
    `Persisted ${result.inserted} candidates (${result.skipped} duplicates skipped, ${result.total} total in store)\n`
  )
  database.close()
}

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
