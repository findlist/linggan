// 知识库详情视图模块：把角色 / 作品 / 名场面渲染为可访问的弹窗，
// 并提供“开始创作”入口把当前实体带入跨作品混搭工作台。
// 与 main.js 解耦，通过 context 接收查找表和回调，便于复用与单测。

/** 把 ISO 时间格式化为 Asia/Shanghai 时区的可读字符串。 */
const formatDate = iso => new Date(iso).toLocaleString('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit'
})

/** 单个字段行：左侧标签 + 右侧值（值可为 HTML）。 */
const renderField = (label, valueHtml) =>
  `<div class="detail-field"><span class="detail-field-label">${label}</span><div class="detail-field-value">${valueHtml}</div></div>`

/** 标签列表：用于情绪弧、视觉动作等短文本数组。 */
const renderTagList = (items, escapeHtml) => items.length
  ? `<div class="detail-tags">${items.map(item => `<span>${escapeHtml(item)}</span>`).join('')}</div>`
  : '<p class="detail-empty">无</p>'

/** 来源证据列表：外链在新标签页打开，避免误以为站内导航。 */
const renderSourceList = (sources, escapeHtml) =>
  `<ul class="detail-sources">${sources.map(source => `<li><a href="${source.url}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.source_name)} · ${escapeHtml(source.page_title)}</a><small>采集 ${formatDate(source.collected_at)}${source.published_at ? ` · 发布 ${formatDate(source.published_at)}` : ''}</small></li>`).join('')}</ul>`

/** 实体间跳转链接：点击切换到对应实体的详情，不离开弹窗。 */
const renderEntityLink = (type, id, label, escapeHtml) =>
  `<button class="detail-link" type="button" data-detail-link="${type}" data-detail-id="${id}">${escapeHtml(label)}</button>`

/** 角色详情字段：覆盖所属作品、类型、特征、对白风格、关系、参与名场面、版权与来源。 */
const renderCharacterBody = (character, ctx) => {
  const work = ctx.workById.get(character.work_id)
  const moments = ctx.knowledge.iconic_moments.filter(moment => moment.participant_ids.includes(character.id))
  return [
    renderField('所属作品', renderEntityLink('works', work.id, work.title, ctx.escapeHtml)),
    renderField('角色身份', ctx.escapeHtml(character.roles.join('、'))),
    renderField('角色类型', ctx.escapeHtml(character.character_types.join('、'))),
    renderField('特征', ctx.escapeHtml(character.traits.join('、'))),
    renderField('对白风格', ctx.escapeHtml(character.dialogue_style.join('；'))),
    renderField('关系', character.relationships.length
      ? character.relationships.map(id => {
          const target = ctx.characterById.get(id)
          return target ? renderEntityLink('characters', target.id, target.name, ctx.escapeHtml) : ctx.escapeHtml(id)
        }).join('')
      : '<p class="detail-empty">无显式关系记录</p>'),
    renderField('参与名场面', moments.length
      ? moments.map(moment => renderEntityLink('moments', moment.id, moment.name, ctx.escapeHtml)).join('')
      : '<p class="detail-empty">无</p>'),
    renderField('别名', character.aliases.length ? ctx.escapeHtml(character.aliases.join('、')) : '<p class="detail-empty">无</p>'),
    renderField('版权状态', ctx.escapeHtml(ctx.rightsLabels[character.rights_status] ?? character.rights_status)),
    renderField('风险等级', ctx.escapeHtml(ctx.riskLabels[character.risk_level] ?? character.risk_level)),
    renderField('最后验证', ctx.escapeHtml(formatDate(character.last_verified_at))),
    renderField('来源证据', renderSourceList(character.sources, ctx.escapeHtml))
  ].join('')
}

/** 作品详情字段：覆盖别名、媒介、地区、年份、类型、关联实体、版权与来源。 */
const renderWorkBody = (work, ctx) => {
  const characters = ctx.knowledge.known_characters.filter(c => c.work_id === work.id)
  const moments = ctx.knowledge.iconic_moments.filter(moment => moment.work_id === work.id)
  const relationships = ctx.knowledge.relationships.filter(relation => relation.work_id === work.id)
  return [
    renderField('原标题', work.original_title ? ctx.escapeHtml(work.original_title) : '<p class="detail-empty">无</p>'),
    renderField('别名', work.aliases.length ? ctx.escapeHtml(work.aliases.join('、')) : '<p class="detail-empty">无</p>'),
    renderField('媒介类型', ctx.escapeHtml(ctx.mediaNames[work.media_type] ?? work.media_type)),
    renderField('地区', ctx.escapeHtml(work.regions.join(' / '))),
    renderField('上映年份', work.release_year ? String(work.release_year) : '<p class="detail-empty">未知</p>'),
    renderField('类型', ctx.escapeHtml(work.genres.join('、'))),
    renderField('关联角色', characters.length
      ? characters.map(c => renderEntityLink('characters', c.id, c.name, ctx.escapeHtml)).join('')
      : '<p class="detail-empty">暂无记录</p>'),
    renderField('关联名场面', moments.length
      ? moments.map(moment => renderEntityLink('moments', moment.id, moment.name, ctx.escapeHtml)).join('')
      : '<p class="detail-empty">暂无记录</p>'),
    renderField('人物关系', relationships.length
      ? relationships.map(relation => {
          const from = ctx.characterById.get(relation.from_character_id)
          const to = ctx.characterById.get(relation.to_character_id)
          if (!from || !to) return ''
          return `<div class="detail-relation"><span class="detail-relation-label">${ctx.escapeHtml(relation.relation)}</span>${renderEntityLink('characters', from.id, from.name, ctx.escapeHtml)}<span class="detail-relation-arrow">→</span>${renderEntityLink('characters', to.id, to.name, ctx.escapeHtml)}</div>`
        }).join('')
      : '<p class="detail-empty">暂无记录</p>'),
    renderField('版权状态', ctx.escapeHtml(ctx.rightsLabels[work.rights_status] ?? work.rights_status)),
    renderField('风险等级', ctx.escapeHtml(ctx.riskLabels[work.risk_level] ?? work.risk_level)),
    renderField('最后验证', ctx.escapeHtml(formatDate(work.last_verified_at))),
    renderField('来源证据', renderSourceList(work.sources, ctx.escapeHtml))
  ].join('')
}

/** 名场面详情字段：覆盖所属作品、参与角色、冲突、情绪弧、视觉动作、节拍、对白模式与来源。 */
const renderMomentBody = (moment, ctx) => {
  const work = ctx.workById.get(moment.work_id)
  const participants = moment.participant_ids.map(id => ctx.characterById.get(id)).filter(Boolean)
  return [
    renderField('所属作品', renderEntityLink('works', work.id, work.title, ctx.escapeHtml)),
    renderField('参与角色', participants.length
      ? participants.map(c => renderEntityLink('characters', c.id, c.name, ctx.escapeHtml)).join('')
      : '<p class="detail-empty">无</p>'),
    renderField('场景设定', ctx.escapeHtml(moment.setting)),
    renderField('冲突类型', ctx.escapeHtml(moment.conflict_type)),
    renderField('情绪弧', renderTagList(moment.emotional_arc, ctx.escapeHtml)),
    renderField('视觉动作', renderTagList(moment.visual_actions, ctx.escapeHtml)),
    renderField('可复用节拍', `<ol class="detail-beats">${moment.reusable_beats.map(beat => `<li>${ctx.escapeHtml(beat)}</li>`).join('')}</ol>`),
    renderField('对白模式', renderTagList(moment.dialogue_patterns, ctx.escapeHtml)),
    renderField('抽象描述', ctx.escapeHtml(moment.abstraction)),
    renderField('版权状态', ctx.escapeHtml(ctx.rightsLabels[moment.rights_status] ?? moment.rights_status)),
    renderField('风险等级', ctx.escapeHtml(ctx.riskLabels[moment.risk_level] ?? moment.risk_level)),
    renderField('最后验证', ctx.escapeHtml(formatDate(moment.last_verified_at))),
    renderField('来源证据', renderSourceList(moment.sources, ctx.escapeHtml))
  ].join('')
}

const renderCharacterActions = (character, ctx) => `
  <button class="btn primary" type="button" data-detail-apply="characters" data-detail-id="${character.id}" data-detail-slot="a">${ctx.icon('play', 16)} 设为角色 A 开始创作</button>
  <button class="btn ghost" type="button" data-detail-apply="characters" data-detail-id="${character.id}" data-detail-slot="b">设为角色 B</button>
`

const renderWorkActions = (work, ctx) => {
  // 作品没有可直接带入工作台的字段，因此把该作品首个角色填入角色 A
  const hasCharacter = ctx.knowledge.known_characters.some(c => c.work_id === work.id)
  return hasCharacter
    ? `<button class="btn primary" type="button" data-detail-apply="works" data-detail-id="${work.id}" data-detail-slot="a">${ctx.icon('play', 16)} 用此作品角色开始创作</button>`
    : '<p class="detail-empty">该作品暂无可带入的角色</p>'
}

const renderMomentActions = (moment, ctx) => `
  <button class="btn primary" type="button" data-detail-apply="moments" data-detail-id="${moment.id}" data-detail-slot="moment">${ctx.icon('play', 16)} 带入名场面开始创作</button>
`

/**
 * 创建详情视图控制器。
 * @param {object} ctx - 上下文：知识库、查找表、辅助函数与 onApplyToRemix 回调
 * @returns {{open: (type: string, id: string) => void, close: () => void}}
 */
export const createDetailView = (ctx) => {
  const root = document.createElement('div')
  root.className = 'detail-root'
  root.hidden = true
  root.innerHTML = `
    <div class="detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title">
      <div class="detail-backdrop" data-detail-close></div>
      <article class="detail-panel">
        <button class="detail-close" type="button" aria-label="关闭详情" data-detail-close>${ctx.icon('close', 20)}</button>
        <header class="detail-header">
          <span class="detail-badge" id="detail-badge"></span>
          <h2 id="detail-title"></h2>
          <p class="detail-subtitle" id="detail-subtitle"></p>
        </header>
        <div class="detail-body" id="detail-body"></div>
        <footer class="detail-actions" id="detail-actions"></footer>
      </article>
    </div>
  `
  document.body.appendChild(root)

  let lastFocused = null

  // 事件委托：统一处理关闭、实体间跳转和开始创作三类点击
  root.addEventListener('click', event => {
    const closeTarget = event.target.closest('[data-detail-close]')
    if (closeTarget) { close(); return }
    const link = event.target.closest('[data-detail-link]')
    if (link) { open(link.dataset.detailLink, link.dataset.detailId); return }
    const apply = event.target.closest('[data-detail-apply]')
    if (apply) {
      ctx.onApplyToRemix(apply.dataset.detailApply, apply.dataset.detailId, apply.dataset.detailSlot)
      close()
    }
  })

  // 键盘可访问：Esc 关闭；Tab 在弹窗内循环，避免焦点跑到背景
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape') { close(); return }
    if (event.key === 'Tab' && !root.hidden) {
      const focusable = root.querySelectorAll('button, a, [tabindex]:not([tabindex="-1"])')
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
  })

  const open = (type, id) => {
    let entity
    if (type === 'characters') entity = ctx.characterById.get(id)
    else if (type === 'works') entity = ctx.workById.get(id)
    else if (type === 'moments') entity = ctx.knowledge.iconic_moments.find(item => item.id === id)
    if (!entity) return

    const badge = root.querySelector('#detail-badge')
    const title = root.querySelector('#detail-title')
    const subtitle = root.querySelector('#detail-subtitle')
    const body = root.querySelector('#detail-body')
    const actions = root.querySelector('#detail-actions')

    if (type === 'characters') {
      const work = ctx.workById.get(entity.work_id)
      badge.textContent = '角色参考'
      title.textContent = entity.name
      subtitle.innerHTML = `${ctx.icon('book', 14)} ${renderEntityLink('works', work.id, work.title, ctx.escapeHtml)} · ${ctx.escapeHtml(entity.roles.join(' / '))}`
      body.innerHTML = renderCharacterBody(entity, ctx)
      actions.innerHTML = renderCharacterActions(entity, ctx)
    } else if (type === 'works') {
      badge.textContent = '作品索引'
      title.textContent = entity.title
      subtitle.innerHTML = `${ctx.escapeHtml(ctx.mediaNames[entity.media_type] ?? entity.media_type)} · ${entity.release_year ?? '年份未知'} · ${ctx.escapeHtml(entity.regions.join(' / '))}`
      body.innerHTML = renderWorkBody(entity, ctx)
      actions.innerHTML = renderWorkActions(entity, ctx)
    } else {
      const work = ctx.workById.get(entity.work_id)
      badge.textContent = '结构参考'
      title.textContent = entity.name
      subtitle.innerHTML = `${ctx.icon('book', 14)} ${renderEntityLink('works', work.id, work.title, ctx.escapeHtml)} · ${ctx.escapeHtml(entity.conflict_type)}`
      body.innerHTML = renderMomentBody(entity, ctx)
      actions.innerHTML = renderMomentActions(entity, ctx)
    }

    root.hidden = false
    document.body.style.overflow = 'hidden'
    lastFocused = document.activeElement
    // 聚焦关闭按钮，便于键盘用户立刻定位弹窗
    root.querySelector('.detail-close').focus()
  }

  const close = () => {
    root.hidden = true
    document.body.style.overflow = ''
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus()
  }

  return { open, close }
}
