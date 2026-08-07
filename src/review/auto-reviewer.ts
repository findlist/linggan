import type { Candidate } from '../data/contracts.ts'

/**
 * 自动审核配置，来源于 config/pipeline.json 的 limits。
 * - publish_score: 发布分数门槛（总分≥此值才可批准）
 * - similarity_ceiling: 相似度上限（候选间相似度≥此值视为重复）
 */
export interface AutoReviewConfig {
  publish_score: number
  similarity_ceiling: number
}

/** 单条候选的审核决策 */
export interface ReviewDecision {
  decision: 'approve' | 'reject'
  /** 可解释的决策依据，写入 candidates.reviewed_reason */
  reason: string
  /** 拒绝原因码，approve 时为 undefined */
  cause?: string
}

/** 批量审核结果，按候选 ID 索引 */
export type ReviewResult = Map<string, ReviewDecision>

// 规则版本号，变更规则时递增，用于可解释性与回溯
export const REVIEW_RULE_VERSION = 'v1'

// 风险等级门槛：blocked 和 high 一律拒绝
// 依据：规范 7.3「blocked 不得发布」+ 开发计划第 6 节「风险不高于中等」
const REJECT_RISK_LEVELS = new Set(['blocked', 'high'])

// 版权状态门槛：unknown 和 restricted 拒绝
// 依据：规范 7.3「版权状态未知且使用受保护资产不得发布」
const REJECT_RIGHTS_STATUS = new Set(['unknown', 'restricted'])

/**
 * 对单条候选按发布门槛规则做决策。规则按优先级短路判定：
 * 1. 风险 blocked/high → reject
 * 2. 版权 unknown/restricted → reject
 * 3. 总分 < publish_score → reject
 * 4. source_trend 缺失 → reject（防御性，schema 强制非空）
 * 5. 全通过 → approve
 *
 * 注意：相似度去重需在候选集合层面做（见 reviewCandidates），
 * 单条函数只判断候选自身属性。
 */
export const reviewCandidate = (candidate: Candidate, config: AutoReviewConfig): ReviewDecision => {
  const { score, risk_level, rights_status, source_trend } = candidate
  const base = `rule:${REVIEW_RULE_VERSION}; score=${score.total}; risk=${risk_level}; rights=${rights_status}`

  // 规则 1: 风险门槛——blocked 不得发布、high 超过「不高于中等」门槛
  if (REJECT_RISK_LEVELS.has(risk_level)) {
    return {
      decision: 'reject',
      reason: `${base}; verdict=reject; cause=risk_${risk_level}`,
      cause: `risk_${risk_level}`,
    }
  }

  // 规则 2: 版权门槛——版权未知或受限不得发布
  if (REJECT_RIGHTS_STATUS.has(rights_status)) {
    return {
      decision: 'reject',
      reason: `${base}; verdict=reject; cause=rights_${rights_status}`,
      cause: `rights_${rights_status}`,
    }
  }

  // 规则 3: 分数门槛——总分不低于 publish_score
  if (score.total < config.publish_score) {
    return {
      decision: 'reject',
      reason: `${base}; verdict=reject; cause=score_below_threshold; threshold=${config.publish_score}`,
      cause: 'score_below_threshold',
    }
  }

  // 规则 4: 来源门槛——防御性校验（schema 强制 source_trend 非空，此规则兜底）
  if (!source_trend) {
    return {
      decision: 'reject',
      reason: `${base}; verdict=reject; cause=missing_source`,
      cause: 'missing_source',
    }
  }

  // 全部通过
  return { decision: 'approve', reason: `${base}; verdict=approve` }
}

// 将文本转为字符 bigram 集合，用于计算 Jaccard 相似度
const bigramsOf = (text: string): Set<string> => {
  const chars = Array.from(text)
  const set = new Set<string>()
  for (let i = 0; i < chars.length - 1; i += 1) {
    set.add(chars[i] + chars[i + 1])
  }
  return set
}

// 两个集合的 Jaccard 相似度：交集大小 / 并集大小
const jaccardSimilarity = (a: Set<string>, b: Set<string>): number => {
  if (a.size === 0 && b.size === 0) return 0
  let intersection = 0
  for (const token of a) {
    if (b.has(token)) intersection += 1
  }
  return intersection / (a.size + b.size - intersection)
}

/**
 * 计算两个候选之间的文本相似度（bigram Jaccard）。
 * 作用于候选的 title + hook 文本，用于候选层面去重，避免今日推荐出现换皮创意。
 */
export const candidateSimilarity = (a: Candidate, b: Candidate): number =>
  jaccardSimilarity(bigramsOf(`${a.title}${a.hook}`), bigramsOf(`${b.title}${b.hook}`))

/**
 * 对一批 pending_review 候选做批量审核。
 *
 * 相似度去重策略：按总分降序处理，分数高的先通过；
 * 后续候选若与任一已通过候选相似度≥similarity_ceiling，则标记为 duplicate 拒绝，
 * 确保重复组中只保留分数最高的一条（开发计划第 6 节「相似度低于阈值」）。
 *
 * 返回值按候选 ID 索引，调用方可逐条 transition，保证幂等。
 */
export const reviewCandidates = (candidates: readonly Candidate[], config: AutoReviewConfig): ReviewResult => {
  const result: ReviewResult = new Map()
  // 已通过候选的文本签名，用于相似度比较
  const approvedSignatures: Set<string>[] = []

  // 按总分降序：高分先通过，相似组中低分的被拒绝为 duplicate
  const ordered = [...candidates].sort((a, b) => b.score.total - a.score.total)

  for (const candidate of ordered) {
    const baseDecision = reviewCandidate(candidate, config)

    // 规则未通过的候选直接记录，不参与相似度比较
    if (baseDecision.decision === 'reject') {
      result.set(candidate.id, baseDecision)
      continue
    }

    // 相似度检查：与已通过候选逐个比较
    const signature = bigramsOf(`${candidate.title}${candidate.hook}`)
    let duplicate = false
    for (const approved of approvedSignatures) {
      if (jaccardSimilarity(signature, approved) >= config.similarity_ceiling) {
        duplicate = true
        break
      }
    }

    if (duplicate) {
      result.set(candidate.id, {
        decision: 'reject',
        reason: `rule:${REVIEW_RULE_VERSION}; score=${candidate.score.total}; risk=${candidate.risk_level}; rights=${candidate.rights_status}; verdict=reject; cause=duplicate; ceiling=${config.similarity_ceiling}`,
        cause: 'duplicate',
      })
    } else {
      result.set(candidate.id, baseDecision)
      approvedSignatures.push(signature)
    }
  }

  return result
}
