import assert from 'node:assert/strict'
import { test } from 'node:test'
import { RankingWeightSnapshotSchema } from '../src/data/contracts.ts'
import type { RankingWeightSnapshot } from '../src/data/contracts.ts'
import {
  buildWeeklyWeightSnapshot,
  findPreviousSnapshot,
  getIsoWeekId,
  DEFAULT_WEIGHTS,
  MIN_SAMPLE_SIZE,
  MAX_CHANGE_RATIO,
  type WeightEvent,
} from '../src/analytics/weight-snapshot.ts'

const FIXED_TIME = '2026-07-31T12:00:00.000Z'
const WEEK_ID = '2026-W31'

// 构造一个合法的权重事件，允许覆盖字段
const buildEvent = (overrides: Partial<WeightEvent> = {}): WeightEvent => ({
  event_type: 'idea_impression',
  idea_id: 'idea_001',
  session_id: 'sess_001',
  occurred_at: FIXED_TIME,
  ...overrides,
})

// 构造充足样本（>= MIN_SAMPLE_SIZE）的事件流，默认 10 个 idea 分布在 5 个 session
const buildSufficientEvents = (count = MIN_SAMPLE_SIZE + 10): WeightEvent[] =>
  Array.from({ length: count }, (_, i) =>
    buildEvent({
      event_type: 'idea_impression',
      idea_id: `idea_${i % 10}`,
      session_id: `sess_${i % 5}`,
    }),
  )

// 构造一个合法的上周快照，允许覆盖 weights
const buildPreviousSnapshot = (overrides: Partial<RankingWeightSnapshot> = {}): RankingWeightSnapshot => ({
  schema_version: 1,
  week_id: '2026-W30',
  rule_version: 1,
  computed_at: '2026-07-24T12:00:00.000Z',
  previous_week_id: null,
  input_stats: {
    event_count: 100,
    session_count: 10,
    idea_count: 20,
    by_type: { idea_impression: 60, idea_opened: 20, idea_saved: 10, prompt_copied: 5, idea_exported: 5 },
  },
  weights: { ...DEFAULT_WEIGHTS },
  changes: { base_ratio: 0, match_ratio: 0, explore_ratio: 0, event_weights: {} },
  ...overrides,
})

/* ----------------------- getIsoWeekId ----------------------- */

test('getIsoWeekId 返回 ISO 8601 周标识格式 YYYY-Www', () => {
  // 2026-07-31 是周四，属于 2026-W31
  const weekId = getIsoWeekId(new Date('2026-07-31T12:00:00.000Z'))
  assert.match(weekId, /^\d{4}-W\d{2}$/u)
  assert.equal(weekId, '2026-W31')
})

test('getIsoWeekId 周一和周日属于同一 ISO 周', () => {
  // 2026-W31: 周一 2026-07-27 ~ 周日 2026-08-02
  assert.equal(getIsoWeekId(new Date('2026-07-27T00:00:00.000Z')), '2026-W31')
  assert.equal(getIsoWeekId(new Date('2026-08-02T23:59:59.000Z')), '2026-W31')
})

test('getIsoWeekId 跨年时归属正确的 ISO 周', () => {
  // 2025-12-29 周一属于 2026-W01（ISO 周第一周包含该年第一个周四）
  assert.equal(getIsoWeekId(new Date('2025-12-29T00:00:00.000Z')), '2026-W01')
})

/* ----------------------- DEFAULT_WEIGHTS ----------------------- */

test('DEFAULT_WEIGHTS 与 personalized-rank 默认值一致', () => {
  assert.equal(DEFAULT_WEIGHTS.base_ratio, 0.6)
  assert.equal(DEFAULT_WEIGHTS.match_ratio, 0.4)
  assert.equal(DEFAULT_WEIGHTS.explore_ratio, 0.15)
  // 9 类事件权重全覆盖
  assert.equal(Object.keys(DEFAULT_WEIGHTS.event_weights).length, 9)
  assert.equal(DEFAULT_WEIGHTS.event_weights.idea_saved, 5)
  assert.equal(DEFAULT_WEIGHTS.event_weights.idea_hidden, -3)
})

/* ----------------------- 首次运行 ----------------------- */

test('首次运行（previous=null）使用 DEFAULT_WEIGHTS 作为基准', () => {
  const events = buildSufficientEvents()
  const snapshot = buildWeeklyWeightSnapshot(events, WEEK_ID, null, FIXED_TIME)
  assert.equal(snapshot.previous_week_id, null)
  assert.equal(snapshot.week_id, WEEK_ID)
  // 首次运行时 weights 可能因调整而变化，但基准是 DEFAULT_WEIGHTS
  assert.equal(snapshot.rule_version, 1)
})

/* ----------------------- 样本不足 ----------------------- */

test('样本不足（< MIN_SAMPLE_SIZE）时保持原权重，changes 全 0', () => {
  const previous = buildPreviousSnapshot()
  const insufficientEvents = Array.from({ length: MIN_SAMPLE_SIZE - 1 }, (_, i) => buildEvent({ idea_id: `idea_${i}` }))
  const snapshot = buildWeeklyWeightSnapshot(insufficientEvents, WEEK_ID, previous, FIXED_TIME)
  assert.equal(snapshot.input_stats.event_count, MIN_SAMPLE_SIZE - 1)
  assert.equal(snapshot.changes.base_ratio, 0)
  assert.equal(snapshot.changes.match_ratio, 0)
  assert.equal(snapshot.changes.explore_ratio, 0)
  // weights 与 previous 一致
  assert.deepEqual(snapshot.weights, previous.weights)
})

test('空事件流时样本不足降级，保持原权重', () => {
  const previous = buildPreviousSnapshot()
  const snapshot = buildWeeklyWeightSnapshot([], WEEK_ID, previous, FIXED_TIME)
  assert.equal(snapshot.input_stats.event_count, 0)
  assert.equal(snapshot.input_stats.session_count, 0)
  assert.equal(snapshot.input_stats.idea_count, 0)
  assert.deepEqual(snapshot.changes, { base_ratio: 0, match_ratio: 0, explore_ratio: 0, event_weights: {} })
  assert.deepEqual(snapshot.weights, previous.weights)
})

test('样本不足时 previous_week_id 仍正确链接上周', () => {
  const previous = buildPreviousSnapshot()
  const snapshot = buildWeeklyWeightSnapshot([], WEEK_ID, previous, FIXED_TIME)
  assert.equal(snapshot.previous_week_id, '2026-W30')
})

/* ----------------------- findPreviousSnapshot（调度重复执行保护） ----------------------- */

test('findPreviousSnapshot 空列表返回 null', () => {
  assert.equal(findPreviousSnapshot([], WEEK_ID), null)
})

test('findPreviousSnapshot 仅存在同周快照时返回 null（首次运行或回溯重算）', () => {
  const sameWeek = buildPreviousSnapshot({ week_id: WEEK_ID })
  assert.equal(findPreviousSnapshot([sameWeek], WEEK_ID), null)
})

test('findPreviousSnapshot 跳过最新同周快照，返回最近的异周快照', () => {
  const week30 = buildPreviousSnapshot({ week_id: '2026-W30' })
  const week29 = buildPreviousSnapshot({ week_id: '2026-W29', computed_at: '2026-07-17T12:00:00.000Z' })
  // list() 语义：按 computed_at 倒序，最新的是本周重复运行产生的同周快照
  const sameWeekRerun = buildPreviousSnapshot({ week_id: WEEK_ID, computed_at: '2026-07-31T18:00:00.000Z' })
  const previous = findPreviousSnapshot([sameWeekRerun, week30, week29], WEEK_ID)
  assert.ok(previous)
  assert.equal(previous.week_id, '2026-W30')
})

test('同周重复运行时基准取上周快照，权重不被二次调整', () => {
  // 第一周：充足样本生成 W30 快照（正向交互率高，base_ratio 应上调）
  const events = [
    ...Array.from({ length: 30 }, () => buildEvent({ event_type: 'idea_saved', idea_id: 'idea_a' })),
    ...Array.from({ length: 30 }, () => buildEvent({ event_type: 'idea_impression', idea_id: 'idea_b' })),
  ]
  const week30Snapshot = buildWeeklyWeightSnapshot(events, '2026-W30', null, FIXED_TIME)

  // 首次计算 W31：以 W30 为基准
  const firstRun = buildWeeklyWeightSnapshot(events, WEEK_ID, week30Snapshot, FIXED_TIME)

  // 调度重复触发：存储里最新快照是本周的 firstRun，基准必须仍取 W30 而非自身
  const rerunPrevious = findPreviousSnapshot([firstRun, week30Snapshot], WEEK_ID)
  assert.ok(rerunPrevious)
  assert.equal(rerunPrevious.week_id, '2026-W30')
  const rerun = buildWeeklyWeightSnapshot(events, WEEK_ID, rerunPrevious, FIXED_TIME)

  // 同一事件流 + 同一基准 → 权重完全一致，未发生二次调整
  assert.deepEqual(rerun.weights, firstRun.weights)
  assert.equal(rerun.previous_week_id, firstRun.previous_week_id)
})

/* ----------------------- 单次变化不超过 10% ----------------------- */

test('单次权重变化不超过 MAX_CHANGE_RATIO（10%）', () => {
  const previous = buildPreviousSnapshot({
    weights: { ...DEFAULT_WEIGHTS, base_ratio: 0.5, match_ratio: 0.5, explore_ratio: 0.2 },
  })
  // 构造极端正向交互率事件流，试图让 base_ratio 大幅增加
  const events = Array.from({ length: 100 }, (_, i) =>
    buildEvent({
      event_type: 'idea_saved',
      idea_id: `idea_${i % 3}`, // 低多样性，只有 3 个 idea
      session_id: `sess_${i % 2}`,
    }),
  )
  const snapshot = buildWeeklyWeightSnapshot(events, WEEK_ID, previous, FIXED_TIME)
  // base_ratio 变化量绝对值不超过 0.5 * 0.1 = 0.05
  const maxChange = 0.5 * MAX_CHANGE_RATIO
  assert.ok(Math.abs(snapshot.changes.base_ratio) <= maxChange + 1e-9)
  assert.ok(Math.abs(snapshot.changes.match_ratio) <= maxChange + 1e-9)
  // explore_ratio 基准 0.2，最大变化 0.02
  const exploreMaxChange = 0.2 * MAX_CHANGE_RATIO
  assert.ok(Math.abs(snapshot.changes.explore_ratio) <= exploreMaxChange + 1e-9)
})

test('连续多周更新权重逐步收敛不发散', () => {
  // 模拟 4 周持续高正向交互，验证 base_ratio 每周最多增 10%，不会跳变
  let previous: RankingWeightSnapshot | null = null
  const events = Array.from({ length: 100 }, (_, i) =>
    buildEvent({
      event_type: 'idea_saved',
      idea_id: `idea_${i % 5}`,
      session_id: `sess_${i % 3}`,
    }),
  )
  for (let week = 1; week <= 4; week++) {
    const weekId = `2026-W${String(30 + week).padStart(2, '0')}`
    const snapshot = buildWeeklyWeightSnapshot(events, weekId, previous, FIXED_TIME)
    if (previous) {
      const maxChange: number = previous.weights.base_ratio * MAX_CHANGE_RATIO
      assert.ok(Math.abs(snapshot.changes.base_ratio) <= maxChange + 1e-9)
    }
    previous = snapshot
  }
  // 4 周后 base_ratio 应该有所增加（持续高正向），但不超过 0.6 * (1.1)^4 ≈ 0.878
  if (!previous) throw new Error('previous should not be null after 4 weeks')
  assert.ok(previous.weights.base_ratio > DEFAULT_WEIGHTS.base_ratio)
  assert.ok(previous.weights.base_ratio <= 0.88)
})

/* ----------------------- 权重调整方向 ----------------------- */

test('正向交互率高（>30%）时 base_ratio 增、match_ratio 减', () => {
  const previous = buildPreviousSnapshot()
  // 60 事件中 30 个 saved（50% 正向交互率 > 30%）
  const events = [
    ...Array.from({ length: 30 }, () => buildEvent({ event_type: 'idea_saved', idea_id: 'idea_a' })),
    ...Array.from({ length: 30 }, () => buildEvent({ event_type: 'idea_impression', idea_id: 'idea_b' })),
  ]
  const snapshot = buildWeeklyWeightSnapshot(events, WEEK_ID, previous, FIXED_TIME)
  assert.ok(snapshot.changes.base_ratio > 0, 'base_ratio should increase when positive rate is high')
  assert.ok(snapshot.changes.match_ratio < 0, 'match_ratio should decrease (complement of base_ratio)')
})

test('正向交互率低（<10%）时 match_ratio 增、base_ratio 减', () => {
  const previous = buildPreviousSnapshot()
  // 60 事件中只有 3 个 saved（5% 正向交互率 < 10%）
  const events = [
    ...Array.from({ length: 3 }, () => buildEvent({ event_type: 'idea_saved', idea_id: 'idea_a' })),
    ...Array.from({ length: 57 }, () => buildEvent({ event_type: 'idea_impression', idea_id: 'idea_b' })),
  ]
  const snapshot = buildWeeklyWeightSnapshot(events, WEEK_ID, previous, FIXED_TIME)
  assert.ok(snapshot.changes.match_ratio > 0, 'match_ratio should increase when positive rate is low')
  assert.ok(snapshot.changes.base_ratio < 0, 'base_ratio should decrease (complement of match_ratio)')
})

test('idea 多样性低（<0.3）时 explore_ratio 增', () => {
  const previous = buildPreviousSnapshot()
  // 60 事件但只有 10 个不同 idea，diversity = 10/60 ≈ 0.167 < 0.3
  const events = Array.from({ length: 60 }, (_, i) =>
    buildEvent({
      event_type: 'idea_impression',
      idea_id: `idea_${i % 10}`,
    }),
  )
  const snapshot = buildWeeklyWeightSnapshot(events, WEEK_ID, previous, FIXED_TIME)
  assert.ok(snapshot.changes.explore_ratio > 0, 'explore_ratio should increase when diversity is low')
})

test('idea 多样性高（>0.6）时 explore_ratio 减', () => {
  const previous = buildPreviousSnapshot()
  // 60 事件有 50 个不同 idea，diversity = 50/60 ≈ 0.83 > 0.6
  const events = Array.from({ length: 60 }, (_, i) =>
    buildEvent({
      event_type: 'idea_impression',
      idea_id: `idea_${i % 50}`,
    }),
  )
  const snapshot = buildWeeklyWeightSnapshot(events, WEEK_ID, previous, FIXED_TIME)
  assert.ok(snapshot.changes.explore_ratio < 0, 'explore_ratio should decrease when diversity is high')
})

/* ----------------------- 可解释性 ----------------------- */

test('input_stats 正确统计事件数、会话数、创意数和按类型分布', () => {
  const events = [
    buildEvent({ event_type: 'idea_saved', idea_id: 'idea_1', session_id: 'sess_a' }),
    buildEvent({ event_type: 'idea_saved', idea_id: 'idea_2', session_id: 'sess_a' }),
    buildEvent({ event_type: 'idea_opened', idea_id: 'idea_1', session_id: 'sess_b' }),
    buildEvent({ event_type: 'idea_impression', idea_id: null, session_id: 'sess_b' }),
  ]
  const snapshot = buildWeeklyWeightSnapshot(events, WEEK_ID, null, FIXED_TIME)
  assert.equal(snapshot.input_stats.event_count, 4)
  assert.equal(snapshot.input_stats.session_count, 2)
  assert.equal(snapshot.input_stats.idea_count, 2) // idea_1, idea_2（null 不计入）
  assert.equal(snapshot.input_stats.by_type.idea_saved, 2)
  assert.equal(snapshot.input_stats.by_type.idea_opened, 1)
  assert.equal(snapshot.input_stats.by_type.idea_impression, 1)
})

test('null idea_id 事件不计入 idea_count 但计入 event_count', () => {
  const events = [
    buildEvent({ event_type: 'risk_reported', idea_id: null, session_id: 'sess_a' }),
    buildEvent({ event_type: 'idea_impression', idea_id: 'idea_1', session_id: 'sess_a' }),
  ]
  const snapshot = buildWeeklyWeightSnapshot(events, WEEK_ID, null, FIXED_TIME)
  assert.equal(snapshot.input_stats.event_count, 2)
  assert.equal(snapshot.input_stats.idea_count, 1)
  assert.equal(snapshot.input_stats.by_type.risk_reported, 1)
})

/* ----------------------- Schema 校验 ----------------------- */

test('快照通过 RankingWeightSnapshotSchema 严格校验', () => {
  const events = buildSufficientEvents()
  const snapshot = buildWeeklyWeightSnapshot(events, WEEK_ID, null, FIXED_TIME)
  const result = RankingWeightSnapshotSchema.safeParse(snapshot)
  assert.equal(result.success, true)
})

test('D4 带探索效果的快照通过 Schema 校验', () => {
  // 构造带探索曝光和正向交互的事件流
  const events: WeightEvent[] = [
    ...Array.from({ length: 50 }, (_, i) => buildEvent({ idea_id: `idea_${i % 10}`, session_id: `sess_${i % 5}` })),
    ...Array.from({ length: 10 }, (_, i) =>
      buildEvent({
        event_type: 'idea_impression',
        idea_id: `explore_${i}`,
        payload: { reason: 'explore' },
      }),
    ),
    ...Array.from({ length: 5 }, (_, i) =>
      buildEvent({
        event_type: 'idea_saved',
        idea_id: `explore_${i}`,
        payload: null,
      }),
    ),
  ]
  const snapshot = buildWeeklyWeightSnapshot(events, WEEK_ID, null, FIXED_TIME)
  const result = RankingWeightSnapshotSchema.safeParse(snapshot)
  assert.equal(result.success, true)
  assert.ok(snapshot.input_stats.explore_stats, 'explore_stats 应被填充')
  assert.equal(snapshot.input_stats.explore_stats.unique_explore_ideas, 10)
  assert.equal(snapshot.input_stats.explore_stats.explored_with_interaction, 5)
})

test('WeekIdSchema 拒绝非法周标识格式', () => {
  const events = buildSufficientEvents()
  // 直接构造非法 week_id 的快照对象，验证 Schema 拒绝
  const snapshot = buildWeeklyWeightSnapshot(events, WEEK_ID, null, FIXED_TIME)
  const badSnapshot = { ...snapshot, week_id: '2026-W99' }
  assert.equal(RankingWeightSnapshotSchema.safeParse(badSnapshot).success, false)
  const badSnapshot2 = { ...snapshot, week_id: '2026-31' }
  assert.equal(RankingWeightSnapshotSchema.safeParse(badSnapshot2).success, false)
})

/* ----------------------- D4 探索效果统计 ----------------------- */

test('D4 无探索曝光时 explore_stats 为 null', () => {
  const events = buildSufficientEvents()
  const snapshot = buildWeeklyWeightSnapshot(events, WEEK_ID, null, FIXED_TIME)
  assert.equal(snapshot.input_stats.explore_stats, null)
})

test('D4 有探索曝光时 explore_stats 正确统计', () => {
  // 60 个普通事件 + 8 个探索曝光 + 3 个正向交互
  const events: WeightEvent[] = [
    ...Array.from({ length: 50 }, (_, i) => buildEvent({ idea_id: `idea_${i % 10}`, session_id: `sess_${i % 5}` })),
    ...Array.from({ length: 8 }, (_, i) =>
      buildEvent({
        event_type: 'idea_impression',
        idea_id: `explore_${i}`,
        payload: { reason: 'explore' },
      }),
    ),
    ...Array.from({ length: 3 }, (_, i) =>
      buildEvent({
        event_type: 'idea_saved',
        idea_id: `explore_${i}`,
        payload: null,
      }),
    ),
  ]
  const snapshot = buildWeeklyWeightSnapshot(events, WEEK_ID, null, FIXED_TIME)
  const exploreStats = snapshot.input_stats.explore_stats
  assert.ok(exploreStats, 'explore_stats 应被填充')
  assert.equal(exploreStats.explore_impressions, 8)
  assert.equal(exploreStats.unique_explore_ideas, 8)
  assert.equal(exploreStats.explored_with_interaction, 3)
  assert.equal(exploreStats.interaction_rate, 3 / 8)
})

test('D4 探索交互率高（>30%）时 explore_ratio 略减', () => {
  const previous = buildPreviousSnapshot()
  // 60 个事件中 10 个探索 idea，7 个有正向交互（interaction_rate=0.7 > 0.3）
  // diversity = 20/60 ≈ 0.33（在 0.3-0.6 之间，不触发 diversity 信号）
  const events: WeightEvent[] = [
    ...Array.from({ length: 50 }, (_, i) => buildEvent({ idea_id: `idea_${i % 20}`, session_id: `sess_${i % 5}` })),
    ...Array.from({ length: 10 }, (_, i) =>
      buildEvent({
        event_type: 'idea_impression',
        idea_id: `explore_${i}`,
        payload: { reason: 'explore' },
      }),
    ),
    ...Array.from({ length: 7 }, (_, i) =>
      buildEvent({
        event_type: 'idea_saved',
        idea_id: `explore_${i}`,
        payload: null,
      }),
    ),
  ]
  const snapshot = buildWeeklyWeightSnapshot(events, WEEK_ID, previous, FIXED_TIME)
  // 探索交互率高 → explore_ratio 应略减（effectDelta = -ADJUSTMENT_STEP）
  assert.ok(
    snapshot.changes.explore_ratio < 0,
    `探索交互率高时 explore_ratio 应略减，实际变化 ${snapshot.changes.explore_ratio}`,
  )
})

test('D4 探索交互率低（<10%）时 explore_ratio 略增', () => {
  const previous = buildPreviousSnapshot()
  // 60 个事件中 10 个探索 idea，只有 0 个有正向交互（interaction_rate=0 < 0.1）
  // unique_ideas = 20(普通) + 10(探索) = 30，diversity = 30/60 = 0.5（在 0.3-0.6 之间，不触发 diversity 信号）
  const events: WeightEvent[] = [
    ...Array.from({ length: 50 }, (_, i) => buildEvent({ idea_id: `idea_${i % 20}`, session_id: `sess_${i % 5}` })),
    ...Array.from({ length: 10 }, (_, i) =>
      buildEvent({
        event_type: 'idea_impression',
        idea_id: `explore_${i}`,
        payload: { reason: 'explore' },
      }),
    ),
  ]
  const snapshot = buildWeeklyWeightSnapshot(events, WEEK_ID, previous, FIXED_TIME)
  // 探索交互率低 → explore_ratio 应略增（effectDelta = +ADJUSTMENT_STEP）
  assert.ok(
    snapshot.changes.explore_ratio > 0,
    `探索交互率低时 explore_ratio 应略增，实际变化 ${snapshot.changes.explore_ratio}`,
  )
})

test('D4 探索 idea 不足 5 个时不触发探索效果信号', () => {
  const previous = buildPreviousSnapshot()
  // 60 个事件中只有 3 个探索 idea（< 5，不触发探索效果信号）
  // diversity = 30/60 = 0.5（在 0.3-0.6 之间，不触发 diversity 信号）
  // 两个信号都不触发 → explore_ratio 变化为 0
  const events: WeightEvent[] = [
    ...Array.from({ length: 57 }, (_, i) => buildEvent({ idea_id: `idea_${i % 30}`, session_id: `sess_${i % 5}` })),
    ...Array.from({ length: 3 }, (_, i) =>
      buildEvent({
        event_type: 'idea_impression',
        idea_id: `explore_${i}`,
        payload: { reason: 'explore' },
      }),
    ),
  ]
  const snapshot = buildWeeklyWeightSnapshot(events, WEEK_ID, previous, FIXED_TIME)
  // 探索 idea 不足 5 个，不触发效果信号；diversity 也在中间区间 → explore_ratio 不变
  assert.equal(snapshot.changes.explore_ratio, 0)
})
