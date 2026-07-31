import { readFile } from 'node:fs/promises'
import type { ZodType } from 'zod'
import {
  CompatibilityMatrixSchema,
  KnowledgeBaseSchema,
  SeedEntitiesSchema,
  TaxonomySchema,
  TrendInboxSchema,
  validateMatrixWithKnowledge
} from '../src/data/contracts.ts'

const root = new URL('../', import.meta.url)

const inputs: Array<{ path: string; schema: ZodType }> = [
  { path: 'data/seed-entities.json', schema: SeedEntitiesSchema },
  { path: 'data/taxonomy.json', schema: TaxonomySchema },
  { path: 'data/trend-inbox.example.json', schema: TrendInboxSchema },
  { path: 'data/knowledge-base.json', schema: KnowledgeBaseSchema },
  { path: 'data/compatibility-matrix.json', schema: CompatibilityMatrixSchema }
]

let failed = false
// 缓存已解析的文档，供跨文件外键校验使用
const parsed: Record<string, unknown> = {}

for (const input of inputs) {
  const raw = await readFile(new URL(input.path, root), 'utf8')
  const result = input.schema.safeParse(JSON.parse(raw))

  if (result.success) {
    parsed[input.path] = result.data
    process.stdout.write(`valid ${input.path}\n`)
    continue
  }

  failed = true
  process.stderr.write(`invalid ${input.path}\n`)
  for (const issue of result.error.issues) {
    process.stderr.write(`  ${issue.path.join('.') || '<root>'}: ${issue.message}\n`)
  }
}

// 跨文件外键校验：兼容矩阵的角色 ID、名场面 ID 和冲突类型必须在知识库中存在
const matrix = parsed['data/compatibility-matrix.json']
const knowledge = parsed['data/knowledge-base.json']
if (matrix && knowledge) {
  const issues = validateMatrixWithKnowledge(
    matrix as Parameters<typeof validateMatrixWithKnowledge>[0],
    knowledge as Parameters<typeof validateMatrixWithKnowledge>[1]
  )
  if (issues.length > 0) {
    failed = true
    process.stderr.write('cross-validation failed: compatibility-matrix.json ↔ knowledge-base.json\n')
    for (const issue of issues) {
      process.stderr.write(`  ${issue.path}: ${issue.message}\n`)
    }
  } else {
    process.stdout.write('cross-validation passed: compatibility-matrix.json ↔ knowledge-base.json\n')
  }
}

if (failed) {
  process.exitCode = 1
}
