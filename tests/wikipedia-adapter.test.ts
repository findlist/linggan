import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { test } from 'node:test'
import { CollectionBatchSchema } from '../src/data/contracts.ts'
import { migrateCollectionInbox } from '../src/ingestion/migrate-collection-inbox.ts'
import { JsonTrendStore } from '../src/storage/trend-store.ts'
import {
  WikipediaMostReadResponseSchema,
  transformWikipediaMostRead
} from '../src/collectors/wikipedia-adapter.ts'
import type { WikipediaMostReadResponse } from '../src/collectors/wikipedia-adapter.ts'

const fixturesDir = new URL('../data/fixtures/wikipedia-most-read/', import.meta.url)
const collectedAt = '2026-07-30T07:30:00.000+08:00'
const runId = 'wiki_most_read_en_20260730_073000'

// 顶层预加载所有 fixture，测试中同步引用，避免每个用例重复读文件
const parseFixture = async (name: string): Promise<WikipediaMostReadResponse> =>
  WikipediaMostReadResponseSchema.parse(
    JSON.parse(await readFile(new URL(name, fixturesDir), 'utf8')) as unknown
  )

const [normalResponse, emptyResponse, missingFieldsResponse, badTitlesResponse] = await Promise.all([
  parseFixture('normal.json'),
  parseFixture('empty.json'),
  parseFixture('missing-fields.json'),
  parseFixture('bad-titles.json')
])

test('normal sample produces a valid batch with 5 items', () => {
  const batch = transformWikipediaMostRead({ response: normalResponse, language: 'en', collectedAt, runId })
  assert.equal(batch.items.length, 5)
  assert.equal(batch.run.status, 'success')
  assert.equal(batch.run.item_count, 5)
  CollectionBatchSchema.parse(batch)
})

test('category mapping covers sports, film, game, festival and cultural_event', () => {
  const batch = transformWikipediaMostRead({ response: normalResponse, language: 'en', collectedAt, runId })
  const categories = batch.items.map(item => item.category)
  assert.equal(categories[0], 'sports')
  assert.equal(categories[1], 'film')
  assert.equal(categories[2], 'game')
  assert.equal(categories[3], 'festival')
  assert.equal(categories[4], 'cultural_event')
})

test('all source evidence URLs are valid HTTPS Wikipedia links', () => {
  const batch = transformWikipediaMostRead({ response: normalResponse, language: 'en', collectedAt, runId })
  for (const item of batch.items) {
    for (const evidence of item.source_evidence) {
      assert.match(evidence.url, /^https:\/\/en\.wikipedia\.org\/wiki\//u)
    }
  }
})

test('item ids are stable and unique within a batch', () => {
  const batch = transformWikipediaMostRead({ response: normalResponse, language: 'en', collectedAt, runId })
  const ids = batch.items.map(item => item.id)
  // 同一输入再次转换得到相同 ID
  const batch2 = transformWikipediaMostRead({ response: normalResponse, language: 'en', collectedAt, runId })
  assert.deepEqual(batch2.items.map(item => item.id), ids)
  // ID 批次内唯一
  assert.equal(new Set(ids).size, ids.length)
  // ID 格式符合 StableIdSchema
  for (const id of ids) assert.match(id, /^[a-z0-9]+(?:_[a-z0-9]+)*$/u)
})

test('lifecycle inference: null rank_previous → emerging, present → rising', () => {
  const batch = transformWikipediaMostRead({ response: normalResponse, language: 'en', collectedAt, runId })
  // rank 1: rank_previous=1 → rising；rank 3: rank_previous=null → emerging
  assert.equal(batch.items[0].lifecycle, 'rising')
  assert.equal(batch.items[2].lifecycle, 'emerging')
})

test('empty sample produces a valid batch with 0 items', () => {
  const batch = transformWikipediaMostRead({ response: emptyResponse, language: 'en', collectedAt, runId })
  assert.equal(batch.items.length, 0)
  assert.equal(batch.run.item_count, 0)
  assert.equal(batch.run.status, 'success')
  CollectionBatchSchema.parse(batch)
})

test('missing fields are filled with defaults without failing', () => {
  const batch = transformWikipediaMostRead({ response: missingFieldsResponse, language: 'en', collectedAt, runId })
  assert.equal(batch.items.length, 3)
  // 缺少 extract 的条目用元信息兜底描述
  assert.match(batch.items[0].description, /维基百科最热词条/)
  // 缺少 views 的条目不产生 page_views 指标，只有 rank
  assert.equal(batch.items[1].observed_metrics.length, 1)
  assert.equal(batch.items[1].observed_metrics[0].name, 'rank')
  // 缺少 rank_previous → emerging
  assert.equal(batch.items[2].lifecycle, 'emerging')
  CollectionBatchSchema.parse(batch)
})

test('articles with empty or whitespace-only titles are skipped', () => {
  const batch = transformWikipediaMostRead({ response: badTitlesResponse, language: 'en', collectedAt, runId })
  // 4 篇中有 2 篇标题非法，应跳过
  assert.equal(batch.items.length, 2)
  assert.equal(batch.items[0].name, 'Valid Article One')
  assert.equal(batch.items[1].name, 'Valid Article Two')
  assert.equal(batch.run.status, 'partial')
  assert.equal(batch.run.errors.length, 2)
  CollectionBatchSchema.parse(batch)
})

test('invalid language code is rejected', () => {
  assert.throws(
    () => transformWikipediaMostRead({ response: normalResponse, language: 'evil;rm', collectedAt, runId }),
    /invalid language code/u
  )
})

test('transformed batch is consumable by migrate:trends and writes trends to store', async () => {
  const batch = transformWikipediaMostRead({ response: normalResponse, language: 'en', collectedAt, runId })
  const directory = await mkdtemp(join(tmpdir(), 'linggan-wiki-'))
  try {
    const inbox = join(directory, 'inbox')
    await mkdir(inbox)
    await writeFile(join(inbox, 'wiki-batch.json'), JSON.stringify(batch))
    const storePath = join(directory, 'trends.json')
    const store = new JsonTrendStore(storePath)
    const report = await migrateCollectionInbox({ inboxDirectory: inbox, store })
    assert.equal(report.files_processed, 1)
    assert.equal(report.files_failed, 0)
    assert.equal(report.inserted, 5)
    assert.equal(report.total_trends, 5)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('repeated migration of the same wikipedia batch is idempotent', async () => {
  const batch = transformWikipediaMostRead({ response: normalResponse, language: 'en', collectedAt, runId })
  const directory = await mkdtemp(join(tmpdir(), 'linggan-wiki-idem-'))
  try {
    const inbox = join(directory, 'inbox')
    await mkdir(inbox)
    await writeFile(join(inbox, 'wiki-batch.json'), JSON.stringify(batch))
    const storePath = join(directory, 'trends.json')
    const store = new JsonTrendStore(storePath)
    await migrateCollectionInbox({ inboxDirectory: inbox, store })
    const first = await readFile(storePath, 'utf8')
    await migrateCollectionInbox({ inboxDirectory: inbox, store })
    const second = await readFile(storePath, 'utf8')
    assert.equal(second, first)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
