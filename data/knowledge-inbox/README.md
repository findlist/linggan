# 知识库增量批次收件箱

这里保存作品、知名人物、人物关系和抽象名场面的增量批次。每个 JSON 文件是一次可独立校验的小批量扩充，运行合并命令后写入 `data/knowledge-base.json`，再由 `npm run database:init` 幂等写入 SQLite。

## 文件规则

- 每批一个新文件，禁止覆盖旧批次；
- 文件使用 UTF-8 编码，根对象包含 `schema_version`、`works`、`known_characters`、`relationships`、`iconic_moments` 四个集合，任一集合可省略或为空，但同一文件内必须通过 `KnowledgeBatchSchema`；
- 每个实体必须包含稳定 ID、来源证据、版权状态、风险等级和最后验证时间；
- 同一实体跨批次出现时按 ID 合并：别名、角色、特征等数组合并去重，来源按 URL 去重合并，风险等级取更保守值，`last_verified_at` 取较新者；
- 具体知名角色、作品、名场面统一标记 `reference_only`，不得保存精确台词、镜头或受保护素材；
- 跨实体别名冲突（同一别名指向不同实体 ID）会导致合并失败，需修正批次后重试。

## 合并命令

```bash
npm run merge:knowledge
```

命令递归读取本目录的 JSON 批次，以现有 `data/knowledge-base.json` 为基础合并后原子写回。坏批次会被报告并跳过，不阻止其他有效批次合并；重复运行同一批次不会产生重复实体。合并完成后建议运行：

```bash
npm run validate:data
npm run database:init
```

让 SQLite 与合并后的 `knowledge-base.json` 保持一致。

## 批次 Schema

正式 Schema 位于 `src/knowledge/merge-knowledge.ts` 的 `KnowledgeBatchSchema`。批次内字段与 `src/data/contracts.ts` 的 `WorkSchema`、`KnownCharacterSchema`、`CharacterRelationshipSchema`、`IconicMomentSchema` 一致；跨集合外键（如 `work_id`）在最终合并文档中校验，因此批次可以是部分数据，但合并结果必须完整且引用有效。
