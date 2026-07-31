import type {
  AbilityConflictFit,
  CharacterAbilityProfile,
  CompatibilityMatrix,
  ConflictDifficultyProfile,
  IconicMoment,
  KnownCharacter,
  SceneConstraintProfile,
} from '../data/contracts.ts'
import type { RemixDuration } from './remix-engine.ts'

/**
 * 兼容性计算模块：读取兼容矩阵，为给定组合（角色 A × 角色 B × 名场面 × 时长）
 * 计算兼容性分值，用于在生成前过滤不合理组合或调整生成难度权重。
 *
 * 三大扣分维度：
 * 1. 角色能力与冲突类型适配——低适配扣分（如温柔型角色 × 强攻场景）
 * 2. 场景约束与时长——高约束 × 短时长扣分（如高时间压力 × 15s）
 * 3. 生成难度与时长——高难度 × 短时长扣分（如高视觉特效 × 15s，或低于最小时长）
 */

export interface CompatibilityResult {
  /** 0-1，越高表示组合越合理；1.0 为满分，扣分逐项累加 */
  score: number
  /** 导致扣分的具体原因，空数组表示无扣分 */
  reasons: string[]
}

export interface CompatibilityFilterOptions {
  /** 低于此阈值的组合被过滤，默认 0.5 */
  threshold?: number
}

/** 适配 remix-engine 的组合输入结构 */
export interface RemixCombination {
  characterA: KnownCharacter
  characterB: KnownCharacter
  moment: IconicMoment
  duration: RemixDuration
}

const findCharacterAbilities = (
  matrix: CompatibilityMatrix,
  characterId: string,
): CharacterAbilityProfile | undefined =>
  matrix.character_abilities.find((profile) => profile.character_id === characterId)

const findSceneConstraints = (matrix: CompatibilityMatrix, momentId: string): SceneConstraintProfile | undefined =>
  matrix.scene_constraints.find((profile) => profile.moment_id === momentId)

const findConflictDifficulty = (
  matrix: CompatibilityMatrix,
  conflictType: string,
): ConflictDifficultyProfile | undefined =>
  matrix.conflict_difficulties.find((profile) => profile.conflict_type === conflictType)

const findAbilityFits = (matrix: CompatibilityMatrix, conflictType: string): AbilityConflictFit[] =>
  matrix.ability_conflict_fits.filter((fit) => fit.conflict_type === conflictType)

const average = (values: number[]): number =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length

/**
 * 计算单个角色与冲突类型的能力适配分值。
 * 取角色各能力维度分值与对应冲突适配分值的乘积加权平均。
 * 无适配规则时回退到 0.5（中等），不直接判定为低兼容。
 */
const computeCharacterConflictFit = (abilities: CharacterAbilityProfile, fits: AbilityConflictFit[]): number => {
  if (fits.length === 0) return 0.5
  const weighted = fits.map((fit) => fit.fit * (abilities.abilities[fit.ability] ?? 0.5))
  return average(weighted)
}

/**
 * 计算给定组合的兼容性。
 * 从满分 1.0 开始，根据三大维度逐项扣分，最低不低于 0。
 */
export const computeCompatibility = (
  characterA: KnownCharacter,
  characterB: KnownCharacter,
  moment: IconicMoment,
  duration: RemixDuration,
  matrix: CompatibilityMatrix,
): CompatibilityResult => {
  const reasons: string[] = []
  let score = 1.0

  // 1. 角色能力与冲突类型适配
  const abilityA = findCharacterAbilities(matrix, characterA.id)
  const abilityB = findCharacterAbilities(matrix, characterB.id)
  const fits = findAbilityFits(matrix, moment.conflict_type)

  if (abilityA && fits.length > 0) {
    const fitA = computeCharacterConflictFit(abilityA, fits)
    if (fitA < 0.35) {
      score -= 0.3
      reasons.push(
        `角色 ${characterA.name} 的能力档案与"${moment.conflict_type}"冲突类型适配较低（${fitA.toFixed(2)}）`,
      )
    }
  }

  if (abilityB && fits.length > 0) {
    const fitB = computeCharacterConflictFit(abilityB, fits)
    if (fitB < 0.35) {
      score -= 0.3
      reasons.push(
        `角色 ${characterB.name} 的能力档案与"${moment.conflict_type}"冲突类型适配较低（${fitB.toFixed(2)}）`,
      )
    }
  }

  // 2. 场景约束与时长
  const scene = findSceneConstraints(matrix, moment.id)
  if (scene) {
    const { time_pressure, spatial_complexity, participant_scale } = scene.constraints
    // 高时间压力 + 短时长 = 节奏难以展开
    if (time_pressure > 0.7 && duration === 15) {
      score -= 0.2
      reasons.push(`场景时间压力高（${time_pressure.toFixed(2)}）但时长仅 15s，节奏难以展开`)
    }
    // 高空间复杂度 + 短时长 = 场景交代不足
    if (spatial_complexity > 0.7 && duration === 15) {
      score -= 0.15
      reasons.push(`场景空间复杂度高（${spatial_complexity.toFixed(2)}）但时长过短，场景交代不足`)
    }
    // 高参与人数 + 短时长 = 群像无法展开
    if (participant_scale > 0.7 && duration === 15) {
      score -= 0.15
      reasons.push(`参与人数规模大（${participant_scale.toFixed(2)}）但时长过短，群像无法展开`)
    }
  }

  // 3. 生成难度与时长
  const difficulty = findConflictDifficulty(matrix, moment.conflict_type)
  if (difficulty) {
    // 时长低于最小时长 = 严重扣分
    if (duration < difficulty.min_duration) {
      score -= 0.4
      reasons.push(`时长 ${duration}s 低于该冲突类型最小时长 ${difficulty.min_duration}s`)
    }
    // 高视觉特效负担 + 短时长 = 制作困难
    if (difficulty.difficulty.vfx_burden > 0.7 && duration === 15) {
      score -= 0.2
      reasons.push(`视觉特效负担高（${difficulty.difficulty.vfx_burden.toFixed(2)}）但时长过短，制作困难`)
    }
    // 高动作编排 + 短时长 = 动作不完整
    if (difficulty.difficulty.action_choreography > 0.7 && duration === 15) {
      score -= 0.15
      reasons.push(`动作编排难度高（${difficulty.difficulty.action_choreography.toFixed(2)}）但时长过短，动作不完整`)
    }
  }

  return { score: Math.max(0, Math.min(1, score)), reasons }
}

/**
 * 过滤掉兼容性低于阈值的组合。
 * 用于在调用 buildRemixPlan 前剔除不合理组合
 * （如"温柔型角色 × 高强度战斗场景 × 15s"）。
 */
export const filterCompatibleCombinations = <T extends RemixCombination>(
  combinations: readonly T[],
  matrix: CompatibilityMatrix,
  options?: CompatibilityFilterOptions,
): T[] => {
  const threshold = options?.threshold ?? 0.5
  return combinations.filter((input) => {
    const { score } = computeCompatibility(input.characterA, input.characterB, input.moment, input.duration, matrix)
    return score >= threshold
  })
}
