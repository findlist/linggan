import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { test } from 'node:test'
import { CollectionBatchSchema, KnowledgeBaseSchema, TrendStoreDocumentSchema } from '../src/data/contracts.ts'
import { migrateCollectionInbox } from '../src/ingestion/migrate-collection-inbox.ts'
import { JsonDocumentStore } from '../src/storage/json-document-store.ts'
import { JsonTrendStore } from '../src/storage/trend-store.ts'

const collectedAt = '2026-07-29T07:30:00.000+08:00'

const createItem = (overrides: Record<string, unknown> = {}) => ({
  id: 'item_example_trend',
  name: '示例热梗',
  aliases: ['示例梗'],
  category: 'meme',
  description: '用于验证迁移管线的公开热点样本。',
  source_evidence: [
    {
      url: 'https://example.com/trends/1',
      source_name: 'Example',
      page_title: 'Example trend',
      published_at: null,
      collected_at: collectedAt,
    },
  ],
  discovered_at: collectedAt,
  observed_metrics: [{ name: 'rank', value: 1, unit: 'position', observed_at: collectedAt }],
  heat: 80,
  velocity: 0.6,
  lifecycle: 'rising',
  contexts: ['反差短视频'],
  visual_actions: ['突然定格'],
  risk_level: 'low',
  rights_status: 'reference_only',
  notes: '测试样本，不代表真实热点。',
  ...overrides,
})

const createBatch = (id: string, items = [createItem()]) => ({
  schema_version: 1,
  run: {
    id,
    started_at: collectedAt,
    finished_at: '2026-07-29T07:31:00.000+08:00',
    timezone: 'Asia/Shanghai',
    lookback_hours: 24,
    status: 'success',
    source_count: 1,
    item_count: items.length,
    deduplicated_count: 0,
    errors: [],
  },
  items,
})

const withTemporaryDirectory = async (callback: (directory: string) => Promise<void>) => {
  const directory = await mkdtemp(join(tmpdir(), 'linggan-ingestion-'))
  try {
    await callback(directory)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

test('knowledge base is valid and all known characters are reference only', async () => {
  const raw = JSON.parse(await readFile(new URL('../data/knowledge-base.json', import.meta.url), 'utf8')) as unknown
  const knowledge = KnowledgeBaseSchema.parse(raw)
  assert.equal(knowledge.works.length, 15)
  assert.equal(knowledge.known_characters.length, 37)
  assert.equal(knowledge.iconic_moments.length, 22)
  assert.equal(
    knowledge.known_characters.every((character) => character.rights_status === 'reference_only'),
    true,
  )
  assert.equal(
    knowledge.known_characters.every((character) => character.character_types.length > 0),
    true,
  )
  assert.equal(
    knowledge.iconic_moments.every((moment) => moment.dialogue_patterns.length >= 2),
    true,
  )
})

test('collection batch rejects invalid source URLs', () => {
  const batch = createBatch('run_invalid_url', [
    createItem({
      source_evidence: [
        {
          url: 'file:///private/source',
          source_name: 'Invalid',
          page_title: 'Invalid',
          published_at: null,
          collected_at: collectedAt,
        },
      ],
    }),
  ])
  assert.equal(CollectionBatchSchema.safeParse(batch).success, false)
})

test('collection batch rejects duplicate item ids', () => {
  const item = createItem()
  assert.equal(CollectionBatchSchema.safeParse(createBatch('run_duplicate', [item, item])).success, false)
})

test('migration skips a bad batch while importing valid batches', async () => {
  await withTemporaryDirectory(async (directory) => {
    const inbox = join(directory, 'inbox')
    const storePath = join(directory, 'trends.json')
    await mkdir(inbox)
    await writeFile(join(inbox, 'valid.json'), JSON.stringify(createBatch('run_valid')))
    await writeFile(join(inbox, 'invalid.json'), '{broken json')

    const report = await migrateCollectionInbox({ inboxDirectory: inbox, store: new JsonTrendStore(storePath) })
    assert.equal(report.files_discovered, 2)
    assert.equal(report.files_processed, 1)
    assert.equal(report.files_failed, 1)
    assert.equal(report.inserted, 1)
    assert.equal(report.total_trends, 1)
    assert.match(report.failures[0].file, /invalid\.json$/)
  })
})

test('cross-batch duplicates merge evidence into one stored trend', async () => {
  await withTemporaryDirectory(async (directory) => {
    const inbox = join(directory, 'inbox')
    const storePath = join(directory, 'trends.json')
    await mkdir(inbox)
    await writeFile(join(inbox, 'first.json'), JSON.stringify(createBatch('run_first')))
    const secondItem = createItem({
      id: 'item_example_trend_second',
      aliases: ['示例梗', '第二别名'],
      source_evidence: [
        {
          url: 'https://example.org/another-source',
          source_name: 'Example Two',
          page_title: 'Another source',
          published_at: null,
          collected_at: '2026-07-29T13:30:00.000+08:00',
        },
      ],
      discovered_at: '2026-07-29T13:30:00.000+08:00',
      rights_status: 'original',
      risk_level: 'high',
    })
    await writeFile(join(inbox, 'second.json'), JSON.stringify(createBatch('run_second', [secondItem])))

    const report = await migrateCollectionInbox({ inboxDirectory: inbox, store: new JsonTrendStore(storePath) })
    const document = TrendStoreDocumentSchema.parse(JSON.parse(await readFile(storePath, 'utf8')))
    assert.equal(report.inserted, 1)
    assert.equal(report.deduplicated, 1)
    assert.equal(document.trends.length, 1)
    assert.equal(document.trends[0].source_evidence.length, 2)
    assert.deepEqual(document.trends[0].source_batch_ids, ['run_first', 'run_second'])
    assert.equal(document.trends[0].rights_status, 'reference_only')
    assert.equal(document.trends[0].risk_level, 'high')
  })
})

test('repeating migration is idempotent', async () => {
  await withTemporaryDirectory(async (directory) => {
    const inbox = join(directory, 'inbox')
    const storePath = join(directory, 'trends.json')
    await mkdir(inbox)
    await writeFile(join(inbox, 'batch.json'), JSON.stringify(createBatch('run_idempotent')))
    const store = new JsonTrendStore(storePath)

    await migrateCollectionInbox({ inboxDirectory: inbox, store })
    const first = await readFile(storePath, 'utf8')
    await migrateCollectionInbox({ inboxDirectory: inbox, store })
    const second = await readFile(storePath, 'utf8')
    assert.equal(second, first)
  })
})

test('invalid document write preserves the previous JSON file', async () => {
  await withTemporaryDirectory(async (directory) => {
    const storePath = join(directory, 'trends.json')
    const original = '{"schema_version":1,"trends":[]}\n'
    await writeFile(storePath, original)
    const store = new JsonDocumentStore(storePath, TrendStoreDocumentSchema, () => ({
      schema_version: 1 as const,
      trends: [],
    }))

    await assert.rejects(store.write({ schema_version: 1, trends: [{ invalid: true }] } as never))
    assert.equal(await readFile(storePath, 'utf8'), original)
  })
})
