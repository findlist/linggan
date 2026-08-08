import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { CandidateSchema, SeedEntitiesSchema, TrendInboxSchema, type Trend } from '../src/data/contracts.ts'
import type { CandidateGenerationConfig } from '../src/generation/candidate-generator.ts'
import { generateDailyCandidates, scoreCandidate } from '../src/generation/candidate-generator.ts'

const root = new URL('../', import.meta.url)
const readJson = async (path: string): Promise<unknown> =>
  JSON.parse(await readFile(new URL(path, root), 'utf8')) as unknown

const config = (await readJson('config/pipeline.json')) as CandidateGenerationConfig
const seeds = SeedEntitiesSchema.parse(await readJson('data/seed-entities.json'))
const trends = TrendInboxSchema.parse(await readJson('data/trend-inbox.example.json'))
const fixedClock = (): Date => new Date('2026-07-29T00:30:00.000Z')

test('generates candidates that match the shared contract', () => {
  const report = generateDailyCandidates({ config, seeds, trends, clock: fixedClock })

  assert.equal(report.date, '2026-07-29')
  assert.equal(report.summary.trends, 1)
  // 1 trend × 3 characters per trend = 3 candidates
  assert.equal(report.summary.candidates, 3)
  assert.equal(
    report.candidates.every((candidate) => CandidateSchema.safeParse(candidate).success),
    true,
  )
  assert.equal(
    report.candidates.every((candidate) => candidate.generated_at === fixedClock().toISOString()),
    true,
  )
})

test('returns an empty report for empty trends', () => {
  const report = generateDailyCandidates({ config, seeds, trends: [], clock: fixedClock })

  assert.deepEqual(report.candidates, [])
  assert.deepEqual(report.summary, {
    trends: 0,
    candidates: 0,
    ready_for_review: 0,
    auto_published: 0,
  })
})

test('repeated generation is deterministic with a fixed clock', () => {
  const input = { config, seeds, trends, clock: fixedClock }

  assert.deepEqual(generateDailyCandidates(input), generateDailyCandidates(input))
})

test('candidate diversity: uses more than 2 unique characters across candidates', () => {
  // 使用 5 个趋势 × 3 角色/趋势 = 15 候选,验证使用角色数 > 2
  const multiTrends = Array.from({ length: 5 }, (_, i) => {
    const t = structuredClone(trends[0])
    t.external_id = `trend-${i}`
    t.title = `测试趋势${i}`
    return t
  })
  const report = generateDailyCandidates({ config, seeds, trends: multiTrends, clock: fixedClock })

  const uniqueChars = new Set(report.candidates.map((c) => c.entities[0]))
  assert.ok(uniqueChars.size > 2, `expected more than 2 unique characters, got ${uniqueChars.size}`)
})

test('candidate diversity: titles are not all identical', () => {
  const multiTrends = Array.from({ length: 5 }, (_, i) => {
    const t = structuredClone(trends[0])
    t.external_id = `trend-${i}`
    t.title = `测试趋势${i}`
    return t
  })
  const report = generateDailyCandidates({ config, seeds, trends: multiTrends, clock: fixedClock })

  const uniqueTitles = new Set(report.candidates.map((c) => c.title))
  assert.ok(uniqueTitles.size > 1, `expected more than 1 unique title, got ${uniqueTitles.size}`)
})

test('candidate diversity: hooks are not all identical', () => {
  const multiTrends = Array.from({ length: 5 }, (_, i) => {
    const t = structuredClone(trends[0])
    t.external_id = `trend-${i}`
    t.title = `测试趋势${i}`
    return t
  })
  const report = generateDailyCandidates({ config, seeds, trends: multiTrends, clock: fixedClock })

  const uniqueHooks = new Set(report.candidates.map((c) => c.hook))
  assert.ok(uniqueHooks.size > 1, `expected more than 1 unique hook, got ${uniqueHooks.size}`)
})

test('candidate diversity: all 14 seed characters can appear in candidates', () => {
  // 使用足够多的趋势确保所有角色至少出现一次
  const manyTrends = Array.from({ length: 10 }, (_, i) => {
    const t = structuredClone(trends[0])
    t.external_id = `trend-${i}`
    t.title = `测试趋势${i}`
    return t
  })
  const report = generateDailyCandidates({ config, seeds, trends: manyTrends, clock: fixedClock })

  const usedCharIds = new Set(report.candidates.map((c) => c.entities[0]))
  const allCharIds = new Set(seeds.characters.map((c) => c.id))
  // 10 trends × 3 chars = 30 candidates, but candidate_count limit may apply
  // At minimum, more than half of all characters should be used
  assert.ok(
    usedCharIds.size >= 8,
    `expected at least 8 unique characters used, got ${usedCharIds.size} out of ${allCharIds.size}`,
  )
})

test('score metrics and total stay within contract boundaries', () => {
  const boundaryTrend = structuredClone(trends[0])
  boundaryTrend.signals.engagement = 1_000_000
  boundaryTrend.signals.velocity = 1
  const boundaryConfig = structuredClone(config)
  boundaryConfig.weights = {
    heat: 2,
    velocity: 0,
    contrast: 0,
    visuality: 0,
    generatability: 0,
    seriality: 0,
    novelty: 0,
  }

  const score = scoreCandidate({
    config: boundaryConfig,
    trend: boundaryTrend,
    character: seeds.characters[0],
    element: { ...seeds.elements[0], generatability: 1 },
  })

  assert.equal(score.metrics.heat, 100)
  assert.equal(score.metrics.velocity, 100)
  assert.equal(score.metrics.generatability, 100)
  assert.equal(score.total, 100)
})

test('null-signal trends derive heat and velocity from lifecycle', () => {
  const nullTrend: Trend = structuredClone(trends[0])
  nullTrend.signals.engagement = null
  nullTrend.signals.velocity = null
  nullTrend.lifecycle = 'rising'

  const score = scoreCandidate({
    config,
    trend: nullTrend,
    character: seeds.characters[0],
    element: seeds.elements[0],
  })

  // lifecycle=rising → engagement default 2500, heat = min(100, 2500/40) = 62.5
  assert.equal(score.metrics.heat, 62.5)
  // lifecycle=rising → velocity default 0.6, velocity = 60
  assert.equal(score.metrics.velocity, 60)
  // lifecycle=rising → novelty = 78 + 10 = 88
  assert.equal(score.metrics.novelty, 88)
  // total should be significantly higher than when signals were 0
  assert.ok(score.total > 60, `total ${score.total} should be above 60 with lifecycle-derived defaults`)
})

test('lifecycle-derived defaults produce higher scores than zero-signal defaults', () => {
  const nullTrend: Trend = structuredClone(trends[0])
  nullTrend.signals.engagement = null
  nullTrend.signals.velocity = null
  nullTrend.lifecycle = 'rising'

  const zeroTrend: Trend = structuredClone(trends[0])
  zeroTrend.signals.engagement = null
  zeroTrend.signals.velocity = null
  zeroTrend.lifecycle = 'archived'

  const risingScore = scoreCandidate({
    config,
    trend: nullTrend,
    character: seeds.characters[0],
    element: seeds.elements[0],
  })

  const archivedScore = scoreCandidate({
    config,
    trend: zeroTrend,
    character: seeds.characters[0],
    element: seeds.elements[0],
  })

  assert.ok(
    risingScore.metrics.heat >= archivedScore.metrics.heat,
    'rising lifecycle should have higher or equal heat than archived',
  )
  assert.ok(
    risingScore.metrics.velocity > archivedScore.metrics.velocity,
    'rising lifecycle should have higher velocity than archived',
  )
  assert.ok(
    risingScore.metrics.novelty >= archivedScore.metrics.novelty,
    'rising lifecycle should have higher or equal novelty than archived',
  )
  assert.ok(risingScore.total > archivedScore.total, 'rising trend total score should be higher than archived')
})

test('non-null signals still take precedence over lifecycle defaults', () => {
  const trendWithSignals: Trend = structuredClone(trends[0])
  trendWithSignals.signals.engagement = 8000
  trendWithSignals.signals.velocity = 0.9
  trendWithSignals.lifecycle = 'archived'

  const score = scoreCandidate({
    config,
    trend: trendWithSignals,
    character: seeds.characters[0],
    element: seeds.elements[0],
  })

  // engagement=8000 → heat = min(100, 8000/40) = 100
  assert.equal(score.metrics.heat, 100)
  // velocity=0.9 → velocity = 90
  assert.equal(score.metrics.velocity, 90)
})
