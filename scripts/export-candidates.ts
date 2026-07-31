import { mkdir, rename, writeFile, rm } from 'node:fs/promises'
import { dirname } from 'node:path'
import { CandidateExportDocumentSchema } from '../src/data/contracts.ts'
import type { CandidateExportDocument } from '../src/data/contracts.ts'
import { loadDatabaseConfig, parseSqliteUrl } from '../src/config/database.ts'
import { migrateDatabase } from '../src/database/migrate.ts'
import { SqliteCandidateStore } from '../src/storage/sqlite-candidate-store.ts'

// 首页今日推荐流最多展示 10 条已批准候选
const MAX_PUBLISHED_CANDIDATES = 10

export interface CandidateExportOptions {
  outputPath: string
  databaseUrl?: string
  limit?: number
}

export const exportCandidates = async (
  options: CandidateExportOptions
): Promise<CandidateExportDocument> => {
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
    const store = new SqliteCandidateStore(database)
    // 只读取已批准候选，按 generated_at DESC（由 store.list 保证）
    const approved = await store.list('approved')
    const limit = options.limit ?? MAX_PUBLISHED_CANDIDATES
    const candidates = approved.slice(0, limit)

    const document: CandidateExportDocument = {
      schema_version: 1,
      exported_at: new Date().toISOString(),
      candidate_count: candidates.length,
      candidates
    }

    // 写入前再次校验：状态机、数量、唯一 ID、全部 approved
    const validated = CandidateExportDocumentSchema.parse(document)

    // 原子写入：先写临时文件，再 rename 替换
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

// CLI 入口
const outputPath = process.argv[2] ?? 'public/data/candidate-export.json'
const result = await exportCandidates({ outputPath })
process.stdout.write(`Exported ${result.candidate_count} approved candidates to ${outputPath}\n`)
