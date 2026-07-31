import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { CompatibilityMatrixSchema, KnowledgeBaseSchema } from '../src/data/contracts.ts'
import type { KnownCharacter, Work } from '../src/data/contracts.ts'
import { computeCompatibility, filterCompatibleCombinations } from '../src/generation/compatibility.ts'
import {
  buildProductionPlans,
  buildRemixPlan,
  type ProductionPlanInput,
  type RemixStyle,
} from '../src/generation/remix-engine.ts'

const root = new URL('../', import.meta.url)
const knowledge = KnowledgeBaseSchema.parse(
  JSON.parse(await readFile(new URL('data/knowledge-base.json', root), 'utf8')) as unknown,
)
const matrix = CompatibilityMatrixSchema.parse(
  JSON.parse(await readFile(new URL('data/compatibility-matrix.json', root), 'utf8')) as unknown,
)

const workById = new Map(knowledge.works.map((w: Work) => [w.id, w]))
const style: RemixStyle = { id: 'cinematic', label: '电影感热血', prompt: '克制写实光影、宽银幕构图' }

const findCharacter = (id: string): KnownCharacter => {
  const c = knowledge.known_characters.find((item) => item.id === id)
  assert.ok(c, `character ${id} must exist`)
  return c
}

const buildInput = (
  characterA: KnownCharacter,
  characterB: KnownCharacter,
  momentId: string,
  duration: 15 | 30 | 60,
  seed: string,
): ProductionPlanInput => {
  const moment = knowledge.iconic_moments.find((m) => m.id === momentId)
  assert.ok(moment, `moment ${momentId} must exist`)
  const workA = workById.get(characterA.work_id)!
  const workB = workById.get(characterB.work_id)!
  const momentWork = workById.get(moment.work_id)!
  return { characterA, characterB, moment, duration, workA, workB, momentWork, style, seed }
}

// 构建所有角色配对 × 所有名场面 × 指定时长的组合列表
const buildCombinations = (durations: ReadonlyArray<15 | 30 | 60>): ProductionPlanInput[] => {
  const chars = knowledge.known_characters.slice(0, 6)
  const moments = knowledge.iconic_moments
  const inputs: ProductionPlanInput[] = []
  for (let i = 0; i < chars.length; i++) {
    for (let j = i + 1; j < chars.length; j++) {
      for (const moment of moments) {
        for (const duration of durations) {
          inputs.push(buildInput(chars[i], chars[j], moment.id, duration, `c2-${i}-${j}-${moment.id}-${duration}`))
        }
      }
    }
  }
  return inputs
}

const VALID_SHOT_TYPES = ['extreme_close_up', 'close_up', 'medium', 'full', 'wide']
const VALID_CAMERA_MOVEMENTS = ['fixed', 'push', 'pull', 'pan', 'tilt', 'tracking']
const VALID_TRANSITIONS = ['cut', 'dissolve', 'fade', 'match_cut']

const samplePlan = buildRemixPlan(
  buildInput(
    findCharacter('known_wang_lin'),
    findCharacter('known_li_muwan'),
    knowledge.iconic_moments[0].id,
    30,
    'c2-sample',
  ),
)

/* ----------------------- 验收条件 1：制作包结构校验 ----------------------- */

test('production package contains structured prompts and copyright boundary', () => {
  const { production } = samplePlan
  assert.ok(production, 'plan must have a production field')
  // 结构化提示词四字段
  assert.ok(production.prompts.positive.length > 0, 'positive prompt must not be empty')
  assert.ok(production.prompts.negative.length > 0, 'negative prompt must not be empty')
  assert.ok(production.prompts.aspect_ratio.length > 0, 'aspect_ratio must not be empty')
  assert.ok(typeof production.prompts.style_strength === 'number', 'style_strength must be a number')
  // 版权边界三字段
  assert.ok(production.copyright_boundary.reference_status.length > 0)
  assert.ok(production.copyright_boundary.commercial_use.length > 0)
  assert.ok(production.copyright_boundary.rewrite_scope.length > 0)
})

/* ----------------------- 验收条件 2：分镜表字段完整性 ----------------------- */

test('storyboard shots include shot_type, camera_movement and transition fields', () => {
  for (const shot of samplePlan.storyboard) {
    assert.ok(VALID_SHOT_TYPES.includes(shot.shot_type), `invalid shot_type: ${shot.shot_type}`)
    assert.ok(VALID_CAMERA_MOVEMENTS.includes(shot.camera_movement), `invalid camera_movement: ${shot.camera_movement}`)
    assert.ok(VALID_TRANSITIONS.includes(shot.transition), `invalid transition: ${shot.transition}`)
  }
})

/* ----------------------- 验收条件 3：提示词含正向/负面/比例 ----------------------- */

test('production prompts include positive, negative, aspect_ratio and style_strength', () => {
  const { prompts } = samplePlan.production
  // 正向提示词应包含风格关键词和"原创"
  assert.ok(prompts.positive.includes('原创'), 'positive prompt should mention original design')
  assert.ok(prompts.positive.includes(style.prompt), 'positive prompt should include style prompt')
  // 负面提示词应包含版权风险关键词
  assert.ok(prompts.negative.includes('复刻'), 'negative prompt should block reproduction of copyrighted material')
  assert.ok(prompts.negative.includes('低质量'), 'negative prompt should block low quality')
  // 比例为 9:16 竖屏
  assert.equal(prompts.aspect_ratio, '9:16')
  // 风格强度在 0-1 范围
  assert.ok(prompts.style_strength > 0 && prompts.style_strength <= 1, 'style_strength must be in (0, 1]')
})

/* ----------------------- 验收条件 4：文案含封面文案和标签策略 ----------------------- */

test('copywriting includes cover_copy and hashtag strategy', () => {
  const { copywriting } = samplePlan
  // 封面文案非空且较短（适合封面图）
  assert.ok(copywriting.cover_copy.length > 0, 'cover_copy must not be empty')
  assert.ok(copywriting.cover_copy.length <= 20, 'cover_copy should be concise for cover image')
  // 3 个话题标签均以 # 开头
  assert.equal(copywriting.hashtags.length, 3)
  for (const tag of copywriting.hashtags) {
    assert.ok(tag.startsWith('#'), `hashtag "${tag}" must start with #`)
  }
  // 3 个标题候选
  assert.equal(copywriting.titles.length, 3)
})

/* ----------------------- 验收条件 5：版权边界声明存在 ----------------------- */

test('copyright boundary declares reference status, commercial use and rewrite scope', () => {
  const { copyright_boundary: cb } = samplePlan.production
  // 参考状态应提及 reference_only
  assert.ok(cb.reference_status.includes('reference_only'), 'should declare reference_only status')
  // 商用限制应提及原创或已授权
  assert.ok(cb.commercial_use.includes('原创或已授权'), 'should require original or licensed assets for commercial use')
  // 改写范围应提及原创改写
  assert.ok(cb.rewrite_scope.includes('原创改写'), 'should declare original rewrite scope')
  // 不应声称可以直接使用参考角色
  assert.ok(!cb.commercial_use.includes('可直接使用'), 'must not allow direct use of reference characters')
})

/* ----------------------- 验收条件 6：C1 过滤后低兼容组合被剔除 ----------------------- */

test('buildProductionPlans filters out low-compatibility combinations via C1 matrix', () => {
  // 用 15s 时长构建组合：某些冲突类型 min_duration=30/60，会被 C1 过滤
  const inputs = buildCombinations([15])
  const result = buildProductionPlans(inputs, matrix)

  assert.ok(result.stats.total_combinations > 0, 'should have input combinations')
  assert.ok(result.stats.filtered_out > 0, 'should filter out low-compatibility combinations')
  assert.ok(result.stats.remaining < result.stats.total_combinations, 'remaining must be less than total')
  assert.equal(result.stats.threshold, 0.5, 'default threshold should be 0.5')

  // 验证剩余组合的兼容性得分均 >= 阈值
  const filtered = filterCompatibleCombinations(inputs, matrix, { threshold: 0.5 })
  for (const input of filtered) {
    const { score } = computeCompatibility(input.characterA, input.characterB, input.moment, input.duration, matrix)
    assert.ok(score >= 0.5, `filtered combination score ${score} should be >= 0.5`)
  }
  assert.equal(result.plans.length, filtered.length, 'plans count must equal filtered combinations count')
})

/* ------------------ 验收条件 7：过滤后剩余组合可生成完整制作包 ------------------ */

test('filtered combinations produce complete production packages', () => {
  // 用 30s 时长构建组合（较高兼容率，确保有剩余组合）
  const inputs = buildCombinations([30])
  const result = buildProductionPlans(inputs, matrix)

  assert.ok(result.plans.length > 0, 'should produce at least one plan from filtered combinations')
  // 每个生成的 plan 必须包含完整制作包字段
  for (const plan of result.plans) {
    assert.ok(plan.production, 'plan must have production field')
    assert.ok(plan.production.prompts.positive.length > 0)
    assert.ok(plan.production.prompts.negative.length > 0)
    assert.ok(plan.production.copyright_boundary.reference_status.length > 0)
    // 分镜每个镜头必须包含 C2 新增字段
    for (const shot of plan.storyboard) {
      assert.ok(VALID_SHOT_TYPES.includes(shot.shot_type))
      assert.ok(VALID_CAMERA_MOVEMENTS.includes(shot.camera_movement))
      assert.ok(VALID_TRANSITIONS.includes(shot.transition))
    }
    // 文案必须包含封面文案
    assert.ok(plan.copywriting.cover_copy.length > 0)
  }
})

/* ----------------------- 验收条件 8：确定性（同种子复现） ----------------------- */

test('buildProductionPlans is deterministic with same inputs and seeds', () => {
  const inputs = buildCombinations([30]).slice(0, 6)
  const first = buildProductionPlans(inputs, matrix)
  const second = buildProductionPlans(inputs, matrix)
  assert.deepEqual(first, second, 'same inputs and matrix must produce identical results')
})
