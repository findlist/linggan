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

const formatDate = (date: Date, timezone: string): string =>
  new Intl.DateTimeFormat('sv-SE', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)

export const generateDailyCandidates = (input: CandidateGenerationInput): DailyCandidateReport => {
  const { config, seeds, trends } = input
  const generatedAt = input.clock()
  const generatedAtIso = generatedAt.toISOString()
  const canGenerate = seeds.characters.length > 0 && seeds.scenes.length > 0 && seeds.elements.length > 0

  const candidates = canGenerate
    ? trends
        .slice(0, 10)
        .flatMap((trend, trendIndex) =>
          seeds.characters.slice(0, 2).map((character, characterIndex) => {
            const entityIndex = trendIndex + characterIndex
            const scene = seeds.scenes[entityIndex % seeds.scenes.length]
            const element = seeds.elements[entityIndex % seeds.elements.length]
            const candidate = {
              id: `candidate_${trendIndex + 1}_${characterIndex + 1}`,
              title: `${character.name}把${element.name}变成一场史诗挑战`,
              source_trend: trend.external_id,
              entities: [character.id, scene.id, element.id],
              hook: `所有人以为这只是${element.name}，直到${character.name}认真起来。`,
              score: scoreCandidate({ config, trend, character, element }),
              risk_level: trend.risk_level,
              rights_status: character.rights_status,
              status: 'pending_review' as const,
              generated_at: generatedAtIso,
            }

            return CandidateSchema.parse(candidate)
          }),
        )
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
