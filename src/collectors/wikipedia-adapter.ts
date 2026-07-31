import { z } from 'zod'
import { CollectionBatchSchema } from '../data/contracts.ts'
import type {
  CollectionBatch,
  CollectionItem,
  Lifecycle,
  ObservedMetric,
  RiskLevel,
  SourceEvidence,
  TrendCategory
} from '../data/contracts.ts'

/**
 * 维基百科最热词条 REST API 响应的运行时校验 Schema。
 * 端点：https://{lang}.wikipedia.org/api/rest_v1/page/most-read/{year}/{month}/{day}
 * 采用宽松模式（剥离未知字段），避免 API 新增字段导致适配器失效。
 */
const WikipediaArticleSchema = z.object({
  rank: z.number().int().positive(),
  title: z.string(),
  normalizedtitle: z.string().optional(),
  views: z.number().int().nonnegative().optional(),
  extract: z.string().optional(),
  lang: z.string().optional(),
  rank_previous: z.number().int().positive().nullable().optional()
})

export const WikipediaMostReadResponseSchema = z.object({
  date: z.string(),
  articles: z.array(WikipediaArticleSchema)
})

export type WikipediaArticle = z.infer<typeof WikipediaArticleSchema>
export type WikipediaMostReadResponse = z.infer<typeof WikipediaMostReadResponseSchema>

/** 适配器支持的维基百科语言版本（用于 URL 子域拼接，仅允许字母数字避免注入） */
const LANGUAGE_PATTERN = /^[a-z]{2,3}$/u

export interface TransformWikipediaInput {
  response: WikipediaMostReadResponse
  language: string
  collectedAt: string
  runId: string
}

export interface FetchWikipediaOptions {
  language: string
  date: string
  userAgent?: string
}

/** 从日期字符串（如 "2026-07-30Z" 或 "2026-07-30"）提取 YYYYMMDD */
const toDateSlug = (date: string): string => date.slice(0, 10).replace(/-/gu, '')

/** 把词条标题中的下划线/空格统一为 URL 路径用的下划线形式 */
const toUrlTitle = (title: string): string => title.trim().replace(/\s+/gu, '_')

/** 构造维基百科词条的稳定访问 URL */
const buildArticleUrl = (language: string, title: string): string =>
  `https://${language}.wikipedia.org/wiki/${encodeURIComponent(toUrlTitle(title))}`

/** 生成稳定的条目 ID：wiki_most_read_{lang}_{dateSlug}_{rank} */
const buildArticleId = (language: string, dateSlug: string, rank: number): string =>
  `wiki_most_read_${language}_${dateSlug}_${rank}`

/** 根据标题和摘要关键词推断趋势分类，未命中时归为文化事件 */
const categorizeArticle = (title: string, extract: string): TrendCategory => {
  const text = `${title} ${extract}`.toLowerCase()
  if (/film|movie|cinema|电影/.test(text)) return 'film'
  if (/television|drama|tv series|电视剧|剧集/.test(text)) return 'television'
  if (/anime|animation|动画|动漫/.test(text)) return 'anime'
  if (/video game|gaming|游戏/.test(text)) return 'game'
  if (/variety show|reality show|综艺/.test(text)) return 'variety'
  if (/sport|championship|tournament|olympic|体育|赛事|联赛/.test(text)) return 'sports'
  if (/festival|holiday|节日|庆典/.test(text)) return 'festival'
  return 'cultural_event'
}

/** 根据排名变化推断生命周期：新进榜=emerging，上升=rising，持平=peak，下降=declining */
const inferLifecycle = (rankPrevious: number | null | undefined): Lifecycle => {
  if (rankPrevious === null || rankPrevious === undefined) return 'emerging'
  if (rankPrevious === 0) return 'emerging'
  return 'rising'
}

/** 构造来源证据，指向维基百科公开词条页 */
const buildSourceEvidence = (article: WikipediaArticle, language: string, collectedAt: string): SourceEvidence => ({
  url: buildArticleUrl(language, article.title),
  source_name: language === 'zh' ? '维基百科' : 'Wikipedia',
  page_title: article.normalizedtitle ?? article.title.replace(/_/gu, ' '),
  published_at: null,
  collected_at: collectedAt
})

/** 构造可观测指标：浏览量和排名 */
const buildObservedMetrics = (article: WikipediaArticle, collectedAt: string): ObservedMetric[] => {
  const metrics: ObservedMetric[] = []
  if (article.views !== undefined) {
    metrics.push({ name: 'page_views', value: article.views, unit: '次', observed_at: collectedAt })
  }
  metrics.push({ name: 'rank', value: article.rank, unit: '位', observed_at: collectedAt })
  return metrics
}

/** 从摘要生成简短描述，缺失时用元信息兜底；截断避免保存大段正文 */
const buildDescription = (article: WikipediaArticle): string => {
  const fallback = `维基百科最热词条第 ${article.rank} 位，浏览 ${article.views ?? 0} 次。`
  if (!article.extract) return fallback
  const trimmed = article.extract.trim()
  return trimmed.length <= 200 ? `${trimmed}` : `${trimmed.slice(0, 200)}…`
}

/** 单篇文章转换为 CollectionItem；标题为空或无法构造合法 URL 时返回 null */
const transformArticle = (
  article: WikipediaArticle,
  language: string,
  dateSlug: string,
  collectedAt: string
): CollectionItem | null => {
  if (!article.title.trim()) return null

  const name = (article.normalizedtitle ?? article.title.replace(/_/gu, ' ')).trim()
  const aliases = article.title.includes('_') ? [article.title] : []
  const riskLevel: RiskLevel = 'low'

  return {
    id: buildArticleId(language, dateSlug, article.rank),
    name,
    aliases,
    category: categorizeArticle(article.title, article.extract ?? ''),
    description: buildDescription(article),
    source_evidence: [buildSourceEvidence(article, language, collectedAt)],
    discovered_at: collectedAt,
    observed_metrics: buildObservedMetrics(article, collectedAt),
    heat: null,
    velocity: null,
    lifecycle: inferLifecycle(article.rank_previous),
    contexts: ['trending_topic', 'wikipedia_most_read'],
    visual_actions: [],
    risk_level: riskLevel,
    rights_status: 'reference_only',
    notes: `来自维基百科 ${language} 版最热词条 REST API，仅记录排名与浏览量等公开指标；未保存正文、图片或其他受保护媒体。`
  }
}

/**
 * 把维基百科最热词条响应转换为 CollectionBatchSchema 兼容批次。
 * 纯函数，不访问网络或文件系统，适合用保存的样本驱动测试。
 */
export const transformWikipediaMostRead = (input: TransformWikipediaInput): CollectionBatch => {
  if (!LANGUAGE_PATTERN.test(input.language)) {
    throw new Error(`invalid language code: ${input.language} (expected 2-3 lowercase letters)`)
  }

  const dateSlug = toDateSlug(input.response.date)
  const errors: string[] = []
  const items: CollectionItem[] = []

  for (const article of input.response.articles) {
    const item = transformArticle(article, input.language, dateSlug, input.collectedAt)
    if (item === null) {
      errors.push(`skipped article with empty title at rank ${article.rank}`)
      continue
    }
    items.push(item)
  }

  const batch = {
    schema_version: 1 as const,
    run: {
      id: input.runId,
      started_at: input.collectedAt,
      finished_at: input.collectedAt,
      timezone: 'UTC',
      lookback_hours: 24,
      status: errors.length === 0 ? 'success' : 'partial',
      source_count: 1,
      item_count: items.length,
      deduplicated_count: 0,
      errors
    },
    items
  }

  // 最终用 CollectionBatchSchema 校验输出，确保下游 migrate:trends 可消费
  return CollectionBatchSchema.parse(batch)
}

/**
 * 从维基百科 REST API 拉取指定日期和语言的最热词条。
 * 需要公网访问；测试时不调用此函数，改用 transformWikipediaMostRead + 本地样本。
 */
export const fetchWikipediaMostRead = async (options: FetchWikipediaOptions): Promise<WikipediaMostReadResponse> => {
  if (!LANGUAGE_PATTERN.test(options.language)) {
    throw new Error(`invalid language code: ${options.language}`)
  }
  const [year, month, day] = options.date.split('-')
  const url = `https://${options.language}.wikipedia.org/api/rest_v1/page/most-read/${year}/${month}/${day}`
  const response = await fetch(url, {
    headers: { 'User-Agent': options.userAgent ?? 'LingganTrendCollector/0.1 (local development)' }
  })
  if (!response.ok) {
    throw new Error(`Wikipedia most-read API returned HTTP ${response.status} for ${url}`)
  }
  return WikipediaMostReadResponseSchema.parse(await response.json() as unknown)
}
