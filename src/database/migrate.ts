import { mkdir, readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const migrationPattern = /^(\d+)_([a-z0-9_]+)\.sql$/u

export interface AppliedMigration {
  version: number
  name: string
}

export const openSqliteDatabase = (filePath: string): DatabaseSync => {
  const database = new DatabaseSync(filePath)
  database.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;')
  return database
}

export const migrateDatabase = async (input: {
  filePath: string
  migrationsDirectory: string
}): Promise<{ database: DatabaseSync; applied: AppliedMigration[] }> => {
  if (input.filePath !== ':memory:') await mkdir(dirname(input.filePath), { recursive: true })
  const database = openSqliteDatabase(input.filePath)
  const applied: AppliedMigration[] = []

  try {
    database.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
    `)
    const files = (await readdir(input.migrationsDirectory)).sort()
    const current = new Set(
      (database.prepare('SELECT version FROM schema_migrations').all() as Array<{ version: number }>).map(
        (row) => row.version,
      ),
    )

    for (const file of files) {
      const match = migrationPattern.exec(file)
      if (!match) continue
      const version = Number(match[1])
      const name = match[2]
      if (current.has(version)) continue
      const sql = await readFile(join(input.migrationsDirectory, file), 'utf8')

      database.exec('BEGIN IMMEDIATE')
      try {
        database.exec(sql)
        database
          .prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)')
          .run(version, name, new Date().toISOString())
        database.exec('COMMIT')
      } catch (error) {
        database.exec('ROLLBACK')
        throw error
      }
      applied.push({ version, name })
    }

    return { database, applied }
  } catch (error) {
    database.close()
    throw error
  }
}
