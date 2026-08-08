import { z } from 'zod'

const NonEmptyTextSchema = z.string().trim().min(1)
export const StableIdSchema = z.string().regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/)
const StringListSchema = z.array(NonEmptyTextSchema)
const UniqueStringListSchema = StringListSchema.refine(
  values => new Set(values).size === values.length,
  'must not contain duplicate values'
)
const ScoreValueSchema = z.number().finite().min(0).max(100)
const HttpUrlSchema = z.string().url().refine(value => /^https?:\/\//u.test(value), 'must be an HTTP(S) URL')

export const RightsStatusSchema = z.enum([
  'original',
  'licensed',
  'public_domain',
  'reference_only',
  'unknown',
  'restricted'
])

export const LifecycleSchema = z.enum([
  'emerging',
  'rising',
  'peak',
  'declining',
  'evergreen',
  'archived'
])

export const RiskLevelSchema = z.enum(['low', 'medium', 'high', 'blocked'])

export const SourceEvidenceSchema = z.object({
  url: HttpUrlSchema,
  source_name: NonEmptyTextSchema,
  page_title: NonEmptyTextSchema,
  published_at: z.iso.datetime({ offset: true }).nullable(),
  collected_at: z.iso.datetime({ offset: true })
}).strict()

export const WorkSchema = z.object({
  id: StableIdSchema,
  title: NonEmptyTextSchema,
  original_title: NonEmptyTextSchema.nullable(),
  aliases: UniqueStringListSchema,
  media_type: z.enum(['television', 'anime', 'film', 'game', 'variety']),
  regions: UniqueStringListSchema.min(1),
  release_year: z.number().int().min(1800).max(2200).nullable(),
  genres: UniqueStringListSchema.min(1),
  rights_status: RightsStatusSchema,
  risk_level: RiskLevelSchema,
  sources: z.array(SourceEvidenceSchema).min(1),
  last_verified_at: z.iso.datetime({ offset: true })
}).strict()

export const KnownCharacterSchema = z.object({
  id: StableIdSchema,
  work_id: StableIdSchema,
  name: NonEmptyTextSchema,
  aliases: UniqueStringListSchema,
  roles: UniqueStringListSchema.min(1),
  character_types: UniqueStringListSchema.min(1),
  traits: UniqueStringListSchema.min(1),
  dialogue_style: UniqueStringListSchema.min(1),
  relationships: z.array(StableIdSchema),
  rights_status: z.literal('reference_only'),
  risk_level: RiskLevelSchema,
  sources: z.array(SourceEvidenceSchema).min(1),
  last_verified_at: z.iso.datetime({ offset: true })
}).strict()

export const CharacterRelationshipSchema = z.object({
  id: StableIdSchema,
  work_id: StableIdSchema,
  from_character_id: StableIdSchema,
  to_character_id: StableIdSchema,
  relation: NonEmptyTextSchema,
  description: NonEmptyTextSchema,
  sources: z.array(SourceEvidenceSchema).min(1),
  last_verified_at: z.iso.datetime({ offset: true })
}).strict().refine(value => value.from_character_id !== value.to_character_id, {
  message: 'relationship endpoints must differ'
})

export const IconicMomentSchema = z.object({
  id: StableIdSchema,
  work_id: StableIdSchema,
  name: NonEmptyTextSchema,
  participant_ids: z.array(StableIdSchema).min(1),
  setting: NonEmptyTextSchema,
  conflict_type: NonEmptyTextSchema,
  emotional_arc: UniqueStringListSchema.min(2),
  visual_actions: UniqueStringListSchema.min(1),
  reusable_beats: UniqueStringListSchema.min(3),
  dialogue_patterns: UniqueStringListSchema.min(2),
  abstraction: NonEmptyTextSchema,
  rights_status: z.literal('reference_only'),
  risk_level: RiskLevelSchema,
  sources: z.array(SourceEvidenceSchema).min(1),
  last_verified_at: z.iso.datetime({ offset: true })
}).strict()

export const KnowledgeBaseSchema = z.object({
  schema_version: z.literal(1),
  works: z.array(WorkSchema),
  known_characters: z.array(KnownCharacterSchema),
  relationships: z.array(CharacterRelationshipSchema),
  iconic_moments: z.array(IconicMomentSchema)
}).strict().superRefine((knowledge, context) => {
  const workIds = new Set(knowledge.works.map(work => work.id))
  const characterIds = new Set(knowledge.known_characters.map(character => character.id))
  const allIds = [
    ...knowledge.works.map(item => item.id),
    ...knowledge.known_characters.map(item => item.id),
    ...knowledge.relationships.map(item => item.id),
    ...knowledge.iconic_moments.map(item => item.id)
  ]

  if (new Set(allIds).size !== allIds.length) {
    context.addIssue({ code: 'custom', path: [], message: 'knowledge entity ids must be globally unique' })
  }

  knowledge.known_characters.forEach((character, index) => {
    if (!workIds.has(character.work_id)) {
      context.addIssue({ code: 'custom', path: ['known_characters', index, 'work_id'], message: 'unknown work id' })
    }
    character.relationships.forEach((id, relationIndex) => {
      if (!characterIds.has(id)) {
        context.addIssue({ code: 'custom', path: ['known_characters', index, 'relationships', relationIndex], message: 'unknown character id' })
      }
    })
  })

  knowledge.relationships.forEach((relationship, index) => {
    if (!workIds.has(relationship.work_id)) {
      context.addIssue({ code: 'custom', path: ['relationships', index, 'work_id'], message: 'unknown work id' })
    }
    for (const field of ['from_character_id', 'to_character_id'] as const) {
      if (!characterIds.has(relationship[field])) {
        context.addIssue({ code: 'custom', path: ['relationships', index, field], message: 'unknown character id' })
      }
    }
  })

  knowledge.iconic_moments.forEach((moment, index) => {
    if (!workIds.has(moment.work_id)) {
      context.addIssue({ code: 'custom', path: ['iconic_moments', index, 'work_id'], message: 'unknown work id' })
    }
    moment.participant_ids.forEach((id, participantIndex) => {
      if (!characterIds.has(id)) {
        context.addIssue({ code: 'custom', path: ['iconic_moments', index, 'participant_ids', participantIndex], message: 'unknown character id' })
      }
    })
  })
})

/* ----------------------- 兼容矩阵（C1） ----------------------- */
// 兼容矩阵把角色能力、场景约束、生成难度和冲突类型适配编码为可校验数据，
// 供 remix-engine 在生成时过滤不合理组合（如"温柔型角色 × 高强度战斗场景 × 15s"）或调整生成难度权重。

/** 角色能力维度：战斗 / 智谋 / 社交 / 技术 / 情绪控制 */
export const CharacterAbilityDimensionSchema = z.enum([
  'combat',
  'strategy',
  'social',
  'tech',
  'emotional_control'
])

/** 场景约束维度：时间压力 / 参与人数规模 / 空间复杂度 / 道具依赖度 */
export const SceneConstraintDimensionSchema = z.enum([
  'time_pressure',
  'participant_scale',
  'spatial_complexity',
  'prop_dependency'
])

/** 生成难度维度：镜头复杂度 / 对白密度 / 视觉特效负担 / 动作编排难度 */
export const GenerationDifficultyDimensionSchema = z.enum([
  'shot_complexity',
  'dialogue_density',
  'vfx_burden',
  'action_choreography'
])

const DimensionScoreSchema = z.number().finite().min(0).max(1)

/** 角色能力档案：按角色 ID 记录五维能力分值（0-1） */
export const CharacterAbilityProfileSchema = z.object({
  character_id: StableIdSchema,
  abilities: z.object({
    combat: DimensionScoreSchema,
    strategy: DimensionScoreSchema,
    social: DimensionScoreSchema,
    tech: DimensionScoreSchema,
    emotional_control: DimensionScoreSchema
  }).strict(),
  notes: NonEmptyTextSchema.nullable()
}).strict()

/** 场景约束档案：按名场面 ID 记录四维约束强度（0-1） */
export const SceneConstraintProfileSchema = z.object({
  moment_id: StableIdSchema,
  constraints: z.object({
    time_pressure: DimensionScoreSchema,
    participant_scale: DimensionScoreSchema,
    spatial_complexity: DimensionScoreSchema,
    prop_dependency: DimensionScoreSchema
  }).strict(),
  notes: NonEmptyTextSchema.nullable()
}).strict()

/** 冲突类型生成难度档案：按冲突类型记录四维难度（0-1）和最小时长 */
export const ConflictDifficultyProfileSchema = z.object({
  conflict_type: NonEmptyTextSchema,
  difficulty: z.object({
    shot_complexity: DimensionScoreSchema,
    dialogue_density: DimensionScoreSchema,
    vfx_burden: DimensionScoreSchema,
    action_choreography: DimensionScoreSchema
  }).strict(),
  min_duration: z.union([z.literal(15), z.literal(30), z.literal(60)]),
  notes: NonEmptyTextSchema.nullable()
}).strict()

/** 能力-冲突适配规则：某能力维度对某冲突类型的适配分值（0-1） */
export const AbilityConflictFitSchema = z.object({
  ability: CharacterAbilityDimensionSchema,
  conflict_type: NonEmptyTextSchema,
  fit: DimensionScoreSchema
}).strict()

/**
 * 兼容矩阵文档：角色能力 × 场景约束 × 生成难度 × 冲突类型适配。
 * 内部校验：ID 唯一、冲突类型唯一、能力-冲突组合唯一。
 * 与知识库的外键一致性通过 validateMatrixWithKnowledge 函数校验。
 */
export const CompatibilityMatrixSchema = z.object({
  schema_version: z.literal(1),
  character_abilities: z.array(CharacterAbilityProfileSchema),
  scene_constraints: z.array(SceneConstraintProfileSchema),
  conflict_difficulties: z.array(ConflictDifficultyProfileSchema),
  ability_conflict_fits: z.array(AbilityConflictFitSchema)
}).strict().superRefine((matrix, context) => {
  const characterIds = matrix.character_abilities.map(item => item.character_id)
  if (new Set(characterIds).size !== characterIds.length) {
    context.addIssue({ code: 'custom', path: ['character_abilities'], message: 'duplicate character_id in ability profiles' })
  }

  const momentIds = matrix.scene_constraints.map(item => item.moment_id)
  if (new Set(momentIds).size !== momentIds.length) {
    context.addIssue({ code: 'custom', path: ['scene_constraints'], message: 'duplicate moment_id in scene constraints' })
  }

  const conflictTypes = matrix.conflict_difficulties.map(item => item.conflict_type)
  if (new Set(conflictTypes).size !== conflictTypes.length) {
    context.addIssue({ code: 'custom', path: ['conflict_difficulties'], message: 'duplicate conflict_type in difficulty profiles' })
  }

  const fitKeys = matrix.ability_conflict_fits.map(item => `${item.ability}|${item.conflict_type}`)
  if (new Set(fitKeys).size !== fitKeys.length) {
    context.addIssue({ code: 'custom', path: ['ability_conflict_fits'], message: 'duplicate ability-conflict_type combination' })
  }
})

/**
 * 校验兼容矩阵与知识库的外键一致性。
 * 检查角色 ID、名场面 ID 和冲突类型是否在知识库中存在。
 * 原创角色原型（kind=original）存在于 seed-entities.json 而非 knowledge-base.json，
 * 可通过可选的 seedCharacters 参数一并纳入合法角色集合。
 * 返回问题数组；空数组表示通过。
 */
export const validateMatrixWithKnowledge = (
  matrix: CompatibilityMatrix,
  knowledge: KnowledgeBase,
  seedCharacters?: readonly Character[]
): Array<{ path: string; message: string }> => {
  const issues: Array<{ path: string; message: string }> = []
  const characterIds = new Set(knowledge.known_characters.map(c => c.id))
  // 原创角色原型也允许出现在 ability profiles 中，它们不依赖任何 IP
  if (seedCharacters) {
    for (const c of seedCharacters) {
      if (c.kind === 'original') characterIds.add(c.id)
    }
  }
  const momentIds = new Set(knowledge.iconic_moments.map(m => m.id))
  const conflictTypes = new Set(knowledge.iconic_moments.map(m => m.conflict_type))

  matrix.character_abilities.forEach((profile, index) => {
    if (!characterIds.has(profile.character_id)) {
      issues.push({ path: `character_abilities[${index}].character_id`, message: `unknown character id: ${profile.character_id}` })
    }
  })

  matrix.scene_constraints.forEach((profile, index) => {
    if (!momentIds.has(profile.moment_id)) {
      issues.push({ path: `scene_constraints[${index}].moment_id`, message: `unknown moment id: ${profile.moment_id}` })
    }
  })

  matrix.conflict_difficulties.forEach((profile, index) => {
    if (!conflictTypes.has(profile.conflict_type)) {
      issues.push({ path: `conflict_difficulties[${index}].conflict_type`, message: `conflict_type not found in knowledge base: ${profile.conflict_type}` })
    }
  })

  matrix.ability_conflict_fits.forEach((fit, index) => {
    if (!conflictTypes.has(fit.conflict_type)) {
      issues.push({ path: `ability_conflict_fits[${index}].conflict_type`, message: `conflict_type not found in knowledge base: ${fit.conflict_type}` })
    }
  })

  return issues
}

export const TrendCategorySchema = z.enum([
  'meme',
  'expression',
  'television',
  'anime',
  'film',
  'game',
  'variety',
  'character',
  'video_format',
  'creator_demand',
  'festival',
  'sports',
  'cultural_event'
])

export const ObservedMetricSchema = z.object({
  name: NonEmptyTextSchema,
  value: z.number().finite().nonnegative(),
  unit: NonEmptyTextSchema,
  observed_at: z.iso.datetime({ offset: true })
}).strict()

export const CollectionItemSchema = z.object({
  id: StableIdSchema,
  name: NonEmptyTextSchema,
  aliases: UniqueStringListSchema,
  category: TrendCategorySchema,
  description: NonEmptyTextSchema,
  source_evidence: z.array(SourceEvidenceSchema).min(1),
  discovered_at: z.iso.datetime({ offset: true }),
  observed_metrics: z.array(ObservedMetricSchema),
  heat: z.number().finite().nonnegative().nullable(),
  velocity: z.number().finite().min(0).max(1).nullable(),
  lifecycle: LifecycleSchema,
  contexts: UniqueStringListSchema,
  visual_actions: UniqueStringListSchema,
  risk_level: RiskLevelSchema,
  rights_status: RightsStatusSchema,
  notes: NonEmptyTextSchema
}).strict()

export const CollectionRunSchema = z.object({
  id: StableIdSchema,
  started_at: z.iso.datetime({ offset: true }),
  finished_at: z.iso.datetime({ offset: true }),
  timezone: NonEmptyTextSchema,
  lookback_hours: z.number().int().positive().max(168),
  status: z.enum(['success', 'partial', 'failed']),
  source_count: z.number().int().nonnegative(),
  item_count: z.number().int().nonnegative(),
  deduplicated_count: z.number().int().nonnegative(),
  errors: z.array(NonEmptyTextSchema)
}).strict()

export const CollectionBatchSchema = z.object({
  schema_version: z.literal(1),
  run: CollectionRunSchema,
  items: z.array(CollectionItemSchema)
}).strict().superRefine((batch, context) => {
  if (batch.run.item_count !== batch.items.length) {
    context.addIssue({ code: 'custom', path: ['run', 'item_count'], message: 'must match items length' })
  }
  const ids = batch.items.map(item => item.id)
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: 'custom', path: ['items'], message: 'duplicate item ids' })
  }
})

export const StoredTrendSchema = z.object({
  id: StableIdSchema,
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  name: NonEmptyTextSchema,
  aliases: UniqueStringListSchema,
  category: TrendCategorySchema,
  description: NonEmptyTextSchema,
  source_evidence: z.array(SourceEvidenceSchema).min(1),
  observed_metrics: z.array(ObservedMetricSchema),
  heat: z.number().finite().nonnegative().nullable(),
  velocity: z.number().finite().min(0).max(1).nullable(),
  lifecycle: LifecycleSchema,
  contexts: UniqueStringListSchema,
  visual_actions: UniqueStringListSchema,
  risk_level: RiskLevelSchema,
  rights_status: RightsStatusSchema,
  first_seen_at: z.iso.datetime({ offset: true }),
  last_seen_at: z.iso.datetime({ offset: true }),
  source_batch_ids: z.array(StableIdSchema).min(1)
}).strict()

export const TrendStoreDocumentSchema = z.object({
  schema_version: z.literal(1),
  trends: z.array(StoredTrendSchema)
}).strict().superRefine((document, context) => {
  const fingerprints = document.trends.map(trend => trend.fingerprint)
  if (new Set(fingerprints).size !== fingerprints.length) {
    context.addIssue({ code: 'custom', path: ['trends'], message: 'duplicate trend fingerprints' })
  }
})

export const CharacterSchema = z.object({
  id: StableIdSchema,
  name: NonEmptyTextSchema,
  kind: z.enum(['archetype', 'reference', 'original', 'licensed']),
  media: NonEmptyTextSchema,
  traits: StringListSchema.min(1),
  abilities: StringListSchema.min(1),
  relations: StringListSchema,
  rights_status: RightsStatusSchema
}).strict()

export const SceneSchema = z.object({
  id: StableIdSchema,
  name: NonEmptyTextSchema,
  pattern: StringListSchema.min(1),
  lifecycle: LifecycleSchema,
  rights_status: RightsStatusSchema
}).strict()

export const ElementSchema = z.object({
  id: StableIdSchema,
  name: NonEmptyTextSchema,
  category: NonEmptyTextSchema,
  actions: StringListSchema.min(1),
  generatability: z.number().finite().min(0).max(1)
}).strict()

export const StoryPatternSchema = z.object({
  id: StableIdSchema,
  name: NonEmptyTextSchema,
  beats: StringListSchema.min(1)
}).strict()

export const TrendSchema = z.object({
  external_id: NonEmptyTextSchema,
  title: NonEmptyTextSchema,
  source: NonEmptyTextSchema,
  source_url: z.string().url(),
  observed_at: z.iso.datetime({ offset: true }),
  signals: z.object({
    rank: z.number().int().positive().nullable(),
    engagement: z.number().finite().nonnegative().nullable(),
    velocity: z.number().finite().min(0).max(1).nullable()
  }).strict(),
  aliases: StringListSchema,
  lifecycle: LifecycleSchema,
  rights_status: RightsStatusSchema,
  risk_level: RiskLevelSchema
}).strict()

export const CandidateScoreSchema = z.object({
  total: ScoreValueSchema,
  metrics: z.object({
    heat: ScoreValueSchema,
    velocity: ScoreValueSchema,
    contrast: ScoreValueSchema,
    visuality: ScoreValueSchema,
    generatability: ScoreValueSchema,
    seriality: ScoreValueSchema,
    novelty: ScoreValueSchema
  }).strict()
}).strict()

export const CandidateSchema = z.object({
  id: StableIdSchema,
  title: NonEmptyTextSchema,
  source_trend: NonEmptyTextSchema,
  entities: z.array(StableIdSchema).min(1),
  hook: NonEmptyTextSchema,
  score: CandidateScoreSchema,
  risk_level: RiskLevelSchema,
  rights_status: RightsStatusSchema,
  status: z.enum(['pending_review', 'approved', 'rejected', 'archived']),
  generated_at: z.iso.datetime({ offset: true })
}).strict()

export const SeedEntitiesSchema = z.object({
  characters: z.array(CharacterSchema),
  scenes: z.array(SceneSchema),
  story_patterns: z.array(StoryPatternSchema),
  elements: z.array(ElementSchema)
}).strict().superRefine((seed, context) => {
  const seen = new Set<string>()

  for (const [collectionName, entities] of Object.entries(seed)) {
    entities.forEach((entity, index) => {
      if (seen.has(entity.id)) {
        context.addIssue({
          code: 'custom',
          path: [collectionName, index, 'id'],
          message: `duplicate entity id: ${entity.id}`
        })
      }
      seen.add(entity.id)
    })
  }
})

export const TaxonomySchema = z.object({
  media: UniqueStringListSchema,
  entity_types: UniqueStringListSchema,
  character_roles: UniqueStringListSchema,
  personalities: UniqueStringListSchema,
  relationships: UniqueStringListSchema,
  scene_patterns: UniqueStringListSchema,
  moods: UniqueStringListSchema,
  lifecycle: z.array(LifecycleSchema).min(1),
  rights_status: z.array(RightsStatusSchema).min(1),
  risk_level: z.array(RiskLevelSchema).min(1)
}).strict()

export const TrendInboxSchema = z.array(TrendSchema)

export type RightsStatus = z.infer<typeof RightsStatusSchema>
export type Lifecycle = z.infer<typeof LifecycleSchema>
export type RiskLevel = z.infer<typeof RiskLevelSchema>
export type Character = z.infer<typeof CharacterSchema>
export type Scene = z.infer<typeof SceneSchema>
export type Element = z.infer<typeof ElementSchema>
export type Trend = z.infer<typeof TrendSchema>
export type Candidate = z.infer<typeof CandidateSchema>
export type SourceEvidence = z.infer<typeof SourceEvidenceSchema>
export type KnowledgeBase = z.infer<typeof KnowledgeBaseSchema>
export type Work = z.infer<typeof WorkSchema>
export type KnownCharacter = z.infer<typeof KnownCharacterSchema>
export type CharacterRelationship = z.infer<typeof CharacterRelationshipSchema>
export type IconicMoment = z.infer<typeof IconicMomentSchema>
export type CollectionBatch = z.infer<typeof CollectionBatchSchema>
export type CollectionItem = z.infer<typeof CollectionItemSchema>
export type ObservedMetric = z.infer<typeof ObservedMetricSchema>
export type TrendCategory = z.infer<typeof TrendCategorySchema>
export type CharacterAbilityDimension = z.infer<typeof CharacterAbilityDimensionSchema>
export type SceneConstraintDimension = z.infer<typeof SceneConstraintDimensionSchema>
export type GenerationDifficultyDimension = z.infer<typeof GenerationDifficultyDimensionSchema>
export type CharacterAbilityProfile = z.infer<typeof CharacterAbilityProfileSchema>
export type SceneConstraintProfile = z.infer<typeof SceneConstraintProfileSchema>
export type ConflictDifficultyProfile = z.infer<typeof ConflictDifficultyProfileSchema>
export type AbilityConflictFit = z.infer<typeof AbilityConflictFitSchema>
export type CompatibilityMatrix = z.infer<typeof CompatibilityMatrixSchema>
/**
 * Read-only export document for static site consumption.
 * The frontend reads this file instead of accessing SQLite directly.
 */
export const TrendExportDocumentSchema = z.object({
  schema_version: z.literal(1),
  exported_at: z.iso.datetime({ offset: true }),
  trend_count: z.number().int().nonnegative(),
  trends: z.array(StoredTrendSchema)
}).strict().superRefine((document, context) => {
  if (document.trend_count !== document.trends.length) {
    context.addIssue({
      code: 'custom',
      path: ['trend_count'],
      message: 'must match trends length'
    })
  }

  const fingerprints = document.trends.map(trend => trend.fingerprint)
  if (new Set(fingerprints).size !== fingerprints.length) {
    context.addIssue({ code: 'custom', path: ['trends'], message: 'duplicate trend fingerprints' })
  }
})

export type TrendExportDocument = z.infer<typeof TrendExportDocumentSchema>

/**
 * 只读候选导出文档，供静态网站今日推荐流消费。
 * 前端读取该文件而不是直接访问 SQLite；
 * 文档只包含 approved 候选，禁止携带待审、驳回或归档内容。
 */
export const CandidateExportDocumentSchema = z.object({
  schema_version: z.literal(1),
  exported_at: z.iso.datetime({ offset: true }),
  candidate_count: z.number().int().nonnegative(),
  candidates: z.array(CandidateSchema)
}).strict().superRefine((document, context) => {
  if (document.candidate_count !== document.candidates.length) {
    context.addIssue({
      code: 'custom',
      path: ['candidate_count'],
      message: 'must match candidates length'
    })
  }

  const ids = document.candidates.map(candidate => candidate.id)
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: 'custom', path: ['candidates'], message: 'duplicate candidate ids' })
  }

  // 导出文档只允许 approved 候选，确保前端不可能展示待审内容
  document.candidates.forEach((candidate, index) => {
    if (candidate.status !== 'approved') {
      context.addIssue({
        code: 'custom',
        path: ['candidates', index, 'status'],
        message: `exported candidates must be approved, got ${candidate.status}`
      })
    }
  })
})

export type CandidateExportDocument = z.infer<typeof CandidateExportDocumentSchema>

export type StoredTrend = z.infer<typeof StoredTrendSchema>
export type TrendStoreDocument = z.infer<typeof TrendStoreDocumentSchema>

/**
 * 统一任务运行日志 Schema。
 * 采集、迁移、生成和导出各环节产生结构化运行记录，
 * 持久化到 data/run-logs/ 目录，可查询和回溯。
 */
export const TaskRunLogSchema = z.object({
  schema_version: z.literal(1),
  id: StableIdSchema,
  task_name: z.enum([
    'collect:wikipedia',
    'migrate:trends',
    'pipeline:daily',
    'review:auto',
    'review:revoke',
    'review:reopen',
    'review:reactivate',
    'export:trends',
    'export:candidates',
    'sync:events',
    'update:weekly-weights'
  ]),
  started_at: z.iso.datetime({ offset: true }),
  finished_at: z.iso.datetime({ offset: true }),
  duration_ms: z.number().int().nonnegative(),
  status: z.enum(['success', 'partial', 'failed']),
  processed_count: z.number().int().nonnegative(),
  success_count: z.number().int().nonnegative(),
  failure_count: z.number().int().nonnegative(),
  errors: z.array(NonEmptyTextSchema),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
  environment: z.object({
    node_version: NonEmptyTextSchema,
    command: NonEmptyTextSchema
  }).strict()
}).strict().superRefine((log, context) => {
  // 结束时间不得早于开始时间
  if (log.finished_at < log.started_at) {
    context.addIssue({ code: 'custom', path: ['finished_at'], message: 'must not precede started_at' })
  }
  // 部分失败或完全失败必须记录至少一条错误
  if ((log.status === 'partial' || log.status === 'failed') && log.errors.length === 0) {
    context.addIssue({
      code: 'custom',
      path: ['errors'],
      message: `${log.status} status requires at least one error`
    })
  }
  // 成功状态下不应有错误条目
  if (log.status === 'success' && log.errors.length > 0) {
    context.addIssue({
      code: 'custom',
      path: ['errors'],
      message: 'success status must not contain errors'
    })
  }
})

export type TaskRunLog = z.infer<typeof TaskRunLogSchema>
export type TaskRunLogStatus = TaskRunLog['status']
export type TaskRunLogTaskName = TaskRunLog['task_name']

/* ----------------------- 产品事件（D1） ----------------------- */
// 9 类核心产品事件，对应 DEVELOPMENT_PLAN.md 第 5 节"必须记录的产品事件"。
// 事件是 D2 偏好画像和 D3 排序权重的基础数据来源；
// event_id 作为幂等键，session_id 供 D2 聚合，payload 保留事件特有数据。

/** 9 类核心产品事件类型 */
export const ProductEventTypeSchema = z.enum([
  'idea_impression', // 判断曝光基数
  'idea_opened', // 判断标题与封面吸引力
  'idea_saved', // 判断长期价值
  'prompt_copied', // 判断方案是否可执行
  'idea_exported', // 判断专业使用意图
  'video_created', // 核心成片转化
  'video_published', // 北极星指标输入
  'idea_hidden', // 识别反感和重复
  'risk_reported' // 修正合规策略
])

/** 产品事件 Schema：统一记录用户与创意方案的交互行为 */
export const ProductEventSchema = z
  .object({
    schema_version: z.literal(1),
    event_id: StableIdSchema, // 幂等键，客户端生成，重复提交不产生多条
    event_type: ProductEventTypeSchema, // 9 类核心事件之一
    idea_id: StableIdSchema.nullable(), // 关联候选/创意 ID；risk_reported 等可不针对单个 idea
    session_id: NonEmptyTextSchema, // 会话 ID，D2 偏好画像聚合基础
    occurred_at: z.iso.datetime({ offset: true }),
    payload: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])) // 事件特有数据
  })
  .strict()

export type ProductEventType = z.infer<typeof ProductEventTypeSchema>
export type ProductEvent = z.infer<typeof ProductEventSchema>

/** 9 类核心事件列表，供采集器和测试枚举使用 */
export const PRODUCT_EVENT_TYPES = ProductEventTypeSchema.options

/**
 * 前端事件队列导出文档：前端 localStorage 队列导出为 JSON 文件，
 * 放入 data/event-inbox/ 由 scripts/sync-events.ts 回收到 SQLite。
 * 文件级只校验结构和元数据；events 数组逐个由 ProductEventSchema 校验，
 * 单个坏事件不阻止同文件其他事件入库。
 */
export const EventQueueExportSchema = z
  .object({
    schema_version: z.literal(1),
    session_id: NonEmptyTextSchema,
    exported_at: z.iso.datetime({ offset: true }),
    events: z.array(z.unknown())
  })
  .strict()

export type EventQueueExport = z.infer<typeof EventQueueExportSchema>

/* ----------------------- 偏好画像与个性化排序（D2b） ----------------------- */
// 偏好画像按 session_id 聚合产品事件，结合候选 entities/source_trend/risk_level
// 扩散到维度权重，供 personalized-rank 对候选列表重排。
// 画像只描述"该 session 偏好什么"，不持久化到 SQLite；前端从 localStorage 事件队列
// 实时聚合，后端测试可用模拟事件流验证。D3 排序权重周更新会基于画像聚合表。

/** 画像维度：候选 entity / 来源趋势 / 风险等级 三类偏好权重 */
export const PreferenceDimensionSchema = z
  .record(z.string(), z.number().finite())
  .superRefine((weights, ctx) => {
    for (const key of Object.keys(weights)) {
      if (key.trim() === '') {
        ctx.addIssue({ code: 'custom', path: [key], message: 'dimension key must be non-empty' })
      }
    }
  })

/** 偏好画像：单一 session 的维度偏好权重快照 */
export const PreferenceProfileSchema = z
  .object({
    schema_version: z.literal(1),
    session_id: NonEmptyTextSchema,
    model_version: z.literal(1),
    built_at: z.iso.datetime({ offset: true }),
    event_count: z.number().int().nonnegative(),
    idea_scores: z.record(z.string(), z.number().finite()),
    dimension_weights: z
      .object({
        entity: PreferenceDimensionSchema,
        source_trend: PreferenceDimensionSchema,
        risk_level: PreferenceDimensionSchema
      })
      .strict(),
    top_ideas: z.array(NonEmptyTextSchema)
  })
  .strict()

export type PreferenceProfile = z.infer<typeof PreferenceProfileSchema>

/** 个性化排序原因：画像命中 / 探索保留 / 冷启动无画像 */
export const RankReasonSchema = z.enum(['profiled', 'explore', 'cold'])

/** 候选个性化排序结果：携带基础分、匹配分和最终个性化分 */
export const RankedCandidateSchema = z
  .object({
    candidate_id: StableIdSchema,
    personalized_score: ScoreValueSchema,
    base_score: ScoreValueSchema,
    match_score: ScoreValueSchema,
    reason: RankReasonSchema
  })
  .strict()

export type RankReason = z.infer<typeof RankReasonSchema>

/* ----------------------- 排序权重周更新（D3） ----------------------- */
// 周权重快照：每周从 product_events 按 ISO 周聚合全局事件，计算影响排序的权重参数
// （base_ratio / match_ratio / explore_ratio / event_weights），生成可回滚、可解释的快照序列。
// - 可回滚：保留 previous_week_id 链接，支持查询任意历史周快照；
// - 可解释：记录 rule_version（算法版本）和 input_stats（输入事件统计）；
// - 安全：单次变化不超过 10%（DEVELOPMENT_STANDARD.md 第 10 节），样本不足时保持原权重。

/** ISO 周标识：格式 YYYY-Www，如 2026-W31 */
export const WeekIdSchema = z
  .string()
  .regex(/^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/u, 'week_id must be ISO 8601 week format like 2026-W31')

/** 探索效果统计（D4）：度量探索位候选的后续交互情况，反馈到 explore_ratio 调整 */
export const ExploreEffectStatsSchema = z
  .object({
    explore_impressions: z.number().int().nonnegative(),
    unique_explore_ideas: z.number().int().nonnegative(),
    explored_with_interaction: z.number().int().nonnegative(),
    interaction_rate: z.number().min(0).max(1),
  })
  .strict()

/** 周权重输入统计：记录本周事件数、会话数、创意数和按事件类型分布，用于可解释性。
 *  D4 起新增可选 explore_stats 字段，记录探索位曝光与后续交互率；旧快照无此字段时降级为 null。 */
export const WeightInputStatsSchema = z
  .object({
    event_count: z.number().int().nonnegative(),
    session_count: z.number().int().nonnegative(),
    idea_count: z.number().int().nonnegative(),
    by_type: z.record(z.string(), z.number().int().nonnegative()),
    explore_stats: ExploreEffectStatsSchema.nullable().optional(),
  })
  .strict()

/** 周权重值：影响个性化排序的参数集合 */
export const RankingWeightsSchema = z
  .object({
    base_ratio: z.number().min(0).max(1),
    match_ratio: z.number().min(0).max(1),
    explore_ratio: z.number().min(0).max(1),
    event_weights: z.record(z.string(), z.number().finite()),
  })
  .strict()

/** 周权重变化量：相对于上周的差值，用于审计和可解释性 */
export const WeightChangesSchema = z
  .object({
    base_ratio: z.number().finite(),
    match_ratio: z.number().finite(),
    explore_ratio: z.number().finite(),
    event_weights: z.record(z.string(), z.number().finite()),
  })
  .strict()

/** 排序权重周快照：单周的权重值、变化量、规则版本和输入统计 */
export const RankingWeightSnapshotSchema = z
  .object({
    schema_version: z.literal(1),
    week_id: WeekIdSchema,
    rule_version: z.literal(1),
    computed_at: z.iso.datetime({ offset: true }),
    previous_week_id: WeekIdSchema.nullable(),
    input_stats: WeightInputStatsSchema,
    weights: RankingWeightsSchema,
    changes: WeightChangesSchema,
  })
  .strict()

export type RankingWeightSnapshot = z.infer<typeof RankingWeightSnapshotSchema>
export type RankingWeights = z.infer<typeof RankingWeightsSchema>
export type WeightChanges = z.infer<typeof WeightChangesSchema>
export type WeightInputStats = z.infer<typeof WeightInputStatsSchema>
export type ExploreEffectStats = z.infer<typeof ExploreEffectStatsSchema>
