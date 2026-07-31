import assert from 'node:assert/strict'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtemp, rm } from 'node:fs/promises'
import { test } from 'node:test'
import { RankingWeightSnapshotSchema } from '../src/data/contracts.ts'
import type { RankingWeightSnapshot } from '../src/data/contracts.ts'
import { migrateDatabase } from '../src/database/migrate.ts'
import { InMemoryWeightSnapshotStore, SqliteWeightSnapshotStore } from '../src/storage/weight-store.ts'
import { buildWeeklyWeightSnapshot, type WeightEvent } from '../src/analytics/weight-snapshot.ts'

const migrationsDirectory = new URL('../database/migrations', import.meta.url).pathname.replace(
  /^\/(?:[A-Za-z]:)/u,
  (value) => value.slice(1),
)

const FIXED_TIME = '2026-07-31T12:00:00.000Z'

// 断言非 null 并收窄类型，避免在 assert.notEqual 后每处都用非空断言
const requireSnapshot = (value: RankingWeightSnapshot | null): RankingWeightSnapshot => {
  if (value === null) throw new Error('snapshot should not be null')
  return value
}

// 构造一个合法的快照，允许覆盖 week_id 和 computed_at
const buildSnapshot = (overrides: Partial<RankingWeightSnapshot> = {}): RankingWeightSnapshot => {
  const events: WeightEvent[] = Array.from({ length: 60 }, (_, i) => ({
    event_type: 'idea_impression',
    idea_id: `idea_${i % 10}`,
    session_id: `sess_${i % 5}`,
    occurred_at: FIXED_TIME,
  }))
  const snapshot = buildWeeklyWeightSnapshot(
    events,
    overrides.week_id ?? '2026-W31',
    null,
    overrides.computed_at ?? FIXED_TIME,
  )
  // 允许测试场景覆盖特定字段（如 weights 用于回滚测试）
  return { ...snapshot, ...overrides }
}

// 用临时目录 + 迁移建表，确保 ranking_weight_snapshots 表存在
const withDatabase = async (callback: (store: SqliteWeightSnapshotStore) => Promise<void>): Promise<void> => {
  const directory = await mkdtemp(join(tmpdir(), 'linggan-weights-'))
  try {
    const { database } = await migrateDatabase({
      filePath: join(directory, 'test.sqlite'),
      migrationsDirectory,
    })
    try {
      await callback(new SqliteWeightSnapshotStore(database))
    } finally {
      database.close()
    }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

/* ----------------------- InMemoryWeightSnapshotStore ----------------------- */

test('in-memory store save + get 返回保存的快照', async () => {
  const store = new InMemoryWeightSnapshotStore()
  const snapshot = buildSnapshot({ week_id: '2026-W31' })
  await store.save(snapshot)
  const retrieved = requireSnapshot(await store.get('2026-W31'))
  assert.equal(retrieved.week_id, '2026-W31')
})

test('in-memory store save 幂等：相同 week_id 覆盖旧快照', async () => {
  const store = new InMemoryWeightSnapshotStore()
  const original = buildSnapshot({ week_id: '2026-W31', computed_at: '2026-07-31T10:00:00.000Z' })
  await store.save(original)
  // 重新计算同一周，computed_at 更新
  const updated = buildSnapshot({ week_id: '2026-W31', computed_at: '2026-07-31T12:00:00.000Z' })
  await store.save(updated)
  const retrieved = requireSnapshot(await store.get('2026-W31'))
  assert.equal(retrieved.computed_at, '2026-07-31T12:00:00.000Z')
})

test('in-memory store get 不存在的 week_id 返回 null', async () => {
  const store = new InMemoryWeightSnapshotStore()
  const result = await store.get('2026-W99')
  assert.equal(result, null)
})

test('in-memory store latest 返回 computed_at 最新的快照', async () => {
  const store = new InMemoryWeightSnapshotStore()
  await store.save(buildSnapshot({ week_id: '2026-W30', computed_at: '2026-07-24T12:00:00.000Z' }))
  await store.save(buildSnapshot({ week_id: '2026-W31', computed_at: '2026-07-31T12:00:00.000Z' }))
  await store.save(buildSnapshot({ week_id: '2026-W29', computed_at: '2026-07-17T12:00:00.000Z' }))
  const latest = requireSnapshot(await store.latest())
  assert.equal(latest.week_id, '2026-W31')
})

test('in-memory store latest 空存储返回 null', async () => {
  const store = new InMemoryWeightSnapshotStore()
  const latest = await store.latest()
  assert.equal(latest, null)
})

test('in-memory store list 按 computed_at 降序返回全部快照', async () => {
  const store = new InMemoryWeightSnapshotStore()
  await store.save(buildSnapshot({ week_id: '2026-W29', computed_at: '2026-07-17T12:00:00.000Z' }))
  await store.save(buildSnapshot({ week_id: '2026-W31', computed_at: '2026-07-31T12:00:00.000Z' }))
  await store.save(buildSnapshot({ week_id: '2026-W30', computed_at: '2026-07-24T12:00:00.000Z' }))
  const list = await store.list()
  assert.equal(list.length, 3)
  assert.equal(list[0].week_id, '2026-W31')
  assert.equal(list[1].week_id, '2026-W30')
  assert.equal(list[2].week_id, '2026-W29')
})

test('in-memory store 回滚：get 任意历史周快照可用', async () => {
  const store = new InMemoryWeightSnapshotStore()
  const w30 = buildSnapshot({ week_id: '2026-W30', computed_at: '2026-07-24T12:00:00.000Z' })
  const w31 = buildSnapshot({ week_id: '2026-W31', computed_at: '2026-07-31T12:00:00.000Z' })
  await store.save(w30)
  await store.save(w31)
  // 回滚到 W30：查询历史快照并验证可独立使用
  const rollbackTarget = requireSnapshot(await store.get('2026-W30'))
  assert.equal(rollbackTarget.week_id, '2026-W30')
  assert.deepEqual(rollbackTarget.weights, w30.weights)
})

/* ----------------------- SqliteWeightSnapshotStore ----------------------- */

test('sqlite store save + get 返回保存的快照', async () => {
  await withDatabase(async (store) => {
    const snapshot = buildSnapshot({ week_id: '2026-W31' })
    await store.save(snapshot)
    const retrieved = requireSnapshot(await store.get('2026-W31'))
    assert.equal(retrieved.week_id, '2026-W31')
    assert.deepEqual(retrieved.weights, snapshot.weights)
  })
})

test('sqlite store save 幂等：相同 week_id 覆盖（INSERT OR REPLACE）', async () => {
  await withDatabase(async (store) => {
    const original = buildSnapshot({ week_id: '2026-W31', computed_at: '2026-07-31T10:00:00.000Z' })
    await store.save(original)
    const updated = buildSnapshot({ week_id: '2026-W31', computed_at: '2026-07-31T12:00:00.000Z' })
    await store.save(updated)
    const retrieved = requireSnapshot(await store.get('2026-W31'))
    assert.equal(retrieved.computed_at, '2026-07-31T12:00:00.000Z')
    // 只有一条记录
    const list = await store.list()
    assert.equal(list.length, 1)
  })
})

test('sqlite store get 不存在的 week_id 返回 null', async () => {
  await withDatabase(async (store) => {
    const result = await store.get('2026-W99')
    assert.equal(result, null)
  })
})

test('sqlite store latest 返回 computed_at 最新的快照', async () => {
  await withDatabase(async (store) => {
    await store.save(buildSnapshot({ week_id: '2026-W30', computed_at: '2026-07-24T12:00:00.000Z' }))
    await store.save(buildSnapshot({ week_id: '2026-W31', computed_at: '2026-07-31T12:00:00.000Z' }))
    await store.save(buildSnapshot({ week_id: '2026-W29', computed_at: '2026-07-17T12:00:00.000Z' }))
    const latest = requireSnapshot(await store.latest())
    assert.equal(latest.week_id, '2026-W31')
  })
})

test('sqlite store latest 空表返回 null', async () => {
  await withDatabase(async (store) => {
    const latest = await store.latest()
    assert.equal(latest, null)
  })
})

test('sqlite store list 按 computed_at 降序返回全部快照', async () => {
  await withDatabase(async (store) => {
    await store.save(buildSnapshot({ week_id: '2026-W29', computed_at: '2026-07-17T12:00:00.000Z' }))
    await store.save(buildSnapshot({ week_id: '2026-W31', computed_at: '2026-07-31T12:00:00.000Z' }))
    await store.save(buildSnapshot({ week_id: '2026-W30', computed_at: '2026-07-24T12:00:00.000Z' }))
    const list = await store.list()
    assert.equal(list.length, 3)
    assert.equal(list[0].week_id, '2026-W31')
    assert.equal(list[1].week_id, '2026-W30')
    assert.equal(list[2].week_id, '2026-W29')
  })
})

test('sqlite store 回滚：保留全部历史快照，可查询任意周', async () => {
  await withDatabase(async (store) => {
    // 模拟 3 周连续快照
    for (let w = 30; w <= 32; w++) {
      const weekId = `2026-W${String(w).padStart(2, '0')}`
      const computedAt = `2026-07-${(w - 29) * 7 + 3}T12:00:00.000Z`
      await store.save(buildSnapshot({ week_id: weekId, computed_at: computedAt }))
    }
    // 回滚到 W30：查询历史快照
    const rollbackTarget = requireSnapshot(await store.get('2026-W30'))
    assert.equal(rollbackTarget.week_id, '2026-W30')
    // 验证所有历史快照都保留
    const list = await store.list()
    assert.equal(list.length, 3)
  })
})

test('sqlite store 保存的快照通过 Schema 校验', async () => {
  await withDatabase(async (store) => {
    const snapshot = buildSnapshot({ week_id: '2026-W31' })
    await store.save(snapshot)
    const retrieved = requireSnapshot(await store.get('2026-W31'))
    const result = RankingWeightSnapshotSchema.safeParse(retrieved)
    assert.equal(result.success, true)
  })
})

/* ----------------------- 迁移建表验证 ----------------------- */

test('迁移 004 已创建 ranking_weight_snapshots 表', async () => {
  await withDatabase(async (store) => {
    // 通过 save 验证表存在且可写入
    await store.save(buildSnapshot({ week_id: '2026-W31' }))
    const list = await store.list()
    assert.equal(list.length, 1)
  })
})
