import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { loadDatabaseConfig, parseSqliteUrl } from '../src/config/database.ts'
import { migrateDatabase } from '../src/database/migrate.ts'
import { SqliteCandidateStore } from '../src/storage/sqlite-candidate-store.ts'
import { createTaskRunLogger } from '../src/observability/task-run-logger.ts'
import { reviewCandidates } from '../src/review/auto-reviewer.ts'
import type { AutoReviewConfig } from '../src/review/auto-reviewer.ts'
import type { CandidateStatus } from '../src/storage/candidate-store.ts'

// 用法：npm run review:reactivate <candidateId> [reason...]
// 将 archived 候选重新设为 pending_review，允许 auto-reviewer 重新审核或人工审核。
// 可选 --re-review 标志在 reactivate 后立即执行 auto-review。
// 可选 --all 标志 reactivate 全部 archived 候选（批量）。
const args = process.argv.slice(2)
const reReview = args.includes('--re-review')
const all = args.includes('--all')
const positionalArgs = args.filter((arg) => !arg.startsWith('--'))
const candidateId = positionalArgs[0]
const reasonParts = positionalArgs.slice(1)
const reason = reasonParts.length > 0 ? reasonParts.join(' ') : 'manual reactivate for re-review'

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

const logger = createTaskRunLogger({
  taskName: 'review:reactivate',
  logDirectory: resolve('data/run-logs'),
  metadata: { candidate_id: candidateId ?? null, re_review: reReview, all },
})

if (!candidateId && !all) {
  process.stderr.write('Usage: npm run review:reactivate <candidateId> [reason...]\n')
  process.stderr.write('       npm run review:reactivate --all [--re-review] [reason...]\n')
  process.exit(1)
}

try {
  const dbConfig = loadDatabaseConfig()
  const { database } = await migrateDatabase({
    filePath: parseSqliteUrl(dbConfig.url),
    migrationsDirectory: dbConfig.migrationsDirectory,
  })

  try {
    const store = new SqliteCandidateStore(database)

    let candidateIds: string[] = []

    if (all) {
      // 批量 reactivate 全部 archived 候选
      const archived = await store.list('archived')
      candidateIds = archived.map((c) => c.id)
      if (candidateIds.length === 0) {
        process.stdout.write('No archived candidates to reactivate.\n')
        await logger.succeed({
          processedCount: 0,
          successCount: 0,
          failureCount: 0,
          metadata: { reactivated: 0, re_reviewed: 0 },
        })
        process.exit(0)
      }
    } else {
      candidateIds = [candidateId!]
    }

    // Reactivate: archived → pending_review
    let reactivated = 0
    const errors: string[] = []

    for (const id of candidateIds) {
      try {
        const result = await store.transition(id, 'pending_review', reason)
        reactivated += 1
        if (!all) {
          process.stdout.write(`Reactivated ${id}: ${result.from} → pending_review (reason: ${reason})\n`)
        }
      } catch (error) {
        errors.push(`${id}: ${(error as Error).message}`)
      }
    }

    if (all) {
      process.stdout.write(`Reactivated ${reactivated}/${candidateIds.length} archived candidates.\n`)
    }

    let reReviewed = 0

    // 可选：reactivate 后立即执行 auto-review
    if (reReview && reactivated > 0) {
      const rawConfig = (await readJson('config/pipeline.json')) as PipelineConfig
      const { publish_score, similarity_ceiling, automatic_publish } = rawConfig.limits

      if (!automatic_publish) {
        process.stderr.write(
          '自动审核未启用（config.limits.automatic_publish=false），跳过 re-review。\n' +
            '开启该开关或使用 npm run review:auto --force 手动执行。\n',
        )
      } else {
        const reviewConfig: AutoReviewConfig = { publish_score, similarity_ceiling }
        const pending = await store.list('pending_review')
        const toReview = pending.filter((c) => candidateIds.includes(c.id))

        if (toReview.length === 0) {
          process.stderr.write('No reactivated candidates in pending_review to re-review.\n')
        } else {
          const decisions = reviewCandidates(toReview, reviewConfig)
          let approved = 0
          let rejectedCount = 0

          for (const candidate of toReview) {
            const decision = decisions.get(candidate.id)
            if (!decision) {
              errors.push(`missing decision for candidate ${candidate.id}`)
              continue
            }
            const targetStatus: CandidateStatus = decision.decision === 'approve' ? 'approved' : 'rejected'

            try {
              await store.transition(candidate.id, targetStatus, decision.reason)
              if (decision.decision === 'approve') approved += 1
              else rejectedCount += 1
              reReviewed += 1
            } catch (error) {
              errors.push(`${candidate.id}: ${(error as Error).message}`)
            }
          }

          process.stdout.write(
            `Re-reviewed ${reReviewed} candidates: ${approved} approved, ${rejectedCount} rejected.\n`,
          )
        }
      }
    }

    if (errors.length > 0) {
      await logger.partial({
        processedCount: candidateIds.length,
        successCount: reactivated,
        failureCount: errors.length,
        errors,
        metadata: { reactivated, re_reviewed: reReviewed },
      })
    } else {
      await logger.succeed({
        processedCount: candidateIds.length,
        successCount: reactivated,
        failureCount: 0,
        metadata: { reactivated, re_reviewed: reReviewed },
      })
    }
  } finally {
    database.close()
  }
} catch (error) {
  await logger.fail(error)
  throw error
}
