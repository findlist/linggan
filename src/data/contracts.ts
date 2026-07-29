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
export type CollectionBatch = z.infer<typeof CollectionBatchSchema>
export type CollectionItem = z.infer<typeof CollectionItemSchema>
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

export type StoredTrend = z.infer<typeof StoredTrendSchema>
export type TrendStoreDocument = z.infer<typeof TrendStoreDocumentSchema>
