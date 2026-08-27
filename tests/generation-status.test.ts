import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createGenerationStatus, formatElapsed } from '../src/data/generation-status.ts'

/* ----------------------- 状态机基础流转 ----------------------- */

test('初始状态为 idle，各字段为空', () => {
  const machine = createGenerationStatus(() => 1000)
  assert.deepEqual(machine.snapshot(), { status: 'idle', startedAt: null, elapsedMs: null, error: null })
})

test('begin 进入 generating 并记录开始时间，清空上次结果', () => {
  let now = 1000
  const machine = createGenerationStatus(() => now)
  machine.begin()
  now = 1050
  machine.complete()
  assert.equal(machine.snapshot().status, 'success')

  machine.begin()
  const snapshot = machine.snapshot()
  assert.equal(snapshot.status, 'generating')
  assert.equal(snapshot.startedAt, 1050)
  // 新一轮生成开始时清空上一轮的耗时与错误
  assert.equal(snapshot.elapsedMs, null)
  assert.equal(snapshot.error, null)
})

test('generating 中重复 begin 返回 false 且状态不变（防双击重复生成）', () => {
  const machine = createGenerationStatus(() => 1000)
  assert.equal(machine.begin(), true)
  const firstStartedAt = machine.snapshot().startedAt
  assert.equal(machine.begin(), false)
  assert.equal(machine.snapshot().status, 'generating')
  assert.equal(machine.snapshot().startedAt, firstStartedAt)
})

test('complete 用注入时钟计算真实耗时', () => {
  let now = 200
  const machine = createGenerationStatus(() => now)
  machine.begin()
  now = 200 + 32
  assert.equal(machine.complete(), true)
  const snapshot = machine.snapshot()
  assert.equal(snapshot.status, 'success')
  assert.equal(snapshot.elapsedMs, 32)
})

test('complete 后再次 begin 可开始下一轮生成', () => {
  let now = 0
  const machine = createGenerationStatus(() => now)
  machine.begin()
  now = 10
  machine.complete()
  now = 100
  assert.equal(machine.begin(), true)
  assert.equal(machine.snapshot().status, 'generating')
  assert.equal(machine.snapshot().startedAt, 100)
})

/* ----------------------- 非法流转保护 ----------------------- */

test('idle 状态直接 complete 返回 false 且不产生耗时', () => {
  const machine = createGenerationStatus(() => 1000)
  assert.equal(machine.complete(), false)
  assert.equal(machine.snapshot().status, 'idle')
  assert.equal(machine.snapshot().elapsedMs, null)
})

test('complete 后再 complete 返回 false，耗时保持首次记录', () => {
  let now = 0
  const machine = createGenerationStatus(() => now)
  machine.begin()
  now = 5
  machine.complete()
  now = 999
  assert.equal(machine.complete(), false)
  assert.equal(machine.snapshot().elapsedMs, 5)
})

test('时钟回拨时耗时钳制为 0，不展示负数', () => {
  let now = 500
  const machine = createGenerationStatus(() => now)
  machine.begin()
  now = 300
  machine.complete()
  assert.equal(machine.snapshot().elapsedMs, 0)
})

/* ----------------------- 失败与重试路径 ----------------------- */

test('fail 进入 error 并记录原因', () => {
  const machine = createGenerationStatus(() => 0)
  machine.begin()
  machine.fail('角色数据缺失')
  const snapshot = machine.snapshot()
  assert.equal(snapshot.status, 'error')
  assert.equal(snapshot.error, '角色数据缺失')
})

test('fail 空消息降级为「未知错误」', () => {
  const machine = createGenerationStatus(() => 0)
  machine.begin()
  machine.fail('   ')
  assert.equal(machine.snapshot().error, '未知错误')
})

test('失败后可重新 begin（重试路径），错误被清空', () => {
  const machine = createGenerationStatus(() => 0)
  machine.begin()
  machine.fail('生成异常')
  assert.equal(machine.begin(), true)
  const snapshot = machine.snapshot()
  assert.equal(snapshot.status, 'generating')
  assert.equal(snapshot.error, null)
})

/* ----------------------- 耗时格式化 ----------------------- */

test('formatElapsed 无效输入返回占位符', () => {
  assert.equal(formatElapsed(null), '—')
  assert.equal(formatElapsed(Number.NaN), '—')
  assert.equal(formatElapsed(-5), '—')
})

test('formatElapsed 不足 1s 显示毫秒整数', () => {
  assert.equal(formatElapsed(0), '0ms')
  assert.equal(formatElapsed(12.4), '12ms')
  assert.equal(formatElapsed(999.6), '1000ms')
})

test('formatElapsed 达到 1s 显示一位小数秒', () => {
  assert.equal(formatElapsed(1000), '1.0s')
  assert.equal(formatElapsed(1560), '1.6s')
  assert.equal(formatElapsed(12345), '12.3s')
})
