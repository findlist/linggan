import { z } from 'zod'

const NonEmptyTextSchema = z.string().trim().min(1)
const StableIdSchema = z.string().regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/)
const StringListSchema = z.array(NonEmptyTextSchema)
const UniqueStringListSchema = StringListSchema.refine(
  values => new Set(values).size === values.length,
  'must not contain duplicate values'
)
const ScoreValueSchema = z.number().finite().min(0).max(100)

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
