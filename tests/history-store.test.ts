import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  addHistory,
  getHistory,
  getHistorySize,
  removeHistory,
  clearHistory,
  MAX_HISTORY,
} from '../src/data/history.ts'
import type { RemixPlan, AddHistoryInput, HistoryContext } from '../src/data/history.ts'

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

/* ----------------------- mock 工具 ----------------------- */

// 构建最小 RemixPlan mock，只需满足 history.ts 的字段校验
let planCounter = 0
const createMockPlan = (overrides: Partial<RemixPlan> = {}): RemixPlan => {
  planCounter += 1
  return {
    id: `remix-${planCounter}`,
    title: `测试方案 ${planCounter}`,
    concept: '测试概念',
    hook: '测试钩子',
    hookCategory: 'suspense',
    personalityA: 'cold',
    personalityB: 'hot',
    dialogueA: '对白A',
    dialogueB: '对白B',
    storyboard: [],
    copywriting: {
      titles: ['标题1'],
      description: '描述',
      hashtags: ['#标签'],
      cover_copy: '封面文案',
    },
    prompt: '提示词',
    duration: 30,
    production: {
      prompts: {
        positive: '正向',
        negative: '负面',
        aspect_ratio: '16:9',
        style_strength: 0.8,
      },
      copyright_boundary: {
        reference_status: '参考状态',
        commercial_use: '商用限制',
        rewrite_scope: '改写范围',
      },
    },
    ...overrides,
  } as RemixPlan
}

const createContext = (overrides: Partial<HistoryContext> = {}): HistoryContext => ({
  characterAId: 'char_a',
  characterBId: 'char_b',
  momentId: 'moment_1',
  styleId: 'style_cyber',
  ...overrides,
})

const createInput = (overrides: Partial<AddHistoryInput> = {}): AddHistoryInput => ({
  plan: createMockPlan(),
  context: createContext(),
  seed: 'test-seed',
  ...overrides,
})

/* ----------------------- 基础功能测试 ----------------------- */

test('空 localStorage 时 getHistory 返回空数组', () => {
  const storage = createMemoryStorage()
  setupStorage(storage)
  try {
    assert.deepEqual(getHistory(), [])
    assert.equal(getHistorySize(), 0)
  } finally {
    restoreStorage()
  }
})

test('addHistory 把新条目插入最前并持久化到 localStorage', () => {
  const storage = createMemoryStorage()
  setupStorage(storage)
  try {
    const input = createInput()
    const result = addHistory(input, FIXED_NOW)
    assert.equal(result.length, 1)
    assert.equal(result[0].id, input.plan.id)
    assert.equal(result[0].title, input.plan.title)
    assert.equal(result[0].hook, input.plan.hook)
    assert.equal(result[0].createdAt, FIXED_NOW.toISOString())
    assert.equal(result[0].seed, 'test-seed')
    // 持久化验证
    const stored = getHistory()
    assert.equal(stored.length, 1)
    assert.equal(stored[0].id, input.plan.id)
    assert.equal(getHistorySize(), 1)
  } finally {
    restoreStorage()
  }
})

test('addHistory 多次记录按时间倒序（最新在最前）', () => {
  const storage = createMemoryStorage()
  setupStorage(storage)
  try {
    const t1 = new Date('2026-07-31T10:00:00.000Z')
    const t2 = new Date('2026-07-31T11:00:00.000Z')
    const t3 = new Date('2026-07-31T12:00:00.000Z')
    const p1 = addHistory(createInput({ plan: createMockPlan({ id: 'remix-1' }) }), t1)
    const p2 = addHistory(createInput({ plan: createMockPlan({ id: 'remix-2' }) }), t2)
    const p3 = addHistory(createInput({ plan: createMockPlan({ id: 'remix-3' }) }), t3)
    // 每次返回的列表最新在最前
    assert.equal(p1[0].id, 'remix-1')
    assert.equal(p2[0].id, 'remix-2')
    assert.equal(p3[0].id, 'remix-3')
    // 最终 getHistory 也是最新在最前
    const history = getHistory()
    assert.equal(history.length, 3)
    assert.equal(history[0].id, 'remix-3')
    assert.equal(history[1].id, 'remix-2')
    assert.equal(history[2].id, 'remix-1')
  } finally {
    restoreStorage()
  }
})

test('addHistory 同 id 条目更新并移到最前，不重复堆积', () => {
  const storage = createMemoryStorage()
  setupStorage(storage)
  try {
    const plan = createMockPlan({ id: 'remix-dup', title: '原标题' })
    addHistory(createInput({ plan }), new Date('2026-07-31T10:00:00.000Z'))
    addHistory(createInput({ plan: createMockPlan({ id: 'remix-other' }) }), new Date('2026-07-31T11:00:00.000Z'))
    // 同 id 再次记录，更新标题并移到最前
    const updated = createMockPlan({ id: 'remix-dup', title: '新标题' })
    const result = addHistory(createInput({ plan: updated }), new Date('2026-07-31T12:00:00.000Z'))
    assert.equal(result.length, 2)
    assert.equal(result[0].id, 'remix-dup')
    assert.equal(result[0].title, '新标题')
    assert.equal(result[1].id, 'remix-other')
  } finally {
    restoreStorage()
  }
})

/* ----------------------- 上限测试 ----------------------- */

test('超过 MAX_HISTORY 时丢弃最旧条目', () => {
  const storage = createMemoryStorage()
  setupStorage(storage)
  try {
    // 添加 MAX_HISTORY + 5 条
    for (let i = 0; i < MAX_HISTORY + 5; i++) {
      addHistory(createInput({ plan: createMockPlan({ id: `remix-${i}` }) }), new Date(2026, 6, 1, 0, i))
    }
    const history = getHistory()
    assert.equal(history.length, MAX_HISTORY)
    // 最新的在最前：最后添加的是 remix-(MAX_HISTORY+4)
    assert.equal(history[0].id, `remix-${MAX_HISTORY + 4}`)
    // 最旧的被丢弃：remix-0 到 remix-4 不在列表中
    assert.ok(!history.some((h) => h.id === 'remix-0'))
    assert.ok(!history.some((h) => h.id === 'remix-4'))
    // remix-5 是最旧的保留条目
    assert.equal(history[history.length - 1].id, 'remix-5')
  } finally {
    restoreStorage()
  }
})

test('MAX_HISTORY 常量值为 50', () => {
  assert.equal(MAX_HISTORY, 50)
})

/* ----------------------- 删除和清空测试 ----------------------- */

test('removeHistory 按 id 删除单条记录', () => {
  const storage = createMemoryStorage()
  setupStorage(storage)
  try {
    addHistory(createInput({ plan: createMockPlan({ id: 'remix-keep' }) }), FIXED_NOW)
    addHistory(createInput({ plan: createMockPlan({ id: 'remix-delete' }) }), FIXED_NOW)
    assert.equal(getHistorySize(), 2)
    const result = removeHistory('remix-delete')
    assert.equal(result.length, 1)
    assert.equal(result[0].id, 'remix-keep')
    assert.equal(getHistorySize(), 1)
    assert.ok(!getHistory().some((h) => h.id === 'remix-delete'))
  } finally {
    restoreStorage()
  }
})

test('removeHistory 删除不存在的 id 不影响其他记录', () => {
  const storage = createMemoryStorage()
  setupStorage(storage)
  try {
    addHistory(createInput({ plan: createMockPlan({ id: 'remix-1' }) }), FIXED_NOW)
    const result = removeHistory('nonexistent')
    assert.equal(result.length, 1)
    assert.equal(getHistorySize(), 1)
  } finally {
    restoreStorage()
  }
})

test('clearHistory 清空全部记录', () => {
  const storage = createMemoryStorage()
  setupStorage(storage)
  try {
    addHistory(createInput(), FIXED_NOW)
    addHistory(createInput({ plan: createMockPlan({ id: 'remix-2' }) }), FIXED_NOW)
    assert.equal(getHistorySize(), 2)
    clearHistory()
    assert.equal(getHistorySize(), 0)
    assert.deepEqual(getHistory(), [])
  } finally {
    restoreStorage()
  }
})

/* ----------------------- 健壮性测试 ----------------------- */

test('localStorage 中损坏 JSON 时降级为空数组', () => {
  const storage = createMemoryStorage()
  setupStorage(storage)
  try {
    storage.setItem('linggan-creation-history', '{invalid json')
    assert.deepEqual(getHistory(), [])
    assert.equal(getHistorySize(), 0)
  } finally {
    restoreStorage()
  }
})

test('localStorage 中非数组数据时降级为空数组', () => {
  const storage = createMemoryStorage()
  setupStorage(storage)
  try {
    storage.setItem('linggan-creation-history', '{"not": "an array"}')
    assert.deepEqual(getHistory(), [])
  } finally {
    restoreStorage()
  }
})

test('localStorage 中条目缺 id 字段时被过滤', () => {
  const storage = createMemoryStorage()
  setupStorage(storage)
  try {
    // 混合合法和非法条目
    storage.setItem(
      'linggan-creation-history',
      JSON.stringify([
        {
          id: 'valid-1',
          title: '合法',
          plan: { id: 'valid-1' },
          context: {},
          seed: '',
          createdAt: '2026-07-31T10:00:00.000Z',
        },
        { title: '缺 id', plan: {} }, // 缺 id，应被过滤
        { id: 'valid-2', plan: {} }, // 缺 title，应被过滤
        null, // 非对象，应被过滤
        'string', // 非对象，应被过滤
      ]),
    )
    const history = getHistory()
    assert.equal(history.length, 1)
    assert.equal(history[0].id, 'valid-1')
  } finally {
    restoreStorage()
  }
})

test('addHistory 后 removeHistory 再 addHistory 同 id 正常工作', () => {
  const storage = createMemoryStorage()
  setupStorage(storage)
  try {
    const plan = createMockPlan({ id: 'remix-cycle' })
    addHistory(createInput({ plan }), FIXED_NOW)
    assert.equal(getHistorySize(), 1)
    removeHistory('remix-cycle')
    assert.equal(getHistorySize(), 0)
    addHistory(createInput({ plan }), FIXED_NOW)
    assert.equal(getHistorySize(), 1)
    assert.equal(getHistory()[0].id, 'remix-cycle')
  } finally {
    restoreStorage()
  }
})

test('addHistory 保存完整 context 供重新加载使用', () => {
  const storage = createMemoryStorage()
  setupStorage(storage)
  try {
    const context = createContext({
      characterAId: 'char_x',
      characterBId: 'char_y',
      momentId: 'moment_z',
      styleId: 'style_w',
    })
    addHistory(createInput({ plan: createMockPlan({ id: 'remix-ctx' }), context }), FIXED_NOW)
    const entry = getHistory()[0]
    assert.equal(entry.context.characterAId, 'char_x')
    assert.equal(entry.context.characterBId, 'char_y')
    assert.equal(entry.context.momentId, 'moment_z')
    assert.equal(entry.context.styleId, 'style_w')
  } finally {
    restoreStorage()
  }
})
