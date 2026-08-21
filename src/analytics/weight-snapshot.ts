// 排序权重周更新算法：按 ISO 周从产品事件流聚合全局行为，计算影响排序的权重参数，
// 生成可回滚、可解释的 RankingWeightSnapshot 序列。
//
// 设计要点（对应 DEVELOPMENT_STANDARD.md 第 10 节自动决策规范）：
// - 单次变化不超过 10%：newWeight 被 clamp 到 [oldWeight*0.9, oldWeight*1.1]；
// - 样本不足时保持原权重：event_count < MIN_SAMPLE_SIZE 时 changes 全部为 0；
// - 可解释：input_stats 记录本周事件数、会话数、创意数、按类型分布和探索效果统计；
// - 可回滚：previous_week_id 链接上周快照，存储层保留全部历史支持任意周回滚。
//
// 权重调整逻辑（基于事件分布，可解释）：
// - 正向交互率 = (saved + copied + exported) / event_count：
//   高 → 用户对现有内容满意 → base_ratio 略增（基础分更重要）；
//   低 → 用户在寻找新内容 → match_ratio 略增（匹配分更重要，推动个性化）。
// - idea 多样性 = unique_ideas / event_count：
//   高 → 探索充分 → explore_ratio 略减；
//   低 → 集中少数 → explore_ratio 略增（需要更多探索位）。
// - D4 探索效果 = explored_with_interaction / unique_explore_ideas：
//   高（>30%）→ 探索有效，用户在探索位找到感兴趣内容 → explore_ratio 略减（让更多优质内容浮现）；
//   低（<10%）→ 探索无效，需要更多探索位寻找新题材 → explore_ratio 略增。
//   两个信号叠加后再按 10% 上限 clamp，保证单次调整温和。
//
// 纯函数，只 `import type` 引入类型，运行时零依赖，前端和后端均可复用。

import type { RankingWeightSnapshot, RankingWeights, WeightChanges, WeightInputStats } from '../data/contracts.ts'
import { buildExploreEffectStats } from './exploration.ts'

/** 周权重聚合所需的事件字段（兼容 ProductEvent，避免整体 import）。
 *  D4 起新增可选 payload 字段，用于判断 impression 是否来自探索位（payload.reason='explore'）。 */
export interface WeightEvent {
  event_type: string
  idea_id: string | null
  session_id: string
  occurred_at: string
  payload?: Record<string, string | number | boolean | null> | null
}

/** 样本不足阈值：低于此值时保持原权重，避免小样本噪声导致权重抖动 */
export const MIN_SAMPLE_SIZE = 50

/** 单次最大变化比例：新权重相对旧权重的变化不超过 10% */
export const MAX_CHANGE_RATIO = 0.1

/** 每次调整的基础步长（2 个百分点），再按 10% 上限 clamp */
const ADJUSTMENT_STEP = 0.02

/** 默认权重值：与 personalized-rank 的 DEFAULT_OPTIONS 保持一致 */
export const DEFAULT_WEIGHTS: RankingWeights = {
  base_ratio: 0.6,
  match_ratio: 0.4,
  explore_ratio: 0.15,
  event_weights: {
    idea_impression: 1,
    idea_opened: 3,
    idea_saved: 5,
    prompt_copied: 4,
    idea_exported: 4,
    video_created: 0,
    video_published: 0,
    idea_hidden: -3,
    risk_reported: 0,
  },
}

/** 空变化量：样本不足或首次运行时使用 */
const EMPTY_CHANGES = (): WeightChanges => ({
  base_ratio: 0,
  match_ratio: 0,
  explore_ratio: 0,
  event_weights: {},
})

/**
 * 把 Date 转换为 ISO 8601 周标识（YYYY-Www）。
 * ISO 周定义：周一为一周开始，第一周是包含该年第一个周四的周。
 * 纯函数，基于 UTC 计算避免时区干扰，便于测试可重复。
 */
export const getIsoWeekId = (date: Date): string => {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

/**
 * 从按 computed_at 倒序的快照列表中，选取目标周之外最近的快照作为更新基准。
 * 定时调度场景下同一 ISO 周可能重复触发（补跑、重复执行）：
 * 此时 latest() 就是本周已保存的快照，若直接作为 previous 会把自身当上周基准，
 * 导致同一事件流对权重做二次调整（10% clamp 只能限幅不能防重复叠加）。
 * 纯函数，供 update:weekly-weights 调度入口复用。
 */
export const findPreviousSnapshot = (
  snapshots: readonly RankingWeightSnapshot[],
  targetWeekId: string,
): RankingWeightSnapshot | null => snapshots.find((snapshot) => snapshot.week_id !== targetWeekId) ?? null

/**
 * 限制新权重相对旧权重的变化不超过 MAX_CHANGE_RATIO（10%）。
 * 同时保证结果在 [0, 1] 合法区间内。
 */
const clampChange = (newValue: number, oldValue: number): number => {
  const lower = oldValue * (1 - MAX_CHANGE_RATIO)
  const upper = oldValue * (1 + MAX_CHANGE_RATIO)
  return Math.max(0, Math.min(1, Math.min(upper, Math.max(lower, newValue))))
}

/**
 * 构建单周的权重输入统计（事件数、会话数、创意数、按类型分布、探索效果）。
 * 用于快照的 input_stats 字段，提供可解释性。
 * D4 起：事件携带 payload 时额外计算 explore_stats，记录探索位的后续交互率。
 */
const buildInputStats = (events: readonly WeightEvent[]): WeightInputStats => {
  const sessions = new Set<string>()
  const ideas = new Set<string>()
  const byType: Record<string, number> = {}
  for (const event of events) {
    sessions.add(event.session_id)
    if (event.idea_id !== null) ideas.add(event.idea_id)
    byType[event.event_type] = (byType[event.event_type] ?? 0) + 1
  }
  // D4：计算探索效果统计（事件无 payload 时 explore_impressions=0，interaction_rate=0）
  const exploreStats = buildExploreEffectStats(events)
  return {
    event_count: events.length,
    session_count: sessions.size,
    idea_count: ideas.size,
    by_type: byType,
    // 仅在存在探索曝光时记录 explore_stats，避免无探索数据时快照膨胀
    explore_stats: exploreStats.unique_explore_ideas > 0 ? exploreStats : null,
  }
}

/**
 * 基于事件分布计算本周权重调整量（未 clamp 前的原始值）。
 * - positiveRate：正向交互率（saved+copied+exported 占比）
 * - diversity：idea 多样性（unique_ideas / event_count）
 * - exploreRate（D4）：探索位交互率（explored_with_interaction / unique_explore_ideas）
 * 调整方向见文件头部说明。
 */
const computeRawAdjustments = (
  stats: WeightInputStats,
): {
  baseDelta: number
  matchDelta: number
  exploreDelta: number
} => {
  const { event_count, by_type, idea_count } = stats
  if (event_count === 0) return { baseDelta: 0, matchDelta: 0, exploreDelta: 0 }

  const positiveCount = (by_type.idea_saved ?? 0) + (by_type.prompt_copied ?? 0) + (by_type.idea_exported ?? 0)
  const positiveRate = positiveCount / event_count
  const diversity = idea_count / event_count

  // 正向交互率高 → base_ratio 增；低 → match_ratio 增（互补，base+match=1 由调用方保证）
  const baseDelta = positiveRate > 0.3 ? ADJUSTMENT_STEP : positiveRate < 0.1 ? -ADJUSTMENT_STEP : 0
  const matchDelta = -baseDelta

  // idea 多样性低 → explore_ratio 增；高 → 减
  let exploreDelta = diversity < 0.3 ? ADJUSTMENT_STEP : diversity > 0.6 ? -ADJUSTMENT_STEP : 0

  // D4 探索效果信号：仅在存在 explore_stats 且有足够探索 idea 时生效（避免小样本噪声）
  const exploreStats = stats.explore_stats ?? null
  if (exploreStats && exploreStats.unique_explore_ideas >= 5) {
    // 探索交互率高 → 探索有效，可略减占比让优质内容浮现；低 → 需更多探索位寻找新题材
    const effectDelta =
      exploreStats.interaction_rate > 0.3 ? -ADJUSTMENT_STEP : exploreStats.interaction_rate < 0.1 ? ADJUSTMENT_STEP : 0
    exploreDelta += effectDelta
  }

  return { baseDelta, matchDelta, exploreDelta }
}

/**
 * 构建单周的排序权重快照。
 *
 * @param events 本周产品事件流（应已按 ISO 周过滤；函数内部不重复过滤，保持纯函数）
 * @param weekId 目标周标识（YYYY-Www）
 * @param previous 上一周快照；null 表示首次运行，使用 DEFAULT_WEIGHTS
 * @param computedAt 计算时间（ISO 8601），由调用方注入便于测试可重复
 */
export const buildWeeklyWeightSnapshot = (
  events: readonly WeightEvent[],
  weekId: string,
  previous: RankingWeightSnapshot | null,
  computedAt: string,
): RankingWeightSnapshot => {
  const stats = buildInputStats(events)
  const previousWeights = previous?.weights ?? DEFAULT_WEIGHTS

  // 样本不足时保持原权重，changes 全部为 0（DEVELOPMENT_STANDARD.md 第 10 节）
  if (stats.event_count < MIN_SAMPLE_SIZE) {
    return {
      schema_version: 1,
      week_id: weekId,
      rule_version: 1,
      computed_at: computedAt,
      previous_week_id: previous?.week_id ?? null,
      input_stats: stats,
      weights: previousWeights,
      changes: EMPTY_CHANGES(),
    }
  }

  // 样本充足：计算调整量并 clamp 到 10% 上限
  const { baseDelta, matchDelta, exploreDelta } = computeRawAdjustments(stats)

  const newBaseRatio = clampChange(previousWeights.base_ratio + baseDelta, previousWeights.base_ratio)
  const newMatchRatio = clampChange(previousWeights.match_ratio + matchDelta, previousWeights.match_ratio)
  const newExploreRatio = clampChange(previousWeights.explore_ratio + exploreDelta, previousWeights.explore_ratio)

  return {
    schema_version: 1,
    week_id: weekId,
    rule_version: 1,
    computed_at: computedAt,
    previous_week_id: previous?.week_id ?? null,
    input_stats: stats,
    weights: {
      base_ratio: newBaseRatio,
      match_ratio: newMatchRatio,
      explore_ratio: newExploreRatio,
      // event_weights 保持上周值不变：D3 聚焦三个比例权重，事件类型权重自动调整留待后续
      event_weights: previousWeights.event_weights,
    },
    changes: {
      base_ratio: Number((newBaseRatio - previousWeights.base_ratio).toFixed(6)),
      match_ratio: Number((newMatchRatio - previousWeights.match_ratio).toFixed(6)),
      explore_ratio: Number((newExploreRatio - previousWeights.explore_ratio).toFixed(6)),
      event_weights: {},
    },
  }
}
