import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getLibraryPrefs, patchLibraryPrefs, LIBRARY_TABS } from '../src/data/library-prefs.ts'
import type { LibraryPrefs } from '../src/data/library-prefs.ts'

/** Node 测试环境模拟 localStorage 所需的最小接口 */
interface StorageLike {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
  clear: () => void
}

/* ----------------------- localStorage mock ----------------------- */
// Node 测试环境无 localStorage，用内存 Map 模拟浏览器存储（与 history-store.test.ts 同模式）

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

const PREFS_KEY = 'linggan-library-prefs'

/* ----------------------- 基础读写测试 ----------------------- */

test('空 localStorage 时 getLibraryPrefs 返回默认偏好', () => {
  setupStorage(createMemoryStorage())
  try {
    const prefs = getLibraryPrefs()
    assert.equal(prefs.activeTab, 'characters')
    assert.equal(prefs.searchQuery, '')
    assert.deepEqual(prefs.filtersByTab, {})
  } finally {
    restoreStorage()
  }
})

test('patchLibraryPrefs 后 getLibraryPrefs roundtrip 恢复完整偏好', () => {
  setupStorage(createMemoryStorage())
  try {
    patchLibraryPrefs({
      activeTab: 'moments',
      searchQuery: '火影',
      filtersByTab: {
        characters: { type: ['热血追梦者'], work: ['火影忍者', '甄嬛传'] },
        moments: { emotion: ['紧张'] },
      },
    })
    const prefs = getLibraryPrefs()
    assert.equal(prefs.activeTab, 'moments')
    assert.equal(prefs.searchQuery, '火影')
    assert.deepEqual(prefs.filtersByTab.characters, { type: ['热血追梦者'], work: ['火影忍者', '甄嬛传'] })
    assert.deepEqual(prefs.filtersByTab.moments, { emotion: ['紧张'] })
  } finally {
    restoreStorage()
  }
})

test('patchLibraryPrefs 浅合并不丢失未传入字段', () => {
  setupStorage(createMemoryStorage())
  try {
    patchLibraryPrefs({
      activeTab: 'works',
      filtersByTab: { characters: { type: ['隐忍反派'] } },
    })
    // 只更新 searchQuery，activeTab 与 filtersByTab 应保留
    patchLibraryPrefs({ searchQuery: '赛博' })
    const prefs = getLibraryPrefs()
    assert.equal(prefs.activeTab, 'works')
    assert.equal(prefs.searchQuery, '赛博')
    assert.deepEqual(prefs.filtersByTab.characters, { type: ['隐忍反派'] })
  } finally {
    restoreStorage()
  }
})

test('LIBRARY_TABS 常量包含三个合法 tab', () => {
  assert.deepEqual([...LIBRARY_TABS], ['characters', 'moments', 'works'])
})

/* ----------------------- 损坏数据降级测试 ----------------------- */

test('localStorage 中损坏 JSON 时降级为默认偏好', () => {
  const storage = createMemoryStorage()
  setupStorage(storage)
  try {
    storage.setItem(PREFS_KEY, '{invalid json')
    const prefs = getLibraryPrefs()
    assert.equal(prefs.activeTab, 'characters')
    assert.equal(prefs.searchQuery, '')
    assert.deepEqual(prefs.filtersByTab, {})
  } finally {
    restoreStorage()
  }
})

test('localStorage 中顶层非对象（数组 / 字符串 / null）时降级为默认偏好', () => {
  const storage = createMemoryStorage()
  setupStorage(storage)
  try {
    for (const bad of ['["characters"]', '"characters"', 'null', '42']) {
      storage.setItem(PREFS_KEY, bad)
      const prefs = getLibraryPrefs()
      assert.equal(prefs.activeTab, 'characters')
      assert.equal(prefs.searchQuery, '')
      assert.deepEqual(prefs.filtersByTab, {})
    }
  } finally {
    restoreStorage()
  }
})

/* ----------------------- 字段级规范化测试 ----------------------- */

test('activeTab 非法值降级为 characters', () => {
  const storage = createMemoryStorage()
  setupStorage(storage)
  try {
    for (const bad of ['feed', '', 'CHARACTERS', 'characters ']) {
      storage.setItem(PREFS_KEY, JSON.stringify({ activeTab: bad }))
      assert.equal(getLibraryPrefs().activeTab, 'characters', `activeTab=${JSON.stringify(bad)} 应降级`)
    }
  } finally {
    restoreStorage()
  }
})

test('searchQuery 非字符串降级为空字符串', () => {
  const storage = createMemoryStorage()
  setupStorage(storage)
  try {
    storage.setItem(PREFS_KEY, JSON.stringify({ searchQuery: 123 }))
    assert.equal(getLibraryPrefs().searchQuery, '')
    storage.setItem(PREFS_KEY, JSON.stringify({ searchQuery: null }))
    assert.equal(getLibraryPrefs().searchQuery, '')
  } finally {
    restoreStorage()
  }
})

test('filtersByTab 中非法 tab 键被丢弃，合法 tab 保留', () => {
  const storage = createMemoryStorage()
  setupStorage(storage)
  try {
    storage.setItem(
      PREFS_KEY,
      JSON.stringify({
        filtersByTab: {
          characters: { type: ['热血追梦者'] },
          feed: { type: ['不合法 tab'] },
          moments: { emotion: ['紧张'] },
        },
      }),
    )
    const prefs = getLibraryPrefs()
    assert.deepEqual(prefs.filtersByTab.characters, { type: ['热血追梦者'] })
    assert.deepEqual(prefs.filtersByTab.moments, { emotion: ['紧张'] })
    assert.ok(!('feed' in prefs.filtersByTab))
  } finally {
    restoreStorage()
  }
})

test('筛选维度值非字符串数组时该维度被丢弃', () => {
  const storage = createMemoryStorage()
  setupStorage(storage)
  try {
    storage.setItem(
      PREFS_KEY,
      JSON.stringify({
        filtersByTab: {
          characters: {
            type: ['热血追梦者'], // 合法维度应保留
            work: '火影忍者', // 字符串而非数组 → 丢弃
            rights: ['reference_only', 42], // 混合类型 → 丢弃
            conflict: null, // null → 丢弃
            emotion: [], // 空数组无筛选意义 → 丢弃
          },
        },
      }),
    )
    const prefs = getLibraryPrefs()
    assert.deepEqual(prefs.filtersByTab.characters, { type: ['热血追梦者'] })
  } finally {
    restoreStorage()
  }
})

test('filtersByTab 为空筛选的 tab 不写入持久化 JSON', () => {
  const storage = createMemoryStorage()
  setupStorage(storage)
  try {
    patchLibraryPrefs({ filtersByTab: { characters: {}, moments: { emotion: [] } } })
    const stored = JSON.parse(storage.getItem(PREFS_KEY) ?? '{}') as LibraryPrefs
    assert.deepEqual(stored.filtersByTab, {})
    assert.deepEqual(getLibraryPrefs().filtersByTab, {})
  } finally {
    restoreStorage()
  }
})

/* ----------------------- localStorage 不可用降级测试 ----------------------- */

test('localStorage setItem 抛异常（配额满）时 patchLibraryPrefs 不抛并返回规范化结果', () => {
  const store = new Map<string, string>()
  setupStorage({
    getItem: (key) => store.get(key) ?? null,
    setItem: () => {
      throw new Error('QuotaExceededError')
    },
    removeItem: (key) => {
      store.delete(key)
    },
    clear: () => {
      store.clear()
    },
  })
  try {
    const result = patchLibraryPrefs({ activeTab: 'works', searchQuery: '测试' })
    // 写入失败但返回值仍是规范化后的最新偏好，调用方无需感知失败
    assert.equal(result.activeTab, 'works')
    assert.equal(result.searchQuery, '测试')
  } finally {
    restoreStorage()
  }
})

test('localStorage 完全不可用时 getLibraryPrefs 返回默认且 patchLibraryPrefs 不抛', () => {
  // 显式删除 localStorage 模拟非浏览器环境
  delete (globalThis as { localStorage?: StorageLike }).localStorage
  try {
    const prefs = getLibraryPrefs()
    assert.equal(prefs.activeTab, 'characters')
    assert.deepEqual(prefs.filtersByTab, {})
    const result = patchLibraryPrefs({ activeTab: 'moments' })
    assert.equal(result.activeTab, 'moments')
  } finally {
    restoreStorage()
  }
})
