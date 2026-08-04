// 种子数据展示 section：渲染 data/seed-entities.json 中前端未展示的种子数据。
// 4 个集合：原创角色原型（characters）、叙事场景（scenes）、故事模板（story_patterns）、热门元素（elements）。
// 以 tab 切换 + 卡片网格形式展示，与 LibrarySection（knowledge-base.json 数据）互补。

import seedEntities from '../../data/seed-entities.json'
import { icon } from '../ui/icons.js'
import { escapeHtml } from '../ui/dom.js'

// 集合配置：key → { label, badge, render }
const collections = {
  characters: {
    label: '原创角色',
    badge: '原创角色',
    items: seedEntities.characters,
    render: (item) => ({
      title: item.name,
      meta: `${item.kind === 'original' ? '原创原型' : '经典原型'} · ${item.media}`,
      tags: item.traits,
      body: `能力：${item.abilities.join('、')}。关系：${item.relations.join(' / ')}。`,
    }),
  },
  scenes: {
    label: '叙事场景',
    badge: '场景模板',
    items: seedEntities.scenes,
    render: (item) => ({
      title: item.name,
      meta: `${item.lifecycle} · ${item.rights_status}`,
      tags: [],
      body: item.pattern.join(' → '),
    }),
  },
  story_patterns: {
    label: '故事模板',
    badge: '故事结构',
    items: seedEntities.story_patterns,
    render: (item) => ({
      title: item.name,
      meta: '叙事结构',
      tags: [],
      body: item.beats.join(' → '),
    }),
  },
  elements: {
    label: '热门元素',
    badge: '元素种子',
    items: seedEntities.elements,
    render: (item) => ({
      title: item.name,
      meta: `${item.category} · 可生成度 ${(item.generatability * 100).toFixed(0)}%`,
      tags: [],
      body: `动作：${item.actions.join(' / ')}`,
    }),
  },
}

export const renderSeedSection = () => `
  <section class="library-section seed-section" id="seed-library">
    <div class="shell">
      <div class="section-title"><div><span class="kicker">SEED ENTITIES</span><h2>原创角色与叙事种子</h2><p>不依赖任何 IP 的原创角色原型、叙事场景模板、故事结构和热门元素，为跨界混搭提供多样化素材池。</p></div></div>
      <div class="library-toolbar"><div class="tabs" role="tablist" id="seed-tabs">
        ${Object.entries(collections)
          .map(
            ([key, config], i) =>
              `<button class="${i === 0 ? 'active' : ''}" data-seed-tab="${key}">${config.label} (${config.items.length})</button>`,
          )
          .join('')}
      </div></div>
      <div class="library-meta" id="seed-meta"></div>
      <div class="library-grid" id="seed-grid"></div>
    </div>
  </section>
`

let activeSeedTab = 'characters'

const renderSeedGrid = () => {
  const config = collections[activeSeedTab]
  if (!config) return
  const grid = document.querySelector('#seed-grid')
  if (!grid) return
  const items = config.items
  const meta = document.querySelector('#seed-meta')
  if (meta) {
    meta.textContent = items.length ? `共 ${items.length} 项` : ''
  }
  grid.innerHTML = items.length
    ? items
        .map((item, index) => {
          const rendered = config.render(item)
          return `<article class="library-card seed-card"><div class="library-index">${String(index + 1).padStart(2, '0')}</div><span class="library-badge">${rendered.badge ?? config.badge}</span><h3>${escapeHtml(rendered.title)}</h3><p class="library-meta">${escapeHtml(rendered.meta)}</p><p>${escapeHtml(rendered.body)}</p>${rendered.tags.length ? `<div class="mini-tags">${rendered.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}</div>` : ''}<small>${icon('shield', 13)} original</small></article>`
        })
        .join('')
    : '<p class="empty">暂无数据。</p>'
}

export const mountSeedSection = () => {
  const tabs = document.querySelectorAll('[data-seed-tab]')
  tabs.forEach((button) =>
    button.addEventListener('click', () => {
      tabs.forEach((item) => item.classList.remove('active'))
      button.classList.add('active')
      activeSeedTab = button.dataset.seedTab
      renderSeedGrid()
    }),
  )
  renderSeedGrid()
}
