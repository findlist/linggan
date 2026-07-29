const icon = (name, size = 20) => {
  const paths = {
    sparkles: '<path d="m12 3-1.4 3.6L7 8l3.6 1.4L12 13l1.4-3.6L17 8l-3.6-1.4L12 3Z"/><path d="m5 14-.8 2.2L2 17l2.2.8L5 20l.8-2.2L8 17l-2.2-.8L5 14Z"/><path d="m19 13-.6 1.4L17 15l1.4.6L19 17l.6-1.4L21 15l-1.4-.6L19 13Z"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/>',
    wand: '<path d="m15 4 5 5L8 21l-5-5L15 4Z"/><path d="m6 14 5 5M6 4V2M6 8v2M2 6h2M8 6h2M19 16v-2M19 20v2M16 18h-2M20 18h2"/>',
    bookmark: '<path d="M6 3h12v18l-6-4-6 4V3Z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    fire: '<path d="M12 22c4 0 7-2.9 7-7 0-3-1.5-5.4-4.4-7.5.1 2-1 3.4-2.2 4.2.2-3.4-1.9-6.8-5.1-9.7.2 4-2.3 6.1-2.3 10 0 5.2 3 10 7 10Z"/><path d="M9 18c0 2 1.3 4 3 4s3-1.4 3-3.3c0-1.5-.8-2.7-2.3-3.7.1 1-.4 1.7-1 2.1.1-1.7-.9-2.8-2.2-4.1.1 2-0.5 3.1-0.5 5Z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    shield: '<path d="M12 3 4 6v5c0 5 3.4 8.4 8 10 4.6-1.6 8-5 8-10V6l-8-3Z"/><path d="m9 12 2 2 4-4"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>'
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`
}

const ideas = [
  { id: 1, badge: '今日热榜', title: '宿敌被迫经营一家深夜拉面铺', desc: '把高燃对决换成厨房协作：两位宿敌必须在打烊前完成 100 碗拉面。', tags: ['宿敌关系', '经营反差', '30秒'], heat: 96, color: 'violet', scene: '拉面铺', role: '热血宿敌', hook: '最后一碗，决定谁才是真正的“面之王”。' },
  { id: 2, badge: '反差感', title: '冷酷剑客第一次参加村口台球赛', desc: '出招即出杆，必杀技变成清台镜头，严肃角色说出生活化台词。', tags: ['动作喜剧', '体育', '20秒'], heat: 91, color: 'blue', scene: '村口台球厅', role: '冷酷剑客', hook: '他拔杆的瞬间，整个台球厅安静了。' },
  { id: 3, badge: '易生成', title: '四位魔法学徒开会复盘团建事故', desc: '用职场纪录片结构复盘一场魔法失控，角色轮流面对镜头甩锅。', tags: ['伪纪录片', '职场梗', '45秒'], heat: 88, color: 'orange', scene: '魔法会议室', role: '冒失学徒', hook: '这不是爆炸，是一次可控的能量释放。' },
  { id: 4, badge: '可连载', title: '末日小队在超市争夺最后一包薯片', desc: '宏大末日氛围与微小目标碰撞，每位队员都有一本正经的理由。', tags: ['末日反差', '群像', '30秒'], heat: 84, color: 'pink', scene: '废墟超市', role: '末日小队', hook: '人类文明最后的希望，只剩番茄味。' }
]

const app = document.querySelector('#app')
app.innerHTML = `
  <header class="topbar">
    <nav class="nav shell" aria-label="主导航">
      <a class="brand" href="#" aria-label="灵感首页"><span class="brand-mark">${icon('sparkles', 22)}</span><span>灵感</span><small>LINGGAN</small></a>
      <div class="nav-links">
        <a class="active" href="#discover">发现灵感</a><a href="#mixer">创意组合器</a><a href="#workflow">创作工作台</a>
      </div>
      <div class="nav-actions"><button class="icon-btn" aria-label="查看收藏">${icon('bookmark')}</button><button class="btn secondary">登录</button><button class="btn primary">免费开始</button></div>
      <button class="menu-btn" aria-expanded="false" aria-label="打开菜单">${icon('menu')}</button>
    </nav>
  </header>
  <main id="main">
    <section class="hero shell" id="discover">
      <div class="hero-copy">
        <div class="eyebrow"><span class="pulse"></span> 每日更新 AI 视频创意</div>
        <h1>一个念头，<br><span>长成一支好视频。</span></h1>
        <p>把热点、角色原型与经典叙事重新组合。几分钟获得创意、分镜、提示词和发布文案。</p>
        <div class="search-box">
          <div class="search-input">${icon('search')}<input aria-label="描述你的初步想法" placeholder="试试：几个动漫风格角色一起打台球……" /></div>
          <button class="btn primary generate">生成灵感 ${icon('sparkles',18)}</button>
        </div>
        <div class="quick"><span>试试这些：</span><button>名场面反转</button><button>角色跨界</button><button>今日热梗</button></div>
      </div>
      <div class="hero-visual" aria-label="创意方案预览">
        <div class="orb orb-one"></div><div class="orb orb-two"></div>
        <article class="preview-card">
          <div class="preview-top"><span>正在生长的灵感</span><span class="live"><i></i> LIVE</span></div>
          <div class="poster violet"><span class="poster-label">场景 03 · 高潮</span><div class="silhouette one"></div><div class="silhouette two"></div><strong>最后一杆<br>决定胜负</strong></div>
          <div class="preview-info"><span class="step">03</span><div><b>子弹时间清台</b><p>镜头环绕主角，球杆挥动形成能量轨迹……</p></div></div>
          <div class="timeline"><i></i><i class="on"></i><i class="on"></i><i></i><i></i></div>
        </article>
        <div class="float-chip chip-a">${icon('wand',16)} 6 镜头分镜</div><div class="float-chip chip-b">${icon('copy',16)} 提示词已就绪</div>
      </div>
    </section>

    <section class="ideas-section shell">
      <div class="section-head"><div><span class="kicker">TRENDING TODAY</span><h2>今天，大家在想什么？</h2><p>经过可视化与生成难度筛选，不只是热搜搬运。</p></div><button class="text-btn">查看全部灵感 ${icon('arrow',18)}</button></div>
      <div class="filter-row" role="group" aria-label="灵感分类"><button class="filter active" data-filter="all">全部</button><button class="filter" data-filter="角色跨界">角色跨界</button><button class="filter" data-filter="名场面">名场面重构</button><button class="filter" data-filter="热梗">当日热梗</button><button class="filter" data-filter="连载">可连载</button></div>
      <div class="idea-grid">${ideas.map(idea => `
        <article class="idea-card" data-title="${idea.title}">
          <div class="idea-art ${idea.color}"><span class="idea-badge">${idea.badge}</span><button class="save-btn" aria-label="收藏${idea.title}">${icon('bookmark',19)}</button><div class="art-lines"></div><span class="heat">${icon('fire',15)} 热度 ${idea.heat}</span></div>
          <div class="idea-body"><h3>${idea.title}</h3><p>${idea.desc}</p><div class="tags">${idea.tags.map(t=>`<span>${t}</span>`).join('')}</div><button class="open-idea" data-id="${idea.id}">展开完整方案 ${icon('arrow',17)}</button></div>
        </article>`).join('')}</div>
    </section>

    <section class="mixer shell" id="mixer">
      <div class="mixer-copy"><span class="kicker">IDEA MIXER</span><h2>不等灵感，<br>现在就把它组合出来。</h2><p>选择四块创意积木，让系统完成一次有逻辑的碰撞，而不是随机拼接。</p><ul><li>${icon('shield',18)} 自动检查可生成性与版权风险</li><li>${icon('clock',18)} 约 30 秒生成完整制作包</li></ul></div>
      <div class="mixer-panel">
        <div class="mix-field"><label for="role">角色原型</label><select id="role"><option>冷酷剑客</option><option>热血宿敌</option><option>冒失魔法学徒</option><option>末日生存小队</option></select></div>
        <span class="plus">+</span><div class="mix-field"><label for="scene">发生场景</label><select id="scene"><option>村口台球厅</option><option>深夜拉面铺</option><option>公司会议室</option><option>废墟超市</option></select></div>
        <span class="plus">+</span><div class="mix-field"><label for="tone">叙事味道</label><select id="tone"><option>一本正经的荒诞</option><option>热血反转</option><option>伪纪录片</option><option>温柔治愈</option></select></div>
        <button class="btn primary mix-button">碰撞一下 ${icon('sparkles',18)}</button>
      </div>
    </section>
  </main>
  <footer><div class="shell footer-inner"><a class="brand" href="#"><span class="brand-mark">${icon('sparkles',18)}</span><span>灵感</span></a><p>让每个念头，都有成为作品的机会。</p><span>原创原型优先 · 尊重创作版权</span></div></footer>
  <div class="modal-backdrop" aria-hidden="true"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button class="modal-close" aria-label="关闭方案">${icon('close')}</button><span class="kicker">完整制作包</span><h2 id="modal-title"></h2><p class="modal-desc"></p><div class="plan-grid"><div><span>角色</span><b id="plan-role"></b></div><div><span>场景</span><b id="plan-scene"></b></div><div class="wide"><span>前三秒钩子</span><b id="plan-hook"></b></div></div><h3>30 秒结构</h3><ol class="shots"><li><span>00–03s</span>反常画面直接出现，角色进入场景</li><li><span>03–12s</span>建立冲突，第一次尝试以失败告终</li><li><span>12–24s</span>角色用标志性方式解决问题</li><li><span>24–30s</span>反转收尾，留下可连载的悬念</li></ol><button class="btn primary copy-plan">${icon('copy',18)} 复制完整提示词</button><p class="risk">${icon('shield',16)} 建议使用原创角色原型；公开发布前请确认素材授权。</p></section></div>
  <div class="toast" role="status" aria-live="polite"></div>
`

const toast = (message) => {
  const el = document.querySelector('.toast'); el.textContent = message; el.classList.add('show');
  clearTimeout(window.toastTimer); window.toastTimer = setTimeout(() => el.classList.remove('show'), 2800)
}

document.querySelector('.menu-btn').addEventListener('click', (e) => {
  const nav = document.querySelector('.nav-links'); nav.classList.toggle('open');
  const open = nav.classList.contains('open'); e.currentTarget.setAttribute('aria-expanded', open); e.currentTarget.innerHTML = icon(open ? 'close' : 'menu')
})
document.querySelectorAll('.save-btn').forEach(btn => btn.addEventListener('click', () => { btn.classList.toggle('saved'); toast(btn.classList.contains('saved') ? '已收藏这条灵感' : '已取消收藏') }))
document.querySelectorAll('.filter').forEach(btn => btn.addEventListener('click', () => { document.querySelectorAll('.filter').forEach(x=>x.classList.remove('active')); btn.classList.add('active'); toast(`正在展示：${btn.textContent}`) }))
document.querySelectorAll('.open-idea').forEach(btn => btn.addEventListener('click', () => {
  const data = ideas.find(x => x.id === Number(btn.dataset.id));
  document.querySelector('#modal-title').textContent = data.title; document.querySelector('.modal-desc').textContent = data.desc; document.querySelector('#plan-role').textContent = data.role; document.querySelector('#plan-scene').textContent = data.scene; document.querySelector('#plan-hook').textContent = data.hook;
  const back = document.querySelector('.modal-backdrop'); back.classList.add('open'); back.setAttribute('aria-hidden','false'); document.querySelector('.modal-close').focus()
}))
const closeModal = () => { const b=document.querySelector('.modal-backdrop'); b.classList.remove('open'); b.setAttribute('aria-hidden','true') }
document.querySelector('.modal-close').addEventListener('click', closeModal)
document.querySelector('.modal-backdrop').addEventListener('click', e => { if(e.target === e.currentTarget) closeModal() })
document.addEventListener('keydown', e => { if(e.key === 'Escape') closeModal() })
document.querySelector('.copy-plan').addEventListener('click', async () => { await navigator.clipboard?.writeText(document.querySelector('.modal').innerText); toast('制作方案已复制') })
document.querySelector('.generate').addEventListener('click', () => { const input=document.querySelector('.search-input input'); toast(input.value.trim() ? '已根据你的想法生成 4 个方向' : '先描述一个初步想法吧'); if(input.value.trim()) document.querySelector('.ideas-section').scrollIntoView({behavior:'smooth'}) })
document.querySelector('.mix-button').addEventListener('click', () => { const role=document.querySelector('#role').value, scene=document.querySelector('#scene').value, tone=document.querySelector('#tone').value; toast(`已碰撞：${role} × ${scene} × ${tone}`) })
