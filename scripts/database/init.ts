import { readFile } from 'node:fs/promises'
import { loadDatabaseConfig } from '../../src/config/database.ts'
import { migrateDatabase } from '../../src/database/migrate.ts'
import { seedKnowledgeBase } from '../../src/database/seed-knowledge.ts'

const config = loadDatabaseConfig()
const { database, applied } = await migrateDatabase({
  filePath: config.filePath,
  migrationsDirectory: config.migrationsDirectory,
})
const knowledge = JSON.parse(
  await readFile(new URL('../../data/knowledge-base.json', import.meta.url), 'utf8'),
) as unknown
const seeded = seedKnowledgeBase(database, knowledge)

const tables = database
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
  .all() as Array<{ name: string }>
database.close()

process.stdout.write(
  `${JSON.stringify(
    {
      database: config.filePath,
      applied_migrations: applied,
      seeded,
      tables: tables.map((row) => row.name),
    },
    null,
    2,
  )}\n`,
)
