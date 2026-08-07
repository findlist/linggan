import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CandidateSchema } from '../src/data/contracts.ts'
import type { Candidate } from '../src/data/contracts.ts'
import {
  reviewCandidate,
  reviewCandidates,
  candidateSimilarity,
  REVIEW_RULE_VERSION,
} from '../src/review/auto-reviewer.ts'
import type { AutoReviewConfig } from '../src/review/auto-reviewer.ts'

const config: AutoReviewConfig = {
  publish_score: 70,
  similarity_ceiling: 0.86,
}

// 构造合法候选的辅助函数，允许覆盖部分字段
const makeCandidate = (overrides: Partial<Candidate> = {}): Candidate =>
  CandidateSchema.parse({
    id: 'candidate_test_1',
    title: '测试候选方案',
    source_trend: 'trend_abc',
    entities: ['char_01', 'scene_01', 'elem_01'],
    hook: '所有人以为这只是挑战，直到认真起来。',
    score: {
      total: 80,
      metrics: {
        heat: 80,
        velocity: 70,
        contrast: 75,
        visuality: 85,
        generatability: 70,
        seriality: 65,
        novelty: 78,
      },
    },
    risk_level: 'low',
    rights_status: 'original',
    status: 'pending_review',
    generated_at: '2026-08-06T00:00:00.000Z',
    ...overrides,
  })

test('reviewCandidate: 全部门槛通过时返回 approve', () => {
  const decision = reviewCandidate(makeCandidate(), config)
  assert.equal(decision.decision, 'approve')
  assert.equal(decision.cause, undefined)
  assert.ok(decision.reason.includes(`rule:${REVIEW_RULE_VERSION}`))
  assert.ok(decision.reason.includes('verdict=approve'))
  assert.ok(decision.reason.includes('score=80'))
})

test('reviewCandidate: risk_level=blocked 一律拒绝', () => {
  const decision = reviewCandidate(makeCandidate({ risk_level: 'blocked' }), config)
  assert.equal(decision.decision, 'reject')
  assert.equal(decision.cause, 'risk_blocked')
  assert.ok(decision.reason.includes('cause=risk_blocked'))
})

test('reviewCandidate: risk_level=high 拒绝（风险不高于中等）', () => {
  const decision = reviewCandidate(makeCandidate({ risk_level: 'high' }), config)
  assert.equal(decision.decision, 'reject')
  assert.equal(decision.cause, 'risk_high')
})

test('reviewCandidate: risk_level=medium 允许通过', () => {
  const decision = reviewCandidate(makeCandidate({ risk_level: 'medium' }), config)
  assert.equal(decision.decision, 'approve')
})

test('reviewCandidate: rights_status=unknown 拒绝', () => {
  const decision = reviewCandidate(makeCandidate({ rights_status: 'unknown' }), config)
  assert.equal(decision.decision, 'reject')
  assert.equal(decision.cause, 'rights_unknown')
})

test('reviewCandidate: rights_status=restricted 拒绝', () => {
  const decision = reviewCandidate(makeCandidate({ rights_status: 'restricted' }), config)
  assert.equal(decision.decision, 'reject')
  assert.equal(decision.cause, 'rights_restricted')
})

test('reviewCandidate: reference_only 允许进入今日推荐（灵感流展示）', () => {
  const decision = reviewCandidate(makeCandidate({ rights_status: 'reference_only' }), config)
  assert.equal(decision.decision, 'approve')
})

test('reviewCandidate: 总分低于 publish_score 拒绝', () => {
  const decision = reviewCandidate(
    makeCandidate({
      score: {
        total: 65,
        metrics: {
          heat: 60,
          velocity: 50,
          contrast: 70,
          visuality: 75,
          generatability: 60,
          seriality: 55,
          novelty: 68,
        },
      },
    }),
    config,
  )
  assert.equal(decision.decision, 'reject')
  assert.equal(decision.cause, 'score_below_threshold')
  assert.ok(decision.reason.includes('threshold=70'))
})

test('reviewCandidate: 总分等于 publish_score 允许通过（边界）', () => {
  const decision = reviewCandidate(
    makeCandidate({
      score: {
        total: 70,
        metrics: {
          heat: 70,
          velocity: 65,
          contrast: 72,
          visuality: 75,
          generatability: 68,
          seriality: 60,
          novelty: 70,
        },
      },
    }),
    config,
  )
  assert.equal(decision.decision, 'approve')
})

test('reviewCandidate: reason 包含完整可解释字段（规则版本/分数/风险/版权/结论）', () => {
  const decision = reviewCandidate(makeCandidate(), config)
  const reason = decision.reason
  assert.ok(reason.includes('rule:v1'))
  assert.ok(reason.includes('score=80'))
  assert.ok(reason.includes('risk=low'))
  assert.ok(reason.includes('rights=original'))
  assert.ok(reason.includes('verdict=approve'))
})

test('reviewCandidates: 相似度去重——重复组只保留分数最高的一条', () => {
  // 两条 title+hook 完全相同的候选，相似度=1.0 ≥ 0.86
  const high = makeCandidate({
    id: 'c_high',
    score: {
      total: 90,
      metrics: { heat: 90, velocity: 80, contrast: 85, visuality: 90, generatability: 80, seriality: 75, novelty: 88 },
    },
  })
  const low = makeCandidate({
    id: 'c_low',
    score: {
      total: 75,
      metrics: { heat: 75, velocity: 70, contrast: 72, visuality: 78, generatability: 70, seriality: 65, novelty: 73 },
    },
  })
  const result = reviewCandidates([low, high], config)
  assert.equal(result.get('c_high')?.decision, 'approve')
  assert.equal(result.get('c_low')?.decision, 'reject')
  assert.equal(result.get('c_low')?.cause, 'duplicate')
})

test('reviewCandidates: 不相似的候选都通过', () => {
  const a = makeCandidate({ id: 'c_a', title: '完全不同的标题甲', hook: '独特的钩子文案一' })
  const b = makeCandidate({ id: 'c_b', title: '截然相异的标题乙', hook: '另一种钩子文案二' })
  const result = reviewCandidates([a, b], config)
  assert.equal(result.get('c_a')?.decision, 'approve')
  assert.equal(result.get('c_b')?.decision, 'approve')
})

test('reviewCandidates: 规则未通过的候选不参与相似度比较', () => {
  // blocked 候选即使与另一条相似，也不应影响另一条的通过
  const blocked = makeCandidate({ id: 'c_blocked', risk_level: 'blocked' })
  const ok = makeCandidate({ id: 'c_ok' })
  const result = reviewCandidates([blocked, ok], config)
  assert.equal(result.get('c_blocked')?.decision, 'reject')
  assert.equal(result.get('c_blocked')?.cause, 'risk_blocked')
  assert.equal(result.get('c_ok')?.decision, 'approve')
})

test('reviewCandidates: 按总分降序处理，高分先获得通过位', () => {
  // 三条相互相似的候选，只有最高分的应通过
  const base = { title: '相同标题', hook: '相同钩子' }
  const candidates = [
    makeCandidate({
      id: 'c_70',
      ...base,
      score: {
        total: 70,
        metrics: {
          heat: 70,
          velocity: 65,
          contrast: 72,
          visuality: 75,
          generatability: 68,
          seriality: 60,
          novelty: 70,
        },
      },
    }),
    makeCandidate({
      id: 'c_95',
      ...base,
      score: {
        total: 95,
        metrics: {
          heat: 95,
          velocity: 90,
          contrast: 92,
          visuality: 95,
          generatability: 88,
          seriality: 85,
          novelty: 90,
        },
      },
    }),
    makeCandidate({
      id: 'c_80',
      ...base,
      score: {
        total: 80,
        metrics: {
          heat: 80,
          velocity: 70,
          contrast: 75,
          visuality: 85,
          generatability: 70,
          seriality: 65,
          novelty: 78,
        },
      },
    }),
  ]
  const result = reviewCandidates(candidates, config)
  assert.equal(result.get('c_95')?.decision, 'approve')
  assert.equal(result.get('c_80')?.cause, 'duplicate')
  assert.equal(result.get('c_70')?.cause, 'duplicate')
})

test('reviewCandidates: 空列表返回空结果', () => {
  const result = reviewCandidates([], config)
  assert.equal(result.size, 0)
})

test('reviewCandidates: 每条候选都有决策（无遗漏）', () => {
  const candidates = [
    makeCandidate({ id: 'c_1' }),
    makeCandidate({ id: 'c_2', risk_level: 'blocked' }),
    makeCandidate({
      id: 'c_3',
      score: {
        total: 50,
        metrics: {
          heat: 50,
          velocity: 40,
          contrast: 55,
          visuality: 60,
          generatability: 45,
          seriality: 40,
          novelty: 48,
        },
      },
    }),
  ]
  const result = reviewCandidates(candidates, config)
  assert.equal(result.size, 3)
  assert.equal(result.get('c_1')?.decision, 'approve')
  assert.equal(result.get('c_2')?.decision, 'reject')
  assert.equal(result.get('c_3')?.decision, 'reject')
})

test('candidateSimilarity: 相同文本相似度为 1', () => {
  const c = makeCandidate()
  assert.equal(candidateSimilarity(c, c), 1)
})

test('candidateSimilarity: 完全不同文本相似度较低', () => {
  const a = makeCandidate({ title: '甲', hook: '子' })
  const b = makeCandidate({ title: '乙', hook: '丑' })
  assert.ok(candidateSimilarity(a, b) < 0.5)
})
