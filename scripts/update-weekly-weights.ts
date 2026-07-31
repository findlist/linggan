import { resolve } from 'node:path'
import { loadDatabaseConfig, parseSqliteUrl } from '../src/config/database.ts'
import { migrateDatabase } from '../src/database/migrate.ts'
import { SqliteEventStore } from '../src/storage/sqlite-event-store.ts'
import { SqliteWeightSnapshotStore } from '../src/storage/weight-store.ts'
import {
  buildWeeklyWeightSnapshot,
  getIsoWeekId,
  MIN_SAMPLE_SIZE,
  type WeightEvent,
} from '../src/analytics/weight-snapshot.ts'
import { createTaskRunLogger } from '../src/observability/task-run-logger.ts'

// 解析命令行参数：支持 --database <URL> --logs <dir> --week <YYYY-Www>
const argumentsByName = new Map<string, string>()
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index]
  const value = process.argv[index + 1]
  if (!key?.startsWith('--') || !value) {
    throw new Error('usage: update-weekly-weights --database <URL> --logs <dir> --week <YYYY-Www>')
  }
  argumentsByName.set(key.slice(2), value)
}

const config = loadDatabaseConfig()
const databaseUrl = argumentsByName.get('database') ?? config.url
// 默认使用当前时间的 ISO 周；可通过 --week 指定历史周重新计算
const targetWeekId = argumentsByName.get('week') ?? getIsoWeekId(new Date())

const logger = createTaskRunLogger({
  taskName: 'update:weekly-weights',
  logDirectory: resolve(argumentsByName.get('logs') ?? 'data/run-logs'),
  metadata: { database: databaseUrl, target_week: targetWeekId },
})

try {
  const { database, applied } = await migrateDatabase({
    filePath: parseSqliteUrl(databaseUrl),
    migrationsDirectory: config.migrationsDirectory,
  })

  try {
    const eventStore = new SqliteEventStore(database)
    const weightStore = new SqliteWeightSnapshotStore(database)

    // 读取所有事件并在内存按 ISO 周过滤（当前事件规模下性能足够）
    const allEvents = await eventStore.list()
    const weekEvents: WeightEvent[] = allEvents
      .filter((event) => getIsoWeekId(new Date(event.occurred_at)) === targetWeekId)
      .map((event) => ({
        event_type: event.event_type,
        idea_id: event.idea_id,
        session_id: event.session_id,
        occurred_at: event.occurred_at,
      }))

    // 读取上周快照（latest）：首次运行时为 null，使用 DEFAULT_WEIGHTS
    const previous = await weightStore.latest()

    const computedAt = new Date().toISOString()
    const snapshot = buildWeeklyWeightSnapshot(weekEvents, targetWeekId, previous, computedAt)
    await weightStore.save(snapshot)

    database.close()

    const report = {
      week_id: snapshot.week_id,
      computed_at: snapshot.computed_at,
      previous_week_id: snapshot.previous_week_id,
      applied_migrations: applied,
      input_stats: snapshot.input_stats,
      weights: snapshot.weights,
      changes: snapshot.changes,
      sample_sufficient: snapshot.input_stats.event_count >= MIN_SAMPLE_SIZE,
    }

    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)

    await logger.succeed({
      processedCount: weekEvents.length,
      successCount: 1,
      failureCount: 0,
      metadata: {
        week_id: snapshot.week_id,
        previous_week_id: snapshot.previous_week_id,
        event_count: snapshot.input_stats.event_count,
        session_count: snapshot.input_stats.session_count,
        idea_count: snapshot.input_stats.idea_count,
        sample_sufficient: report.sample_sufficient,
        // changes 是嵌套对象，MetadataValue 只接受原始值，展开为扁平字段
        base_ratio_change: snapshot.changes.base_ratio,
        match_ratio_change: snapshot.changes.match_ratio,
        explore_ratio_change: snapshot.changes.explore_ratio,
      },
    })
  } catch (error) {
    database.close()
    throw error
  }
} catch (error) {
  await logger.fail(error)
  throw error
}
