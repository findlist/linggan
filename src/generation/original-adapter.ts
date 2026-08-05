/**
 * 原创角色适配器：把 seed-entities.json 的 Character 转换为 remix-engine 所需的格式。
 *
 * 原创角色原型（kind=original）不依赖任何 IP，rights_status=original。
 * 适配器从 Character 的 traits/abilities/kind 字段派生 character_types 和 dialogue_style，
 * 合成最小可用的 work_id/sources/risk_level/last_verified_at 字段。
 *
 * remix-engine 无需修改任何类型定义即可处理原创角色。
 * C1 兼容矩阵已为 10 个原创角色建立 ability profile（见 data/compatibility-matrix.json），
 * computeCompatibility 能按其真实能力分值评估，不再降级为 0.5 中等分。
 */

import type { Character, KnownCharacter, SourceEvidence, Work } from '../data/contracts.ts'

/** 原创角色的合成 work_id */
export const ORIGINAL_WORK_ID = 'work_original'

/** 原创角色的合成来源证据 */
const ORIGINAL_SOURCE: SourceEvidence = {
  url: 'https://github.com/findlist/linggan',
  source_name: 'Linggan Seed Entities',
  page_title: 'Original Character Archetypes',
  published_at: null,
  collected_at: '2026-08-04T00:00:00.000Z',
}

/**
 * 从 Character 的 kind/abilities 派生 character_types。
 * original 角色用 abilities 作为 character_types（如"系统架构/快速调试"），
 * archetype 角色用 kind 作为唯一类型。
 */
const deriveCharacterTypes = (character: Character): string[] => {
  if (character.kind === 'original') {
    return character.abilities.length > 0 ? character.abilities.slice(0, 3) : ['原创']
  }
  return [character.kind]
}

/**
 * 从 Character 的 traits 派生 dialogue_style。
 * traits 如 ["极客", "偏执", "深夜高效"] 直接用作对白风格线索。
 */
const deriveDialogueStyle = (character: Character): string[] => {
  if (character.traits.length === 0) return ['直接', '简洁']
  return character.traits
}

/**
 * 把 seed-entities 的 Character 转换为 remix-engine 可用的 KnownCharacter 格式。
 *
 * 注意：返回对象的 rights_status 为 'original' 而非 'reference_only'，
 * 这在运行时是安全的——remix-engine 只读取字段值用于版权边界文案，
 * 不会用 KnownCharacterSchema 重新校验。C2 版权边界会正确显示"原创"而非"仅参考"。
 */
export const toRemixCharacter = (character: Character): KnownCharacter =>
  ({
    id: character.id,
    work_id: ORIGINAL_WORK_ID,
    name: character.name,
    aliases: [],
    roles: [character.kind],
    character_types: deriveCharacterTypes(character),
    traits: character.traits,
    dialogue_style: deriveDialogueStyle(character),
    relationships: [],
    rights_status: 'original' as unknown as KnownCharacter['rights_status'],
    risk_level: 'low',
    sources: [ORIGINAL_SOURCE],
    last_verified_at: '2026-08-04T00:00:00.000Z',
  }) as KnownCharacter

/**
 * 为原创角色创建合成的 Work 对象，用于 RemixPlanInput 中的 workA/workB 字段。
 */
export const createOriginalWork = (): Work =>
  ({
    id: ORIGINAL_WORK_ID,
    title: '原创角色原型',
    original_title: null,
    aliases: [],
    media_type: 'variety',
    regions: ['原创'],
    release_year: null,
    genres: ['原创'],
    rights_status: 'original',
    risk_level: 'low',
    sources: [ORIGINAL_SOURCE],
    last_verified_at: '2026-08-04T00:00:00.000Z',
  }) as Work
