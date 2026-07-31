import { mkdir, rename, writeFile, rm } from 'node:fs/promises'
import { dirname } from 'node:path'
import { TrendExportDocumentSchema } from '../src/data/contracts.ts'
import type { TrendExportDocument } from '../src/data/contracts.ts'
import { loadDatabaseConfig, parseSqliteUrl } from '../src/config/database.ts'
import { migrateDatabase } from '../src/database/migrate.ts'
import { SqliteTrendStore } from '../src/storage/sqlite-trend-store.ts'
import { createTaskRunLogger } from '../src/observability/task-run-logger.ts'

export interface ExportOptions {
  outputPath: string
  databaseUrl?: string
}

export const exportTrends = async (options: ExportOptions): Promise<TrendExportDocument> => {
  const migrationsDirectory = new URL('../database/migrations', import.meta.url).pathname
    .replace(/^\/(?:[A-Za-z]:)/u, value => value.slice(1))

  const dbConfig = options.databaseUrl
    ? { url: options.databaseUrl, filePath: parseSqliteUrl(options.databaseUrl), migrationsDirectory }
    : loadDatabaseConfig()

  const { database } = await migrateDatabase({
    filePath: dbConfig.filePath,
    migrationsDirectory: dbConfig.migrationsDirectory
  })

  try {
    const store = new SqliteTrendStore(database)
    const trends = await store.list()

    const document: TrendExportDocument = {
      schema_version: 1,
      exported_at: new Date().toISOString(),
      trend_count: trends.length,
      trends
    }

    // Validate before writing
    const validated = TrendExportDocumentSchema.parse(document)

    // Atomic write: write to temp file, then rename
    await mkdir(dirname(options.outputPath), { recursive: true })
    const tempPath = `${options.outputPath}.${process.pid}.${Date.now()}.tmp`

    try {
      await writeFile(tempPath, `${JSON.stringify(validated, null, 2)}\n`, {
        encoding: 'utf8',
        flag: 'wx'
      })
      await rename(tempPath, options.outputPath)
    } catch (error) {
      await rm(tempPath, { force: true })
      throw error
    }

    return validated
  } finally {
    database.close()
  }
}

// CLI entry point
const outputPath = process.argv[2] ?? 'public/data/trend-export.json'
const logger = createTaskRunLogger({
  taskName: 'export:trends',
  logDirectory: 'data/run-logs',
  metadata: { output: outputPath }
})

try {
  const result = await exportTrends({ outputPath })
  process.stdout.write(`Exported ${result.trend_count} trends to ${outputPath}\n`)
  await logger.succeed({
    processedCount: result.trend_count,
    successCount: result.trend_count,
    failureCount: 0,
    metadata: { trend_count: result.trend_count }
  })
} catch (error) {
  await logger.fail(error)
  throw error
}
