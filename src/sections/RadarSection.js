// 热点雷达 section：渲染雷达视觉、渠道列表与数据流说明。
// 异步加载 SQLite 导出的 trend-export.json，无数据时回退到占位渠道列表。

import { icon } from '../ui/icons.js'
import { escapeHtml } from '../ui/dom.js'
import { categoryLabels, lifecycleLabels } from '../data/knowledge.js'

// 占位渠道：无真实趋势时展示，让雷达区域不为空白
const placeholderChannels = [
  { name: '公开热点', detail: '热搜、赛事与文化事件', state: '每 6 小时', tone: 'pink' },
  { name: '热门角色', detail: '作品人物与关系变化', state: '待入库', tone: 'violet' },
  { name: '视频形式', detail: '镜头结构与评论区需求', state: '待入库', tone: 'blue' }
]

// 加载正式趋势导出文档：双重路径兜底，避免 dev / preview 路径差异导致读取失败
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

// 渲染雷达渠道列表：按分类分组取前 3 类，每类取最热一条作为代表
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

const pipelineNote = () => `<div class="pipeline-note">${icon('shield', 18)}<p><b>不编造热度</b><br>无法核实的指标保持为空，具体 IP 只作参考标签。</p></div>`

// 渲染雷达 section 初始 HTML：含状态 pill、雷达视觉、渠道列表容器和数据流卡片
export const renderRadarSection = (trendExport) => `
  <section class="radar-section" id="radar">
    <div class="shell">
      <div class="section-title"><div><span class="kicker">DISCOVERY PIPELINE</span><h2>实时热点雷达</h2><p>公开来源先留证，再经过 Schema、去重与风险标记进入素材系统。</p></div><span class="system-pill" id="radar-status-pill">${icon('database', 16)} SQLite 正式库 · ${trendExport ? `${trendExport.trend_count} 条已入库` : '等待真实采集批次'}</span></div>
      <div class="radar-layout">
        <div class="radar-visual"><div class="radar-ring ring-1"></div><div class="radar-ring ring-2"></div><div class="radar-ring ring-3"></div><div class="radar-sweep"></div><div class="radar-center">${icon('radar', 28)}<span>07:30<br>13:30<br>19:30</span></div><i class="blip b1"></i><i class="blip b2"></i><i class="blip b3"></i></div>
        <div class="channel-list" id="radar-channel-list">${trendExport ? renderRadarChannels(trendExport.trends) + pipelineNote() : placeholderChannels.map(channel => `<article><i class="channel-dot ${channel.tone}"></i><div><b>${channel.name}</b><p>${channel.detail}</p></div><span>${channel.state}</span></article>`).join('') + pipelineNote()}</div>
        <div class="flow-card"><span class="kicker">DATA FLOW</span><ol><li class="done"><i>${icon('check', 14)}</i><div><b>公开来源采集</b><small>URL、时间、可见指标</small></div></li><li class="done"><i>${icon('check', 14)}</i><div><b>批次校验与去重</b><small>坏批次隔离，原始证据保留</small></div></li><li class="done"><i>${icon('check', 14)}</i><div><b>SQLite 事务入库</b><small>人物、名场面与趋势可关联</small></div></li><li class="done"><i>${icon('check', 14)}</i><div><b>创意组合与评分</b><small>候选流水线已接通正式趋势库</small></div></li></ol></div>
      </div>
    </div>
  </section>
`

// 异步刷新：加载真实趋势后更新状态 pill 和渠道列表
const refreshRadar = async () => {
  const data = await loadTrendExport()
  if (!data) return
  const pill = document.querySelector('#radar-status-pill')
  if (pill) pill.innerHTML = `${icon('database', 16)} SQLite 正式库 · ${data.trend_count} 条已入库`
  const channelList = document.querySelector('#radar-channel-list')
  if (channelList) channelList.innerHTML = renderRadarChannels(data.trends) + pipelineNote()
}

// 挂载雷达 section：返回初始 HTML 后异步加载真实数据刷新
export const mountRadarSection = () => {
  refreshRadar().catch(() => {})
}
