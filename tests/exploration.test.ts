import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  computeExploreSlotCount,
  selectExploreCandidates,
  buildExploreEffectStats,
  type ExploreCandidate,
  type ExploreEffectEvent,
} from '../src/analytics/exploration.ts'

/* ----------------------- computeExploreSlotCount ----------------------- */

test('computeExploreSlotCount 用 ceil 取整保证 ≥15% 门槛', () => {
  // 10 个候选 × 0.15 = 1.5 → ceil = 2（旧 round 会得到 2，但 3 个候选时 round=0 是问题）
  assert.equal(computeExploreSlotCount(10, 0.15), 2)
  // 3 个候选 × 0.15 = 0.45 → ceil = 1（旧 round = 0，探索位为空，违反 ≥15%）
  assert.equal(computeExploreSlotCount(3, 0.15), 1)
  // 7 个候选 × 0.15 = 1.05 → ceil = 2
  assert.equal(computeExploreSlotCount(7, 0.15), 2)
})

test('computeExploreSlotCount 默认 exploreRatio 为 0.15', () => {
  assert.equal(computeExploreSlotCount(20), 3) // 20 * 0.15 = 3
})

test('computeExploreSlotCount 候选数不足时返回全部', () => {
  // 2 个候选 × 0.15 = 0.3 → ceil = 1，但不超过候选总数
  assert.equal(computeExploreSlotCount(2, 0.15), 1)
  // explore_ratio=0.5 × 3 = 1.5 → ceil = 2，不超过 3
  assert.equal(computeExploreSlotCount(3, 0.5), 2)
  // explore_ratio=1.0 时全部作为探索位
  assert.equal(computeExploreSlotCount(5, 1.0), 5)
})

test('computeExploreSlotCount 空列表或零比例返回 0', () => {
  assert.equal(computeExploreSlotCount(0, 0.15), 0)
  assert.equal(computeExploreSlotCount(10, 0), 0)
  assert.equal(computeExploreSlotCount(0, 0), 0)
})

/* ----------------------- selectExploreCandidates ----------------------- */

// 构造探索候选：允许覆盖 id 和 entities
const buildCandidate = (id: string, entities: string[] = []): ExploreCandidate => ({ id, entities })

test('selectExploreCandidates slots=0 返回空数组', () => {
  const candidates = [buildCandidate('c1', ['char_a'])]
  assert.deepEqual(selectExploreCandidates(candidates, 0), [])
})

test('selectExploreCandidates 空候选列表返回空数组', () => {
  assert.deepEqual(selectExploreCandidates([], 3), [])
})

test('selectExploreCandidates slots 超过候选数时返回全部候选', () => {
  const candidates = [buildCandidate('c1', ['char_a']), buildCandidate('c2', ['char_b'])]
  const selected = selectExploreCandidates(candidates, 5)
  assert.equal(selected.length, 2)
  // 全部返回时保留原顺序
  assert.equal(selected[0].id, 'c1')
  assert.equal(selected[1].id, 'c2')
})

test('selectExploreCandidates 多样性优先：优先选 entities 不重复的候选', () => {
  // 4 个候选：c1/c2 共享 char_a，c3/c4 各有独立 entity
  // 选取 2 个探索位时，应优先选 c3 和 c4（entities 不重叠）
  const candidates = [
    buildCandidate('c1', ['char_a']),
    buildCandidate('c2', ['char_a']),
    buildCandidate('c3', ['char_b']),
    buildCandidate('c4', ['char_c']),
  ]
  const selected = selectExploreCandidates(candidates, 2, 0)
  assert.equal(selected.length, 2)
  // 第一个选中的应该是 entities 完全不重叠的（c1/c2/c3/c4 初始重叠都为 0，由 seed 打破平局）
  // 第二个选中的应避免与第一个共享 entity
  const selectedIds = selected.map((c) => c.id)
  // 不应同时选中 c1 和 c2（它们共享 char_a），应优先选独立 entity 的候选
  const hasBothShared = selectedIds.includes('c1') && selectedIds.includes('c2')
  assert.equal(hasBothShared, false, '不应同时选中共享 entity 的 c1 和 c2')
})

test('selectExploreCandidates 避免探索位聚集相同 entity', () => {
  // 6 个候选：前 3 个都是 char_a，后 3 个各有独立 entity
  // 选取 3 个探索位时，不应全部来自前 3 个 char_a
  const candidates = [
    buildCandidate('c1', ['char_a']),
    buildCandidate('c2', ['char_a']),
    buildCandidate('c3', ['char_a']),
    buildCandidate('c4', ['char_b']),
    buildCandidate('c5', ['char_c']),
    buildCandidate('c6', ['char_d']),
  ]
  const selected = selectExploreCandidates(candidates, 3, 0)
  assert.equal(selected.length, 3)
  // 第一个候选选中后 entityCounts[char_a]=1 或 entityCounts[char_x]=1
  // 后续选 char_a 的候选重叠分为 1，选独立 entity 的为 0，应优先选独立 entity
  const charACount = selected.filter((c) => c.entities.includes('char_a')).length
  // 最多只选 1 个 char_a 候选（第一个），后续应选独立 entity
  assert.ok(charACount <= 1, `最多选 1 个 char_a 候选，实际选了 ${charACount} 个`)
})

test('selectExploreCandidates 同一 seed 选取结果稳定可复现', () => {
  const candidates = [
    buildCandidate('c1', ['char_a']),
    buildCandidate('c2', ['char_b']),
    buildCandidate('c3', ['char_c']),
    buildCandidate('c4', ['char_d']),
  ]
  // 所有候选 entities 都不重叠时，选取顺序由 seed + id 哈希决定
  const selected1 = selectExploreCandidates(candidates, 2, 42)
  const selected2 = selectExploreCandidates(candidates, 2, 42)
  assert.deepEqual(
    selected1.map((c) => c.id),
    selected2.map((c) => c.id),
    '同一 seed 应产生相同选取结果',
  )
})

test('selectExploreCandidates 不同 seed 可能产生不同选取顺序', () => {
  // 所有候选 entities 都不重叠时，不同 seed 打破平局的方式不同
  const candidates = [
    buildCandidate('c1', ['char_a']),
    buildCandidate('c2', ['char_b']),
    buildCandidate('c3', ['char_c']),
    buildCandidate('c4', ['char_d']),
    buildCandidate('c5', ['char_e']),
  ]
  const selected1 = selectExploreCandidates(candidates, 2, 1)
  const selected2 = selectExploreCandidates(candidates, 2, 999)
  // 不要求一定不同（哈希可能碰巧相同），但至少验证不抛错且数量正确
  assert.equal(selected1.length, 2)
  assert.equal(selected2.length, 2)
})

test('selectExploreCandidates 无 entities 的候选按 seed 排序', () => {
  // entities 为空时所有候选重叠分都是 0，完全由 seed 决定顺序
  const candidates = [buildCandidate('alpha', []), buildCandidate('beta', []), buildCandidate('gamma', [])]
  const selected = selectExploreCandidates(candidates, 2, 0)
  assert.equal(selected.length, 2)
  // 验证选取稳定（同一 seed 同一结果）
  const selectedAgain = selectExploreCandidates(candidates, 2, 0)
  assert.deepEqual(
    selected.map((c) => c.id),
    selectedAgain.map((c) => c.id),
  )
})

/* ----------------------- buildExploreEffectStats ----------------------- */

// 构造探索效果事件：允许覆盖 event_type / idea_id / payload
const buildEffectEvent = (overrides: Partial<ExploreEffectEvent> = {}): ExploreEffectEvent => ({
  event_type: 'idea_impression',
  idea_id: 'idea_001',
  payload: { reason: 'explore' },
  ...overrides,
})

test('buildExploreEffectStats 统计探索曝光和后续正向交互', () => {
  // idea_a 有探索曝光 + 后续 saved；idea_b 有探索曝光但无后续交互
  const events: ExploreEffectEvent[] = [
    buildEffectEvent({ idea_id: 'idea_a', payload: { reason: 'explore' } }),
    buildEffectEvent({ event_type: 'idea_saved', idea_id: 'idea_a', payload: null }),
    buildEffectEvent({ idea_id: 'idea_b', payload: { reason: 'explore' } }),
  ]
  const stats = buildExploreEffectStats(events)
  assert.equal(stats.explore_impressions, 2)
  assert.equal(stats.unique_explore_ideas, 2)
  assert.equal(stats.explored_with_interaction, 1) // 只有 idea_a 有正向交互
  assert.equal(stats.interaction_rate, 0.5)
})

test('buildExploreEffectStats 无探索曝光时返回零计数', () => {
  const events: ExploreEffectEvent[] = [
    buildEffectEvent({ event_type: 'idea_impression', idea_id: 'idea_a', payload: { reason: 'profiled' } }),
    buildEffectEvent({ event_type: 'idea_saved', idea_id: 'idea_a', payload: null }),
  ]
  const stats = buildExploreEffectStats(events)
  assert.equal(stats.explore_impressions, 0)
  assert.equal(stats.unique_explore_ideas, 0)
  assert.equal(stats.explored_with_interaction, 0)
  assert.equal(stats.interaction_rate, 0)
})

test('buildExploreEffectStats 空事件流返回零计数', () => {
  const stats = buildExploreEffectStats([])
  assert.equal(stats.explore_impressions, 0)
  assert.equal(stats.unique_explore_ideas, 0)
  assert.equal(stats.interaction_rate, 0)
})

test('buildExploreEffectStats payload 缺失时降级为非探索曝光', () => {
  // payload 为 null 或 undefined 时不算探索曝光
  const events: ExploreEffectEvent[] = [
    buildEffectEvent({ idea_id: 'idea_a', payload: null }),
    buildEffectEvent({ idea_id: 'idea_b', payload: undefined }),
  ]
  const stats = buildExploreEffectStats(events)
  assert.equal(stats.explore_impressions, 0)
  assert.equal(stats.unique_explore_ideas, 0)
})

test('buildExploreEffectStats null idea_id 不计入探索统计', () => {
  const events: ExploreEffectEvent[] = [
    buildEffectEvent({ idea_id: null, payload: { reason: 'explore' } }),
    buildEffectEvent({ idea_id: 'idea_a', payload: { reason: 'explore' } }),
  ]
  const stats = buildExploreEffectStats(events)
  // null idea_id 的曝光不计入
  assert.equal(stats.explore_impressions, 1)
  assert.equal(stats.unique_explore_ideas, 1)
})

test('buildExploreEffectStats 识别全部 4 类正向交互', () => {
  // opened / saved / copied / exported 都算正向交互
  const events: ExploreEffectEvent[] = [
    buildEffectEvent({ idea_id: 'idea_a', payload: { reason: 'explore' } }),
    buildEffectEvent({ event_type: 'idea_opened', idea_id: 'idea_a', payload: null }),
    buildEffectEvent({ idea_id: 'idea_b', payload: { reason: 'explore' } }),
    buildEffectEvent({ event_type: 'idea_saved', idea_id: 'idea_b', payload: null }),
    buildEffectEvent({ idea_id: 'idea_c', payload: { reason: 'explore' } }),
    buildEffectEvent({ event_type: 'prompt_copied', idea_id: 'idea_c', payload: null }),
    buildEffectEvent({ idea_id: 'idea_d', payload: { reason: 'explore' } }),
    buildEffectEvent({ event_type: 'idea_exported', idea_id: 'idea_d', payload: null }),
  ]
  const stats = buildExploreEffectStats(events)
  assert.equal(stats.unique_explore_ideas, 4)
  assert.equal(stats.explored_with_interaction, 4) // 4 个都有正向交互
  assert.equal(stats.interaction_rate, 1.0)
})

test('buildExploreEffectStats impression 非 explore reason 不计入探索', () => {
  const events: ExploreEffectEvent[] = [
    buildEffectEvent({ idea_id: 'idea_a', payload: { reason: 'profiled' } }),
    buildEffectEvent({ idea_id: 'idea_b', payload: { reason: 'cold' } }),
  ]
  const stats = buildExploreEffectStats(events)
  assert.equal(stats.explore_impressions, 0)
  assert.equal(stats.unique_explore_ideas, 0)
})

test('buildExploreEffectStats 重复探索曝光去重统计 unique_ideas', () => {
  const events: ExploreEffectEvent[] = [
    buildEffectEvent({ idea_id: 'idea_a', payload: { reason: 'explore' } }),
    buildEffectEvent({ idea_id: 'idea_a', payload: { reason: 'explore' } }),
    buildEffectEvent({ idea_id: 'idea_a', payload: { reason: 'explore' } }),
  ]
  const stats = buildExploreEffectStats(events)
  assert.equal(stats.explore_impressions, 3)
  assert.equal(stats.unique_explore_ideas, 1)
  assert.equal(stats.interaction_rate, 0) // 无正向交互
})
