// 灵感前端入口：渲染整体页面布局、初始化各 section 和详情视图、绑定全局事件。
// 各 section 的具体行为（生成、筛选、收藏、雷达刷新等）封装在 src/sections/ 下，
// 共享状态通过 src/data/store.js 集中管理，共享依赖通过 ctx 注入避免循环依赖。

import { icon } from './ui/icons.js'
import { setSaved } from './data/store.js'
import { knowledge, workById, characterById, mediaNames, rightsLabels, riskLabels } from './data/knowledge.js'
import { escapeHtml } from './ui/dom.js'
import { createDetailView } from './detail-view.js'
import { renderHero } from './sections/Hero.js'
import { renderRadarSection, mountRadarSection } from './sections/RadarSection.js'
import { mountFeedSection } from './sections/FeedSection.js'
import { renderRemixWorkbench, mountRemixWorkbench } from './sections/RemixWorkbench.js'
import { renderLibrarySection, mountLibrarySection } from './sections/LibrarySection.js'
import { renderSavedSection, mountSavedList } from './sections/SavedList.js'
import { renderEventSyncButton, mountEventSyncBar } from './sections/EventSyncBar.js'
import './radar.css'

const app = document.querySelector('#app')

// 渲染整体布局：顶栏 + Hero + 今日推荐 + 雷达 + 工作台 + 素材库 + 收藏 + 页脚 + toast 容器
app.innerHTML = `
  <header class="topbar">
    <nav class="nav shell" aria-label="主导航">
      <a class="brand" href="#top"><span class="brand-mark">${icon('sparkles', 21)}</span><span>灵感</span><small>LINGGAN LAB</small></a>
      <div class="nav-links"><a href="#feed">今日推荐</a><a href="#radar">热点雷达</a><a href="#remix">跨界混搭</a><a href="#library">素材库</a></div>
      <div class="nav-status"><i></i><span>采集与 SQLite 入库已连接</span></div>
      ${renderEventSyncButton()}
      <button class="menu-button" aria-label="打开导航" aria-expanded="false">${icon('menu')}</button>
    </nav>
  </header>
  <main id="main">
    ${renderHero()}
    <section class="feed-section" id="feed">
      <div class="shell">
        <div class="section-title"><div><span class="kicker">TODAY'S PICKS</span><h2>今日推荐</h2><p>只展示已审核通过的持久化候选，待审、驳回或归档内容不会出现在这里。</p></div><span class="system-pill" id="feed-status-pill">${icon('database', 16)} 读取中</span></div>
        <div class="feed-grid" id="feed-grid"><div class="feed-empty">${icon('sparkles', 24)}<p>正在加载今日推荐...</p></div></div>
      </div>
    </section>
    ${renderRadarSection(null)}
    ${renderRemixWorkbench()}
    ${renderLibrarySection()}
    ${renderSavedSection()}
  </main>
  <footer><div class="shell footer-inner"><a class="brand" href="#top"><span class="brand-mark">${icon('sparkles', 18)}</span><span>灵感</span></a><p>公开来源留证 · 参考资产隔离 · 原创表达优先</p><span>Linggan Remix Lab</span></div></footer>
  <div class="toast" role="status" aria-live="polite"></div>
`

// 移动端菜单按钮：点击展开 / 收起导航链接
document.querySelector('.menu-button').addEventListener('click', (event) => {
  const links = document.querySelector('.nav-links')
  links.classList.toggle('open')
  const open = links.classList.contains('open')
  event.currentTarget.setAttribute('aria-expanded', String(open))
  event.currentTarget.innerHTML = icon(open ? 'close' : 'menu')
})

// 先挂载收藏列表，得到 renderSaved 函数；工作台需要通过 ctx.renderSaved 通知列表刷新
const savedListApi = mountSavedList({})

// 工作台 ctx：setSaved 用于收藏写入并同步 localStorage；renderSaved 通知列表刷新
const workbenchApi = mountRemixWorkbench({
  setSaved,
  renderSaved: () => savedListApi.renderSaved(),
})

// 详情视图：在 body 末尾挂载弹窗；点击素材库卡片后打开，提供"开始创作"入口
// 通过 ctx 注入工作台的 applyToRemix，避免 DetailView 与 RemixWorkbench 互相 import
// createDetailView 返回 { open, close }，直接传给素材库的 ctx 复用
const detailView = createDetailView({
  knowledge,
  workById,
  characterById,
  mediaNames,
  rightsLabels,
  riskLabels,
  icon,
  escapeHtml,
  onApplyToRemix: workbenchApi.applyToRemix,
})

// 素材库 ctx：detailView 是详情视图实例，卡片点击时调用 detailView.open 打开弹窗
mountLibrarySection({ detailView })

// 雷达 section：异步加载真实趋势数据后刷新状态 pill 和渠道列表
mountRadarSection()

// 今日推荐流：异步加载 approved 候选导出文档并渲染
mountFeedSection()

// D2 事件同步条：挂载"导出事件"按钮，把 localStorage 事件队列导出为 event-inbox 兼容 JSON
mountEventSyncBar()
