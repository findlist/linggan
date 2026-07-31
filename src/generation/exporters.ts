import type { RemixPlan } from './remix-engine.ts'

/**
 * 导出器把跨作品混搭方案序列化为可分享、可归档的文档格式。
 * - Markdown 面向人类阅读，含完整字段和版权边界；
 * - JSON 面向机器消费，结构化保存完整 RemixPlan 字段，便于重新加载或外部工具处理。
 * 两个函数都是纯函数：同一输入必然得到同一输出，便于单元测试。
 */

/** 把字符串中的管道符和换行符转义，避免破坏 Markdown 表格结构。 */
const escapeTableCell = (value: string): string =>
  String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')

/** 生成人类可读的 Markdown 文档，包含方案的全部字段和版权边界说明。 */
export const buildRemixMarkdown = (plan: RemixPlan): string => {
  const lines: string[] = []
  lines.push(`# ${plan.title}`, '')
  lines.push(`> 时长 ${plan.duration}s · 钩子类型 ${plan.hookCategory} · 方案 ID \`${plan.id}\``, '')
  lines.push('## 概念', plan.concept, '')
  lines.push('## 前三秒钩子', `> ${plan.hook}`, '')
  lines.push('## 分镜')
  lines.push('| # | 时长 | 画面 | 动作 | 情绪 |')
  lines.push('|---|---|---|---|---|')
  for (const shot of plan.storyboard) {
    lines.push(
      `| ${shot.index} | ${shot.duration}s | ${escapeTableCell(shot.visual)} | ${escapeTableCell(shot.action)} | ${escapeTableCell(shot.emotion)} |`
    )
  }
  lines.push('')
  lines.push('## 对白（原创改写）')
  lines.push(`- 角色A：${plan.dialogueA}`)
  lines.push(`- 角色B：${plan.dialogueB}`, '')
  lines.push('## 发布文案')
  lines.push('### 标题候选')
  for (const title of plan.copywriting.titles) lines.push(`- ${title}`)
  lines.push('', '### 描述', plan.copywriting.description, '')
  lines.push('### 标签', plan.copywriting.hashtags.join(' '), '')
  lines.push('## 画面提示词', plan.prompt, '')
  lines.push('## 版权边界')
  lines.push(
    '参考角色和名场面仅作结构与性格参考，不包含精确复刻素材；商业发布前需替换为原创或已授权资产。'
  )
  lines.push('', '---', `由灵感 Linggan 跨作品混搭实验室生成`)
  return lines.join('\n')
}

/** 生成机器可读的 JSON 文档，结构化保存完整 RemixPlan 字段。 */
export const buildRemixJson = (plan: RemixPlan): string =>
  JSON.stringify(plan, null, 2)

/** 生成下载文件名（不含扩展名），格式：linggan-remix-{plan.id}。 */
export const buildRemixFileName = (plan: RemixPlan): string =>
  `linggan-remix-${plan.id}`
