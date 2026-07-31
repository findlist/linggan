// 素材库 section：渲染角色 / 名场面 / 作品三个 tab 的卡片列表，
// 集成 C5 多维度组合筛选（同维度 OR、跨维度 AND、文本搜索与筛选 AND），
// 卡片点击打开详情视图，并提供 applyToRemix 入口供 DetailView 调用。

import { icon } from '../ui/icons.js'
import { escapeHtml } from '../ui/dom.js'
import { filterLibraryItems, collectFilterOptions } from '../library/filter.ts'
import { knowledge, workById, mediaNames, rightsLabels } from '../data/knowledge.js'
import { getState, setActiveTab, resetLibraryFilters } from '../data/store.js'

// 把知识库实体映射为可被 filterLibraryItems 消费的 FilterableItem + UI 字段
const libraryItems = (tab) => {
  if (tab === 'characters')
    return knowledge.known_characters.map((character) => {
      const work = workById.get(character.work_id)
      return {
        id: character.id,
        title: character.name,
        meta: `${work.title} · ${character.roles.join(' / ')}`,
        tags: character.character_types,
        body: `${character.traits.join('、')}。台词风格：${character.dialogue_style.join('；')}`,
        badge: '角色参考',
        // C5：筛选维度——角色类型 / 所属作品 / 版权状态，供 filterLibraryItems 使用
        fields: {
          type: character.character_types,
          work: [work.title],
          rights: [character.rights_status],
        },
        searchableText: [
          character.name,
          ...character.aliases,
          work.title,
          ...character.roles,
          ...character.character_types,
          ...character.traits,
          ...character.dialogue_style,
        ]
          .join(' ')
          .toLowerCase(),
      }
    })
  if (tab === 'moments')
    return knowledge.iconic_moments.map((moment) => {
      const work = workById.get(moment.work_id)
      return {
        id: moment.id,
        title: moment.name,
        meta: `${work.title} · ${moment.conflict_type}`,
        tags: moment.emotional_arc,
        body: moment.abstraction,
        badge: '结构参考',
        // C5：筛选维度——冲突类型 / 情绪弧 / 所属作品
        fields: {
          conflict: [moment.conflict_type],
          emotion: moment.emotional_arc,
          work: [work.title],
        },
        searchableText: [
          moment.name,
          work.title,
          moment.conflict_type,
          moment.setting,
          ...moment.emotional_arc,
          ...moment.visual_actions,
          ...moment.dialogue_patterns,
          moment.abstraction,
        ]
          .join(' ')
          .toLowerCase(),
      }
    })
  return knowledge.works.map((work) => ({
    id: work.id,
    title: work.title,
    meta: `${mediaNames[work.media_type]} · ${work.release_year ?? '年份未知'} · ${work.regions.join(' / ')}`,
    tags: work.genres,
    body: `别名：${work.aliases.join('、') || '无'}。已记录 ${work.sources.length} 条公开来源证据。`,
    badge: '作品索引',
    // C5：筛选维度——媒介类型 / 类型 / 版权状态
    fields: {
      media: [work.media_type],
      genre: work.genres,
      rights: [work.rights_status],
    },
    searchableText: [
      work.title,
      work.original_title,
      ...work.aliases,
      mediaNames[work.media_type] ?? work.media_type,
      ...work.genres,
      ...work.regions,
      String(work.release_year ?? ''),
    ]
      .join(' ')
      .toLowerCase(),
  }))
}

// C5：每个 tab 的筛选维度配置，key 对应 fields 的键，label 为中文维度名
const filterDimensions = {
  characters: [
    { key: 'type', label: '角色类型' },
    { key: 'work', label: '所属作品' },
    { key: 'rights', label: '版权状态' },
  ],
  moments: [
    { key: 'conflict', label: '冲突类型' },
    { key: 'emotion', label: '情绪弧' },
    { key: 'work', label: '所属作品' },
  ],
  works: [
    { key: 'media', label: '媒介类型' },
    { key: 'genre', label: '类型' },
    { key: 'rights', label: '版权状态' },
  ],
}

// C5：把维度值映射为中文显示标签；rights 用现有 rightsLabels，media 用 mediaNames，其余原样
const filterValueLabel = (dimension, value) => {
  if (dimension === 'rights') return rightsLabels[value] ?? value
  if (dimension === 'media') return mediaNames[value] ?? value
  return value
}

// 渲染素材库 section 初始 HTML：tabs、搜索框、筛选器容器、计数区、卡片网格容器
export const renderLibrarySection = () => `
  <section class="library-section" id="library">
    <div class="shell">
      <div class="section-title"><div><span class="kicker">KNOWLEDGE BASE</span><h2>可组合的内容基因库</h2><p>不是素材下载站，而是可追溯的角色类型、关系张力、台词风格和叙事结构索引。</p></div></div>
      <div class="library-toolbar"><div class="tabs" role="tablist"><button class="active" data-tab="characters">主要角色</button><button data-tab="moments">名场面</button><button data-tab="works">作品</button></div><label class="library-search">${icon('search', 17)}<input id="library-search" placeholder="搜索角色、类型、作品或场面" /></label></div>
      <div class="library-filters" id="library-filters" aria-label="素材筛选"></div>
      <div class="library-meta" id="library-meta"></div>
      <div class="library-grid" id="library-grid"></div>
    </div>
  </section>
`

// C5：渲染筛选器 chips，每个维度一行，支持多选（同维度 OR），跨维度 AND；有选中时显示清空按钮
const renderLibraryFilters = () => {
  const container = document.querySelector('#library-filters')
  if (!container) return
  const { activeTab, libraryFilters } = getState()
  const dimensions = filterDimensions[activeTab] ?? []
  const allItems = libraryItems(activeTab)
  container.innerHTML = dimensions
    .map((dim) => {
      // 动态收集该维度所有可选值，避免出现"选了却无结果"的死选项
      const options = collectFilterOptions(allItems, dim.key)
      const selected = libraryFilters[dim.key] ?? []
      const chips = options
        .map((value) => {
          const isActive = selected.includes(value)
          return `<button class="filter-chip ${isActive ? 'active' : ''}" type="button" data-dim="${dim.key}" data-value="${escapeHtml(value)}" aria-pressed="${isActive}">${escapeHtml(filterValueLabel(dim.key, value))}</button>`
        })
        .join('')
      return `<div class="filter-row"><span class="filter-label">${dim.label}</span><div class="filter-chips">${chips}</div></div>`
    })
    .join('')
  // 任意维度有选中值时显示清空按钮
  const hasSelection = Object.values(libraryFilters).some((arr) => Array.isArray(arr) && arr.length > 0)
  if (hasSelection) {
    container.innerHTML += `<button class="filter-clear" type="button" id="filter-clear">${icon('close', 14)} 清空筛选</button>`
  }
  // chip 点击：切换选中态后重渲染筛选器和列表
  container.querySelectorAll('.filter-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const { libraryFilters: current } = getState()
      const { dim, value } = chip.dataset
      const selected = current[dim] ?? []
      const next = selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]
      // 通过 patch 直接更新 libraryFilters，避免引用比较失效
      current[dim] = next
      renderLibraryFilters()
      renderLibrary()
    })
  })
  const clearBtn = container.querySelector('#filter-clear')
  if (clearBtn)
    clearBtn.addEventListener('click', () => {
      resetLibraryFilters()
      renderLibraryFilters()
      renderLibrary()
    })
}

// 渲染素材库卡片列表：应用筛选 + 计数 + 卡片点击打开详情
const renderLibrary = (ctx) => {
  const { activeTab, libraryFilters } = getState()
  const query = document.querySelector('#library-search').value
  const allItems = libraryItems(activeTab)
  // C5：文本搜索 + 多维度组合筛选，业务规则集中在 filterLibraryItems 纯函数
  const items = filterLibraryItems(allItems, libraryFilters, query)
  const grid = document.querySelector('#library-grid')
  // 结果计数：有筛选或搜索时显示"显示 N / 共 M 项"，否则留空避免噪音
  const meta = document.querySelector('#library-meta')
  const hasFilter = Object.values(libraryFilters).some((arr) => Array.isArray(arr) && arr.length > 0)
  if (meta) {
    meta.textContent =
      (hasFilter || query.trim()) && allItems.length ? `显示 ${items.length} / 共 ${allItems.length} 项` : ''
  }
  grid.innerHTML = items.length
    ? items
        .map(
          (item, index) =>
            `<article class="library-card" role="button" tabindex="0" data-detail-link="${activeTab}" data-detail-id="${item.id}" aria-label="查看 ${escapeHtml(item.title)} 详情"><div class="library-index">${String(index + 1).padStart(2, '0')}</div><span class="library-badge">${item.badge}</span><h3>${escapeHtml(item.title)}</h3><p class="library-meta">${escapeHtml(item.meta)}</p><p>${escapeHtml(item.body)}</p><div class="mini-tags">${item.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}</div><small>${icon('shield', 13)} reference_only</small><span class="library-cta">${icon('arrow', 14)} 查看详情</span></article>`,
        )
        .join('')
    : '<p class="empty">没有匹配的素材。试着减少筛选条件或清空搜索关键词。</p>'
  // 卡片支持点击与键盘（Enter / Space）打开详情视图
  grid.querySelectorAll('.library-card').forEach((card) => {
    const open = () => ctx.detailView.open(card.dataset.detailLink, card.dataset.detailId)
    card.addEventListener('click', open)
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        open()
      }
    })
  })
}

/**
 * 挂载素材库 section：绑定 tab 切换和搜索框输入事件，并触发首次渲染。
 * ctx 提供：detailView（详情视图实例）、refreshLibrary（重新渲染筛选 + 列表，供外部调用）
 */
export const mountLibrarySection = (ctx) => {
  // tab 切换：切换激活态、更新 activeTab、重置筛选状态后重渲染
  document.querySelectorAll('[data-tab]').forEach((button) =>
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-tab]').forEach((item) => item.classList.remove('active'))
      button.classList.add('active')
      setActiveTab(button.dataset.tab)
      // C5：切换 tab 时重置筛选状态，避免上一个 tab 的选中值对新 tab 产生无意义筛选
      resetLibraryFilters()
      renderLibraryFilters()
      renderLibrary(ctx)
    }),
  )

  document.querySelector('#library-search').addEventListener('input', () => renderLibrary(ctx))

  // 初始渲染筛选器和列表
  renderLibraryFilters()
  renderLibrary(ctx)

  return {
    refreshLibrary: () => {
      renderLibraryFilters()
      renderLibrary(ctx)
    },
  }
}
