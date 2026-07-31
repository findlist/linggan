// 通用 DOM 工具：把 escapeHtml / downloadText / toast 收敛到一处，
// 供所有 section 共享，避免重复实现和不一致的转义规则。

// HTML 转义：所有用户可见文本（标题、对白、字段值）输出前必须转义，避免 XSS 和渲染错位
export const escapeHtml = (value) =>
  String(value).replace(
    /[&<>'"]/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;',
      })[char],
  )

// 触发浏览器下载文本文件：用 Blob + 临时 a 标签 + URL.revokeObjectURL 释放
export const downloadText = (filename, content, mime) => {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

// 全局 toast：复用页面唯一 .toast 容器；连续触发时清除上一个计时器
let toastTimer = null
export const toast = (message) => {
  const element = document.querySelector('.toast')
  if (!element) return
  element.textContent = message
  element.classList.add('show')
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => element.classList.remove('show'), 2600)
}

// 分数格式化：非有限值显示破折号，避免 NaN / undefined 进入 UI
export const formatScore = (value) => (Number.isFinite(value) ? Math.round(value) : '—')
