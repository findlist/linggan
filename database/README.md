# SQLite 数据库

Linggan 当前使用 Node.js 内置 `node:sqlite`。默认数据库文件为 `data/linggan.sqlite`，该运行时文件不提交 Git；公开热点原始批次仍保存在 `data/collection-inbox/` 并提交，因此数据库可随时重建。

## 配置

复制 `.env.example` 的变量到本地环境：

```text
DATABASE_URL=file:./data/linggan.sqlite
```

当前脚本直接读取进程环境变量；未设置时使用上面的默认值。只接受 SQLite `file:` URL 或 `:memory:` 测试数据库。

## 初始化

```bash
npm run database:init
```

初始化会按版本执行 `database/migrations/`，随后把 `data/knowledge-base.json` 幂等写入作品、知名人物、人物关系和抽象名场面表。重复执行不会产生重复记录。

## 热点入库

```bash
npm run migrate:trends
```

该命令初始化数据库后，读取所有采集批次，将通过 Schema 的热点按稳定指纹写入 SQLite。坏批次会被报告并跳过；有效批次仍会在同一运行中入库。

当前迁移 `001_initial.sql` 创建：作品、人物、关系、名场面、趋势、趋势来源、趋势指标、采集运行、采集条目、候选和迁移版本表。
