// 前端个性化适配层：从 localStorage 事件队列 + 候选导出聚合偏好画像，
// 再用画像对候选列表重排，供 FeedSection 渲染"为你推荐"流。
//
// 设计要点：
// - 前端直接从 localStorage 队列聚合（D2a 已建立），无需等 sync:events 入库 SQLite；
// - 跨设备不同步是 D2b 可接受边界（验收条件是"个性化排序"，非"跨设备画像同步"）；
// - 画像只读不写 localStorage：每次渲染实时聚合，避免过期画像误导排序；
// - 候选必须是 candidate-export.json 中的 approved 候选，结构与 RankableCandidate 兼容。
// - 用 .ts 与 session.ts/tracker.ts 一致，纯类型 import 编译时擦除零运行时开销。

import { getQueuedEvents } from './tracker.ts'
import { getSessionId } from './session.ts'
import { buildPreferenceProfile } from '../analytics/profile-builder.ts'
import { rankCandidates } from '../analytics/personalized-rank.ts'
import type { RankReason } from './contracts.ts'

// 候选导出 JSON 中的候选字段（与 Candidate 兼容，前端只读这些字段用于画像和排序）
interface FeedCandidate {
  id: string
  source_trend: string
  entities: readonly string[]
  risk_level: string
  score: { total: number }
}

// 个性化结果：重排后的候选 + 画像摘要（供 UI 显示"基于 N 次互动"）
export interface PersonalizationResult {
  ranked: Array<{ candidate: FeedCandidate; reason: RankReason; personalized_score: number }>
  profileSummary: {
    eventCount: number
    topIdeaCount: number
    hasProfile: boolean
  }
}

/**
 * 对候选列表进行个性化重排。
 * 无事件队列时返回原顺序和冷启动摘要，不破坏现有 FeedSection 体验。
 *
 * @param candidates candidate-export.json 中的 approved 候选
 * @param now 当前时间，默认 new Date()，注入便于测试
 */
export const personalizeCandidates = (
  candidates: readonly FeedCandidate[],
  now: Date = new Date(),
): PersonalizationResult => {
  const events = getQueuedEvents()
  const sessionId = getSessionId(now)

  // 无事件时冷启动：rankCandidates 内部会处理 null 画像，返回原顺序
  if (events.length === 0) {
    return {
      ranked: candidates.map((candidate) => ({
        candidate,
        reason: 'cold' as const,
        personalized_score: candidate.score.total,
      })),
      profileSummary: { eventCount: 0, topIdeaCount: 0, hasProfile: false },
    }
  }

  const profile = buildPreferenceProfile(events, candidates, sessionId, now.toISOString())
  const ranked = rankCandidates(candidates, profile)

  return {
    ranked: ranked.map((item) => ({
      candidate: item.candidate as FeedCandidate,
      reason: item.reason,
      personalized_score: item.personalized_score,
    })),
    profileSummary: {
      eventCount: profile.event_count,
      topIdeaCount: profile.top_ideas.length,
      hasProfile: profile.event_count > 0,
    },
  }
}
