// 素材库偏好本地存储：把 activeTab / 搜索词 / 每个 tab 的筛选状态持久化到 localStorage，
// 用户刷新或重进页面后自动恢复，不再需要重新点选筛选条件。
//
// 设计要点（与 history.ts 同模式）：
// - 业务规则集中在纯函数内（读取 + 规范化 + 写入），不依赖 DOM，可在 Node 环境单测
// - 严格规范化降级：损坏 JSON、非对象、非法 tab、非字符串数组等一律降级为默认值，
//   保证损坏数据不阻塞素材库渲染
// - 筛选按 tab 分开存储（filtersByTab）：不同 tab 的维度 key 不同，
//   混用会导致"幽灵筛选"过滤出空结果；分开存储也让切换 tab 再切回时筛选不丢失
// - localStorage 不可用（隐私模式 / 配额满）时静默降级，不影响交互

const PREFS_KEY = 'linggan-library-prefs'

/** 素材库合法 tab 集合；activeTab 只接受这三个值 */
export const LIBRARY_TABS = ['characters', 'moments', 'works'] as const
export type LibraryTab = (typeof LIBRARY_TABS)[number]

/** 一个 tab 的筛选状态：维度名 → 选中的值列表（与 library/filter.ts 的 LibraryFilters 同构） */
export type LibraryFilters = Record<string, string[]>

/** 素材库需要跨会话保留的全部偏好 */
export interface LibraryPrefs {
  activeTab: LibraryTab
  searchQuery: string
  filtersByTab: Record<string, LibraryFilters>
}

const createDefaultPrefs = (): LibraryPrefs => ({
  activeTab: 'characters',
  searchQuery: '',
  filtersByTab: {},
})

// 判断一个值是否为纯字符串数组（筛选维度的合法值类型）
const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')

// 规范化单个 tab 的筛选：只保留值为非空字符串数组的维度，空数组维度视为无筛选直接丢弃
const sanitizeFilters = (value: unknown): LibraryFilters => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const result: LibraryFilters = {}
  for (const [dimension, selected] of Object.entries(value as Record<string, unknown>)) {
    if (isStringArray(selected) && selected.length > 0) {
      result[dimension] = selected
    }
  }
  return result
}

// 规范化任意已解析数据为合法 LibraryPrefs；所有非法部分降级为默认值
const sanitizePrefs = (value: unknown): LibraryPrefs => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return createDefaultPrefs()
  const raw = value as Record<string, unknown>
  const prefs = createDefaultPrefs()
  if (typeof raw.activeTab === 'string' && (LIBRARY_TABS as readonly string[]).includes(raw.activeTab)) {
    prefs.activeTab = raw.activeTab as LibraryTab
  }
  if (typeof raw.searchQuery === 'string') {
    prefs.searchQuery = raw.searchQuery
  }
  if (raw.filtersByTab && typeof raw.filtersByTab === 'object' && !Array.isArray(raw.filtersByTab)) {
    for (const [tab, filters] of Object.entries(raw.filtersByTab as Record<string, unknown>)) {
      // 只保留合法 tab 的筛选；空筛选不写键，保持持久化 JSON 干净
      if ((LIBRARY_TABS as readonly string[]).includes(tab)) {
        const sanitized = sanitizeFilters(filters)
        if (Object.keys(sanitized).length > 0) {
          prefs.filtersByTab[tab] = sanitized
        }
      }
    }
  }
  return prefs
}

/** 读取并规范化素材库偏好；localStorage 缺失或数据损坏时返回默认值 */
export const getLibraryPrefs = (): LibraryPrefs => {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return createDefaultPrefs()
    return sanitizePrefs(JSON.parse(raw) as unknown)
  } catch {
    // localStorage 未定义（非浏览器环境）或 JSON 损坏时降级
    return createDefaultPrefs()
  }
}

/**
 * 局部更新素材库偏好并持久化（浅合并语义，filtersByTab 整体替换）。
 * 隐私模式或配额满导致写入失败时静默降级，返回值仍为规范化后的最新偏好。
 */
export const patchLibraryPrefs = (partial: Partial<LibraryPrefs>): LibraryPrefs => {
  const next = sanitizePrefs({ ...getLibraryPrefs(), ...partial })
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(next))
  } catch {
    // 静默降级：偏好丢失但不阻塞筛选交互
  }
  return next
}
