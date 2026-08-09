import { CandidateSchema } from '../data/contracts.ts'
import type { Candidate, Character, Element, Scene, Trend } from '../data/contracts.ts'

export type CandidateMetric = keyof Candidate['score']['metrics']

export interface CandidateGenerationConfig {
  timezone: string
  limits: {
    candidate_count: number
    publish_score: number
  }
  weights: Record<CandidateMetric, number>
}

export interface CandidateSeedEntities {
  characters: Character[]
  scenes: Scene[]
  elements: Element[]
}

export interface CandidateGenerationInput {
  config: CandidateGenerationConfig
  seeds: CandidateSeedEntities
  trends: Trend[]
  clock: () => Date
}

export interface DailyCandidateReport {
  date: string
  summary: {
    trends: number
    candidates: number
    ready_for_review: number
    auto_published: 0
  }
  candidates: Candidate[]
}

const metricNames: CandidateMetric[] = [
  'heat',
  'velocity',
  'contrast',
  'visuality',
  'generatability',
  'seriality',
  'novelty',
]

/**
 * 当趋势的 engagement 或 velocity 信号为 null（来源未提供量化指标）时,
 * 从趋势的 lifecycle 阶段推导合理的默认值,而非使用 0。
 *
 * 这不是编造数据——lifecycle 是来源已确认的可观测信号:
 * - emerging: 刚出现,热度和增速中等偏高
 * - rising: 正在升温,热度和增速较高
 * - peak: 已达峰值,热度高但增速放缓
 * - declining: 正在降温,热度中等且增速为负
 * - evergreen: 长青内容,热度稳定且增速平缓
 * - archived: 已归档,热度和增速均低
 *
 * engagement 默认值在原始信号同一量级（数千级）,与 /40 公式配合产出 0-100 区间的热度分。
 */
const LIFECYCLE_ENGAGEMENT_DEFAULTS: Record<string, number> = {
  emerging: 2000,
  rising: 2500,
  peak: 2800,
  declining: 1800,
  evergreen: 2200,
  archived: 1200,
}

const LIFECYCLE_VELOCITY_DEFAULTS: Record<string, number> = {
  emerging: 0.8,
  rising: 0.6,
  peak: 0.3,
  declining: 0,
  evergreen: 0.1,
  archived: 0,
}

const LIFECYCLE_NOVELTY_BONUS: Record<string, number> = {
  emerging: 18,
  rising: 10,
  peak: 0,
  declining: -5,
  evergreen: 0,
  archived: -10,
}

/**
 * 性格反差度评估——基于角色 traits 计算角色在不同场景中的反差潜力。
 *
 * 反差度高的角色（如同时拥有冷酷和温柔特质）在创意场景中能产生更大的戏剧张力,
 * 从而获得更高的 contrast 分数。
 */
const CONTRAST_TRAIT_BONUS: Record<string, number> = {
  冷酷: 6,
  热血: 5,
  腹黑: 7,
  温柔: 4,
  理性: 3,
  冒险: 4,
  偏执: 5,
  不服老: 6,
  浪漫: 4,
  随性: 3,
  圆滑: 3,
  缜密: 4,
  数据敏感: 3,
  温暖: 3,
  自律: 2,
  奔波: 2,
  漂泊: 3,
  孤独感: 4,
  专注: 2,
}

const CONTRAST_BASE = 68
const CONTRAST_MAX = 95

const computeContrast = (character: Character): number => {
  let score = CONTRAST_BASE
  for (const trait of character.traits) {
    score += CONTRAST_TRAIT_BONUS[trait] ?? 0
  }
  // 角色拥有越多不同维度的 traits,反差潜力越大（但边际递减）
  if (character.traits.length >= 5) score += 4
  else if (character.traits.length >= 4) score += 2
  return Math.min(CONTRAST_MAX, score)
}

/**
 * 视觉化程度评估——基于元素类别和动作可视性计算画面想象空间。
 *
 * 运动类元素（如台球）有明确的动作和空间,视觉化程度高；
 * 场景类元素（如深夜拉面铺、公司会议室）有环境细节和道具,视觉化程度中等偏高；
 * 抽象元素的视觉化程度取决于动作描述的具体程度。
 */
const ELEMENT_CATEGORY_VISUALITY: Record<string, number> = {
  sport: 92,
  location: 86,
  abstract: 70,
  activity: 84,
  object: 78,
}

const VISUALITY_BASE = 72
const VISUALITY_ACTION_BONUS = 3
const VISUALITY_MAX = 95

const computeVisuality = (element: Element): number => {
  let score = ELEMENT_CATEGORY_VISUALITY[element.category] ?? VISUALITY_BASE
  // 动作越多,画面想象空间越大（但边际递减）
  const actionCount = element.actions?.length ?? 0
  score += Math.min(6, actionCount * VISUALITY_ACTION_BONUS)
  return Math.min(VISUALITY_MAX, score)
}

/**
 * 系列化潜力评估——基于场景 pattern 步骤数和元素类别计算内容延展性。
 *
 * 场景 pattern 步骤越多,故事结构越复杂,可延展为系列内容的潜力越大；
 * 运动和场景类元素天然适合系列化（训练、日常、事件序列）。
 */
const SERIALITY_BASE = 65
const SERIALITY_MAX = 92

const computeSeriality = (scene: Scene, element: Element): number => {
  let score = SERIALITY_BASE
  // 场景 pattern 步骤数越多,结构越复杂,系列化潜力越大
  const patternSteps = scene.pattern?.length ?? 0
  score += Math.min(12, patternSteps * 2)
  // 运动类元素天然有训练/比赛/进步的系列结构
  if (element.category === 'sport') score += 8
  else if (element.category === 'location') score += 5
  else if (element.category === 'activity') score += 4
  // 场景生命周期影响系列化潜力——evergreen 适合长系列
  if (scene.lifecycle === 'evergreen') score += 3
  return Math.min(SERIALITY_MAX, score)
}

const clampScore = (value: number): number => Math.max(0, Math.min(100, Math.round(value)))

export const scoreCandidate = (
  input: Pick<CandidateGenerationInput, 'config'> & {
    trend: Trend
    character: Character
    element: Element
    scene?: Scene
  },
): Candidate['score'] => {
  const { config, trend, character, element, scene } = input
  const lifecycle = trend.lifecycle ?? 'evergreen'
  const metrics: Candidate['score']['metrics'] = {
    heat: Math.min(100, (trend.signals.engagement ?? LIFECYCLE_ENGAGEMENT_DEFAULTS[lifecycle] ?? 2000) / 40),
    velocity: (trend.signals.velocity ?? LIFECYCLE_VELOCITY_DEFAULTS[lifecycle] ?? 0.1) * 100,
    contrast: computeContrast(character),
    visuality: computeVisuality(element),
    generatability: element.generatability * 100,
    seriality: scene ? computeSeriality(scene, element) : SERIALITY_BASE,
    novelty: clampScore(78 + (LIFECYCLE_NOVELTY_BONUS[lifecycle] ?? 0)),
  }
  const total = metricNames.reduce((sum, metric) => sum + metrics[metric] * config.weights[metric], 0)

  return { total: clampScore(total), metrics }
}

/**
 * 候选标题模板池——根据角色名、元素名和趋势标题组合生成多样化标题。
 * 按组合索引选取,确保不同候选产生不同标题文本。
 */
const TITLE_PATTERNS: ((charName: string, elementName: string, trendTitle: string) => string)[] = [
  (c, e) => `${c}把${e}变成一场史诗挑战`,
  (c, e) => `当${c}遇上${e}`,
  (c, e, t) => `${t}·${c}的${e}时刻`,
  (c, e) => `${c}的${e}生存指南`,
  (c, e, t) => `从${e}到${t.slice(0, 8)}:${c}的逆风局`,
  (c, e) => `${e}前夜:${c}做了个决定`,
  (c, e, t) => `${t.slice(0, 8)}之后,${c}和${e}的故事`,
  (c, e) => `如果${c}出现在${e}`,
]

/**
 * 候选钩子模板池——根据角色名、元素名和趋势标题组合生成多样化钩子。
 * 按组合索引选取,确保不同候选产生不同钩子文本。
 */
const HOOK_PATTERNS: ((charName: string, elementName: string, trendTitle: string) => string)[] = [
  (c, e) => `所有人以为这只是${e}，直到${c}认真起来。`,
  (c, e) => `没人想到${e}会变成${c}的主场。`,
  (c, e, t) => `${t.slice(0, 10)}的热度还在涨,但${c}已经看到了${e}背后的机会。`,
  (c, e) => `第一步:${c}走进${e}。接下来发生的事没人预料到。`,
  (c, e) => `为什么${e}总是和${c}过不去?答案比你想的复杂。`,
  (c, e, t) => `如果${t.slice(0, 8)}是一场棋局,${c}的筹码就是${e}。`,
  (c, e) => `${e}不是终点,是${c}的起跑线。`,
  (c, e) => `本以为是普通的${e},结果${c}把它玩出了新花样。`,
]

const formatDate = (date: Date, timezone: string): string =>
  new Intl.DateTimeFormat('sv-SE', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)

/**
 * 每个趋势选取的角色数量上限。
 * 14 个角色（4 archetype + 10 original）轮换使用,
 * 每个趋势分配 3 个不同角色,确保候选多样性。
 */
const CHARACTERS_PER_TREND = 3

export const generateDailyCandidates = (input: CandidateGenerationInput): DailyCandidateReport => {
  const { config, seeds, trends } = input
  const generatedAt = input.clock()
  const generatedAtIso = generatedAt.toISOString()
  const canGenerate = seeds.characters.length > 0 && seeds.scenes.length > 0 && seeds.elements.length > 0

  const candidates = canGenerate
    ? trends
        .slice(0, 10)
        .flatMap((trend, trendIndex) => {
          // 轮换选取角色:每个趋势从不同位置开始选取 CHARACTERS_PER_TREND 个角色
          const charCount = seeds.characters.length
          const charStart = (trendIndex * CHARACTERS_PER_TREND) % charCount
          const selectedChars: Character[] = []
          for (let i = 0; i < Math.min(CHARACTERS_PER_TREND, charCount); i++) {
            selectedChars.push(seeds.characters[(charStart + i) % charCount])
          }

          return selectedChars.map((character, characterIndex) => {
            // 使用组合索引确保不同趋势+角色产生不同场景和元素
            const comboIndex = trendIndex * CHARACTERS_PER_TREND + characterIndex
            const scene = seeds.scenes[comboIndex % seeds.scenes.length]
            const element = seeds.elements[comboIndex % seeds.elements.length]

            // 按组合索引选取标题和钩子模板,确保文本多样化
            const titleFn = TITLE_PATTERNS[comboIndex % TITLE_PATTERNS.length]
            const hookFn = HOOK_PATTERNS[comboIndex % HOOK_PATTERNS.length]
            const trendTitle = trend.title

            const candidate = {
              id: `candidate_${trendIndex + 1}_${characterIndex + 1}`,
              title: titleFn(character.name, element.name, trendTitle),
              source_trend: trend.external_id,
              entities: [character.id, scene.id, element.id],
              hook: hookFn(character.name, element.name, trendTitle),
              score: scoreCandidate({ config, trend, character, element, scene }),
              risk_level: trend.risk_level,
              rights_status: character.rights_status,
              status: 'pending_review' as const,
              generated_at: generatedAtIso,
            }

            return CandidateSchema.parse(candidate)
          })
        })
        .slice(0, config.limits.candidate_count)
    : []

  return {
    date: formatDate(generatedAt, config.timezone),
    summary: {
      trends: trends.length,
      candidates: candidates.length,
      ready_for_review: candidates.filter((candidate) => candidate.score.total >= config.limits.publish_score).length,
      auto_published: 0,
    },
    candidates,
  }
}
