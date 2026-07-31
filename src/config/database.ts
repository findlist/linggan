import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('../../', import.meta.url))

export interface DatabaseConfig {
  url: string
  filePath: string
  migrationsDirectory: string
}

export const parseSqliteUrl = (url: string, baseDirectory = projectRoot): string => {
  if (url === ':memory:' || url === 'file::memory:') return ':memory:'
  if (!url.startsWith('file:')) {
    throw new Error('DATABASE_URL must use file: for SQLite')
  }

  const path = url.slice('file:'.length)
  if (!path) throw new Error('DATABASE_URL must include a SQLite file path')
  return resolve(baseDirectory, path)
}

export const loadDatabaseConfig = (environment: NodeJS.ProcessEnv = process.env): DatabaseConfig => {
  const url = environment.DATABASE_URL ?? 'file:./data/linggan.sqlite'
  return {
    url,
    filePath: parseSqliteUrl(url),
    migrationsDirectory: resolve(projectRoot, 'database/migrations'),
  }
}
