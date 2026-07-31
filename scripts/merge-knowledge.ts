import { resolve } from 'node:path'
import { mergeKnowledgeBatches } from '../src/knowledge/merge-knowledge.ts'

// 参数解析：--inbox <dir> --output <file>，默认值与项目结构一致
const argumentsByName = new Map<string, string>()
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index]
  const value = process.argv[index + 1]
  if (!key?.startsWith('--') || !value) {
    throw new Error('usage: merge-knowledge --inbox <directory> --output <file>')
  }
  argumentsByName.set(key.slice(2), value)
}

const inboxDirectory = resolve(argumentsByName.get('inbox') ?? 'data/knowledge-inbox')
const outputPath = resolve(argumentsByName.get('output') ?? 'data/knowledge-base.json')

// 合并器内部读取现有 outputPath 作为基础，未显式传入 baseDocument 时自动读取
const report = await mergeKnowledgeBatches({ inboxDirectory, outputPath })

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
if (report.files_failed > 0) process.exitCode = 2
