import assert from 'node:assert/strict'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtemp, rm } from 'node:fs/promises'
import { test } from 'node:test'
import { PRODUCT_EVENT_TYPES, ProductEventSchema } from '../src/data/contracts.ts'
import type { ProductEvent, ProductEventType } from '../src/data/contracts.ts'
import { migrateDatabase } from '../src/database/migrate.ts'
import { InMemoryEventStore } from '../src/storage/event-store.ts'
import { SqliteEventStore } from '../src/storage/sqlite-event-store.ts'
import { createEventTracker, buildEventId } from '../src/analytics/event-tracker.ts'

const migrationsDirectory = new URL('../database/migrations', import.meta.url).pathname.replace(
  /^\/(?:[A-Za-z]:)/u,
  (value) => value.slice(1),
)

// 固定时钟保证测试可重复
const FIXED_TIME = '2026-07-31T12:00:00.000Z'
const fixedClock = () => new Date(FIXED_TIME)

// 构造一个合法的事件对象，允许覆盖字段
const buildValidEvent = (overrides: Record<string, unknown> = {}): ProductEvent =>
  ProductEventSchema.parse({
    schema_version: 1,
    event_id: 'evt_20260731_120000_abc123',
    event_type: 'idea_impression',
    idea_id: 'candidate_demo_001',
    session_id: 'sess_test_001',
    occurred_at: FIXED_TIME,
    payload: { position: 1, source: 'feed' },
    ...overrides,
  })

// 用临时目录 + 迁移建表，确保 product_events 表存在
const withDatabase = async (callback: (store: SqliteEventStore) => Promise<void>): Promise<void> => {
  const directory = await mkdtemp(join(tmpdir(), 'linggan-events-'))
  try {
    const { database } = await migrateDatabase({
      filePath: join(directory, 'test.sqlite'),
      migrationsDirectory,
    })
    try {
      await callback(new SqliteEventStore(database))
    } finally {
      database.close()
    }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

/* ----------------------- Schema 校验 ----------------------- */

test('schema accepts a valid event with all 9 core event types', () => {
  // 遍历 9 类核心事件，验证每种类型都能通过 Schema 校验
  for (const eventType of Object.values(PRODUCT_EVENT_TYPES) as ProductEventType[]) {
    const result = ProductEventSchema.safeParse(buildValidEvent({ event_type: eventType }))
    assert.equal(result.success, true, `event_type ${eventType} should be valid`)
  }
})

test('schema rejects unknown event type', () => {
  // buildValidEvent 内部会 parse 合法对象，这里用 spread 覆盖 event_type 为非法值再 safeParse
  const result = ProductEventSchema.safeParse({ ...buildValidEvent(), event_type: 'unknown_event' })
  assert.equal(result.success, false)
})

test('schema rejects missing required fields', () => {
  assert.equal(ProductEventSchema.safeParse({ ...buildValidEvent(), event_id: undefined }).success, false)
  assert.equal(ProductEventSchema.safeParse({ ...buildValidEvent(), session_id: undefined }).success, false)
  assert.equal(ProductEventSchema.safeParse({ ...buildValidEvent(), occurred_at: undefined }).success, false)
  assert.equal(ProductEventSchema.safeParse({ ...buildValidEvent(), event_type: undefined }).success, false)
})

test('schema rejects unknown fields in strict mode', () => {
  assert.equal(ProductEventSchema.safeParse({ ...buildValidEvent(), extra_field: 'bad' }).success, false)
})

test('schema allows null idea_id for events not tied to a specific idea', () => {
  const event = buildValidEvent({ idea_id: null })
  assert.equal(ProductEventSchema.safeParse(event).success, true)
})

test('schema allows empty payload object', () => {
  const event = buildValidEvent({ payload: {} })
  assert.equal(ProductEventSchema.safeParse(event).success, true)
})

test('schema rejects invalid event_id not matching StableIdSchema', () => {
  assert.equal(ProductEventSchema.safeParse({ ...buildValidEvent(), event_id: 'UPPER CASE' }).success, false)
  assert.equal(ProductEventSchema.safeParse({ ...buildValidEvent(), event_id: 'evt-bad-dash' }).success, false)
})

test('schema rejects payload with non-primitive values', () => {
  assert.equal(
    ProductEventSchema.safeParse({ ...buildValidEvent(), payload: { nested: { deep: true } } }).success,
    false,
  )
  assert.equal(ProductEventSchema.safeParse({ ...buildValidEvent(), payload: { list: ['a', 'b'] } }).success, false)
})

/* ----------------------- InMemoryEventStore ----------------------- */

test('in-memory store records a new event and returns recorded=1', async () => {
  const store = new InMemoryEventStore()
  const result = await store.record(buildValidEvent())
  assert.equal(result.recorded, 1)
  assert.equal(result.total, 1)
})

test('in-memory store skips duplicate event_id and returns recorded=0', async () => {
  const store = new InMemoryEventStore()
  await store.record(buildValidEvent())
  // 同一 event_id 再次提交，应被幂等跳过
  const result = await store.record(buildValidEvent())
  assert.equal(result.recorded, 0)
  assert.equal(result.total, 1)
})

test('in-memory store list filters by event_type', async () => {
  const store = new InMemoryEventStore()
  await store.record(buildValidEvent({ event_id: 'evt_a', event_type: 'idea_impression' }))
  await store.record(buildValidEvent({ event_id: 'evt_b', event_type: 'idea_opened' }))
  await store.record(buildValidEvent({ event_id: 'evt_c', event_type: 'idea_opened' }))

  const impressions = await store.list({ event_type: 'idea_impression' })
  const opened = await store.list({ event_type: 'idea_opened' })
  assert.equal(impressions.length, 1)
  assert.equal(opened.length, 2)
})

test('in-memory store list filters by session_id', async () => {
  const store = new InMemoryEventStore()
  await store.record(buildValidEvent({ event_id: 'evt_a', session_id: 'sess_one' }))
  await store.record(buildValidEvent({ event_id: 'evt_b', session_id: 'sess_two' }))

  const result = await store.list({ session_id: 'sess_one' })
  assert.equal(result.length, 1)
  assert.equal(result[0].session_id, 'sess_one')
})

test('in-memory store list filters by idea_id', async () => {
  const store = new InMemoryEventStore()
  await store.record(buildValidEvent({ event_id: 'evt_a', idea_id: 'idea_alpha' }))
  await store.record(buildValidEvent({ event_id: 'evt_b', idea_id: 'idea_beta' }))
  await store.record(buildValidEvent({ event_id: 'evt_c', idea_id: null }))

  const result = await store.list({ idea_id: 'idea_alpha' })
  assert.equal(result.length, 1)
  assert.equal(result[0].idea_id, 'idea_alpha')
})

test('in-memory store list filters by date range', async () => {
  const store = new InMemoryEventStore()
  await store.record(buildValidEvent({ event_id: 'evt_a', occurred_at: '2026-07-30T10:00:00.000Z' }))
  await store.record(buildValidEvent({ event_id: 'evt_b', occurred_at: '2026-07-31T10:00:00.000Z' }))
  await store.record(buildValidEvent({ event_id: 'evt_c', occurred_at: '2026-08-01T10:00:00.000Z' }))

  const july31 = await store.list({ startDate: '2026-07-31', endDate: '2026-07-31' })
  assert.equal(july31.length, 1)
  assert.equal(july31[0].event_id, 'evt_b')
})

test('in-memory store list returns all events sorted by occurred_at DESC when no filter', async () => {
  const store = new InMemoryEventStore()
  await store.record(buildValidEvent({ event_id: 'evt_old', occurred_at: '2026-07-29T10:00:00.000Z' }))
  await store.record(buildValidEvent({ event_id: 'evt_new', occurred_at: '2026-08-01T10:00:00.000Z' }))

  const result = await store.list()
  assert.equal(result.length, 2)
  assert.equal(result[0].event_id, 'evt_new')
  assert.equal(result[1].event_id, 'evt_old')
})

test('in-memory store countByType returns all 9 types with counts', async () => {
  const store = new InMemoryEventStore()
  await store.record(buildValidEvent({ event_id: 'evt_a', event_type: 'idea_impression' }))
  await store.record(buildValidEvent({ event_id: 'evt_b', event_type: 'idea_opened' }))
  await store.record(buildValidEvent({ event_id: 'evt_c', event_type: 'idea_impression' }))

  const counts = await store.countByType()
  // 9 类事件都应在结果中，未记录的为 0
  assert.equal(Object.keys(counts).length, 9)
  assert.equal(counts.idea_impression, 2)
  assert.equal(counts.idea_opened, 1)
  assert.equal(counts.idea_saved, 0)
  assert.equal(counts.risk_reported, 0)
})

/* ----------------------- SqliteEventStore ----------------------- */

test('sqlite store records and retrieves an event', async () => {
  await withDatabase(async (store) => {
    const result = await store.record(buildValidEvent())
    assert.equal(result.recorded, 1)
    assert.equal(result.total, 1)

    const all = await store.list()
    assert.equal(all.length, 1)
    assert.equal(all[0].event_id, 'evt_20260731_120000_abc123')
  })
})

test('sqlite store skips duplicate event_id (idempotency)', async () => {
  await withDatabase(async (store) => {
    await store.record(buildValidEvent())
    const result = await store.record(buildValidEvent())
    assert.equal(result.recorded, 0)
    assert.equal(result.total, 1)
  })
})

test('sqlite store list filters by event_type and session_id', async () => {
  await withDatabase(async (store) => {
    await store.record(buildValidEvent({ event_id: 'evt_a', event_type: 'idea_saved', session_id: 'sess_one' }))
    await store.record(buildValidEvent({ event_id: 'evt_b', event_type: 'prompt_copied', session_id: 'sess_two' }))

    const saved = await store.list({ event_type: 'idea_saved' })
    const one = await store.list({ session_id: 'sess_one' })
    assert.equal(saved.length, 1)
    assert.equal(one.length, 1)
  })
})

test('sqlite store countByType returns all 9 types', async () => {
  await withDatabase(async (store) => {
    await store.record(buildValidEvent({ event_id: 'evt_a', event_type: 'video_created' }))
    const counts = await store.countByType()
    assert.equal(Object.keys(counts).length, 9)
    assert.equal(counts.video_created, 1)
    assert.equal(counts.video_published, 0)
  })
})

/* ----------------------- EventTracker ----------------------- */

test('tracker records all 9 core event types (D1 acceptance)', async () => {
  // D1 验收条件：9 类核心事件可记录
  const store = new InMemoryEventStore()
  const tracker = createEventTracker({ store, clock: fixedClock })

  const nineTypes = Object.values(PRODUCT_EVENT_TYPES) as ProductEventType[]
  for (const eventType of nineTypes) {
    const result = await tracker.track(eventType, {
      session_id: 'sess_acceptance',
      idea_id: 'idea_demo',
      payload: { source: 'test' },
    })
    assert.equal(result.recorded, 1, `${eventType} should be recorded`)
  }

  const counts = await store.countByType()
  for (const eventType of nineTypes) {
    assert.equal(counts[eventType], 1, `${eventType} count should be 1`)
  }
  assert.equal((await store.list()).length, 9)
})

test('tracker auto-generates event_id matching StableIdSchema format', async () => {
  const store = new InMemoryEventStore()
  const tracker = createEventTracker({ store, clock: fixedClock })
  await tracker.track('idea_opened', { session_id: 'sess_gen' })

  const events = await store.list()
  assert.equal(events.length, 1)
  // evt_ 前缀 + 时间戳 + 随机后缀，符合 StableIdSchema
  assert.match(events[0].event_id, /^evt_\d{8}_\d{6}_[a-f0-9]{6}$/u)
})

test('tracker respects client-provided event_id for idempotency', async () => {
  const store = new InMemoryEventStore()
  const tracker = createEventTracker({ store, clock: fixedClock })

  const first = await tracker.track('idea_saved', {
    session_id: 'sess_idem',
    event_id: 'evt_client_fixed',
  })
  const second = await tracker.track('idea_saved', {
    session_id: 'sess_idem',
    event_id: 'evt_client_fixed',
  })
  assert.equal(first.recorded, 1)
  assert.equal(second.recorded, 0)
  assert.equal(second.total, 1)
})

test('tracker uses injected clock for reproducible occurred_at', async () => {
  const store = new InMemoryEventStore()
  const tracker = createEventTracker({ store, clock: fixedClock })
  await tracker.track('idea_exported', { session_id: 'sess_clock' })

  const events = await store.list()
  assert.equal(events[0].occurred_at, FIXED_TIME)
})

test('tracker allows null idea_id for events like risk_reported', async () => {
  const store = new InMemoryEventStore()
  const tracker = createEventTracker({ store, clock: fixedClock })
  await tracker.track('risk_reported', {
    session_id: 'sess_risk',
    idea_id: null,
    payload: { reason: 'copyright_concern' },
  })

  const events = await store.list()
  assert.equal(events.length, 1)
  assert.equal(events[0].idea_id, null)
})

test('buildEventId produces StableIdSchema-compatible value', () => {
  const id = buildEventId(FIXED_TIME)
  // 必须通过 Schema 校验
  const event = buildValidEvent({ event_id: id })
  assert.equal(event.event_id, id)
})
