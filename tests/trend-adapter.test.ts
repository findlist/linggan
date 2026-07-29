import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { StoredTrendSchema } from '../src/data/contracts.ts'
import type { StoredTrend } from '../src/data/contracts.ts'
import { storedTrendToTrend, storedTrendsToTrends } from '../src/generation/trend-adapter.ts'
import { parseSqliteUrl } from '../src/config/database.ts'
import { migrateDatabase } from '../src/database/migrate.ts'
import { seedKnowledgeBase } from '../src/database/seed-knowledge.ts'
import { CollectionItemSchema } from '../src/data/contracts.ts'
import { SqliteTrendStore } from '../src/storage/sqlite-trend-store.ts'

const migrationsDirectory = new URL('../database/migrations', import.meta.url).pathname
  .replace(/^\/(?:[A-Za-z]:)/u, value => value.slice(1))

const baseStoredTrend: StoredTrend = StoredTrendSchema.parse({
  id: 'trend_abc123',
  fingerprint: 'a'.repeat(64),
  name: '测试热点',
  aliases: ['测试梗'],
  category: 'meme',
  description: '适配器测试用存储趋势。',
  source_evidence: [{
    url: 'https://example.com/trend',
    source_name: 'Example',
    page_title: 'Example trend page',
    published_at: null,
    collected_at: '2026-07-29T07:30:00.000+08:00'
  }],
  observed_metrics: [
    { name: 'rank', value: 5, unit: 'position', observed_at: '2026-07-29T07:30:00.000+08:00' },
    { name: 'engagement', value: 4200, unit: 'count', observed_at: '2026-07-29T07:30:00.000+08:00' }
  ],
  heat: 85,
  velocity: 0.72,
  lifecycle: 'rising',
  contexts: ['短视频'],
  visual_actions: ['定格'],
  risk_level: 'low',
  rights_status: 'reference_only',
  first_seen_at: '2026-07-29T07:30:00.000+08:00',
  last_seen_at: '2026-07-29T13:30:00.000+08:00',
  source_batch_ids: ['run_test_001']
})

test('storedTrendToTrend maps all required fields correctly', () => {
  const trend = storedTrendToTrend(baseStoredTrend)

  assert.equal(trend.external_id, baseStoredTrend.id)
  assert.equal(trend.title, baseStoredTrend.name)
  assert.equal(trend.source, 'Example')
  assert.equal(trend.source_url, 'https://example.com/trend')
  assert.equal(trend.observed_at, baseStoredTrend.last_seen_at)
  assert.equal(trend.signals.rank, 5)
  assert.equal(trend.signals.engagement, 4200)
  assert.equal(trend.signals.velocity, 0.72)
  assert.deepEqual(trend.aliases, baseStoredTrend.aliases)
  assert.equal(trend.lifecycle, baseStoredTrend.lifecycle)
  assert.equal(trend.rights_status, baseStoredTrend.rights_status)
  assert.equal(trend.risk_level, baseStoredTrend.risk_level)
})

test('storedTrendToTrend derives signals from heat when metrics are absent', () => {
  const minimal: StoredTrend = {
    ...baseStoredTrend,
    id: 'trend_minimal',
    fingerprint: 'b'.repeat(64),
    observed_metrics: [],
    heat: null,
    velocity: null
  }

  const trend = storedTrendToTrend(minimal)

  assert.equal(trend.signals.rank, null)
  assert.equal(trend.signals.engagement, null)
  assert.equal(trend.signals.velocity, null)
})

test('storedTrendsToTrends converts a list of stored trends', () => {
  const second: StoredTrend = {
    ...baseStoredTrend,
    id: 'trend_second',
    fingerprint: 'c'.repeat(64),
    name: '第二个热点'
  }

  const trends = storedTrendsToTrends([baseStoredTrend, second])
  assert.equal(trends.length, 2)
  assert.equal(trends[0].title, '测试热点')
  assert.equal(trends[1].title, '第二个热点')
})

test('reference_only status propagates through adapter', () => {
  const trend = storedTrendToTrend(baseStoredTrend)
  assert.equal(trend.rights_status, 'reference_only')
  assert.equal(trend.risk_level, baseStoredTrend.risk_level)
})

const withDatabase = async (
  callback: (input: Awaited<ReturnType<typeof migrateDatabase>>) => Promise<void>
) => {
  const directory = await mkdtemp(join(tmpdir(), 'linggan-a1-'))
  try {
    const migrated = await migrateDatabase({
      filePath: join(directory, 'test.sqlite'),
      migrationsDirectory
    })
    try {
      await callback(migrated)
    } finally {
      migrated.database.close()
    }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

const collectedAt = '2026-07-29T07:30:00.000+08:00'

const createItem = (name: string, idSlug: string) =>
  CollectionItemSchema.parse({
    id: `item_${idSlug}`,
    name,
    aliases: [],
    category: 'meme',
    description: 'A1 pipeline test item.',
    source_evidence: [{
      url: `https://example.com/${encodeURIComponent(name)}`,
      source_name: 'Example',
      page_title: `Source for ${name}`,
      published_at: null,
      collected_at: collectedAt
    }],
    discovered_at: collectedAt,
    observed_metrics: [
      { name: 'rank', value: 3, unit: 'position', observed_at: collectedAt },
      { name: 'engagement', value: 5000, unit: 'count', observed_at: collectedAt }
    ],
    heat: 90,
    velocity: 0.8,
    lifecycle: 'peak',
    contexts: ['测试'],
    visual_actions: ['定格'],
    risk_level: 'low',
    rights_status: 'reference_only',
    notes: 'A1 pipeline test.'
  })

test('pipeline reads trends from SQLite with real stored trends', async () => {
  await withDatabase(async ({ database }) => {
    const knowledge = JSON.parse(
      await readFile(new URL('../data/knowledge-base.json', import.meta.url), 'utf8')
    ) as unknown
    seedKnowledgeBase(database, knowledge)

    const store = new SqliteTrendStore(database)
    const item = createItem('SQLite 正式趋势', 'sqlite_formal')
    await store.upsert([{ item, batchId: 'run_a1_test' }])

    const storedTrends = await store.list()
    assert.equal(storedTrends.length, 1)

    const trends = storedTrendsToTrends(storedTrends)
    assert.equal(trends.length, 1)
    assert.equal(trends[0].title, 'SQLite 正式趋势')
    assert.equal(trends[0].signals.engagement, 5000)
    assert.equal(trends[0].signals.rank, 3)
    assert.equal(trends[0].rights_status, 'reference_only')
  })
})

test('pipeline returns empty trends from empty SQLite database', async () => {
  await withDatabase(async ({ database }) => {
    const store = new SqliteTrendStore(database)
    const storedTrends = await store.list()
    assert.equal(storedTrends.length, 0)

    const trends = storedTrendsToTrends(storedTrends)
    assert.deepEqual(trends, [])
  })
})

test('pipeline handles corrupted SQLite data gracefully', async () => {
  await withDatabase(async ({ database }) => {
    // Insert a trend with invalid payload to simulate corruption
    database.prepare(
      'INSERT INTO trends (id, fingerprint, name, category, heat, velocity, lifecycle, rights_status, risk_level, first_seen_at, last_seen_at, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      'trend_corrupt',
      'd'.repeat(64),
      'corrupt',
      'meme',
      null,
      null,
      'rising',
      'reference_only',
      'low',
      '2026-07-29T07:30:00.000+08:00',
      '2026-07-29T07:30:00.000+08:00',
      '{invalid json'
    )

    const store = new SqliteTrendStore(database)
    await assert.rejects(store.list(), /JSON/)
  })
})

test('full pipeline: SQLite trends → adapter → candidate generation', async () => {
  await withDatabase(async ({ database }) => {
    const knowledge = JSON.parse(
      await readFile(new URL('../data/knowledge-base.json', import.meta.url), 'utf8')
    ) as unknown
    seedKnowledgeBase(database, knowledge)

    const store = new SqliteTrendStore(database)
    const item = createItem('完整闭环测试', 'full_loop_test')
    await store.upsert([{ item, batchId: 'run_full_test' }])

    const storedTrends = await store.list()
    const trends = storedTrendsToTrends(storedTrends)

    // Import generation dependencies inline
    const { SeedEntitiesSchema } = await import('../src/data/contracts.ts')
    const { generateDailyCandidates } = await import('../src/generation/candidate-generator.ts')
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

    assert.equal(report.summary.trends, 1)
    assert.ok(report.summary.candidates > 0, 'should generate candidates from SQLite trends')
    assert.equal(
      report.candidates.every(candidate => candidate.rights_status === 'original'),
      true,
      'candidates should inherit rights_status from seed characters (original)'
    )
  })
})
