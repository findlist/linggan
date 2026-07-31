import type { DatabaseSync } from 'node:sqlite'
import { ProductEventSchema } from '../data/contracts.ts'
import type { ProductEvent, ProductEventType } from '../data/contracts.ts'
import { PRODUCT_EVENT_TYPES } from '../data/contracts.ts'
import type { EventListFilters, EventRecordResult, EventStore } from './event-store.ts'

// 从数据库行解析并校验事件对象，payload_json 是事件完整 JSON
const parseEvent = (row: { payload_json: string }): ProductEvent => {
  const payload = JSON.parse(row.payload_json) as unknown
  return ProductEventSchema.parse(payload)
}

export class SqliteEventStore implements EventStore {
  private readonly database: DatabaseSync

  constructor(database: DatabaseSync) {
    this.database = database
  }

  async record(event: ProductEvent): Promise<EventRecordResult> {
    const validated = ProductEventSchema.parse(event)
    const insert = this.database.prepare(`
      INSERT OR IGNORE INTO product_events (
        event_id, event_type, idea_id, session_id, occurred_at, created_at, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    this.database.exec('BEGIN IMMEDIATE')
    try {
      insert.run(
        validated.event_id,
        validated.event_type,
        validated.idea_id,
        validated.session_id,
        validated.occurred_at,
        new Date().toISOString(),
        JSON.stringify(validated),
      )
      this.database.exec('COMMIT')
    } catch (error) {
      this.database.exec('ROLLBACK')
      throw error
    }

    const total = (this.database.prepare('SELECT COUNT(*) AS count FROM product_events').get() as { count: number })
      .count
    // INSERT OR IGNORE 命中已存在的 event_id 时 changes=0，据此判断是否为新写入
    const changes = (this.database.prepare('SELECT changes() AS changes').get() as { changes: number }).changes
    return { recorded: changes, total }
  }

  async list(filters: EventListFilters = {}): Promise<ProductEvent[]> {
    const conditions: string[] = []
    const params: string[] = []
    if (filters.event_type) {
      conditions.push('event_type = ?')
      params.push(filters.event_type)
    }
    if (filters.session_id) {
      conditions.push('session_id = ?')
      params.push(filters.session_id)
    }
    if (filters.idea_id) {
      conditions.push('idea_id = ?')
      params.push(filters.idea_id)
    }
    if (filters.startDate) {
      conditions.push('substr(occurred_at, 1, 10) >= ?')
      params.push(filters.startDate)
    }
    if (filters.endDate) {
      conditions.push('substr(occurred_at, 1, 10) <= ?')
      params.push(filters.endDate)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const stmt = this.database.prepare(`SELECT payload_json FROM product_events ${where} ORDER BY occurred_at DESC`)
    const rows = (params.length > 0 ? stmt.all(...params) : stmt.all()) as Array<{
      payload_json: string
    }>
    return rows.map(parseEvent)
  }

  async countByType(): Promise<Record<ProductEventType, number>> {
    const rows = this.database
      .prepare('SELECT event_type, COUNT(*) AS count FROM product_events GROUP BY event_type')
      .all() as Array<{ event_type: string; count: number }>

    // 初始化 9 类事件计数为 0，确保未记录的事件类型也有显式返回
    const counts: Record<string, number> = {}
    for (const eventType of Object.values(PRODUCT_EVENT_TYPES) as ProductEventType[]) {
      counts[eventType] = 0
    }
    for (const row of rows) {
      counts[row.event_type] = row.count
    }
    return counts as Record<ProductEventType, number>
  }
}
