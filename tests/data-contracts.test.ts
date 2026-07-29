import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import {
  CandidateSchema,
  CharacterSchema,
  ElementSchema,
  SeedEntitiesSchema,
  TaxonomySchema,
  TrendInboxSchema,
  TrendSchema
} from '../src/data/contracts.ts'

const root = new URL('../', import.meta.url)
const readJson = async (path: string): Promise<unknown> =>
  JSON.parse(await readFile(new URL(path, root), 'utf8')) as unknown

const validCandidate = {
  id: 'candidate_1_1',
  title: '冷酷剑客把台球变成一场史诗挑战',
  source_trend: 'example-001',
  entities: ['char_archetype_swordsman', 'scene_duel_reversal', 'element_billiards'],
  hook: '所有人以为这只是台球，直到冷酷剑客认真起来。',
  score: {
    total: 82,
    metrics: {
      heat: 80,
      velocity: 74,
      contrast: 88,
      visuality: 84,
      generatability: 85,
      seriality: 72,
      novelty: 78
    }
  },
  risk_level: 'low',
  rights_status: 'original',
  status: 'pending_review',
  generated_at: '2026-07-29T00:00:00.000Z'
}

test('seed entities match the shared contract', async () => {
  assert.equal(SeedEntitiesSchema.safeParse(await readJson('data/seed-entities.json')).success, true)
})

test('taxonomy matches the shared contract', async () => {
  assert.equal(TaxonomySchema.safeParse(await readJson('data/taxonomy.json')).success, true)
})

test('trend inbox example matches the shared contract', async () => {
  assert.equal(TrendInboxSchema.safeParse(await readJson('data/trend-inbox.example.json')).success, true)
})

test('character rejects an unsupported rights status', () => {
  const character = {
    id: 'char_test',
    name: '测试角色',
    kind: 'archetype',
    media: '原创',
    traits: ['理性'],
    abilities: ['推理'],
    relations: [],
    rights_status: 'copied'
  }

  assert.equal(CharacterSchema.safeParse(character).success, false)
})

test('trend rejects a missing source', () => {
  const trend = {
    external_id: 'trend-1',
    title: '测试趋势',
    source_url: 'https://example.com/trend-1',
    observed_at: '2026-07-29T00:00:00.000Z',
    signals: { rank: 1, engagement: 10, velocity: 0.5 },
    aliases: [],
    lifecycle: 'rising',
    rights_status: 'reference_only',
    risk_level: 'low'
  }

  assert.equal(TrendSchema.safeParse(trend).success, false)
})

test('trend rejects an invalid source URL', () => {
  const trend = {
    external_id: 'trend-1',
    title: '测试趋势',
    source: 'fixture',
    source_url: 'not-a-url',
    observed_at: '2026-07-29T00:00:00.000Z',
    signals: { rank: 1, engagement: 10, velocity: 0.5 },
    aliases: [],
    lifecycle: 'rising',
    rights_status: 'reference_only',
    risk_level: 'low'
  }

  assert.equal(TrendSchema.safeParse(trend).success, false)
})

test('trend rejects velocity above its normalized range', () => {
  const trend = {
    external_id: 'trend-1',
    title: '测试趋势',
    source: 'fixture',
    source_url: 'https://example.com/trend-1',
    observed_at: '2026-07-29T00:00:00.000Z',
    signals: { rank: 1, engagement: 10, velocity: 1.01 },
    aliases: [],
    lifecycle: 'rising',
    rights_status: 'reference_only',
    risk_level: 'low'
  }

  assert.equal(TrendSchema.safeParse(trend).success, false)
})

test('element rejects generatability above one', () => {
  const element = {
    id: 'element_test',
    name: '测试元素',
    category: 'prop',
    actions: ['旋转'],
    generatability: 1.1
  }

  assert.equal(ElementSchema.safeParse(element).success, false)
})

test('candidate accepts scores at both boundaries', () => {
  const candidate = structuredClone(validCandidate)
  candidate.score.total = 0
  candidate.score.metrics.heat = 100

  assert.equal(CandidateSchema.safeParse(candidate).success, true)
})

test('candidate rejects a total score above 100', () => {
  const candidate = structuredClone(validCandidate)
  candidate.score.total = 101

  assert.equal(CandidateSchema.safeParse(candidate).success, false)
})

test('candidate rejects an out-of-range component score', () => {
  const candidate = structuredClone(validCandidate)
  candidate.score.metrics.novelty = -1

  assert.equal(CandidateSchema.safeParse(candidate).success, false)
})

test('seed entities reject duplicate IDs across collections', async () => {
  const seed = await readJson('data/seed-entities.json') as {
    characters: Array<Record<string, unknown>>
    scenes: Array<Record<string, unknown>>
  }
  seed.scenes[0].id = seed.characters[0].id

  assert.equal(SeedEntitiesSchema.safeParse(seed).success, false)
})

test('taxonomy rejects duplicate values', async () => {
  const taxonomy = await readJson('data/taxonomy.json') as Record<string, unknown>
  const media = taxonomy.media as string[]
  taxonomy.media = [...media, media[0]]

  assert.equal(TaxonomySchema.safeParse(taxonomy).success, false)
})
