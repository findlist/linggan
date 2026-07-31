import type { RemixPlan } from './remix-engine.ts'

/**
 * 近似度检测模块（C3）：消费 C2 完整制作包的 RemixPlan[]，
 * 在生成后标记或过滤重复/高度相似的方案，避免连续发布换皮创意。
 *
 * 设计原则：
 * - 不引入外部 NLP 依赖，用字符 bigram Jaccard 计算中文文本相似度（中文无空格分词，bigram 是轻量有效方案）；
 * - 结构字段（性格对、钩子类别、时长、分镜序列）用精确匹配或序列匹配率；
 * - 加权综合：钩子权重最高（最影响用户感知），其次标题/概念/对白/提示词，结构字段权重最低；
 * - 检测只标记不删除，过滤单独提供，保留可追溯性。
 */

/** 单维度相似度分项，全部 0-1 */
export interface SimilarityBreakdown {
  hook: number
  title: number
  concept: number
  dialogue: number
  description: number
  positive_prompt: number
  personality_pair: number
  hook_category: number
  storyboard_sequence: number
  duration: number
}

/** 两个方案的相似度结果 */
export interface PlanSimilarity {
  /** 0-1 加权综合相似度，1 表示完全相同 */
  score: number
  breakdown: SimilarityBreakdown
}

/** 单个方案在重复检测中的结果 */
export interface DuplicateFlag {
  plan: RemixPlan
  /** 与其他方案的最大相似度，0-1 */
  max_similarity: number
  /** 是否超过阈值被判为重复 */
  is_duplicate: boolean
  /** 被判为重复时所对齐的方案 id 列表（按相似度降序） */
  similar_to: string[]
}

export interface DuplicateDetectionResult {
  flags: DuplicateFlag[]
  stats: {
    total: number
    duplicates: number
    unique: number
    threshold: number
    /** 所有方案 max_similarity 的平均值，用于监控整体重复趋势 */
    avg_max_similarity: number
  }
}

export interface UniqueFilterResult {
  unique_plans: RemixPlan[]
  removed: Array<{
    plan: RemixPlan
    /** 被过滤时所在位置索引 */
    removed_at: number
    /** 与哪个已保留方案相似 */
    similar_to: string
    similarity: number
  }>
  stats: {
    total: number
    removed: number
    remaining: number
    threshold: number
  }
}

export interface SimilarityOptions {
  /** 判定重复的相似度阈值，默认 0.7；高于此值视为换皮 */
  threshold?: number
}

/* ----------------------------- 权重配置 ----------------------------- */
// 权重之和 = 1.0。钩子最影响用户前三秒感知，权重最高；结构字段权重最低，
// 避免两个文本不同但结构相同的方案被误判为重复（如不同角色但同性格+同时长）。

const WEIGHTS: SimilarityBreakdown = {
  hook: 0.25,
  title: 0.1,
  concept: 0.1,
  dialogue: 0.1,
  description: 0.05,
  positive_prompt: 0.1,
  personality_pair: 0.08,
  hook_category: 0.05,
  storyboard_sequence: 0.12,
  duration: 0.05,
}

/* --------------------------- 文本相似度 --------------------------- */
// 字符 bigram Jaccard：把文本拆为相邻字符对集合，求交集/并集。
// bigram 对中文友好（能捕捉"冷静"vs"冷酷"的部分相似），无需分词依赖。

const buildBigrams = (text: string): Set<string> => {
  // 去除空白和标点，减少噪声；中文标点统一处理
  const normalized = text.replace(/[\s，。！？、；：""''《》（）·\-—]/g, '')
  const bigrams = new Set<string>()
  for (let i = 0; i < normalized.length - 1; i++) {
    bigrams.add(normalized.slice(i, i + 2))
  }
  return bigrams
}

const textJaccardSimilarity = (a: string, b: string): number => {
  const setA = buildBigrams(a)
  const setB = buildBigrams(b)
  // 两个空文本视为相同（都是空集），避免空对空得 0
  if (setA.size === 0 && setB.size === 0) return 1
  if (setA.size === 0 || setB.size === 0) return 0
  let intersection = 0
  for (const gram of setA) {
    if (setB.has(gram)) intersection += 1
  }
  const union = setA.size + setB.size - intersection
  return intersection / union
}

/* --------------------------- 结构相似度 --------------------------- */

const enumSimilarity = <T>(a: T, b: T): number => (a === b ? 1 : 0)

/** 序列匹配率：逐位比较，相同位置数 / 最大长度；长度不同时未对齐位置算不匹配 */
const sequenceSimilarity = <T>(a: readonly T[], b: readonly T[]): number => {
  if (a.length === 0 && b.length === 0) return 1
  if (a.length === 0 || b.length === 0) return 0
  const maxLen = Math.max(a.length, b.length)
  let matches = 0
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] === b[i]) matches += 1
  }
  return matches / maxLen
}

/** 性格对相似度：排序后比较，(cold,hot) 与 (hot,cold) 视为相同组合 */
const personalityPairSimilarity = (planA: RemixPlan, planB: RemixPlan): number => {
  const pairA = [planA.personalityA, planA.personalityB].sort().join('|')
  const pairB = [planB.personalityA, planB.personalityB].sort().join('|')
  return enumSimilarity(pairA, pairB)
}

/** 分镜序列相似度：景别、运镜、转场三个序列匹配率的平均 */
const storyboardSequenceSimilarity = (planA: RemixPlan, planB: RemixPlan): number => {
  const shotTypes = sequenceSimilarity(
    planA.storyboard.map((s) => s.shot_type),
    planB.storyboard.map((s) => s.shot_type),
  )
  const cameraMoves = sequenceSimilarity(
    planA.storyboard.map((s) => s.camera_movement),
    planB.storyboard.map((s) => s.camera_movement),
  )
  const transitions = sequenceSimilarity(
    planA.storyboard.map((s) => s.transition),
    planB.storyboard.map((s) => s.transition),
  )
  return (shotTypes + cameraMoves + transitions) / 3
}

/* --------------------------- 分项计算 --------------------------- */

const computeBreakdown = (planA: RemixPlan, planB: RemixPlan): SimilarityBreakdown => ({
  hook: textJaccardSimilarity(planA.hook, planB.hook),
  title: textJaccardSimilarity(planA.title, planB.title),
  concept: textJaccardSimilarity(planA.concept, planB.concept),
  // 对白 A/B 合并计算，避免单侧对白相同拉高相似度
  dialogue: textJaccardSimilarity(`${planA.dialogueA} ${planA.dialogueB}`, `${planB.dialogueA} ${planB.dialogueB}`),
  description: textJaccardSimilarity(planA.copywriting.description, planB.copywriting.description),
  positive_prompt: textJaccardSimilarity(planA.production.prompts.positive, planB.production.prompts.positive),
  personality_pair: personalityPairSimilarity(planA, planB),
  hook_category: enumSimilarity(planA.hookCategory, planB.hookCategory),
  storyboard_sequence: storyboardSequenceSimilarity(planA, planB),
  duration: enumSimilarity(planA.duration, planB.duration),
})

const weightScore = (breakdown: SimilarityBreakdown): number => {
  let score = 0
  for (const key of Object.keys(WEIGHTS) as (keyof SimilarityBreakdown)[]) {
    score += breakdown[key] * WEIGHTS[key]
  }
  return score
}

/* --------------------------- 公共 API --------------------------- */

/** 计算两个 RemixPlan 的加权相似度，返回 0-1 分数和各维度分项 */
export const computePlanSimilarity = (planA: RemixPlan, planB: RemixPlan): PlanSimilarity => {
  const breakdown = computeBreakdown(planA, planB)
  return { score: weightScore(breakdown), breakdown }
}

/**
 * 检测方案列表中的重复/高度相似方案。
 * 每个 plan 的 max_similarity 是它与列表中其他 plan 的最大相似度；
 * 超过阈值的 plan 标记 is_duplicate=true 并记录 similar_to 列表。
 */
export const detectDuplicates = (
  plans: readonly RemixPlan[],
  options?: SimilarityOptions,
): DuplicateDetectionResult => {
  const threshold = options?.threshold ?? 0.7
  const flags: DuplicateFlag[] = plans.map((plan) => ({
    plan,
    max_similarity: 0,
    is_duplicate: false,
    similar_to: [],
  }))

  // 两两比较，O(n²) 复杂度可接受：daily-pipeline 单轮规模 ≤ 几十
  for (let i = 0; i < plans.length; i++) {
    for (let j = i + 1; j < plans.length; j++) {
      const { score } = computePlanSimilarity(plans[i]!, plans[j]!)
      if (score > flags[i]!.max_similarity) {
        flags[i]!.max_similarity = score
      }
      if (score > flags[j]!.max_similarity) {
        flags[j]!.max_similarity = score
      }
      if (score >= threshold) {
        flags[i]!.similar_to.push(plans[j]!.id)
        flags[j]!.similar_to.push(plans[i]!.id)
      }
    }
  }

  // 标记重复并按相似度降序整理 similar_to
  for (const flag of flags) {
    flag.is_duplicate = flag.max_similarity >= threshold
    flag.similar_to.sort()
  }

  const duplicates = flags.filter((f) => f.is_duplicate).length
  const avgMax = flags.length === 0 ? 0 : flags.reduce((sum, f) => sum + f.max_similarity, 0) / flags.length

  return {
    flags,
    stats: {
      total: plans.length,
      duplicates,
      unique: plans.length - duplicates,
      threshold,
      avg_max_similarity: avgMax,
    },
  }
}

/**
 * 过滤重复方案，保留每组相似方案中首个出现的。
 * 被过滤的方案记录与哪个已保留方案相似及相似度，便于审计。
 */
export const filterUniquePlans = (plans: readonly RemixPlan[], options?: SimilarityOptions): UniqueFilterResult => {
  const threshold = options?.threshold ?? 0.7
  const unique: RemixPlan[] = []
  const removed: UniqueFilterResult['removed'] = []

  for (let i = 0; i < plans.length; i++) {
    const current = plans[i]!
    // 只需与已保留方案比较，首个必定保留
    let duplicateOf: { id: string; score: number } | null = null
    for (const kept of unique) {
      const { score } = computePlanSimilarity(current, kept)
      if (score >= threshold) {
        duplicateOf = { id: kept.id, score }
        break
      }
    }
    if (duplicateOf) {
      removed.push({
        plan: current,
        removed_at: i,
        similar_to: duplicateOf.id,
        similarity: duplicateOf.score,
      })
    } else {
      unique.push(current)
    }
  }

  return {
    unique_plans: unique,
    removed,
    stats: {
      total: plans.length,
      removed: removed.length,
      remaining: unique.length,
      threshold,
    },
  }
}
