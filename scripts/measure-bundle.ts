/**
 * Bundle 体积监测脚本：测量 JS/CSS/数据 JSON 的 raw 和 gzip 体积，
 * 对照阈值告警方案报告状态，用于知识库扩充后评估 bundle 健康度。
 *
 * 阈值方案（JS gzip 体积）：
 * - 绿色 ≤ 130 kB：健康，无需优化
 * - 黄色 130—150 kB：接近优化阈值，规划 knowledge-base.json 懒加载
 * - 红色 > 150 kB：必须实施懒加载或代码分割
 *
 * 用法：npm run measure:bundle（需先 npm run build 生成 dist/）
 */
import { readFile, readdir } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'

const root = new URL('../', import.meta.url)
const url = (p: string) => new URL(p, root)

// 在 dist/assets 中按后缀查找构建产物（文件名含 hash，需动态发现）
async function findAsset(suffix: string): Promise<string | null> {
  const entries = await readdir(url('dist/assets/')).catch(() => [])
  const match = entries.find((name) => name.startsWith('index-') && name.endsWith(suffix))
  return match ? `dist/assets/${match}` : null
}

// 测量单个文件的 raw 和 gzip 体积；文件不存在时返回 null
async function measure(name: string, path: string | null) {
  if (!path) return null
  const raw = await readFile(url(path)).catch(() => null)
  if (!raw) return null
  const gzip = gzipSync(raw, { level: 9 })
  return { name, path, raw: raw.length, gzip: gzip.length }
}

const fmt = (bytes: number) => `${(bytes / 1000).toFixed(1)} kB`
const ratio = (raw: number, gzip: number) => `${((gzip / raw) * 100).toFixed(1)}%`

// JS gzip 阈值（字节数）
const GREEN = 130_000
const YELLOW = 150_000

const jsPath = await findAsset('.js')
const cssPath = await findAsset('.css')

const files = [
  await measure('JS bundle', jsPath),
  await measure('CSS', cssPath),
  await measure('knowledge-base.json', 'data/knowledge-base.json'),
  await measure('seed-entities.json', 'data/seed-entities.json'),
  await measure('compatibility-matrix.json', 'data/compatibility-matrix.json'),
].filter((m): m is NonNullable<typeof m> => m !== null)

console.log('=== Bundle / Data 体积监测 ===\n')
for (const f of files) {
  console.log(`${f.name}: raw=${fmt(f.raw)}, gzip=${fmt(f.gzip)}, ratio=${ratio(f.raw, f.gzip)}`)
}

// 报告 KB 数据规模，便于对照增长趋势
const kbRaw = JSON.parse(await readFile(url('data/knowledge-base.json'), 'utf8')) as {
  works: unknown[]
  known_characters: unknown[]
  relationships: unknown[]
  iconic_moments: unknown[]
}
console.log(
  `\nKB 数据规模: ${kbRaw.works.length} 作品 / ${kbRaw.known_characters.length} 角色 / ${kbRaw.relationships.length} 关系 / ${kbRaw.iconic_moments.length} 名场面`,
)

// JS gzip 阈值告警
const js = files.find((f) => f.name === 'JS bundle')
if (!js) {
  console.log('\n[WARN] 未找到 JS bundle，请先运行 npm run build')
} else {
  const status = js.gzip <= GREEN ? '[GREEN] 健康' : js.gzip <= YELLOW ? '[YELLOW] 接近优化阈值' : '[RED] 必须优化'
  const action =
    js.gzip <= GREEN
      ? '无需优化'
      : js.gzip <= YELLOW
        ? '规划 knowledge-base.json 懒加载（fetch 替代静态 import）'
        : '必须实施懒加载或代码分割'
  console.log(`\nJS gzip 阈值告警: ${status} (${fmt(js.gzip)})`)
  console.log(`建议动作: ${action}`)
}
