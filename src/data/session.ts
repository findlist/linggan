// 前端会话管理：D2 偏好画像按 session_id 聚合事件流，会话需跨页面刷新保持，
// 但长期无活动应过期，避免把不同访问阶段的偏好混入同一画像。
//
// 设计：session_id 与 last_active 持久化到 localStorage；
// 读取时若距 last_active 超过 SESSION_TIMEOUT_MS 则新建会话。
// session_id 格式符合 StableIdSchema（sess_{stamp}_{rand}），可被后端 Schema 直接校验。

const SESSION_KEY = 'linggan-session'
// 30 分钟无活动视为新会话；与常见分析工具默认值一致
const SESSION_TIMEOUT_MS = 30 * 60 * 1000

interface StoredSession {
  session_id: string
  last_active: string // ISO 8601
}

// 生成符合 StableIdSchema 的会话 ID：sess_{YYYYMMDDhhmmss}_{6hex}
const buildSessionId = (now: Date = new Date()): string => {
  const stamp = now.toISOString().replace(/[-:]/gu, '').replace('T', '_').slice(0, 15)
  // 浏览器端无 node:crypto，用 Math.random 生成 6 位十六进制；冲突概率极低且 event_id 幂等兜底
  const rand = Math.random().toString(16).slice(2, 8).padEnd(6, '0')
  return `sess_${stamp}_${rand}`
}

// 写入 localStorage；隐私模式或配额满时静默降级，不阻塞事件采集
const persist = (session: StoredSession): void => {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    // 静默降级：会话仍可在内存中维持当前页面有效，刷新后重建
  }
}

/**
 * 读取当前会话；过期或不存在时新建并持久化。
 * 每次调用都会 touch last_active，避免活跃用户会话被误判过期。
 */
export const getSession = (now: Date = new Date()): StoredSession => {
  let stored: StoredSession | null = null
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (raw) stored = JSON.parse(raw) as StoredSession
  } catch {
    // localStorage 不可用或数据损坏时降级：返回内存会话，不持久化
    return { session_id: buildSessionId(now), last_active: now.toISOString() }
  }

  // 已有会话且未过期：复用并更新 last_active
  if (stored?.session_id && stored?.last_active) {
    const elapsed = now.getTime() - new Date(stored.last_active).getTime()
    if (elapsed < SESSION_TIMEOUT_MS) {
      const next = { session_id: stored.session_id, last_active: now.toISOString() }
      persist(next)
      return next
    }
  }

  // 不存在或已过期：新建会话
  const next = { session_id: buildSessionId(now), last_active: now.toISOString() }
  persist(next)
  return next
}

// 获取当前会话 ID（便捷方法，自动 touch）
export const getSessionId = (now: Date = new Date()): string => getSession(now).session_id
