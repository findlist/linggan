import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { KnowledgeBaseSchema, KnownCharacterSchema } from '../src/data/contracts.ts'
import type { KnownCharacter, StoryPattern } from '../src/data/contracts.ts'
import type { RemixPlanInput } from '../src/generation/remix-engine.ts'
import {
  buildRemixPlan,
  countHookTemplates,
  detectPersonalityFromCharacter,
  DIALOGUE_TEMPLATES,
} from '../src/generation/remix-engine.ts'

const root = new URL('../', import.meta.url)
const knowledge = KnowledgeBaseSchema.parse(
  JSON.parse(await readFile(new URL('data/knowledge-base.json', root), 'utf8')) as unknown,
)

const workById = new Map(knowledge.works.map((work) => [work.id, work]))
const moment = knowledge.iconic_moments[0]
const style = { id: 'cinematic', label: '电影感热血', prompt: '克制写实光影、宽银幕构图' }

const findCharacter = (id: string): KnownCharacter => {
  const character = knowledge.known_characters.find((item) => item.id === id)
  assert.ok(character, `character ${id} must exist in knowledge base`)
  return character
}

const buildInput = (overrides: Partial<RemixPlanInput> = {}): RemixPlanInput => {
  const characterA = overrides.characterA ?? findCharacter('known_wang_lin')
  const characterB = overrides.characterB ?? findCharacter('known_li_muwan')
  return {
    characterA,
    characterB,
    moment,
    workA: workById.get(characterA.work_id)!,
    workB: workById.get(characterB.work_id)!,
    momentWork: workById.get(moment.work_id)!,
    style,
    duration: 30,
    seed: 'test-seed',
    ...overrides,
  }
}

test('hook templates cover 4 categories with at least 4 each and 16 total', () => {
  const counts = countHookTemplates()
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0)
  for (const category of ['suspense', 'contrast', 'question', 'action'] as const) {
    assert.ok(counts[category] >= 4, `${category} must have at least 4 templates, got ${counts[category]}`)
  }
  assert.ok(total >= 16, `total hook templates must be at least 16, got ${total}`)
})

test('hook templates expanded to at least 8 per category and 32 total', () => {
  const counts = countHookTemplates()
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0)
  for (const category of ['suspense', 'contrast', 'question', 'action'] as const) {
    assert.ok(counts[category] >= 8, `${category} must have at least 8 templates, got ${counts[category]}`)
  }
  assert.ok(total >= 32, `total hook templates must be at least 32, got ${total}`)
})

test('dialogue templates expanded to at least 14 per personality and 56 total', () => {
  const personalities = ['cold', 'hot', 'cunning', 'gentle'] as const
  const total = personalities.reduce((sum, p) => sum + DIALOGUE_TEMPLATES[p].length, 0)
  for (const p of personalities) {
    assert.ok(
      DIALOGUE_TEMPLATES[p].length >= 14,
      `${p} must have at least 14 dialogue templates, got ${DIALOGUE_TEMPLATES[p].length}`,
    )
  }
  assert.ok(total >= 56, `total dialogue templates must be at least 56, got ${total}`)
})

test('detectPersonality covers all 4 personality types from real knowledge base', () => {
  // 王林：冷静陈述代价、果决、坚忍 → cold
  assert.equal(detectPersonalityFromCharacter(findCharacter('known_wang_lin')), 'cold')
  // 李慕婉：平静语气、安定同伴、温和 → gentle
  assert.equal(detectPersonalityFromCharacter(findCharacter('known_li_muwan')), 'gentle')
  // 甄嬛：含蓄试探、谋略 → cunning
  assert.equal(detectPersonalityFromCharacter(findCharacter('known_zhen_huan')), 'cunning')

  // hot 类型用构造角色验证（知识库暂无明确热血型角色）；单独 parse 单个角色，避免改写整个知识库触发外键校验
  const hotCharacter = KnownCharacterSchema.parse({
    id: 'test_hot_archetype',
    work_id: knowledge.works[0].id,
    name: '热血原型',
    aliases: [],
    roles: ['主角'],
    character_types: ['热血挑战者', '行动派'],
    traits: ['直率', '冲动'],
    dialogue_style: ['用行动回应质疑', '长句承诺式'],
    relationships: [],
    rights_status: 'reference_only',
    risk_level: 'low',
    sources: knowledge.known_characters[0].sources,
    last_verified_at: knowledge.known_characters[0].last_verified_at,
  })
  assert.equal(detectPersonalityFromCharacter(hotCharacter), 'hot')
})

test('fixed seed produces identical plan on repeated calls', () => {
  const input = buildInput({ seed: 'reproducible-seed-001' })
  assert.deepEqual(buildRemixPlan(input), buildRemixPlan(input))
})

test('different seeds produce different hooks for the same input', () => {
  const base = buildInput()
  const planA = buildRemixPlan({ ...base, seed: 'seed-A' })
  const planB = buildRemixPlan({ ...base, seed: 'seed-B' })
  assert.notEqual(planA.hook, planB.hook)
})

test('storyboard shot count matches duration: 15s→3, 30s→5, 60s→8', () => {
  for (const [duration, expected] of [
    [15, 3],
    [30, 5],
    [60, 8],
  ] as const) {
    const plan = buildRemixPlan(buildInput({ duration }))
    assert.equal(plan.storyboard.length, expected, `duration ${duration}s should have ${expected} shots`)
    // 每镜头必须包含时长、画面、动作、情绪四个字段
    for (const shot of plan.storyboard) {
      assert.ok(shot.duration > 0, 'shot duration must be positive')
      assert.ok(shot.visual.length > 0, 'shot visual must not be empty')
      assert.ok(shot.action.length > 0, 'shot action must not be empty')
      assert.ok(shot.emotion.length > 0, 'shot emotion must not be empty')
    }
    // 分镜总时长应与目标时长一致
    const totalDuration = plan.storyboard.reduce((sum, shot) => sum + shot.duration, 0)
    assert.equal(totalDuration, duration, `storyboard total duration must equal ${duration}s`)
  }
})

test('copywriting has 3 titles, one description and 3 hashtags', () => {
  const plan = buildRemixPlan(buildInput())
  assert.equal(plan.copywriting.titles.length, 3)
  assert.equal(plan.copywriting.hashtags.length, 3)
  assert.ok(plan.copywriting.description.length >= 80, 'description should be around 100 characters')
  assert.ok(plan.copywriting.description.length <= 160, 'description should not exceed 160 characters')
  // 3 个标题各不相同
  assert.equal(new Set(plan.copywriting.titles).size, 3)
})

test('20 plans from a preset input set achieve >= 70% normalized hook uniqueness', () => {
  const characters = knowledge.known_characters
  const moments = knowledge.iconic_moments
  const durations = [15, 30, 60] as const
  const hooks: string[] = []

  for (let i = 0; i < 20; i++) {
    const characterA = characters[i % characters.length]
    const characterB = characters[(i + 3) % characters.length]
    // 跳过两角色相同的情况，保证碰撞有意义
    const safeCharacterB = characterB.id === characterA.id ? characters[(i + 4) % characters.length] : characterB
    const input = buildInput({
      characterA,
      characterB: safeCharacterB,
      moment: moments[i % moments.length],
      duration: durations[i % durations.length],
      seed: `uniqueness-seed-${i}`,
    })
    const plan = buildRemixPlan(input)
    // 规范化：替换角色名与场面字段为占位符，衡量模板选择多样性而非填入值差异
    const normalized = plan.hook
      .replaceAll(characterA.name, '{A}')
      .replaceAll(safeCharacterB.name, '{B}')
      .replaceAll(input.moment.conflict_type, '{E}')
      .replaceAll(input.moment.visual_actions[0] ?? '', '{X}')
    hooks.push(normalized)
  }

  const uniqueCount = new Set(hooks).size
  const uniquenessRate = uniqueCount / hooks.length
  assert.ok(
    uniquenessRate >= 0.7,
    `normalized hook uniqueness must be >= 70%, got ${uniquenessRate * 100}% (${uniqueCount}/${hooks.length})`,
  )
})

test('plan personality fields are populated from characters', () => {
  const plan = buildRemixPlan(
    buildInput({
      characterA: findCharacter('known_wang_lin'),
      characterB: findCharacter('known_zhen_huan'),
    }),
  )
  assert.equal(plan.personalityA, 'cold')
  assert.equal(plan.personalityB, 'cunning')
  // 钩子类别必须属于 4 类之一
  assert.ok(['suspense', 'contrast', 'question', 'action'].includes(plan.hookCategory))
})

test('dialogues are original rewrites referencing character dialogue_style', () => {
  const characterA = findCharacter('known_li_muwan')
  const plan = buildRemixPlan(buildInput({ characterA }))
  // 对白应包含角色名（渲染标签用），且不为空
  assert.ok(plan.dialogueA.length > 0)
  assert.ok(plan.dialogueB.length > 0)
  // 对白使用引号包裹，表明是台词格式
  assert.ok(plan.dialogueA.includes('"') || plan.dialogueA.includes('"'))
})

/* ----------------------- story_pattern 集成测试 ----------------------- */

const testPattern: StoryPattern = {
  id: 'story_test_absurd',
  name: '一本正经的荒诞',
  beats: ['严肃建立规则', '目标极其微小', '过程逐渐史诗化', '生活化台词收尾'],
}

test('story_pattern beats replace default storyboard structure when provided', () => {
  const plan = buildRemixPlan(buildInput({ storyPattern: testPattern, duration: 30 }))
  // story_pattern 有 4 个 beats，分镜应为 4 镜而非默认 5 镜
  assert.equal(plan.storyboard.length, 4)
  // storyPatternId 和 storyPatternName 应正确记录
  assert.equal(plan.storyPatternId, 'story_test_absurd')
  assert.equal(plan.storyPatternName, '一本正经的荒诞')
  // 分镜画面应包含叙事模板名称和节拍文本
  for (const shot of plan.storyboard) {
    assert.ok(shot.visual.includes('一本正经的荒诞'), 'shot visual should include story pattern name')
    assert.ok(shot.duration > 0, 'shot duration must be positive')
  }
})

test('story_pattern shot durations sum to total duration', () => {
  for (const duration of [15, 30, 60] as const) {
    const plan = buildRemixPlan(buildInput({ storyPattern: testPattern, duration }))
    const totalDuration = plan.storyboard.reduce((sum, shot) => sum + shot.duration, 0)
    assert.equal(totalDuration, duration, `storyboard total duration must equal ${duration}s with story_pattern`)
  }
})

test('different story_patterns produce different storyboard structures', () => {
  const patternA: StoryPattern = {
    id: 'story_test_a',
    name: '结构A',
    beats: ['开场建立', '冲突升级', '转折收尾'],
  }
  const patternB: StoryPattern = {
    id: 'story_test_b',
    name: '结构B',
    beats: ['线索一', '线索二', '线索三', '线索四', '线索五'],
  }
  const planA = buildRemixPlan(buildInput({ storyPattern: patternA, seed: 'same-seed' }))
  const planB = buildRemixPlan(buildInput({ storyPattern: patternB, seed: 'same-seed' }))
  // 不同 story_pattern 产生不同分镜数量
  assert.notEqual(planA.storyboard.length, planB.storyboard.length)
  // 不同 story_pattern 产生不同分镜画面
  const visualsA = planA.storyboard.map((s) => s.visual)
  const visualsB = planB.storyboard.map((s) => s.visual)
  assert.notDeepEqual(visualsA, visualsB)
})

test('default storyboard structure unchanged when no storyPattern', () => {
  for (const [duration, expected] of [
    [15, 3],
    [30, 5],
    [60, 8],
  ] as const) {
    const plan = buildRemixPlan(buildInput({ duration }))
    assert.equal(
      plan.storyboard.length,
      expected,
      `duration ${duration}s should have ${expected} shots without storyPattern`,
    )
    assert.equal(plan.storyPatternId, undefined)
    assert.equal(plan.storyPatternName, undefined)
  }
})

test('story_pattern plan is deterministic with same seed', () => {
  const input = buildInput({ storyPattern: testPattern, seed: 'deterministic-seed' })
  assert.deepEqual(buildRemixPlan(input), buildRemixPlan(input))
})

test('story_pattern name appears in concept text', () => {
  const plan = buildRemixPlan(buildInput({ storyPattern: testPattern }))
  assert.ok(plan.concept.includes('一本正经的荒诞'), 'concept should include story pattern name')
})

/* ----------------------- 新增 story_pattern 扩充测试 ----------------------- */

const seedEntities = JSON.parse(await readFile(new URL('data/seed-entities.json', root), 'utf8')) as {
  story_patterns: StoryPattern[]
}

const batch2Patterns = seedEntities.story_patterns.filter((p) =>
  ['story_time_loop', 'story_identity_swap', 'story_reverse_causality'].includes(p.id),
)

const batch3Patterns = seedEntities.story_patterns.filter((p) =>
  ['story_dual_narrative', 'story_nonlinear_fragments', 'story_perspective_shift'].includes(p.id),
)

const batch4Patterns = seedEntities.story_patterns.filter((p) =>
  ['story_circular_narrative', 'story_multiple_endings', 'story_unreliable_narrator'].includes(p.id),
)

const batch5Patterns = seedEntities.story_patterns.filter((p) =>
  ['story_nested_narrative', 'story_meta_narrative', 'story_silent_narrative'].includes(p.id),
)

const allNewPatterns = [...batch2Patterns, ...batch3Patterns, ...batch4Patterns, ...batch5Patterns]

test('batch2 story_patterns (time_loop, identity_swap, reverse_causality) exist in seed-entities', () => {
  assert.equal(batch2Patterns.length, 3, 'should have exactly 3 batch2 story patterns')
  for (const pattern of batch2Patterns) {
    assert.ok(pattern.beats.length >= 4, `${pattern.id} should have at least 4 beats`)
    assert.ok(pattern.beats.length <= 5, `${pattern.id} should have at most 5 beats`)
  }
})

test('batch3 story_patterns (dual_narrative, nonlinear_fragments, perspective_shift) exist in seed-entities', () => {
  assert.equal(batch3Patterns.length, 3, 'should have exactly 3 batch3 story patterns')
  for (const pattern of batch3Patterns) {
    assert.ok(pattern.beats.length >= 4, `${pattern.id} should have at least 4 beats`)
    assert.ok(pattern.beats.length <= 5, `${pattern.id} should have at most 5 beats`)
  }
})

test('batch4 story_patterns (circular_narrative, multiple_endings, unreliable_narrator) exist in seed-entities', () => {
  assert.equal(batch4Patterns.length, 3, 'should have exactly 3 batch4 story patterns')
  for (const pattern of batch4Patterns) {
    assert.ok(pattern.beats.length >= 4, `${pattern.id} should have at least 4 beats`)
    assert.ok(pattern.beats.length <= 5, `${pattern.id} should have at most 5 beats`)
  }
})

test('batch5 story_patterns (nested_narrative, meta_narrative, silent_narrative) exist in seed-entities', () => {
  assert.equal(batch5Patterns.length, 3, 'should have exactly 3 batch5 story patterns')
  for (const pattern of batch5Patterns) {
    assert.ok(pattern.beats.length >= 4, `${pattern.id} should have at least 4 beats`)
    assert.ok(pattern.beats.length <= 5, `${pattern.id} should have at most 5 beats`)
  }
})

test('all new story_patterns produce valid plans with correct beat count', () => {
  for (const pattern of allNewPatterns) {
    const plan = buildRemixPlan(buildInput({ storyPattern: pattern, duration: 30 }))
    assert.equal(
      plan.storyboard.length,
      pattern.beats.length,
      `${pattern.id}: storyboard length should match beats count`,
    )
    assert.equal(plan.storyPatternId, pattern.id, `${pattern.id}: storyPatternId should be set`)
    assert.equal(plan.storyPatternName, pattern.name, `${pattern.id}: storyPatternName should be set`)
    for (const shot of plan.storyboard) {
      assert.ok(shot.duration > 0, `${pattern.id}: all shot durations must be positive`)
    }
  }
})

test('all new story_patterns shot durations sum to total duration', () => {
  for (const pattern of allNewPatterns) {
    for (const duration of [15, 30, 60] as const) {
      const plan = buildRemixPlan(buildInput({ storyPattern: pattern, duration }))
      const totalDuration = plan.storyboard.reduce((sum, shot) => sum + shot.duration, 0)
      assert.equal(totalDuration, duration, `${pattern.id} at ${duration}s: total duration must match`)
    }
  }
})

test('all new story_patterns produce different storyboard structures from each other', () => {
  const plans = allNewPatterns.map((p) => buildRemixPlan(buildInput({ storyPattern: p, seed: 'same-seed' })))
  const visualSets = plans.map((plan) => plan.storyboard.map((s) => s.visual))
  // All new patterns should produce different visual sequences
  for (let i = 0; i < visualSets.length; i++) {
    for (let j = i + 1; j < visualSets.length; j++) {
      assert.notDeepEqual(
        visualSets[i],
        visualSets[j],
        `patterns ${allNewPatterns[i].id} and ${allNewPatterns[j].id} should produce different visuals`,
      )
    }
  }
})

test('all new story_patterns plans are deterministic with same seed', () => {
  for (const pattern of allNewPatterns) {
    const input = buildInput({ storyPattern: pattern, seed: 'deterministic-seed' })
    assert.deepEqual(buildRemixPlan(input), buildRemixPlan(input), `${pattern.id} should be deterministic`)
  }
})

test('all new story_patterns name appears in concept text', () => {
  for (const pattern of allNewPatterns) {
    const plan = buildRemixPlan(buildInput({ storyPattern: pattern }))
    assert.ok(plan.concept.includes(pattern.name), `${pattern.id}: concept should include pattern name`)
  }
})

test('expanded story_patterns count is 18 (6 original + 3 batch2 + 3 batch3 + 3 batch4 + 3 batch5)', () => {
  assert.equal(seedEntities.story_patterns.length, 18, 'should have 18 story patterns total')
})
