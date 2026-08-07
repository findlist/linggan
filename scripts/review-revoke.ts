import { resolve } from 'node:path'
import { loadDatabaseConfig, parseSqliteUrl } from '../src/config/database.ts'
import { migrateDatabase } from '../src/database/migrate.ts'
import { SqliteCandidateStore } from '../src/storage/sqlite-candidate-store.ts'
import { createTaskRunLogger } from '../src/observability/task-run-logger.ts'

// 用法：npm run review:revoke <candidateId> [reason...]
// 将 approved/rejected 候选归档（archived），用于撤回自动审核的决策
const candidateId = process.argv[2]
const reasonParts = process.argv.slice(3)
const reason = reasonParts.length > 0 ? reasonParts.join(' ') : 'manual revoke'

const logger = createTaskRunLogger({
  taskName: 'review:revoke',
  logDirectory: resolve('data/run-logs'),
  metadata: { candidate_id: candidateId ?? null },
})

if (!candidateId) {
  process.stderr.write('Usage: npm run review:revoke <candidateId> [reason...]\n')
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
    const candidate = await store.get(candidateId)
    if (!candidate) {
      process.stderr.write(`Candidate not found: ${candidateId}\n`)
      process.exit(1)
    }

    // 状态机只允许 approved/rejected → archived；pending_review 不可直接归档
    const result = await store.transition(candidateId, 'archived', reason)
    process.stdout.write(`Revoked ${candidateId}: ${result.from} → archived (reason: ${reason})\n`)
    await logger.succeed({
      processedCount: 1,
      successCount: 1,
      failureCount: 0,
      metadata: { from_status: result.from, reason },
    })
  } finally {
    database.close()
  }
} catch (error) {
  await logger.fail(error)
  throw error
}
