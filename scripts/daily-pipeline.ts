import { readFile } from 'node:fs/promises'
import { SeedEntitiesSchema, TrendInboxSchema } from '../src/data/contracts.ts'
import type { CandidateGenerationConfig } from '../src/generation/candidate-generator.ts'
import { generateDailyCandidates } from '../src/generation/candidate-generator.ts'

const root = new URL('../', import.meta.url)
const readJson = async (path: string): Promise<unknown> =>
  JSON.parse(await readFile(new URL(path, root), 'utf8')) as unknown

const [rawConfig, rawSeeds, rawTrends] = await Promise.all([
  readJson('config/pipeline.json'),
  readJson('data/seed-entities.json'),
  readJson('data/trend-inbox.example.json')
])

const report = generateDailyCandidates({
  config: rawConfig as CandidateGenerationConfig,
  seeds: SeedEntitiesSchema.parse(rawSeeds),
  trends: TrendInboxSchema.parse(rawTrends),
  clock: () => new Date()
})

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
