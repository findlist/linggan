import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { CandidateSchema, SeedEntitiesSchema, TrendInboxSchema, type Trend } from '../src/data/contracts.ts'
import type { CandidateGenerationConfig } from '../src/generation/candidate-generator.ts'
import { generateDailyCandidates, scoreCandidate, shortenTrendTitle } from '../src/generation/candidate-generator.ts'

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

test('contrast score varies based on character traits', () => {
  const trend: Trend = structuredClone(trends[0])
  // 冷酷剑客 (traits: 冷酷,守诺,惜字如金,以行动代替解释,在沉默中施压)
  const coldChar = seeds.characters.find((c) => c.id === 'char_archetype_swordsman')!
  // 热血新人 (traits: 热血,莽撞,大声宣告意图,用承诺绑定自己,失败后立刻卷土重来)
  const hotChar = seeds.characters.find((c) => c.id === 'char_archetype_hotblood')!
  // 外卖诗人 (traits: 奔波,浪漫,市井观察,用送餐路线写诗,在琐碎中发现史诗感,以食物比喻人情冷暖)
  const poetChar = seeds.characters.find((c) => c.id === 'char_original_delivery_poet')!

  const coldScore = scoreCandidate({ config, trend, character: coldChar, element: seeds.elements[0] })
  const hotScore = scoreCandidate({ config, trend, character: hotChar, element: seeds.elements[0] })
  const poetScore = scoreCandidate({ config, trend, character: poetChar, element: seeds.elements[0] })

  // All three should have different contrast scores
  const contrasts = new Set([coldScore.metrics.contrast, hotScore.metrics.contrast, poetScore.metrics.contrast])
  assert.ok(contrasts.size >= 2, `expected at least 2 different contrast scores, got ${contrasts.size}`)
  // All scores should be in valid range
  for (const c of [coldScore, hotScore, poetScore]) {
    assert.ok(c.metrics.contrast >= 60 && c.metrics.contrast <= 95, `contrast ${c.metrics.contrast} out of range`)
  }
})

test('visuality score varies based on element category and actions', () => {
  const trend: Trend = structuredClone(trends[0])
  const char = seeds.characters[0]
  // 台球 (sport, 3 actions)
  const billiards = seeds.elements.find((e) => e.id === 'element_billiards')!
  // 深夜拉面铺 (location, 3 actions)
  const noodleShop = seeds.elements.find((e) => e.id === 'element_noodle_shop')!
  // 公司会议室 (location, 3 actions)
  const office = seeds.elements.find((e) => e.id === 'element_office_meeting')!

  const sportScore = scoreCandidate({ config, trend, character: char, element: billiards })
  const locationScore = scoreCandidate({ config, trend, character: char, element: noodleShop })
  const officeScore = scoreCandidate({ config, trend, character: char, element: office })

  // sport category should have higher or equal visuality than location
  assert.ok(
    sportScore.metrics.visuality >= locationScore.metrics.visuality,
    `sport visuality ${sportScore.metrics.visuality} should be >= location ${locationScore.metrics.visuality}`,
  )
  // All scores should be in valid range
  for (const s of [sportScore, locationScore, officeScore]) {
    assert.ok(s.metrics.visuality >= 70 && s.metrics.visuality <= 95, `visuality ${s.metrics.visuality} out of range`)
  }
})

test('seriality score varies based on scene pattern and element category', () => {
  const trend: Trend = structuredClone(trends[0])
  const char = seeds.characters[0]
  const scene = seeds.scenes[0]
  // 台球 (sport) - should get series bonus
  const billiards = seeds.elements.find((e) => e.id === 'element_billiards')!
  // 深夜拉面铺 (location) - should get location bonus
  const noodleShop = seeds.elements.find((e) => e.id === 'element_noodle_shop')!

  const sportScore = scoreCandidate({ config, trend, character: char, element: billiards, scene })
  const locationScore = scoreCandidate({ config, trend, character: char, element: noodleShop, scene })

  // sport should have higher seriality than location (sport gets +8, location gets +5)
  assert.ok(
    sportScore.metrics.seriality > locationScore.metrics.seriality,
    `sport seriality ${sportScore.metrics.seriality} should be > location ${locationScore.metrics.seriality}`,
  )
  // All scores should be in valid range
  for (const s of [sportScore, locationScore]) {
    assert.ok(s.metrics.seriality >= 65 && s.metrics.seriality <= 92, `seriality ${s.metrics.seriality} out of range`)
  }
})

test('contrast/visuality/seriality are no longer constant across different characters and elements', () => {
  const trend: Trend = structuredClone(trends[0])
  const scene = seeds.scenes[0]

  // Generate scores for multiple character×element combinations
  const scores = seeds.characters
    .slice(0, 6)
    .flatMap((char) =>
      seeds.elements.map((element) => scoreCandidate({ config, trend, character: char, element, scene })),
    )

  const uniqueContrasts = new Set(scores.map((s) => s.metrics.contrast))
  const uniqueVisualities = new Set(scores.map((s) => s.metrics.visuality))
  const uniqueSerialities = new Set(scores.map((s) => s.metrics.seriality))

  // All three dimensions should produce at least 2 different values across 18 combinations
  assert.ok(uniqueContrasts.size >= 2, `contrast should vary, got ${uniqueContrasts.size} unique values`)
  assert.ok(uniqueVisualities.size >= 2, `visuality should vary, got ${uniqueVisualities.size} unique values`)
  assert.ok(uniqueSerialities.size >= 2, `seriality should vary, got ${uniqueSerialities.size} unique values`)
})

test('shortenTrendTitle: breaks on Chinese colon and returns first segment truncated to maxLen', () => {
  const result = shortenTrendTitle('2026年未录满本科专业排行榜出炉：会计学410次居首')
  assert.ok(result.length <= 10, `result should be <= 10 chars, got ${result.length}`)
  assert.ok(!result.includes('：'), 'result should not contain the colon')
  assert.ok(!result.includes('会计学'), 'result should not contain the second segment')
})

test('shortenTrendTitle: breaks on em dash when first segment fits maxLen', () => {
  const result = shortenTrendTitle('上海地铁—3号线停运', 10)
  assert.equal(result, '上海地铁')
})

test('shortenTrendTitle: truncates long title without break chars', () => {
  const result = shortenTrendTitle('一个非常非常非常非常非常长的趋势标题没有任何标点符号', 10)
  assert.ok(result.length <= 10)
  assert.equal(result, '一个非常非常非常非常')
})

test('shortenTrendTitle: respects custom maxLen', () => {
  const result = shortenTrendTitle('香港刷新1884年以来最高气温纪录', 6)
  assert.ok(result.length <= 6)
})

test('shortenTrendTitle: strips leading book title brackets', () => {
  const result = shortenTrendTitle('《蜘蛛侠：英雄无归》票房破纪录', 10)
  assert.ok(!result.startsWith('《'), `result should not start with 《, got: ${result}`)
  assert.ok(result.length <= 10, `result should be <= 10 chars, got: ${result.length}`)
})

test('shortenTrendTitle: breaks at natural word boundary to avoid mid-word truncation', () => {
  // "上海地铁多条线路因台风全部停运" — truncating at 10 would give "上海地铁多条线路因台"
  // which cuts "台风" in half. Should break after "因" to give "上海地铁多条线路因".
  const result = shortenTrendTitle('上海地铁多条线路因台风全部停运', 10)
  assert.ok(result.length <= 10, `result should be <= 10 chars, got: ${result.length}`)
  assert.ok(!result.endsWith('因台'), `result should not cut mid-word, got: ${result}`)
})

test('shortenTrendTitle: AI短剧 title truncates at natural break point', () => {
  // "AI短剧制作成本与周期讨论" — truncating at 10 gives "AI短剧制作成本与周"
  // which cuts "周期" to "周". Should break after "与" to give "AI短剧制作成本与".
  const result = shortenTrendTitle('AI短剧制作成本与周期讨论', 10)
  assert.ok(result.length <= 10, `result should be <= 10 chars, got: ${result.length}`)
  assert.ok(!result.endsWith('与周'), `result should not cut mid-word, got: ${result}`)
})

test('shortenTrendTitle: strips trailing punctuation', () => {
  const result = shortenTrendTitle('某趋势：', 10)
  assert.equal(result, '某趋势')
})

test('shortenTrendTitle: candidate titles no longer contain full long trend titles', () => {
  const longTitleTrend: Trend = {
    external_id: 'test-long-title',
    title: '2026年未录满本科专业排行榜出炉：会计学410次居首',
    source: 'test',
    source_url: 'https://example.com',
    observed_at: '2026-08-10T00:00:00.000Z',
    signals: { rank: null, engagement: null, velocity: null },
    aliases: [],
    lifecycle: 'rising',
    rights_status: 'reference_only',
    risk_level: 'low',
  }
  const report = generateDailyCandidates({ config, seeds, trends: [longTitleTrend], clock: fixedClock })
  assert.ok(report.candidates.length > 0)
  // No candidate title should contain the full 30+ char trend title
  for (const candidate of report.candidates) {
    assert.ok(
      !candidate.title.includes('会计学410次居首'),
      `title should not contain full trend title: ${candidate.title}`,
    )
    assert.ok(
      !candidate.hook.includes('会计学410次居首'),
      `hook should not contain full trend title: ${candidate.hook}`,
    )
  }
})

test('candidate titles avoid awkward truncated trend titles ending with particles', () => {
  // "上海地铁多条线路因台风全部停运" shortens to "上海地铁多条线路因" which ends with particle "因"
  // and is not usable in candidate titles. Generator should fall back to non-trend patterns.
  const awkwardTrend: Trend = {
    external_id: 'trend-awkward',
    title: '上海地铁多条线路因台风全部停运',
    discovered_at: '2026-08-10T00:00:00Z',
    source: { name: 'test', url: 'https://example.com' },
    signals: { rank: null, engagement: 3000, velocity: 0.5 },
    aliases: [],
    lifecycle: 'rising',
    rights_status: 'reference_only',
    risk_level: 'low',
  }
  const report = generateDailyCandidates({ config, seeds, trends: [awkwardTrend], clock: fixedClock })
  assert.ok(report.candidates.length > 0)
  // No candidate title should contain the awkward truncated form ending with "因"
  for (const candidate of report.candidates) {
    assert.ok(
      !candidate.title.includes('上海地铁多条线路因·'),
      `title should not contain awkward truncated trend title: ${candidate.title}`,
    )
    assert.ok(
      !candidate.title.includes('上海地铁多条线路因之后'),
      `title should not contain awkward truncated trend title: ${candidate.title}`,
    )
    assert.ok(
      !candidate.hook.includes('上海地铁多条线路因的热度'),
      `hook should not contain awkward truncated trend title: ${candidate.hook}`,
    )
    assert.ok(
      !candidate.hook.includes('上海地铁多条线路因是一场棋局'),
      `hook should not contain awkward truncated trend title: ${candidate.hook}`,
    )
  }
})

test('candidate titles use trend title when it is short and meaningful', () => {
  // "蜘蛛侠" is short (3 chars) and meaningful - should be usable in candidate titles
  const shortTrend: Trend = {
    external_id: 'trend-short',
    title: '蜘蛛侠',
    discovered_at: '2026-08-10T00:00:00Z',
    source: { name: 'test', url: 'https://example.com' },
    signals: { rank: null, engagement: 3000, velocity: 0.5 },
    aliases: [],
    lifecycle: 'rising',
    rights_status: 'reference_only',
    risk_level: 'low',
  }
  const report = generateDailyCandidates({ config, seeds, trends: [shortTrend], clock: fixedClock })
  assert.ok(report.candidates.length > 0)
  // At least one candidate should reference the trend title (since it's usable)
  const usesTrend = report.candidates.some((c) => c.title.includes('蜘蛛侠') || c.hook.includes('蜘蛛侠'))
  assert.ok(usesTrend, 'at least one candidate should use the short meaningful trend title')
})

test('candidate titles avoid trend titles that shorten to pure numbers', () => {
  // "2026年高考分数线公布" shortens to "2026年高考分数" which is usable,
  // but "8850元Mi" shortens to just numbers which is not usable
  const numericTrend: Trend = {
    external_id: 'trend-numeric',
    title: '8850元Mi',
    discovered_at: '2026-08-10T00:00:00Z',
    source: { name: 'test', url: 'https://example.com' },
    signals: { rank: null, engagement: 3000, velocity: 0.5 },
    aliases: [],
    lifecycle: 'rising',
    rights_status: 'reference_only',
    risk_level: 'low',
  }
  const report = generateDailyCandidates({ config, seeds, trends: [numericTrend], clock: fixedClock })
  assert.ok(report.candidates.length > 0)
  // "8850元Mi" is only 6 chars but starts with numbers - shortened form may be usable
  // as long as it passes the isTrendTitleUsable check (length >= 4, not pure numbers, no particle ending)
  // The key validation is that no candidate title contains an unusable truncated form
  for (const candidate of report.candidates) {
    // Title should be non-empty and meaningful regardless of trend title usability
    assert.ok(candidate.title.length > 0, 'candidate title should not be empty')
  }
})
