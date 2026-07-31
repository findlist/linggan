import type {
  IconicMoment,
  KnownCharacter,
  Work
} from '../data/contracts.ts'

/**
 * 生成引擎负责把跨作品角色 × 名场面 × 风格 × 时长组合成完整创意方案。
 * 所有随机选择都来自显式种子的确定性 PRNG，同一输入与种子必须得到完全相同输出，
 * 以满足 B2 验收条件中的固定种子复现与钩子唯一率要求。
 */

export type PersonalityType = 'cold' | 'hot' | 'cunning' | 'gentle'
export type HookCategory = 'suspense' | 'contrast' | 'question' | 'action'
export type RemixDuration = 15 | 30 | 60

export interface RemixStyle {
  id: string
  label: string
  prompt: string
}

export interface RemixPlanInput {
  characterA: KnownCharacter
  characterB: KnownCharacter
  moment: IconicMoment
  workA: Work
  workB: Work
  momentWork: Work
  style: RemixStyle
  duration: RemixDuration
  /** 显式种子字符串，同一字符串必须产生同一方案 */
  seed: string
}

export interface StoryboardShot {
  index: number
  duration: number
  visual: string
  action: string
  emotion: string
}

export interface RemixCopywriting {
  titles: string[]
  description: string
  hashtags: string[]
}

export interface RemixPlan {
  id: string
  title: string
  concept: string
  hook: string
  hookCategory: HookCategory
  personalityA: PersonalityType
  personalityB: PersonalityType
  dialogueA: string
  dialogueB: string
  storyboard: StoryboardShot[]
  copywriting: RemixCopywriting
  prompt: string
  duration: RemixDuration
}

/* ----------------------------- 确定性随机工具 ----------------------------- */

/**
 * FNV-1a 32 位字符串哈希。用 Math.imul 保证 32 位整数乘法在所有 JS 运行时一致，
 * 避免依赖位运算溢出实现的 hash 在不同平台产生不同种子。
 */
const hashStringToSeed = (input: string): number => {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** mulberry32 PRNG：接受 uint32 种子，返回 [0,1) 的确定序列。 */
const createPrng = (seed: number): (() => number) => {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pick = <T>(items: readonly T[], rng: () => number): T =>
  items[Math.floor(rng() * items.length)] ?? items[0]

/* ------------------------------- 钩子模板 ------------------------------- */
// 4 类各 6 个，共 24 个模板。占位符：{A}/{B}=角色名，{E}=元素焦点，{X}=动作线索。
// 模板只描述结构，不复刻任何原作台词。

export const HOOK_TEMPLATES: Record<HookCategory, string[]> = {
  suspense: [
    '所有人以为这只是{E}，直到{A}认真起来。',
    '没人注意到，{B}早在三步之前就已经落子。',
    '直到最后一秒，{A}才亮出真正的底牌。',
    '谁也没想到，{E}会成为压垮秩序的最后一块拼图。',
    '表面上是一次{X}，真相却藏在{B}的沉默里。',
    '真相在{B}开口之前就已经定局。'
  ],
  contrast: [
    '还在计算退路，{B}已经把最后一道防线点亮。',
    '本以为是硬碰硬，结果{A}用一句话改写了规则。',
    '{A}不动声色，{B}却已按下整张地图的反转键。',
    '所有人都准备正面强攻，{A}却问：谁规定缺口一定在正面？',
    '看起来是退让，{B}其实把对手引进了自己设好的节奏。',
    '所有人都以为{A}会妥协，{A}却把选项压缩到只剩一个。'
  ],
  question: [
    '如果{E}不再受规则约束，会怎样？',
    '为什么没人想过，让{A}和{B}站在同一边？',
    '当秩序失效，谁还愿意守最后一道线？',
    '{A}凭什么相信，这一次{B}不会转身离开？',
    '如果只剩一次机会，你会先保人还是先破局？',
    '当{A}选择沉默，谁还敢替{B}做决定？'
  ],
  action: [
    '第一步：把{E}变成所有人的焦点。',
    '不废话，{A}先掀桌。',
    '直接干。{B}已经替所有人决定了开场。',
    '先动手再说，{A}用行动回应所有质疑。',
    '不解释，不犹豫，{B}把退路全部封死。',
    '不犹豫，{A}把第一步踩成整个场面的支点。'
  ]
}

/** 性格 → 偏好的钩子类别。性格驱动钩子选择，满足“按角色性格选择”要求。 */
const PERSONALITY_HOOK_BIAS: Record<PersonalityType, HookCategory[]> = {
  cold: ['suspense', 'question'],
  hot: ['action', 'contrast'],
  cunning: ['suspense', 'contrast'],
  gentle: ['question', 'action']
}

const fillHook = (template: string, ctx: HookContext): string =>
  template
    .replaceAll('{A}', ctx.nameA)
    .replaceAll('{B}', ctx.nameB)
    .replaceAll('{E}', ctx.focus)
    .replaceAll('{X}', ctx.actionCue)

interface HookContext {
  nameA: string
  nameB: string
  focus: string
  actionCue: string
}

/** 时长影响钩子类别权重：短时长偏好行动/反差以快速抓人，长时长可容纳悬念/提问。 */
const durationHookBias: Record<RemixDuration, HookCategory[]> = {
  15: ['action', 'contrast'],
  30: ['contrast', 'suspense', 'question', 'action'],
  60: ['suspense', 'question', 'contrast', 'action']
}

const buildHook = (
  personalityA: PersonalityType,
  duration: RemixDuration,
  ctx: HookContext,
  rng: () => number
): { text: string; category: HookCategory } => {
  // 合并性格偏好与时长偏好，取交集优先，无交集时回退到性格偏好
  const personalityBias = PERSONALITY_HOOK_BIAS[personalityA]
  const durationBias = durationHookBias[duration]
  const intersection = personalityBias.filter(category => durationBias.includes(category))
  const effectiveCategories = intersection.length > 0 ? intersection : personalityBias
  // 从候选类别的全部模板合并池中选择，扩大选择空间，避免同性格组合钩子高度雷同
  const pool: { category: HookCategory; template: string }[] = []
  for (const category of effectiveCategories) {
    for (const template of HOOK_TEMPLATES[category]) {
      pool.push({ category, template })
    }
  }
  const chosen = pick(pool, rng)
  return { text: fillHook(chosen.template, ctx), category: chosen.category }
}

/* ----------------------------- 性格检测 ----------------------------- */
// 从知识库角色的 character_types/traits/dialogue_style 关键词推断 4 种性格之一。
// 关键词基于 docs/DEVELOPMENT_DIRECTION.md 5.2 节的性格定义。

const PERSONALITY_KEYWORDS: Record<PersonalityType, string[]> = {
  cold: ['冷静', '短句', '判断', '代价', '最坏', '果决', '克制', '冷酷', '冷静陈述', '孤绝', '坚忍'],
  hot: ['热血', '承诺', '行动', '激情', '直率', '冲动', '成长', '挑战', '热血', '勇猛', '爆发'],
  cunning: ['含蓄', '试探', '礼貌', '施压', '转折', '肯定', '暗示', '谋略', '隐忍', '善谋', '腹黑', '心机'],
  gentle: ['平静', '安定', '温和', '温柔', '细致', '守护', '稳定', '安抚', '包容', '支点']
}

const detectPersonality = (character: KnownCharacter): PersonalityType => {
  const haystack = [
    ...character.character_types,
    ...character.traits,
    ...character.dialogue_style
  ].join('')

  let best: PersonalityType = 'cold'
  let bestScore = 0
  for (const type of Object.keys(PERSONALITY_KEYWORDS) as PersonalityType[]) {
    const score = PERSONALITY_KEYWORDS[type].reduce(
      (count, keyword) => (haystack.includes(keyword) ? count + 1 : count),
      0
    )
    if (score > bestScore) {
      bestScore = score
      best = type
    }
  }
  // 全部未命中时用角色 id 稳定回退，避免不同未匹配角色总返回同一类型
  if (bestScore === 0) {
    const fallbackIndex = hashStringToSeed(character.id) % 4
    return (['cold', 'hot', 'cunning', 'gentle'] as const)[fallbackIndex]
  }
  return best
}

/* --------------------------- 性格驱动对白 --------------------------- */
// 每种性格多个模板，模板引用角色 dialogue_style 的风格线索，实现“从 dialogue_style 派生”。
// 对白为原创改写，不复刻原作台词。

const DIALOGUE_TEMPLATES: Record<PersonalityType, string[]> = {
  cold: [
    '“{style}。最坏的结果我先说：{cost}。能接受就动。”',
    '“别绕。{style}。我们只做胜算最高的那一步。”',
    '“{style}。退路我已经算过，没有。”'
  ],
  hot: [
    '“你只管打开缺口，剩下的我来扛。{style}——我说到做到。”',
    '“{style}。如果今天只能做一件事，那就把这一件做到没有人能忽视。”',
    '“别问我怕不怕。{style}。行动会比质疑先到。”'
  ],
  cunning: [
    '“你说的我都认。{style}。不过先把界限讲清楚，对你我都好。”',
    '“{style}。这件事我不拦你，只是替你把代价摆到台面上。”',
    '“可以。{style}。但我有一个条件——听完再决定。”'
  ],
  gentle: [
    '“先别急。{style}。我们在，局面就不会失控。”',
    '“{style}。你先稳住，能走的那一步我替你想好了。”',
    '“没事。{style}。剩下的交给我，你只需要往前。”'
  ]
}

const buildDialogue = (
  personality: PersonalityType,
  character: KnownCharacter,
  costCue: string,
  rng: () => number
): string => {
  const template = pick(DIALOGUE_TEMPLATES[personality], rng)
  const style = pick(character.dialogue_style, rng)
  return template.replaceAll('{style}', style).replaceAll('{cost}', costCue)
}

/* ----------------------------- 分镜生成 ----------------------------- */
// 按时长输出 15s(3 镜头)/30s(5 镜头)/60s(8 镜头)，每镜头含时长、画面、动作、情绪。
// 镜头结构来自名场面的 reusable_beats/emotional_arc/visual_actions，原创改写不复刻。

const STORYBOARD_BEATS: Record<RemixDuration, string[]> = {
  15: ['钩子', '冲突', '反转'],
  30: ['钩子', '铺垫', '冲突', '转折', '收尾'],
  60: ['钩子', '铺垫', '升级', '冲突', '受阻', '破局', '收尾', '彩蛋']
}

const SHOT_DURATION_PLAN: Record<RemixDuration, number[]> = {
  15: [4, 6, 5],
  30: [4, 5, 7, 8, 6],
  60: [5, 6, 8, 10, 9, 9, 8, 5]
}

const buildStoryboard = (
  duration: RemixDuration,
  moment: IconicMoment,
  style: RemixStyle,
  rng: () => number
): StoryboardShot[] => {
  const beats = STORYBOARD_BEATS[duration]
  const durations = SHOT_DURATION_PLAN[duration]
  const emotions = moment.emotional_arc
  const actions = moment.visual_actions
  const reusableBeats = moment.reusable_beats

  return beats.map((beat, index) => {
    const emotion = emotions[index % emotions.length]
    const action = actions[index % actions.length]
    // 镜头画面由名场面 setting + 节拍描述 + 风格 prompt 组合，保证原创改写
    const reusableBeat = reusableBeats[index % reusableBeats.length]
    const visual = `${moment.setting}·${beat}：${style.prompt}，呈现${reusableBeat}`
    return {
      index: index + 1,
      duration: durations[index] ?? Math.floor(duration / beats.length),
      visual,
      action,
      emotion
    }
  })
}

/* ----------------------------- 发布文案 ----------------------------- */

const buildCopywriting = (
  input: RemixPlanInput,
  personalityA: PersonalityType,
  rng: () => number
): RemixCopywriting => {
  const { characterA, characterB, moment, workA, workB, momentWork } = input

  // 3 个标题候选：悬念 / 直白 / 反差三种风格
  const titles = [
    `${characterA.name}与${characterB.name}的${moment.conflict_type}：没人预见的结局`,
    `${characterA.name} × ${characterB.name}｜${moment.name}结构改写`,
    `本以为是${moment.conflict_type}，结果${characterA.name}改写了规则`
  ]

  // 约 100 字描述：交代角色来源、碰撞结构与版权边界
  const description =
    `让《${workA.title}》的${characterA.name}与《${workB.title}》的${characterB.name}，` +
    `进入《${momentWork.title}》启发的“${moment.conflict_type}”结构。` +
    `保留${characterA.character_types[0]}与${characterB.character_types[0]}的性格张力，` +
    `台词、镜头与世界观全部原创改写，` +
    `适合${input.duration}秒${input.style.label}风格的短视频制作。`

  // 3 个话题标签：性格 + 结构 + 风格
  const personalityLabel: Record<PersonalityType, string> = {
    cold: '冷酷决策',
    hot: '热血破局',
    cunning: '高段博弈',
    gentle: '温柔坚定'
  }
  const hashtags = [
    `#${personalityLabel[personalityA]}`,
    `#${moment.conflict_type}`,
    `#${input.style.label}`
  ]

  return { titles, description, hashtags }
}

/* ------------------------------ 主入口 ------------------------------ */

export const buildRemixPlan = (input: RemixPlanInput): RemixPlan => {
  const { characterA, characterB, moment, style, duration, seed } = input
  const rng = createPrng(hashStringToSeed(seed))

  const personalityA = detectPersonality(characterA)
  const personalityB = detectPersonality(characterB)

  // 钩子上下文：元素焦点取名场面冲突，动作线索取首个 visual_action
  const hookContext: HookContext = {
    nameA: characterA.name,
    nameB: characterB.name,
    focus: moment.conflict_type,
    actionCue: moment.visual_actions[0] ?? '行动'
  }
  const hook = buildHook(personalityA, duration, hookContext, rng)

  // 代价线索用于冷酷型对白，取名场面情绪弧末段
  const costCue = moment.emotional_arc[moment.emotional_arc.length - 1] ?? '代价'
  const dialogueA = buildDialogue(personalityA, characterA, costCue, rng)
  const dialogueB = buildDialogue(personalityB, characterB, costCue, rng)

  const storyboard = buildStoryboard(duration, moment, style, rng)
  const copywriting = buildCopywriting(input, personalityA, rng)

  const title = `${characterA.name} × ${characterB.name}：${moment.name}`
  const concept =
    `让《${input.workA.title}》的${characterA.character_types[0]}与` +
    `《${input.workB.title}》的${characterB.character_types[0]}，` +
    `进入《${input.momentWork.title}》启发的“${moment.conflict_type}”结构。` +
    `保留性格与关系张力，人物造型、台词、镜头和世界观全部原创改写。`

  const prompt =
    `${style.prompt}。原创角色造型，不复刻任何具体演员或动画形象。` +
    `场景：${moment.setting}。动作：${moment.visual_actions.join('、')}。` +
    `情绪：${moment.emotional_arc.join(' → ')}。`

  return {
    id: `remix-${hashStringToSeed(seed).toString(36)}`,
    title,
    concept,
    hook: hook.text,
    hookCategory: hook.category,
    personalityA,
    personalityB,
    dialogueA,
    dialogueB,
    storyboard,
    copywriting,
    prompt,
    duration
  }
}

/* --------------------------- 导出辅助函数 --------------------------- */
// 导出用于测试与外部复用，保持选择逻辑可被单测覆盖。

export const detectPersonalityFromCharacter = detectPersonality
export const countHookTemplates = (): Record<HookCategory, number> =>
  (Object.fromEntries(
    (Object.keys(HOOK_TEMPLATES) as HookCategory[]).map(category => [
      category,
      HOOK_TEMPLATES[category].length
    ])
  ) as Record<HookCategory, number>)
