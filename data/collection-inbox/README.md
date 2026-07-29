# 公开热点暂存收件箱

这里保存数据库和正式采集流水线完成前积累的公开热点证据。目录中的文件是待验证外部输入，不是可直接发布的正式内容。

## 文件规则

- 每次采集创建一个新文件，禁止覆盖或追加到旧批次；
- 路径格式：`YYYY/MM/DD/YYYY-MM-DD_HH-mm-ss+08-00.json`；
- 文件使用 UTF-8 编码，根对象包含 `schema_version`、`run` 和 `items`；
- `run` 必须包含 `id`、`started_at`、`finished_at`、`timezone`、`lookback_hours`、`status`、`source_count`、`item_count`、`deduplicated_count` 和 `errors`；
- `items` 中每条记录必须包含 `id`、`name`、`aliases`、`category`、`description`、`source_evidence`、`discovered_at`、`observed_metrics`、`heat`、`velocity`、`lifecycle`、`contexts`、`visual_actions`、`risk_level`、`rights_status` 和 `notes`；
- `source_evidence` 至少保存公开 URL、来源名称、页面标题、页面发布时间（可获得时）和采集时间；
- `observed_metrics` 只保存页面上实际可见的指标及单位；无法验证的热度、增速必须为 `null`；
- 使用规范化名称、来源平台 ID 或 URL 以及内容指纹做批次内和历史去重，同时保留多来源证据；
- 具体知名角色、作品或真人默认标记 `reference_only`，不得在这里保存或下载受保护媒体文件。

正式 Schema 位于 `src/data/contracts.ts` 的 `CollectionBatchSchema`。完成一批采集后运行：

```bash
npm run migrate:trends
```

命令递归读取本目录的 JSON 批次，按“分类 + 规范化名称”的稳定指纹跨批次去重，将有效记录以事务写入 `DATABASE_URL` 指定的 SQLite 数据库（默认 `data/linggan.sqlite`）。坏批次会记录在迁移报告中并跳过，不阻止其他有效批次入库；原始批次不会被删除或改写。重复运行同一批次不会产生重复趋势。数据库文件不提交 Git，所有原始批次会提交并可用于重建数据库。
