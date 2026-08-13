import type { RemixPlan } from './remix-engine.ts'

/**
 * 导出器把跨作品混搭方案序列化为可分享、可归档的文档格式。
 * - Markdown 面向人类阅读，含完整字段和版权边界；
 * - JSON 面向机器消费，结构化保存完整 RemixPlan 字段，便于重新加载或外部工具处理。
 * 两个函数都是纯函数：同一输入必然得到同一输出，便于单元测试。
 */

/** 把字符串中的管道符和换行符转义，避免破坏 Markdown 表格结构。 */
const escapeTableCell = (value: string): string => String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')

/** 生成人类可读的 Markdown 文档，包含方案的全部字段和版权边界说明。 */
export const buildRemixMarkdown = (plan: RemixPlan): string => {
  const lines: string[] = []
  lines.push(`# ${plan.title}`, '')
  // 叙事模板名称存在时加入元信息行，便于导出文档追溯叙事结构
  const patternMeta = plan.storyPatternName ? ` · 叙事模板 ${plan.storyPatternName}` : ''
  lines.push(`> 时长 ${plan.duration}s · 钩子类型 ${plan.hookCategory}${patternMeta} · 方案 ID \`${plan.id}\``, '')
  lines.push('## 概念', plan.concept, '')
  lines.push('## 前三秒钩子', `> ${plan.hook}`, '')
  lines.push('## 分镜')
  // C2：分镜表增加景别、运镜、转场三列，覆盖制作所需字段
  lines.push('| # | 时长 | 景别 | 运镜 | 画面 | 动作 | 情绪 | 转场 |')
  lines.push('|---|---|---|---|---|---|---|---|')
  for (const shot of plan.storyboard) {
    lines.push(
      `| ${shot.index} | ${shot.duration}s | ${shot.shot_type} | ${shot.camera_movement} | ${escapeTableCell(shot.visual)} | ${escapeTableCell(shot.action)} | ${escapeTableCell(shot.emotion)} | ${shot.transition} |`,
    )
  }
  lines.push('')
  lines.push('## 对白（原创改写）')
  lines.push(`- 角色A：${plan.dialogueA}`)
  lines.push(`- 角色B：${plan.dialogueB}`, '')
  lines.push('## 发布文案')
  lines.push('### 标题候选')
  for (const title of plan.copywriting.titles) lines.push(`- ${title}`)
  lines.push('', '### 封面文案', `> ${plan.copywriting.cover_copy}`, '')
  lines.push('### 描述', plan.copywriting.description, '')
  lines.push('### 标签', plan.copywriting.hashtags.join(' '), '')
  // C2：结构化画面提示词，正向/负面/比例/风格强度
  const { prompts } = plan.production
  lines.push('## 画面提示词')
  lines.push(`**正向：** ${escapeTableCell(prompts.positive)}`, '')
  lines.push(`**负面：** ${escapeTableCell(prompts.negative)}`, '')
  lines.push(`**画面比例：** ${prompts.aspect_ratio} · **风格强度：** ${prompts.style_strength}`, '')
  lines.push('## 提示词摘要', plan.prompt, '')
  // C2：结构化版权边界声明，替代原硬编码文字
  const { copyright_boundary: cb } = plan.production
  lines.push('## 版权边界')
  lines.push(`- **参考状态：** ${escapeTableCell(cb.reference_status)}`)
  lines.push(`- **商用限制：** ${escapeTableCell(cb.commercial_use)}`)
  lines.push(`- **改写范围：** ${escapeTableCell(cb.rewrite_scope)}`)
  lines.push('', '---', `由灵感 Linggan 跨作品混搭实验室生成`)
  return lines.join('\n')
}

/** 生成机器可读的 JSON 文档，结构化保存完整 RemixPlan 字段。 */
export const buildRemixJson = (plan: RemixPlan): string => JSON.stringify(plan, null, 2)

/** 生成下载文件名（不含扩展名），格式：linggan-remix-{plan.id}。 */
export const buildRemixFileName = (plan: RemixPlan): string => `linggan-remix-${plan.id}`
