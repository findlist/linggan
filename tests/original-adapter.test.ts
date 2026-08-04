import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFile } from 'node:fs/promises'
import { CharacterSchema, KnowledgeBaseSchema } from '../src/data/contracts.ts'
import type { Character } from '../src/data/contracts.ts'
import { toRemixCharacter, createOriginalWork, ORIGINAL_WORK_ID } from '../src/generation/original-adapter.ts'
import { buildRemixPlan, type RemixPlanInput } from '../src/generation/remix-engine.ts'

const root = new URL('../', import.meta.url)
const knowledge = KnowledgeBaseSchema.parse(
  JSON.parse(await readFile(new URL('data/knowledge-base.json', root), 'utf8')) as unknown,
)
const seedRaw = JSON.parse(await readFile(new URL('data/seed-entities.json', root), 'utf8')) as {
  characters: Character[]
}
const seedCharacters = seedRaw.characters

const remixStyles = [{ id: 'cinematic', label: '电影感热血', prompt: '克制写实光影、宽银幕构图' }]

const workById = new Map(knowledge.works.map((work) => [work.id, work]))
const moment = knowledge.iconic_moments[0]
const knownChar = knowledge.known_characters[0]
const knownWork = workById.get(knownChar.work_id)!
const originalWork = createOriginalWork()

const originalCharacterSample: Character = CharacterSchema.parse({
  id: 'char_original_test_coder',
  name: '测试程序员',
  kind: 'original',
  media: '科技',
  traits: ['极客', '偏执', '深夜高效'],
  abilities: ['系统架构', '快速调试', '技术布道'],
  relations: ['产品经理', '技术对手'],
  rights_status: 'original',
})

describe('original-adapter', () => {
  it('toRemixCharacter 派生 character_types 从 abilities', () => {
    const rc = toRemixCharacter(originalCharacterSample)
    assert.equal(rc.id, 'char_original_test_coder')
    assert.equal(rc.name, '测试程序员')
    assert.equal(rc.work_id, ORIGINAL_WORK_ID)
    assert.equal(rc.rights_status, 'original' as unknown as string)
    assert.equal(rc.risk_level, 'low')
    assert.deepEqual(rc.character_types, ['系统架构', '快速调试', '技术布道'])
    assert.deepEqual(rc.traits, ['极客', '偏执', '深夜高效'])
    assert.deepEqual(rc.dialogue_style, ['极客', '偏执', '深夜高效'])
    assert.deepEqual(rc.relationships, [])
    assert.equal(rc.sources.length, 1)
    assert.equal(rc.sources[0].source_name, 'Linggan Seed Entities')
  })

  it('toRemixCharacter archetype 角色用 kind 作为 character_types', () => {
    const archetype: Character = CharacterSchema.parse({
      id: 'char_archetype_test',
      name: '测试原型',
      kind: 'archetype',
      media: '通用',
      traits: ['冷静', '果断'],
      abilities: ['决策'],
      relations: [],
      rights_status: 'original',
    })
    const rc = toRemixCharacter(archetype)
    assert.deepEqual(rc.character_types, ['archetype'])
  })

  it('toRemixCharacter 单一 traits 时正确派生 dialogue_style', () => {
    const minimal: Character = CharacterSchema.parse({
      id: 'char_original_minimal',
      name: '极简角色',
      kind: 'original',
      media: '通用',
      traits: ['专注'],
      abilities: ['基础'],
      relations: [],
      rights_status: 'original',
    })
    const rc = toRemixCharacter(minimal)
    assert.deepEqual(rc.dialogue_style, ['专注'])
    assert.deepEqual(rc.character_types, ['基础'])
  })

  it('createOriginalWork 返回合法 Work 结构', () => {
    const work = createOriginalWork()
    assert.equal(work.id, ORIGINAL_WORK_ID)
    assert.equal(work.title, '原创角色原型')
    assert.equal(work.rights_status, 'original')
    assert.equal(work.risk_level, 'low')
    assert.equal(work.sources.length, 1)
  })
})

describe('remix-engine with original characters', () => {
  it('buildRemixPlan 能处理原创角色 × 知名角色组合', () => {
    const originalChar = toRemixCharacter(originalCharacterSample)
    const style = remixStyles[0]

    const input: RemixPlanInput = {
      characterA: originalChar,
      characterB: knownChar,
      moment,
      workA: originalWork,
      workB: knownWork,
      momentWork: knownWork,
      style,
      duration: 30,
      seed: 'test-original-mix-001',
    }

    const plan = buildRemixPlan(input)
    assert.ok(plan.title.includes(originalCharacterSample.name))
    assert.ok(plan.concept.length > 0)
    assert.ok(plan.hook.length > 0)
    assert.equal(plan.storyboard.length, 5) // 30s → 5 镜头
    assert.ok(plan.dialogueA.length > 0)
    assert.ok(plan.dialogueB.length > 0)
    assert.equal(plan.copywriting.titles.length, 3)
    assert.ok(plan.production.copyright_boundary.reference_status.includes('原创角色原型'))
  })

  it('buildRemixPlan 两个原创角色组合版权边界声明为可商用', () => {
    const charA = toRemixCharacter(originalCharacterSample)
    const charB = toRemixCharacter(
      CharacterSchema.parse({
        id: 'char_original_test_poet',
        name: '测试诗人',
        kind: 'original',
        media: '文学',
        traits: ['浪漫', '敏感'],
        abilities: ['即兴写作'],
        relations: ['读者'],
        rights_status: 'original',
      }),
    )
    const style = remixStyles[0]

    const input: RemixPlanInput = {
      characterA: charA,
      characterB: charB,
      moment,
      workA: originalWork,
      workB: originalWork,
      momentWork: knownWork,
      style,
      duration: 15,
      seed: 'test-original-pair-001',
    }

    const plan = buildRemixPlan(input)
    assert.ok(plan.production.copyright_boundary.commercial_use.includes('原创角色原型可直接用于商业发布'))
  })

  it('buildRemixPlan 原创角色 × 知名角色版权边界声明需替换', () => {
    const originalChar = toRemixCharacter(originalCharacterSample)
    const style = remixStyles[0]

    const input: RemixPlanInput = {
      characterA: originalChar,
      characterB: knownChar,
      moment,
      workA: originalWork,
      workB: knownWork,
      momentWork: knownWork,
      style,
      duration: 30,
      seed: 'test-mixed-rights-001',
    }

    const plan = buildRemixPlan(input)
    assert.ok(plan.production.copyright_boundary.commercial_use.includes('替换为原创或已授权资产'))
  })

  it('固定种子下原创角色方案可复现', () => {
    const originalChar = toRemixCharacter(originalCharacterSample)
    const style = remixStyles[0]

    const baseInput: RemixPlanInput = {
      characterA: originalChar,
      characterB: knownChar,
      moment,
      workA: originalWork,
      workB: knownWork,
      momentWork: knownWork,
      style,
      duration: 30,
      seed: 'test-reproducible-001',
    }

    const plan1 = buildRemixPlan(baseInput)
    const plan2 = buildRemixPlan(baseInput)
    assert.deepEqual(plan1, plan2)
  })

  it('真实 seed-entities 原创角色全部能生成有效方案', () => {
    const originalChars = seedCharacters.filter((c) => c.kind === 'original')
    const style = remixStyles[0]

    for (const seedChar of originalChars) {
      const adapted = toRemixCharacter(seedChar)
      const input: RemixPlanInput = {
        characterA: adapted,
        characterB: knownChar,
        moment,
        workA: originalWork,
        workB: knownWork,
        momentWork: knownWork,
        style,
        duration: 30,
        seed: `test-all-originals-${seedChar.id}`,
      }
      const plan = buildRemixPlan(input)
      assert.ok(plan.title.includes(seedChar.name), `Plan title should include ${seedChar.name}`)
      assert.ok(plan.hook.length > 0, `Hook should not be empty for ${seedChar.name}`)
      assert.equal(plan.storyboard.length, 5, `Storyboard should have 5 shots for ${seedChar.name}`)
    }
  })
})
