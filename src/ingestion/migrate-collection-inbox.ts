import { readdir, readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { CollectionBatchSchema } from '../data/contracts.ts'
import type { TrendStore } from '../storage/trend-store.ts'

export interface MigrationFailure {
  file: string
  error: string
}

export interface MigrationReport {
  files_discovered: number
  files_processed: number
  files_failed: number
  items_validated: number
  inserted: number
  updated: number
  deduplicated: number
  total_trends: number
  failures: MigrationFailure[]
}

const listJsonFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async entry => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return listJsonFiles(path)
    return entry.isFile() && extname(entry.name).toLowerCase() === '.json' ? [path] : []
  }))
  return nested.flat().sort()
}

const formatError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

export const migrateCollectionInbox = async (input: {
  inboxDirectory: string
  store: TrendStore
}): Promise<MigrationReport> => {
  let files: string[] = []
  try {
    files = await listJsonFiles(input.inboxDirectory)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }

  const entries: Array<{ item: ReturnType<typeof CollectionBatchSchema.parse>['items'][number]; batchId: string }> = []
  const failures: MigrationFailure[] = []
  let filesProcessed = 0

  for (const file of files) {
    try {
      const raw = await readFile(file, 'utf8')
      const batch = CollectionBatchSchema.parse(JSON.parse(raw) as unknown)
      entries.push(...batch.items.map(item => ({ item, batchId: batch.run.id })))
      filesProcessed += 1
    } catch (error) {
      failures.push({ file, error: formatError(error) })
    }
  }

  const result = await input.store.upsert(entries)
  return {
    files_discovered: files.length,
    files_processed: filesProcessed,
    files_failed: failures.length,
    items_validated: entries.length,
    inserted: result.inserted,
    updated: result.updated,
    deduplicated: result.deduplicated,
    total_trends: result.total,
    failures
  }
}
