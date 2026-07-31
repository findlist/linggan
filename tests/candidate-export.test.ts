import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile, writeFile, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { CandidateSchema } from '../src/data/contracts.ts'
import { CandidateExportDocumentSchema } from '../src/data/contracts.ts'
import type { Candidate } from '../src/data/contracts.ts'
import { migrateDatabase } from '../src/database/migrate.ts'
import { SqliteCandidateStore } from '../src/storage/sqlite-candidate-store.ts'
import { exportCandidates } from '../scripts/export-candidates.ts'

const migrationsDirectory = new URL('../database/migrations', import.meta.url).pathname.replace(
  /^\/(?:[A-Za-z]:)/u,
  (value) => value.slice(1),
)

// 复用 candidate-store 测试中的基础候选结构，确保通过 CandidateSchema
const baseCandidate: Candidate = CandidateSchema.parse({
  id: 'candidate_export_1',
  title: '导出测试候选',
  source_trend: 'trend_export_test',
  entities: ['char_archetype_01', 'scene_confrontation_01'],
  hook: '所有人以为这只是测试，直到认真起来。',
  score: {
    total: 76,
    metrics: {
      heat: 78,
      velocity: 72,
      contrast: 75,
      visuality: 82,
      generatability: 70,
      seriality: 68,
      novelty: 80,
    },
  },
  risk_level: 'low',
  rights_status: 'original',
  status: 'pending_review',
  generated_at: '2026-07-29T08:30:00.000+08:00',
})

const createCandidate = (id: string, generatedAt = '2026-07-29T08:30:00.000+08:00'): Candidate => ({
  ...baseCandidate,
  id,
  generated_at: generatedAt,
})

const withDatabase = async (callback: (input: { store: SqliteCandidateStore; dbPath: string }) => Promise<void>) => {
  const directory = await mkdtemp(join(tmpdir(), 'linggan-b3-'))
  try {
    const dbPath = join(directory, 'test.sqlite')
    const migrated = await migrateDatabase({ filePath: dbPath, migrationsDirectory })
    try {
      const store = new SqliteCandidateStore(migrated.database)
      await callback({ store, dbPath })
    } finally {
      migrated.database.close()
    }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

test('export writes a valid schema-conformant JSON file with approved candidates', async () => {
  await withDatabase(async ({ store, dbPath }) => {
    await store.insert(
      [createCandidate('c1', '2026-07-29T08:30:00.000+08:00'), createCandidate('c2', '2026-07-29T08:31:00.000+08:00')],
      'run_001',
    )
    await store.transition('c1', 'approved', 'high quality')

    const outputPath = join(dbPath, '..', 'candidate-export.json')
    const result = await exportCandidates({
      outputPath,
      databaseUrl: `file:${dbPath}`,
    })

    assert.equal(result.schema_version, 1)
    assert.equal(result.candidate_count, 1)
    assert.equal(result.candidates.length, 1)
    assert.equal(result.candidates[0].id, 'c1')
    assert.equal(result.candidates[0].status, 'approved')

    // 落盘内容同样通过 Schema
    const fileContent = await readFile(outputPath, 'utf8')
    const parsed = CandidateExportDocumentSchema.parse(JSON.parse(fileContent))
    assert.equal(parsed.candidate_count, 1)
    assert.equal(parsed.candidates[0].status, 'approved')
  })
})

test('export from empty SQLite produces zero-candidate document', async () => {
  await withDatabase(async ({ dbPath }) => {
    const outputPath = join(dbPath, '..', 'candidate-export-empty.json')
    const result = await exportCandidates({
      outputPath,
      databaseUrl: `file:${dbPath}`,
    })

    assert.equal(result.candidate_count, 0)
    assert.deepEqual(result.candidates, [])

    const fileContent = await readFile(outputPath, 'utf8')
    const parsed = CandidateExportDocumentSchema.parse(JSON.parse(fileContent))
    assert.equal(parsed.candidate_count, 0)
  })
})

test('export only includes approved candidates, never pending/rejected/archived', async () => {
  await withDatabase(async ({ store, dbPath }) => {
    // c1 → approved, c2 → rejected, c3 保持 pending_review, c4 → approved → archived
    await store.insert(
      [
        createCandidate('c1', '2026-07-29T08:30:00.000+08:00'),
        createCandidate('c2', '2026-07-29T08:31:00.000+08:00'),
        createCandidate('c3', '2026-07-29T08:32:00.000+08:00'),
        createCandidate('c4', '2026-07-29T08:33:00.000+08:00'),
      ],
      'run_001',
    )
    await store.transition('c1', 'approved')
    await store.transition('c2', 'rejected')
    await store.transition('c4', 'approved')
    await store.transition('c4', 'archived', 'published')

    const outputPath = join(dbPath, '..', 'candidate-export-filtered.json')
    const result = await exportCandidates({
      outputPath,
      databaseUrl: `file:${dbPath}`,
    })

    assert.equal(result.candidate_count, 1)
    assert.equal(result.candidates[0].id, 'c1')
    // 确保没有混入其它状态
    for (const candidate of result.candidates) {
      assert.equal(candidate.status, 'approved')
    }
  })
})

test('export respects limit option for homepage feed', async () => {
  await withDatabase(async ({ store, dbPath }) => {
    // 插入 12 条并全部 approve，验证默认上限 10
    const candidates = Array.from({ length: 12 }, (_, index) =>
      createCandidate(`c${index + 1}`, `2026-07-29T08:${String(index).padStart(2, '0')}:00.000+08:00`),
    )
    await store.insert(candidates, 'run_001')
    for (const candidate of candidates) {
      await store.transition(candidate.id, 'approved')
    }

    const outputPath = join(dbPath, '..', 'candidate-export-limit.json')
    const result = await exportCandidates({
      outputPath,
      databaseUrl: `file:${dbPath}`,
    })

    assert.equal(result.candidate_count, 10)
    assert.equal(result.candidates.length, 10)
  })
})

test('export atomically replaces existing file', async () => {
  await withDatabase(async ({ store, dbPath }) => {
    await store.insert([createCandidate('c1')], 'run_001')
    await store.transition('c1', 'approved')

    const outputPath = join(dbPath, '..', 'candidate-export-atomic.json')
    const oldContent = '{"old": true}'
    await writeFile(outputPath, oldContent)
    const oldStat = await stat(outputPath)

    const result = await exportCandidates({
      outputPath,
      databaseUrl: `file:${dbPath}`,
    })

    assert.equal(result.candidate_count, 1)
    const newContent = await readFile(outputPath, 'utf8')
    assert.notEqual(newContent, oldContent)
    const parsed = CandidateExportDocumentSchema.parse(JSON.parse(newContent))
    assert.equal(parsed.candidate_count, 1)

    const newStat = await stat(outputPath)
    assert.notEqual(oldStat.mtimeMs, newStat.mtimeMs)
  })
})

test('export document rejects candidate_count mismatch', () => {
  const badDoc = {
    schema_version: 1,
    exported_at: '2026-07-29T08:00:00.000+08:00',
    candidate_count: 5,
    candidates: [],
  }
  assert.equal(CandidateExportDocumentSchema.safeParse(badDoc).success, false)
})

test('export document rejects non-approved candidate status', () => {
  const badDoc = {
    schema_version: 1,
    exported_at: '2026-07-29T08:00:00.000+08:00',
    candidate_count: 1,
    candidates: [
      {
        ...baseCandidate,
        status: 'pending_review',
      },
    ],
  }
  assert.equal(CandidateExportDocumentSchema.safeParse(badDoc).success, false)
})

test('exported file includes exported_at timestamp', async () => {
  await withDatabase(async ({ dbPath }) => {
    const outputPath = join(dbPath, '..', 'candidate-export-ts.json')
    const before = new Date().toISOString()
    const result = await exportCandidates({
      outputPath,
      databaseUrl: `file:${dbPath}`,
    })
    const after = new Date().toISOString()

    assert.ok(result.exported_at >= before, 'exported_at should be >= before time')
    assert.ok(result.exported_at <= after, 'exported_at should be <= after time')
  })
})
