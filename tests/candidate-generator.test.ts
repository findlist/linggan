import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import {
  CandidateSchema,
  SeedEntitiesSchema,
  TrendInboxSchema
} from '../src/data/contracts.ts'
import type { CandidateGenerationConfig } from '../src/generation/candidate-generator.ts'
import {
  generateDailyCandidates,
  scoreCandidate
} from '../src/generation/candidate-generator.ts'

const root = new URL('../', import.meta.url)
const readJson = async (path: string): Promise<unknown> =>
  JSON.parse(await readFile(new URL(path, root), 'utf8')) as unknown

const config = await readJson('config/pipeline.json') as CandidateGenerationConfig
const seeds = SeedEntitiesSchema.parse(await readJson('data/seed-entities.json'))
const trends = TrendInboxSchema.parse(await readJson('data/trend-inbox.example.json'))
const fixedClock = (): Date => new Date('2026-07-29T00:30:00.000Z')

test('generates candidates that match the shared contract', () => {
  const report = generateDailyCandidates({ config, seeds, trends, clock: fixedClock })

  assert.equal(report.date, '2026-07-29')
  assert.equal(report.summary.trends, 1)
  assert.equal(report.summary.candidates, 2)
  assert.equal(report.candidates.every(candidate => CandidateSchema.safeParse(candidate).success), true)
  assert.equal(report.candidates.every(candidate => candidate.generated_at === fixedClock().toISOString()), true)
})

test('returns an empty report for empty trends', () => {
  const report = generateDailyCandidates({ config, seeds, trends: [], clock: fixedClock })

  assert.deepEqual(report.candidates, [])
  assert.deepEqual(report.summary, {
    trends: 0,
    candidates: 0,
    ready_for_review: 0,
    auto_published: 0
  })
})

test('repeated generation is deterministic with a fixed clock', () => {
  const input = { config, seeds, trends, clock: fixedClock }

  assert.deepEqual(generateDailyCandidates(input), generateDailyCandidates(input))
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
    novelty: 0
  }

  const score = scoreCandidate({
    config: boundaryConfig,
    trend: boundaryTrend,
    character: seeds.characters[0],
    element: { ...seeds.elements[0], generatability: 1 }
  })

  assert.equal(score.metrics.heat, 100)
  assert.equal(score.metrics.velocity, 100)
  assert.equal(score.metrics.generatability, 100)
  assert.equal(score.total, 100)
})
