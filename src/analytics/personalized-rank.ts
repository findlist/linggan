// 个性化排序：基于偏好画像对候选列表重排。
//
// 评分公式：personalized_score = base_score * BASE_RATIO + match_score * MATCH_RATIO
// - base_score：候选原始质量分（0-100），保证基础质量不被画像偏好完全覆盖；
// - match_score：候选与画像维度的匹配度（0-100），由 entities / source_trend / risk_level
//   三类维度的加权命中归一化得到，让"未直接交互但共享 entity 的候选"也能获得提升。
//
// 排序策略：
// - profiled：画像 event_count > 0 时，按 personalized_score 降序排列已计算匹配分的候选；
// - explore（D4 升级）：从未交互候选中按 explore_ratio 基于"全部候选"计算探索位数量
//   （ceil 取整保证 ≥15% 门槛），用多样性优先策略选取 entities 重叠最少的候选作为探索位，
//   避免探索位聚集相同角色/场景；同一种子可复现，便于 A/B 对比；
// - cold：画像为空（冷启动）时，全部候选保留原顺序，reason 标记为 cold，不破坏现有体验。
//
// 纯函数，只 `import type` 引入类型，运行时零依赖，前端 Vite 可直接 import。

import type { PreferenceProfile, RankReason, RankingWeightSnapshot } from '../data/contracts.ts'
import type { ProfileCandidate } from './profile-builder.ts'
import { computeExploreSlotCount, selectExploreCandidates } from './exploration.ts'

/** 排序所需的候选字段（兼容 Candidate，含 score.total 用于基础分） */
export interface RankableCandidate extends ProfileCandidate {
  score: { total: number }
}

/** 个性化排序结果：候选引用 + 评分明细 + 排序原因 */
export interface RankedCandidate<T extends RankableCandidate = RankableCandidate> {
  candidate: T
  personalized_score: number
  base_score: number
  match_score: number
  reason: RankReason
}

export interface RankOptions {
  /** 基础分权重（0-1），默认 0.6；剩余部分为匹配分权重 */
  base_ratio?: number
  /** 探索比例（0-1），默认 0.15，对应 DEVELOPMENT_PLAN.md 阶段 D"首页 ≥ 15% 探索内容" */
  explore_ratio?: number
  /** 探索候选的匹配分阈值（0-100），低于此值且未在画像 idea_scores 中的候选视为探索 */
  explore_threshold?: number
  /**
   * D3 周权重快照：提供时用其 weights.base_ratio / explore_ratio 覆盖默认值，
   * 让全局周级权重影响个性化排序。null 或不传时使用 options 中的显式值或默认值。
   */
  weight_snapshot?: RankingWeightSnapshot | null
  /**
   * D4 探索选取种子：同一 seed + 同一候选列表产生稳定的多样性探索选取结果，
   * 便于测试可复现和 A/B 对比。默认 0；传入时打破候选原顺序的聚集。
   */
  explore_seed?: number
}

const DEFAULT_OPTIONS: Required<Omit<RankOptions, 'weight_snapshot'>> = {
  base_ratio: 0.6,
  explore_ratio: 0.15,
  explore_threshold: 1,
  explore_seed: 0,
}

const clampScore = (value: number): number => Math.max(0, Math.min(100, Math.round(value)))

/**
 * 计算单个候选与画像的匹配分（0-100）。
 * 匹配分 = entity 命中权重之和 + source_trend 命中权重 + risk_level 命中权重，
 * 再按画像最大维度权重归一化到 0-100，避免画像事件量大时匹配分溢出。
 */
const computeMatchScore = (candidate: RankableCandidate, profile: PreferenceProfile): number => {
  const {
    entity: entityWeights,
    source_trend: sourceTrendWeights,
    risk_level: riskLevelWeights,
  } = profile.dimension_weights

  let raw = 0
  // entities 命中：累加每个 entity 的画像权重
  for (const entityId of candidate.entities) {
    raw += entityWeights[entityId] ?? 0
  }
  raw += sourceTrendWeights[candidate.source_trend] ?? 0
  raw += riskLevelWeights[candidate.risk_level] ?? 0

  if (raw <= 0) return 0

  // 归一化基准：取画像三类维度中的最大权重，避免事件量放大导致 match_score 远超 100
  const maxWeight = Math.max(
    ...Object.values(entityWeights),
    ...Object.values(sourceTrendWeights),
    ...Object.values(riskLevelWeights),
    1,
  )
  // 候选可能命中多个维度，归一化时放大 3 倍作为分母上限，让多维度命中获得合理高分
  const normalized = (raw / (maxWeight * 3)) * 100
  return clampScore(normalized)
}

/**
 * 对候选列表进行个性化重排。
 *
 * @param candidates 待排序候选（保留原顺序用于探索保留和冷启动降级）
 * @param profile 偏好画像；为 null 时冷启动，返回原顺序且 reason=cold
 * @param options 排序参数
 */
export const rankCandidates = <T extends RankableCandidate>(
  candidates: readonly T[],
  profile: PreferenceProfile | null,
  options: RankOptions = {},
): RankedCandidate<T>[] => {
  // D3：周权重快照优先级最高，覆盖显式 options 和默认值；让全局周级权重影响个性化排序
  const snapshotWeights = options.weight_snapshot?.weights
  const opts = {
    ...DEFAULT_OPTIONS,
    ...options,
    base_ratio: snapshotWeights?.base_ratio ?? options.base_ratio ?? DEFAULT_OPTIONS.base_ratio,
    explore_ratio: snapshotWeights?.explore_ratio ?? options.explore_ratio ?? DEFAULT_OPTIONS.explore_ratio,
  }

  // 冷启动：无画像或无事件，全部保留原顺序，避免新用户看到空列表或乱序
  if (!profile || profile.event_count === 0) {
    return candidates.map((candidate) => {
      const baseScore = clampScore(candidate.score.total)
      return {
        candidate,
        personalized_score: baseScore,
        base_score: baseScore,
        match_score: 0,
        reason: 'cold' as const,
      }
    })
  }

  const matchRatio = 1 - opts.base_ratio
  const scored = candidates.map((candidate) => {
    const baseScore = clampScore(candidate.score.total)
    const matchScore = computeMatchScore(candidate, profile)
    const personalized = clampScore(baseScore * opts.base_ratio + matchScore * matchRatio)
    return { candidate, baseScore, matchScore, personalized }
  })

  // 已在画像 idea_scores 中（用户直接交互过）的候选优先 profiled 排序
  const ideaScores = profile.idea_scores
  const profiled = scored.filter((item) => ideaScores[item.candidate.id] !== undefined)
  const nonProfiled = scored.filter((item) => ideaScores[item.candidate.id] === undefined)

  // profiled 按 personalized_score 降序；同分时保留原顺序（stable sort）
  profiled.sort((a, b) => b.personalized - a.personalized)

  // D4 探索位：基于"全部候选"数量按 explore_ratio 用 ceil 计算探索位数量，
  // 保证首页探索占比 ≥ explore_ratio（旧实现基于 nonProfiled.length 用 round 会让小列表得到 0 探索位）；
  // 探索位上限为未交互候选数，超过时全部未交互候选成为探索位。
  const desiredSlots = computeExploreSlotCount(candidates.length, opts.explore_ratio)
  const exploreSlotCount = Math.min(desiredSlots, nonProfiled.length)
  // 多样性优先选取：从未交互候选中选 entities 重叠最少的，避免探索位聚集相同角色/场景；
  // 用 explore_seed 打破原顺序聚集，同一 seed 选取稳定可复现。
  const exploreIds = new Set(
    selectExploreCandidates(
      nonProfiled.map((item) => ({ id: item.candidate.id, entities: item.candidate.entities })),
      exploreSlotCount,
      opts.explore_seed,
    ).map((c) => c.id),
  )
  const explore = nonProfiled.filter((item) => exploreIds.has(item.candidate.id))
  const remaining = nonProfiled.filter((item) => !exploreIds.has(item.candidate.id))

  // 剩余未交互候选按 personalized_score 降序插入 profiled 之后、探索之前
  remaining.sort((a, b) => b.personalized - a.personalized)

  const toRanked = (item: (typeof scored)[number], reason: RankReason): RankedCandidate<T> => ({
    candidate: item.candidate,
    personalized_score: item.personalized,
    base_score: item.baseScore,
    match_score: item.matchScore,
    reason,
  })

  return [
    ...profiled.map((item) => toRanked(item, 'profiled')),
    ...remaining.map((item) => toRanked(item, 'profiled')),
    ...explore.map((item) => toRanked(item, 'explore')),
  ]
}
