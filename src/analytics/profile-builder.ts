// 偏好画像聚合算法：按 session_id 从产品事件流聚合偏好分，再结合候选
// entities / source_trend / risk_level 扩散到维度权重，输出 PreferenceProfile。
//
// 设计要点：
// - 纯函数，不依赖 zod / SQLite / Node API，可被前端 Vite 直接 import 和后端测试复用；
// - 只用 `import type` 引入 contracts 类型，运行时零依赖，不会把 zod 带入前端 bundle；
// - 事件权重对应 DEVELOPMENT_PLAN.md 第 5 节事件用途：saved/copied 高权，hidden 负权；
// - 候选维度扩散：候选偏好分按 entities（每个 entity 平分）/ source_trend / risk_level 三类
//   维度累加，让"未交互但共享 entity 的候选"也能在 personalized-rank 中获得匹配分。

import type { PreferenceProfile } from '../data/contracts.ts'

/** 画像聚合所需的候选字段（结构化类型，兼容 Candidate 但避免整体 import） */
export interface ProfileCandidate {
  id: string
  source_trend: string
  entities: readonly string[]
  risk_level: string
}

/** 画像聚合所需的事件字段（结构化类型，兼容 ProductEvent） */
export interface ProfileEvent {
  event_type: string
  idea_id: string | null
  session_id: string
}

/**
 * 9 类产品事件对偏好画像的贡献权重。
 * - saved / copied / exported 是高价值正向信号（用户主动沉淀或带走方案）；
 * - impression 是弱正向信号（仅曝光，未表达偏好）；
 * - hidden 是负向信号（用户明确反感，应降低同类候选排序）；
 * - risk_reported / video_* 暂不参与画像（合规 / 转化信号，留待 D3 权重更新）。
 */
export const EVENT_WEIGHTS: Record<string, number> = {
  idea_impression: 1,
  idea_opened: 3,
  idea_saved: 5,
  prompt_copied: 4,
  idea_exported: 4,
  video_created: 0,
  video_published: 0,
  idea_hidden: -3,
  risk_reported: 0,
}

const EMPTY_DIMENSION = (): Record<string, number> => ({})

/**
 * 构建单一 session 的偏好画像。
 *
 * @param events 该 session 的产品事件流（已按 session 过滤或全量传入均可，函数内部会过滤）
 * @param candidates 候选列表，用于把 idea_id 反查为 entities / source_trend / risk_level 维度
 * @param sessionId 目标 session ID
 * @param builtAt 画像构建时间（ISO 8601），由调用方注入便于测试可重复
 */
export const buildPreferenceProfile = (
  events: readonly ProfileEvent[],
  candidates: readonly ProfileCandidate[],
  sessionId: string,
  builtAt: string,
): PreferenceProfile => {
  // 候选 ID → 候选维度映射，O(1) 查找；只保留聚合所需字段
  const candidateById = new Map<string, ProfileCandidate>()
  for (const candidate of candidates) {
    candidateById.set(candidate.id, candidate)
  }

  // 第一遍：按 idea_id 累加事件权重，得到每个候选的偏好分
  const ideaScores = new Map<string, number>()
  let eventCount = 0
  for (const event of events) {
    if (event.session_id !== sessionId) continue
    if (event.idea_id === null) continue
    const weight = EVENT_WEIGHTS[event.event_type]
    if (weight === undefined) continue
    eventCount += 1
    ideaScores.set(event.idea_id, (ideaScores.get(event.idea_id) ?? 0) + weight)
  }

  // 第二遍：把候选偏好分扩散到三类维度
  const entityWeights = EMPTY_DIMENSION()
  const sourceTrendWeights = EMPTY_DIMENSION()
  const riskLevelWeights = EMPTY_DIMENSION()

  for (const [ideaId, score] of ideaScores) {
    const candidate = candidateById.get(ideaId)
    if (!candidate) continue
    // entities 平分候选偏好分，避免 entities 多的候选被过度放大
    const entityCount = candidate.entities.length
    if (entityCount > 0) {
      const perEntity = score / entityCount
      for (const entityId of candidate.entities) {
        entityWeights[entityId] = (entityWeights[entityId] ?? 0) + perEntity
      }
    }
    sourceTrendWeights[candidate.source_trend] = (sourceTrendWeights[candidate.source_trend] ?? 0) + score
    riskLevelWeights[candidate.risk_level] = (riskLevelWeights[candidate.risk_level] ?? 0) + score
  }

  // top_ideas：按偏好分降序取前 10，供 UI 展示"你近期关注的创意"
  const topIdeas = [...ideaScores.entries()]
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id]) => id)

  return {
    schema_version: 1,
    session_id: sessionId,
    model_version: 1,
    built_at: builtAt,
    event_count: eventCount,
    idea_scores: Object.fromEntries(ideaScores),
    dimension_weights: {
      entity: entityWeights,
      source_trend: sourceTrendWeights,
      risk_level: riskLevelWeights,
    },
    top_ideas: topIdeas,
  }
}
