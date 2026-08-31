// 已收藏列表 section：渲染收藏卡片，支持展开查看完整方案、
// 重新加载到工作台、单条导出 Markdown / JSON 和删除；
// 顶部分组条支持新建 / 重命名 / 删除自定义分组，收藏可移入分组并按分组筛选（saved-groups.ts 持久化）。
// 旧格式收藏（仅保存 id / title / hook）做降级显示，仅保留删除。
// 跨 section 调用：重新加载和单条导出通过 ctx.loadSavedRemix / buildRemixFileName / buildRemixMarkdown 调用工作台 / 导出器

import { icon } from '../ui/icons.js'
import { escapeHtml, downloadText, toast } from '../ui/dom.js'
import { personalityLabels, hookCategoryLabels } from '../data/knowledge.js'
import { getState, setSaved } from '../data/store.js'
import { buildRemixFileName, buildRemixJson, buildRemixMarkdown } from '../generation/exporters.ts'
// D2：前端事件采集，记录收藏方案的展开、重新加载、导出和删除行为
import { track } from '../data/tracker.ts'
import {
  getSavedGroupsPrefs,
  patchSavedGroupsPrefs,
  withNewGroup,
  withRenamedGroup,
  withoutGroup,
  withAssignment,
  withoutStaleAssignments,
  filterSavedByGroup,
  countSavedByGroup,
  UNGROUPED_ID,
  MAX_GROUPS,
  MAX_GROUP_NAME_LENGTH,
} from '../data/saved-groups.ts'

// 分组条 UI 临时状态（不持久化）：是否正在新建、正在重命名的分组 id
let creatingGroup = false
let editingGroupId = null

// 分组操作失败原因 → 用户可读文案（与 saved-groups.ts 的 GroupOpError 一一对应）
const GROUP_OP_ERRORS = {
  invalid_name: '分组名不能为空',
  duplicate_name: '已存在同名分组',
  too_many_groups: `最多创建 ${MAX_GROUPS} 个分组`,
  group_not_found: '分组不存在',
}

// 渲染收藏列表 section 初始 HTML：标题 + 分组条 + 列表容器，默认显示空状态文案
export const renderSavedSection = () => `
  <section class="saved-section shell"><div><span class="kicker">YOUR WORKSPACE</span><h2>已收藏的混搭</h2></div><div class="saved-groups" id="saved-groups" hidden></div><div class="saved-list" id="saved-list"><p class="empty">还没有收藏方案。先生成一次意外碰撞。</p></div></section>
`

// ----------------------- 分组条渲染 -----------------------

// 单个筛选 chip：groupId 为 null（全部）/ UNGROUPED_ID / 分组 id，count 展示该筛选下的收藏数
const groupChip = (groupId, label, count, active) =>
  `<button class="filter-chip saved-chip${active ? ' active' : ''}" data-group="${escapeHtml(groupId ?? '')}">${escapeHtml(label)} <b>${count}</b></button>`

// 自定义分组项：chip + 重命名 / 删除小按钮；editingGroupId 命中时整体替换为行内重命名输入
const groupItem = (group, count, prefs) => {
  if (editingGroupId === group.id) {
    return `<span class="group-inline" data-rename="${escapeHtml(group.id)}">
      <input class="group-input" value="${escapeHtml(group.name)}" maxlength="${MAX_GROUP_NAME_LENGTH}" aria-label="重命名分组">
      <button class="chip-mini rename-ok" aria-label="确认重命名">${icon('check', 12)}</button>
      <button class="chip-mini rename-cancel" aria-label="取消重命名">${icon('close', 12)}</button>
    </span>`
  }
  return `<span class="saved-group-item">
    ${groupChip(group.id, group.name, count, prefs.activeGroupId === group.id)}
    <button class="chip-mini group-edit" data-id="${escapeHtml(group.id)}" aria-label="重命名分组 ${escapeHtml(group.name)}">${icon('edit', 11)}</button>
    <button class="chip-mini chip-danger group-del" data-id="${escapeHtml(group.id)}" aria-label="删除分组 ${escapeHtml(group.name)}">${icon('close', 11)}</button>
  </span>`
}

// 渲染分组条：全部 / 未分组（有分组时才展示）/ 各自定义分组 + 新建入口（或行内创建输入）
const renderGroupBar = (bar, saved, prefs) => {
  if (!saved.length) {
    // 无收藏时分组无意义：隐藏分组条并复位编辑状态，保持原有空态
    creatingGroup = false
    editingGroupId = null
    bar.hidden = true
    bar.innerHTML = ''
    return
  }
  const counts = countSavedByGroup(saved, prefs)
  const ungroupedChip = prefs.groups.length
    ? groupChip(UNGROUPED_ID, '未分组', counts.ungrouped, prefs.activeGroupId === UNGROUPED_ID)
    : ''
  const items = prefs.groups.map((group) => groupItem(group, counts.byGroup[group.id], prefs)).join('')
  const createRow = creatingGroup
    ? `<span class="group-inline" id="group-create-row">
        <input class="group-input" id="group-create-input" placeholder="分组名称" maxlength="${MAX_GROUP_NAME_LENGTH}" aria-label="新分组名称">
        <button class="chip-mini" id="group-create-ok" aria-label="确认创建分组">${icon('check', 12)}</button>
        <button class="chip-mini" id="group-create-cancel" aria-label="取消创建分组">${icon('close', 12)}</button>
      </span>`
    : `<button class="filter-chip saved-chip group-add" id="group-add-btn">${icon('plus', 11)} 新建分组</button>`
  bar.hidden = false
  bar.innerHTML = `${groupChip(null, '全部', counts.all, prefs.activeGroupId === null)}${ungroupedChip}${items}${createRow}`
}

// ----------------------- 分组条交互 -----------------------

// 切换筛选分组：'' → 全部（null）；UNGROUPED_ID → 未分组；其余 → 分组 id
const setActiveGroup = (ctx, groupId) => {
  patchSavedGroupsPrefs({ activeGroupId: groupId })
  renderSaved(ctx)
}

// 统一的创建 / 重命名提交：失败仅 toast 并聚焦输入（不重渲染，保留用户输入），成功才刷新分组条
const submitGroupOp = (ctx, input, submit, successMessage) => {
  const result = submit(getSavedGroupsPrefs())
  if (!result.ok) {
    toast(GROUP_OP_ERRORS[result.error])
    input.focus()
    return
  }
  creatingGroup = false
  editingGroupId = null
  patchSavedGroupsPrefs(result.prefs)
  renderSaved(ctx)
  toast(successMessage)
}

// 进入行内重命名模式后聚焦并全选输入框，方便直接覆盖输入
const focusRenameInput = () => {
  const input = document.querySelector('.group-inline[data-rename] .group-input')
  if (input) {
    input.focus()
    input.select()
  }
}

// 绑定新建分组流程：入口按钮 + 行内输入的确认 / 取消 / Enter / Esc
const bindCreateGroup = (bar, ctx) => {
  bar.querySelector('#group-add-btn')?.addEventListener('click', () => {
    creatingGroup = true
    renderSaved(ctx)
    document.querySelector('#group-create-input')?.focus()
  })
  const input = bar.querySelector('#group-create-input')
  if (!input) return
  const submit = () => submitGroupOp(ctx, input, (prefs) => withNewGroup(prefs, input.value), '分组已创建')
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') submit()
    if (event.key === 'Escape') {
      creatingGroup = false
      renderSaved(ctx)
    }
  })
  bar.querySelector('#group-create-ok')?.addEventListener('click', submit)
  bar.querySelector('#group-create-cancel')?.addEventListener('click', () => {
    creatingGroup = false
    renderSaved(ctx)
  })
}

// 绑定重命名 / 删除分组：小按钮 stopPropagation 避免触发 chip 筛选切换
const bindGroupEdit = (bar, ctx) => {
  bar.querySelectorAll('.group-edit').forEach((btn) =>
    btn.addEventListener('click', (event) => {
      event.stopPropagation()
      editingGroupId = btn.dataset.id
      renderSaved(ctx)
      focusRenameInput()
    }),
  )
  bar.querySelectorAll('.group-del').forEach((btn) =>
    btn.addEventListener('click', (event) => {
      event.stopPropagation()
      patchSavedGroupsPrefs(withoutGroup(getSavedGroupsPrefs(), btn.dataset.id))
      renderSaved(ctx)
      toast('分组已删除，成员退回未分组')
    }),
  )
  const renameRow = bar.querySelector('.group-inline[data-rename]')
  if (!renameRow) return
  const input = renameRow.querySelector('.group-input')
  const groupId = renameRow.dataset.rename
  const submit = () =>
    submitGroupOp(ctx, input, (prefs) => withRenamedGroup(prefs, groupId, input.value), '分组已重命名')
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') submit()
    if (event.key === 'Escape') {
      editingGroupId = null
      renderSaved(ctx)
    }
  })
  renameRow.querySelector('.rename-ok')?.addEventListener('click', submit)
  renameRow.querySelector('.rename-cancel')?.addEventListener('click', () => {
    editingGroupId = null
    renderSaved(ctx)
  })
}

// 绑定分组条全部交互（每次重渲染后调用，元素均为新建）
const bindGroupBar = (bar, ctx) => {
  // 筛选 chip：新建入口按钮无 data-group 属性，天然不匹配该选择器
  bar
    .querySelectorAll('.saved-chip[data-group]')
    .forEach((chip) => chip.addEventListener('click', () => setActiveGroup(ctx, chip.dataset.group || null)))
  bindCreateGroup(bar, ctx)
  bindGroupEdit(bar, ctx)
}

// ----------------------- 收藏卡片渲染 -----------------------

// 卡片归属分组下拉：未分组 + 各自定义分组；无任何分组时不渲染（只有"未分组"一个选项无意义）
const groupSelect = (item, prefs) => {
  if (!prefs.groups.length) return ''
  const assigned = prefs.assignments[item.id] ?? ''
  const options = [
    '<option value="">未分组</option>',
    ...prefs.groups.map(
      (group) =>
        `<option value="${escapeHtml(group.id)}"${assigned === group.id ? ' selected' : ''}>${escapeHtml(group.name)}</option>`,
    ),
  ].join('')
  return `<select class="saved-group-select" data-id="${escapeHtml(item.id)}" aria-label="移入分组">${options}</select>`
}

// 渲染单条收藏卡片：meta 行追加所属分组名，操作区前置"移入分组"下拉
const renderSavedCard = (item, prefs) => {
  const hasPlan = !!item.plan
  const assignedGroup = prefs.groups.find((group) => group.id === prefs.assignments[item.id])
  const meta = [
    item.savedAt ? `收藏于 ${new Date(item.savedAt).toLocaleString('zh-CN')}` : '旧格式收藏',
    assignedGroup ? `分组：${assignedGroup.name}` : '',
  ]
    .filter(Boolean)
    .join(' · ')
  const body = hasPlan
    ? `<div class="saved-body" hidden>
          <div class="saved-meta"><span>${icon('shield', 13)} ${item.plan.duration}s · ${hookCategoryLabels[item.plan.hookCategory]}钩子</span><span>${personalityLabels[item.plan.personalityA]} × ${personalityLabels[item.plan.personalityB]}</span></div>
          <div class="saved-dialogues"><div><span>A · 原创改写</span><p>${escapeHtml(item.plan.dialogueA)}</p></div><div><span>B · 原创改写</span><p>${escapeHtml(item.plan.dialogueB)}</p></div></div>
          <details><summary>分镜（${item.plan.storyboard.length} 镜头）</summary><ol class="saved-shots">${item.plan.storyboard.map((shot) => `<li><b>${shot.duration}s</b> ${escapeHtml(shot.visual)} <small>动作：${escapeHtml(shot.action)} · 情绪：${escapeHtml(shot.emotion)}</small></li>`).join('')}</ol></details>
          <div class="saved-actions">
            ${groupSelect(item, prefs)}
            <button class="btn ghost saved-reload" data-id="${escapeHtml(item.id)}">${icon('play', 14)} 重新加载</button>
            <button class="btn ghost saved-md" data-id="${escapeHtml(item.id)}">${icon('arrow', 14)} 导出 MD</button>
            <button class="btn ghost saved-json" data-id="${escapeHtml(item.id)}">${icon('database', 14)} 导出 JSON</button>
            <button class="btn ghost saved-remove" data-id="${escapeHtml(item.id)}" aria-label="删除收藏">${icon('close', 14)} 删除</button>
          </div>
        </div>`
    : `<div class="saved-body saved-old" hidden><p>该收藏为旧格式，仅保存了标题和钩子，无法展开或重新加载。请重新生成并收藏以使用完整功能。</p><div class="saved-actions">${groupSelect(item, prefs)}<button class="btn ghost saved-remove" data-id="${escapeHtml(item.id)}" aria-label="删除收藏">${icon('close', 14)} 删除</button></div></div>`
  return `<article class="saved-card">
      <header class="saved-head" role="button" tabindex="0" aria-expanded="false" data-id="${escapeHtml(item.id)}">
        <span class="saved-icon">${icon('bookmark', 16)}</span>
        <div class="saved-title"><b>${escapeHtml(item.title)}</b><p>${escapeHtml(item.hook)}</p><small>${escapeHtml(meta)}</small></div>
        <span class="saved-toggle">${icon('arrow', 14)}</span>
      </header>
      ${body}
    </article>`
}

// ----------------------- 收藏卡片交互 -----------------------

// 展开 / 折叠卡片：点击头部或 Enter / Space 切换
const bindSavedHeads = (list) => {
  list.querySelectorAll('.saved-head').forEach((head) => {
    const toggle = () => {
      const body = head.nextElementSibling
      const expanded = head.getAttribute('aria-expanded') === 'true'
      head.setAttribute('aria-expanded', String(!expanded))
      if (body) body.hidden = expanded
      // D2 埋点：展开收藏视为对方案的深度兴趣，记录 opened；折叠不记录
      if (!expanded) {
        track('idea_opened', { ideaId: head.dataset.id, payload: { source: 'saved_list_expand' } })
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
}

// 导出单条收藏：format 决定 Markdown / JSON，成功与失败均有 toast 反馈
const exportSavedItem = (item, format) => {
  if (!item?.plan) {
    toast('该收藏无法导出')
    return
  }
  try {
    const isMarkdown = format === 'markdown'
    downloadText(
      `${buildRemixFileName(item.plan)}.${isMarkdown ? 'md' : 'json'}`,
      isMarkdown ? buildRemixMarkdown(item.plan) : buildRemixJson(item.plan),
      isMarkdown ? 'text/markdown;charset=utf-8' : 'application/json;charset=utf-8',
    )
    // D2 埋点：从收藏列表导出视为专业使用意图
    track('idea_exported', {
      ideaId: item.id,
      payload: { format, source: 'saved_list', duration: item.plan.duration },
    })
    toast(isMarkdown ? 'Markdown 已导出' : 'JSON 已导出')
  } catch (error) {
    toast('导出失败：' + (error?.message ?? error))
  }
}

// 绑定卡片操作按钮（stopPropagation 避免触发头部 toggle）
const bindSavedActions = (list, ctx) => {
  list.querySelectorAll('.saved-reload').forEach((btn) =>
    btn.addEventListener('click', (event) => {
      event.stopPropagation()
      // D2 埋点：重新加载到工作台视为再次打开方案
      track('idea_opened', { ideaId: btn.dataset.id, payload: { source: 'saved_list_reload' } })
      ctx.loadSavedRemix(btn.dataset.id)
    }),
  )
  list.querySelectorAll('.saved-md').forEach((btn) =>
    btn.addEventListener('click', (event) => {
      event.stopPropagation()
      const item = getState().saved.find((s) => s.id === btn.dataset.id)
      exportSavedItem(item, 'markdown')
    }),
  )
  list.querySelectorAll('.saved-json').forEach((btn) =>
    btn.addEventListener('click', (event) => {
      event.stopPropagation()
      const item = getState().saved.find((s) => s.id === btn.dataset.id)
      exportSavedItem(item, 'json')
    }),
  )
  list.querySelectorAll('.saved-remove').forEach((btn) =>
    btn.addEventListener('click', (event) => {
      event.stopPropagation()
      const { saved } = getState()
      setSaved(saved.filter((s) => s.id !== btn.dataset.id))
      // D2 埋点：删除收藏视为反感或重复信号，记录 hidden 供偏好画像降低同类权重
      track('idea_hidden', { ideaId: btn.dataset.id, payload: { source: 'saved_list_remove' } })
      renderSaved(ctx)
      toast('已删除收藏')
    }),
  )
  // 移入分组：空值 = 未分组；选择后立即持久化并刷新（若当前筛选不包含该收藏属正常过滤语义）
  list.querySelectorAll('.saved-group-select').forEach((select) =>
    select.addEventListener('change', (event) => {
      event.stopPropagation()
      const next = withAssignment(getSavedGroupsPrefs(), select.dataset.id, select.value || null)
      patchSavedGroupsPrefs(next)
      renderSaved(ctx)
      toast('已更新分组')
    }),
  )
}

// ----------------------- 主渲染 -----------------------

// 渲染收藏列表：先清理悬空归属并渲染分组条，再按当前筛选分组输出卡片
export const renderSaved = (ctx) => {
  const list = document.querySelector('#saved-list')
  const bar = document.querySelector('#saved-groups')
  if (!list) return
  const { saved } = getState()
  // 渲染前清理悬空归属：收藏上限淘汰旧方案后其归属失去意义（与素材库 pruneStaleFilters 同思路）
  const rawPrefs = getSavedGroupsPrefs()
  const prefs = withoutStaleAssignments(
    rawPrefs,
    saved.map((item) => item.id),
  )
  if (prefs !== rawPrefs) patchSavedGroupsPrefs(prefs)
  if (bar) {
    renderGroupBar(bar, saved, prefs)
    bindGroupBar(bar, ctx)
  }
  if (!saved.length) {
    list.innerHTML = '<p class="empty">还没有收藏方案。先生成一次意外碰撞。</p>'
    return
  }
  const visible = filterSavedByGroup(saved, prefs, prefs.activeGroupId)
  if (!visible.length) {
    const groupName = prefs.groups.find((group) => group.id === prefs.activeGroupId)?.name
    list.innerHTML = `<p class="empty">${groupName ? `分组「${escapeHtml(groupName)}」还没有收藏。` : '该筛选下还没有收藏。'}可切回"全部"，展开方案后用"移入分组"归类。</p>`
    return
  }
  list.innerHTML = visible.map((item) => renderSavedCard(item, prefs)).join('')
  bindSavedHeads(list)
  bindSavedActions(list, ctx)
}

// 挂载收藏列表 section：初始渲染
export const mountSavedList = (ctx) => {
  renderSaved(ctx)
  return { renderSaved: () => renderSaved(ctx) }
}
