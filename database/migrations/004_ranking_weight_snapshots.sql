-- D3 排序权重周快照表：记录每周排序权重值、变化量、规则版本和输入事件统计。
-- week_id 作为主键，支持查询任意历史周快照实现回滚；snapshot_json 保存完整快照对象。
CREATE TABLE IF NOT EXISTS ranking_weight_snapshots (
  week_id TEXT PRIMARY KEY,
  computed_at TEXT NOT NULL,
  snapshot_json TEXT NOT NULL
);

-- 按 computed_at 降序查询最新快照
CREATE INDEX IF NOT EXISTS ranking_weight_snapshots_computed_idx
  ON ranking_weight_snapshots(computed_at DESC);
