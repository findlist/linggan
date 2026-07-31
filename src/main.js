import knowledge from '../data/knowledge-base.json'
import { buildRemixPlan } from './generation/remix-engine.ts'
import { createDetailView } from './detail-view.js'
import './radar.css'

let trendExport = null
let candidateExport = null

const loadTrendExport = async () => {
  try {
    const response = await fetch('./data/trend-export.json')
    if (!response.ok) {
      try { const fallback = await fetch('/data/trend-export.json'); if (fallback.ok) return await fallback.json() } catch {}
      return null
    }
    const data = await response.json()
    if (data.schema_version !== 1) return null
    return data
  } catch {
    return null
  }
}

// 加载已批准候选导出文档；前端不直接访问 SQLite，只消费只读 JSON
const loadCandidateExport = async () => {
  try {
    const response = await fetch('./data/candidate-export.json')
    if (!response.ok) {
      try { const fallback = await fetch('/data/candidate-export.json'); if (fallback.ok) return await fallback.json() } catch {}
      return null
    }
    const data = await response.json()
    if (data.schema_version !== 1) return null
    return data
  } catch {
    return null
  }
}

const riskLabels = { low: '低风险', medium: '中风险', high: '高风险', blocked: '阻断' }
const rightsLabels = { original: '原创', licensed: '已授权', public_domain: '公共领域', reference_only: '仅参考', unknown: '版权未知', restricted: '受限' }
const formatScore = value => Number.isFinite(value) ? Math.round(value) : '—'

// 渲染今日推荐流：无已批准候选时显示明确空状态，禁止展示待审内容
const renderCandidateFeed = data => {
  const feed = document.querySelector('#feed-grid')
  const pill = document.querySelector('#feed-status-pill')
  if (!feed) return
  if (!data || data.candidate_count === 0) {
    if (pill) pill.innerHTML = `${icon('database', 16)} 暂无已批准候选`
    feed.innerHTML = `<div class="feed-empty">${icon('sparkles', 24)}<p>暂无已批准的创意候选</p><small>候选生成并审核通过后，今日推荐流会在这里展示真实方案。当前展示内容均为已审核 approved 候选，不会出现待审或驳回内容。</small></div>`
    return
  }
  if (pill) pill.innerHTML = `${icon('check', 16)} ${data.candidate_count} 条已批准候选`
  feed.innerHTML = data.candidates.map((candidate, index) => `<article class="feed-card">
    <div class="feed-index">${String(index + 1).padStart(2, '0')}</div>
    <span class="feed-badge">${icon('shield', 13)} ${rightsLabels[candidate.rights_status] ?? candidate.rights_status}</span>
    <h3>${escapeHtml(candidate.title)}</h3>
    <p class="feed-source">来源趋势 · ${escapeHtml(candidate.source_trend)}</p>
    <div class="feed-hook"><span>前三秒钩子</span><b>${escapeHtml(candidate.hook)}</b></div>
    <div class="feed-meta"><span>质量分 <strong>${formatScore(candidate.score.total)}</strong></span><span>${riskLabels[candidate.risk_level] ?? candidate.risk_level}</span><span>${candidate.generated_at.slice(0, 10)}</span></div>
  </article>`).join('')
}

const icon = (name, size = 20) => {
  const paths = {
    sparkles: '<path d="m12 3-1.4 3.6L7 8l3.6 1.4L12 13l1.4-3.6L17 8l-3.6-1.4L12 3Z"/><path d="m5 14-.8 2.2L2 17l2.2.8L5 20l.8-2.2L8 17l-2.2-.8L5 14Z"/>',
    radar: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 12 19 5M12 3v2M3 12h2M12 19v2"/>',
    database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
    shuffle: '<path d="M3 7h3c4 0 5 10 9 10h6M18 14l3 3-3 3M3 17h3c1.8 0 3-2 4-4M15 7h6M18 4l3 3-3 3"/>',
    book: '<path d="M4 5a3 3 0 0 1 3-3h5v18H7a3 3 0 0 0-3 3V5ZM20 5a3 3 0 0 0-3-3h-5v18h5a3 3 0 0 1 3 3V5Z"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    bookmark: '<path d="M6 3h12v18l-6-4-6 4V3Z"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    shield: '<path d="M12 3 4 6v5c0 5 3.4 8.4 8 10 4.6-1.6 8-5 8-10V6l-8-3Z"/><path d="m9 12 2 2 4-4"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    play: '<path d="m9 7 8 5-8 5V7Z"/>',
    check: '<path d="m5 12 4 4L19 6"/>'
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.sparkles}</svg>`
}

const workById = new Map(knowledge.works.map(work => [work.id, work]))
const characterById = new Map(knowledge.known_characters.map(character => [character.id, character]))
const mediaNames = { television: '电视剧', anime: '动漫', film: '电影', game: '游戏', variety: '综艺' }
const escapeHtml = value => String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char])

const radarChannels = [
  { name: '公开热点', detail: '热搜、赛事与文化事件', state: '每 6 小时', tone: 'pink' },
  { name: '热门角色', detail: '作品人物与关系变化', state: '待入库', tone: 'violet' },
  { name: '视频形式', detail: '镜头结构与评论区需求', state: '待入库', tone: 'blue' }
]

const categoryLabels = {
  meme: '热梗', expression: '表情包', television: '电视剧', anime: '动漫',
  film: '电影', game: '游戏', variety: '综艺', character: '角色',
  video_format: '视频形式', creator_demand: '创作者需求',
  festival: '节日', sports: '体育', cultural_event: '文化事件'
}

const lifecycleLabels = {
  emerging: '萌芽期', rising: '上升期', peak: '峰值期',
  declining: '回落期', evergreen: '常青', archived: '已归档'
}

const renderRadarChannels = (trends) => {
  if (!trends || trends.length === 0) {
    return `<div class="radar-empty">${icon('radar', 24)}<p>暂无已入库的热点趋势</p><small>采集任务运行后，经过校验和去重的热点会出现在这里</small></div>`
  }
  const channels = {}
  for (const trend of trends) {
    const cat = trend.category
    if (!channels[cat]) channels[cat] = []
    channels[cat].push(trend)
  }
  const topCategories = Object.entries(channels)
    .sort(([, a], [, b]) => b.length - a.length)
    .slice(0, 3)
  const tones = ['pink', 'violet', 'blue']
  return topCategories.map(([category, items], index) => {
    const top = items.sort((a, b) => (b.heat ?? 0) - (a.heat ?? 0))[0]
    return `<article>
      <i class="channel-dot ${tones[index]}"></i>
      <div>
        <b>${categoryLabels[category] ?? category}</b>
        <p>${escapeHtml(top.name)}${items.length > 1 ? ` 等 ${items.length} 条` : ''}</p>
      </div>
      <span>${lifecycleLabels[top.lifecycle] ?? top.lifecycle}</span>
    </article>`
  }).join('')
}

const remixStyles = [
  { id: 'cinematic', label: '电影感热血', prompt: '克制写实光影、宽银幕构图、逐步升级的群像调度' },
  { id: 'absurd', label: '一本正经的荒诞', prompt: '严肃表演处理微小目标，反差来自角色态度而非恶搞造型' },
  { id: 'animation', label: '国风动画', prompt: '原创东方幻想视觉、粒子化气流、清晰动作轮廓与留白' },
  { id: 'mockumentary', label: '伪纪录片', prompt: '手持跟拍、角色采访、证词冲突与监控式反转' }
]

const app = document.querySelector('#app')

const renderCharacterOptions = selected => knowledge.known_characters.map(character => {
  const work = workById.get(character.work_id)
  return `<option value="${character.id}" ${character.id === selected ? 'selected' : ''}>${escapeHtml(character.name)} · ${escapeHtml(work.title)}</option>`
}).join('')

const renderMomentOptions = selected => knowledge.iconic_moments.map(moment => {
  const work = workById.get(moment.work_id)
  return `<option value="${moment.id}" ${moment.id === selected ? 'selected' : ''}>${escapeHtml(moment.name)} · ${escapeHtml(work.title)}</option>`
}).join('')

app.innerHTML = `
  <header class="topbar">
    <nav class="nav shell" aria-label="主导航">
      <a class="brand" href="#top"><span class="brand-mark">${icon('sparkles', 21)}</span><span>灵感</span><small>LINGGAN LAB</small></a>
      <div class="nav-links"><a href="#feed">今日推荐</a><a href="#radar">热点雷达</a><a href="#remix">跨界混搭</a><a href="#library">素材库</a></div>
      <div class="nav-status"><i></i><span>采集与 SQLite 入库已连接</span></div>
      <button class="menu-button" aria-label="打开导航" aria-expanded="false">${icon('menu')}</button>
    </nav>
  </header>
  <main id="main">
    <section class="hero shell" id="top">
      <div class="hero-copy">
        <div class="eyebrow"><span></span> REAL-TIME REMIX ENGINE</div>
        <h1>热点会过去，<br><em>组合永远有新意。</em></h1>
        <p>自动发现实时热点、热梗、热门角色和名场面，再把不同作品的角色关系、冲突节奏与视频形式重新排列，生成真正能拍的创意方案。</p>
        <div class="hero-actions"><a class="btn primary" href="#remix">开始一次混搭 ${icon('arrow', 18)}</a><a class="btn ghost" href="#library">浏览基础库</a></div>
        <div class="stat-line"><div><strong>${knowledge.works.length}</strong><span>参考作品</span></div><div><strong>${knowledge.known_characters.length}</strong><span>主要角色</span></div><div><strong>${knowledge.iconic_moments.length}</strong><span>名场面结构</span></div></div>
      </div>
      <div class="hero-stage" aria-label="混搭示意">
        <div class="stage-grid"></div>
        <article class="stage-card role-card role-a"><span>角色 A · 凡人修仙传</span><b>韩立</b><small>谨慎成长者 / 资源规划者</small></article>
        <article class="stage-card role-card role-b"><span>角色 B · 仙逆</span><b>李慕婉</b><small>温柔智者 / 稳定支点</small></article>
        <article class="stage-card scene-card"><span>名场面节奏 · 亮剑</span><b>限时集结攻坚</b><small>目标受困 → 多路集结 → 侧翼破局</small></article>
        <div class="stage-core">${icon('shuffle', 28)}<b>REMIX</b></div>
      </div>
    </section>

    <section class="feed-section" id="feed">
      <div class="shell">
        <div class="section-title"><div><span class="kicker">TODAY'S PICKS</span><h2>今日推荐</h2><p>只展示已审核通过的持久化候选，待审、驳回或归档内容不会出现在这里。</p></div><span class="system-pill" id="feed-status-pill">${icon('database', 16)} 读取中</span></div>
        <div class="feed-grid" id="feed-grid"><div class="feed-empty">${icon('sparkles', 24)}<p>正在加载今日推荐...</p></div></div>
      </div>
    </section>

    <section class="radar-section" id="radar">
      <div class="shell">
        <div class="section-title"><div><span class="kicker">DISCOVERY PIPELINE</span><h2>实时热点雷达</h2><p>公开来源先留证，再经过 Schema、去重与风险标记进入素材系统。</p></div><span class="system-pill" id="radar-status-pill">${icon('database', 16)} SQLite 正式库 · ${trendExport ? `${trendExport.trend_count} 条已入库` : '等待真实采集批次'}</span></div>
        <div class="radar-layout">
          <div class="radar-visual"><div class="radar-ring ring-1"></div><div class="radar-ring ring-2"></div><div class="radar-ring ring-3"></div><div class="radar-sweep"></div><div class="radar-center">${icon('radar', 28)}<span>07:30<br>13:30<br>19:30</span></div><i class="blip b1"></i><i class="blip b2"></i><i class="blip b3"></i></div>
          <div class="channel-list" id="radar-channel-list">${trendExport ? renderRadarChannels(trendExport.trends) : radarChannels.map(channel => `<article><i class="channel-dot ${channel.tone}"></i><div><b>${channel.name}</b><p>${channel.detail}</p></div><span>${channel.state}</span></article>`).join('')}<div class="pipeline-note">${icon('shield', 18)}<p><b>不编造热度</b><br>无法核实的指标保持为空，具体 IP 只作参考标签。</p></div></div>
          <div class="flow-card"><span class="kicker">DATA FLOW</span><ol><li class="done"><i>${icon('check', 14)}</i><div><b>公开来源采集</b><small>URL、时间、可见指标</small></div></li><li class="done"><i>${icon('check', 14)}</i><div><b>批次校验与去重</b><small>坏批次隔离，原始证据保留</small></div></li><li class="done"><i>${icon('check', 14)}</i><div><b>SQLite 事务入库</b><small>人物、名场面与趋势可关联</small></div></li><li class="done"><i>${icon('check', 14)}</i><div><b>创意组合与评分</b><small>候选流水线已接通正式趋势库</small></div></li></ol></div>
        </div>
      </div>
    </section>

    <section class="remix-section shell" id="remix">
      <div class="section-title"><div><span class="kicker">CROSSOVER LAB</span><h2>跨作品混搭实验室</h2><p>人物借用的是关系与性格，名场面借用的是冲突节奏；输出使用原创改写台词与非精确视觉方案。</p></div><button class="btn ghost randomize">${icon('shuffle', 17)} 随机换一组</button></div>
      <div class="remix-workspace">
        <form class="composer" id="remix-form">
          <div class="field"><label for="character-a"><span>01</span>主行动角色</label><select id="character-a">${renderCharacterOptions('known_han_li')}</select><small class="field-hint" id="hint-a"></small></div>
          <div class="operator">×</div>
          <div class="field"><label for="character-b"><span>02</span>关系碰撞角色</label><select id="character-b">${renderCharacterOptions('known_li_muwan')}</select><small class="field-hint" id="hint-b"></small></div>
          <div class="operator">×</div>
          <div class="field wide"><label for="moment"><span>03</span>名场面冲突结构</label><select id="moment">${renderMomentOptions('moment_mass_assault')}</select><small class="field-hint" id="hint-moment"></small></div>
          <div class="field style-field"><label for="style"><span>04</span>视频风格</label><select id="style">${remixStyles.map(style => `<option value="${style.id}">${style.label}</option>`).join('')}</select></div>
          <div class="duration"><span>时长</span><button type="button" data-duration="15">15s</button><button type="button" class="active" data-duration="30">30s</button><button type="button" data-duration="60">60s</button></div>
          <button class="btn primary generate-remix" type="submit">${icon('sparkles', 18)} 生成混搭方案</button>
        </form>
        <article class="result-card" id="result-card" aria-live="polite"></article>
      </div>
    </section>

    <section class="library-section" id="library">
      <div class="shell">
        <div class="section-title"><div><span class="kicker">KNOWLEDGE BASE</span><h2>可组合的内容基因库</h2><p>不是素材下载站，而是可追溯的角色类型、关系张力、台词风格和叙事结构索引。</p></div></div>
        <div class="library-toolbar"><div class="tabs" role="tablist"><button class="active" data-tab="characters">主要角色</button><button data-tab="moments">名场面</button><button data-tab="works">作品</button></div><label class="library-search">${icon('search', 17)}<input id="library-search" placeholder="搜索角色、类型、作品或场面" /></label></div>
        <div class="library-grid" id="library-grid"></div>
      </div>
    </section>

    <section class="saved-section shell"><div><span class="kicker">YOUR WORKSPACE</span><h2>已收藏的混搭</h2></div><div class="saved-list" id="saved-list"><p class="empty">还没有收藏方案。先生成一次意外碰撞。</p></div></section>
  </main>
  <footer><div class="shell footer-inner"><a class="brand" href="#top"><span class="brand-mark">${icon('sparkles',18)}</span><span>灵感</span></a><p>公开来源留证 · 参考资产隔离 · 原创表达优先</p><span>Linggan Remix Lab</span></div></footer>
  <div class="toast" role="status" aria-live="polite"></div>
`

let duration = 30
let generation = 0
let currentResult = null
let activeTab = 'characters'
let saved = JSON.parse(localStorage.getItem('linggan-saved-remixes') ?? '[]')

const toast = message => {
  const element = document.querySelector('.toast')
  element.textContent = message
  element.classList.add('show')
  clearTimeout(window.lingganToast)
  window.lingganToast = setTimeout(() => element.classList.remove('show'), 2600)
}

const updateHints = () => {
  const a = characterById.get(document.querySelector('#character-a').value)
  const b = characterById.get(document.querySelector('#character-b').value)
  const moment = knowledge.iconic_moments.find(item => item.id === document.querySelector('#moment').value)
  document.querySelector('#hint-a').textContent = `${a.character_types.join(' · ')}｜${a.traits.join('、')}`
  document.querySelector('#hint-b').textContent = `${b.character_types.join(' · ')}｜${b.traits.join('、')}`
  document.querySelector('#hint-moment').textContent = `${moment.conflict_type}｜${moment.reusable_beats.slice(0, 2).join(' → ')}`
}

const personalityLabels = { cold: '冷酷型', hot: '热血型', cunning: '腹黑型', gentle: '温柔型' }
const hookCategoryLabels = { suspense: '悬念', contrast: '反差', question: '提问', action: '行动' }

const buildRemix = () => {
  const a = characterById.get(document.querySelector('#character-a').value)
  const b = characterById.get(document.querySelector('#character-b').value)
  const moment = knowledge.iconic_moments.find(item => item.id === document.querySelector('#moment').value)
  const style = remixStyles.find(item => item.id === document.querySelector('#style').value)
  // 种子加入 generation 计数器，使每次点击“生成”都能产生不同方案；同一 seed 字符串在引擎内确定性展开
  const seed = `${a.id}${b.id}${moment.id}${style.id}${generation}`
  const plan = buildRemixPlan({
    characterA: a,
    characterB: b,
    moment,
    workA: workById.get(a.work_id),
    workB: workById.get(b.work_id),
    momentWork: workById.get(moment.work_id),
    style,
    duration,
    seed
  })
  return { plan, a, b, moment, style }
}

const renderResult = result => {
  const { plan } = result
  const card = document.querySelector('#result-card')
  card.innerHTML = `
    <div class="result-top"><span class="result-label">生成完成 · ${plan.duration}s · ${hookCategoryLabels[plan.hookCategory]}钩子</span><span class="risk-badge">REFERENCE ONLY</span></div>
    <h3>${escapeHtml(plan.title)}</h3><p class="concept">${escapeHtml(plan.concept)}</p>
    <div class="hook"><span>前三秒钩子</span><b>${escapeHtml(plan.hook)}</b></div>
    <div class="result-tags"><span>${icon('shield', 13)} ${escapeHtml(result.a.name)}：${personalityLabels[plan.personalityA]}</span><span>${escapeHtml(result.b.name)}：${personalityLabels[plan.personalityB]}</span></div>
    <div class="beat-list storyboard-list">${plan.storyboard.map(shot => `<div class="shot"><span>${String(shot.index).padStart(2, '0')} · ${shot.duration}s</span><p class="shot-visual">${escapeHtml(shot.visual)}</p><small>动作：${escapeHtml(shot.action)} · 情绪：${escapeHtml(shot.emotion)}</small></div>`).join('')}</div>
    <div class="dialogues"><div><span>${escapeHtml(result.a.name)} · 原创改写</span><p>${escapeHtml(plan.dialogueA)}</p></div><div><span>${escapeHtml(result.b.name)} · 原创改写</span><p>${escapeHtml(plan.dialogueB)}</p></div></div>
    <details class="copywriting-block"><summary>发布文案候选（3 标题 · 描述 · 标签）</summary><div class="copy-titles"><span>标题候选</span><ul>${plan.copywriting.titles.map(title => `<li>${escapeHtml(title)}</li>`).join('')}</ul></div><p class="copy-desc">${escapeHtml(plan.copywriting.description)}</p><div class="copy-tags">${plan.copywriting.hashtags.map(tag => `<span>${escapeHtml(tag)}</span>`).join('')}</div></details>
    <details><summary>画面提示词与版权边界</summary><p>${escapeHtml(plan.prompt)}</p><small>${icon('shield', 14)} 参考角色和名场面不包含精确复刻素材；商业发布前需替换为原创或已授权资产。</small></details>
    <div class="result-actions"><button class="btn ghost copy-result">${icon('copy', 16)} 复制方案</button><button class="btn primary save-result">${icon('bookmark', 16)} 收藏混搭</button></div>`
  card.querySelector('.copy-result').addEventListener('click', async () => {
    await navigator.clipboard?.writeText(card.innerText)
    toast('方案已复制')
  })
  card.querySelector('.save-result').addEventListener('click', () => {
    if (!saved.some(item => item.title === plan.title)) saved.unshift({ id: plan.id, title: plan.title, hook: plan.hook })
    saved = saved.slice(0, 8)
    localStorage.setItem('linggan-saved-remixes', JSON.stringify(saved))
    renderSaved()
    toast('已收藏到工作台')
  })
}

const renderSaved = () => {
  const list = document.querySelector('#saved-list')
  list.innerHTML = saved.length ? saved.map(item => `<article><span>${icon('bookmark', 16)}</span><div><b>${escapeHtml(item.title)}</b><p>${escapeHtml(item.hook)}</p></div><button data-remove="${escapeHtml(item.id)}" aria-label="删除收藏">${icon('close', 16)}</button></article>`).join('') : '<p class="empty">还没有收藏方案。先生成一次意外碰撞。</p>'
  list.querySelectorAll('[data-remove]').forEach(button => button.addEventListener('click', () => {
    saved = saved.filter(item => item.id !== button.dataset.remove)
    localStorage.setItem('linggan-saved-remixes', JSON.stringify(saved))
    renderSaved()
  }))
}

const libraryItems = tab => {
  if (tab === 'characters') return knowledge.known_characters.map(character => ({
    id: character.id,
    title: character.name,
    meta: `${workById.get(character.work_id).title} · ${character.roles.join(' / ')}`,
    tags: character.character_types,
    body: `${character.traits.join('、')}。台词风格：${character.dialogue_style.join('；')}`,
    badge: '角色参考'
  }))
  if (tab === 'moments') return knowledge.iconic_moments.map(moment => ({
    id: moment.id,
    title: moment.name,
    meta: `${workById.get(moment.work_id).title} · ${moment.conflict_type}`,
    tags: moment.emotional_arc,
    body: moment.abstraction,
    badge: '结构参考'
  }))
  return knowledge.works.map(work => ({
    id: work.id,
    title: work.title,
    meta: `${mediaNames[work.media_type]} · ${work.release_year ?? '年份未知'} · ${work.regions.join(' / ')}`,
    tags: work.genres,
    body: `别名：${work.aliases.join('、') || '无'}。已记录 ${work.sources.length} 条公开来源证据。`,
    badge: '作品索引'
  }))
}

// 把详情视图中的实体带入跨作品混搭工作台，自动避免 A/B 选到同一角色
const applyToRemix = (type, id, slot) => {
  const remixSection = document.querySelector('#remix')
  const selectA = document.querySelector('#character-a')
  const selectB = document.querySelector('#character-b')
  const momentSelect = document.querySelector('#moment')

  if (type === 'characters') {
    const target = slot === 'b' ? selectB : selectA
    target.value = id
    if (selectA.value === selectB.value) {
      const other = knowledge.known_characters.find(c => c.id !== selectA.value)
      if (other) (slot === 'b' ? selectA : selectB).value = other.id
    }
    updateHints()
    remixSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
    toast(`已把 ${characterById.get(id).name} 填入角色 ${slot === 'b' ? 'B' : 'A'}`)
  } else if (type === 'moments') {
    momentSelect.value = id
    updateHints()
    remixSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
    toast(`已带入名场面：${knowledge.iconic_moments.find(item => item.id === id).name}`)
  } else if (type === 'works') {
    // 作品没有直接对应的工作台字段，把该作品首个角色填入角色 A
    const character = knowledge.known_characters.find(c => c.work_id === id)
    if (!character) { toast('该作品暂无可带入的角色'); return }
    selectA.value = character.id
    if (selectA.value === selectB.value) {
      const other = knowledge.known_characters.find(c => c.id !== selectA.value)
      if (other) selectB.value = other.id
    }
    updateHints()
    remixSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
    toast(`已带入《${workById.get(id).title}》的 ${character.name}`)
  }
}

// 详情视图：在 body 末尾挂载弹窗，素材库卡片点击后打开
const detailView = createDetailView({
  knowledge,
  workById,
  characterById,
  mediaNames,
  rightsLabels,
  riskLabels,
  icon,
  escapeHtml,
  onApplyToRemix: applyToRemix
})

const renderLibrary = () => {
  const query = document.querySelector('#library-search').value.trim().toLowerCase()
  const items = libraryItems(activeTab).filter(item => JSON.stringify(item).toLowerCase().includes(query))
  const grid = document.querySelector('#library-grid')
  grid.innerHTML = items.length ? items.map((item, index) => `<article class="library-card" role="button" tabindex="0" data-detail-link="${activeTab}" data-detail-id="${item.id}" aria-label="查看 ${escapeHtml(item.title)} 详情"><div class="library-index">${String(index + 1).padStart(2, '0')}</div><span class="library-badge">${item.badge}</span><h3>${escapeHtml(item.title)}</h3><p class="library-meta">${escapeHtml(item.meta)}</p><p>${escapeHtml(item.body)}</p><div class="mini-tags">${item.tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join('')}</div><small>${icon('shield', 13)} reference_only</small><span class="library-cta">${icon('arrow', 14)} 查看详情</span></article>`).join('') : '<p class="empty">没有匹配的内容。</p>'
  // 卡片支持点击与键盘（Enter / Space）打开详情视图
  grid.querySelectorAll('.library-card').forEach(card => {
    const open = () => detailView.open(card.dataset.detailLink, card.dataset.detailId)
    card.addEventListener('click', open)
    card.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        open()
      }
    })
  })
}

document.querySelector('.menu-button').addEventListener('click', event => {
  const links = document.querySelector('.nav-links')
  links.classList.toggle('open')
  const open = links.classList.contains('open')
  event.currentTarget.setAttribute('aria-expanded', String(open))
  event.currentTarget.innerHTML = icon(open ? 'close' : 'menu')
})

document.querySelectorAll('#character-a,#character-b,#moment').forEach(select => select.addEventListener('change', updateHints))
document.querySelectorAll('[data-duration]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-duration]').forEach(item => item.classList.remove('active'))
  button.classList.add('active')
  duration = Number(button.dataset.duration)
}))

document.querySelector('#remix-form').addEventListener('submit', event => {
  event.preventDefault()
  generation += 1
  currentResult = buildRemix()
  renderResult(currentResult)
  toast('新的跨界方案已生成')
})

document.querySelector('.randomize').addEventListener('click', () => {
  const selects = ['#character-a', '#character-b', '#moment', '#style'].map(selector => document.querySelector(selector))
  selects.forEach((select, index) => { select.selectedIndex = Math.floor(Math.random() * select.options.length) })
  if (selects[0].value === selects[1].value) selects[1].selectedIndex = (selects[1].selectedIndex + 1) % selects[1].options.length
  updateHints()
  generation += 1
  currentResult = buildRemix()
  renderResult(currentResult)
  toast('已随机换一组内容基因')
})

document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-tab]').forEach(item => item.classList.remove('active'))
  button.classList.add('active')
  activeTab = button.dataset.tab
  renderLibrary()
}))
document.querySelector('#library-search').addEventListener('input', renderLibrary)

updateHints()
currentResult = buildRemix()
renderResult(currentResult)
renderLibrary()
renderSaved()

// Load trend export and update radar section
loadTrendExport().then(data => {
  if (data) {
    trendExport = data
    const pill = document.querySelector('#radar-status-pill')
    if (pill) pill.innerHTML = `${icon('database', 16)} SQLite 正式库 · ${data.trend_count} 条已入库`
    const channelList = document.querySelector('#radar-channel-list')
    if (channelList) {
      const note = `<div class="pipeline-note">${icon('shield', 18)}<p><b>不编造热度</b><br>无法核实的指标保持为空，具体 IP 只作参考标签。</p></div>`
      channelList.innerHTML = renderRadarChannels(data.trends) + note
    }
  }
}).catch(() => {})

// 加载已批准候选导出并渲染今日推荐流
loadCandidateExport().then(data => {
  candidateExport = data
  renderCandidateFeed(data)
}).catch(() => renderCandidateFeed(null))
