// 已收藏列表 section：渲染收藏卡片，支持展开查看完整方案、
// 重新加载到工作台、单条导出 Markdown / JSON 和删除。
// 旧格式收藏（仅保存 id / title / hook）做降级显示，仅保留删除。
// 跨 section 调用：删除 / 导出后通过 ctx.refreshLibrary 通知素材库无需刷新，
//   重新加载和单条导出通过 ctx.loadSavedRemix / buildRemixFileName / buildRemixMarkdown 调用工作台 / 导出器

import { icon } from '../ui/icons.js'
import { escapeHtml, downloadText, toast } from '../ui/dom.js'
import { personalityLabels, hookCategoryLabels } from '../data/knowledge.js'
import { getState, setSaved } from '../data/store.js'
import { buildRemixFileName, buildRemixJson, buildRemixMarkdown } from '../generation/exporters.ts'

// 渲染收藏列表 section 初始 HTML：标题 + 列表容器，默认显示空状态文案
export const renderSavedSection = () => `
  <section class="saved-section shell"><div><span class="kicker">YOUR WORKSPACE</span><h2>已收藏的混搭</h2></div><div class="saved-list" id="saved-list"><p class="empty">还没有收藏方案。先生成一次意外碰撞。</p></div></section>
`

// 渲染收藏列表：每条收藏可展开查看完整方案；旧收藏无 plan 字段时降级显示，仅保留删除
export const renderSaved = (ctx) => {
  const list = document.querySelector('#saved-list')
  if (!list) return
  const { saved } = getState()
  if (!saved.length) {
    list.innerHTML = '<p class="empty">还没有收藏方案。先生成一次意外碰撞。</p>'
    return
  }
  list.innerHTML = saved
    .map((item) => {
      const hasPlan = !!item.plan
      const meta = item.savedAt ? `收藏于 ${new Date(item.savedAt).toLocaleString('zh-CN')}` : '旧格式收藏'
      const body = hasPlan
        ? `<div class="saved-body" hidden>
          <div class="saved-meta"><span>${icon('shield', 13)} ${item.plan.duration}s · ${hookCategoryLabels[item.plan.hookCategory]}钩子</span><span>${personalityLabels[item.plan.personalityA]} × ${personalityLabels[item.plan.personalityB]}</span></div>
          <div class="saved-dialogues"><div><span>A · 原创改写</span><p>${escapeHtml(item.plan.dialogueA)}</p></div><div><span>B · 原创改写</span><p>${escapeHtml(item.plan.dialogueB)}</p></div></div>
          <details><summary>分镜（${item.plan.storyboard.length} 镜头）</summary><ol class="saved-shots">${item.plan.storyboard.map((shot) => `<li><b>${shot.duration}s</b> ${escapeHtml(shot.visual)} <small>动作：${escapeHtml(shot.action)} · 情绪：${escapeHtml(shot.emotion)}</small></li>`).join('')}</ol></details>
          <div class="saved-actions">
            <button class="btn ghost saved-reload" data-id="${escapeHtml(item.id)}">${icon('play', 14)} 重新加载</button>
            <button class="btn ghost saved-md" data-id="${escapeHtml(item.id)}">${icon('arrow', 14)} 导出 MD</button>
            <button class="btn ghost saved-json" data-id="${escapeHtml(item.id)}">${icon('database', 14)} 导出 JSON</button>
            <button class="btn ghost saved-remove" data-id="${escapeHtml(item.id)}" aria-label="删除收藏">${icon('close', 14)} 删除</button>
          </div>
        </div>`
        : `<div class="saved-body saved-old" hidden><p>该收藏为旧格式，仅保存了标题和钩子，无法展开或重新加载。请重新生成并收藏以使用完整功能。</p><div class="saved-actions"><button class="btn ghost saved-remove" data-id="${escapeHtml(item.id)}" aria-label="删除收藏">${icon('close', 14)} 删除</button></div></div>`
      return `<article class="saved-card">
      <header class="saved-head" role="button" tabindex="0" aria-expanded="false">
        <span class="saved-icon">${icon('bookmark', 16)}</span>
        <div class="saved-title"><b>${escapeHtml(item.title)}</b><p>${escapeHtml(item.hook)}</p><small>${meta}</small></div>
        <span class="saved-toggle">${icon('arrow', 14)}</span>
      </header>
      ${body}
    </article>`
    })
    .join('')
  // 展开 / 折叠：点击头部或 Enter / Space 切换
  list.querySelectorAll('.saved-head').forEach((head) => {
    const toggle = () => {
      const body = head.nextElementSibling
      const expanded = head.getAttribute('aria-expanded') === 'true'
      head.setAttribute('aria-expanded', String(!expanded))
      if (body) body.hidden = expanded
    }
    head.addEventListener('click', toggle)
    head.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        toggle()
      }
    })
  })
  // 操作按钮：stopPropagation 避免触发头部 toggle
  list.querySelectorAll('.saved-reload').forEach((btn) =>
    btn.addEventListener('click', (event) => {
      event.stopPropagation()
      ctx.loadSavedRemix(btn.dataset.id)
    }),
  )
  list.querySelectorAll('.saved-md').forEach((btn) =>
    btn.addEventListener('click', (event) => {
      event.stopPropagation()
      const item = getState().saved.find((s) => s.id === btn.dataset.id)
      if (!item?.plan) {
        toast('该收藏无法导出')
        return
      }
      try {
        downloadText(
          `${buildRemixFileName(item.plan)}.md`,
          buildRemixMarkdown(item.plan),
          'text/markdown;charset=utf-8',
        )
        toast('Markdown 已导出')
      } catch (error) {
        toast('导出失败：' + (error?.message ?? error))
      }
    }),
  )
  list.querySelectorAll('.saved-json').forEach((btn) =>
    btn.addEventListener('click', (event) => {
      event.stopPropagation()
      const item = getState().saved.find((s) => s.id === btn.dataset.id)
      if (!item?.plan) {
        toast('该收藏无法导出')
        return
      }
      try {
        downloadText(
          `${buildRemixFileName(item.plan)}.json`,
          buildRemixJson(item.plan),
          'application/json;charset=utf-8',
        )
        toast('JSON 已导出')
      } catch (error) {
        toast('导出失败：' + (error?.message ?? error))
      }
    }),
  )
  list.querySelectorAll('.saved-remove').forEach((btn) =>
    btn.addEventListener('click', (event) => {
      event.stopPropagation()
      const { saved } = getState()
      const next = saved.filter((s) => s.id !== btn.dataset.id)
      setSaved(next)
      renderSaved(ctx)
      toast('已删除收藏')
    }),
  )
}

// 挂载收藏列表 section：初始渲染
export const mountSavedList = (ctx) => {
  renderSaved(ctx)
  return { renderSaved: () => renderSaved(ctx) }
}
