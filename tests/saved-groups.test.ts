import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  getSavedGroupsPrefs,
  patchSavedGroupsPrefs,
  withNewGroup,
  withRenamedGroup,
  withoutGroup,
  withAssignment,
  withoutStaleAssignments,
  filterSavedByGroup,
  countSavedByGroup,
  normalizeGroupName,
  createGroupId,
  UNGROUPED_ID,
  MAX_GROUPS,
  MAX_GROUP_NAME_LENGTH,
} from '../src/data/saved-groups.ts'
import type { SavedGroupsPrefs, SavedGroup } from '../src/data/saved-groups.ts'

/** Node 测试环境模拟 localStorage 所需的最小接口 */
interface StorageLike {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
  clear: () => void
}

/* ----------------------- localStorage mock ----------------------- */
// Node 测试环境无 localStorage，用内存 Map 模拟浏览器存储（与 library-prefs.test.ts 同模式）

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

const PREFS_KEY = 'linggan-saved-groups'

// 构造一个已存在的分组，便于归属 / 删除 / 筛选测试复用
const makeGroup = (id: string, name: string): SavedGroup => ({
  id,
  name,
  createdAt: '2026-08-29T00:00:00.000Z',
})

// 以指定分组 + 归属构造完整 prefs（绕开 withNewGroup 的随机 id，保证测试确定）
const makePrefs = (
  groups: SavedGroup[],
  assignments: Record<string, string> = {},
  activeGroupId: string | null = null,
): SavedGroupsPrefs => ({ groups, assignments, activeGroupId })

/* ----------------------- 基础读写测试 ----------------------- */

test('空 localStorage 时 getSavedGroupsPrefs 返回默认分组状态', () => {
  setupStorage(createMemoryStorage())
  try {
    const prefs = getSavedGroupsPrefs()
    assert.deepEqual(prefs.groups, [])
    assert.deepEqual(prefs.assignments, {})
    assert.equal(prefs.activeGroupId, null)
  } finally {
    restoreStorage()
  }
})

test('创建分组 + 归属 + 筛选后 roundtrip 恢复完整分组状态', () => {
  setupStorage(createMemoryStorage())
  try {
    const created = withNewGroup(getSavedGroupsPrefs(), '项目灵感')
    assert.ok(created.ok)
    patchSavedGroupsPrefs(created.prefs)
    const groupId = created.prefs.groups[0].id
    patchSavedGroupsPrefs(withAssignment(getSavedGroupsPrefs(), 'plan_a', groupId))
    patchSavedGroupsPrefs({ activeGroupId: groupId })
    const prefs = getSavedGroupsPrefs()
    assert.equal(prefs.groups.length, 1)
    assert.equal(prefs.groups[0].name, '项目灵感')
    assert.equal(prefs.assignments.plan_a, groupId)
    assert.equal(prefs.activeGroupId, groupId)
  } finally {
    restoreStorage()
  }
})

test('createGroupId 生成稳定格式且连续调用不重复', () => {
  const ids = new Set(Array.from({ length: 50 }, () => createGroupId()))
  assert.equal(ids.size, 50)
  for (const id of ids) assert.match(id, /^grp_[a-z0-9]+_[a-z0-9]+$/)
})

/* ----------------------- 名称规范化测试 ----------------------- */

test('normalizeGroupName 去除空白、超长截断、非法输入返回 null', () => {
  assert.equal(normalizeGroupName('  项目灵感  '), '项目灵感')
  assert.equal(normalizeGroupName('a'.repeat(30)), 'a'.repeat(MAX_GROUP_NAME_LENGTH))
  assert.equal(normalizeGroupName('   '), null)
  assert.equal(normalizeGroupName(''), null)
  assert.equal(normalizeGroupName(42), null)
  assert.equal(normalizeGroupName(null), null)
})

/* ----------------------- 创建分组测试 ----------------------- */

test('withNewGroup 拒绝空名 / 纯空白 / 非字符串名称', () => {
  const prefs = makePrefs([])
  for (const bad of ['', '   ', 42, null]) {
    const result = withNewGroup(prefs, bad)
    assert.ok(!result.ok && result.error === 'invalid_name')
  }
})

test('withNewGroup 拒绝与现有分组同名', () => {
  const prefs = makePrefs([makeGroup('g1', '项目灵感')])
  const result = withNewGroup(prefs, ' 项目灵感 ')
  assert.ok(!result.ok && result.error === 'duplicate_name')
})

test('withNewGroup 达到上限后拒绝继续创建', () => {
  const prefs = makePrefs(Array.from({ length: MAX_GROUPS }, (_, i) => makeGroup(`g${i}`, `分组${i}`)))
  const result = withNewGroup(prefs, '新分组')
  assert.ok(!result.ok && result.error === 'too_many_groups')
})

test('withNewGroup 成功时追加分组且不改动归属与筛选', () => {
  const prefs = makePrefs([makeGroup('g1', '甲组')], { plan_a: 'g1' }, 'g1')
  const result = withNewGroup(prefs, '乙组')
  assert.ok(result.ok)
  assert.equal(result.prefs.groups.length, 2)
  assert.equal(result.prefs.groups[1].name, '乙组')
  assert.ok(result.prefs.groups[1].id)
  assert.equal(result.prefs.assignments.plan_a, 'g1')
  assert.equal(result.prefs.activeGroupId, 'g1')
  // 原 prefs 不被修改（纯函数）
  assert.equal(prefs.groups.length, 1)
})

/* ----------------------- 重命名分组测试 ----------------------- */

test('withRenamedGroup 分组不存在时失败', () => {
  const result = withRenamedGroup(makePrefs([makeGroup('g1', '甲组')]), 'g_missing', '新名')
  assert.ok(!result.ok && result.error === 'group_not_found')
})

test('withRenamedGroup 拒绝改成其他分组的同名', () => {
  const prefs = makePrefs([makeGroup('g1', '甲组'), makeGroup('g2', '乙组')])
  const result = withRenamedGroup(prefs, 'g1', '乙组')
  assert.ok(!result.ok && result.error === 'duplicate_name')
})

test('withRenamedGroup 成功时保持 id 与归属不变', () => {
  const prefs = makePrefs([makeGroup('g1', '甲组'), makeGroup('g2', '乙组')], { plan_a: 'g1' })
  const result = withRenamedGroup(prefs, 'g1', '项目灵感')
  assert.ok(result.ok)
  assert.equal(result.prefs.groups[0].id, 'g1')
  assert.equal(result.prefs.groups[0].name, '项目灵感')
  assert.equal(result.prefs.assignments.plan_a, 'g1')
})

/* ----------------------- 删除分组测试 ----------------------- */

test('withoutGroup 删除分组后成员退回未分组、其他分组不受影响', () => {
  const prefs = makePrefs(
    [makeGroup('g1', '甲组'), makeGroup('g2', '乙组')],
    { plan_a: 'g1', plan_b: 'g1', plan_c: 'g2' },
    'g2',
  )
  const next = withoutGroup(prefs, 'g1')
  assert.equal(next.groups.length, 1)
  assert.equal(next.groups[0].id, 'g2')
  assert.deepEqual(next.assignments, { plan_c: 'g2' })
  // 筛选指向未删除的分组时保持不变
  assert.equal(next.activeGroupId, 'g2')
})

test('withoutGroup 当前筛选正指向被删分组时重置为全部', () => {
  const prefs = makePrefs([makeGroup('g1', '甲组')], { plan_a: 'g1' }, 'g1')
  const next = withoutGroup(prefs, 'g1')
  assert.deepEqual(next.groups, [])
  assert.deepEqual(next.assignments, {})
  assert.equal(next.activeGroupId, null)
})

/* ----------------------- 归属操作测试 ----------------------- */

test('withAssignment 写入归属后未分组筛选不再包含该收藏', () => {
  const prefs = makePrefs([makeGroup('g1', '甲组')])
  const assigned = withAssignment(prefs, 'plan_a', 'g1')
  assert.equal(assigned.assignments.plan_a, 'g1')
  assert.equal(assigned.assignments.plan_a, 'g1')
  // null 与不存在的分组 id 都视为移回未分组
  assert.deepEqual(withAssignment(assigned, 'plan_a', null).assignments, {})
  assert.deepEqual(withAssignment(assigned, 'plan_a', 'g_missing').assignments, {})
})

test('withAssignment 幂等：重复归属同一分组结果一致', () => {
  const prefs = makePrefs([makeGroup('g1', '甲组')])
  const once = withAssignment(prefs, 'plan_a', 'g1')
  const twice = withAssignment(once, 'plan_a', 'g1')
  assert.deepEqual(once.assignments, twice.assignments)
})

/* ----------------------- 悬空归属清理测试 ----------------------- */

test('withoutStaleAssignments 清除已不存在收藏的归属', () => {
  const prefs = makePrefs([makeGroup('g1', '甲组')], { plan_a: 'g1', plan_dead: 'g1' })
  const next = withoutStaleAssignments(prefs, ['plan_a'])
  assert.deepEqual(next.assignments, { plan_a: 'g1' })
})

test('withoutStaleAssignments 无悬空时返回原对象引用（不制造拷贝）', () => {
  const prefs = makePrefs([makeGroup('g1', '甲组')], { plan_a: 'g1' })
  assert.equal(withoutStaleAssignments(prefs, ['plan_a']), prefs)
})

/* ----------------------- 筛选与统计测试 ----------------------- */

test('filterSavedByGroup 按 null / 未分组 / 指定分组过滤', () => {
  const prefs = makePrefs([makeGroup('g1', '甲组')], { plan_a: 'g1' })
  const saved = [{ id: 'plan_a' }, { id: 'plan_b' }, { id: 'plan_c' }]
  assert.deepEqual(
    filterSavedByGroup(saved, prefs, null).map((item) => item.id),
    ['plan_a', 'plan_b', 'plan_c'],
  )
  assert.deepEqual(
    filterSavedByGroup(saved, prefs, UNGROUPED_ID).map((item) => item.id),
    ['plan_b', 'plan_c'],
  )
  assert.deepEqual(
    filterSavedByGroup(saved, prefs, 'g1').map((item) => item.id),
    ['plan_a'],
  )
})

test('countSavedByGroup 统计全部 / 未分组 / 各分组数量', () => {
  const prefs = makePrefs([makeGroup('g1', '甲组'), makeGroup('g2', '乙组')], {
    plan_a: 'g1',
    plan_b: 'g1',
    plan_c: 'g2',
  })
  const saved = [{ id: 'plan_a' }, { id: 'plan_b' }, { id: 'plan_c' }, { id: 'plan_d' }]
  const counts = countSavedByGroup(saved, prefs)
  assert.equal(counts.all, 4)
  assert.equal(counts.ungrouped, 1)
  assert.deepEqual(counts.byGroup, { g1: 2, g2: 1 })
})

/* ----------------------- 损坏数据降级测试 ----------------------- */

test('localStorage 中损坏 JSON 时降级为默认分组状态', () => {
  const storage = createMemoryStorage()
  setupStorage(storage)
  try {
    storage.setItem(PREFS_KEY, '{invalid json')
    const prefs = getSavedGroupsPrefs()
    assert.deepEqual(prefs.groups, [])
    assert.deepEqual(prefs.assignments, {})
    assert.equal(prefs.activeGroupId, null)
  } finally {
    restoreStorage()
  }
})

test('localStorage 中顶层非对象（数组 / 字符串 / null）时降级为默认', () => {
  const storage = createMemoryStorage()
  setupStorage(storage)
  try {
    for (const bad of ['[]', '"g1"', 'null', '42']) {
      storage.setItem(PREFS_KEY, bad)
      const prefs = getSavedGroupsPrefs()
      assert.deepEqual(prefs.groups, [])
      assert.deepEqual(prefs.assignments, {})
      assert.equal(prefs.activeGroupId, null)
    }
  } finally {
    restoreStorage()
  }
})

test('groups 中非法条目（缺 id / 空名 / 非对象）被丢弃，重复 id 保留首个', () => {
  const storage = createMemoryStorage()
  setupStorage(storage)
  try {
    storage.setItem(
      PREFS_KEY,
      JSON.stringify({
        groups: [
          makeGroup('g1', '甲组'),
          { name: '缺id' },
          { id: 'g2', name: '   ' },
          'not-an-object',
          makeGroup('g1', '重复id应被丢弃'),
          makeGroup('g3', '丙组'),
        ],
      }),
    )
    const prefs = getSavedGroupsPrefs()
    assert.equal(prefs.groups.length, 2)
    assert.equal(prefs.groups[0].id, 'g1')
    assert.equal(prefs.groups[0].name, '甲组')
    assert.equal(prefs.groups[1].id, 'g3')
  } finally {
    restoreStorage()
  }
})

test('groups 超过上限时读取只保留前 MAX_GROUPS 个', () => {
  const storage = createMemoryStorage()
  setupStorage(storage)
  try {
    const groups = Array.from({ length: MAX_GROUPS + 5 }, (_, i) => makeGroup(`g${i}`, `分组${i}`))
    storage.setItem(PREFS_KEY, JSON.stringify({ groups }))
    assert.equal(getSavedGroupsPrefs().groups.length, MAX_GROUPS)
  } finally {
    restoreStorage()
  }
})

test('assignments 中指向不存在分组的悬空归属被清除', () => {
  const storage = createMemoryStorage()
  setupStorage(storage)
  try {
    storage.setItem(
      PREFS_KEY,
      JSON.stringify({
        groups: [makeGroup('g1', '甲组')],
        assignments: { plan_a: 'g1', plan_b: 'g_dead', plan_c: 42 },
      }),
    )
    const prefs = getSavedGroupsPrefs()
    assert.deepEqual(prefs.assignments, { plan_a: 'g1' })
  } finally {
    restoreStorage()
  }
})

test('activeGroupId 悬空（分组已删）降级为 null，UNGROUPED_ID 合法保留', () => {
  const storage = createMemoryStorage()
  setupStorage(storage)
  try {
    storage.setItem(PREFS_KEY, JSON.stringify({ groups: [makeGroup('g1', '甲组')], activeGroupId: 'g_dead' }))
    assert.equal(getSavedGroupsPrefs().activeGroupId, null)
    storage.setItem(PREFS_KEY, JSON.stringify({ groups: [makeGroup('g1', '甲组')], activeGroupId: UNGROUPED_ID }))
    assert.equal(getSavedGroupsPrefs().activeGroupId, UNGROUPED_ID)
  } finally {
    restoreStorage()
  }
})

/* ----------------------- 清洗写回测试 ----------------------- */

test('悬空归属读取时被清洗并写回 localStorage（坏数据不跨刷新存活）', () => {
  const storage = createMemoryStorage()
  setupStorage(storage)
  try {
    storage.setItem(PREFS_KEY, JSON.stringify({ groups: [makeGroup('g1', '甲组')], assignments: { plan_a: 'g_dead' } }))
    const prefs = getSavedGroupsPrefs()
    assert.deepEqual(prefs.assignments, {})
    // 清洗结果已写回持久化，外部直接读取 localStorage 不再看到悬空归属
    assert.deepEqual(JSON.parse(storage.getItem(PREFS_KEY) as string).assignments, {})
  } finally {
    restoreStorage()
  }
})

test('合法数据读取不触发多余写回', () => {
  const storage = createMemoryStorage()
  setupStorage(storage)
  try {
    // 先由 patch 产出合法持久化内容（键序与 sanitize 输出一致）
    const created = withNewGroup(getSavedGroupsPrefs(), '甲组')
    assert.ok(created.ok)
    patchSavedGroupsPrefs(created.prefs)
    const persisted = storage.getItem(PREFS_KEY) as string
    // 换成计数存储注入同样内容：读取合法数据不应产生 setItem
    let writes = 0
    setupStorage({
      getItem: (key) => (key === PREFS_KEY ? persisted : null),
      setItem: () => {
        writes += 1
      },
      removeItem: () => {},
      clear: () => {},
    })
    getSavedGroupsPrefs()
    assert.equal(writes, 0)
  } finally {
    restoreStorage()
  }
})

/* ----------------------- localStorage 不可用降级测试 ----------------------- */

test('localStorage setItem 抛异常（配额满）时 patchSavedGroupsPrefs 不抛并返回规范化结果', () => {
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
    const result = patchSavedGroupsPrefs({ activeGroupId: UNGROUPED_ID })
    // 写入失败但返回值仍是规范化后的最新分组状态，调用方无需感知失败
    assert.equal(result.activeGroupId, UNGROUPED_ID)
  } finally {
    restoreStorage()
  }
})

test('localStorage 完全不可用时 getSavedGroupsPrefs 返回默认且 patch 不抛', () => {
  // 显式删除 localStorage 模拟非浏览器环境
  delete (globalThis as { localStorage?: StorageLike }).localStorage
  try {
    const prefs = getSavedGroupsPrefs()
    assert.deepEqual(prefs.groups, [])
    const created = withNewGroup(prefs, '甲组')
    assert.ok(created.ok)
    const result = patchSavedGroupsPrefs(created.prefs)
    assert.equal(result.groups.length, 1)
  } finally {
    restoreStorage()
  }
})
