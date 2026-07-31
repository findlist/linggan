import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { CompatibilityMatrixSchema, KnowledgeBaseSchema, validateMatrixWithKnowledge } from '../src/data/contracts.ts'
import type { CompatibilityMatrix, KnowledgeBase, KnownCharacter, IconicMoment } from '../src/data/contracts.ts'
import { computeCompatibility, filterCompatibleCombinations } from '../src/generation/compatibility.ts'
import { buildRemixPlan } from '../src/generation/remix-engine.ts'
import type { RemixDuration } from '../src/generation/remix-engine.ts'

const root = new URL('../', import.meta.url)

// 加载真实知识库和兼容矩阵，供多组测试复用
const knowledge = KnowledgeBaseSchema.parse(
  JSON.parse(await readFile(new URL('data/knowledge-base.json', root), 'utf8')) as unknown,
)
const matrix = CompatibilityMatrixSchema.parse(
  JSON.parse(await readFile(new URL('data/compatibility-matrix.json', root), 'utf8')) as unknown,
) as CompatibilityMatrix

const workById = new Map(knowledge.works.map((work) => [work.id, work]))
const findCharacter = (id: string): KnownCharacter => {
  const character = knowledge.known_characters.find((item) => item.id === id)
  assert.ok(character, `character ${id} must exist`)
  return character
}
const findMoment = (id: string): IconicMoment => {
  const moment = knowledge.iconic_moments.find((item) => item.id === id)
  assert.ok(moment, `moment ${id} must exist`)
  return moment
}

/* ------------------------- Schema 校验测试 ------------------------- */

test('合法兼容矩阵通过 Schema 校验', () => {
  // 使用真实数据文件验证：19 角色档案、11 场景约束、11 冲突难度、55 能力-冲突适配
  assert.equal(matrix.character_abilities.length, 19)
  assert.equal(matrix.scene_constraints.length, 11)
  assert.equal(matrix.conflict_difficulties.length, 11)
  assert.equal(matrix.ability_conflict_fits.length, 55)
})

test('缺失能力维度字段被拒绝', () => {
  const badMatrix = {
    schema_version: 1,
    character_abilities: [
      {
        character_id: 'known_zhen_huan',
        // 缺少 emotional_control 维度
        abilities: {
          combat: 0.2,
          strategy: 0.9,
          social: 0.85,
          tech: 0.3,
        },
        notes: null,
      },
    ],
    scene_constraints: [],
    conflict_difficulties: [],
    ability_conflict_fits: [],
  }
  const result = CompatibilityMatrixSchema.safeParse(badMatrix)
  assert.equal(result.success, false)
})

test('维度分值越界被拒绝（> 1）', () => {
  const badMatrix = {
    schema_version: 1,
    character_abilities: [
      {
        character_id: 'known_zhen_huan',
        abilities: {
          combat: 1.5, // 超出 0-1 范围
          strategy: 0.9,
          social: 0.85,
          tech: 0.3,
          emotional_control: 0.8,
        },
        notes: null,
      },
    ],
    scene_constraints: [],
    conflict_difficulties: [],
    ability_conflict_fits: [],
  }
  const result = CompatibilityMatrixSchema.safeParse(badMatrix)
  assert.equal(result.success, false)
})

test('重复角色 ID 被拒绝', () => {
  const badMatrix = {
    schema_version: 1,
    character_abilities: [
      {
        character_id: 'known_zhen_huan',
        abilities: { combat: 0.2, strategy: 0.9, social: 0.85, tech: 0.3, emotional_control: 0.8 },
        notes: null,
      },
      {
        character_id: 'known_zhen_huan', // 重复
        abilities: { combat: 0.3, strategy: 0.8, social: 0.7, tech: 0.4, emotional_control: 0.7 },
        notes: null,
      },
    ],
    scene_constraints: [],
    conflict_difficulties: [],
    ability_conflict_fits: [],
  }
  const result = CompatibilityMatrixSchema.safeParse(badMatrix)
  assert.equal(result.success, false)
})

test('重复冲突类型被拒绝', () => {
  const badMatrix = {
    schema_version: 1,
    character_abilities: [],
    scene_constraints: [],
    conflict_difficulties: [
      {
        conflict_type: '身份回归与秩序挑战',
        difficulty: { shot_complexity: 0.4, dialogue_density: 0.7, vfx_burden: 0.2, action_choreography: 0.3 },
        min_duration: 30,
        notes: null,
      },
      {
        conflict_type: '身份回归与秩序挑战', // 重复
        difficulty: { shot_complexity: 0.5, dialogue_density: 0.6, vfx_burden: 0.3, action_choreography: 0.4 },
        min_duration: 15,
        notes: null,
      },
    ],
    ability_conflict_fits: [],
  }
  const result = CompatibilityMatrixSchema.safeParse(badMatrix)
  assert.equal(result.success, false)
})

/* --------------------- 外键与知识库一致性测试 --------------------- */

test('validateMatrixWithKnowledge 检测到未知角色 ID', () => {
  const badMatrix: CompatibilityMatrix = {
    schema_version: 1,
    character_abilities: [
      {
        character_id: 'known_nonexistent',
        abilities: { combat: 0.5, strategy: 0.5, social: 0.5, tech: 0.5, emotional_control: 0.5 },
        notes: null,
      },
    ],
    scene_constraints: [],
    conflict_difficulties: [],
    ability_conflict_fits: [],
  }
  const issues = validateMatrixWithKnowledge(badMatrix, knowledge as KnowledgeBase)
  assert.ok(issues.length > 0)
  assert.ok(issues.some((i) => i.message.includes('unknown character id')))
})

test('真实兼容矩阵与真实知识库外键一致（0 issues）', () => {
  const issues = validateMatrixWithKnowledge(matrix, knowledge as KnowledgeBase)
  assert.equal(issues.length, 0)
})

test('validateMatrixWithKnowledge 检测到未知冲突类型', () => {
  const badMatrix: CompatibilityMatrix = {
    schema_version: 1,
    character_abilities: [],
    scene_constraints: [],
    conflict_difficulties: [
      {
        conflict_type: '不存在的冲突类型',
        difficulty: { shot_complexity: 0.4, dialogue_density: 0.7, vfx_burden: 0.2, action_choreography: 0.3 },
        min_duration: 30,
        notes: null,
      },
    ],
    ability_conflict_fits: [],
  }
  const issues = validateMatrixWithKnowledge(badMatrix, knowledge as KnowledgeBase)
  assert.ok(issues.length > 0)
  assert.ok(issues.some((i) => i.message.includes('conflict_type not found')))
})

/* --------------------- 引擎过滤行为测试 --------------------- */

test('computeCompatibility 合理组合得到高分', () => {
  // 甄嬛 × 宜修皇后 × 旧人物回归引发权力重排 × 30s
  // 两人都是策略/社交型，冲突类型为权力博弈，时长充足
  const score = computeCompatibility(
    findCharacter('known_zhen_huan'),
    findCharacter('known_empress_yixiu'),
    findMoment('moment_return_power_shift'),
    30,
    matrix,
  )
  assert.ok(score.score >= 0.5, `reasonable combination should score >= 0.5, got ${score.score}`)
  assert.equal(score.reasons.length, 0, 'reasonable combination should have no deduction reasons')
})

test('computeCompatibility 不合理组合得到低分（温柔型角色 × 强攻场景 × 15s）', () => {
  // 李慕婉（温柔智者，combat=0.3）× MOSS（AI，combat=0.3）
  // × moment_mass_assault（救援压力与强攻代价，min_duration=30）
  // × 15s（低于最小时长 + 高时间压力 + 高参与人数）
  const score = computeCompatibility(
    findCharacter('known_li_muwan'),
    findCharacter('known_moss'),
    findMoment('moment_mass_assault'),
    15,
    matrix,
  )
  // 应同时触发：角色能力低适配、场景高约束短时长、时长低于最小时长
  assert.ok(score.score < 0.5, `unreasonable combination should score < 0.5, got ${score.score}`)
  assert.ok(score.reasons.length >= 2, `should have multiple deduction reasons, got ${score.reasons.length}`)
  assert.ok(
    score.reasons.some((r) => r.includes('最小时长')),
    'should include min_duration violation reason',
  )
})

test('filterCompatibleCombinations 过滤掉低兼容组合，保留高兼容组合', () => {
  const reasonable = {
    characterA: findCharacter('known_zhen_huan'),
    characterB: findCharacter('known_empress_yixiu'),
    moment: findMoment('moment_return_power_shift'),
    duration: 30 as RemixDuration,
  }
  const unreasonable = {
    characterA: findCharacter('known_li_muwan'),
    characterB: findCharacter('known_moss'),
    moment: findMoment('moment_mass_assault'),
    duration: 15 as RemixDuration,
  }
  const filtered = filterCompatibleCombinations([reasonable, unreasonable], matrix)
  assert.equal(filtered.length, 1, 'should filter out the unreasonable combination')
  assert.equal(filtered[0].characterA.id, 'known_zhen_huan', 'should keep the reasonable combination')
})

test('矩阵可被 remix-engine 生态读取：过滤后组合可成功生成方案', () => {
  // 验证矩阵过滤后的合理组合确实能传入 buildRemixPlan 生成完整方案
  // 这是"矩阵可被 remix-engine 读取并影响候选过滤"的端到端验证
  const characterA = findCharacter('known_zhen_huan')
  const characterB = findCharacter('known_empress_yixiu')
  const moment = findMoment('moment_return_power_shift')
  const plan = buildRemixPlan({
    characterA,
    characterB,
    moment,
    workA: workById.get(characterA.work_id)!,
    workB: workById.get(characterB.work_id)!,
    momentWork: workById.get(moment.work_id)!,
    style: { id: 'cinematic', label: '电影感', prompt: '克制写实光影' },
    duration: 30,
    seed: 'c1-compat-test',
  })
  assert.ok(plan.id, 'filtered combination should produce a valid plan')
  assert.ok(plan.hook.length > 0, 'plan should have a hook')
  assert.equal(plan.storyboard.length, 5, '30s plan should have 5 shots')
})
