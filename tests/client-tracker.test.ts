import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ProductEventSchema } from '../src/data/contracts.ts'
import { getSession, getSessionId } from '../src/data/session.ts'
import { track, getQueuedEvents, getQueueSize, clearQueue, exportQueue } from '../src/data/tracker.ts'

/* ----------------------- localStorage mock ----------------------- */
// Node 测试环境无 localStorage，用内存 Map 模拟浏览器存储

interface StorageLike {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
  clear: () => void
}

const createMemoryStorage = (): StorageLike => {
  const store = new Map<string, string>()
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value)
    },
    removeItem: (key) => {
      store.delete(key)
    },
    clear: () => {
      store.clear()
    },
  }
}

const originalLocalStorage = (globalThis as { localStorage?: StorageLike }).localStorage

const setupStorage = (storage: StorageLike) => {
  ;(globalThis as { localStorage: StorageLike }).localStorage = storage
}

const restoreStorage = () => {
  if (originalLocalStorage) {
    ;(globalThis as { localStorage: StorageLike }).localStorage = originalLocalStorage
  } else {
    delete (globalThis as { localStorage?: StorageLike }).localStorage
  }
}

// 固定时钟保证测试可重复
const FIXED_NOW = new Date('2026-07-31T12:00:00.000Z')

/* ----------------------- session 测试 ----------------------- */

test('getSession creates a new session on first call and persists to localStorage', () => {
  const storage = createMemoryStorage()
  setupStorage(storage)
  try {
    const session = getSession(FIXED_NOW)
    // session_id 符合 StableIdSchema 格式：sess_{stamp}_{6hex}
    assert.match(session.session_id, /^sess_\d{8}_\d{6}_[a-f0-9]{6}$/)
    assert.equal(session.last_active, FIXED_NOW.toISOString())
    // 持久化到 localStorage
    const stored = JSON.parse(storage.getItem('linggan-session') ?? '{}')
    assert.equal(stored.session_id, session.session_id)
  } finally {
    restoreStorage()
  }
})

test('getSession reuses existing session within timeout', () => {
  const storage = createMemoryStorage()
  setupStorage(storage)
  try {
    const first = getSession(FIXED_NOW)
    // 5 分钟后再次获取，仍在 30 分钟超时内
    const second = getSession(new Date(FIXED_NOW.getTime() + 5 * 60 * 1000))
    assert.equal(second.session_id, first.session_id)
  } finally {
    restoreStorage()
  }
})

test('getSession creates new session after timeout expires', () => {
  const storage = createMemoryStorage()
  setupStorage(storage)
  try {
    const first = getSession(FIXED_NOW)
    // 31 分钟后再次获取，超过 30 分钟超时，应新建会话
    const second = getSession(new Date(FIXED_NOW.getTime() + 31 * 60 * 1000))
    assert.notEqual(second.session_id, first.session_id)
  } finally {
    restoreStorage()
  }
})

test('getSessionId returns the current session id', () => {
  setupStorage(createMemoryStorage())
  try {
    const id = getSessionId()
    assert.match(id, /^sess_\d{8}_\d{6}_[a-f0-9]{6}$/)
  } finally {
    restoreStorage()
  }
})

test('getSession degrades gracefully when localStorage is unavailable', () => {
  // 模拟 localStorage 不可用（如隐私模式）：getItem 抛错
  const brokenStorage: StorageLike = {
    getItem: () => {
      throw new Error('localStorage unavailable')
    },
    setItem: () => {
      throw new Error('localStorage unavailable')
    },
    removeItem: () => {},
    clear: () => {},
  }
  setupStorage(brokenStorage)
  try {
    const session = getSession(FIXED_NOW)
    // 降级返回内存会话，不抛错
    assert.match(session.session_id, /^sess_\d{8}_\d{6}_[a-f0-9]{6}$/)
  } finally {
    restoreStorage()
  }
})

/* ----------------------- tracker 测试 ----------------------- */

test('track generates a valid ProductEvent and appends to queue', () => {
  setupStorage(createMemoryStorage())
  try {
    const event = track('idea_impression', { ideaId: 'candidate_test_001', payload: { position: 1 } }, FIXED_NOW)
    // 事件通过 ProductEventSchema 校验
    const result = ProductEventSchema.safeParse(event)
    assert.equal(result.success, true)
    // 字段正确
    assert.equal(event.event_type, 'idea_impression')
    assert.equal(event.idea_id, 'candidate_test_001')
    assert.match(event.event_id, /^evt_\d{8}_\d{6}_[a-f0-9]{6}$/)
    assert.equal(event.occurred_at, FIXED_NOW.toISOString())
    assert.equal(event.payload.position, 1)
    // session_id 自动附加
    assert.match(event.session_id, /^sess_\d{8}_\d{6}_[a-f0-9]{6}$/)
    // 队列计数
    assert.equal(getQueueSize(), 1)
  } finally {
    restoreStorage()
  }
})

test('track records all 9 core event types (D2 acceptance)', () => {
  setupStorage(createMemoryStorage())
  try {
    const types = [
      'idea_impression',
      'idea_opened',
      'idea_saved',
      'prompt_copied',
      'idea_exported',
      'video_created',
      'video_published',
      'idea_hidden',
      'risk_reported',
    ] as const
    for (const type of types) {
      track(type, { ideaId: type === 'risk_reported' ? null : 'candidate_test_002' }, FIXED_NOW)
    }
    assert.equal(getQueueSize(), 9)
    // 全部通过 Schema 校验
    const events = getQueuedEvents()
    for (const event of events) {
      assert.equal(ProductEventSchema.safeParse(event).success, true)
    }
  } finally {
    restoreStorage()
  }
})

test('track allows null idea_id for risk_reported events', () => {
  setupStorage(createMemoryStorage())
  try {
    const event = track('risk_reported', {}, FIXED_NOW)
    assert.equal(event.idea_id, null)
    assert.equal(ProductEventSchema.safeParse(event).success, true)
  } finally {
    restoreStorage()
  }
})

test('track auto-generates unique event_ids for repeated calls', () => {
  setupStorage(createMemoryStorage())
  try {
    track('idea_impression', { ideaId: 'candidate_test_003' }, FIXED_NOW)
    track('idea_impression', { ideaId: 'candidate_test_003' }, FIXED_NOW)
    const events = getQueuedEvents()
    // 两次 track 生成不同 event_id（Math.random 后缀）
    assert.notEqual(events[0].event_id, events[1].event_id)
  } finally {
    restoreStorage()
  }
})

test('queue enforces max size by dropping oldest events', () => {
  setupStorage(createMemoryStorage())
  try {
    // 写入 205 个事件，超过 MAX_QUEUE_SIZE=200
    for (let i = 0; i < 205; i++) {
      track('idea_impression', { ideaId: `candidate_test_${i}` }, FIXED_NOW)
    }
    // 队列上限 200，丢弃最旧的 5 个
    assert.equal(getQueueSize(), 200)
    const events = getQueuedEvents()
    // 第一个事件是第 6 次写入（index=5），最旧的 5 个被丢弃
    assert.equal(events[0].idea_id, 'candidate_test_5')
  } finally {
    restoreStorage()
  }
})

test('getQueuedEvents returns a copy without mutating the queue', () => {
  setupStorage(createMemoryStorage())
  try {
    track('idea_impression', { ideaId: 'candidate_test_010' }, FIXED_NOW)
    const before = getQueueSize()
    const events = getQueuedEvents()
    // 修改返回的数组不影响队列
    events.pop()
    assert.equal(getQueueSize(), before)
  } finally {
    restoreStorage()
  }
})

test('clearQueue empties the queue', () => {
  setupStorage(createMemoryStorage())
  try {
    track('idea_impression', { ideaId: 'candidate_test_011' }, FIXED_NOW)
    assert.equal(getQueueSize(), 1)
    clearQueue()
    assert.equal(getQueueSize(), 0)
  } finally {
    restoreStorage()
  }
})

test('exportQueue returns null when queue is empty', () => {
  setupStorage(createMemoryStorage())
  try {
    assert.equal(exportQueue(FIXED_NOW), null)
  } finally {
    restoreStorage()
  }
})

test('exportQueue produces EventQueueExport-compatible document and clears queue by default', () => {
  setupStorage(createMemoryStorage())
  try {
    track('idea_impression', { ideaId: 'candidate_test_020' }, FIXED_NOW)
    track('idea_saved', { ideaId: 'candidate_test_020' }, FIXED_NOW)
    const doc = exportQueue(FIXED_NOW)
    assert.ok(doc)
    assert.equal(doc.schema_version, 1)
    assert.match(doc.session_id, /^sess_\d{8}_\d{6}_[a-f0-9]{6}$/)
    assert.equal(doc.exported_at, FIXED_NOW.toISOString())
    assert.equal(doc.events.length, 2)
    // 每个事件通过 Schema 校验
    for (const event of doc.events) {
      assert.equal(ProductEventSchema.safeParse(event).success, true)
    }
    // 默认清空队列
    assert.equal(getQueueSize(), 0)
  } finally {
    restoreStorage()
  }
})

test('exportQueue with keepQueue=true preserves the queue', () => {
  setupStorage(createMemoryStorage())
  try {
    track('idea_impression', { ideaId: 'candidate_test_021' }, FIXED_NOW)
    const doc = exportQueue(FIXED_NOW, true)
    assert.ok(doc)
    assert.equal(doc.events.length, 1)
    // keepQueue=true 不清空队列
    assert.equal(getQueueSize(), 1)
  } finally {
    restoreStorage()
  }
})
