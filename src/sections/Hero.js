// Hero 区：首屏视觉与统计行，纯静态 HTML，无事件绑定。
// 把 main.js 中嵌入首屏的 hero HTML 抽出，便于后续独立调整首屏文案与布局。

import { icon } from '../ui/icons.js'
import { knowledge } from '../data/knowledge.js'

// 渲染首屏：左侧文案 + 统计行；右侧示意化角色 / 名场面卡片
export const renderHero = () => `
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
`
