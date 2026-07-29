import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { CandidateSchema } from '../src/data/contracts.ts'
import type { Candidate } from '../src/data/contracts.ts'
import {
  IllegalTransitionError,
  CandidateNotFoundError,
  isLegalTransition,
  LEGAL_TRANSITIONS,
  generateIdempotencyKey
} from '../src/storage/candidate-store.ts'
import type { CandidateStatus } from '../src/storage/candidate-store.ts'
import { SqliteCandidateStore } from '../src/storage/sqlite-candidate-store.ts'
import { parseSqliteUrl } from '../src/config/database.ts'
import { migrateDatabase } from '../src/database/migrate.ts'

const migrationsDirectory = new URL('../database/migrations', import.meta.url).pathname
  .replace(/^\/(?:[A-Za-z]:)/u, value => value.slice(1))

const withDatabase = async (
  callback: (store: SqliteCandidateStore) => Promise<void>
) => {
  const directory = await mkdtemp(join(tmpdir(), 'linggan-a5-'))
  try {
    const migrated = await migrateDatabase({
      filePath: join(directory, 'test.sqlite'),
      migrationsDirectory
    })
    try {
      const store = new SqliteCandidateStore(migrated.database)
      await callback(store)
    } finally {
      migrated.database.close()
    }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

const baseCandidate: Candidate = CandidateSchema.parse({
  id: 'candidate_test_1_1',
  title: '测试候选方案',
  source_trend: 'trend_abc123',
  entities: ['char_archetype_01', 'scene_confrontation_01', 'elem_viral_challenge'],
  hook: '所有人以为这只是挑战，直到认真起来。',
  score: {
    total: 75,
    metrics: {
      heat: 80,
      velocity: 70,
      contrast: 75,
      visuality: 85,
      generatability: 70,
      seriality: 65,
      novelty: 78
    }
  },
  risk_level: 'low',
  rights_status: 'original',
  status: 'pending_review',
  generated_at: '2026-07-29T08:30:00.000+08:00'
})

const createCandidate = (id: string, sourceTrend = 'trend_abc123'): Candidate => ({
  ...baseCandidate,
  id,
  source_trend: sourceTrend
})

// === State Machine Tests ===

test('isLegalTransition allows pending_review → approved', () => {
  assert.equal(isLegalTransition('pending_review', 'approved'), true)
})

test('isLegalTransition allows pending_review → rejected', () => {
  assert.equal(isLegalTransition('pending_review', 'rejected'), true)
})

test('isLegalTransition allows approved → archived', () => {
  assert.equal(isLegalTransition('approved', 'archived'), true)
})

test('isLegalTransition allows rejected → archived', () => {
  assert.equal(isLegalTransition('rejected', 'archived'), true)
})

test('isLegalTransition allows pending_review → archived', () => {
  assert.equal(isLegalTransition('pending_review', 'archived'), true)
})

test('isLegalTransition rejects approved → pending_review', () => {
  assert.equal(isLegalTransition('approved', 'pending_review'), false)
})

test('isLegalTransition rejects rejected → approved', () => {
  assert.equal(isLegalTransition('rejected', 'approved'), false)
})

test('isLegalTransition rejects archived → anything', () => {
  const statuses: CandidateStatus[] = ['pending_review', 'approved', 'rejected', 'archived']
  for (const to of statuses) {
    assert.equal(isLegalTransition('archived', to), false)
  }
})

test('LEGAL_TRANSITIONS has no self-transitions', () => {
  const statuses: CandidateStatus[] = ['pending_review', 'approved', 'rejected', 'archived']
  for (const status of statuses) {
    assert.equal(isLegalTransition(status, status), false, `${status} should not transition to itself`)
  }
})

// === Insert & Idempotency Tests ===

test('insert persists candidates to SQLite', async () => {
  await withDatabase(async (store) => {
    const candidates = [createCandidate('c1'), createCandidate('c2', 'trend_def')]
    const result = await store.insert(candidates, 'run_001')
    assert.equal(result.inserted, 2)
    assert.equal(result.skipped, 0)
    assert.equal(result.total, 2)
  })
})

test('insert skips duplicates with same idempotency key', async () => {
  await withDatabase(async (store) => {
    const candidates = [createCandidate('c1')]
    const result1 = await store.insert(candidates, 'run_001')
    assert.equal(result1.inserted, 1)
    assert.equal(result1.skipped, 0)

    // Same prefix + same candidate content = same idempotency key → skipped
    const result2 = await store.insert(candidates, 'run_001')
    assert.equal(result2.inserted, 0)
    assert.equal(result2.skipped, 1)
    assert.equal(result2.total, 1)
  })
})

test('insert allows same candidate with different idempotency prefix (skips by ID)', async () => {
  await withDatabase(async (store) => {
    const candidates = [createCandidate('c1')]
    const result1 = await store.insert(candidates, 'run_001')
    assert.equal(result1.inserted, 1)

    // Different prefix → different idempotency key → but same candidate ID
    // Should skip by ID check rather than throw
    const result2 = await store.insert(candidates, 'run_002')
    assert.equal(result2.inserted, 0)
    assert.equal(result2.skipped, 1)
    assert.equal(result2.total, 1)
  })
})

test('insert with empty candidates array returns zeros', async () => {
  await withDatabase(async (store) => {
    const result = await store.insert([], 'run_001')
    assert.equal(result.inserted, 0)
    assert.equal(result.skipped, 0)
    assert.equal(result.total, 0)
  })
})

// === List & Get Tests ===

test('list returns all candidates ordered by generated_at DESC', async () => {
  await withDatabase(async (store) => {
    const early = { ...createCandidate('c1'), generated_at: '2026-07-29T08:00:00.000+08:00' }
    const late = { ...createCandidate('c2', 'trend_def'), generated_at: '2026-07-29T12:00:00.000+08:00' }
    await store.insert([early, late], 'run_001')

    const all = await store.list()
    assert.equal(all.length, 2)
    // Later candidate should be first (DESC)
    assert.equal(all[0].id, 'c2')
    assert.equal(all[1].id, 'c1')
  })
})

test('list filters by status', async () => {
  await withDatabase(async (store) => {
    await store.insert([createCandidate('c1'), createCandidate('c2', 'trend_def')], 'run_001')
    await store.transition('c1', 'approved', 'good quality')

    const pending = await store.list('pending_review')
    assert.equal(pending.length, 1)
    assert.equal(pending[0].id, 'c2')

    const approved = await store.list('approved')
    assert.equal(approved.length, 1)
    assert.equal(approved[0].id, 'c1')
  })
})

test('get returns candidate by id', async () => {
  await withDatabase(async (store) => {
    await store.insert([createCandidate('c1')], 'run_001')
    const candidate = await store.get('c1')
    assert.ok(candidate)
    assert.equal(candidate!.id, 'c1')
    assert.equal(candidate!.status, 'pending_review')
  })
})

test('get returns null for non-existent id', async () => {
  await withDatabase(async (store) => {
    const candidate = await store.get('nonexistent')
    assert.equal(candidate, null)
  })
})

// === Transition Tests ===

test('transition pending_review → approved succeeds', async () => {
  await withDatabase(async (store) => {
    await store.insert([createCandidate('c1')], 'run_001')
    const result = await store.transition('c1', 'approved', 'high score')
    assert.equal(result.from, 'pending_review')
    assert.equal(result.to, 'approved')
    assert.ok(result.reviewed_at)

    const candidate = await store.get('c1')
    assert.equal(candidate!.status, 'approved')
  })
})

test('transition pending_review → rejected succeeds', async () => {
  await withDatabase(async (store) => {
    await store.insert([createCandidate('c1')], 'run_001')
    const result = await store.transition('c1', 'rejected', 'low quality')
    assert.equal(result.from, 'pending_review')
    assert.equal(result.to, 'rejected')
  })
})

test('transition approved → archived succeeds', async () => {
  await withDatabase(async (store) => {
    await store.insert([createCandidate('c1')], 'run_001')
    await store.transition('c1', 'approved')
    const result = await store.transition('c1', 'archived', 'published')
    assert.equal(result.from, 'approved')
    assert.equal(result.to, 'archived')
  })
})

test('transition rejected → archived succeeds', async () => {
  await withDatabase(async (store) => {
    await store.insert([createCandidate('c1')], 'run_001')
    await store.transition('c1', 'rejected')
    const result = await store.transition('c1', 'archived', 'expired')
    assert.equal(result.from, 'rejected')
    assert.equal(result.to, 'archived')
  })
})

test('transition approved → rejected throws IllegalTransitionError', async () => {
  await withDatabase(async (store) => {
    await store.insert([createCandidate('c1')], 'run_001')
    await store.transition('c1', 'approved')
    await assert.rejects(
      store.transition('c1', 'rejected'),
      IllegalTransitionError
    )
  })
})

test('transition archived → approved throws IllegalTransitionError', async () => {
  await withDatabase(async (store) => {
    await store.insert([createCandidate('c1')], 'run_001')
    await store.transition('c1', 'approved')
    await store.transition('c1', 'archived')
    await assert.rejects(
      store.transition('c1', 'approved'),
      IllegalTransitionError
    )
  })
})

test('transition on non-existent candidate throws CandidateNotFoundError', async () => {
  await withDatabase(async (store) => {
    await assert.rejects(
      store.transition('nonexistent', 'approved'),
      CandidateNotFoundError
    )
  })
})

// === Count Tests ===

test('countByStatus returns correct counts', async () => {
  await withDatabase(async (store) => {
    await store.insert([
      createCandidate('c1'),
      createCandidate('c2', 'trend_def'),
      createCandidate('c3', 'trend_ghi')
    ], 'run_001')

    await store.transition('c1', 'approved')
    await store.transition('c2', 'rejected')

    const counts = await store.countByStatus()
    assert.equal(counts.pending_review, 1)
    assert.equal(counts.approved, 1)
    assert.equal(counts.rejected, 1)
    assert.equal(counts.archived, 0)
  })
})

test('countByStatus returns all zeros for empty store', async () => {
  await withDatabase(async (store) => {
    const counts = await store.countByStatus()
    assert.equal(counts.pending_review, 0)
    assert.equal(counts.approved, 0)
    assert.equal(counts.rejected, 0)
    assert.equal(counts.archived, 0)
  })
})

// === Idempotency Key Generation Test ===

test('generateIdempotencyKey is deterministic for same input', () => {
  const key1 = generateIdempotencyKey('run_001', baseCandidate)
  const key2 = generateIdempotencyKey('run_001', baseCandidate)
  assert.equal(key1, key2)
})

test('generateIdempotencyKey differs for different prefix', () => {
  const key1 = generateIdempotencyKey('run_001', baseCandidate)
  const key2 = generateIdempotencyKey('run_002', baseCandidate)
  assert.notEqual(key1, key2)
})

// === Full Pipeline Persistence Test ===

test('full pipeline: generate → persist → list → transition', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'linggan-a5-full-'))
  try {
    const migrated = await migrateDatabase({
      filePath: join(directory, 'test.sqlite'),
      migrationsDirectory
    })
    try {
      // Generate candidates using the real pipeline
      const { SeedEntitiesSchema } = await import('../src/data/contracts.ts')
      const { generateDailyCandidates } = await import('../src/generation/candidate-generator.ts')
      const { storedTrendsToTrends } = await import('../src/generation/trend-adapter.ts')
      const { SqliteTrendStore } = await import('../src/storage/sqlite-trend-store.ts')
      const { seedKnowledgeBase } = await import('../src/database/seed-knowledge.ts')
      const { CollectionItemSchema } = await import('../src/data/contracts.ts')

      const knowledge = JSON.parse(
        await readFile(new URL('../data/knowledge-base.json', import.meta.url), 'utf8')
      ) as unknown
      seedKnowledgeBase(migrated.database, knowledge)

      const store = new SqliteTrendStore(migrated.database)
      const item = CollectionItemSchema.parse({
        id: 'item_a5_test',
        name: 'A5持久化测试热点',
        aliases: [],
        category: 'meme',
        description: 'A5 full pipeline test.',
        source_evidence: [{
          url: 'https://example.com/a5',
          source_name: 'Example',
          page_title: 'A5 test',
          published_at: null,
          collected_at: '2026-07-29T07:30:00.000+08:00'
        }],
        discovered_at: '2026-07-29T07:30:00.000+08:00',
        observed_metrics: [
          { name: 'rank', value: 3, unit: 'position', observed_at: '2026-07-29T07:30:00.000+08:00' }
        ],
        heat: 90,
        velocity: 0.8,
        lifecycle: 'peak',
        contexts: ['测试'],
        visual_actions: ['定格'],
        risk_level: 'low',
        rights_status: 'reference_only',
        notes: 'A5 test.'
      })
      await store.upsert([{ item, batchId: 'run_a5_test' }])

      const storedTrends = await store.list()
      const trends = storedTrendsToTrends(storedTrends)

      const rawSeeds = JSON.parse(
        await readFile(new URL('../data/seed-entities.json', import.meta.url), 'utf8')
      ) as unknown
      const rawConfig = JSON.parse(
        await readFile(new URL('../config/pipeline.json', import.meta.url), 'utf8')
      ) as unknown

      const report = generateDailyCandidates({
        config: rawConfig as never,
        seeds: SeedEntitiesSchema.parse(rawSeeds),
        trends,
        clock: () => new Date('2026-07-29T08:30:00.000Z')
      })

      assert.ok(report.candidates.length > 0, 'should generate candidates')

      // Persist to candidate store
      const candidateStore = new SqliteCandidateStore(migrated.database)
      const insertResult = await candidateStore.insert(report.candidates, `pipeline_${report.date}`)
      assert.equal(insertResult.inserted, report.candidates.length)
      assert.equal(insertResult.skipped, 0)

      // List and verify
      const persisted = await candidateStore.list()
      assert.equal(persisted.length, report.candidates.length)
      assert.equal(persisted[0].status, 'pending_review')

      // Transition one to approved
      const firstId = persisted[0].id
      const transitionResult = await candidateStore.transition(firstId, 'approved', 'test approval')
      assert.equal(transitionResult.from, 'pending_review')
      assert.equal(transitionResult.to, 'approved')

      // Re-inserting with same prefix should skip all
      const reInsert = await candidateStore.insert(report.candidates, `pipeline_${report.date}`)
      assert.equal(reInsert.inserted, 0)
      assert.equal(reInsert.skipped, report.candidates.length)

      // Counts should be correct
      const counts = await candidateStore.countByStatus()
      assert.equal(counts.approved, 1)
      assert.equal(counts.pending_review, report.candidates.length - 1)
    } finally {
      migrated.database.close()
    }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
