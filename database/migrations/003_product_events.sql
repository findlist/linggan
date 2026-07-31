-- D1 产品事件表：记录 9 类核心产品事件，供 D2 偏好画像和 D3 排序权重聚合使用。
-- event_id 作为幂等键，重复提交不产生多条；payload_json 保存完整事件对象。
CREATE TABLE IF NOT EXISTS product_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  idea_id TEXT,
  session_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  payload_json TEXT NOT NULL
);

-- 按事件类型 + 时间查询（如统计某类事件在时间窗口内的数量）
CREATE INDEX IF NOT EXISTS product_events_type_occurred_idx
  ON product_events(event_type, occurred_at DESC);

-- 按会话查询（D2 偏好画像按 session_id 聚合用户行为）
CREATE INDEX IF NOT EXISTS product_events_session_occurred_idx
  ON product_events(session_id, occurred_at DESC);

-- 按创意查询（统计单个候选的曝光/打开/收藏等漏斗）
CREATE INDEX IF NOT EXISTS product_events_idea_idx
  ON product_events(idea_id)
  WHERE idea_id IS NOT NULL;
