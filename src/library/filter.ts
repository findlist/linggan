/**
 * 素材库多维度组合筛选纯函数。
 * 把筛选业务规则（文本搜索 + 多维度 AND/OR 组合）与 UI 渲染分离，
 * 便于在 Node 环境单测，避免依赖 DOM。
 */

/** 可被筛选的素材项。fields 把每个维度的值统一成数组，单值字段也用数组表示。 */
export type FilterableItem = {
  id: string
  /** 各筛选维度的值集合，键为维度名（如 type/work/rights），值为该维度上的取值数组 */
  fields: Record<string, string[]>
  /** 用于文本搜索的可索引字符串，由标题/元数据/正文/标签等拼接后小写化 */
  searchableText: string
}

/** 筛选状态：维度名 → 选中的值列表。选中值为空数组表示该维度不参与筛选。 */
export type LibraryFilters = Record<string, string[]>

/**
 * 按文本搜索 + 多维度组合筛选素材。
 * 文本搜索与所有维度之间为 AND；同一维度内多个选中值为 OR（任一命中即可）；
 * 不同维度之间为 AND。这样符合"在角色类型为 X 或 Y，且作品为 Z 中查找含关键词的素材"的直觉。
 */
export const filterLibraryItems = (
  items: FilterableItem[],
  filters: LibraryFilters,
  query: string
): FilterableItem[] => {
  const q = query.trim().toLowerCase()
  return items.filter(item => {
    // 文本搜索：query 为空时跳过；非空时要求可索引文本包含 query
    if (q && !item.searchableText.includes(q)) return false
    // 逐维度判断：选中值非空时，素材该维度的值集合必须与选中值有交集
    for (const [dimension, selected] of Object.entries(filters)) {
      if (selected.length === 0) continue
      const itemValues = item.fields[dimension] ?? []
      // 同维度 OR：素材只要命中任意一个选中值即通过该维度
      if (!selected.some(value => itemValues.includes(value))) return false
    }
    return true
  })
}

/**
 * 从一批素材中收集某维度的所有可选值，去重并按字典序排序。
 * 用于动态生成筛选器选项，避免出现"选了却无结果"的死选项。
 */
export const collectFilterOptions = (
  items: FilterableItem[],
  dimension: string
): string[] => {
  const set = new Set<string>()
  for (const item of items) {
    const values = item.fields[dimension] ?? []
    for (const value of values) set.add(value)
  }
  return Array.from(set).sort()
}
