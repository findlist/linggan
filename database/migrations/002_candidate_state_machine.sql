-- Add idempotency key for duplicate prevention and status constraints
ALTER TABLE candidates ADD COLUMN idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS candidates_idempotency_key_idx
  ON candidates(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Add review metadata columns
ALTER TABLE candidates ADD COLUMN reviewed_at TEXT;
ALTER TABLE candidates ADD COLUMN reviewed_reason TEXT;

-- Status must follow the state machine: pending_review → approved | rejected → archived
-- We enforce via CHECK constraint on the status column
-- Note: SQLite doesn't support ALTER TABLE ADD CONSTRAINT, so we validate in application layer
