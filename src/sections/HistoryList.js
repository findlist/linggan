// 创作历史列表 section：渲染系统自动记录的生成方案历史，
// 支持展开查看核心信息、重新加载到工作台、单条删除和清空全部。
//
// 与已收藏列表（SavedList）的区别：
// - SavedList 渲染用户主动收藏的精选方案（上限 8 条）
// - HistoryList 渲染系统自动记录的全部生成方案（上限 50 条）
// - 历史卡片更紧凑，展开只显示核心创作信息（概念 + 对白），完整制作包通过重新加载查看
//
// 跨 section 调用：
//   - 重新加载通过 ctx.loadHistoryRemix(id) 调用工作台
//   - 工作台生成后通过 ctx.renderHistory() 通知本 section 刷新

import { icon } from '../ui/icons.js'
import { escapeHtml, toast } from '../ui/dom.js'
import { personalityLabels, hookCategoryLabels } from '../data/knowledge.js'
import { getHistory, removeHistory, clearHistory, getHistorySize } from '../data/history.ts'
// D2：前端事件采集，记录历史方案的展开和重新加载行为
import { track } from '../data/tracker.ts'

// 渲染历史列表 section 初始 HTML：标题 + 计数 + 清空按钮 + 列表容器
export const renderHistorySection = () => `
  <section class="history-section shell"><div><span class="kicker">GENERATION LOG</span><h2>创作历史</h2><p>系统自动记录每次生成的方案，保留最近 50 条，支持重新加载到工作台。</p></div><div class="history-toolbar"><span class="history-count" id="history-count"></span><button class="btn ghost history-clear" id="history-clear" hidden>${icon('close', 14)} 清空全部</button></div><div class="history-list" id="history-list"><p class="empty">还没有生成过方案。去跨作品混搭实验室生成第一个方案。</p></div></section>
`

// 渲染历史列表：每条历史可展开查看核心信息（概念 + 对白），支持重新加载和删除
export const renderHistory = (ctx) => {
  const list = document.querySelector('#history-list')
  const countEl = document.querySelector('#history-count')
  const clearBtn = document.querySelector('#history-clear')
  if (!list) return

  const history = getHistory()
  const size = history.length

  // 更新计数和清空按钮显示
  if (countEl) countEl.textContent = `${size} / 50 条`
  if (clearBtn) clearBtn.hidden = size === 0

  if (size === 0) {
    list.innerHTML = '<p class="empty">还没有生成过方案。去跨作品混搭实验室生成第一个方案。</p>'
    return
  }

  list.innerHTML = history
    .map((item) => {
      const meta = `生成于 ${new Date(item.createdAt).toLocaleString('zh-CN')}`
      return `<article class="history-card">
      <header class="history-head" role="button" tabindex="0" aria-expanded="false" data-id="${escapeHtml(item.id)}">
        <span class="history-icon">${icon('history', 16)}</span>
        <div class="history-title"><b>${escapeHtml(item.title)}</b><p>${escapeHtml(item.hook)}</p><small>${meta} · ${item.plan.duration}s · ${hookCategoryLabels[item.plan.hookCategory]}钩子 · ${personalityLabels[item.plan.personalityA]} × ${personalityLabels[item.plan.personalityB]}</small></div>
        <span class="history-toggle">${icon('arrow', 14)}</span>
      </header>
      <div class="history-body" hidden>
        <div class="history-concept"><span>创意概念</span><p>${escapeHtml(item.plan.concept)}</p></div>
        <div class="history-dialogues"><div><span>A · 原创改写</span><p>${escapeHtml(item.plan.dialogueA)}</p></div><div><span>B · 原创改写</span><p>${escapeHtml(item.plan.dialogueB)}</p></div></div>
        <div class="history-actions">
          <button class="btn ghost history-reload" data-id="${escapeHtml(item.id)}">${icon('play', 14)} 重新加载到工作台</button>
          <button class="btn ghost history-remove" data-id="${escapeHtml(item.id)}" aria-label="删除该历史">${icon('close', 14)} 删除</button>
        </div>
      </div>
    </article>`
    })
    .join('')

  // 展开 / 折叠：点击头部或 Enter / Space 切换
  list.querySelectorAll('.history-head').forEach((head) => {
    const toggle = () => {
      const body = head.nextElementSibling
      const expanded = head.getAttribute('aria-expanded') === 'true'
      head.setAttribute('aria-expanded', String(!expanded))
      if (body) body.hidden = expanded
      // D2 埋点：展开历史视为对方案的回顾兴趣
      if (!expanded) {
        track('idea_opened', { ideaId: head.dataset.id, payload: { source: 'history_list_expand' } })
      }
    }
    head.addEventListener('click', toggle)
    head.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        toggle()
      }
    })
  })

  // 重新加载到工作台
  list.querySelectorAll('.history-reload').forEach((btn) =>
    btn.addEventListener('click', (event) => {
      event.stopPropagation()
      track('idea_opened', { ideaId: btn.dataset.id, payload: { source: 'history_list_reload' } })
      ctx.loadHistoryRemix(btn.dataset.id)
    }),
  )

  // 单条删除
  list.querySelectorAll('.history-remove').forEach((btn) =>
    btn.addEventListener('click', (event) => {
      event.stopPropagation()
      removeHistory(btn.dataset.id)
      renderHistory(ctx)
      toast('已删除该历史记录')
    }),
  )

  // 清空全部
  if (clearBtn) {
    clearBtn.onclick = () => {
      if (getHistorySize() === 0) return
      clearHistory()
      renderHistory(ctx)
      toast('已清空全部历史记录')
    }
  }
}

// 挂载历史列表 section：初始渲染
export const mountHistoryList = (ctx) => {
  renderHistory(ctx)
  return { renderHistory: () => renderHistory(ctx) }
}
