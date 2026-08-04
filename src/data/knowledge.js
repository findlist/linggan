// 知识库读取层：集中管理 knowledge-base.json 的导入、查找表构建和标签映射。
// 把原本散落在 main.js 顶层的 knowledge/workById/characterById/常量收敛到一处，
// 供所有 section 通过同一份 ctx 引用，避免重复 import 和不一致风险。

import knowledge from '../../data/knowledge-base.json'

// 按 ID 查询的辅助表，构建一次供多处复用
export const workById = new Map(knowledge.works.map(work => [work.id, work]))
export const characterById = new Map(knowledge.known_characters.map(character => [character.id, character]))

// 媒介类型中文标签：用于作品卡片、详情视图、筛选器维度值显示
export const mediaNames = {
  television: '电视剧',
  anime: '动漫',
  film: '电影',
  game: '游戏',
  variety: '综艺'
}

// 版权 / 风险 / 分类 / 生命周期中文标签
export const rightsLabels = {
  original: '原创',
  licensed: '已授权',
  public_domain: '公共领域',
  reference_only: '仅参考',
  unknown: '版权未知',
  restricted: '受限'
}

export const riskLabels = {
  low: '低风险',
  medium: '中风险',
  high: '高风险',
  blocked: '阻断'
}

export const categoryLabels = {
  meme: '热梗',
  expression: '表情包',
  television: '电视剧',
  anime: '动漫',
  film: '电影',
  game: '游戏',
  variety: '综艺',
  character: '角色',
  video_format: '视频形式',
  creator_demand: '创作者需求',
  festival: '节日',
  sports: '体育',
  cultural_event: '文化事件'
}

export const lifecycleLabels = {
  emerging: '萌芽期',
  rising: '上升期',
  peak: '峰值期',
  declining: '回落期',
  evergreen: '常青',
  archived: '已归档'
}

// 跨作品混搭工作台使用的风格候选与性格 / 钩子 / 分镜字段中文标签
export const remixStyles = [
  { id: 'cinematic', label: '电影感热血', prompt: '克制写实光影、宽银幕构图、逐步升级的群像调度' },
  { id: 'absurd', label: '一本正经的荒诞', prompt: '严肃表演处理微小目标，反差来自角色态度而非恶搞造型' },
  { id: 'animation', label: '国风动画', prompt: '原创东方幻想视觉、粒子化气流、清晰动作轮廓与留白' },
  { id: 'mockumentary', label: '伪纪录片', prompt: '手持跟拍、角色采访、证词冲突与监控式反转' },
  { id: 'cyberpunk_neon', label: '赛博朋克霓虹', prompt: '高饱和霓虹色温、雨夜街头反光、全息投影叠层与低角度仰拍' },
  { id: 'ink_wash', label: '古风水墨写意', prompt: '水墨晕染过渡、留白构图、毛笔笔触转场与淡彩点染' },
  { id: 'vlog', label: 'Vlog 日常感', prompt: '自然光手持自拍视角、生活化场景调度、轻快跳切与字幕贴纸' },
  { id: 'suspense_twist', label: '悬疑反转', prompt: '低调高对比打光、紧凑特写剪辑、信息误导构图与声画错位' }
]

export const personalityLabels = { cold: '冷酷型', hot: '热血型', cunning: '腹黑型', gentle: '温柔型' }
export const hookCategoryLabels = { suspense: '悬念', contrast: '反差', question: '提问', action: '行动' }
// C2 分镜新字段的中文标签：景别 / 运镜 / 转场，用于右栏完整制作包展示
export const shotTypeLabels = { extreme_close_up: '大特写', close_up: '特写', medium: '中景', full: '全景', wide: '远景' }
export const cameraMovementLabels = { fixed: '固定', push: '推', pull: '拉', pan: '摇', tilt: '俯仰', tracking: '跟拍' }
export const transitionLabels = { cut: '切', dissolve: '溶', fade: '淡变', match_cut: '匹配剪辑' }

export { knowledge }
