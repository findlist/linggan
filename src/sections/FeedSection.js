// 今日推荐流：读取 approved 候选导出 JSON 并渲染。
// 前端不直接访问 SQLite，只消费只读 candidate-export.json；
// 无已批准候选时显示明确空状态，禁止展示待审或驳回内容。

import { icon } from '../ui/icons.js'
import { escapeHtml, formatScore } from '../ui/dom.js'
import { rightsLabels, riskLabels } from '../data/knowledge.js'
import { track } from '../data/tracker.ts'

// 加载已批准候选导出文档：双重路径兜底，避免 Vite dev 与 preview 路径差异导致读取失败
const loadCandidateExport = async () => {
  try {
    const response = await fetch('./data/candidate-export.json')
    if (!response.ok) {
      try {
        const fallback = await fetch('/data/candidate-export.json')
        if (fallback.ok) return await fallback.json()
      } catch {
        // fallback 路径失败时忽略，返回 null 让上层显示空状态
      }
      return null
    }
    const data = await response.json()
    if (data.schema_version !== 1) return null
    return data
  } catch {
    return null
  }
}

// 渲染单张候选卡片：包含序号、版权徽章、来源趋势、钩子和质量分
const renderCandidateCard = (candidate, index) => `<article class="feed-card">
  <div class="feed-index">${String(index + 1).padStart(2, '0')}</div>
  <span class="feed-badge">${icon('shield', 13)} ${rightsLabels[candidate.rights_status] ?? candidate.rights_status}</span>
  <h3>${escapeHtml(candidate.title)}</h3>
  <p class="feed-source">来源趋势 · ${escapeHtml(candidate.source_trend)}</p>
  <div class="feed-hook"><span>前三秒钩子</span><b>${escapeHtml(candidate.hook)}</b></div>
  <div class="feed-meta"><span>质量分 <strong>${formatScore(candidate.score.total)}</strong></span><span>${riskLabels[candidate.risk_level] ?? candidate.risk_level}</span><span>${candidate.generated_at.slice(0, 10)}</span></div>
</article>`

// 渲染今日推荐流：无数据时显示空状态说明，不放宽状态或编造指标
const renderCandidateFeed = (data) => {
  const feed = document.querySelector('#feed-grid')
  const pill = document.querySelector('#feed-status-pill')
  if (!feed) return
  if (!data || data.candidate_count === 0) {
    if (pill) pill.innerHTML = `${icon('database', 16)} 暂无已批准候选`
    feed.innerHTML = `<div class="feed-empty">${icon('sparkles', 24)}<p>暂无已批准的创意候选</p><small>候选生成并审核通过后，今日推荐流会在这里展示真实方案。当前展示内容均为已审核 approved 候选，不会出现待审或驳回内容。</small></div>`
    return
  }
  if (pill) pill.innerHTML = `${icon('check', 16)} ${data.candidate_count} 条已批准候选`
  feed.innerHTML = data.candidates.map(renderCandidateCard).join('')
  // D2 埋点：候选卡片渲染即曝光，记录 position 供后续漏斗分析（impression → opened → saved/copied）
  data.candidates.forEach((candidate, index) => {
    track('idea_impression', {
      ideaId: candidate.id,
      payload: { position: index + 1, source: 'feed', score: candidate.score.total },
    })
  })
}

// 挂载今日推荐流 section：异步加载导出文档并渲染，失败时显示空状态
export const mountFeedSection = () => {
  loadCandidateExport()
    .then((data) => renderCandidateFeed(data))
    .catch(() => renderCandidateFeed(null))
}
