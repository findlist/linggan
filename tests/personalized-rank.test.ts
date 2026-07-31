import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { PreferenceProfile } from '../src/data/contracts.ts'
import { rankCandidates, type RankableCandidate } from '../src/analytics/personalized-rank.ts'
import { buildPreferenceProfile, type ProfileCandidate } from '../src/analytics/profile-builder.ts'

const FIXED_TIME = '2026-07-31T12:00:00.000Z'
const SESSION_ID = 'sess_demo_001'

// 构造可排序候选（含 score.total）
const buildRankable = (overrides: Partial<RankableCandidate> & { id: string }): RankableCandidate => ({
  source_trend: 'trend_demo',
  entities: ['char_a'],
  risk_level: 'low',
  score: { total: 50 },
  ...overrides,
})

// 构造已交互画像：给定候选和事件类型，构建画像
const buildProfile = (
  events: Array<{ event_type: string; idea_id: string }>,
  candidates: ProfileCandidate[],
): PreferenceProfile =>
  buildPreferenceProfile(
    events.map((e) => ({ ...e, session_id: SESSION_ID })),
    candidates,
    SESSION_ID,
    FIXED_TIME,
  )

test('冷启动：无画像时全部候选保留原顺序，reason 标记为 cold', () => {
  const candidates = [
    buildRankable({ id: 'c1', score: { total: 30 } }),
    buildRankable({ id: 'c2', score: { total: 90 } }),
  ]
  const ranked = rankCandidates(candidates, null)
  assert.equal(ranked.length, 2)
  assert.equal(ranked[0].candidate.id, 'c1') // 原顺序
  assert.equal(ranked[1].candidate.id, 'c2')
  assert.equal(ranked[0].reason, 'cold')
  assert.equal(ranked[1].reason, 'cold')
  // 冷启动个性化分 = 基础分，匹配分为 0
  assert.equal(ranked[0].personalized_score, 30)
  assert.equal(ranked[0].match_score, 0)
})

test('冷启动：画像 event_count 为 0 时也降级为 cold', () => {
  const candidates = [buildRankable({ id: 'c1' })]
  const emptyProfile: PreferenceProfile = {
    schema_version: 1,
    session_id: SESSION_ID,
    model_version: 1,
    built_at: FIXED_TIME,
    event_count: 0,
    idea_scores: {},
    dimension_weights: { entity: {}, source_trend: {}, risk_level: {} },
    top_ideas: [],
  }
  const ranked = rankCandidates(candidates, emptyProfile)
  assert.equal(ranked[0].reason, 'cold')
})

test('已交互候选（在 idea_scores 中）排序优先于未交互候选', () => {
  // c1 已 saved（画像命中），c2 未交互但基础分更高
  const candidates = [
    buildRankable({ id: 'c1', score: { total: 50 }, entities: ['char_a'] }),
    buildRankable({ id: 'c2', score: { total: 90 }, entities: ['char_b'] }),
  ]
  const profile = buildProfile(
    [{ event_type: 'idea_saved', idea_id: 'c1' }],
    candidates.map((c) => ({ id: c.id, source_trend: c.source_trend, entities: c.entities, risk_level: c.risk_level })),
  )
  const ranked = rankCandidates(candidates, profile)
  // c1 在 idea_scores 中，排第一
  assert.equal(ranked[0].candidate.id, 'c1')
  assert.equal(ranked[0].reason, 'profiled')
  assert.equal(ranked[1].candidate.id, 'c2')
})

test('共享 entity 的未交互候选获得 match_score 提升', () => {
  // c1 已 saved，含 char_shared；c2 未交互但共享 char_shared
  const candidates = [
    buildRankable({ id: 'c1', score: { total: 50 }, entities: ['char_shared'] }),
    buildRankable({ id: 'c2', score: { total: 50 }, entities: ['char_shared'] }),
    buildRankable({ id: 'c3', score: { total: 50 }, entities: ['char_other'] }),
  ]
  const profile = buildProfile(
    [{ event_type: 'idea_saved', idea_id: 'c1' }],
    candidates.map((c) => ({ id: c.id, source_trend: c.source_trend, entities: c.entities, risk_level: c.risk_level })),
  )
  const ranked = rankCandidates(candidates, profile, { explore_ratio: 0 })
  // c1 排第一（已交互），c2 因共享 entity 的 match_score 高于 c3
  assert.equal(ranked[0].candidate.id, 'c1')
  assert.equal(ranked[1].candidate.id, 'c2')
  assert.equal(ranked[2].candidate.id, 'c3')
  assert.ok(ranked[1].match_score > ranked[2].match_score)
})

test('explore_ratio 保留指定比例的未交互候选作为探索内容', () => {
  // 4 个未交互候选，explore_ratio=0.5 保留 2 个探索
  const candidates = [
    buildRankable({ id: 'c1', score: { total: 80 }, entities: ['char_a'] }),
    buildRankable({ id: 'c2', score: { total: 30 }, entities: ['char_b'] }),
    buildRankable({ id: 'c3', score: { total: 60 }, entities: ['char_c'] }),
    buildRankable({ id: 'c4', score: { total: 40 }, entities: ['char_d'] }),
  ]
  // c1 已交互，其余 3 个未交互；explore_ratio=0.5 → 探索 1-2 个
  const profile = buildProfile(
    [{ event_type: 'idea_saved', idea_id: 'c1' }],
    candidates.map((c) => ({ id: c.id, source_trend: c.source_trend, entities: c.entities, risk_level: c.risk_level })),
  )
  const ranked = rankCandidates(candidates, profile, { explore_ratio: 0.5 })
  const exploreItems = ranked.filter((r) => r.reason === 'explore')
  // 3 个未交互候选 * 0.5 = 1.5 → round = 2 个探索
  assert.equal(exploreItems.length, 2)
  // 探索项保留原顺序（c2 在 c3 前）
  assert.equal(exploreItems[0].candidate.id, 'c2')
  assert.equal(exploreItems[1].candidate.id, 'c3')
})

test('match_score 归一化到 0-100 不溢出', () => {
  // 大量 saved 事件让 entity 权重累加很高，但 match_score 仍 ≤ 100
  const candidates = [buildRankable({ id: 'c1', score: { total: 50 }, entities: ['char_hot'] })]
  const events = Array.from({ length: 20 }, () => ({
    event_type: 'idea_saved',
    idea_id: 'c1',
  }))
  const profile = buildProfile(
    events,
    candidates.map((c) => ({ id: c.id, source_trend: c.source_trend, entities: c.entities, risk_level: c.risk_level })),
  )
  // 候选本身已交互，用另一个共享 char_hot 的候选测试 match_score
  const testCandidates = [buildRankable({ id: 'c_other', score: { total: 50 }, entities: ['char_hot'] })]
  const ranked = rankCandidates(testCandidates, profile, { explore_ratio: 0 })
  assert.ok(ranked[0].match_score <= 100, `match_score ${ranked[0].match_score} should be <= 100`)
  assert.ok(ranked[0].match_score > 0, 'shared entity should produce positive match_score')
})

test('idea_hidden 负权候选仍可被排序，match_score 反映负偏好', () => {
  // c1 被 hidden（-3），其 entity 权重为负；共享该 entity 的 c2 match_score 应为 0（负值被 clamp 到 0）
  const candidates = [
    buildRankable({ id: 'c1', score: { total: 50 }, entities: ['char_disliked'] }),
    buildRankable({ id: 'c2', score: { total: 50 }, entities: ['char_disliked'] }),
  ]
  const profile = buildProfile(
    [{ event_type: 'idea_hidden', idea_id: 'c1' }],
    candidates.map((c) => ({ id: c.id, source_trend: c.source_trend, entities: c.entities, risk_level: c.risk_level })),
  )
  const ranked = rankCandidates(candidates, profile, { explore_ratio: 0 })
  // c1 在 idea_scores 中（虽为负），排第一；c2 共享负权 entity，match_score 被 clamp 到 0
  assert.equal(ranked[0].candidate.id, 'c1')
  assert.equal(ranked[1].candidate.id, 'c2')
  assert.equal(ranked[1].match_score, 0)
})

test('排序稳定性：同分候选保留原顺序（stable sort）', () => {
  // 两个候选分数和画像匹配完全相同，原顺序应保留
  const candidates = [
    buildRankable({ id: 'c_first', score: { total: 50 }, entities: ['char_same'] }),
    buildRankable({ id: 'c_second', score: { total: 50 }, entities: ['char_same'] }),
  ]
  // 都已交互，权重相同
  const profile = buildProfile(
    [
      { event_type: 'idea_saved', idea_id: 'c_first' },
      { event_type: 'idea_saved', idea_id: 'c_second' },
    ],
    candidates.map((c) => ({ id: c.id, source_trend: c.source_trend, entities: c.entities, risk_level: c.risk_level })),
  )
  const ranked = rankCandidates(candidates, profile)
  assert.equal(ranked[0].candidate.id, 'c_first')
  assert.equal(ranked[1].candidate.id, 'c_second')
  assert.equal(ranked[0].personalized_score, ranked[1].personalized_score)
})

test('个性化分公式：base_score * 0.6 + match_score * 0.4（默认权重）', () => {
  // 构造 match_score 已知场景：c2 只共享 char_shared，source_trend/risk_level 与 c1 不同
  // c1 saved(5) → char_shared 权重 5（maxWeight=5）
  // c2 raw = entity 命中 5 + source_trend 命中 0 + risk_level 命中 0 = 5
  // match_score = (5/(5*3))*100 = 33.33 → round 33
  // personalized = 50*0.6 + 33*0.4 = 30 + 13.2 = 43.2 → round 43
  const candidates = [
    buildRankable({
      id: 'c1',
      score: { total: 50 },
      source_trend: 'trend_a',
      risk_level: 'low',
      entities: ['char_shared'],
    }),
  ]
  const profile = buildProfile(
    [{ event_type: 'idea_saved', idea_id: 'c1' }],
    candidates.map((c) => ({ id: c.id, source_trend: c.source_trend, entities: c.entities, risk_level: c.risk_level })),
  )
  const testCandidates = [
    buildRankable({
      id: 'c2',
      score: { total: 50 },
      source_trend: 'trend_b',
      risk_level: 'medium',
      entities: ['char_shared'],
    }),
  ]
  const ranked = rankCandidates(testCandidates, profile, { explore_ratio: 0 })
  assert.equal(ranked[0].base_score, 50)
  assert.equal(ranked[0].match_score, 33)
  assert.equal(ranked[0].personalized_score, 43)
})
