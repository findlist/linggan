import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PreferenceProfileSchema } from '../src/data/contracts.ts'
import {
  buildPreferenceProfile,
  EVENT_WEIGHTS,
  type ProfileCandidate,
  type ProfileEvent,
} from '../src/analytics/profile-builder.ts'

// 固定时钟保证画像 built_at 可重复
const FIXED_TIME = '2026-07-31T12:00:00.000Z'
const SESSION_ID = 'sess_demo_001'

// 构造模拟候选（与 Candidate 兼容但只保留画像所需字段）
const buildCandidate = (overrides: Partial<ProfileCandidate> & { id: string }): ProfileCandidate => ({
  source_trend: 'trend_demo',
  entities: ['char_a', 'scene_a'],
  risk_level: 'low',
  ...overrides,
})

// 构造模拟事件（与 ProductEvent 兼容但只保留画像所需字段）
const buildEvent = (overrides: Partial<ProfileEvent>): ProfileEvent => ({
  event_type: 'idea_impression',
  idea_id: 'candidate_1',
  session_id: SESSION_ID,
  ...overrides,
})

test('空事件流返回零计数画像，所有维度为空对象', () => {
  const profile = buildPreferenceProfile([], [], SESSION_ID, FIXED_TIME)
  assert.equal(profile.event_count, 0)
  assert.equal(profile.session_id, SESSION_ID)
  assert.deepEqual(profile.idea_scores, {})
  assert.deepEqual(profile.dimension_weights.entity, {})
  assert.deepEqual(profile.dimension_weights.source_trend, {})
  assert.deepEqual(profile.dimension_weights.risk_level, {})
  assert.deepEqual(profile.top_ideas, [])
  // 画像结构通过 Schema 校验
  PreferenceProfileSchema.parse(profile)
})

test('单一 idea_impression 事件累加权重 1 到 idea_scores', () => {
  const events = [buildEvent({ event_type: 'idea_impression', idea_id: 'candidate_1' })]
  const candidates = [buildCandidate({ id: 'candidate_1' })]
  const profile = buildPreferenceProfile(events, candidates, SESSION_ID, FIXED_TIME)
  assert.equal(profile.idea_scores.candidate_1, 1)
  assert.equal(profile.event_count, 1)
  assert.deepEqual(profile.top_ideas, ['candidate_1'])
})

test('多事件按类型权重累加：impression(1) + opened(3) + saved(5) = 9', () => {
  const events = [
    buildEvent({ event_type: 'idea_impression', idea_id: 'candidate_1' }),
    buildEvent({ event_type: 'idea_opened', idea_id: 'candidate_1' }),
    buildEvent({ event_type: 'idea_saved', idea_id: 'candidate_1' }),
  ]
  const candidates = [buildCandidate({ id: 'candidate_1' })]
  const profile = buildPreferenceProfile(events, candidates, SESSION_ID, FIXED_TIME)
  assert.equal(profile.idea_scores.candidate_1, 9)
})

test('idea_hidden 负权降低候选偏好分（识别反感和重复）', () => {
  const events = [
    buildEvent({ event_type: 'idea_saved', idea_id: 'candidate_1' }),
    buildEvent({ event_type: 'idea_hidden', idea_id: 'candidate_1' }),
  ]
  const candidates = [buildCandidate({ id: 'candidate_1' })]
  const profile = buildPreferenceProfile(events, candidates, SESSION_ID, FIXED_TIME)
  // saved(5) + hidden(-3) = 2
  assert.equal(profile.idea_scores.candidate_1, 2)
  // 负分候选不应进入 top_ideas（top_ideas 只保留 score > 0）
  // 但 2 > 0 仍会进入，验证 top_ideas 过滤逻辑
  assert.ok(profile.top_ideas.includes('candidate_1'))
})

test('纯 hidden 事件导致负分，top_ideas 过滤掉负分候选', () => {
  const events = [buildEvent({ event_type: 'idea_hidden', idea_id: 'candidate_1' })]
  const candidates = [buildCandidate({ id: 'candidate_1' })]
  const profile = buildPreferenceProfile(events, candidates, SESSION_ID, FIXED_TIME)
  assert.equal(profile.idea_scores.candidate_1, -3)
  // 负分候选不进入 top_ideas
  assert.deepEqual(profile.top_ideas, [])
  // event_count 仍记录该事件
  assert.equal(profile.event_count, 1)
})

test('候选维度扩散：偏好分按 entities 平分累加到 entity 维度', () => {
  const events = [buildEvent({ event_type: 'idea_saved', idea_id: 'candidate_1' })]
  // saved(5) 平分到 2 个 entity，每个 2.5
  const candidates = [buildCandidate({ id: 'candidate_1', entities: ['char_a', 'char_b'] })]
  const profile = buildPreferenceProfile(events, candidates, SESSION_ID, FIXED_TIME)
  assert.equal(profile.dimension_weights.entity.char_a, 2.5)
  assert.equal(profile.dimension_weights.entity.char_b, 2.5)
})

test('source_trend 和 risk_level 维度累加候选完整偏好分', () => {
  const events = [
    buildEvent({ event_type: 'idea_saved', idea_id: 'candidate_1' }),
    buildEvent({ event_type: 'idea_opened', idea_id: 'candidate_1' }),
  ]
  // saved(5) + opened(3) = 8
  const candidates = [buildCandidate({ id: 'candidate_1', source_trend: 'trend_x', risk_level: 'medium' })]
  const profile = buildPreferenceProfile(events, candidates, SESSION_ID, FIXED_TIME)
  assert.equal(profile.dimension_weights.source_trend.trend_x, 8)
  assert.equal(profile.dimension_weights.risk_level.medium, 8)
})

test('未在候选列表中的 idea_id 不扩散到维度但仍计入 idea_scores', () => {
  const events = [buildEvent({ event_type: 'idea_saved', idea_id: 'candidate_orphan' })]
  const candidates = [buildCandidate({ id: 'candidate_1' })]
  const profile = buildPreferenceProfile(events, candidates, SESSION_ID, FIXED_TIME)
  // idea_scores 仍记录（用户行为应保留）
  assert.equal(profile.idea_scores.candidate_orphan, 5)
  // 但无法反查候选维度，三类维度均为空
  assert.deepEqual(profile.dimension_weights.entity, {})
  assert.deepEqual(profile.dimension_weights.source_trend, {})
  assert.deepEqual(profile.dimension_weights.risk_level, {})
  // top_ideas 仍包含（score > 0）
  assert.deepEqual(profile.top_ideas, ['candidate_orphan'])
})

test('top_ideas 按偏好分降序取前 10', () => {
  // candidate_low: impression(1)，candidate_high: saved(5) + copied(4) = 9
  const events = [
    buildEvent({ event_type: 'idea_impression', idea_id: 'candidate_low' }),
    buildEvent({ event_type: 'idea_saved', idea_id: 'candidate_high' }),
    buildEvent({ event_type: 'prompt_copied', idea_id: 'candidate_high' }),
  ]
  const candidates = [buildCandidate({ id: 'candidate_low' }), buildCandidate({ id: 'candidate_high' })]
  const profile = buildPreferenceProfile(events, candidates, SESSION_ID, FIXED_TIME)
  assert.deepEqual(profile.top_ideas, ['candidate_high', 'candidate_low'])
})

test('跨 session 事件被过滤，只聚合目标 session 的事件', () => {
  const events = [
    buildEvent({ event_type: 'idea_saved', idea_id: 'candidate_1', session_id: SESSION_ID }),
    buildEvent({ event_type: 'idea_saved', idea_id: 'candidate_2', session_id: 'sess_other' }),
  ]
  const candidates = [buildCandidate({ id: 'candidate_1' }), buildCandidate({ id: 'candidate_2' })]
  const profile = buildPreferenceProfile(events, candidates, SESSION_ID, FIXED_TIME)
  assert.equal(profile.idea_scores.candidate_1, 5)
  assert.equal(profile.idea_scores.candidate_2, undefined)
  assert.equal(profile.event_count, 1)
})

test('idea_id 为 null 的事件被跳过（risk_reported 等不针对单个 idea）', () => {
  const events = [
    buildEvent({ event_type: 'risk_reported', idea_id: null }),
    buildEvent({ event_type: 'idea_saved', idea_id: 'candidate_1' }),
  ]
  const candidates = [buildCandidate({ id: 'candidate_1' })]
  const profile = buildPreferenceProfile(events, candidates, SESSION_ID, FIXED_TIME)
  // risk_reported 权重为 0 且 idea_id 为 null，不进入聚合
  assert.equal(profile.event_count, 1)
  assert.equal(profile.idea_scores.candidate_1, 5)
})

test('多候选共享 entity 时，entity 维度权重累加', () => {
  // candidate_a 和 candidate_b 共享 char_shared
  // candidate_a: saved(5)，char_shared 分得 5/2=2.5
  // candidate_b: copied(4)，char_shared 分得 4/1=4
  // char_shared 总权重 = 6.5
  const events = [
    buildEvent({ event_type: 'idea_saved', idea_id: 'candidate_a' }),
    buildEvent({ event_type: 'prompt_copied', idea_id: 'candidate_b' }),
  ]
  const candidates = [
    buildCandidate({ id: 'candidate_a', entities: ['char_shared', 'char_a_only'] }),
    buildCandidate({ id: 'candidate_b', entities: ['char_shared'] }),
  ]
  const profile = buildPreferenceProfile(events, candidates, SESSION_ID, FIXED_TIME)
  assert.equal(profile.dimension_weights.entity.char_shared, 6.5)
  assert.equal(profile.dimension_weights.entity.char_a_only, 2.5)
})

test('EVENT_WEIGHTS 覆盖 9 类核心事件且 saved 权重最高', () => {
  // 验证权重表完整性与排序逻辑：saved(5) > copied/exported(4) > opened(3) > impression(1) > hidden(-3)
  assert.equal(EVENT_WEIGHTS.idea_saved, 5)
  assert.equal(EVENT_WEIGHTS.prompt_copied, 4)
  assert.equal(EVENT_WEIGHTS.idea_exported, 4)
  assert.equal(EVENT_WEIGHTS.idea_opened, 3)
  assert.equal(EVENT_WEIGHTS.idea_impression, 1)
  assert.equal(EVENT_WEIGHTS.idea_hidden, -3)
  // video_created / video_published / risk_reported 权重为 0（留待 D3 权重更新）
  assert.equal(EVENT_WEIGHTS.video_created, 0)
  assert.equal(EVENT_WEIGHTS.video_published, 0)
  assert.equal(EVENT_WEIGHTS.risk_reported, 0)
})

test('画像通过 PreferenceProfileSchema 严格校验', () => {
  const events = [
    buildEvent({ event_type: 'idea_saved', idea_id: 'candidate_1' }),
    buildEvent({ event_type: 'idea_hidden', idea_id: 'candidate_2' }),
  ]
  const candidates = [
    buildCandidate({ id: 'candidate_1', entities: ['char_a', 'char_b'] }),
    buildCandidate({ id: 'candidate_2', entities: ['char_c'] }),
  ]
  const profile = buildPreferenceProfile(events, candidates, SESSION_ID, FIXED_TIME)
  // 不抛错即通过；包含负权重的画像也必须合法
  PreferenceProfileSchema.parse(profile)
})
