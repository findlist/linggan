import { readFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const readJson = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'))
const clamp = value => Math.max(0, Math.min(100, Math.round(value)))

const [config, seeds, trends] = await Promise.all([
  readJson('config/pipeline.json'),
  readJson('data/seed-entities.json'),
  readJson('data/trend-inbox.example.json')
])

const score = ({ trend, character, scene, element }) => {
  const metrics = {
    heat: Math.min(100, (trend.signals.engagement || 0) / 40),
    velocity: (trend.signals.velocity || 0) * 100,
    contrast: character.traits.includes('冷酷') ? 88 : 76,
    visuality: 84,
    generatability: element.generatability * 100,
    seriality: 72,
    novelty: 78
  }
  const total = Object.entries(config.weights).reduce((sum, [key, weight]) => sum + metrics[key] * weight, 0)
  return { total: clamp(total), metrics }
}

const candidates = trends.slice(0, 10).flatMap((trend, trendIndex) =>
  seeds.characters.slice(0, 2).map((character, index) => {
    const scene = seeds.scenes[(trendIndex + index) % seeds.scenes.length]
    const element = seeds.elements[(trendIndex + index) % seeds.elements.length]
    return {
      id: `candidate_${trendIndex + 1}_${index + 1}`,
      title: `${character.name}把${element.name}变成一场史诗挑战`,
      source_trend: trend.external_id,
      entities: [character.id, scene.id, element.id],
      hook: `所有人以为这只是${element.name}，直到${character.name}认真起来。`,
      score: score({ trend, character, scene, element }),
      risk_level: trend.risk_level,
      rights_status: character.rights_status,
      status: 'pending_review',
      generated_at: new Date().toISOString()
    }
  })
)

const report = {
  date: new Date().toLocaleDateString('sv-SE', { timeZone: config.timezone }),
  summary: {
    trends: trends.length,
    candidates: candidates.length,
    ready_for_review: candidates.filter(item => item.score.total >= config.limits.publish_score).length,
    auto_published: 0
  },
  candidates
}

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
