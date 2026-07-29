import type { DatabaseSync } from 'node:sqlite'
import { CandidateSchema } from '../data/contracts.ts'
import type { Candidate } from '../data/contracts.ts'
import {
  CandidateNotFoundError,
  IllegalTransitionError,
  isLegalTransition,
  generateIdempotencyKey
} from './candidate-store.ts'
import type {
  CandidateInsertResult,
  CandidateStatus,
  CandidateStore,
  CandidateTransitionResult
} from './candidate-store.ts'

const parseCandidate = (row: {
  payload_json: string
  status: string
  reviewed_at: string | null
  reviewed_reason: string | null
}): Candidate => {
  const payload = JSON.parse(row.payload_json) as unknown
  const candidate = CandidateSchema.parse(payload)
  // Status from DB is the source of truth
  return { ...candidate, status: row.status as Candidate['status'] }
}

export class SqliteCandidateStore implements CandidateStore {
  private readonly database: DatabaseSync

  constructor(database: DatabaseSync) {
    this.database = database
  }

  async insert(
    candidates: Candidate[],
    idempotencyKeyPrefix: string
  ): Promise<CandidateInsertResult> {
    const selectExisting = this.database.prepare(
      'SELECT 1 FROM candidates WHERE idempotency_key = ?'
    )
    const selectExistingId = this.database.prepare(
      'SELECT 1 FROM candidates WHERE id = ?'
    )
    const insertCandidate = this.database.prepare(`
      INSERT INTO candidates (
        id, source_trend_id, status, total_score, payload_json,
        generated_at, idempotency_key, reviewed_at, reviewed_reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL)
    `)

    let inserted = 0
    let skipped = 0

    this.database.exec('BEGIN IMMEDIATE')
    try {
      for (const candidate of candidates) {
        const idempotencyKey = generateIdempotencyKey(idempotencyKeyPrefix, candidate)
        const existing = selectExisting.get(idempotencyKey)
        if (existing) {
          skipped += 1
          continue
        }

        // Also skip if candidate ID already exists (from a different run prefix)
        const existingId = selectExistingId.get(candidate.id)
        if (existingId) {
          skipped += 1
          continue
        }

        insertCandidate.run(
          candidate.id,
          candidate.source_trend,
          candidate.status,
          candidate.score.total,
          JSON.stringify(candidate),
          candidate.generated_at,
          idempotencyKey
        )
        inserted += 1
      }
      this.database.exec('COMMIT')
    } catch (error) {
      this.database.exec('ROLLBACK')
      throw error
    }

    const total = (this.database.prepare(
      'SELECT COUNT(*) AS count FROM candidates'
    ).get() as { count: number }).count

    return { inserted, skipped, total }
  }

  async list(status?: CandidateStatus): Promise<Candidate[]> {
    const sql = status
      ? 'SELECT payload_json, status, reviewed_at, reviewed_reason FROM candidates WHERE status = ? ORDER BY generated_at DESC'
      : 'SELECT payload_json, status, reviewed_at, reviewed_reason FROM candidates ORDER BY generated_at DESC'
    const stmt = this.database.prepare(sql)
    const rows = (status ? stmt.all(status) : stmt.all()) as Array<{
      payload_json: string
      status: string
      reviewed_at: string | null
      reviewed_reason: string | null
    }>
    return rows.map(parseCandidate)
  }

  async get(id: string): Promise<Candidate | null> {
    const row = this.database.prepare(
      'SELECT payload_json, status, reviewed_at, reviewed_reason FROM candidates WHERE id = ?'
    ).get(id) as {
      payload_json: string
      status: string
      reviewed_at: string | null
      reviewed_reason: string | null
    } | undefined

    if (!row) return null
    return parseCandidate(row)
  }

  async transition(
    id: string,
    to: CandidateStatus,
    reason?: string
  ): Promise<CandidateTransitionResult> {
    const row = this.database.prepare(
      'SELECT status FROM candidates WHERE id = ?'
    ).get(id) as { status: string } | undefined

    if (!row) throw new CandidateNotFoundError(id)

    const from = row.status as CandidateStatus
    if (!isLegalTransition(from, to)) {
      throw new IllegalTransitionError(from, to)
    }

    const reviewedAt = new Date().toISOString()
    this.database.prepare(`
      UPDATE candidates
      SET status = ?, reviewed_at = ?, reviewed_reason = ?
      WHERE id = ?
    `).run(to, reviewedAt, reason ?? null, id)

    return { id, from, to, reviewed_at: reviewedAt }
  }

  async countByStatus(): Promise<Record<CandidateStatus, number>> {
    const rows = this.database.prepare(
      'SELECT status, COUNT(*) AS count FROM candidates GROUP BY status'
    ).all() as Array<{ status: string; count: number }>

    const counts: Record<CandidateStatus, number> = {
      pending_review: 0,
      approved: 0,
      rejected: 0,
      archived: 0
    }

    for (const row of rows) {
      counts[row.status as CandidateStatus] = row.count
    }

    return counts
  }
}
