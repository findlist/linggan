import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { KnowledgeBaseSchema } from '../src/data/contracts.ts'
import type { RemixPlanInput } from '../src/generation/remix-engine.ts'
import { buildRemixPlan } from '../src/generation/remix-engine.ts'
import {
  buildRemixFileName,
  buildRemixJson,
  buildRemixMarkdown
} from '../src/generation/exporters.ts'

const root = new URL('../', import.meta.url)
const knowledge = KnowledgeBaseSchema.parse(
  JSON.parse(await readFile(new URL('data/knowledge-base.json', root), 'utf8')) as unknown
)

const workById = new Map(knowledge.works.map(work => [work.id, work]))
const characterA = knowledge.known_characters[0]
const characterB = knowledge.known_characters[1]
const moment = knowledge.iconic_moments[0]
const style = { id: 'cinematic', label: '电影感热血', prompt: '克制写实光影、宽银幕构图' }

const input: RemixPlanInput = {
  characterA,
  characterB,
  moment,
  workA: workById.get(characterA.work_id)!,
  workB: workById.get(characterB.work_id)!,
  momentWork: workById.get(moment.work_id)!,
  style,
  duration: 30,
  seed: 'export-test-seed'
}

const plan = buildRemixPlan(input)

test('buildRemixMarkdown includes title, concept, hook and copyright boundary', () => {
  const md = buildRemixMarkdown(plan)
  assert.ok(md.includes(`# ${plan.title}`), 'markdown must include the plan title as H1')
  assert.ok(md.includes(plan.concept), 'markdown must include the concept')
  assert.ok(md.includes(plan.hook), 'markdown must include the hook')
  assert.ok(md.includes('版权边界'), 'markdown must include the copyright boundary section')
})

test('buildRemixMarkdown includes all storyboard shots as table rows', () => {
  const md = buildRemixMarkdown(plan)
  for (const shot of plan.storyboard) {
    assert.ok(md.includes(`${shot.index} |`), `markdown must include shot ${shot.index} in table`)
    assert.ok(md.includes(`${shot.duration}s`), `markdown must include duration of shot ${shot.index}`)
  }
})

test('buildRemixMarkdown includes dialogues, copywriting and prompt', () => {
  const md = buildRemixMarkdown(plan)
  assert.ok(md.includes(plan.dialogueA), 'markdown must include dialogue A')
  assert.ok(md.includes(plan.dialogueB), 'markdown must include dialogue B')
  for (const title of plan.copywriting.titles) {
    assert.ok(md.includes(title), 'markdown must include every candidate title')
  }
  assert.ok(md.includes(plan.copywriting.description), 'markdown must include the description')
  for (const tag of plan.copywriting.hashtags) {
    assert.ok(md.includes(tag), 'markdown must include every hashtag')
  }
  assert.ok(md.includes(plan.prompt), 'markdown must include the visual prompt')
})

test('buildRemixMarkdown escapes pipe characters in table cells to preserve structure', () => {
  const planWithPipe = {
    ...plan,
    storyboard: [
      { index: 1, duration: 4, visual: '场景|带管道符', action: '动作|管道', emotion: '情绪' }
    ]
  }
  const md = buildRemixMarkdown(planWithPipe)
  // 转义后管道符应写作 \|，避免破坏表格列数
  assert.ok(md.includes('场景\\|带管道符'), 'pipe in visual must be escaped')
  assert.ok(md.includes('动作\\|管道'), 'pipe in action must be escaped')
})

test('buildRemixMarkdown is deterministic: same input produces identical output', () => {
  const first = buildRemixMarkdown(plan)
  const second = buildRemixMarkdown(plan)
  assert.equal(first, second, 'repeated calls must produce identical markdown')
})

test('buildRemixJson returns valid JSON containing the complete RemixPlan', () => {
  const json = buildRemixJson(plan)
  const parsed = JSON.parse(json) as typeof plan
  assert.deepEqual(parsed, plan, 'parsed JSON must equal the original plan')
})

test('buildRemixJson preserves all RemixPlan fields including nested copywriting and storyboard', () => {
  const parsed = JSON.parse(buildRemixJson(plan)) as typeof plan
  assert.equal(parsed.id, plan.id)
  assert.equal(parsed.title, plan.title)
  assert.equal(parsed.concept, plan.concept)
  assert.equal(parsed.hook, plan.hook)
  assert.equal(parsed.hookCategory, plan.hookCategory)
  assert.equal(parsed.personalityA, plan.personalityA)
  assert.equal(parsed.personalityB, plan.personalityB)
  assert.equal(parsed.dialogueA, plan.dialogueA)
  assert.equal(parsed.dialogueB, plan.dialogueB)
  assert.equal(parsed.prompt, plan.prompt)
  assert.equal(parsed.duration, plan.duration)
  assert.equal(parsed.storyboard.length, plan.storyboard.length)
  assert.equal(parsed.copywriting.titles.length, plan.copywriting.titles.length)
  assert.equal(parsed.copywriting.hashtags.length, plan.copywriting.hashtags.length)
})

test('buildRemixFileName uses linggan-remix prefix and the plan id', () => {
  const name = buildRemixFileName(plan)
  assert.ok(name.startsWith('linggan-remix-'), 'file name must start with linggan-remix-')
  assert.ok(name.endsWith(plan.id), 'file name must end with the plan id')
})
