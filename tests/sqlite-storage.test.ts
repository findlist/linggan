import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { parseSqliteUrl } from '../src/config/database.ts'
import { migrateDatabase } from '../src/database/migrate.ts'
import { seedKnowledgeBase } from '../src/database/seed-knowledge.ts'
import { CollectionItemSchema } from '../src/data/contracts.ts'
import { SqliteTrendStore } from '../src/storage/sqlite-trend-store.ts'

const migrationsDirectory = new URL('../database/migrations', import.meta.url).pathname.replace(
  /^\/(?:[A-Za-z]:)/u,
  (value) => value.slice(1),
)
const collectedAt = '2026-07-29T07:30:00.000+08:00'

const createItem = (name: string, sourceUrl = 'https://example.com/source') =>
  CollectionItemSchema.parse({
    id: `item_${name === '失败热点' ? 'failure' : 'sqlite'}`,
    name,
    aliases: [],
    category: 'meme',
    description: 'SQLite 存储测试热点。',
    source_evidence: [
      {
        url: sourceUrl,
        source_name: 'Example',
        page_title: 'Example source',
        published_at: null,
        collected_at: collectedAt,
      },
    ],
    discovered_at: collectedAt,
    observed_metrics: [{ name: 'rank', value: 1, unit: 'position', observed_at: collectedAt }],
    heat: 88,
    velocity: 0.7,
    lifecycle: 'rising',
    contexts: ['测试'],
    visual_actions: ['定格'],
    risk_level: 'low',
    rights_status: 'reference_only',
    notes: '固定测试数据。',
  })

const withDatabase = async (callback: (input: Awaited<ReturnType<typeof migrateDatabase>>) => Promise<void>) => {
  const directory = await mkdtemp(join(tmpdir(), 'linggan-sqlite-'))
  try {
    const migrated = await migrateDatabase({
      filePath: join(directory, 'test.sqlite'),
      migrationsDirectory,
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

test('SQLite URL parser resolves project-relative files and memory databases', () => {
  assert.equal(parseSqliteUrl(':memory:'), ':memory:')
  assert.equal(parseSqliteUrl('file::memory:'), ':memory:')
  assert.equal(parseSqliteUrl('file:./data/test.sqlite', 'C:\\workspace'), 'C:\\workspace\\data\\test.sqlite')
  assert.throws(() => parseSqliteUrl('postgresql://localhost/linggan'), /must use file:/)
})

test('database migrations initialize all baseline tables and are idempotent', async () => {
  await withDatabase(async ({ database, applied }) => {
    assert.deepEqual(applied, [
      { version: 1, name: 'initial' },
      { version: 2, name: 'candidate_state_machine' },
      { version: 3, name: 'product_events' },
      { version: 4, name: 'ranking_weight_snapshots' },
    ])
    const tables = (
      database
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
        .all() as Array<{ name: string }>
    ).map((row) => row.name)
    for (const name of [
      'schema_migrations',
      'works',
      'known_characters',
      'character_relationships',
      'iconic_moments',
      'trends',
      'trend_sources',
      'trend_metrics',
      'trend_batches',
      'collection_runs',
      'collection_items',
      'candidates',
      'product_events',
      'ranking_weight_snapshots',
    ])
      assert.equal(tables.includes(name), true, `missing table ${name}`)
  })
})

test('knowledge seed populates SQLite and can be repeated without duplicates', async () => {
  await withDatabase(async ({ database }) => {
    const knowledge = JSON.parse(
      await (
        await import('node:fs/promises')
      ).readFile(new URL('../data/knowledge-base.json', import.meta.url), 'utf8'),
    ) as unknown
    const first = seedKnowledgeBase(database, knowledge)
    const second = seedKnowledgeBase(database, knowledge)
    assert.deepEqual(first, { works: 39, known_characters: 109, relationships: 67, iconic_moments: 70 })
    assert.deepEqual(second, first)
    assert.equal((database.prepare('SELECT COUNT(*) AS count FROM works').get() as { count: number }).count, 39)
    assert.equal(
      (database.prepare('SELECT COUNT(*) AS count FROM known_characters').get() as { count: number }).count,
      109,
    )
  })
})

test('SQLite trend store merges duplicates and repeated writes are idempotent', async () => {
  await withDatabase(async ({ database }) => {
    const store = new SqliteTrendStore(database)
    const item = createItem('SQLite 热点')
    const first = await store.upsert([{ item, batchId: 'run_first' }])
    const secondItem = createItem('SQLite热点', 'https://example.org/second')
    const second = await store.upsert([{ item: secondItem, batchId: 'run_second' }])
    const third = await store.upsert([{ item: secondItem, batchId: 'run_second' }])
    const trends = await store.list()

    assert.deepEqual(first, { inserted: 1, updated: 0, deduplicated: 0, total: 1 })
    assert.equal(second.deduplicated, 1)
    assert.equal(third.total, 1)
    assert.equal(trends.length, 1)
    assert.equal(trends[0].source_evidence.length, 2)
    assert.deepEqual(trends[0].source_batch_ids, ['run_first', 'run_second'])
    assert.equal((database.prepare('SELECT COUNT(*) AS count FROM trends').get() as { count: number }).count, 1)
  })
})

test('SQLite upsert transaction rolls back the whole batch on failure', async () => {
  await withDatabase(async ({ database }) => {
    database.exec(`
      CREATE TRIGGER reject_failure_trend
      BEFORE INSERT ON trends
      WHEN NEW.name = '失败热点'
      BEGIN
        SELECT RAISE(ABORT, 'forced test failure');
      END;
    `)
    const store = new SqliteTrendStore(database)
    await assert.rejects(
      store.upsert([
        { item: createItem('正常热点'), batchId: 'run_transaction' },
        { item: createItem('失败热点'), batchId: 'run_transaction' },
      ]),
      /forced test failure/,
    )
    assert.equal((database.prepare('SELECT COUNT(*) AS count FROM trends').get() as { count: number }).count, 0)
  })
})
