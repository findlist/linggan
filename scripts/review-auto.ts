import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { loadDatabaseConfig, parseSqliteUrl } from '../src/config/database.ts'
import { migrateDatabase } from '../src/database/migrate.ts'
import { SqliteCandidateStore } from '../src/storage/sqlite-candidate-store.ts'
import type { CandidateStatus } from '../src/storage/candidate-store.ts'
import { createTaskRunLogger } from '../src/observability/task-run-logger.ts'
import { reviewCandidates } from '../src/review/auto-reviewer.ts'
import type { AutoReviewConfig } from '../src/review/auto-reviewer.ts'

// pipeline.json 的结构子集，只取自动审核需要的字段
interface PipelineLimits {
  publish_score: number
  similarity_ceiling: number
  automatic_publish: boolean
}
interface PipelineConfig {
  limits: PipelineLimits
}

const root = new URL('../', import.meta.url)
const readJson = async (path: string): Promise<unknown> =>
  JSON.parse(await readFile(new URL(path, root), 'utf8')) as unknown

// 命令行参数解析
const dryRun = process.argv.includes('--dry-run')
const force = process.argv.includes('--force')
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='))
const limit = limitArg ? Number.parseInt(limitArg.split('=')[1] ?? '', 10) : undefined

const logger = createTaskRunLogger({
  taskName: 'review:auto',
  logDirectory: resolve('data/run-logs'),
  metadata: { dry_run: dryRun, force, limit: limit ?? null },
})

try {
  const rawConfig = (await readJson('config/pipeline.json')) as PipelineConfig
  const { publish_score, similarity_ceiling, automatic_publish } = rawConfig.limits

  // 全局熔断：automatic_publish 关闭且未显式 --force 时拒绝执行
  if (!automatic_publish && !force) {
    process.stderr.write(
      '自动审核未启用（config.limits.automatic_publish=false）。\n' + '开启该开关或使用 --force 跳过此检查后重试。\n',
    )
    process.exit(1)
  }

  const reviewConfig: AutoReviewConfig = { publish_score, similarity_ceiling }

  const dbConfig = loadDatabaseConfig()
  const { database } = await migrateDatabase({
    filePath: parseSqliteUrl(dbConfig.url),
    migrationsDirectory: dbConfig.migrationsDirectory,
  })

  try {
    const store = new SqliteCandidateStore(database)
    // 只处理 pending_review 候选，已审核的不会重复处理（幂等）
    const pending = await store.list('pending_review')
    const toReview = limit && limit > 0 ? pending.slice(0, limit) : pending

    if (toReview.length === 0) {
      process.stdout.write('No pending_review candidates to review.\n')
      await logger.succeed({
        processedCount: 0,
        successCount: 0,
        failureCount: 0,
        metadata: { approved: 0, rejected: 0, dry_run: dryRun },
      })
      process.exit(0)
    }

    const decisions = reviewCandidates(toReview, reviewConfig)

    let approved = 0
    let rejected = 0
    const errors: string[] = []

    for (const candidate of toReview) {
      const decision = decisions.get(candidate.id)
      if (!decision) {
        errors.push(`missing decision for candidate ${candidate.id}`)
        continue
      }
      const targetStatus: CandidateStatus = decision.decision === 'approve' ? 'approved' : 'rejected'

      if (dryRun) {
        // 预览模式：只输出决策，不写入数据库
        if (decision.decision === 'approve') approved += 1
        else rejected += 1
        process.stdout.write(`[DRY RUN] ${candidate.id} → ${targetStatus} (${decision.cause ?? 'pass'})\n`)
        continue
      }

      try {
        await store.transition(candidate.id, targetStatus, decision.reason)
        if (decision.decision === 'approve') approved += 1
        else rejected += 1
      } catch (error) {
        // 单条失败不阻塞其他候选，记录错误继续
        errors.push(`${candidate.id}: ${(error as Error).message}`)
      }
    }

    const prefix = dryRun ? '[DRY RUN] ' : ''
    process.stdout.write(
      `${prefix}Reviewed ${toReview.length} candidates: ${approved} approved, ${rejected} rejected` +
        (errors.length > 0 ? `, ${errors.length} errors` : '') +
        '.\n',
    )

    // 存在错误时记为 partial，否则 success
    if (errors.length > 0) {
      await logger.partial({
        processedCount: toReview.length,
        successCount: approved + rejected,
        failureCount: errors.length,
        errors,
        metadata: { approved, rejected, dry_run: dryRun },
      })
    } else {
      await logger.succeed({
        processedCount: toReview.length,
        successCount: toReview.length,
        failureCount: 0,
        metadata: { approved, rejected, dry_run: dryRun },
      })
    }
  } finally {
    database.close()
  }
} catch (error) {
  await logger.fail(error)
  throw error
}
