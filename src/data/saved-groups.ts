// 收藏分组本地存储：把自定义分组、收藏→分组的归属关系和当前筛选的分组
// 持久化到 localStorage，让收藏列表可以按项目组织方案。
//
// 设计要点（与 library-prefs.ts 同模式）：
// - 业务规则集中在纯函数内（读取 + 规范化 + 写入），不依赖 DOM，可在 Node 环境单测
// - 收藏方案本身仍存于 linggan-saved-remixes（store.js），分组只是叠加在其上的
//   组织信息：删除分组绝不删除收藏，只把成员退回"未分组"
// - 严格规范化降级：损坏 JSON、非法结构、悬空引用（指向已删除分组）一律清洗，
//   保证损坏数据不阻塞收藏列表渲染
// - localStorage 不可用（隐私模式 / 配额满）时静默降级，不影响交互

const SAVED_GROUPS_KEY = 'linggan-saved-groups'

/** activeGroupId 的特殊值：筛选"未分组"（不属于任何自定义分组的收藏） */
export const UNGROUPED_ID = '__ungrouped__'

/** 分组数量与名称上限：收藏列表单页最多 8 条，分组是轻量组织手段而非目录系统 */
export const MAX_GROUPS = 10
export const MAX_GROUP_NAME_LENGTH = 16

export interface SavedGroup {
  id: string
  name: string
  createdAt: string
}

/** savedId → groupId 的归属表；没有条目即"未分组" */
export type SavedAssignments = Record<string, string>

export interface SavedGroupsPrefs {
  groups: SavedGroup[]
  assignments: SavedAssignments
  /** null = 全部；UNGROUPED_ID = 未分组；其余为分组 id */
  activeGroupId: string | null
}

/** 分组归属操作只需收藏拥有稳定 id，不依赖完整 SavedItem 结构 */
export interface SavedLike {
  id: string
}

/** 分组创建 / 重命名的失败原因，由 UI 层映射为用户可读文案 */
export type GroupOpError = 'invalid_name' | 'duplicate_name' | 'too_many_groups' | 'group_not_found'
export type GroupOpResult = { ok: true; prefs: SavedGroupsPrefs } | { ok: false; error: GroupOpError }

const createDefaultPrefs = (): SavedGroupsPrefs => ({
  groups: [],
  assignments: {},
  activeGroupId: null,
})

/** 生成稳定分组 id：时间戳 + 随机后缀，同毫秒创建的分组也不冲突 */
export const createGroupId = (): string =>
  `grp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

/**
 * 规范化分组名：去除首尾空白、超长截断（与输入框 maxLength 一致）。
 * 空名或纯空白返回 null（调用方据此拒绝创建/重命名）。
 */
export const normalizeGroupName = (input: unknown): string | null => {
  if (typeof input !== 'string') return null
  const name = input.trim()
  if (!name) return null
  return name.length > MAX_GROUP_NAME_LENGTH ? name.slice(0, MAX_GROUP_NAME_LENGTH) : name
}

// 规范化分组数组：逐项校验 id/name，非法条目丢弃、重复 id 保留首个、超上限截断
const sanitizeGroups = (value: unknown): SavedGroup[] => {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const groups: SavedGroup[] = []
  for (const raw of value) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue
    const { id, name, createdAt } = raw as Record<string, unknown>
    if (typeof id !== 'string' || !id || seen.has(id)) continue
    const normalizedName = normalizeGroupName(name)
    if (!normalizedName) continue
    seen.add(id)
    groups.push({
      id,
      name: normalizedName,
      createdAt: typeof createdAt === 'string' ? createdAt : '',
    })
    if (groups.length >= MAX_GROUPS) break
  }
  return groups
}

// 规范化归属表：只保留"值指向现存分组"的条目，悬空引用直接清除（收藏退回未分组）
const sanitizeAssignments = (value: unknown, groupIds: ReadonlySet<string>): SavedAssignments => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const assignments: SavedAssignments = {}
  for (const [savedId, groupId] of Object.entries(value as Record<string, unknown>)) {
    if (savedId && typeof groupId === 'string' && groupIds.has(groupId)) {
      assignments[savedId] = groupId
    }
  }
  return assignments
}

// 规范化任意已解析数据为合法 SavedGroupsPrefs；所有非法部分降级为默认值
const sanitizePrefs = (value: unknown): SavedGroupsPrefs => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return createDefaultPrefs()
  const raw = value as Record<string, unknown>
  const prefs = createDefaultPrefs()
  prefs.groups = sanitizeGroups(raw.groups)
  const groupIds = new Set(prefs.groups.map((group) => group.id))
  prefs.assignments = sanitizeAssignments(raw.assignments, groupIds)
  const active = raw.activeGroupId
  if (typeof active === 'string' && (active === UNGROUPED_ID || groupIds.has(active))) {
    prefs.activeGroupId = active
  }
  return prefs
}

/**
 * 读取并规范化收藏分组；localStorage 缺失或数据损坏时返回默认值。
 * 检测到持久化内容含非法或悬空部分（清洗改变了数据）时同步写回，
 * 保证坏数据不跨刷新存活——与 library-prefs 的"清洗即写回"语义一致。
 * 数据规模小（≤10 分组 + ≤8 归属），序列化对比成本可忽略。
 */
export const getSavedGroupsPrefs = (): SavedGroupsPrefs => {
  let raw: string | null = null
  let parsed: unknown
  try {
    raw = localStorage.getItem(SAVED_GROUPS_KEY)
    parsed = raw ? (JSON.parse(raw) as unknown) : undefined
  } catch {
    // localStorage 未定义（非浏览器环境）或 JSON 损坏时降级为默认值
    return createDefaultPrefs()
  }
  const prefs = parsed === undefined ? createDefaultPrefs() : sanitizePrefs(parsed)
  if (JSON.stringify(prefs) !== raw) {
    try {
      localStorage.setItem(SAVED_GROUPS_KEY, JSON.stringify(prefs))
    } catch {
      // 写入失败（隐私模式/配额满）静默降级：内存中仍使用清洗后的状态
    }
  }
  return prefs
}

/**
 * 局部更新收藏分组并持久化（浅合并语义）。
 * 隐私模式或配额满导致写入失败时静默降级，返回值仍为规范化后的最新分组状态。
 */
export const patchSavedGroupsPrefs = (partial: Partial<SavedGroupsPrefs>): SavedGroupsPrefs => {
  const next = sanitizePrefs({ ...getSavedGroupsPrefs(), ...partial })
  try {
    localStorage.setItem(SAVED_GROUPS_KEY, JSON.stringify(next))
  } catch {
    // 静默降级：分组丢失但不阻塞收藏交互
  }
  return next
}

/** 创建分组：追加到列表末尾；名称非法、同名或超上限时返回失败原因 */
export const withNewGroup = (prefs: SavedGroupsPrefs, name: unknown): GroupOpResult => {
  const normalizedName = normalizeGroupName(name)
  if (!normalizedName) return { ok: false, error: 'invalid_name' }
  if (prefs.groups.length >= MAX_GROUPS) return { ok: false, error: 'too_many_groups' }
  if (prefs.groups.some((group) => group.name === normalizedName)) {
    return { ok: false, error: 'duplicate_name' }
  }
  return {
    ok: true,
    prefs: {
      ...prefs,
      groups: [
        ...prefs.groups,
        { id: createGroupId(), name: normalizedName, createdAt: new Date().toISOString() },
      ],
    },
  }
}

/** 重命名分组：id 与归属保持不变；名称非法、分组不存在或与其他分组同名时失败 */
export const withRenamedGroup = (
  prefs: SavedGroupsPrefs,
  groupId: string,
  name: unknown,
): GroupOpResult => {
  const normalizedName = normalizeGroupName(name)
  if (!normalizedName) return { ok: false, error: 'invalid_name' }
  if (!prefs.groups.some((group) => group.id === groupId)) {
    return { ok: false, error: 'group_not_found' }
  }
  if (prefs.groups.some((group) => group.name === normalizedName && group.id !== groupId)) {
    return { ok: false, error: 'duplicate_name' }
  }
  return {
    ok: true,
    prefs: {
      ...prefs,
      groups: prefs.groups.map((group) =>
        group.id === groupId ? { ...group, name: normalizedName } : group,
      ),
    },
  }
}

/** 删除分组：成员自动退回未分组（收藏本身不受影响）；当前筛选若正指向该分组则回到全部 */
export const withoutGroup = (prefs: SavedGroupsPrefs, groupId: string): SavedGroupsPrefs => ({
  ...prefs,
  groups: prefs.groups.filter((group) => group.id !== groupId),
  assignments: Object.fromEntries(
    Object.entries(prefs.assignments).filter(([, assignedGroupId]) => assignedGroupId !== groupId),
  ),
  activeGroupId: prefs.activeGroupId === groupId ? null : prefs.activeGroupId,
})

/** 移动收藏到分组：groupId 为 null 或指向不存在的分组时视为移回未分组（删除归属条目） */
export const withAssignment = (
  prefs: SavedGroupsPrefs,
  savedId: string,
  groupId: string | null,
): SavedGroupsPrefs => {
  const validGroupId =
    typeof groupId === 'string' && prefs.groups.some((group) => group.id === groupId)
      ? groupId
      : null
  const assignments = { ...prefs.assignments }
  if (validGroupId) assignments[savedId] = validGroupId
  else delete assignments[savedId]
  return { ...prefs, assignments }
}

/**
 * 清理悬空归属：收藏列表上限 8 条自动淘汰最旧，被淘汰方案的归属条目随之失去意义。
 * 无悬空时返回原对象引用（不为"没变化"制造新拷贝）。
 */
export const withoutStaleAssignments = (
  prefs: SavedGroupsPrefs,
  savedIds: readonly string[],
): SavedGroupsPrefs => {
  const alive = new Set(savedIds)
  const entries = Object.entries(prefs.assignments).filter(([savedId]) => alive.has(savedId))
  if (entries.length === Object.keys(prefs.assignments).length) return prefs
  return { ...prefs, assignments: Object.fromEntries(entries) }
}

/** 按当前筛选分组过滤收藏列表：null = 全部；UNGROUPED_ID = 未分组；其余 = 指定分组 */
export const filterSavedByGroup = <T extends SavedLike>(
  saved: readonly T[],
  prefs: SavedGroupsPrefs,
  activeGroupId: string | null,
): T[] => {
  if (activeGroupId === null) return saved as T[]
  if (activeGroupId === UNGROUPED_ID) {
    return saved.filter((item) => !prefs.assignments[item.id])
  }
  return saved.filter((item) => prefs.assignments[item.id] === activeGroupId)
}

/** 统计各筛选位的收藏数（全部 / 未分组 / 每个分组），供分组条 chip 展示 */
export const countSavedByGroup = (
  saved: readonly SavedLike[],
  prefs: SavedGroupsPrefs,
): { all: number; ungrouped: number; byGroup: Record<string, number> } => {
  const byGroup: Record<string, number> = {}
  for (const group of prefs.groups) byGroup[group.id] = 0
  let ungrouped = 0
  for (const item of saved) {
    const groupId = prefs.assignments[item.id]
    if (groupId && groupId in byGroup) byGroup[groupId] += 1
    else ungrouped += 1
  }
  return { all: saved.length, ungrouped, byGroup }
}
