import { readFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import {
  CompatibilityMatrixSchema,
  KnowledgeBaseSchema,
  SeedEntitiesSchema,
  TrendInboxSchema,
} from '../src/data/contracts.ts'
import type { CandidateGenerationConfig } from '../src/generation/candidate-generator.ts'
import { generateDailyCandidates } from '../src/generation/candidate-generator.ts'
import { storedTrendsToTrends } from '../src/generation/trend-adapter.ts'
import { buildProductionPlans, type ProductionPlanInput, type RemixStyle } from '../src/generation/remix-engine.ts'
import { detectDuplicates } from '../src/generation/similarity.ts'
import { toRemixCharacter, createOriginalWork } from '../src/generation/original-adapter.ts'
import { loadDatabaseConfig, parseSqliteUrl } from '../src/config/database.ts'
import { migrateDatabase } from '../src/database/migrate.ts'
import { SqliteTrendStore } from '../src/storage/sqlite-trend-store.ts'
import { SqliteCandidateStore } from '../src/storage/sqlite-candidate-store.ts'
import { createTaskRunLogger } from '../src/observability/task-run-logger.ts'
import { reviewCandidates } from '../src/review/auto-reviewer.ts'
import type { AutoReviewConfig } from '../src/review/auto-reviewer.ts'
import type { CandidateStatus } from '../src/storage/candidate-store.ts'
import { exportCandidates } from './export-candidates.ts'
import { fetchWikipediaMostRead, transformWikipediaMostRead } from '../src/collectors/wikipedia-adapter.ts'
import { migrateCollectionInbox } from '../src/ingestion/migrate-collection-inbox.ts'

const root = new URL('../', import.meta.url)
const readJson = async (path: string): Promise<unknown> =>
  JSON.parse(await readFile(new URL(path, root), 'utf8')) as unknown

const useExample = process.argv.includes('--example')
const persist = !process.argv.includes('--no-persist')
const skipReview = process.argv.includes('--no-review')
const skipExport = process.argv.includes('--no-export')
const skipCollect = process.argv.includes('--no-collect') || useExample
const skipMigrate = process.argv.includes('--no-migrate') || useExample

const logger = createTaskRunLogger({
  taskName: 'pipeline:daily',
  logDirectory: resolve('data/run-logs'),
  metadata: { use_example: useExample, persist },
})

// 采集统计
let collectStats: { items: number; batch_file: string | null; error: string | null } | null = null
// 迁移统计
let migrateStats: {
  discovered: number
  processed: number
  inserted: number
  updated: number
  deduplicated: number
  total_trends: number
  error: string | null
} | null = null

try {
  const [rawConfig, rawSeeds] = await Promise.all([
    readJson('config/pipeline.json'),
    readJson('data/seed-entities.json'),
  ])

  // 可选步骤 1：采集公开热点到 collection-inbox（--no-collect 或 --example 跳过）
  if (!skipCollect) {
    try {
      const language = 'zh'
      const date = new Date().toISOString().slice(0, 10)
      const response = await fetchWikipediaMostRead({ language, date })
      const now = new Date()
      const collectedAt = now.toISOString()
      const timeSlug = now.toISOString().slice(11, 19).replace(/:/gu, '')
      const dateSlug = date.replace(/-/gu, '')
      const runId = `wiki_most_read_${language}_${dateSlug}_${timeSlug}`
      const batch = transformWikipediaMostRead({ response, language, collectedAt, runId })
      const [year, month, day] = date.split('-')
      const targetDir = join('data/collection-inbox', year, month, day)
      await mkdir(targetDir, { recursive: true })
      const fileName = `${date}_${timeSlug}+00-00.json`
      const batchPath = join(targetDir, fileName)
      await writeFile(batchPath, `${JSON.stringify(batch, null, 2)}\n`, 'utf8')
      collectStats = { items: batch.items.length, batch_file: batchPath, error: null }
      process.stderr.write(`Collected ${batch.items.length} items from Wikipedia (${language}) to ${batchPath}\n`)
    } catch (collectError) {
      collectStats = { items: 0, batch_file: null, error: (collectError as Error).message }
      process.stderr.write(`Collect skipped: ${(collectError as Error).message}\n`)
    }
  }

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
      migrationsDirectory: dbConfig.migrationsDirectory,
    })
    database = migrated.database

    // 可选步骤 2：迁移 collection-inbox 批次到 SQLite（--no-migrate 或 --example 跳过）
    if (!skipMigrate) {
      try {
        const migrateReport = await migrateCollectionInbox({
          inboxDirectory: 'data/collection-inbox',
          store: new SqliteTrendStore(database),
        })
        migrateStats = {
          discovered: migrateReport.files_discovered,
          processed: migrateReport.files_processed,
          inserted: migrateReport.inserted,
          updated: migrateReport.updated,
          deduplicated: migrateReport.deduplicated,
          total_trends: migrateReport.total_trends,
          error: null,
        }
        process.stderr.write(
          `Migrated ${migrateReport.files_processed} batches (${migrateReport.inserted} inserted, ${migrateReport.deduplicated} deduplicated, ${migrateReport.total_trends} total trends)\n`,
        )
      } catch (migrateError) {
        migrateStats = {
          discovered: 0,
          processed: 0,
          inserted: 0,
          updated: 0,
          deduplicated: 0,
          total_trends: 0,
          error: (migrateError as Error).message,
        }
        process.stderr.write(`Migrate skipped: ${(migrateError as Error).message}\n`)
      }
    }

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
    clock: () => new Date(),
  })

  let inserted = 0
  let skipped = 0
  let total = 0

  // Persist candidates to SQLite if database is available
  let reviewApproved = 0
  let reviewRejected = 0
  let reviewErrors = 0
  if (candidateStore && database) {
    const idempotencyPrefix = `pipeline_${report.date}`
    const result = await candidateStore.insert(report.candidates, idempotencyPrefix)
    inserted = result.inserted
    skipped = result.skipped
    total = result.total
    process.stderr.write(`Persisted ${inserted} candidates (${skipped} duplicates skipped, ${total} total in store)\n`)

    // Auto-review: 对新插入的 pending_review 候选自动审核
    // automatic_publish 开关控制全局熔断，--no-review 可跳过
    const pipelineConfig = rawConfig as {
      limits: { publish_score: number; similarity_ceiling: number; automatic_publish: boolean }
    }
    const { automatic_publish } = pipelineConfig.limits
    if (!skipReview && automatic_publish && inserted > 0) {
      const pending = await candidateStore.list('pending_review')
      if (pending.length > 0) {
        const reviewConfig: AutoReviewConfig = {
          publish_score: pipelineConfig.limits.publish_score,
          similarity_ceiling: pipelineConfig.limits.similarity_ceiling,
        }
        const decisions = reviewCandidates(pending, reviewConfig)
        for (const candidate of pending) {
          const decision = decisions.get(candidate.id)
          if (!decision) {
            reviewErrors += 1
            continue
          }
          const targetStatus: CandidateStatus = decision.decision === 'approve' ? 'approved' : 'rejected'
          try {
            await candidateStore.transition(candidate.id, targetStatus, decision.reason)
            if (decision.decision === 'approve') reviewApproved += 1
            else reviewRejected += 1
          } catch {
            // 单条失败不阻塞其他候选
            reviewErrors += 1
          }
        }
        process.stderr.write(
          `Auto-review: ${reviewApproved} approved, ${reviewRejected} rejected, ${reviewErrors} errors out of ${pending.length} pending\n`,
        )
      }
    } else if (!skipReview && !automatic_publish) {
      process.stderr.write('Auto-review skipped: automatic_publish is disabled\n')
    }

    database.close()
  }

  // Auto-export: 审核完成后自动导出 approved 候选到只读 JSON 供前端消费
  // --no-export 可跳过；--example 模式下无数据库持久化，导出会输出 0 条候选
  let exportCount = 0
  const exportSkipped = skipExport
  if (!skipExport && persist) {
    try {
      const exportResult = await exportCandidates({ outputPath: 'public/data/candidate-export.json' })
      exportCount = exportResult.candidate_count
      process.stderr.write(`Exported ${exportCount} approved candidates to public/data/candidate-export.json\n`)
    } catch (exportError) {
      // 导出失败不阻塞 pipeline 主流程，候选已在 SQLite 中持久化
      process.stderr.write(`Auto-export failed: ${(exportError as Error).message}\n`)
    }
  } else if (skipExport) {
    process.stderr.write('Auto-export skipped: --no-export flag\n')
  }

  // C2: 集成 C1 兼容矩阵过滤，生成完整制作包并记录统计
  // 在候选生成后，读取知识库和兼容矩阵，构建跨作品组合并用 C1 过滤
  let productionStats: { total: number; filtered_out: number; remaining: number; threshold: number } | null = null
  let similarityStats: {
    total: number
    duplicates: number
    unique: number
    avg_max_similarity: number
    threshold: number
  } | null = null
  let knownCharCount = 0
  let originalCharCount = 0
  try {
    const [rawKnowledge, rawMatrix] = await Promise.all([
      readJson('data/knowledge-base.json'),
      readJson('data/compatibility-matrix.json'),
    ])
    const knowledge = KnowledgeBaseSchema.parse(rawKnowledge)
    const matrix = CompatibilityMatrixSchema.parse(rawMatrix)
    const seeds = SeedEntitiesSchema.parse(rawSeeds)
    const workById = new Map(knowledge.works.map((w) => [w.id, w]))
    // 注册原创角色合成作品，使原创角色可参与跨作品组合
    const originalWork = createOriginalWork()
    workById.set(originalWork.id, originalWork)
    const style: RemixStyle = { id: 'cinematic', label: '电影感热血', prompt: '克制写实光影、宽银幕构图' }

    // 构建组合列表：前 5 个知名角色 + 全部 10 个原创角色，两两配对 × 前 3 个名场面 × 30s
    const knownChars = knowledge.known_characters.slice(0, 5)
    const originalChars = seeds.characters.filter((c) => c.kind === 'original').map((c) => toRemixCharacter(c))
    knownCharCount = knownChars.length
    originalCharCount = originalChars.length
    const characters = [...knownChars, ...originalChars]
    const moments = knowledge.iconic_moments.slice(0, 3)
    // 叙事模板轮换选取：不同角色对 × 名场面组合使用不同 story_pattern，增加叙事结构多样性
    const storyPatterns = seeds.story_patterns
    const inputs: ProductionPlanInput[] = []
    for (let i = 0; i < characters.length; i++) {
      for (let j = i + 1; j < characters.length; j++) {
        for (let m = 0; m < moments.length; m++) {
          const moment = moments[m]
          const workA = workById.get(characters[i].work_id)
          const workB = workById.get(characters[j].work_id)
          const momentWork = workById.get(moment.work_id)
          if (!workA || !workB || !momentWork) continue
          const patternIndex = (i + j + m) % storyPatterns.length
          inputs.push({
            characterA: characters[i],
            characterB: characters[j],
            moment,
            duration: 30,
            workA,
            workB,
            momentWork,
            style,
            seed: `pipeline-${report.date}-${i}-${j}-${moment.id}`,
            storyPattern: storyPatterns[patternIndex],
          })
        }
      }
    }

    const productionResult = buildProductionPlans(inputs, matrix)
    productionStats = {
      total: productionResult.stats.total_combinations,
      filtered_out: productionResult.stats.filtered_out,
      remaining: productionResult.stats.remaining,
      threshold: productionResult.stats.threshold,
    }
    process.stderr.write(
      `Production plans: ${productionResult.stats.remaining}/${productionResult.stats.total_combinations} combinations passed C1 filter (threshold ${productionResult.stats.threshold}, ${productionResult.stats.filtered_out} filtered out, ${knownChars.length} known + ${originalChars.length} original characters)\n`,
    )

    // C3: 对生成的制作包做近似度检测，标记重复/高度相似方案，避免连续发布换皮创意
    const detection = detectDuplicates(productionResult.plans)
    similarityStats = {
      total: detection.stats.total,
      duplicates: detection.stats.duplicates,
      unique: detection.stats.unique,
      avg_max_similarity: detection.stats.avg_max_similarity,
      threshold: detection.stats.threshold,
    }
    process.stderr.write(
      `Duplicate detection: ${detection.stats.duplicates}/${detection.stats.total} plans flagged as duplicates (threshold ${detection.stats.threshold}, avg max_similarity ${detection.stats.avg_max_similarity.toFixed(3)})\n`,
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
      review_approved: reviewApproved,
      review_rejected: reviewRejected,
      review_errors: reviewErrors,
      review_skipped: skipReview,
      collect_items: collectStats?.items ?? 0,
      collect_error: collectStats?.error ?? null,
      migrate_discovered: migrateStats?.discovered ?? 0,
      migrate_inserted: migrateStats?.inserted ?? 0,
      migrate_deduplicated: migrateStats?.deduplicated ?? 0,
      migrate_total_trends: migrateStats?.total_trends ?? 0,
      migrate_error: migrateStats?.error ?? null,
      export_count: exportCount,
      export_skipped: exportSkipped,
      production_total: productionStats?.total ?? 0,
      production_filtered_out: productionStats?.filtered_out ?? 0,
      production_remaining: productionStats?.remaining ?? 0,
      production_threshold: productionStats?.threshold ?? 0,
      production_known_chars: knownCharCount,
      production_original_chars: originalCharCount,
      similarity_total: similarityStats?.total ?? 0,
      similarity_duplicates: similarityStats?.duplicates ?? 0,
      similarity_unique: similarityStats?.unique ?? 0,
      similarity_avg_max_similarity: similarityStats?.avg_max_similarity ?? 0,
      similarity_threshold: similarityStats?.threshold ?? 0,
    },
  })
} catch (error) {
  await logger.fail(error)
  throw error
}
