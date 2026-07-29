import type { DatabaseSync, StatementSync } from 'node:sqlite'
import { StoredTrendSchema } from '../data/contracts.ts'
import type { CollectionItem, StoredTrend } from '../data/contracts.ts'
import {
  mergeTrend,
  toStoredTrend
} from './trend-store.ts'
import type {
  TrendStore,
  TrendStoreUpsertResult
} from './trend-store.ts'

const parseStoredTrend = (row: { payload_json: string }): StoredTrend =>
  StoredTrendSchema.parse(JSON.parse(row.payload_json) as unknown)

export class SqliteTrendStore implements TrendStore {
  private readonly database: DatabaseSync

  constructor(database: DatabaseSync) {
    this.database = database
  }

  async list(): Promise<StoredTrend[]> {
    const rows = this.database.prepare(
      'SELECT payload_json FROM trends ORDER BY id'
    ).all() as Array<{ payload_json: string }>
    return rows.map(parseStoredTrend)
  }

  async upsert(entries: Array<{ item: CollectionItem; batchId: string }>): Promise<TrendStoreUpsertResult> {
    const selectTrend = this.database.prepare(
      'SELECT payload_json FROM trends WHERE fingerprint = ?'
    ) as StatementSync
    const upsertTrend = this.database.prepare(`
      INSERT INTO trends (
        id, fingerprint, name, category, heat, velocity, lifecycle,
        rights_status, risk_level, first_seen_at, last_seen_at, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(fingerprint) DO UPDATE SET
        name = excluded.name,
        category = excluded.category,
        heat = excluded.heat,
        velocity = excluded.velocity,
        lifecycle = excluded.lifecycle,
        rights_status = excluded.rights_status,
        risk_level = excluded.risk_level,
        first_seen_at = excluded.first_seen_at,
        last_seen_at = excluded.last_seen_at,
        payload_json = excluded.payload_json
    `) as StatementSync
    const deleteSources = this.database.prepare('DELETE FROM trend_sources WHERE trend_id = ?')
    const insertSource = this.database.prepare(`
      INSERT INTO trend_sources (
        trend_id, url, source_name, page_title, published_at, collected_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `)
    const deleteMetrics = this.database.prepare('DELETE FROM trend_metrics WHERE trend_id = ?')
    const insertMetric = this.database.prepare(`
      INSERT INTO trend_metrics (trend_id, name, value, unit, observed_at)
      VALUES (?, ?, ?, ?, ?)
    `)
    const deleteBatches = this.database.prepare('DELETE FROM trend_batches WHERE trend_id = ?')
    const insertBatch = this.database.prepare(
      'INSERT INTO trend_batches (trend_id, batch_id) VALUES (?, ?)'
    )

    let inserted = 0
    let updated = 0
    let deduplicated = 0
    this.database.exec('BEGIN IMMEDIATE')
    try {
      for (const entry of entries) {
        const incoming = toStoredTrend(entry.item, entry.batchId)
        const row = selectTrend.get(incoming.fingerprint) as { payload_json: string } | undefined
        const trend = row ? mergeTrend(parseStoredTrend(row), incoming) : incoming
        if (row) {
          updated += 1
          deduplicated += 1
        } else {
          inserted += 1
        }

        upsertTrend.run(
          trend.id,
          trend.fingerprint,
          trend.name,
          trend.category,
          trend.heat,
          trend.velocity,
          trend.lifecycle,
          trend.rights_status,
          trend.risk_level,
          trend.first_seen_at,
          trend.last_seen_at,
          JSON.stringify(trend)
        )

        deleteSources.run(trend.id)
        for (const source of trend.source_evidence) {
          insertSource.run(
            trend.id,
            source.url,
            source.source_name,
            source.page_title,
            source.published_at,
            source.collected_at
          )
        }

        deleteMetrics.run(trend.id)
        for (const metric of trend.observed_metrics) {
          insertMetric.run(trend.id, metric.name, metric.value, metric.unit, metric.observed_at)
        }

        deleteBatches.run(trend.id)
        for (const batchId of trend.source_batch_ids) insertBatch.run(trend.id, batchId)
      }
      this.database.exec('COMMIT')
    } catch (error) {
      this.database.exec('ROLLBACK')
      throw error
    }

    const total = (this.database.prepare('SELECT COUNT(*) AS count FROM trends').get() as { count: number }).count
    return { inserted, updated, deduplicated, total }
  }
}
