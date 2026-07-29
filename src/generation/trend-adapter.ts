import type { StoredTrend, Trend } from '../data/contracts.ts'

/**
 * Convert a StoredTrend (persisted in SQLite/JSON trend store) into a Trend
 * input suitable for the candidate generation pipeline.
 *
 * StoredTrend has richer metadata than the legacy Trend schema; this adapter
 * maps the overlapping fields and derives reasonable signal values from
 * observed metrics when available.
 */
export const storedTrendToTrend = (stored: StoredTrend): Trend => {
  const rankMetric = stored.observed_metrics.find(metric => metric.name === 'rank')
  const engagementMetric = stored.observed_metrics.find(
    metric => metric.name === 'engagement' || metric.name === 'heat_score'
  )

  return {
    external_id: stored.id,
    title: stored.name,
    source: stored.source_evidence[0]?.source_name ?? 'unknown',
    source_url: stored.source_evidence[0]?.url ?? 'https://example.com/unknown',
    observed_at: stored.last_seen_at,
    signals: {
      rank: rankMetric ? Math.round(rankMetric.value) : null,
      engagement: engagementMetric ? engagementMetric.value : stored.heat,
      velocity: stored.velocity
    },
    aliases: stored.aliases,
    lifecycle: stored.lifecycle,
    rights_status: stored.rights_status,
    risk_level: stored.risk_level
  }
}

/**
 * Convert a list of StoredTrends into Trend inputs for the pipeline.
 */
export const storedTrendsToTrends = (stored: StoredTrend[]): Trend[] =>
  stored.map(storedTrendToTrend)
