import type { Candidate } from '../data/contracts.ts'

/**
 * Valid candidate statuses following the state machine:
 * pending_review → approved | rejected → archived
 */
export const CANDIDATE_STATUSES = ['pending_review', 'approved', 'rejected', 'archived'] as const

export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number]

/**
 * Legal state transitions. Any transition not listed here is illegal.
 *
 * rejected → pending_review allows re-reviewing candidates that were auto-rejected
 * but later become relevant (e.g., trend resurgence, rule adjustment, or manual override).
 * The transition reopens the candidate for review:auto or manual approval.
 */
export const LEGAL_TRANSITIONS: Record<CandidateStatus, CandidateStatus[]> = {
  pending_review: ['approved', 'rejected', 'archived'],
  approved: ['archived'],
  rejected: ['pending_review', 'archived'],
  archived: [],
}

/**
 * Check if a status transition is legal.
 */
export const isLegalTransition = (from: CandidateStatus, to: CandidateStatus): boolean =>
  LEGAL_TRANSITIONS[from].includes(to)

/**
 * Result of inserting candidates.
 */
export interface CandidateInsertResult {
  inserted: number
  skipped: number
  total: number
}

/**
 * Result of transitioning a candidate's status.
 */
export interface CandidateTransitionResult {
  id: string
  from: CandidateStatus
  to: CandidateStatus
  reviewed_at: string
}

/**
 * Candidate store interface for persistence and status management.
 */
export interface CandidateStore {
  /**
   * Insert candidates with idempotency. Candidates with existing idempotency keys are skipped.
   */
  insert(candidates: Candidate[], idempotencyKeyPrefix: string): Promise<CandidateInsertResult>

  /**
   * List all candidates, optionally filtered by status.
   */
  list(status?: CandidateStatus): Promise<Candidate[]>

  /**
   * Get a single candidate by ID.
   */
  get(id: string): Promise<Candidate | null>

  /**
   * Transition a candidate's status. Throws on illegal transition.
   */
  transition(id: string, to: CandidateStatus, reason?: string): Promise<CandidateTransitionResult>

  /**
   * Count candidates by status.
   */
  countByStatus(): Promise<Record<CandidateStatus, number>>
}

/**
 * Error thrown when a status transition is illegal.
 */
export class IllegalTransitionError extends Error {
  readonly from: CandidateStatus
  readonly to: CandidateStatus

  constructor(from: CandidateStatus, to: CandidateStatus) {
    super(`Illegal candidate status transition: ${from} → ${to}`)
    this.name = 'IllegalTransitionError'
    this.from = from
    this.to = to
  }
}

/**
 * Error thrown when a candidate is not found.
 */
export class CandidateNotFoundError extends Error {
  readonly id: string

  constructor(id: string) {
    super(`Candidate not found: ${id}`)
    this.name = 'CandidateNotFoundError'
    this.id = id
  }
}

/**
 * Generate an idempotency key from a prefix and candidate content.
 */
export const generateIdempotencyKey = (prefix: string, candidate: Candidate): string => {
  const content = `${candidate.source_trend}:${candidate.entities.join(',')}:${candidate.generated_at}`
  return `${prefix}:${content}`
}
