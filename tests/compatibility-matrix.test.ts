import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import {
  CompatibilityMatrixSchema,
  KnowledgeBaseSchema,
  SeedEntitiesSchema,
  validateMatrixWithKnowledge,
} from '../src/data/contracts.ts'
import type {
  CompatibilityMatrix,
  KnowledgeBase,
  KnownCharacter,
  IconicMoment,
  Character,
} from '../src/data/contracts.ts'
import { computeCompatibility, filterCompatibleCombinations } from '../src/generation/compatibility.ts'
import { buildRemixPlan } from '../src/generation/remix-engine.ts'
import type { RemixDuration } from '../src/generation/remix-engine.ts'
import { toRemixCharacter, createOriginalWork } from '../src/generation/original-adapter.ts'

const root = new URL('../', import.meta.url)

// 加载真实知识库、兼容矩阵和种子实体，供多组测试复用
const knowledge = KnowledgeBaseSchema.parse(
  JSON.parse(await readFile(new URL('data/knowledge-base.json', root), 'utf8')) as unknown,
)
const matrix = CompatibilityMatrixSchema.parse(
  JSON.parse(await readFile(new URL('data/compatibility-matrix.json', root), 'utf8')) as unknown,
) as CompatibilityMatrix
const seedEntities = SeedEntitiesSchema.parse(
  JSON.parse(await readFile(new URL('data/seed-entities.json', root), 'utf8')) as unknown,
)
// 原创角色原型（kind=original），存在于 seed-entities.json 而非 knowledge-base.json
const originalCharacters: Character[] = seedEntities.characters.filter((c) => c.kind === 'original')

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
const findOriginalCharacter = (id: string): Character => {
  const character = originalCharacters.find((item) => item.id === id)
  assert.ok(character, `original character ${id} must exist`)
  return character
}

/* ------------------------- Schema 校验测试 ------------------------- */

test('合法兼容矩阵通过 Schema 校验', () => {
  // 使用真实数据文件验证：29 角色档案（19 知名 + 10 原创）、11 场景约束、11 冲突难度、55 能力-冲突适配
  assert.equal(matrix.character_abilities.length, 29)
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

test('真实兼容矩阵与真实知识库+种子实体外键一致（0 issues）', () => {
  // 矩阵包含 10 个原创角色 profile，需传入 seedEntities.characters 才能通过外键校验
  const issues = validateMatrixWithKnowledge(matrix, knowledge as KnowledgeBase, seedEntities.characters)
  assert.equal(issues.length, 0)
})

test('validateMatrixWithKnowledge 不传 seedCharacters 时检测到原创角色 ID 为未知', () => {
  // 不传第三参数时，原创角色 ID 不在 knowledge.known_characters 中，应被报告为未知
  const issues = validateMatrixWithKnowledge(matrix, knowledge as KnowledgeBase)
  assert.ok(issues.length > 0, 'should report original character ids as unknown')
  assert.ok(
    issues.every((i) => i.message.includes('unknown character id')),
    'all issues should be unknown character id',
  )
  assert.equal(issues.length, 10, 'should report exactly 10 original character profiles')
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

/* --------------------- 原创角色能力档案测试 --------------------- */
// 原创角色原型（kind=original）存在于 seed-entities.json，已为 10 个原创角色建立 ability profile。
// 以下测试验证：profile 存在、computeCompatibility 按真实分值评估（不再降级）、
// 空矩阵对比验证 profile 生效、原创角色 × 知名角色组合可生成方案。

test('10 个原创角色在兼容矩阵中各有 ability profile', () => {
  assert.equal(originalCharacters.length, 10, 'should have 10 original characters')
  for (const c of originalCharacters) {
    const profile = matrix.character_abilities.find((p) => p.character_id === c.id)
    assert.ok(profile, `original character ${c.id} should have ability profile`)
    // 五维能力分值都在 0-1 范围
    const values = Object.values(profile.abilities)
    for (const value of values) {
      assert.ok(value >= 0 && value <= 1, `ability value ${value} out of range for ${c.id}`)
    }
  }
})

test('computeCompatibility 按真实能力档案评估原创角色（硬核程序员 × 强攻场景低适配）', () => {
  // 硬核程序员 combat=0.15，"救援压力与强攻代价"冲突类型 combat fit=0.85（高需求）
  // 加权平均后 fitA ≈ 0.33 < 0.35 阈值，应触发能力适配扣分
  const hardcoreCoder = toRemixCharacter(findOriginalCharacter('char_original_hardcore_coder'))
  const soloDetective = toRemixCharacter(findOriginalCharacter('char_original_solo_detective'))
  const result = computeCompatibility(hardcoreCoder, soloDetective, findMoment('moment_mass_assault'), 30, matrix)
  assert.ok(
    result.reasons.some((r) => r.includes('硬核程序员') && r.includes('适配较低')),
    '应因硬核程序员在强攻场景下能力适配低而扣分',
  )
  assert.ok(result.score < 1.0, '能力适配扣分后不应得满分')
})

test('空矩阵下原创角色不触发能力适配扣分（对比验证 profile 真实生效）', () => {
  // 对比：空 character_abilities 的矩阵找不到原创角色 profile，跳过能力适配扣分
  const emptyMatrix: CompatibilityMatrix = {
    schema_version: 1,
    character_abilities: [],
    scene_constraints: matrix.scene_constraints,
    conflict_difficulties: matrix.conflict_difficulties,
    ability_conflict_fits: matrix.ability_conflict_fits,
  }
  const hardcoreCoder = toRemixCharacter(findOriginalCharacter('char_original_hardcore_coder'))
  const soloDetective = toRemixCharacter(findOriginalCharacter('char_original_solo_detective'))
  const result = computeCompatibility(hardcoreCoder, soloDetective, findMoment('moment_mass_assault'), 30, emptyMatrix)
  assert.equal(result.reasons.length, 0, '空矩阵不应触发能力适配扣分')
  assert.equal(result.score, 1.0, '空矩阵下无 profile 应得满分')
})

test('原创角色 × 知名角色组合可通过兼容过滤并生成方案', () => {
  // 独立侦探（strategy=0.9）× 甄嬛 × 身份回归与秩序挑战 × 30s
  // 两者策略/社交适配高，30s 时长充足，应通过兼容过滤
  const soloDetective = toRemixCharacter(findOriginalCharacter('char_original_solo_detective'))
  const zhenHuan = findCharacter('known_zhen_huan')
  const moment = findMoment('moment_return_power_shift')
  const originalWork = createOriginalWork()

  const filtered = filterCompatibleCombinations(
    [
      {
        characterA: soloDetective,
        characterB: zhenHuan,
        moment,
        duration: 30 as RemixDuration,
      },
    ],
    matrix,
  )
  assert.equal(filtered.length, 1, '合理的原创×知名组合应通过兼容过滤')

  const plan = buildRemixPlan({
    characterA: soloDetective,
    characterB: zhenHuan,
    moment,
    workA: originalWork,
    workB: workById.get(zhenHuan.work_id)!,
    momentWork: workById.get(moment.work_id)!,
    style: { id: 'cinematic', label: '电影感', prompt: '克制写实光影' },
    duration: 30,
    seed: 'c1-original-mix-test',
  })
  assert.ok(plan.id, '原创×知名组合应生成有效方案')
  assert.ok(plan.hook.length > 0, '方案应有钩子')
})
