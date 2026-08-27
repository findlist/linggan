// SVG 图标库：把原本散落在 main.js 内联的 icon paths 集中到一处，
// 供所有 section 通过同一份 ctx.icon 引用，保证图标风格统一。

const paths = {
  sparkles:
    '<path d="m12 3-1.4 3.6L7 8l3.6 1.4L12 13l1.4-3.6L17 8l-3.6-1.4L12 3Z"/><path d="m5 14-.8 2.2L2 17l2.2.8L5 20l.8-2.2L8 17l-2.2-.8L5 14Z"/>',
  radar: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 12 19 5M12 3v2M3 12h2M12 19v2"/>',
  database:
    '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
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
  check: '<path d="m5 12 4 4L19 6"/>',
  // 历史记录：时钟 + 逆时针箭头，与收藏的 bookmark 区分
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
  // 生成中加载：不闭合的圆弧，配合 CSS 旋转动画形成 spinner
  loader: '<path d="M21 12a9 9 0 1 1-9-9"/>',
}

// 渲染一个带 stroke 的 SVG 图标；未知图标回退到 sparkles，避免页面空白
export const icon = (name, size = 20) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.sparkles}</svg>`
