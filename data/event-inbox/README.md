# 前端事件回放收件箱

这里保存前端"导出事件"按钮下载的产品事件批次，等待 `npm run sync:events` 回收到 SQLite `product_events` 表。目录中的文件是待验证的用户行为输入，不直接进入画像或排序。

## 文件规则

- 前端 localStorage 事件队列导出后，把下载的 JSON 文件放入本目录；
- 文件名格式：`events_{session_id}_{YYYYMMDDhhmmss}.json`；
- 文件使用 UTF-8 编码，根对象包含 `schema_version`、`session_id`、`exported_at` 和 `events`；
- `schema_version` 必须为 `1`；
- `session_id` 是前端生成的会话 ID（`sess_{stamp}_{rand}` 格式），用于 D2 偏好画像按会话聚合；
- `exported_at` 是导出时间的 ISO 8601 字符串；
- `events` 是 `ProductEvent` 数组，每条事件必须包含 `schema_version`、`event_id`、`event_type`、`idea_id`、`session_id`、`occurred_at` 和 `payload`；
- `event_type` 必须是 9 类核心事件之一（`idea_impression`/`idea_opened`/`idea_saved`/`prompt_copied`/`idea_exported`/`video_created`/`video_published`/`idea_hidden`/`risk_reported`）；
- `event_id` 作为幂等键，重复 sync 同一文件不会产生重复记录。

正式 Schema 位于 `src/data/contracts.ts` 的 `EventQueueExportSchema` 和 `ProductEventSchema`。把文件放入本目录后运行：

```bash
npm run sync:events
```

命令递归读取本目录的 JSON 文件，逐个事件经 `ProductEventSchema` 校验后写入 `DATABASE_URL` 指定的 SQLite 数据库（默认 `data/linggan.sqlite`）。坏文件被隔离报告，单条坏事件不阻止同文件其他事件入库；`event_id` 冲突时 `INSERT OR IGNORE` 跳过，保证幂等。原始文件不会被删除或改写，可在 sync 成功后手动清理。数据库文件不提交 Git。
