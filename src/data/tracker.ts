// 前端事件采集器：在用户与创意方案交互时组装 ProductEvent 并暂存到 localStorage 队列，
// 通过"导出事件"按钮下载为 event-inbox 兼容 JSON，再由 scripts/sync-events.ts 回收到 SQLite。
//
// 设计要点：
// - 不 import zod：避免把 zod 带入前端 bundle，运行时校验交给后端 sync 脚本（ProductEventSchema.parse）
// - 类型用 import type 从 contracts.ts 引入，编译时擦除，零运行时开销
// - event_id 用 Math.random 生成后缀（浏览器端无 node:crypto），格式与后端 buildEventId 一致
// - 队列上限 200：超过则丢弃最旧事件，避免 localStorage 爆满；用户应定期导出清空队列

import type { ProductEvent, ProductEventType } from './contracts.ts'
import { getSessionId } from './session.ts'

const QUEUE_KEY = 'linggan-event-queue'
const MAX_QUEUE_SIZE = 200

export type { ProductEvent, ProductEventType }

// 事件 payload 值类型，与 ProductEventSchema 的 payload 一致
type PayloadValue = string | number | boolean | null
type Payload = Record<string, PayloadValue>

export interface TrackOptions {
  // 关联候选/创意 ID；risk_reported 等可不传
  ideaId?: string | null
  // 事件特有数据，如 impression 的 position、copied 的 hook_text
  payload?: Payload
}

// 事件队列导出文档格式：与 data/event-inbox/ 的 JSON 文件结构一致，供 sync-events 脚本消费
export interface EventQueueExport {
  schema_version: 1
  session_id: string
  exported_at: string
  events: ProductEvent[]
}

// 生成符合 StableIdSchema 的事件 ID：evt_{YYYYMMDDhhmmss}_{6hex}
const buildEventId = (occurredAt: string): string => {
  const stamp = occurredAt.replace(/[-:]/gu, '').replace('T', '_').slice(0, 15)
  const rand = Math.random().toString(16).slice(2, 8).padEnd(6, '0')
  return `evt_${stamp}_${rand}`
}

// 读取队列；localStorage 不可用或数据损坏时返回空数组，不阻塞采集
const readQueue = (): ProductEvent[] => {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as ProductEvent[]) : []
  } catch {
    return []
  }
}

// 写入队列；隐私模式或配额满时静默降级
const writeQueue = (events: ProductEvent[]): void => {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(events))
  } catch {
    // 静默降级：事件丢失但不阻塞用户操作
  }
}

/**
 * 记录一次产品事件：自动生成 event_id、occurred_at 和 session_id，组装后追加到队列。
 * 不做 Schema 校验（交给后端 sync 脚本），只保证字段名和格式与 ProductEventSchema 一致。
 */
export const track = (
  eventType: ProductEventType,
  options: TrackOptions = {},
  now: Date = new Date(),
): ProductEvent => {
  const occurredAt = now.toISOString()
  const event: ProductEvent = {
    schema_version: 1,
    event_id: buildEventId(occurredAt),
    event_type: eventType,
    idea_id: options.ideaId ?? null,
    session_id: getSessionId(now),
    occurred_at: occurredAt,
    payload: options.payload ?? {},
  }
  const queue = readQueue()
  queue.push(event)
  // 超过上限丢弃最旧事件；用户应定期导出清空队列，正常使用不会触及上限
  if (queue.length > MAX_QUEUE_SIZE) {
    queue.splice(0, queue.length - MAX_QUEUE_SIZE)
  }
  writeQueue(queue)
  return event
}

// 读取当前队列中未导出的事件（只读副本，不修改队列）
export const getQueuedEvents = (): ProductEvent[] => readQueue()

// 清空队列（导出并 sync 成功后调用）
export const clearQueue = (): void => {
  writeQueue([])
}

// 队列中未导出事件数，供导出按钮显示计数
export const getQueueSize = (): number => readQueue().length

/**
 * 导出当前队列为 event-inbox 兼容 JSON 文档。
 * 导出后自动清空队列，避免重复 sync；如需保留可传 keepQueue=true。
 */
export const exportQueue = (now: Date = new Date(), keepQueue = false): EventQueueExport | null => {
  const events = readQueue()
  if (events.length === 0) return null
  const doc: EventQueueExport = {
    schema_version: 1,
    // 队列可能跨会话积累事件，session_id 取最后一个事件的会话作为导出标识
    session_id: events[events.length - 1]?.session_id ?? getSessionId(now),
    exported_at: now.toISOString(),
    events,
  }
  if (!keepQueue) clearQueue()
  return doc
}
