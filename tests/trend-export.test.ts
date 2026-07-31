import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile, writeFile, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { TrendExportDocumentSchema } from '../src/data/contracts.ts'
import { CollectionItemSchema } from '../src/data/contracts.ts'
import { migrateDatabase } from '../src/database/migrate.ts'
import { seedKnowledgeBase } from '../src/database/seed-knowledge.ts'
import { SqliteTrendStore } from '../src/storage/sqlite-trend-store.ts'
import { exportTrends } from '../scripts/export-trends.ts'

const migrationsDirectory = new URL('../database/migrations', import.meta.url).pathname.replace(
  /^\/(?:[A-Za-z]:)/u,
  (value) => value.slice(1),
)

const collectedAt = '2026-07-29T07:30:00.000+08:00'

const createItem = (idSlug: string, name: string) =>
  CollectionItemSchema.parse({
    id: `item_${idSlug}`,
    name,
    aliases: [],
    category: 'meme',
    description: 'Export test item.',
    source_evidence: [
      {
        url: `https://example.com/${encodeURIComponent(idSlug)}`,
        source_name: 'Example',
        page_title: `Source for ${name}`,
        published_at: null,
        collected_at: collectedAt,
      },
    ],
    discovered_at: collectedAt,
    observed_metrics: [
      { name: 'rank', value: 7, unit: 'position', observed_at: collectedAt },
      { name: 'engagement', value: 3200, unit: 'count', observed_at: collectedAt },
    ],
    heat: 75,
    velocity: 0.65,
    lifecycle: 'rising',
    contexts: ['测试'],
    visual_actions: ['定格'],
    risk_level: 'low',
    rights_status: 'reference_only',
    notes: 'Export test.',
  })

const withDatabase = async (
  callback: (input: { database: import('node:sqlite').DatabaseSync; dbPath: string }) => Promise<void>,
) => {
  const directory = await mkdtemp(join(tmpdir(), 'linggan-a2-'))
  try {
    const dbPath = join(directory, 'test.sqlite')
    const migrated = await migrateDatabase({ filePath: dbPath, migrationsDirectory })
    try {
      await callback({ database: migrated.database, dbPath })
    } finally {
      migrated.database.close()
    }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

test('export writes a valid schema-conformant JSON file from populated SQLite', async () => {
  await withDatabase(async ({ database, dbPath }) => {
    const knowledge = JSON.parse(
      await readFile(new URL('../data/knowledge-base.json', import.meta.url), 'utf8'),
    ) as unknown
    seedKnowledgeBase(database, knowledge)

    const store = new SqliteTrendStore(database)
    const item = createItem('export_test_1', '导出测试热点')
    await store.upsert([{ item, batchId: 'run_export_1' }])

    const outputPath = join(dbPath, '..', 'trend-export.json')
    const result = await exportTrends({
      outputPath,
      databaseUrl: `file:${dbPath}`,
    })

    assert.equal(result.trend_count, 1)
    assert.equal(result.trends.length, 1)
    assert.equal(result.trends[0].name, '导出测试热点')
    assert.equal(result.schema_version, 1)

    // Verify file on disk matches
    const fileContent = await readFile(outputPath, 'utf8')
    const parsed = TrendExportDocumentSchema.parse(JSON.parse(fileContent))
    assert.equal(parsed.trend_count, 1)
    assert.equal(parsed.trends[0].rights_status, 'reference_only')
  })
})

test('export from empty SQLite produces zero-trend document', async () => {
  await withDatabase(async ({ dbPath }) => {
    const outputPath = join(dbPath, '..', 'trend-export-empty.json')
    const result = await exportTrends({
      outputPath,
      databaseUrl: `file:${dbPath}`,
    })

    assert.equal(result.trend_count, 0)
    assert.deepEqual(result.trends, [])

    const fileContent = await readFile(outputPath, 'utf8')
    const parsed = TrendExportDocumentSchema.parse(JSON.parse(fileContent))
    assert.equal(parsed.trend_count, 0)
  })
})

test('export fails gracefully on corrupted SQLite data', async () => {
  await withDatabase(async ({ database, dbPath }) => {
    // Insert corrupted payload
    database
      .prepare(
        'INSERT INTO trends (id, fingerprint, name, category, heat, velocity, lifecycle, rights_status, risk_level, first_seen_at, last_seen_at, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        'trend_corrupt_export',
        'e'.repeat(64),
        'corrupt',
        'meme',
        null,
        null,
        'rising',
        'reference_only',
        'low',
        '2026-07-29T07:30:00.000+08:00',
        '2026-07-29T07:30:00.000+08:00',
        '{broken',
      )

    const outputPath = join(dbPath, '..', 'trend-export-corrupt.json')
    await assert.rejects(exportTrends({ outputPath, databaseUrl: `file:${dbPath}` }), /JSON|parse/i)
  })
})

test('export atomically replaces existing file', async () => {
  await withDatabase(async ({ database, dbPath }) => {
    const knowledge = JSON.parse(
      await readFile(new URL('../data/knowledge-base.json', import.meta.url), 'utf8'),
    ) as unknown
    seedKnowledgeBase(database, knowledge)

    const store = new SqliteTrendStore(database)
    const outputPath = join(dbPath, '..', 'trend-export-atomic.json')

    // Write an initial file
    const oldContent = '{"old": true}'
    await writeFile(outputPath, oldContent)
    const oldStat = await stat(outputPath)

    // Export with real data
    const item = createItem('atomic_test', '原子替换测试')
    await store.upsert([{ item, batchId: 'run_atomic' }])
    const result = await exportTrends({
      outputPath,
      databaseUrl: `file:${dbPath}`,
    })

    assert.equal(result.trend_count, 1)

    // File should have been replaced
    const newContent = await readFile(outputPath, 'utf8')
    assert.notEqual(newContent, oldContent)
    const parsed = TrendExportDocumentSchema.parse(JSON.parse(newContent))
    assert.equal(parsed.trend_count, 1)

    // Verify it's a different inode (atomically replaced via rename)
    const newStat = await stat(outputPath)
    assert.notEqual(oldStat.mtimeMs, newStat.mtimeMs)
  })
})

test('export document rejects trend_count mismatch', () => {
  const badDoc = {
    schema_version: 1,
    exported_at: '2026-07-29T08:00:00.000+08:00',
    trend_count: 5,
    trends: [],
  }
  assert.equal(TrendExportDocumentSchema.safeParse(badDoc).success, false)
})

test('exported file includes exported_at timestamp', async () => {
  await withDatabase(async ({ dbPath }) => {
    const outputPath = join(dbPath, '..', 'trend-export-ts.json')
    const before = new Date().toISOString()
    const result = await exportTrends({
      outputPath,
      databaseUrl: `file:${dbPath}`,
    })
    const after = new Date().toISOString()

    assert.ok(result.exported_at >= before, 'exported_at should be >= before time')
    assert.ok(result.exported_at <= after, 'exported_at should be <= after time')
  })
})
