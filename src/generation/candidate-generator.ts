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

const clampScore = (value: number): number => Math.max(0, Math.min(100, Math.round(value)))

export const scoreCandidate = (
  input: Pick<CandidateGenerationInput, 'config'> & {
    trend: Trend
    character: Character
    element: Element
  },
): Candidate['score'] => {
  const { config, trend, character, element } = input
  const lifecycle = trend.lifecycle ?? 'evergreen'
  const metrics: Candidate['score']['metrics'] = {
    heat: Math.min(100, (trend.signals.engagement ?? LIFECYCLE_ENGAGEMENT_DEFAULTS[lifecycle] ?? 2000) / 40),
    velocity: (trend.signals.velocity ?? LIFECYCLE_VELOCITY_DEFAULTS[lifecycle] ?? 0.1) * 100,
    contrast: character.traits.includes('冷酷') ? 88 : 76,
    visuality: 84,
    generatability: element.generatability * 100,
    seriality: 72,
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
              score: scoreCandidate({ config, trend, character, element }),
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
