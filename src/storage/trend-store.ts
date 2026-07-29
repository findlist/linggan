import { createHash } from 'node:crypto'
import {
  TrendStoreDocumentSchema
} from '../data/contracts.ts'
import type {
  CollectionItem,
  SourceEvidence,
  StoredTrend,
  TrendStoreDocument
} from '../data/contracts.ts'
import { JsonDocumentStore } from './json-document-store.ts'

export interface TrendStoreUpsertResult {
  inserted: number
  updated: number
  deduplicated: number
  total: number
}

export interface TrendStore {
  list(): Promise<StoredTrend[]>
  upsert(items: Array<{ item: CollectionItem; batchId: string }>): Promise<TrendStoreUpsertResult>
}

const normalizeText = (value: string): string =>
  value.normalize('NFKC').trim().toLocaleLowerCase('zh-CN').replace(/[\s\p{P}\p{S}]+/gu, '')

export const trendFingerprint = (item: Pick<CollectionItem, 'category' | 'name'>): string =>
  createHash('sha256').update(`${item.category}:${normalizeText(item.name)}`).digest('hex')

const uniqueTexts = (...collections: string[][]): string[] =>
  [...new Set(collections.flat().map(value => value.trim()).filter(Boolean))]

const uniqueEvidence = (...collections: SourceEvidence[][]): SourceEvidence[] => {
  const byUrl = new Map<string, SourceEvidence>()
  for (const evidence of collections.flat()) {
    const current = byUrl.get(evidence.url)
    if (!current || evidence.collected_at > current.collected_at) {
      byUrl.set(evidence.url, evidence)
    }
  }
  return [...byUrl.values()].sort((left, right) => left.url.localeCompare(right.url))
}

const uniqueMetrics = (
  ...collections: StoredTrend['observed_metrics'][]
): StoredTrend['observed_metrics'] => {
  const byIdentity = new Map<string, StoredTrend['observed_metrics'][number]>()
  for (const metric of collections.flat()) {
    const key = `${metric.name}\u0000${metric.value}\u0000${metric.unit}\u0000${metric.observed_at}`
    byIdentity.set(key, metric)
  }
  return [...byIdentity.values()].sort((left, right) => left.observed_at.localeCompare(right.observed_at))
}

const riskPriority: Record<StoredTrend['risk_level'], number> = {
  low: 0,
  medium: 1,
  high: 2,
  blocked: 3
}

const rightsPriority: Record<StoredTrend['rights_status'], number> = {
  public_domain: 0,
  original: 1,
  licensed: 1,
  unknown: 2,
  reference_only: 3,
  restricted: 4
}

const toStoredTrend = (item: CollectionItem, batchId: string): StoredTrend => {
  const fingerprint = trendFingerprint(item)
  return {
    id: `trend_${fingerprint.slice(0, 16)}`,
    fingerprint,
    name: item.name,
    aliases: item.aliases,
    category: item.category,
    description: item.description,
    source_evidence: item.source_evidence,
    observed_metrics: item.observed_metrics,
    heat: item.heat,
    velocity: item.velocity,
    lifecycle: item.lifecycle,
    contexts: item.contexts,
    visual_actions: item.visual_actions,
    risk_level: item.risk_level,
    rights_status: item.rights_status,
    first_seen_at: item.discovered_at,
    last_seen_at: item.discovered_at,
    source_batch_ids: [batchId]
  }
}

const mergeTrend = (current: StoredTrend, incoming: StoredTrend): StoredTrend => {
  const incomingIsNewer = incoming.last_seen_at >= current.last_seen_at
  return {
    ...current,
    name: incomingIsNewer ? incoming.name : current.name,
    aliases: uniqueTexts(
      current.aliases,
      incoming.aliases,
      current.name === incoming.name ? [] : [current.name, incoming.name]
    ),
    description: incomingIsNewer ? incoming.description : current.description,
    source_evidence: uniqueEvidence(current.source_evidence, incoming.source_evidence),
    observed_metrics: uniqueMetrics(current.observed_metrics, incoming.observed_metrics),
    heat: incomingIsNewer ? incoming.heat : current.heat,
    velocity: incomingIsNewer ? incoming.velocity : current.velocity,
    lifecycle: incomingIsNewer ? incoming.lifecycle : current.lifecycle,
    contexts: uniqueTexts(current.contexts, incoming.contexts),
    visual_actions: uniqueTexts(current.visual_actions, incoming.visual_actions),
    risk_level: riskPriority[incoming.risk_level] > riskPriority[current.risk_level]
      ? incoming.risk_level
      : current.risk_level,
    rights_status: rightsPriority[incoming.rights_status] > rightsPriority[current.rights_status]
      ? incoming.rights_status
      : current.rights_status,
    first_seen_at: current.first_seen_at <= incoming.first_seen_at
      ? current.first_seen_at
      : incoming.first_seen_at,
    last_seen_at: current.last_seen_at >= incoming.last_seen_at
      ? current.last_seen_at
      : incoming.last_seen_at,
    source_batch_ids: uniqueTexts(current.source_batch_ids, incoming.source_batch_ids)
  }
}

export class JsonTrendStore implements TrendStore {
  private readonly documentStore: JsonDocumentStore<TrendStoreDocument>

  constructor(filePath: string) {
    this.documentStore = new JsonDocumentStore(
      filePath,
      TrendStoreDocumentSchema,
      () => ({ schema_version: 1, trends: [] })
    )
  }

  async list(): Promise<StoredTrend[]> {
    return (await this.documentStore.read()).trends
  }

  async upsert(entries: Array<{ item: CollectionItem; batchId: string }>): Promise<TrendStoreUpsertResult> {
    const document = await this.documentStore.read()
    const byFingerprint = new Map(document.trends.map(trend => [trend.fingerprint, trend]))
    let inserted = 0
    let updated = 0
    let deduplicated = 0

    for (const entry of entries) {
      const incoming = toStoredTrend(entry.item, entry.batchId)
      const current = byFingerprint.get(incoming.fingerprint)
      if (current) {
        byFingerprint.set(incoming.fingerprint, mergeTrend(current, incoming))
        updated += 1
        deduplicated += 1
      } else {
        byFingerprint.set(incoming.fingerprint, incoming)
        inserted += 1
      }
    }

    const next: TrendStoreDocument = {
      schema_version: 1,
      trends: [...byFingerprint.values()].sort((left, right) => left.id.localeCompare(right.id))
    }
    await this.documentStore.write(next)
    return { inserted, updated, deduplicated, total: next.trends.length }
  }
}
