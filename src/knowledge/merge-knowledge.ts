import { readdir, readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { z } from 'zod'
import {
  KnowledgeBaseSchema,
  WorkSchema,
  KnownCharacterSchema,
  CharacterRelationshipSchema,
  IconicMomentSchema
} from '../data/contracts.ts'
import type { KnowledgeBase, SourceEvidence, RiskLevel } from '../data/contracts.ts'
import { JsonDocumentStore } from '../storage/json-document-store.ts'

// 从 KnowledgeBase 派生实体类型，避免修改 contracts.ts 的导出
type Work = KnowledgeBase['works'][number]
type KnownCharacter = KnowledgeBase['known_characters'][number]
type CharacterRelationship = KnowledgeBase['relationships'][number]
type IconicMoment = KnowledgeBase['iconic_moments'][number]

/**
 * 增量批次 Schema：四个集合均可选，允许分批填充。
 * 跨集合外键在最终合并文档上校验，因此批次可以是部分数据。
 */
export const KnowledgeBatchSchema = z.object({
  schema_version: z.literal(1),
  works: z.array(WorkSchema).optional(),
  known_characters: z.array(KnownCharacterSchema).optional(),
  relationships: z.array(CharacterRelationshipSchema).optional(),
  iconic_moments: z.array(IconicMomentSchema).optional()
}).strict()

export type KnowledgeBatch = z.infer<typeof KnowledgeBatchSchema>

export interface MergeFailure {
  file: string
  error: string
}

export interface MergeReport {
  files_discovered: number
  files_processed: number
  files_failed: number
  works: number
  known_characters: number
  relationships: number
  iconic_moments: number
  merged_ids: number
  new_ids: number
  failures: MergeFailure[]
}

export class KnowledgeMergeError extends Error {
  readonly failures: MergeFailure[]
  readonly conflicts: string[]

  constructor(message: string, failures: MergeFailure[], conflicts: string[]) {
    super(message)
    this.name = 'KnowledgeMergeError'
    this.failures = failures
    this.conflicts = conflicts
  }
}

// 风险等级保守值排序：blocked > high > medium > low
const RISK_SEVERITY: Record<RiskLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
  blocked: 4
}

const moreConservativeRisk = (a: RiskLevel, b: RiskLevel): RiskLevel =>
  RISK_SEVERITY[a] >= RISK_SEVERITY[b] ? a : b

// 字符串数组合并去重，保持首次出现顺序
const mergeUniqueStrings = (existing: string[], incoming: string[]): string[] => {
  const seen = new Set(existing)
  for (const item of incoming) seen.add(item)
  return [...seen]
}

// 来源证据按 URL 去重合并，后处理者覆盖同 URL 旧记录
const mergeSources = (existing: SourceEvidence[], incoming: SourceEvidence[]): SourceEvidence[] => {
  const byUrl = new Map<string, SourceEvidence>()
  for (const src of existing) byUrl.set(src.url, src)
  for (const src of incoming) byUrl.set(src.url, src)
  return [...byUrl.values()]
}

// 取较新的 ISO 8601 时间戳（字符串字典序与时间顺序一致）
const newerTimestamp = (a: string, b: string): string => (a >= b ? a : b)

const mergeWork = (existing: Work, incoming: Work): Work => ({
  ...incoming,
  aliases: mergeUniqueStrings(existing.aliases, incoming.aliases),
  genres: mergeUniqueStrings(existing.genres, incoming.genres),
  regions: mergeUniqueStrings(existing.regions, incoming.regions),
  sources: mergeSources(existing.sources, incoming.sources),
  risk_level: moreConservativeRisk(existing.risk_level, incoming.risk_level),
  last_verified_at: newerTimestamp(existing.last_verified_at, incoming.last_verified_at)
})

const mergeCharacter = (existing: KnownCharacter, incoming: KnownCharacter): KnownCharacter => ({
  ...incoming,
  aliases: mergeUniqueStrings(existing.aliases, incoming.aliases),
  roles: mergeUniqueStrings(existing.roles, incoming.roles),
  character_types: mergeUniqueStrings(existing.character_types, incoming.character_types),
  traits: mergeUniqueStrings(existing.traits, incoming.traits),
  dialogue_style: mergeUniqueStrings(existing.dialogue_style, incoming.dialogue_style),
  relationships: mergeUniqueStrings(existing.relationships, incoming.relationships),
  sources: mergeSources(existing.sources, incoming.sources),
  risk_level: moreConservativeRisk(existing.risk_level, incoming.risk_level),
  last_verified_at: newerTimestamp(existing.last_verified_at, incoming.last_verified_at)
})

const mergeRelationship = (existing: CharacterRelationship, incoming: CharacterRelationship): CharacterRelationship => ({
  ...incoming,
  sources: mergeSources(existing.sources, incoming.sources),
  last_verified_at: newerTimestamp(existing.last_verified_at, incoming.last_verified_at)
})

const mergeMoment = (existing: IconicMoment, incoming: IconicMoment): IconicMoment => ({
  ...incoming,
  participant_ids: mergeUniqueStrings(existing.participant_ids, incoming.participant_ids),
  emotional_arc: mergeUniqueStrings(existing.emotional_arc, incoming.emotional_arc),
  visual_actions: mergeUniqueStrings(existing.visual_actions, incoming.visual_actions),
  reusable_beats: mergeUniqueStrings(existing.reusable_beats, incoming.reusable_beats),
  dialogue_patterns: mergeUniqueStrings(existing.dialogue_patterns, incoming.dialogue_patterns),
  sources: mergeSources(existing.sources, incoming.sources),
  risk_level: moreConservativeRisk(existing.risk_level, incoming.risk_level),
  last_verified_at: newerTimestamp(existing.last_verified_at, incoming.last_verified_at)
})

// 递归列出目录下所有 .json 文件，按路径排序保证合并顺序稳定
const listJsonFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async entry => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return listJsonFiles(path)
    return entry.isFile() && extname(entry.name).toLowerCase() === '.json' ? [path] : []
  }))
  return nested.flat().sort()
}

const formatError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

/**
 * 检测跨实体别名冲突：同一名称或别名不能指向同集合内的不同实体 ID。
 * 这是“别名归一”的体现：避免歧义别名进入知识库。
 */
const detectAliasConflicts = (knowledge: KnowledgeBase): string[] => {
  const conflicts: string[] = []

  const checkCollection = (
    collection: string,
    items: Array<{ id: string }>,
    namesPerItem: string[][]
  ) => {
    const seen = new Map<string, string>()
    items.forEach((item, index) => {
      for (const name of namesPerItem[index]) {
        const normalized = name.trim()
        if (!normalized) continue
        const previous = seen.get(normalized)
        if (previous !== undefined && previous !== item.id) {
          conflicts.push(`${collection} 别名 "${normalized}" 同时指向 ${previous} 和 ${item.id}`)
        }
        seen.set(normalized, item.id)
      }
    })
  }

  checkCollection('works', knowledge.works, knowledge.works.map(w => [w.title, ...w.aliases]))
  checkCollection('known_characters', knowledge.known_characters, knowledge.known_characters.map(c => [c.name, ...c.aliases]))
  checkCollection('iconic_moments', knowledge.iconic_moments, knowledge.iconic_moments.map(m => [m.name]))

  return conflicts
}

const emptyKnowledgeBase = (): KnowledgeBase => ({
  schema_version: 1,
  works: [],
  known_characters: [],
  relationships: [],
  iconic_moments: []
})

/**
 * 合并知识库增量批次。
 *
 * - 以现有 outputPath（如 knowledge-base.json）为基础，按文件排序顺序合并 inbox 批次；
 *   baseDocument 参数显式传入时优先使用，否则尝试读取 outputPath；
 * - 同 ID 实体合并：数组合并去重、来源按 URL 去重、风险取更保守值、时间取较新者；
 * - 合并后整体通过 KnowledgeBaseSchema 校验（全局 ID 唯一、外键有效）；
 * - 别名冲突检测：同一别名指向不同实体时失败，不写入；
 * - 原子写入：通过 JsonDocumentStore 先写临时文件再 rename，失败时旧文件不变。
 */
export const mergeKnowledgeBatches = async (input: {
  inboxDirectory: string
  outputPath: string
  baseDocument?: KnowledgeBase
}): Promise<MergeReport> => {
  // 未显式传入 baseDocument 时，尝试读取 outputPath 作为合并基础
  let baseDocument = input.baseDocument
  if (baseDocument === undefined) {
    try {
      const raw = await readFile(input.outputPath, 'utf8')
      baseDocument = KnowledgeBaseSchema.parse(JSON.parse(raw) as unknown)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }

  let files: string[] = []
  try {
    files = await listJsonFiles(input.inboxDirectory)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }

  const failures: MergeFailure[] = []
  const batches: KnowledgeBatch[] = []
  let filesProcessed = 0

  for (const file of files) {
    try {
      const raw = JSON.parse(await readFile(file, 'utf8')) as unknown
      batches.push(KnowledgeBatchSchema.parse(raw))
      filesProcessed += 1
    } catch (error) {
      failures.push({ file, error: formatError(error) })
    }
  }

  // 以基础文档为底，按文件顺序累加合并
  const base = baseDocument ?? emptyKnowledgeBase()
  const worksMap = new Map<string, Work>()
  const charsMap = new Map<string, KnownCharacter>()
  const relsMap = new Map<string, CharacterRelationship>()
  const momentsMap = new Map<string, IconicMoment>()

  for (const w of base.works) worksMap.set(w.id, w)
  for (const c of base.known_characters) charsMap.set(c.id, c)
  for (const r of base.relationships) relsMap.set(r.id, r)
  for (const m of base.iconic_moments) momentsMap.set(m.id, m)

  let mergedIds = 0
  let newIds = 0

  const trackAndMerge = <T extends { id: string }>(
    map: Map<string, T>,
    incoming: T,
    mergeFn: (existing: T, incoming: T) => T
  ) => {
    if (map.has(incoming.id)) {
      map.set(incoming.id, mergeFn(map.get(incoming.id)!, incoming))
      mergedIds += 1
    } else {
      map.set(incoming.id, incoming)
      newIds += 1
    }
  }

  for (const batch of batches) {
    for (const w of batch.works ?? []) trackAndMerge(worksMap, w, mergeWork)
    for (const c of batch.known_characters ?? []) trackAndMerge(charsMap, c, mergeCharacter)
    for (const r of batch.relationships ?? []) trackAndMerge(relsMap, r, mergeRelationship)
    for (const m of batch.iconic_moments ?? []) trackAndMerge(momentsMap, m, mergeMoment)
  }

  const merged: KnowledgeBase = {
    schema_version: 1,
    works: [...worksMap.values()],
    known_characters: [...charsMap.values()],
    relationships: [...relsMap.values()],
    iconic_moments: [...momentsMap.values()]
  }

  // 整体校验：全局 ID 唯一、外键有效、枚举合法
  const parsed = KnowledgeBaseSchema.parse(merged)

  // 别名冲突检测：同别名指向不同实体时拒绝写入
  const conflicts = detectAliasConflicts(parsed)
  if (conflicts.length > 0) {
    throw new KnowledgeMergeError(
      `知识库合并失败：检测到 ${conflicts.length} 个别名冲突`,
      failures,
      conflicts
    )
  }

  // 原子写入：校验通过后先写临时文件再 rename，失败不破坏旧文件
  const store = new JsonDocumentStore<KnowledgeBase>(
    input.outputPath,
    KnowledgeBaseSchema,
    emptyKnowledgeBase
  )
  await store.write(parsed)

  return {
    files_discovered: files.length,
    files_processed: filesProcessed,
    files_failed: failures.length,
    works: parsed.works.length,
    known_characters: parsed.known_characters.length,
    relationships: parsed.relationships.length,
    iconic_moments: parsed.iconic_moments.length,
    merged_ids: mergedIds,
    new_ids: newIds,
    failures
  }
}
