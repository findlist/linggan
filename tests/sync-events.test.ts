import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { test } from 'node:test'
import { ProductEventSchema } from '../src/data/contracts.ts'
import type { ProductEvent } from '../src/data/contracts.ts'
import { syncEventInbox } from '../src/ingestion/sync-events.ts'
import { InMemoryEventStore } from '../src/storage/event-store.ts'

// 固定时钟保证测试可重复
const FIXED_TIME = '2026-07-31T12:00:00.000+08:00'

// 构造一个合法的事件对象，允许覆盖字段
const buildEvent = (overrides: Record<string, unknown> = {}): ProductEvent =>
  ProductEventSchema.parse({
    schema_version: 1,
    event_id: 'evt_20260731_120000_abc123',
    event_type: 'idea_impression',
    idea_id: 'candidate_test_001',
    session_id: 'sess_test_001',
    occurred_at: FIXED_TIME,
    payload: { position: 1, source: 'feed' },
    ...overrides,
  })

// 构造一个 event-inbox 兼容的导出文件内容
const buildExportFile = (events: ProductEvent[], overrides: Record<string, unknown> = {}) => ({
  schema_version: 1,
  session_id: 'sess_test_001',
  exported_at: FIXED_TIME,
  events,
  ...overrides,
})

const withTemporaryDirectory = async (callback: (directory: string) => Promise<void>): Promise<void> => {
  const directory = await mkdtemp(join(tmpdir(), 'linggan-event-sync-'))
  try {
    await callback(directory)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

test('syncEventInbox returns zero counts for an empty directory', async () => {
  await withTemporaryDirectory(async (directory) => {
    const store = new InMemoryEventStore()
    const report = await syncEventInbox({ inboxDirectory: directory, store })
    assert.equal(report.files_discovered, 0)
    assert.equal(report.events_recorded, 0)
    assert.equal(report.failures.length, 0)
  })
})

test('syncEventInbox returns zero counts when directory does not exist', async () => {
  const store = new InMemoryEventStore()
  const report = await syncEventInbox({
    inboxDirectory: join(tmpdir(), 'linggan-nonexistent-' + Date.now()),
    store,
  })
  assert.equal(report.files_discovered, 0)
  assert.equal(report.events_recorded, 0)
})

test('syncEventInbox records all events from a valid export file', async () => {
  await withTemporaryDirectory(async (directory) => {
    const events = [
      buildEvent({ event_id: 'evt_test_001' }),
      buildEvent({ event_id: 'evt_test_002', event_type: 'idea_saved' }),
      buildEvent({ event_id: 'evt_test_003', event_type: 'prompt_copied' }),
    ]
    await writeFile(join(directory, 'events.json'), JSON.stringify(buildExportFile(events)))
    const store = new InMemoryEventStore()
    const report = await syncEventInbox({ inboxDirectory: directory, store })
    assert.equal(report.files_discovered, 1)
    assert.equal(report.files_processed, 1)
    assert.equal(report.events_discovered, 3)
    assert.equal(report.events_recorded, 3)
    assert.equal(report.events_skipped, 0)
    assert.equal(report.events_failed, 0)
    // store 中确实有 3 条
    const counts = await store.countByType()
    assert.equal(counts.idea_impression, 1)
    assert.equal(counts.idea_saved, 1)
    assert.equal(counts.prompt_copied, 1)
  })
})

test('syncEventInbox is idempotent: re-syncing the same file skips all events', async () => {
  await withTemporaryDirectory(async (directory) => {
    const events = [buildEvent({ event_id: 'evt_test_010' }), buildEvent({ event_id: 'evt_test_011' })]
    await writeFile(join(directory, 'events.json'), JSON.stringify(buildExportFile(events)))
    const store = new InMemoryEventStore()
    // 第一次 sync：全部新写入
    const first = await syncEventInbox({ inboxDirectory: directory, store })
    assert.equal(first.events_recorded, 2)
    assert.equal(first.events_skipped, 0)
    // 第二次 sync：event_id 冲突，全部跳过
    const second = await syncEventInbox({ inboxDirectory: directory, store })
    assert.equal(second.events_recorded, 0)
    assert.equal(second.events_skipped, 2)
    // store 中仍只有 2 条，无重复
    assert.equal((await store.list()).length, 2)
  })
})

test('syncEventInbox isolates malformed files and continues processing others', async () => {
  await withTemporaryDirectory(async (directory) => {
    // 坏文件：缺少必填字段 session_id
    await writeFile(join(directory, 'bad.json'), JSON.stringify({ schema_version: 1, events: [] }))
    // 好文件
    const events = [buildEvent({ event_id: 'evt_test_020' })]
    await writeFile(join(directory, 'good.json'), JSON.stringify(buildExportFile(events)))
    const store = new InMemoryEventStore()
    const report = await syncEventInbox({ inboxDirectory: directory, store })
    assert.equal(report.files_discovered, 2)
    assert.equal(report.files_processed, 1)
    assert.equal(report.files_failed, 1)
    assert.equal(report.failures.length, 1)
    assert.equal(report.failures[0].file, join(directory, 'bad.json'))
    // 好文件的事件正常入库
    assert.equal(report.events_recorded, 1)
    assert.equal((await store.list()).length, 1)
  })
})

test('syncEventInbox isolates individual bad events without blocking others in the same file', async () => {
  await withTemporaryDirectory(async (directory) => {
    // 混合文件：1 个合法事件 + 1 个非法事件（event_type 不存在）+ 1 个合法事件
    // 直接内联构造文件内容，因为混合数组不全是 ProductEvent 类型
    const mixedContent = {
      schema_version: 1,
      session_id: 'sess_test_001',
      exported_at: FIXED_TIME,
      events: [
        buildEvent({ event_id: 'evt_test_030' }),
        {
          schema_version: 1,
          event_id: 'evt_test_031',
          event_type: 'unknown_type',
          idea_id: 'candidate_test_001',
          session_id: 'sess_test_001',
          occurred_at: FIXED_TIME,
          payload: {},
        },
        buildEvent({ event_id: 'evt_test_032', event_type: 'idea_saved' }),
      ],
    }
    await writeFile(join(directory, 'mixed.json'), JSON.stringify(mixedContent))
    const store = new InMemoryEventStore()
    const report = await syncEventInbox({ inboxDirectory: directory, store })
    assert.equal(report.files_processed, 1)
    assert.equal(report.events_discovered, 3)
    assert.equal(report.events_recorded, 2)
    assert.equal(report.events_failed, 1)
    // 两条合法事件入库
    assert.equal((await store.list()).length, 2)
  })
})

test('syncEventInbox processes multiple files in sorted order', async () => {
  await withTemporaryDirectory(async (directory) => {
    const fileA = [buildEvent({ event_id: 'evt_test_040' })]
    const fileB = [buildEvent({ event_id: 'evt_test_041' }), buildEvent({ event_id: 'evt_test_042' })]
    await writeFile(join(directory, 'a.json'), JSON.stringify(buildExportFile(fileA)))
    await writeFile(join(directory, 'b.json'), JSON.stringify(buildExportFile(fileB)))
    const store = new InMemoryEventStore()
    const report = await syncEventInbox({ inboxDirectory: directory, store })
    assert.equal(report.files_discovered, 2)
    assert.equal(report.files_processed, 2)
    assert.equal(report.events_recorded, 3)
    assert.equal((await store.list()).length, 3)
  })
})

test('syncEventInbox scans nested subdirectories recursively', async () => {
  await withTemporaryDirectory(async (directory) => {
    const nested = join(directory, '2026', '07', '31')
    await mkdir(nested, { recursive: true })
    const events = [buildEvent({ event_id: 'evt_test_050' })]
    await writeFile(join(nested, 'events.json'), JSON.stringify(buildExportFile(events)))
    const store = new InMemoryEventStore()
    const report = await syncEventInbox({ inboxDirectory: directory, store })
    assert.equal(report.files_discovered, 1)
    assert.equal(report.events_recorded, 1)
  })
})

test('syncEventInbox ignores non-json files', async () => {
  await withTemporaryDirectory(async (directory) => {
    await writeFile(join(directory, 'readme.md'), '# event inbox')
    await writeFile(join(directory, 'events.txt'), 'not json')
    const store = new InMemoryEventStore()
    const report = await syncEventInbox({ inboxDirectory: directory, store })
    assert.equal(report.files_discovered, 0)
    assert.equal(report.events_recorded, 0)
  })
})
