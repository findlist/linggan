import type { CompatibilityMatrix, IconicMoment, KnownCharacter, StoryPattern, Work } from '../data/contracts.ts'
import {
  filterCompatibleCombinations,
  type CompatibilityFilterOptions,
  type RemixCombination,
} from './compatibility.ts'

/**
 * 生成引擎负责把跨作品角色 × 名场面 × 风格 × 时长组合成完整创意方案。
 * 所有随机选择都来自显式种子的确定性 PRNG,同一输入与种子必须得到完全相同输出,
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
  /** 可选叙事模板：提供时其 beats 替换默认分镜节拍，增加叙事结构多样性 */
  storyPattern?: StoryPattern
  /** 显式种子字符串,同一字符串必须产生同一方案 */
  seed: string
}

/** 景别:控制镜头取景范围,影响叙事节奏与信息密度 */
export type ShotType = 'extreme_close_up' | 'close_up' | 'medium' | 'full' | 'wide'
/** 运镜:摄像机运动方式,影响画面张力与观众代入感 */
export type CameraMovement = 'fixed' | 'push' | 'pull' | 'pan' | 'tilt' | 'tracking'
/** 转场:镜头间衔接方式,影响节奏连续性 */
export type TransitionType = 'cut' | 'dissolve' | 'fade' | 'match_cut'

export interface StoryboardShot {
  index: number
  duration: number
  shot_type: ShotType
  camera_movement: CameraMovement
  visual: string
  action: string
  emotion: string
  transition: TransitionType
}

export interface RemixCopywriting {
  titles: string[]
  description: string
  hashtags: string[]
  /** 封面文案:用于视频封面图上的吸睛短句,区别于标题候选 */
  cover_copy: string
}

/** 结构化画面提示词:正向/负面/比例/风格强度,可直接喂给图像或视频生成模型 */
export interface ProductionPrompt {
  positive: string
  negative: string
  aspect_ratio: string
  /** 风格强度 0-1,控制风格化程度 */
  style_strength: number
}

/** 版权边界声明:明确参考范围、商用限制和原创改写范围 */
export interface CopyrightBoundary {
  reference_status: string
  commercial_use: string
  rewrite_scope: string
}

/** 制作包:包含结构化提示词和版权边界,补齐制作所需字段 */
export interface ProductionPackage {
  prompts: ProductionPrompt
  copyright_boundary: CopyrightBoundary
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
  /** 人类可读的提示词摘要,保留向后兼容;详细字段见 production.prompts */
  prompt: string
  duration: RemixDuration
  /** 叙事模板 ID：使用 story_pattern 时记录，便于追溯和去重 */
  storyPatternId?: string
  /** 叙事模板名称：人类可读，用于导出和展示 */
  storyPatternName?: string
  /** C2 完整制作包:结构化提示词与版权边界声明 */
  production: ProductionPackage
}

/* ----------------------------- 确定性随机工具 ----------------------------- */

/**
 * FNV-1a 32 位字符串哈希。用 Math.imul 保证 32 位整数乘法在所有 JS 运行时一致,
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

/** mulberry32 PRNG:接受 uint32 种子,返回 [0,1) 的确定序列。 */
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

const pick = <T>(items: readonly T[], rng: () => number): T => items[Math.floor(rng() * items.length)] ?? items[0]

/* ------------------------------- 钩子模板 ------------------------------- */
// 4 类各 6 个,共 24 个模板。占位符:{A}/{B}=角色名,{E}=元素焦点,{X}=动作线索。
// 模板只描述结构,不复刻任何原作台词。

export const HOOK_TEMPLATES: Record<HookCategory, string[]> = {
  suspense: [
    '所有人以为这只是{E},直到{A}在{B}面前认真起来。',
    '没人注意到,{B}早在三步之前就已经围绕{E}落子。',
    '直到最后一秒,{A}才向{B}亮出关于{E}的真正底牌。',
    '谁也没想到,{E}会成为{A}与{B}之间压垮秩序的最后一块拼图。',
    '表面上是一次{X},真相却藏在{B}对{A}关于{E}的沉默里。',
    '真相在{B}开口之前,{A}就已经从{E}中定局。',
    '三个版本的说法关于{E},只有{A}和{B}知道哪个是真的。',
    '所有人都在等{B}对{E}的答案,但{A}知道问题本身就是一个陷阱。',
  ],
  contrast: [
    '还在计算{E}的退路,{B}已经把{A}的最后一道防线点亮。',
    '本以为是硬碰硬,结果{A}用一句话替{B}改写了{E}的规则。',
    '{A}不动声色,{B}却已按下整张地图{E}的反转键。',
    '所有人都准备正面强攻{E},{A}却问{B}:谁规定缺口一定在正面?',
    '看起来是退让,{B}其实把{A}引进了自己设好的{E}节奏。',
    '所有人都以为{A}会向{B}在{E}上妥协,{A}却把选项压缩到只剩一个。',
    '最高调的人先退场,{B}在安静中替{A}完成{E}的全部布局。',
    '{A}放下了{B}以为不会放手的东西,{E}的局面瞬间反转。',
  ],
  question: [
    '如果{E}不再受规则约束,{A}和{B}会怎样?',
    '为什么没人想过,让{A}和{B}在{E}中站在同一边?',
    '当{E}的秩序失效,{A}和{B}谁还愿意守最后一道线?',
    '{A}凭什么相信,这一次{B}不会在{E}中转身离开?',
    '如果{E}只剩一次机会,{A}会先保{B}还是先破局?',
    '当{A}选择沉默,谁还敢替{B}在{E}中做决定?',
    '{B}问了{A}关于{E}都不敢问的问题,答案让全场安静。',
    '如果把{E}反转过来看,{A}和{B}谁才是真正的被困者?',
  ],
  action: [
    '第一步:{A}把{E}变成{B}的焦点。',
    '不废话,{A}替{B}先在{E}上掀桌。',
    '直接干。{B}已经替{A}决定了{E}的开场。',
    '先动手再说,{A}用行动替{B}回应关于{E}的所有质疑。',
    '不解释,不犹豫,{B}把{A}在{E}中的退路全部封死。',
    '不犹豫,{A}把第一步踩成{B}整个{E}场面的支点。',
    '{B}没有向{A}宣布{E}的开始,因为行动本身就是宣言。',
    '所有人都还在想{E},{A}已经替{B}站在了结果那一端。',
  ],
}

/** 性格 → 偏好的钩子类别。性格驱动钩子选择,满足"按角色性格选择"要求。 */
const PERSONALITY_HOOK_BIAS: Record<PersonalityType, HookCategory[]> = {
  cold: ['suspense', 'question'],
  hot: ['action', 'contrast'],
  cunning: ['suspense', 'contrast'],
  gentle: ['question', 'action'],
}

/** 性格对 → 额外钩子类别偏好。两种性格的组合扩展可选类别,降低同性格A组合的钩子碰撞率。 */
const PERSONALITY_PAIR_HOOK_EXTRA: Record<string, HookCategory[]> = {
  // 互补组合增加中间类别,扩大选择空间
  'cold|hot': ['contrast', 'action'],
  'cold|cunning': ['suspense'],
  'cold|gentle': ['question'],
  'hot|cunning': ['contrast', 'suspense'],
  'hot|gentle': ['action', 'question'],
  'cunning|gentle': ['contrast', 'question'],
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

/** 时长影响钩子类别权重:短时长偏好行动/反差以快速抓人,长时长可容纳悬念/提问。 */
const durationHookBias: Record<RemixDuration, HookCategory[]> = {
  15: ['action', 'contrast'],
  30: ['contrast', 'suspense', 'question', 'action'],
  60: ['suspense', 'question', 'contrast', 'action'],
}

const buildHook = (
  personalityA: PersonalityType,
  personalityB: PersonalityType,
  duration: RemixDuration,
  ctx: HookContext,
  rng: () => number,
): { text: string; category: HookCategory } => {
  // 合并性格偏好与时长偏好,取交集优先,无交集时回退到性格偏好
  const personalityBias = PERSONALITY_HOOK_BIAS[personalityA]
  const durationBias = durationHookBias[duration]
  const intersection = personalityBias.filter((category) => durationBias.includes(category))
  let effectiveCategories = intersection.length > 0 ? intersection : personalityBias

  // 性格对扩展:互补组合增加额外类别,扩大选择空间降低碰撞率
  const pairKey = [personalityA, personalityB].sort().join('|')
  const extraCategories = PERSONALITY_PAIR_HOOK_EXTRA[pairKey]
  if (extraCategories) {
    const merged = [...new Set([...effectiveCategories, ...extraCategories])]
    effectiveCategories = merged
  }

  // 从候选类别的全部模板合并池中选择,扩大选择空间,避免同性格组合钩子高度雷同
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
  gentle: ['平静', '安定', '温和', '温柔', '细致', '守护', '稳定', '安抚', '包容', '支点'],
}

const detectPersonality = (character: KnownCharacter): PersonalityType => {
  const haystack = [...character.character_types, ...character.traits, ...character.dialogue_style].join('')

  let best: PersonalityType = 'cold'
  let bestScore = 0
  for (const type of Object.keys(PERSONALITY_KEYWORDS) as PersonalityType[]) {
    const score = PERSONALITY_KEYWORDS[type].reduce(
      (count, keyword) => (haystack.includes(keyword) ? count + 1 : count),
      0,
    )
    if (score > bestScore) {
      bestScore = score
      best = type
    }
  }
  // 全部未命中时用角色 id 稳定回退,避免不同未匹配角色总返回同一类型
  if (bestScore === 0) {
    const fallbackIndex = hashStringToSeed(character.id) % 4
    return (['cold', 'hot', 'cunning', 'gentle'] as const)[fallbackIndex]
  }
  return best
}

/* --------------------------- 性格驱动对白 --------------------------- */
// 每种性格多个模板,模板引用角色 dialogue_style 的风格线索,实现"从 dialogue_style 派生"。
// 对白为原创改写,不复刻原作台词。

export const DIALOGUE_TEMPLATES: Record<PersonalityType, string[]> = {
  cold: [
    '"{style}。最坏的结果我先说:{cost}。能接受就动。"',
    '"别绕。{style}。我们只做胜算最高的那一步。"',
    '"{style}。退路我已经算过,没有。"',
    '"{cost}。这是唯一需要你确认的事。其余我来处理。"',
    '"不需要犹豫。{style}。概率站在我们这边,但只给一次窗口。"',
    '"{style}。我不解释第二次,因为局势不会等。"',
    '"先听结论:{cost}。{style}。细节在行动中补。"',
    '"{trait}是我的底线。{style}。越过这条线的事我不做。"',
    '"算过了。{style}。{cost}可控,但必须在三步内收手。"',
    '"{style}。对方比我们急,拖到第二轮他们就会出错。"',
    '"我不赌。{style}。但如果一定要选,选不会连累后续的那条路。"',
    '"{cost}。{style}。两个条件满足才动,缺一个都等。"',
    '"{trait}不是优势,是约束。{style}。在这个框架里操作才安全。"',
    '"别问我为什么。{style}。结论已经给出,执行就行。"',
  ],
  hot: [
    '"你只管打开缺口,剩下的我来扛。{style}--我说到做到。"',
    '"{style}。如果今天只能做一件事,那就把这一件做到没有人能忽视。"',
    '"别问我怕不怕。{style}。行动会比质疑先到。"',
    '"{style}。就算只有一秒,也够我把局面翻转。"',
    '"我不退。{style}。你只要看到我冲,就跟着冲。"',
    '"他们可以怀疑结果,但不能说我没拼过。{style}。"',
    '"{style}。赢了是所有人的,输了我自己扛。走。"',
    '"{trait}。对,就这一个字。剩下看我做。"',
    '"别拦我。{style}。拦我的那个人,得先跑得比我快。"',
    '"{style}。{cost}?那又怎样。疼的事情多了,不差这一件。"',
    '"我没想那么多。{style}。想多了就不敢动了,动了就赢了。"',
    '"{trait}不是口号,是我活到现在的唯一理由。{style}。"',
    '"先干了再说。{style}。后悔的事以后再想,现在只管冲。"',
    '"{style}。谁说我做不到,我就做给他看,然后头也不回。"',
  ],
  cunning: [
    '"你说的我都认。{style}。不过先把界限讲清楚,对你我都好。"',
    '"{style}。这件事我不拦你,只是替你把代价摆到台面上。"',
    '"可以。{style}。但我有一个条件--听完再决定。"',
    '"{style}。你做你的选择,我替你想好退路就行。"',
    '"别急。{style}。真正的牌,要等对方先亮。"',
    '"我尊重你的判断。{style}。但你不觉得,这步棋还有另一种走法吗?"',
    '"{style}。我不需要你同意,只需要你没话说。"',
    '"{trait}。这是你给我的筹码,我会用好。{style}。"',
    '"{style}。你先走,我在后面铺路。走到一半你会发现路只有一条。"',
    '"有意思。{style}。但你想过没有,如果反着来会怎样?"',
    '"{cost}。我帮你算过了。{style}。但真正的代价,不在账面上。"',
    '"{style}。我不跟你争,我让事实替我说话。"',
    '"先别亮底牌。{style}。等他自己犯错,比我们出手便宜十倍。"',
    '"{trait}。你以为这是弱点?在我手里,它就是杠杆。{style}。"',
  ],
  gentle: [
    '"先别急。{style}。我们在,局面就不会失控。"',
    '"{style}。你先稳住,能走的那一步我替你想好了。"',
    '"没事。{style}。剩下的交给我,你只需要往前。"',
    '"{style}。不用怕走错,每一步我都替你看过。"',
    '"我懂你的犹豫。{style}。但这一步,值得试。"',
    '"{style}。你做你擅长的部分,不确定的交给我。"',
    '"别扛着。{style}。有我在,至少不会更糟。"',
    '"{trait}。这是你教会我的。{style}。所以我不会让它白白浪费。"',
    '"慢慢来。{style}。{cost}我替你担着,你只管走稳。"',
    '"{style}。你不需要证明什么,你只需要在。"',
    '"我相信你。{style}。不是因为你不会错,是因为你值得信任。"',
    '"{style}。累了就停一下,我帮你看着后面。"',
    '"{cost}。我知道。但我不想让你一个人扛。{style}。"',
    '"{trait}。别人看到的是软,我看到的是你最大的力量。{style}。"',
  ],
}

const buildDialogue = (
  personality: PersonalityType,
  character: KnownCharacter,
  costCue: string,
  rng: () => number,
): string => {
  const template = pick(DIALOGUE_TEMPLATES[personality], rng)
  const style = pick(character.dialogue_style, rng)
  const trait = character.traits.length > 0 ? pick(character.traits, rng) : '冷静'
  return template.replaceAll('{style}', style).replaceAll('{cost}', costCue).replaceAll('{trait}', trait)
}

/* ----------------------------- 分镜生成 ----------------------------- */
// 按时长输出 15s(3 镜头)/30s(5 镜头)/60s(8 镜头),每镜头含时长、画面、动作、情绪。
// 镜头结构来自名场面的 reusable_beats/emotional_arc/visual_actions,原创改写不复刻。

const STORYBOARD_BEATS: Record<RemixDuration, string[]> = {
  15: ['钩子', '冲突', '反转'],
  30: ['钩子', '铺垫', '冲突', '转折', '收尾'],
  60: ['钩子', '铺垫', '升级', '冲突', '受阻', '破局', '收尾', '彩蛋'],
}

const SHOT_DURATION_PLAN: Record<RemixDuration, number[]> = {
  15: [4, 6, 5],
  30: [4, 5, 7, 8, 6],
  60: [5, 6, 8, 10, 9, 9, 8, 5],
}

// 节拍 → 镜头角色:开场/铺垫/高潮/转折/收尾,决定景别、运镜和转场候选池
type BeatRole = 'opening' | 'buildup' | 'climax' | 'turning' | 'ending'

const classifyBeat = (beat: string): BeatRole => {
  // 固定 beat 名优先精确匹配（原有逻辑）
  if (beat === '钩子') return 'opening'
  if (beat === '铺垫' || beat === '升级') return 'buildup'
  if (beat === '冲突' || beat === '受阻') return 'climax'
  if (beat === '转折' || beat === '破局' || beat === '反转') return 'turning'
  if (beat === '收尾' || beat === '彩蛋') return 'ending'
  // story_pattern beats 关键词匹配：将叙事节拍映射到镜头角色
  if (/建立|展示|开场|先行|平凡|微小偏差|线索|起跑|结果先行/.test(beat)) return 'opening'
  if (/铺垫|升级|重复|变化|采访|道具|目标|逐渐|积累|模仿|笨拙|倒推|原因链条/.test(beat)) return 'buildup'
  if (/冲突|受阻|矛盾|连锁|滚雪球|被迫|交汇|史诗|问题|打破|关键行为|错位/.test(beat)) return 'climax'
  if (/转折|破局|反转|偏离|揭露|真相|觉醒|意外|浮出|发现|互换理解|相反|暴露/.test(beat)) return 'turning'
  if (/收尾|彩蛋|收场|回归|合并|散场|循环结束|认知已改变|重述/.test(beat)) return 'ending'
  return 'ending'
}

// 按镜头角色分组的景别候选:开场用远景建立场景,高潮用特写强化情绪
const SHOT_TYPE_POOL: Record<BeatRole, ShotType[]> = {
  opening: ['wide', 'full'],
  buildup: ['medium', 'full'],
  climax: ['close_up', 'extreme_close_up'],
  turning: ['close_up', 'medium'],
  ending: ['full', 'wide'],
}

// 按镜头角色分组的运镜候选:开场推入建立代入,收尾拉出留白
const CAMERA_MOVEMENT_POOL: Record<BeatRole, CameraMovement[]> = {
  opening: ['push', 'tracking'],
  buildup: ['fixed', 'pan'],
  climax: ['tracking', 'push'],
  turning: ['tilt', 'push'],
  ending: ['fixed', 'pull'],
}

// 按镜头角色分组的转场候选:首镜无前置转场用 cut,结尾用 fade 留余韵
const TRANSITION_POOL: Record<BeatRole, TransitionType[]> = {
  opening: ['cut'],
  buildup: ['cut', 'dissolve'],
  climax: ['cut', 'match_cut'],
  turning: ['match_cut', 'dissolve'],
  ending: ['fade', 'dissolve'],
}

const buildStoryboard = (
  duration: RemixDuration,
  moment: IconicMoment,
  style: RemixStyle,
  rng: () => number,
  storyPattern?: StoryPattern,
): StoryboardShot[] => {
  // 当提供 storyPattern 时，使用其 beats 替换默认分镜节拍，增加叙事结构多样性
  const beats = storyPattern ? storyPattern.beats : STORYBOARD_BEATS[duration]
  const fixedDurations = SHOT_DURATION_PLAN[duration]
  const emotions = moment.emotional_arc
  const actions = moment.visual_actions
  const reusableBeats = moment.reusable_beats

  // story_pattern 模式下按实际 beat 数量动态分配时长（均分 + 余数分配给前几镜）
  const baseDuration = Math.floor(duration / beats.length)
  const remainder = duration - baseDuration * beats.length

  return beats.map((beat, index) => {
    const role = classifyBeat(beat)
    const emotion = emotions[index % emotions.length]
    const action = actions[index % actions.length]
    const reusableBeat = reusableBeats[index % reusableBeats.length]
    // story_pattern 模式下画面描述包含叙事模板名称和节拍，默认模式保持原有描述
    const visual = storyPattern
      ? `${moment.setting}·${storyPattern.name}:${beat}—${style.prompt}`
      : `${moment.setting}·${beat}:${style.prompt},呈现${reusableBeat}`
    // story_pattern 模式动态分配时长，默认模式使用固定时长表
    const shotDuration = storyPattern
      ? baseDuration + (index < remainder ? 1 : 0)
      : (fixedDurations[index] ?? Math.floor(duration / beats.length))
    return {
      index: index + 1,
      duration: shotDuration,
      shot_type: pick(SHOT_TYPE_POOL[role], rng),
      camera_movement: pick(CAMERA_MOVEMENT_POOL[role], rng),
      visual,
      action,
      emotion,
      transition: pick(TRANSITION_POOL[role], rng),
    }
  })
}

/* ------------------------- 概念尾句多样化 ------------------------- */
// 概念文本的尾句曾为固定字符串,导致所有方案的 concept 维度 bigram 相似度偏高。
// 改为按性格A和名场面冲突类型从候选池中选取,降低同性格组合的 concept 相似度。

const CONCEPT_TAIL_BY_PERSONALITY: Record<PersonalityType, string[]> = {
  cold: [
    '冷静与克制贯穿始终,对白和镜头拒绝复刻任何原作。',
    '理智驱动每一个决策节点,叙事节奏紧凑不留余冗。',
    '代价摆在台面上先讲清楚,视觉风格独立于参考素材。',
  ],
  hot: [
    '情绪推着节奏走,每一帧都在燃烧但不照搬原作分毫。',
    '热血不是冲动而是选择,台词和画面从零开始构建。',
    '冲突升级靠行动而非口角,世界观完全独立重铸。',
  ],
  cunning: [
    '布局藏在话术缝隙里,观众需要二刷才看清暗线。',
    '每一步礼让都是筹码交换,角色造型与原作无涉。',
    '控制信息节奏比控制人更重要,镜头语言全部原创。',
  ],
  gentle: [
    '温柔不是退让而是锚点,情绪稳定后局面自然回正。',
    '安静的力量托底,台词节奏舒缓但信息量不减。',
    '共情先于判断,角色互动方式从零设计不复刻。',
  ],
}

/* ------------------------- 标题模式多样化 ------------------------- */
// 标题曾固定为"{A} × {B}:{moment}",导致 title 维度 bigram 相似度偏高。
// 改为多种模式按种子选取,降低同性格组合的 title 相似度。

const TITLE_PATTERNS: ((nameA: string, nameB: string, momentName: string, conflictType: string) => string)[] = [
  (a, b, m, _c) => `${a} × ${b}:${m}`,
  (a, b, _m, c) => `${a}与${b}的${c}`,
  (a, b, m, _c) => `${m}·${a}vs${b}`,
  (a, _b, m, c) => `${a}的${c}:${m}改写`,
  (_a, b, m, c) => `${b}面对${c}:${m}重构`,
  (a, b, m, _c) => `当${a}遇上${b}·${m}`,
]

/* ------------------------- 提示词句式多样化 ------------------------- */
// 提示词曾固定句式"原创角色造型，不复刻...对峙。场景:...动作:...情绪:...",
// 改为多种句式按种子选取,降低 prompt 维度相似度。

const PROMPT_PATTERNS: (
  stylePrompt: string,
  nameA: string,
  traitA: string,
  styleA: string,
  nameB: string,
  traitB: string,
  styleB: string,
  setting: string,
  actions: readonly string[],
  emotions: readonly string[],
) => string[] = (stylePrompt, nameA, traitA, styleA, nameB, traitB, styleB, setting, actions, emotions) => [
  `${stylePrompt}。原创角色造型，不复刻任何具体演员或动画形象。` +
    `${nameA}(${traitA},${styleA})与${nameB}(${traitB},${styleB})对峙。` +
    `场景:${setting}。动作:${actions.join('、')}。` +
    `情绪:${emotions.join(' → ')}。`,
  `${stylePrompt}风格,9:16竖屏构图。` +
    `${nameA}以${traitA}和"${styleA}"出场,` +
    `${nameB}以${traitB}和"${styleB}"回应。` +
    `环境:${setting};行为:${actions.join('、')};` +
    `情绪弧线:${emotions.join('→')}。`,
  `${stylePrompt}。不复制原作造型。` +
    `${nameA}的${traitA}碰撞${nameB}的${traitB}。` +
    `空间设于${setting},关键动作含${actions.join('、')}。` +
    `情感递进:${emotions.join('→')}。`,
  `${stylePrompt}画面,原创造型。` +
    `${nameA}(${styleA})对${nameB}(${styleB}):` +
    `${traitA}对${traitB}。` +
    `地点${setting};动作${actions.join('、')};` +
    `心路${emotions.join('→')}。`,
]

/* ----------------------------- 发布文案 ----------------------------- */

const buildCopywriting = (
  input: RemixPlanInput,
  personalityA: PersonalityType,
  rng: () => number,
): RemixCopywriting => {
  const { characterA, characterB, moment, workA, workB, momentWork } = input

  // 3 个标题候选:悬念 / 直白 / 反差三种风格
  const titles = [
    `${characterA.name}与${characterB.name}的${moment.conflict_type}:没人预见的结局`,
    `${characterA.name} × ${characterB.name}|${moment.name}结构改写`,
    `本以为是${moment.conflict_type},结果${characterA.name}改写了规则`,
  ]

  // 约 100 字描述:交代角色来源、碰撞结构与版权边界
  // 使用 roles 和 traits 替代 character_types 增加差异度
  const descRoleA = characterA.roles[0] ?? '核心人物'
  const descRoleB = characterB.roles[0] ?? '核心人物'
  const description =
    `让《${workA.title}》的${descRoleA}${characterA.name}与《${workB.title}》的${descRoleB}${characterB.name},` +
    `进入《${momentWork.title}》启发的"${moment.conflict_type}"结构。` +
    `保留${characterA.traits[0] ?? '果决'}与${characterB.traits[0] ?? '坚韧'}的性格张力,` +
    `台词、镜头与世界观全部原创改写,` +
    `适合${input.duration}秒${input.style.label}风格的短视频制作。`

  // 3 个话题标签:性格 + 结构 + 风格
  const personalityLabel: Record<PersonalityType, string> = {
    cold: '冷酷决策',
    hot: '热血破局',
    cunning: '高段博弈',
    gentle: '温柔坚定',
  }
  const hashtags = [`#${personalityLabel[personalityA]}`, `#${moment.conflict_type}`, `#${input.style.label}`]

  // 封面文案:用于视频封面图的吸睛短句,区别于标题候选,控制在 12 字以内
  const coverTemplates = [
    `${characterA.name}的${moment.conflict_type}`,
    `${characterA.name} × ${characterB.name}`,
    `${moment.conflict_type}·${characterA.name}`,
  ]
  const cover_copy = pick(coverTemplates, rng)

  return { titles, description, hashtags, cover_copy }
}

/* --------------------------- 制作包生成 --------------------------- */
// C2 完整制作包:结构化画面提示词(正向/负面/比例/风格强度)+ 版权边界声明。
// 提示词可直接喂给图像或视频生成模型;版权边界确保输出可追溯、可商用判断。

// 风格 → 风格强度:电影感最高(0.85),伪纪录片最低(0.55),其余居中
const STYLE_STRENGTH: Record<string, number> = {
  cinematic: 0.85,
  absurd: 0.6,
  animation: 0.75,
  mockumentary: 0.55,
  cyberpunk_neon: 0.8,
  ink_wash: 0.7,
  vlog: 0.5,
  suspense_twist: 0.75,
}

const buildProduction = (input: RemixPlanInput, prompt: string): ProductionPackage => {
  const { style, characterA, characterB, moment } = input

  // 正向提示词:在人类可读摘要基础上补充制作关键词
  // 使用 traits 和 dialogue_style 补充角色差异度
  const traitA = characterA.traits[0] ?? '果决'
  const traitB = characterB.traits[0] ?? '坚韧'
  const dlgA = characterA.dialogue_style[0] ?? traitA
  const dlgB = characterB.dialogue_style[0] ?? traitB
  const positive =
    `${prompt} 画面比例 9:16 竖屏,${style.prompt},` +
    `原创角色造型,高对比度光影,电影级质感。` +
    `${characterA.name}:${traitA},${dlgA};${characterB.name}:${traitB},${dlgB}。`

  // 负面提示词:排除低质量输出和版权风险
  const negative =
    '低质量, 模糊, 变形, 水印, 文字, ' +
    '复刻具体演员形象, 复刻动画角色造型, 复刻原作场景, ' +
    '暴力血腥, 色情, 真人肖像, 未成年人'

  // 短视频统一用 9:16 竖屏
  const aspect_ratio = '9:16'

  const style_strength = STYLE_STRENGTH[style.id] ?? 0.7

  // 版权边界声明:明确参考范围、商用限制和改写范围
  // 原创角色(rights_status=original)和参考角色(rights_status=reference_only)用不同声明
  const isOriginalA = characterA.rights_status !== 'reference_only'
  const isOriginalB = characterB.rights_status !== 'reference_only'
  const charADesc = isOriginalA ? `${characterA.name}(原创角色原型)` : `${characterA.name}(reference_only)`
  const charBDesc = isOriginalB ? `${characterB.name}(原创角色原型)` : `${characterB.name}(reference_only)`
  const copyright_boundary: CopyrightBoundary = {
    reference_status: `参考角色(${charADesc}、${charBDesc})和名场面(${moment.name})` + `仅作结构与性格参考。`,
    commercial_use:
      isOriginalA && isOriginalB
        ? '原创角色原型可直接用于商业发布,但需检查名称、造型和描述未复刻现有 IP。'
        : '商业发布前必须替换为原创或已授权资产,不得直接使用参考角色形象。',
    rewrite_scope: '台词、镜头、世界观、角色造型全部原创改写,不包含原作精确台词、截图或视频片段。',
  }

  return {
    prompts: { positive, negative, aspect_ratio, style_strength },
    copyright_boundary,
  }
}

/* ------------------------------ 主入口 ------------------------------ */

export const buildRemixPlan = (input: RemixPlanInput): RemixPlan => {
  const { characterA, characterB, moment, style, duration, seed, storyPattern } = input
  const rng = createPrng(hashStringToSeed(seed))

  const personalityA = detectPersonality(characterA)
  const personalityB = detectPersonality(characterB)

  // 钩子上下文:元素焦点取名场面冲突,动作线索取首个 visual_action
  const hookContext: HookContext = {
    nameA: characterA.name,
    nameB: characterB.name,
    focus: moment.conflict_type,
    actionCue: moment.visual_actions[0] ?? '行动',
  }
  const hook = buildHook(personalityA, personalityB, duration, hookContext, rng)

  // 代价线索用于冷酷型对白,取名场面情绪弧末段
  const costCue = moment.emotional_arc[moment.emotional_arc.length - 1] ?? '代价'
  const dialogueA = buildDialogue(personalityA, characterA, costCue, rng)
  const dialogueB = buildDialogue(personalityB, characterB, costCue, rng)

  const storyboard = buildStoryboard(duration, moment, style, rng, storyPattern)
  const copywriting = buildCopywriting(input, personalityA, rng)

  // 概念文本:使用 roles[0] 和 dialogue_style[0] 替代 character_types[0],
  // 因同性格角色的 character_types 常相同而 roles 和 dialogue_style 差异更大,
  // 有效降低同性格组合的 concept 维度相似度。
  const roleA = characterA.roles[0] ?? '核心人物'
  const roleB = characterB.roles[0] ?? '核心人物'
  const styleA = characterA.dialogue_style[0] ?? characterA.traits[0] ?? '果决'
  const styleB = characterB.dialogue_style[0] ?? characterB.traits[0] ?? '坚韧'
  const traitA = characterA.traits[0] ?? '果决'
  const traitB = characterB.traits[0] ?? '坚韧'

  const title = pick(TITLE_PATTERNS, rng)(characterA.name, characterB.name, moment.name, moment.conflict_type)

  const conceptTail = pick(CONCEPT_TAIL_BY_PERSONALITY[personalityA], rng)
  // story_pattern 模式下在概念文本中加入叙事模板名称，降低同组合的 concept 相似度
  const patternClause = storyPattern ? `，以"${storyPattern.name}"叙事展开` : ''
  const concept =
    `让《${input.workA.title}》的${roleA}${characterA.name}与` +
    `《${input.workB.title}》的${roleB}${characterB.name},` +
    `进入《${input.momentWork.title}》启发的"${moment.conflict_type}"结构${patternClause}。` +
    `${characterA.name}的${traitA}与"${styleA}"对上${characterB.name}的${traitB}与"${styleB}",` +
    conceptTail

  const prompt = pick(
    PROMPT_PATTERNS(
      style.prompt,
      characterA.name,
      traitA,
      styleA,
      characterB.name,
      traitB,
      styleB,
      moment.setting,
      moment.visual_actions,
      moment.emotional_arc,
    ),
    rng,
  )

  const production = buildProduction(input, prompt)

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
    duration,
    // 仅在提供 storyPattern 时附加相关字段,避免对象中出现 undefined 导致 JSON 往返不等
    ...(storyPattern ? { storyPatternId: storyPattern.id, storyPatternName: storyPattern.name } : {}),
    production,
  }
}

/* --------------------------- 导出辅助函数 --------------------------- */
// 导出用于测试与外部复用,保持选择逻辑可被单测覆盖。

export const detectPersonalityFromCharacter = detectPersonality
export const countHookTemplates = (): Record<HookCategory, number> =>
  Object.fromEntries(
    (Object.keys(HOOK_TEMPLATES) as HookCategory[]).map((category) => [category, HOOK_TEMPLATES[category].length]),
  ) as Record<HookCategory, number>

/* --------------------- C2 批量制作包与 C1 过滤集成 --------------------- */
// buildProductionPlans 在生成前调用 filterCompatibleCombinations 过滤低兼容组合,
// 确保只有通过 C1 兼容矩阵检查的组合才会生成完整制作包。

/** 单个制作包输入:在 RemixCombination 基础上补齐 buildRemixPlan 所需的 work/style/seed */
export interface ProductionPlanInput extends RemixCombination {
  workA: Work
  workB: Work
  momentWork: Work
  style: RemixStyle
  seed: string
  /** 可选叙事模板：提供时其 beats 替换默认分镜节拍 */
  storyPattern?: StoryPattern
}

export interface ProductionPlanStats {
  total_combinations: number
  filtered_out: number
  remaining: number
  threshold: number
}

export interface ProductionPlanResult {
  plans: RemixPlan[]
  stats: ProductionPlanStats
}

/**
 * 批量生成完整制作包,生成前用 C1 兼容矩阵过滤低兼容组合。
 * 默认阈值 0.5,低于阈值的组合不会进入 buildRemixPlan。
 */
export const buildProductionPlans = (
  inputs: readonly ProductionPlanInput[],
  matrix: CompatibilityMatrix,
  options?: CompatibilityFilterOptions,
): ProductionPlanResult => {
  const threshold = options?.threshold ?? 0.5
  // filterCompatibleCombinations 的泛型约束为 T extends RemixCombination,
  // ProductionPlanInput 继承 RemixCombination,因此可以整体传入并保留额外字段
  const filtered = filterCompatibleCombinations(inputs, matrix, { threshold })
  const plans = filtered.map((input) =>
    buildRemixPlan({
      characterA: input.characterA,
      characterB: input.characterB,
      moment: input.moment,
      workA: input.workA,
      workB: input.workB,
      momentWork: input.momentWork,
      style: input.style,
      duration: input.duration,
      seed: input.seed,
      storyPattern: input.storyPattern,
    }),
  )
  return {
    plans,
    stats: {
      total_combinations: inputs.length,
      filtered_out: inputs.length - filtered.length,
      remaining: filtered.length,
      threshold,
    },
  }
}
