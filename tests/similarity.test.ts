import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import {
  CompatibilityMatrixSchema,
  KnowledgeBaseSchema
} from '../src/data/contracts.ts'
import type {
  CompatibilityMatrix,
  KnownCharacter,
  Work
} from '../src/data/contracts.ts'
import {
  buildProductionPlans,
  buildRemixPlan,
  type ProductionPlanInput,
  type RemixPlan,
  type RemixStyle
} from '../src/generation/remix-engine.ts'
import {
  computePlanSimilarity,
  detectDuplicates,
  filterUniquePlans
} from '../src/generation/similarity.ts'

const root = new URL('../', import.meta.url)
const knowledge = KnowledgeBaseSchema.parse(
  JSON.parse(await readFile(new URL('data/knowledge-base.json', root), 'utf8')) as unknown
)
const matrix = CompatibilityMatrixSchema.parse(
  JSON.parse(await readFile(new URL('data/compatibility-matrix.json', root), 'utf8')) as unknown
)

const workById = new Map(knowledge.works.map((w: Work) => [w.id, w]))
const style: RemixStyle = { id: 'cinematic', label: '电影感热血', prompt: '克制写实光影、宽银幕构图' }

const findCharacter = (id: string): KnownCharacter => {
  const c = knowledge.known_characters.find(item => item.id === id)
  assert.ok(c, `character ${id} must exist`)
  return c
}

const buildInput = (
  characterA: KnownCharacter,
  characterB: KnownCharacter,
  momentId: string,
  duration: 15 | 30 | 60,
  seed: string
): ProductionPlanInput => {
  const moment = knowledge.iconic_moments.find(m => m.id === momentId)
  assert.ok(moment, `moment ${momentId} must exist`)
  return {
    characterA, characterB, moment, duration,
    workA: workById.get(characterA.work_id)!,
    workB: workById.get(characterB.work_id)!,
    momentWork: workById.get(moment.work_id)!,
    style, seed
  }
}

// 基础方案：王林 × 李慕婉 × 第一个名场面 × 30s
const basePlan = buildRemixPlan(buildInput(
  findCharacter('known_wang_lin'),
  findCharacter('known_li_muwan'),
  knowledge.iconic_moments[0].id,
  30,
  'c3-base'
))

// 构造与 basePlan 仅指定字段不同的 mock plan，用于精确控制相似度维度
const mockPlan = (overrides: Partial<RemixPlan> & { id: string }): RemixPlan => ({
  ...basePlan,
  ...overrides
})

/* ----------------------- 验收条件 1：相同方案相似度 = 1 ----------------------- */

test('identical plans have similarity score of 1', () => {
  const result = computePlanSimilarity(basePlan, basePlan)
  assert.equal(result.score, 1, 'identical plan must have score 1')
  // 每个维度分项也必须为 1
  for (const [key, value] of Object.entries(result.breakdown)) {
    assert.equal(value, 1, `dimension ${key} must be 1 for identical plans`)
  }
})

/* ----------------------- 验收条件 2：完全不同方案相似度低 ----------------------- */

test('completely different plans have low similarity below 0.5', () => {
  // 用不同角色、不同场面、不同时长、不同种子生成两个方案
  const planA = buildRemixPlan(buildInput(
    findCharacter('known_wang_lin'),
    findCharacter('known_li_muwan'),
    knowledge.iconic_moments[0].id,
    15,
    'c3-diff-A'
  ))
  const planB = buildRemixPlan(buildInput(
    findCharacter('known_zhen_huan'),
    findCharacter('known_li_yunlong'),
    knowledge.iconic_moments[3].id,
    60,
    'c3-diff-B'
  ))
  const { score, breakdown } = computePlanSimilarity(planA, planB)
  assert.ok(score < 0.5, `completely different plans should have score < 0.5, got ${score}`)
  // 时长不同 → duration 维度 = 0
  assert.equal(breakdown.duration, 0, 'duration must be 0 for different durations')
})

/* ----------------------- 验收条件 3：钩子相同其他不同 → 中等相似 ----------------------- */

test('same hook but different other fields yields hook dimension 1 but score below 1', () => {
  const planWithSameHook = mockPlan({
    id: 'c3-same-hook',
    // 钩子相同，但概念、对白、提示词完全不同
    concept: '完全不同的概念描述，讲述另一个故事线',
    dialogueA: '“完全不同的对白内容”',
    dialogueB: '“另一段无关的对白”',
    production: {
      ...basePlan.production,
      prompts: {
        ...basePlan.production.prompts,
        positive: '完全不同的正向提示词，描述另一个场景'
      }
    }
  })
  const { score, breakdown } = computePlanSimilarity(basePlan, planWithSameHook)
  assert.equal(breakdown.hook, 1, 'hook dimension must be 1 when hooks are identical')
  assert.equal(breakdown.title, 1, 'title dimension must be 1 when titles are identical')
  assert.ok(breakdown.concept < 0.5, 'concept must be low when concepts differ')
  assert.ok(score < 1, 'overall score must be below 1 when some dimensions differ')
  assert.ok(score > 0.3, 'score should still reflect shared hook/title/structure')
})

/* ----------------------- 验收条件 4：相同角色组合不同种子 → 部分维度相同 ----------------------- */

test('same character pair with different seeds keeps title/concept similarity but varies hook', () => {
  // 相同角色+场面+时长，仅种子不同：title/concept 包含角色名和场面名应保持相同
  const planSameCombo = buildRemixPlan(buildInput(
    findCharacter('known_wang_lin'),
    findCharacter('known_li_muwan'),
    knowledge.iconic_moments[0].id,
    30,
    'c3-same-combo-diff-seed'
  ))
  const { breakdown } = computePlanSimilarity(basePlan, planSameCombo)
  // title 和 concept 都包含角色名和场面名，应完全相同
  assert.equal(breakdown.title, 1, 'title must be identical for same character pair')
  assert.equal(breakdown.concept, 1, 'concept must be identical for same character pair')
  assert.equal(breakdown.duration, 1, 'duration must be identical')
  assert.equal(breakdown.personality_pair, 1, 'personality pair must be identical for same characters')
  // 钩子来自模板池随机选择，不同种子大概率不同
  // 这里不强制 hook < 1（小概率相同），只验证 score 在合理范围
  const { score } = computePlanSimilarity(basePlan, planSameCombo)
  assert.ok(score >= 0.5 && score < 1, 'same combo different seed should be similar but not identical')
})

/* ----------------------- 验收条件 5：detectDuplicates 检测重复方案列表 ----------------------- */

test('detectDuplicates flags duplicate plans above threshold', () => {
  // 构造 [basePlan, basePlan 副本（不同 id）, 完全不同的 plan]
  const duplicatePlan = mockPlan({ id: 'c3-duplicate' })
  const differentPlan = buildRemixPlan(buildInput(
    findCharacter('known_zhen_huan'),
    findCharacter('known_li_yunlong'),
    knowledge.iconic_moments[3].id,
    60,
    'c3-unique'
  ))
  const plans = [basePlan, duplicatePlan, differentPlan]
  const result = detectDuplicates(plans, { threshold: 0.7 })

  assert.equal(result.stats.total, 3)
  // basePlan 和 duplicatePlan 完全相同（除 id），应被判为重复
  const baseFlag = result.flags.find(f => f.plan.id === basePlan.id)
  const dupFlag = result.flags.find(f => f.plan.id === 'c3-duplicate')
  assert.ok(baseFlag, 'basePlan flag must exist')
  assert.ok(dupFlag, 'duplicate flag must exist')
  assert.ok(baseFlag!.is_duplicate, 'basePlan should be flagged as duplicate')
  assert.ok(dupFlag!.is_duplicate, 'duplicate should be flagged as duplicate')
  assert.ok(baseFlag!.max_similarity >= 0.7, 'basePlan max_similarity should be >= threshold')
  // differentPlan 与其他方案相似度低，不应被判为重复
  const diffFlag = result.flags.find(f => f.plan.id === differentPlan.id)
  assert.ok(!diffFlag!.is_duplicate, 'different plan should not be flagged as duplicate')
  assert.ok(diffFlag!.max_similarity < 0.7, 'different plan max_similarity should be < threshold')
})

/* ----------------------- 验收条件 6：filterUniquePlans 过滤保留首个 ----------------------- */

test('filterUniquePlans keeps first occurrence and removes later duplicates', () => {
  const duplicatePlan = mockPlan({ id: 'c3-dup-2' })
  const differentPlan = buildRemixPlan(buildInput(
    findCharacter('known_zhen_huan'),
    findCharacter('known_li_yunlong'),
    knowledge.iconic_moments[3].id,
    60,
    'c3-unique-2'
  ))
  const plans = [basePlan, duplicatePlan, differentPlan]
  const result = filterUniquePlans(plans, { threshold: 0.7 })

  assert.equal(result.stats.total, 3)
  assert.equal(result.stats.remaining, 2, 'should keep 2 unique plans')
  assert.equal(result.stats.removed, 1, 'should remove 1 duplicate')
  assert.equal(result.unique_plans[0]!.id, basePlan.id, 'first occurrence must be kept')
  assert.equal(result.unique_plans[1]!.id, differentPlan.id, 'different plan must be kept')
  // 被移除的方案应记录与哪个已保留方案相似
  assert.equal(result.removed[0]!.plan.id, 'c3-dup-2')
  assert.equal(result.removed[0]!.similar_to, basePlan.id, 'removed plan should reference kept plan id')
  assert.ok(result.removed[0]!.similarity >= 0.7, 'removed similarity should be >= threshold')
})

/* ----------------------- 验收条件 7：确定性（同输入同结果） ----------------------- */

test('detection and filtering are deterministic', () => {
  const plans = [
    basePlan,
    mockPlan({ id: 'c3-det-1' }),
    mockPlan({ id: 'c3-det-2', hook: '不同的钩子文本内容' })
  ]
  const detect1 = detectDuplicates(plans, { threshold: 0.7 })
  const detect2 = detectDuplicates(plans, { threshold: 0.7 })
  assert.deepEqual(detect1, detect2, 'detectDuplicates must be deterministic')

  const filter1 = filterUniquePlans(plans, { threshold: 0.7 })
  const filter2 = filterUniquePlans(plans, { threshold: 0.7 })
  assert.deepEqual(filter1, filter2, 'filterUniquePlans must be deterministic')
})

/* ----------------------- 验收条件 8：真实数据集验证 ----------------------- */

test('real production plans from buildProductionPlans produce reasonable duplicate detection', () => {
  // 构建真实组合：6 角色 × 名场面 × 30s，生成足够多的 plans
  const chars = knowledge.known_characters.slice(0, 6)
  const moments = knowledge.iconic_moments.slice(0, 4)
  const inputs: ProductionPlanInput[] = []
  for (let i = 0; i < chars.length; i++) {
    for (let j = i + 1; j < chars.length; j++) {
      for (const moment of moments) {
        inputs.push(buildInput(chars[i]!, chars[j]!, moment.id, 30, `c3-real-${i}-${j}-${moment.id}`))
      }
    }
  }
  // 6×5/2 × 4 = 60 组合，经 C1 过滤后剩余若干
  const result = buildProductionPlans(inputs, matrix)
  assert.ok(result.plans.length >= 10, 'should produce at least 10 real plans for duplicate detection')

  const detection = detectDuplicates(result.plans, { threshold: 0.7 })
  // 所有 max_similarity 必须在 [0, 1]
  for (const flag of detection.flags) {
    assert.ok(flag.max_similarity >= 0 && flag.max_similarity <= 1, 'max_similarity must be in [0,1]')
  }
  // avg_max_similarity 也必须在 [0, 1]
  assert.ok(
    detection.stats.avg_max_similarity >= 0 && detection.stats.avg_max_similarity <= 1,
    'avg_max_similarity must be in [0,1]'
  )
  // 真实数据集不应全部被判为重复（否则阈值过低或方案过于雷同）
  assert.ok(
    detection.stats.unique >= 1,
    'at least one plan should be unique in real dataset'
  )
  // 也不应全部唯一（不同角色组合的 title/concept 不同，但同一组合的 plans 可能相似）
  // 这里只验证检测能正常运行并产出合理结构，不强制 duplicates 数量
})
