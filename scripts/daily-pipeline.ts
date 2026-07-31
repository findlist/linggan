import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  CompatibilityMatrixSchema,
  KnowledgeBaseSchema,
  SeedEntitiesSchema,
  TrendInboxSchema
} from '../src/data/contracts.ts'
import type { CandidateGenerationConfig } from '../src/generation/candidate-generator.ts'
import { generateDailyCandidates } from '../src/generation/candidate-generator.ts'
import { storedTrendsToTrends } from '../src/generation/trend-adapter.ts'
import {
  buildProductionPlans,
  type ProductionPlanInput,
  type RemixStyle
} from '../src/generation/remix-engine.ts'
import { loadDatabaseConfig, parseSqliteUrl } from '../src/config/database.ts'
import { migrateDatabase } from '../src/database/migrate.ts'
import { SqliteTrendStore } from '../src/storage/sqlite-trend-store.ts'
import { SqliteCandidateStore } from '../src/storage/sqlite-candidate-store.ts'
import { createTaskRunLogger } from '../src/observability/task-run-logger.ts'

const root = new URL('../', import.meta.url)
const readJson = async (path: string): Promise<unknown> =>
  JSON.parse(await readFile(new URL(path, root), 'utf8')) as unknown

const useExample = process.argv.includes('--example')
const persist = !process.argv.includes('--no-persist')

const logger = createTaskRunLogger({
  taskName: 'pipeline:daily',
  logDirectory: resolve('data/run-logs'),
  metadata: { use_example: useExample, persist }
})

try {
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

  let inserted = 0
  let skipped = 0
  let total = 0

  // Persist candidates to SQLite if database is available
  if (candidateStore && database) {
    const idempotencyPrefix = `pipeline_${report.date}`
    const result = await candidateStore.insert(report.candidates, idempotencyPrefix)
    inserted = result.inserted
    skipped = result.skipped
    total = result.total
    process.stderr.write(
      `Persisted ${inserted} candidates (${skipped} duplicates skipped, ${total} total in store)\n`
    )
    database.close()
  }

  // C2: 集成 C1 兼容矩阵过滤，生成完整制作包并记录统计
  // 在候选生成后，读取知识库和兼容矩阵，构建跨作品组合并用 C1 过滤
  let productionStats: { total: number; filtered_out: number; remaining: number; threshold: number } | null = null
  try {
    const [rawKnowledge, rawMatrix] = await Promise.all([
      readJson('data/knowledge-base.json'),
      readJson('data/compatibility-matrix.json')
    ])
    const knowledge = KnowledgeBaseSchema.parse(rawKnowledge)
    const matrix = CompatibilityMatrixSchema.parse(rawMatrix)
    const workById = new Map(knowledge.works.map(w => [w.id, w]))
    const style: RemixStyle = { id: 'cinematic', label: '电影感热血', prompt: '克制写实光影、宽银幕构图' }

    // 构建有限组合列表：前 5 个角色两两配对 × 前 3 个名场面 × 30s，控制单轮规模
    const characters = knowledge.known_characters.slice(0, 5)
    const moments = knowledge.iconic_moments.slice(0, 3)
    const inputs: ProductionPlanInput[] = []
    for (let i = 0; i < characters.length; i++) {
      for (let j = i + 1; j < characters.length; j++) {
        for (const moment of moments) {
          const workA = workById.get(characters[i].work_id)
          const workB = workById.get(characters[j].work_id)
          const momentWork = workById.get(moment.work_id)
          if (!workA || !workB || !momentWork) continue
          inputs.push({
            characterA: characters[i],
            characterB: characters[j],
            moment,
            duration: 30,
            workA,
            workB,
            momentWork,
            style,
            seed: `pipeline-${report.date}-${i}-${j}-${moment.id}`
          })
        }
      }
    }

    const productionResult = buildProductionPlans(inputs, matrix)
    productionStats = {
      total: productionResult.stats.total_combinations,
      filtered_out: productionResult.stats.filtered_out,
      remaining: productionResult.stats.remaining,
      threshold: productionResult.stats.threshold
    }
    process.stderr.write(
      `Production plans: ${productionResult.stats.remaining}/${productionResult.stats.total_combinations} combinations passed C1 filter (threshold ${productionResult.stats.threshold}, ${productionResult.stats.filtered_out} filtered out)\n`
    )
  } catch (productionError) {
    // 知识库或兼容矩阵不可用时不阻塞候选生成流程
    process.stderr.write(`C1 production filter skipped: ${(productionError as Error).message}\n`)
  }

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)

  await logger.succeed({
    processedCount: trends.length,
    successCount: report.candidates.length,
    failureCount: 0,
    metadata: {
      date: report.date,
      candidates: report.candidates.length,
      inserted,
      skipped,
      total,
      production_total: productionStats?.total ?? 0,
      production_filtered_out: productionStats?.filtered_out ?? 0,
      production_remaining: productionStats?.remaining ?? 0,
      production_threshold: productionStats?.threshold ?? 0
    }
  })
} catch (error) {
  await logger.fail(error)
  throw error
}
