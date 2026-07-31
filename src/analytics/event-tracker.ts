import { randomBytes } from 'node:crypto'
import { ProductEventSchema } from '../data/contracts.ts'
import type { ProductEvent, ProductEventType } from '../data/contracts.ts'
import type { EventRecordResult, EventStore } from '../storage/event-store.ts'

/**
 * 单次事件追踪的输入参数。
 * - session_id 必填：D2 偏好画像按会话聚合，无会话的事件无法用于画像
 * - idea_id 可空：risk_reported 等事件可能不针对单个创意
 * - event_id 可空：不传则自动生成；传入时用于客户端幂等（如重试同一事件）
 */
export interface TrackOptions {
  idea_id?: string | null
  session_id: string
  payload?: Record<string, string | number | boolean | null>
  event_id?: string
}

export interface EventTrackerOptions {
  store: EventStore
  clock?: () => Date
}

/**
 * 事件采集器：统一 track 入口，负责生成 event_id、组装并校验 ProductEvent 后写入存储。
 * 通过注入 clock 保证测试可重复；通过注入 store 支持 SQLite 与内存实现互换。
 */
export class EventTracker {
  private readonly store: EventStore
  private readonly clock: () => Date

  constructor(options: EventTrackerOptions) {
    this.store = options.store
    this.clock = options.clock ?? (() => new Date())
  }

  async track(eventType: ProductEventType, options: TrackOptions): Promise<EventRecordResult> {
    const occurredAt = this.clock().toISOString()
    const event = ProductEventSchema.parse({
      schema_version: 1,
      event_id: options.event_id ?? buildEventId(occurredAt),
      event_type: eventType,
      idea_id: options.idea_id ?? null,
      session_id: options.session_id,
      occurred_at: occurredAt,
      payload: options.payload ?? {},
    })
    return this.store.record(event)
  }
}

export const createEventTracker = (options: EventTrackerOptions): EventTracker => new EventTracker(options)

// 生成符合 StableIdSchema 的事件 ID：evt_{timestamp}_{random}
const buildEventId = (occurredAt: string): string => {
  const stamp = occurredAt.replace(/[-:]/gu, '').replace('T', '_').slice(0, 15)
  const suffix = randomBytes(3).toString('hex')
  return `evt_${stamp}_${suffix}`
}

// 暴露 buildEventId 供测试验证 ID 格式
export { buildEventId }
export type { ProductEvent }
