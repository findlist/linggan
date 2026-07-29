import { readFile } from 'node:fs/promises'
import type { ZodType } from 'zod'
import {
  SeedEntitiesSchema,
  TaxonomySchema,
  TrendInboxSchema
} from '../src/data/contracts.ts'

const root = new URL('../', import.meta.url)

const inputs: Array<{ path: string; schema: ZodType }> = [
  { path: 'data/seed-entities.json', schema: SeedEntitiesSchema },
  { path: 'data/taxonomy.json', schema: TaxonomySchema },
  { path: 'data/trend-inbox.example.json', schema: TrendInboxSchema }
]

let failed = false

for (const input of inputs) {
  const raw = await readFile(new URL(input.path, root), 'utf8')
  const result = input.schema.safeParse(JSON.parse(raw))

  if (result.success) {
    process.stdout.write(`valid ${input.path}\n`)
    continue
  }

  failed = true
  process.stderr.write(`invalid ${input.path}\n`)
  for (const issue of result.error.issues) {
    process.stderr.write(`  ${issue.path.join('.') || '<root>'}: ${issue.message}\n`)
  }
}

if (failed) {
  process.exitCode = 1
}
