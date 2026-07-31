import { PRODUCT_EVENT_TYPES, ProductEventSchema } from '../data/contracts.ts'
import type { ProductEvent, ProductEventType } from '../data/contracts.ts'

/**
 * 事件记录结果：recorded=1 表示新写入，0 表示因 event_id 重复而跳过。
 */
export interface EventRecordResult {
  recorded: number
  total: number
}

/**
 * 事件查询过滤器：所有条件按 AND 组合，空值表示不限制该维度。
 * startDate/endDate 按 occurred_at 字符串前缀比较（YYYY-MM-DD 或完整 ISO 均可）。
 */
export interface EventListFilters {
  event_type?: ProductEventType
  session_id?: string
  idea_id?: string
  startDate?: string
  endDate?: string
}

/**
 * 事件存储接口：统一 record/list/countByType 行为，便于在 SQLite 与内存实现间替换。
 * record 必须以 event_id 作为幂等键，重复提交不产生多条。
 */
export interface EventStore {
  record(event: ProductEvent): Promise<EventRecordResult>
  list(filters?: EventListFilters): Promise<ProductEvent[]>
  countByType(): Promise<Record<ProductEventType, number>>
}

/**
 * 内存事件存储：测试和开发用，不持久化；用 Map 保证 event_id 幂等。
 */
export class InMemoryEventStore implements EventStore {
  private readonly events = new Map<string, ProductEvent>()

  async record(event: ProductEvent): Promise<EventRecordResult> {
    // 写入前再校验一次，防止未经过 Schema 的对象进入存储
    const validated = ProductEventSchema.parse(event)
    if (this.events.has(validated.event_id)) {
      return { recorded: 0, total: this.events.size }
    }
    this.events.set(validated.event_id, validated)
    return { recorded: 1, total: this.events.size }
  }

  async list(filters: EventListFilters = {}): Promise<ProductEvent[]> {
    const all = [...this.events.values()]
    const filtered = all.filter((event) => {
      if (filters.event_type && event.event_type !== filters.event_type) return false
      if (filters.session_id && event.session_id !== filters.session_id) return false
      if (filters.idea_id && event.idea_id !== filters.idea_id) return false
      if (filters.startDate && event.occurred_at.slice(0, 10) < filters.startDate) return false
      if (filters.endDate && event.occurred_at.slice(0, 10) > filters.endDate) return false
      return true
    })
    // 按 occurred_at 降序返回（最新在前），与 listTaskRunLogs 一致
    return filtered.sort((left, right) => right.occurred_at.localeCompare(left.occurred_at))
  }

  async countByType(): Promise<Record<ProductEventType, number>> {
    // 初始化 9 类事件计数为 0，确保未记录的事件类型也有显式返回
    const counts: Record<string, number> = {}
    for (const eventType of Object.values(PRODUCT_EVENT_TYPES) as ProductEventType[]) {
      counts[eventType] = 0
    }
    for (const event of this.events.values()) {
      counts[event.event_type] = (counts[event.event_type] ?? 0) + 1
    }
    return counts as Record<ProductEventType, number>
  }
}
