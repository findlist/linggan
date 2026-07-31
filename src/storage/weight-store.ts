// 权重快照存储：保留全部历史快照，支持查询任意周和回滚。
// - InMemoryWeightSnapshotStore：测试和开发用，Map<week_id, snapshot>；
// - SqliteWeightSnapshotStore：生产用，ranking_weight_snapshots 表，week_id 主键幂等。
// 接口与 EventStore / CandidateStore 一致，便于后续替换为 PostgreSQL（E1 条件任务）。

import type { DatabaseSync } from 'node:sqlite'
import { RankingWeightSnapshotSchema } from '../data/contracts.ts'
import type { RankingWeightSnapshot } from '../data/contracts.ts'

/**
 * 权重快照存储接口：save 幂等、get 按 week_id 查询、latest 取最新、list 按时间倒序。
 * 回滚机制：通过 get(weekId) 查询任意历史快照，调用方可将其作为 previous 重新生成新快照，
 * 或直接使用历史权重值，实现"回滚到任意周"。
 */
export interface WeightSnapshotStore {
  save(snapshot: RankingWeightSnapshot): Promise<void>
  get(weekId: string): Promise<RankingWeightSnapshot | null>
  latest(): Promise<RankingWeightSnapshot | null>
  list(): Promise<RankingWeightSnapshot[]>
}

/**
 * 内存权重快照存储：测试和开发用，不持久化。
 * save 幂等：相同 week_id 覆盖旧快照（保留最新计算结果）。
 */
export class InMemoryWeightSnapshotStore implements WeightSnapshotStore {
  private readonly snapshots = new Map<string, RankingWeightSnapshot>()

  async save(snapshot: RankingWeightSnapshot): Promise<void> {
    const validated = RankingWeightSnapshotSchema.parse(snapshot)
    this.snapshots.set(validated.week_id, validated)
  }

  async get(weekId: string): Promise<RankingWeightSnapshot | null> {
    return this.snapshots.get(weekId) ?? null
  }

  async latest(): Promise<RankingWeightSnapshot | null> {
    if (this.snapshots.size === 0) return null
    // 按 computed_at 降序取第一条
    const all = [...this.snapshots.values()].sort((a, b) => b.computed_at.localeCompare(a.computed_at))
    return all[0] ?? null
  }

  async list(): Promise<RankingWeightSnapshot[]> {
    return [...this.snapshots.values()].sort((a, b) => b.computed_at.localeCompare(a.computed_at))
  }
}

// 从数据库行解析并校验快照对象
const parseSnapshot = (row: { snapshot_json: string }): RankingWeightSnapshot => {
  const payload = JSON.parse(row.snapshot_json) as unknown
  return RankingWeightSnapshotSchema.parse(payload)
}

/**
 * SQLite 权重快照存储：生产用，ranking_weight_snapshots 表。
 * save 用 INSERT OR REPLACE 保证相同 week_id 幂等（重新计算同一周时覆盖旧快照）。
 */
export class SqliteWeightSnapshotStore implements WeightSnapshotStore {
  private readonly database: DatabaseSync

  constructor(database: DatabaseSync) {
    this.database = database
  }

  async save(snapshot: RankingWeightSnapshot): Promise<void> {
    const validated = RankingWeightSnapshotSchema.parse(snapshot)
    const stmt = this.database.prepare(`
      INSERT OR REPLACE INTO ranking_weight_snapshots (week_id, computed_at, snapshot_json)
      VALUES (?, ?, ?)
    `)
    this.database.exec('BEGIN IMMEDIATE')
    try {
      stmt.run(validated.week_id, validated.computed_at, JSON.stringify(validated))
      this.database.exec('COMMIT')
    } catch (error) {
      this.database.exec('ROLLBACK')
      throw error
    }
  }

  async get(weekId: string): Promise<RankingWeightSnapshot | null> {
    const row = this.database
      .prepare('SELECT snapshot_json FROM ranking_weight_snapshots WHERE week_id = ?')
      .get(weekId) as { snapshot_json: string } | undefined
    return row ? parseSnapshot(row) : null
  }

  async latest(): Promise<RankingWeightSnapshot | null> {
    const row = this.database
      .prepare('SELECT snapshot_json FROM ranking_weight_snapshots ORDER BY computed_at DESC LIMIT 1')
      .get() as { snapshot_json: string } | undefined
    return row ? parseSnapshot(row) : null
  }

  async list(): Promise<RankingWeightSnapshot[]> {
    const rows = this.database
      .prepare('SELECT snapshot_json FROM ranking_weight_snapshots ORDER BY computed_at DESC')
      .all() as Array<{ snapshot_json: string }>
    return rows.map(parseSnapshot)
  }
}
