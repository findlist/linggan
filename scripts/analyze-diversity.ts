/**
 * 生成多样性分析脚本：用固定种子生成一批方案，分析 C3 重复率和分项贡献。
 * 用于本轮生成引擎质量优化的基线和验收。
 */
import { readFile } from 'node:fs/promises'
import {
  buildRemixPlan,
  HOOK_TEMPLATES,
  DIALOGUE_TEMPLATES,
  type RemixPlanInput,
  type RemixStyle,
  type RemixDuration,
} from '../src/generation/remix-engine.ts'
import { detectDuplicates, computePlanSimilarity } from '../src/generation/similarity.ts'
import { toRemixCharacter, createOriginalWork } from '../src/generation/original-adapter.ts'
import { KnowledgeBaseSchema, SeedEntitiesSchema } from '../src/data/contracts.ts'
import type { Character, KnownCharacter, Work } from '../src/data/contracts.ts'

const root = new URL('../', import.meta.url)
const readJson = async (path: string): Promise<unknown> =>
  JSON.parse(await readFile(new URL(path, root), 'utf8')) as unknown

const rawKb = KnowledgeBaseSchema.parse(await readJson('data/knowledge-base.json'))
const rawSeeds = SeedEntitiesSchema.parse(await readJson('data/seed-entities.json'))

// Known characters (first 5)
const knownChars = rawKb.known_characters.slice(0, 5)

// Original characters (all 10)
const originalChars = rawSeeds.characters
  .filter((c: Character) => c.kind === 'original')
  .map((c: Character) => toRemixCharacter(c))

const allChars: KnownCharacter[] = [...knownChars, ...originalChars]

// Moments (first 3)
const moments = rawKb.iconic_moments.slice(0, 3)

// Works
const workById = new Map<string, Work>(rawKb.works.map((w) => [w.id, w]))
for (const oc of originalChars) {
  if (!workById.has(oc.work_id)) {
    workById.set(oc.work_id, createOriginalWork())
  }
}

const duration: RemixDuration = 30

// Use all 8 styles to match daily-pipeline
const styles: RemixStyle[] = [
  { id: 'cinematic', label: '电影感热血', prompt: '电影感构图' },
  { id: 'absurd', label: '一本正经的荒诞', prompt: '荒诞反差' },
  { id: 'animation', label: '国风动画', prompt: '国风动画' },
  { id: 'mockumentary', label: '伪纪录片', prompt: '伪纪录片' },
  { id: 'cyberpunk_neon', label: '赛博朋克霓虹', prompt: '赛博朋克霓虹' },
  { id: 'ink_wash', label: '古风水墨写意', prompt: '古风水墨写意' },
  { id: 'vlog', label: 'Vlog 日常感', prompt: 'Vlog 日常感' },
  { id: 'suspense_twist', label: '悬疑反转', prompt: '悬疑反转' },
]

// Generate all combinations (same as daily-pipeline: 15 chars × 3 moments × 1 style × 30s)
// 与 daily-pipeline 一致地轮换 story_patterns,以真实反映叙事模板集成对生成多样性的贡献
const style = styles[0]!
const storyPatterns = rawSeeds.story_patterns
const inputs: RemixPlanInput[] = []
for (let i = 0; i < allChars.length; i++) {
  for (let j = i + 1; j < allChars.length; j++) {
    for (let m = 0; m < moments.length; m++) {
      const moment = moments[m]!
      const charA = allChars[i]!
      const charB = allChars[j]!
      const workA = workById.get(charA.work_id)!
      const workB = workById.get(charB.work_id)!
      const momentWork = workById.get(moment.work_id)!
      const seed = `${charA.id}-${charB.id}-${moment.id}-${style.id}-${duration}`
      const patternIndex = (i + j + m) % storyPatterns.length
      inputs.push({
        characterA: charA,
        characterB: charB,
        moment,
        workA,
        workB,
        momentWork,
        style,
        duration,
        seed,
        storyPattern: storyPatterns[patternIndex],
      })
    }
  }
}

const plans = inputs.map((input) => buildRemixPlan(input))
const result = detectDuplicates(plans)

console.log(`Total plans: ${result.stats.total}`)
console.log(
  `Duplicates: ${result.stats.duplicates} (${((result.stats.duplicates / result.stats.total) * 100).toFixed(1)}%)`,
)
console.log(`Unique: ${result.stats.unique}`)
console.log(`Avg max similarity: ${result.stats.avg_max_similarity.toFixed(3)}`)
console.log(`Threshold: ${result.stats.threshold}`)

// Analyze which personality pairs contribute most to duplicates
const personalityPairStats = new Map<string, { total: number; duplicates: number }>()
for (let i = 0; i < plans.length; i++) {
  const plan = plans[i]!
  const pair = [plan.personalityA, plan.personalityB].sort().join('|')
  const entry = personalityPairStats.get(pair) ?? { total: 0, duplicates: 0 }
  entry.total++
  if (result.flags[i]!.is_duplicate) entry.duplicates++
  personalityPairStats.set(pair, entry)
}

console.log('\nDuplicate rate by personality pair:')
for (const [pair, stats] of [...personalityPairStats.entries()].sort(
  (a, b) => b[1].duplicates / b[1].total - a[1].duplicates / a[1].total,
)) {
  console.log(`  ${pair}: ${stats.duplicates}/${stats.total} (${((stats.duplicates / stats.total) * 100).toFixed(1)}%)`)
}

// Analyze similarity breakdown for duplicate pairs
console.log('\nTop 20 duplicate pairs breakdown:')
const dupPairs: {
  i: number
  j: number
  score: number
  breakdown: ReturnType<typeof computePlanSimilarity>['breakdown']
}[] = []
for (let i = 0; i < plans.length; i++) {
  for (let j = i + 1; j < plans.length; j++) {
    const sim = computePlanSimilarity(plans[i]!, plans[j]!)
    if (sim.score >= 0.7) {
      dupPairs.push({ i, j, score: sim.score, breakdown: sim.breakdown })
    }
  }
}
dupPairs.sort((a, b) => b.score - a.score)

for (const dup of dupPairs.slice(0, 20)) {
  const planA = plans[dup.i]!
  const planB = plans[dup.j]!
  console.log(
    `  [${dup.score.toFixed(3)}] ${planA.personalityA}|${planA.personalityB} vs ${planB.personalityA}|${planB.personalityB}`,
  )
  console.log(
    `    hook: ${dup.breakdown.hook.toFixed(2)} title: ${dup.breakdown.title.toFixed(2)} dialogue: ${dup.breakdown.dialogue.toFixed(2)} concept: ${dup.breakdown.concept.toFixed(2)}`,
  )
  console.log(
    `    storyboard: ${dup.breakdown.storyboard_sequence.toFixed(2)} hook_cat: ${dup.breakdown.hook_category.toFixed(2)} prompt: ${dup.breakdown.positive_prompt.toFixed(2)}`,
  )
  console.log(`    A hook: ${planA.hook.slice(0, 50)}`)
  console.log(`    B hook: ${planB.hook.slice(0, 50)}`)
  console.log(`    A dlgA: ${planA.dialogueA.slice(0, 50)}`)
  console.log(`    B dlgA: ${planB.dialogueA.slice(0, 50)}`)
}

// Template counts
console.log('\nTemplate counts:')
for (const [cat, templates] of Object.entries(HOOK_TEMPLATES)) {
  console.log(`  Hook ${cat}: ${templates.length}`)
}
for (const [pers, templates] of Object.entries(DIALOGUE_TEMPLATES)) {
  console.log(`  Dialogue ${pers}: ${templates.length}`)
}

// Story pattern distribution and storyboard diversity
const patternCounts = new Map<string, number>()
const storyboardStructures = new Set<string>()
for (const plan of plans) {
  const patternId = plan.storyPatternId ?? 'default'
  patternCounts.set(patternId, (patternCounts.get(patternId) ?? 0) + 1)
  // 分镜结构签名:景别+运镜+转场+时长序列
  const signature = plan.storyboard
    .map((s) => `${s.shot_type}:${s.camera_movement}:${s.transition}:${s.duration}`)
    .join('|')
  storyboardStructures.add(signature)
}
console.log('\nStory pattern distribution:')
for (const [patternId, count] of [...patternCounts.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${patternId}: ${count}`)
}
console.log(
  `Unique storyboard structures: ${storyboardStructures.size}/${plans.length} (${((storyboardStructures.size / plans.length) * 100).toFixed(1)}%)`,
)

// Unique hooks and dialogues
const uniqueHooks = new Set(plans.map((p) => p.hook))
const uniqueDlgA = new Set(plans.map((p) => p.dialogueA))
const uniqueDlgB = new Set(plans.map((p) => p.dialogueB))
console.log(
  `\nUnique hooks: ${uniqueHooks.size}/${plans.length} (${((uniqueHooks.size / plans.length) * 100).toFixed(1)}%)`,
)
console.log(
  `Unique dialogueA: ${uniqueDlgA.size}/${plans.length} (${((uniqueDlgA.size / plans.length) * 100).toFixed(1)}%)`,
)
console.log(
  `Unique dialogueB: ${uniqueDlgB.size}/${plans.length} (${((uniqueDlgB.size / plans.length) * 100).toFixed(1)}%)`,
)
