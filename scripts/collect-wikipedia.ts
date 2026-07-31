import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { readFile } from 'node:fs/promises'
import {
  WikipediaMostReadResponseSchema,
  fetchWikipediaMostRead,
  transformWikipediaMostRead
} from '../src/collectors/wikipedia-adapter.ts'
import { createTaskRunLogger } from '../src/observability/task-run-logger.ts'

const args = new Map<string, string>()
for (let i = 2; i < process.argv.length; i++) {
  const key = process.argv[i]
  if (!key?.startsWith('--')) continue
  const next = process.argv[i + 1]
  // 支持 --key value 和 --flag 两种形式
  if (next && !next.startsWith('--')) {
    args.set(key.slice(2), next)
    i++
  } else {
    args.set(key.slice(2), 'true')
  }
}

const language = args.get('language') ?? 'zh'
const date = args.get('date') ?? new Date().toISOString().slice(0, 10)
const outputDir = resolve(args.get('output') ?? 'data/collection-inbox')
const fixturePath = args.get('fixture')
const dryRun = args.has('dry-run')

const logger = createTaskRunLogger({
  taskName: 'collect:wikipedia',
  logDirectory: resolve(args.get('logs') ?? 'data/run-logs'),
  metadata: { language, date, fixture: fixturePath ?? null, dry_run: dryRun }
})

try {
  // 获取响应：优先使用本地 fixture（离线测试），否则从维基百科 REST API 拉取
  const response = fixturePath
    ? WikipediaMostReadResponseSchema.parse(JSON.parse(await readFile(fixturePath, 'utf8')) as unknown)
    : await fetchWikipediaMostRead({ language, date })

  const now = new Date()
  const collectedAt = now.toISOString()
  const timeSlug = now.toISOString().slice(11, 19).replace(/:/gu, '')
  const dateSlug = date.replace(/-/gu, '')
  const runId = `wiki_most_read_${language}_${dateSlug}_${timeSlug}`

  const batch = transformWikipediaMostRead({ response, language, collectedAt, runId })
  const json = JSON.stringify(batch, null, 2)

  if (dryRun) {
    process.stdout.write(`${json}\n`)
  } else {
    // 按 collection-inbox 约定路径写入：YYYY/MM/DD/YYYY-MM-DD_HH-mm-ss+00-00.json
    const [year, month, day] = date.split('-')
    const targetDir = join(outputDir, year, month, day)
    await mkdir(targetDir, { recursive: true })
    const fileName = `${date}_${timeSlug}+00-00.json`
    await writeFile(join(targetDir, fileName), `${json}\n`, 'utf8')
    process.stdout.write(`wrote ${join(targetDir, fileName)} (${batch.items.length} items)\n`)
  }

  // 根据批次运行状态记录日志：成功或部分失败
  if (batch.run.status === 'success') {
    await logger.succeed({
      processedCount: batch.items.length,
      successCount: batch.items.length,
      failureCount: 0
    })
  } else {
    await logger.partial({
      processedCount: batch.items.length,
      successCount: batch.items.length,
      failureCount: batch.run.errors.length,
      errors: batch.run.errors
    })
  }
} catch (error) {
  await logger.fail(error)
  throw error
}
