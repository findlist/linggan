// 探索流量机制（D4）：显式探索位分配、多样性选取和探索效果度量。
//
// 设计目标（对应 DEVELOPMENT_PLAN.md 阶段 D"D4 探索流量"和
// DEVELOPMENT_STANDARD.md 第 10 节"首页至少保留 15% 探索内容"）：
// - 显式分配：按 explore_ratio 基于"全部候选"计算探索位数量，用 ceil 保证
//   小列表也能达到 ≥15% 门槛（旧实现基于 nonProfiled.length 用 round 会让 3 个候选时得到 0 探索位）；
// - 多样性优先：贪心选取 entities 重叠最少的候选作为探索位，避免探索位聚集相同角色/场景；
// - 固定种子可复现：同一种子 + 同一候选列表产生稳定选取结果，便于测试和 A/B 对比；
// - 效果度量：扫描 impression 事件 payload.reason='explore'，追踪这些 idea 的后续正向交互率，
//   反馈到周权重 explore_ratio 调整（探索有效 → 可略减占比；探索无效 → 略增占比寻找新题材）。
//
// 纯函数，只 `import type` 引入类型，运行时零依赖，前端和后端均可复用。

/** 探索效果统计：度量探索位候选的后续交互情况，用于反馈到 explore_ratio 调整 */
export interface ExploreEffectStats {
  /** 标记为 explore 的曝光事件数（payload.reason='explore' 的 impression） */
  explore_impressions: number
  /** 被探索的不同 idea 数量（去重） */
  unique_explore_ideas: number
  /** 探索 idea 中产生至少一次正向交互（opened/saved/copied/exported）的数量 */
  explored_with_interaction: number
  /** 探索交互率 = explored_with_interaction / unique_explore_ideas，无探索 idea 时为 0 */
  interaction_rate: number
}

/** 探索效果度量所需的事件字段（兼容 ProductEvent，避免整体 import 带入 zod） */
export interface ExploreEffectEvent {
  event_type: string
  idea_id: string | null
  payload?: Record<string, string | number | boolean | null> | null
}

/** 选取探索候选所需的最小候选结构（兼容 RankableCandidate） */
export interface ExploreCandidate {
  id: string
  entities: readonly string[]
}

/** 视为"正向后续交互"的事件类型（用户对探索内容产生了进一步行为） */
const POSITIVE_INTERACTION_TYPES = new Set(['idea_opened', 'idea_saved', 'prompt_copied', 'idea_exported'])

/**
 * 计算探索位数量：基于"全部候选"数量按 explore_ratio 用 ceil 取整，
 * 保证首页探索内容占比 ≥ explore_ratio（DEVELOPMENT_STANDARD.md 第 10 节 ≥15%）。
 *
 * 与旧实现 `Math.round(nonProfiled.length * ratio)` 的区别：
 * - 旧实现基于未交互候选数，3 个未交互 × 0.15 = 0.45 → round = 0，探索位为空；
 * - 新实现基于全部候选数，10 × 0.15 = 1.5 → ceil = 2，保证至少有探索位。
 *
 * @param totalCandidates 候选总数（决定首页探索占比的分母）
 * @param exploreRatio 探索比例（0-1），默认 0.15
 */
export const computeExploreSlotCount = (totalCandidates: number, exploreRatio = 0.15): number => {
  if (totalCandidates <= 0 || exploreRatio <= 0) return 0
  // ceil 保证向上取整：10 * 0.15 = 1.5 → 2，保证 ≥15% 门槛
  return Math.min(Math.ceil(totalCandidates * exploreRatio), totalCandidates)
}

/**
 * 简单字符串哈希（FNV-1a 32 位），用于固定种子的稳定打分。
 * 同一输入始终产生同一无符号 32 位整数，不依赖运行时随机源。
 */
const hashId = (value: string): number => {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/**
 * 从候选列表中按"多样性优先 + 种子稳定打平"策略选取指定数量的探索候选。
 *
 * 选取算法（贪心）：
 * 1. 每轮在剩余候选中找出 entities 重叠分最小的候选（重叠分 = 该候选各 entity 已被选中次数之和）；
 * 2. 重叠分相同时，用 hash(seed + candidate.id) 较小者打破平局，保证同一 seed 可复现；
 * 3. 选中后更新 entity 计数，继续下一轮直到填满 slots。
 *
 * 这样探索位会优先覆盖不同角色/场景，避免"前 3 个探索位都是同一作品"的聚集问题。
 *
 * @param candidates 待选取的候选（通常是未交互候选，保留原顺序用于稳定打分）
 * @param slots 探索位数量（由 computeExploreSlotCount 计算）
 * @param seed 随机种子，默认 0；同一 seed + 同一候选列表产生稳定选取结果
 */
export const selectExploreCandidates = <T extends ExploreCandidate>(
  candidates: readonly T[],
  slots: number,
  seed = 0,
): T[] => {
  if (slots <= 0 || candidates.length === 0) return []
  // slots 超过候选数时全部作为探索位，保留原顺序
  if (slots >= candidates.length) return [...candidates]

  const selected: T[] = []
  // 剩余候选用索引数组管理，避免反复 splice 的 O(n) 复制开销
  const remainingIndices = candidates.map((_, index) => index)
  // entity -> 已被选中次数
  const entityCounts = new Map<string, number>()

  while (selected.length < slots && remainingIndices.length > 0) {
    let bestPosition = 0
    let bestOverlap = Infinity
    let bestHash = Infinity

    for (let position = 0; position < remainingIndices.length; position += 1) {
      const candidate = candidates[remainingIndices[position]]
      // 重叠分：该候选各 entity 已被选中的次数之和，越低越优先（越多样的 entity 组合）
      let overlap = 0
      for (const entityId of candidate.entities) {
        overlap += entityCounts.get(entityId) ?? 0
      }
      // 平局用 seed + id 的哈希打破，保证同一 seed 选取稳定可复现
      const tieBreak = hashId(`${seed}:${candidate.id}`)
      if (overlap < bestOverlap || (overlap === bestOverlap && tieBreak < bestHash)) {
        bestOverlap = overlap
        bestHash = tieBreak
        bestPosition = position
      }
    }

    const selectedIndex = remainingIndices[bestPosition]
    const selectedCandidate = candidates[selectedIndex]
    selected.push(selectedCandidate)
    for (const entityId of selectedCandidate.entities) {
      entityCounts.set(entityId, (entityCounts.get(entityId) ?? 0) + 1)
    }
    remainingIndices.splice(bestPosition, 1)
  }

  return selected
}

/**
 * 度量探索效果：扫描事件流，统计被标记为 explore 的 impression 及其后续正向交互率。
 *
 * 判定逻辑：
 * - 探索曝光：event_type='idea_impression' 且 payload.reason='explore' 且 idea_id 非空；
 * - 正向交互：同一 idea_id 在事件流中出现 opened/saved/copied/exported 任一事件。
 *
 * 注意：函数不要求事件按时间排序，只统计"是否产生过正向交互"。当前事件规模下
 * O(events) 单遍扫描 + Set 查找性能足够；后续事件量增大可改为按 idea_id 索引预聚合。
 *
 * @param events 本周产品事件流（应已按 ISO 周过滤）
 */
export const buildExploreEffectStats = (events: readonly ExploreEffectEvent[]): ExploreEffectStats => {
  const exploreIdeas = new Set<string>()
  const positiveIdeas = new Set<string>()
  let exploreImpressions = 0

  // 第一遍：收集探索曝光 idea 和正向交互 idea
  for (const event of events) {
    if (event.idea_id === null) continue
    if (event.event_type === 'idea_impression') {
      // payload.reason='explore' 标记该曝光来自探索位（FeedSection 渲染时注入）
      if (event.payload?.reason === 'explore') {
        exploreImpressions += 1
        exploreIdeas.add(event.idea_id)
      }
    } else if (POSITIVE_INTERACTION_TYPES.has(event.event_type)) {
      positiveIdeas.add(event.idea_id)
    }
  }

  // 统计探索 idea 中产生过正向交互的数量
  let exploredWithInteraction = 0
  for (const ideaId of exploreIdeas) {
    if (positiveIdeas.has(ideaId)) exploredWithInteraction += 1
  }

  const uniqueCount = exploreIdeas.size
  return {
    explore_impressions: exploreImpressions,
    unique_explore_ideas: uniqueCount,
    explored_with_interaction: exploredWithInteraction,
    // 无探索 idea 时交互率为 0，避免 NaN
    interaction_rate: uniqueCount > 0 ? exploredWithInteraction / uniqueCount : 0,
  }
}
