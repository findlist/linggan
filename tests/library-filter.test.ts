import { test } from 'node:test'
import assert from 'node:assert/strict'
import { filterLibraryItems, collectFilterOptions } from '../src/library/filter.ts'
import type { FilterableItem } from '../src/library/filter.ts'

// 构造一组模拟素材，覆盖角色/名场面/作品三类语义，用于验证筛选逻辑
const items: FilterableItem[] = [
  {
    id: 'char_a',
    fields: { type: ['热血追梦者', '关系修复者'], work: ['火影忍者'], rights: ['reference_only'] },
    searchableText: '鸣人 火影忍者 热血追梦者 漩涡鸣人'.toLowerCase()
  },
  {
    id: 'char_b',
    fields: { type: ['守序型掌权者', '隐忍反派'], work: ['甄嬛传'], rights: ['reference_only'] },
    searchableText: '宜修皇后 甄嬛传 守序型掌权者'.toLowerCase()
  },
  {
    id: 'char_c',
    fields: { type: ['热血追梦者'], work: ['火影忍者'], rights: ['reference_only'] },
    searchableText: '佐助 火影忍者 热血追梦者 宇智波'.toLowerCase()
  },
  {
    id: 'moment_a',
    fields: { conflict: ['救援压力与强攻代价'], emotion: ['紧张', '决断'], work: ['亮剑'] },
    searchableText: '限时集结攻坚 亮剑 救援压力'.toLowerCase()
  },
  {
    id: 'moment_b',
    fields: { conflict: ['强者退场与传承'], emotion: ['悲壮', '释然'], work: ['咒术回战'] },
    searchableText: '强者退场 咒术回战 传承'.toLowerCase()
  },
  {
    id: 'work_a',
    fields: { media: ['anime'], genre: ['冒险', '成长'], rights: ['reference_only'] },
    searchableText: '火影忍者 anime 冒险 成长'.toLowerCase()
  },
  {
    id: 'work_b',
    fields: { media: ['film'], genre: ['科幻', '动作'], rights: ['reference_only'] },
    searchableText: '黑客帝国 film 科幻 动作'.toLowerCase()
  }
]

test('empty filters and empty query return all items', () => {
  const result = filterLibraryItems(items, {}, '')
  assert.equal(result.length, items.length)
})

test('text search matches searchableText case-insensitively', () => {
  const result = filterLibraryItems(items, {}, '火影')
  assert.equal(result.length, 3)
  assert.ok(result.every(item => item.id.startsWith('char_') ? item.id !== 'char_b' : item.id === 'work_a'))
})

test('single dimension filter keeps only items matching selected value', () => {
  const result = filterLibraryItems(items, { type: ['热血追梦者'] }, '')
  assert.deepEqual(result.map(r => r.id).sort(), ['char_a', 'char_c'])
})

test('same dimension multiple selected values use OR semantics', () => {
  // 角色类型为"热血追梦者"或"隐忍反派"：命中 char_a / char_b / char_c
  const result = filterLibraryItems(items, { type: ['热血追梦者', '隐忍反派'] }, '')
  assert.deepEqual(result.map(r => r.id).sort(), ['char_a', 'char_b', 'char_c'])
})

test('cross-dimension filters use AND semantics', () => {
  // 角色类型为"热血追梦者" 且 作品为"甄嬛传"：无匹配
  const result = filterLibraryItems(items, { type: ['热血追梦者'], work: ['甄嬛传'] }, '')
  assert.equal(result.length, 0)
  // 角色类型为"热血追梦者" 且 作品为"火影忍者"：char_a / char_c
  const result2 = filterLibraryItems(items, { type: ['热血追梦者'], work: ['火影忍者'] }, '')
  assert.deepEqual(result2.map(r => r.id).sort(), ['char_a', 'char_c'])
})

test('text search combines with dimension filters via AND', () => {
  // 作品为"火影忍者" 且 文本含"佐助"：仅 char_c
  const result = filterLibraryItems(items, { work: ['火影忍者'] }, '佐助')
  assert.deepEqual(result.map(r => r.id), ['char_c'])
})

test('empty dimension value array is treated as no filter on that dimension', () => {
  const result = filterLibraryItems(items, { type: [], work: ['火影忍者'] }, '')
  assert.deepEqual(result.map(r => r.id).sort(), ['char_a', 'char_c'])
})

test('no matches returns empty array with explicit empty state', () => {
  const result = filterLibraryItems(items, { media: ['television'] }, '')
  assert.equal(result.length, 0)
})

test('collectFilterOptions returns deduplicated sorted values for a dimension', () => {
  const options = collectFilterOptions(items, 'work')
  assert.deepEqual(options, ['亮剑', '咒术回战', '火影忍者', '甄嬛传'])
})

test('collectFilterOptions returns empty array for unknown dimension', () => {
  const options = collectFilterOptions(items, 'nonexistent')
  assert.deepEqual(options, [])
})

test('collectFilterOptions collects from array-valued fields', () => {
  // emotion 维度的值来自数组，应去重后合并；排序按 Unicode 码点（默认 sort 行为）
  const options = collectFilterOptions(items, 'emotion')
  assert.deepEqual(options, ['决断', '悲壮', '紧张', '释然'])
})

test('filtering does not mutate input items or filters', () => {
  const filters = { type: ['热血追梦者'] }
  const snapshot = JSON.stringify(filters)
  filterLibraryItems(items, filters, '')
  assert.equal(JSON.stringify(filters), snapshot)
})

test('query with surrounding whitespace is trimmed', () => {
  const result = filterLibraryItems(items, {}, '  火影  ')
  assert.equal(result.length, 3)
})
