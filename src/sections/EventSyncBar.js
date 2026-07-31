// 事件同步条：在顶部导航渲染"导出事件"按钮，把 localStorage 事件队列导出为
// data/event-inbox 兼容 JSON 文件，供 scripts/sync-events.ts 回收到 SQLite。
//
// 设计：
// - 按钮显示未导出事件计数，每 2 秒轮询一次（track 不耦合 UI，用定时器同步显示）
// - 点击导出：调用 exportQueue() 下载 JSON，文件名含 session_id 和时间戳
// - 队列为空时禁用按钮，避免产生空文件

import { downloadText, toast } from '../ui/dom.js'
import { icon } from '../ui/icons.js'
import { exportQueue, getQueueSize } from '../data/tracker.ts'

// 每 2 秒刷新一次计数；频率足够反映用户操作，开销可忽略
const COUNT_REFRESH_MS = 2000

// 生成 event-inbox 兼容文件名：events_{session_id}_{YYYYMMDDhhmmss}.json
const buildExportFileName = (sessionId, now = new Date()) => {
  const stamp = now.toISOString().replace(/[-:]/gu, '').replace('T', '_').slice(0, 15)
  return `events_${sessionId}_${stamp}.json`
}

/**
 * 挂载事件同步条：绑定按钮点击和计数轮询。
 * 在 main.js 初始化各 section 后调用，确保按钮 DOM 已存在。
 */
export const mountEventSyncBar = () => {
  const button = document.querySelector('#event-sync-btn')
  const countSpan = document.querySelector('#event-sync-count')
  if (!button || !countSpan) return

  // 定时刷新计数显示
  const refreshCount = () => {
    const size = getQueueSize()
    countSpan.textContent = String(size)
    // 无待导出事件时禁用按钮，避免产生空文件
    button.disabled = size === 0
  }
  refreshCount()
  const timer = window.setInterval(refreshCount, COUNT_REFRESH_MS)

  // 点击导出：下载 JSON 文件，导出后自动清空队列并刷新计数
  button.addEventListener('click', () => {
    const doc = exportQueue()
    if (!doc) {
      toast('无待导出事件')
      return
    }
    try {
      const json = JSON.stringify(doc, null, 2)
      downloadText(buildExportFileName(doc.session_id), json, 'application/json;charset=utf-8')
      toast(`已导出 ${doc.events.length} 条事件，请放入 data/event-inbox/ 后运行 npm run sync:events`)
      refreshCount()
    } catch (error) {
      toast('导出失败：' + (error?.message ?? error))
      // 导出失败时不清空队列，用户可重试
    }
  })

  // 页面卸载时清理定时器，避免内存泄漏
  window.addEventListener('beforeunload', () => {
    window.clearInterval(timer)
  })
}

// 渲染按钮 HTML（供 main.js 在 nav 模板中插入）
export const renderEventSyncButton = () =>
  `<button class="nav-sync" id="event-sync-btn" type="button" aria-label="导出未同步事件" disabled>${icon('arrow', 15)}<span>导出事件</span><span class="sync-count" id="event-sync-count">0</span></button>`
