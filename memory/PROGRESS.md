# 灵感项目当前进度

最后更新：2026-07-31
当前轮次：A4 固定公开来源适配器轮
当前阶段：Phase 1 — 本地内容数据基础验证
整体状态：本地数据闭环可验证；SQLite 已为默认存储，基础知识可幂等初始化、热点可事务入库；候选生成已接通 SQLite 正式趋势；正式趋势可原子导出为只读 JSON；网站热点雷达已消费真实趋势数据；候选已持久化到 SQLite，状态机支持 pending_review → approved/rejected → archived 流转和幂等键去重；今日推荐流已通过只读 JSON 导出消费 approved 候选；知识库增量合并命令已建立并通过真实批次验证，知识库已扩充至 9 部作品/19 角色/7 关系/11 名场面；跨作品混搭引擎已升级为多样化、固定种子可复现的生成器，支持 4 类共 24 个钩子模板、4 种性格驱动对白、按时长分镜（15/30/60s → 3/5/8 镜头）和发布文案（3 标题+描述+3 标签）；素材库角色/作品/名场面三类卡片可点击进入详情弹窗，展示完整字段并提供"开始创作"入口；混搭方案支持导出 Markdown（人类可读，含标题/概念/钩子/分镜表格/对白/文案/画面提示词/版权边界）和 JSON（机器可读，完整 RemixPlan 字段），收藏列表保存完整方案和上下文，支持展开查看、重新加载到工作台、单条导出和删除，旧格式收藏降级显示；首个固定公开来源适配器（维基百科最热词条 REST API）已建立，使用本地保存的响应样本驱动测试，输出 CollectionBatchSchema 兼容批次可被 migrate:trends 消费；尚无自动发布闭环

### A4 固定公开来源适配器轮 — 2026-07-31

本轮目标：建立第一个针对稳定结构化来源的可测试连接器，把维基百科最热词条 REST API 响应映射为 CollectionBatchSchema 兼容批次，使用本地保存的响应样本驱动测试，输出的批次能被现有 migrate:trends 命令消费并写入 SQLite。

完成：

- 新增 `src/collectors/wikipedia-adapter.ts`，实现维基百科最热词条适配器：
  - `WikipediaMostReadResponseSchema`：Zod 运行时校验维基百科 REST API 响应（`/api/rest_v1/page/most-read/{year}/{month}/{day}`），宽松模式剥离未知字段，避免 API 新增字段导致适配器失效；
  - `transformWikipediaMostRead(input)`：纯函数，不访问网络或文件系统，把 API 响应转换为 CollectionBatchSchema 兼容批次；最终输出通过 `CollectionBatchSchema.parse` 校验，确保下游 migrate:trends 可消费；
  - `fetchWikipediaMostRead(options)`：网络函数，设置描述性 User-Agent，处理 HTTP 错误；测试时不调用此函数；
  - 关键词分类映射：根据标题和摘要关键词推断 TrendCategory（sports/film/game/variety/festival/television/anime/cultural_event）；
  - 生命周期推断：`rank_previous` 为 null → emerging（新进榜），有值 → rising；
  - 标题为空或纯空白时跳过该条目并记录到 run.errors，状态标为 partial；
  - 语言代码校验（2-3 位小写字母），防止 URL 子域注入；
  - 所有条目标记 `rights_status: reference_only`、`risk_level: low`，heat 和 velocity 保持 null（缺少跨来源归一化），notes 说明仅记录公开指标；
- 新增 `data/fixtures/wikipedia-most-read/` 目录与 4 个保存的响应样本：
  - `normal.json`：5 篇覆盖 sports/film/game/festival/cultural_event 五类的正常响应；
  - `empty.json`：空 articles 数组；
  - `missing-fields.json`：缺少 extract/views/rank_previous 的条目；
  - `bad-titles.json`：含空标题和纯空白标题的条目（应被跳过）；
- 新增 `tests/wikipedia-adapter.test.ts` 共 11 项测试，覆盖：正常样本生成 5 条有效批次、分类映射覆盖 5 类、所有来源 URL 为合法 HTTPS 维基百科链接、ID 稳定且批次内唯一、生命周期推断、空样本生成 0 条有效批次、字段缺失用默认值兜底、空/空白标题跳过且状态为 partial、非法语言代码拒绝、转换批次可被 migrateCollectionInbox 消费并写入 JsonTrendStore（5 条趋势）、重复迁移幂等；
- 新增 `scripts/collect-wikipedia.ts` CLI，支持 `--language`（默认 zh）、`--date`（默认今天）、`--output`（默认 data/collection-inbox）、`--fixture`（离线样本）、`--dry-run`（输出到 stdout 不写文件）参数；支持 `--key value` 和 `--flag` 两种参数形式；
- 修改 `src/data/contracts.ts` 导出 `ObservedMetric` 和 `TrendCategory` 类型，供适配器使用；
- 修改 `package.json` 添加 `collect:wikipedia` 脚本和测试入口。

验证：

- `npm run typecheck`：通过；
- `npm test`：通过，122/122（新增 11 项 A4 测试，原有 111 项不变）；
- `npm run validate:data`：通过，4 份 JSON 有效；
- `npm run build`：通过，9 modules transformed，CSS 26.35 kB、JS 75.93 kB；
- CLI dry-run 用本地 fixture 验证：退出码 0，输出有效 CollectionBatch JSON；
- `git diff --check`：通过。

关键决策与遗留问题：

- 适配器拆分为纯转换函数 `transformWikipediaMostRead` 和网络函数 `fetchWikipediaMostRead`，测试只调用转换函数 + 本地 fixture，不依赖公网访问；
- 维基百科 REST API 返回结构化 JSON（rank/views/title/extract/rank_previous），比 HTML 抓取更稳定，适合作为首个固定来源适配器；
- 转换函数最终通过 `CollectionBatchSchema.parse` 校验输出，保证下游 migrate:trends 可直接消费，无需额外适配层；
- 标题为空或纯空白时跳过条目而非抛出异常，保证单条坏数据不阻止整批入库（与现有 migrate 的坏批次隔离策略一致）；
- 语言代码校验为 2-3 位小写字母，防止通过 language 参数注入非法 URL 子域；
- heat 和 velocity 保持 null，与现有采集批次一致（缺少跨来源归一化基线，不推测或编造）；
- 本轮未实际调用 fetchWikipediaMostRead 访问公网，未向 collection-inbox 写入真实批次；CLI 已就绪，用户可手动运行 `npm run collect:wikipedia` 拉取当日数据；
- 环境注意：本机默认 node 为 v14，需用 `D:\development\nodejs\node.exe`（v24.14.0）运行 npm 脚本；通过 `set PATH=D:\development\nodejs;%PATH%` 解决。

下一轮：按第 5 节执行 A6 统一任务运行日志，为采集、迁移、生成和导出各环节建立结构化运行记录。

### B5 导出与收藏升级轮 — 2026-07-31

本轮目标：让混搭方案可导出为可分享、可归档的结构化文档（Markdown 人类可读 + JSON 机器可读），收藏列表从仅存标题和钩子升级为完整方案管理，支持查看详情、重新加载到工作台、单条导出和删除。

完成：

- 新增 `src/generation/exporters.ts`，导出三个纯函数：
  - `buildRemixMarkdown(plan)`：生成 Markdown 文档，包含 H1 标题、时长/钩子类型/方案 ID 元信息、概念、前三秒钩子、分镜表格（#/时长/画面/动作/情绪，管道符转义避免破坏表格）、对白（原创改写）、发布文案（3 标题候选+描述+标签）、画面提示词、版权边界说明和方案 ID；
  - `buildRemixJson(plan)`：JSON.stringify 序列化完整 RemixPlan 字段，便于重新加载或外部消费；
  - `buildRemixFileName(plan)`：生成 `linggan-remix-{plan.id}` 文件名；
- 新增 `tests/exporters.test.ts` 共 8 项测试，覆盖：Markdown 含标题/概念/钩子/版权边界、分镜表格行、对白/文案/提示词、管道符转义、确定性输出、JSON 可解析且与原 plan 深相等、JSON 保留所有字段（含嵌套 copywriting/storyboard）、文件名前缀和后缀；
- 修改 `src/main.js`：
  - 导入 `buildRemixFileName/buildRemixJson/buildRemixMarkdown`；
  - 新增 `downloadText(filename, content, mime)` 工具：用 Blob + 临时 a 标签触发浏览器下载，下载后 `URL.revokeObjectURL` 释放；
  - 结果卡片 `result-actions` 从 2 按钮增至 4 按钮：复制方案、导出 Markdown、导出 JSON、收藏混搭；导出操作 try/catch 包裹，失败时 toast 提示真实错误；
  - 收藏逻辑升级：按 `plan.id` 去重（原为按 title），保存完整方案和上下文（characterAId/characterBId/momentId/styleId）+ savedAt 时间戳；旧数据加载时 `plan/context/savedAt` 缺失字段补 null，渲染时降级显示；
  - `renderSaved` 重写为可展开卡片：每条收藏头部可点击或 Enter/Space 展开，展开后显示时长/钩子类型/性格组合、双角色对白、分镜列表（details 折叠）、4 个操作按钮（重新加载/导出 MD/导出 JSON/删除）；操作按钮 `stopPropagation` 避免触发头部 toggle；
  - 新增 `loadSavedRemix(id)`：恢复 4 个选择器和 duration 到收藏时的状态，直接渲染保存的 plan（不调用 buildRemix，避免 generation 计数器导致 seed 变化产生不同方案），知识库变更后任一选择器为空时拒绝加载并提示；
- 修改 `src/style.css` 新增约 30 条 B5 样式规则：
  - `.result-actions` 加 `flex-wrap:wrap` 和按钮 `min-width:118px`，避免桌面端 4 按钮挤压；
  - `.saved-card` 覆盖原 `.saved-list article` 的 flex 布局为 column，头部 `.saved-head` 可点击 hover 高亮、focus-visible 描边、`aria-expanded` 控制右侧 toggle 箭头旋转 90°；
  - `.saved-body` 含 meta 标签、双栏对白、分镜列表、操作按钮区，删除按钮 `.saved-remove` 用 `--danger` 色调靠右；
  - `@media(max-width:640px)` 移动端：双栏对白改单列、操作按钮改垂直堆叠、删除按钮取消靠右；
- 修改 `package.json` 的 test 脚本加入 `tests/exporters.test.ts`。

验证：

- `npm run typecheck`：通过；
- `npm test`：通过，111/111（新增 8 项 B5 测试，原有 103 项不变）；
- `npm run build`：通过，9 modules transformed（新增 exporters.ts），CSS 26.35 kB、JS 75.93 kB；
- `git diff --check`：通过。

关键决策与遗留问题：

- 导出逻辑抽为纯函数 `exporters.ts` 而非内联在 main.js，便于单测覆盖且未来可被 CLI 或其他消费方复用；
- Markdown 分镜用表格而非列表，便于复制到 Notion/飞书等工具时自动渲染；表格单元格的管道符和换行符做转义，避免破坏列结构；
- JSON 导出直接序列化 RemixPlan，不做字段裁剪，确保重新加载时能完整还原方案；
- 收藏按 `plan.id` 去重而非按 title，因为不同种子可能产生相同标题但不同分镜的方案，按 id 更精确；
- 重新加载直接渲染保存的 plan 而非重新调用 `buildRemix`，因为 `buildRemix` 的 seed 包含 `generation` 计数器，重新生成会得到不同方案，违背"重新加载"语义；
- 旧格式收藏（仅 id/title/hook）做降级处理：保留可见但隐藏展开内容和导出/重新加载按钮，仅保留删除，避免破坏用户已有数据；用户重新生成并收藏后自动获得完整功能；
- 导出操作用 `URL.createObjectURL(Blob)` + 临时 a 标签触发下载，下载后立即 `revokeObjectURL` 释放内存，不依赖 File System Access API（浏览器兼容性差）；
- 本轮未做浏览器交互回归：`detail-view.js` 和导出按钮的点击/下载行为依赖真实 DOM 和浏览器 API，项目当前测试体系（node --test）无 jsdom 环境；UI 交互回归留待 C8 统一覆盖；
- 环境注意：本机默认 node 为 v14，需用 `D:\development\nodejs\node.exe`（v24.14.0）运行 npm 脚本；通过 `set PATH=D:\development\nodejs;%PATH%` 解决。

下一轮：按第 5 节执行 A4 固定公开来源适配器，建立第一个针对稳定结构化来源的可测试连接器。

### B4 角色、作品和名场面详情轮 — 2026-07-31

本轮目标：让素材库卡片可点击进入详情视图，覆盖角色、作品、名场面三种类型，展示完整字段并提供"开始创作"入口把当前实体带入跨作品混搭工作台，形成"浏览素材 → 理解结构 → 进入创作"的完整路径。

完成：

- 新增 `src/detail-view.js`，导出 `createDetailView(ctx)` 工厂函数，在 body 末尾挂载可访问的模态弹窗：
  - 角色详情展示 12 个字段：所属作品（可跳转）、角色身份、角色类型、特征、对白风格、关系（可跳转到关联角色）、参与名场面（可跳转）、别名、版权状态、风险等级、最后验证时间、来源证据（外链列表）；
  - 作品详情展示 13 个字段：原标题、别名、媒介类型、地区、上映年份、类型、关联角色（可跳转）、关联名场面（可跳转）、人物关系（含 from→to 链接）、版权状态、风险等级、最后验证、来源证据；
  - 名场面详情展示 13 个字段：所属作品（可跳转）、参与角色（可跳转）、场景设定、冲突类型、情绪弧、视觉动作、可复用节拍（有序列表）、对白模式、抽象描述、版权状态、风险等级、最后验证、来源证据；
  - 实体间跳转：点击详情内的角色/作品/名场面链接在弹窗内切换详情，不离开弹窗；
  - 键盘可访问：Esc 关闭、Tab 在弹窗内循环、打开时聚焦关闭按钮、关闭后恢复原焦点；
  - 事件委托统一处理关闭、跳转和开始创作三类点击；
- 修改 `src/main.js`：
  - 导入 `createDetailView` 并在 body 末尾初始化，传入 knowledge/workById/characterById/mediaNames/rightsLabels/riskLabels/icon/escapeHtml 和 `applyToRemix` 回调；
  - 新增 `applyToRemix(type, id, slot)`：角色填入 A 或 B 选择器（自动避免 A/B 同角色）、名场面填入名场面选择器、作品把首个角色填入 A；填入后调用 `updateHints`、滚动到 #remix、显示 toast 提示；
  - `libraryItems` 三类返回值新增 `id` 字段；
  - `renderLibrary` 给每张卡片添加 `role="button" tabindex="0"` 和 `data-detail-link/data-detail-id`，绑定 click 与 keydown（Enter/Space）打开详情；卡片右下角新增"查看详情"提示（hover 显示，移动端常显）；
- 修改 `src/style.css` 新增详情弹窗样式（约 40 条规则），复用深色 Aurora 变量（--panel/--lime/--violet/--blue/--pink/--shadow/--line），含 `@media(max-width:640px)` 移动端适配（弹窗全屏、字段单列、按钮垂直排列）。

验证：

- `npm run typecheck`：通过；
- `npm test`：通过，103/103（本轮未新增测试，现有测试覆盖业务逻辑不受影响）；
- `npm run build`：通过，8 modules transformed（新增 detail-view.js），CSS 23.62 kB、JS 69.86 kB；
- `git diff --check`：通过；
- 浏览器验证（vite preview + browser-use）：
  - 角色详情弹窗 DOM 检查：`.detail-field` 数量 12-13，`innerHTML.length=2169`，字段文本完整（所属作品、角色类型、特征、对白风格、关系、参与名场面、版权状态、风险等级、最后验证、来源证据等均可见）；
  - "设为角色 A 开始创作"按钮：点击后弹窗关闭、页面滚动到 #remix、角色 A 选择器已选中该角色；
  - 实体间跳转：点击角色详情中的"甄嬛传"作品链接，弹窗切换到作品详情；
  - 键盘可访问：Tab 聚焦卡片、Enter 打开弹窗、Esc 关闭弹窗均正常；
  - 截图功能在测试环境不可用（"browser tab is not visible on screen"），通过 DOM 检查和可访问性快照替代验证；
  - 移动端布局因环境无法调整窗口宽度未做视觉验证，但 CSS `@media(max-width:640px)` 规则已通过 build 校验。

关键决策与遗留问题：

- 详情视图采用弹窗而非独立路由，避免引入路由系统复杂度，符合验收条件"弹窗或独立路由均可"；
- 模态弹窗打开时禁止背景滚动（`document.body.style.overflow='hidden'`），关闭后恢复，符合模态对话框标准；
- 事件委托而非逐元素绑定，减少监听器数量，便于实体间跳转时重新渲染内容；
- "开始创作"按钮对作品类型采用"带入首个角色填入 A"策略，因作品没有直接对应的工作台字段；若该作品无角色则按钮替换为提示文字；
- 角色填入 A 或 B 时自动检测冲突，若 A/B 选到同一角色则把另一侧换成第一个不同角色；
- 本轮未新增单元测试：detail-view.js 是纯前端 UI 渲染，依赖 DOM API，项目当前测试体系（node --test）无 jsdom 环境；UI 交互回归留待 C8 浏览器回归测试统一覆盖；
- 来源证据中的外链用 `target="_blank" rel="noopener noreferrer"` 打开，避免误以为站内导航；
- 环境注意：本机默认 node 为 v14，需用 `D:\development\nodejs\node.exe`（v24.14.0）运行 npm 脚本；通过 `set PATH=D:\development\nodejs;%PATH%` 解决。

下一轮：按第 5 节执行 B5 Markdown/JSON 导出与收藏管理，让用户能把混搭方案和详情实体导出为可分享、可归档的结构化文档，并管理本地收藏。

### B2 生成引擎质量升级轮 — 2026-07-31

本轮目标：将跨作品混搭生成引擎从模板化拼接升级为多样化、可固定种子复现的创意输出，让钩子、性格对白、分镜和发布文案在多次生成中保持差异化和可制作性。

完成：

- 新增 `src/generation/remix-engine.ts`，实现 `buildRemixPlan` 主入口与确定性 PRNG（FNV-1a 32 位哈希 + mulberry32 序列），同一输入与种子产生完全相同输出：
  - 钩子模板 4 类（suspense/contrast/question/action）各 6 个，共 24 个，超出 16 个最低要求；模板仅含结构占位符 `{A}/{B}/{E}/{X}`，不复刻任何原作台词；
  - 钩子选择合并角色性格偏好与时长偏好，取交集优先、无交集回退到性格偏好，从候选类别的全部模板合并池中选择，避免同性格组合钩子高度雷同；
  - 性格检测覆盖 cold/hot/cunning/gentle 4 种类型，从知识库角色的 `character_types`/`traits`/`dialogue_style` 关键词推断，未命中时用角色 id 稳定回退；
  - 性格驱动对白每种性格 3 个模板，引用角色 `dialogue_style` 风格线索原创改写，不复刻原作台词；
  - 分镜按时长输出 15s(3 镜头)/30s(5 镜头)/60s(8 镜头)，每镜头含时长、画面、动作、情绪四字段；镜头画面由名场面 setting + 节拍描述 + 风格 prompt 组合；
  - 发布文案输出 3 个标题候选（悬念/直白/反差三种风格）+ 约 100 字描述 + 3 个话题标签；
- 修改 `src/main.js` 集成新引擎替换原硬编码 `buildRemix`，更新 `renderResult` 展示分镜列表、角色性格标签和发布文案块（可折叠）；
- 修改 `src/style.css` 新增分镜列表、结果标签、文案块样式，复用深色 Aurora 变量；
- 修改 `src/data/contracts.ts` 导出 `Work`、`KnownCharacter`、`CharacterRelationship`、`IconicMoment` 类型，供 remix-engine 使用；
- 新增 `tests/remix-engine.test.ts` 共 10 项测试，覆盖：模板数量（4 类各 ≥4、总数 ≥16）、4 种性格检测、固定种子复现、不同种子产生不同钩子、分镜镜头数与时长匹配、文案结构（3 标题/描述/3 标签）、20 条规范化钩子唯一率 ≥ 70%、性格字段填充、对白引用 dialogue_style；
- 修改 `package.json` 的 test 脚本加入 `tests/remix-engine.test.ts`。

验证：

- `npm run typecheck`：通过；
- `npm run validate:data`：通过，4 份 JSON 有效；
- `npm test`：通过，103/103（新增 10 项 B2 测试，原有 94 项不变）；
- `npm run build`：通过；
- `git diff --check`：通过。

关键决策与遗留问题：

- 确定性 PRNG 采用 FNV-1a + mulberry32，用 `Math.imul` 保证 32 位整数乘法在所有 JS 运行时一致，避免位运算溢出实现差异；
- 钩子唯一率测试从 5 个模板/类提升到 6 个模板/类后通过 70% 阈值；规范化替换角色名、冲突类型和首个视觉动作为占位符，衡量模板选择多样性而非填入值差异；
- 性格检测基于关键词命中数取最高分，全部未命中时用角色 id 哈希稳定回退，避免不同未匹配角色总返回同一类型；
- 对白模板引用 `dialogue_style` 但不复刻原作台词，满足 reference_only 边界；
- 分镜镜头画面由名场面 `setting` + 节拍描述 + 风格 prompt 组合，保证原创改写；
- 知识库中暂无明确热血型角色，hot 性格用 `KnownCharacterSchema.parse` 单独构造角色验证，避免改写整个知识库触发外键校验；
- 环境注意：本机默认 node 为 v14，需用 `D:\development\nodejs\node.exe`（v24.14.0）运行 npm 脚本；PowerShell 不支持 `%PATH%` 语法，需用 `cmd /d /c "set PATH=D:\development\nodejs;%PATH% && ..."` 方式调用。

下一轮：按第 5 节执行 B4 角色、作品和名场面详情，让用户可点击进入详情页并拥有"开始创作"入口。

### B1 首批小规模素材扩充轮 — 2026-07-31

本轮目标：用真实增量批次验证 A3 合并命令，并把知识库从结构验证规模扩充到更高组合多样性，覆盖电影、剧集和动漫三种媒介。

完成：

- 新增 3 个增量批次文件放入 `data/knowledge-inbox/`，每批 1 部作品及其角色、关系和抽象名场面：
  - `2026-07-31-b1-wandering-earth.json`：流浪地球（科幻电影）+ 刘培强、刘启、MOSS + 父子守护关系 + AI 与人类终极抉择、陌生人合力推动装置 2 个名场面；
  - `2026-07-31-b1-three-body.json`：三体（科幻剧集）+ 叶文洁、史强、罗辑 + 审讯者与历史揭示者关系 + 精密计划静默执行 1 个名场面；
  - `2026-07-31-b1-jujutsu-kaisen.json`：咒术回战（热血动漫）+ 虎杖悠仁、伏黑惠、五条悟 + 最强导师与共情型学生关系 + 封闭空间规则对抗、强者退场传承 2 个名场面；
- 运行 `npm run merge:knowledge`：3 批次全部处理成功，0 失败、0 别名冲突、0 重复 ID；合并后 `data/knowledge-base.json` 为 9 作品/19 角色/7 关系/11 名场面（新增 20 个实体，0 个合并）；
- 所有新增知名实体均标记 `reference_only`，名场面仅保存抽象冲突、情绪弧、视觉动作和对白模式，不复刻原作台词、镜头、招式名称、造型或具体数值；
- 来源证据全部使用稳定的英文 Wikipedia 公开页面 URL，`collected_at` 和 `last_verified_at` 统一为 2026-07-31T03:00:00.000Z；
- 更新 `tests/sqlite-storage.test.ts` 和 `tests/trend-ingestion.test.ts` 中硬编码的旧知识库数量断言（6/10/4/6 → 9/19/7/11），测试目的（幂等种子和 reference_only 校验）不变。

验证：

- `npm run typecheck`：通过；
- `npm run validate:data`：通过，4 份 JSON 有效（含合并后的 knowledge-base.json）；
- `npm test`：通过，94/94；
- `npm run build`：通过；
- `npm run merge:knowledge`：成功，3 批次发现、3 处理、0 失败，输出 9/19/7/11；
- `npm run database:init`：成功，幂等 seed 写入 9 作品/19 角色/7 关系/11 名场面，迁移未重复应用；
- `git diff --check`：通过。

关键决策与遗留问题：

- 分批策略：每批 1 部作品独立校验，验证了 A3 合并器的分批填充、跨批次 ID 唯一和别名归一能力；批次文件按路径名排序合并，顺序稳定；
- 别名归一实测有效：3 部作品的中英文别名、3 个角色别名（含"大史""莫斯"等口语别名）均未与现有实体冲突；
- 知识库规模仍属小规模验证（9 部作品），未达到 DEVELOPMENT_DIRECTION.md 4.1 节的 15+ 部作品目标，后续批次可继续用同一命令扩充；
- 环境注意：本机默认 node 为 v14，不支持 `--experimental-strip-types`，需用 `D:\development\nodejs\node.exe`（v24.14.0）运行 npm 脚本；本轮通过 `set PATH=D:\development\nodejs;%PATH%` 解决；
- 测试中的数量断言已同步更新，后续扩充时需再次同步。

下一轮：按第 5 节执行 B2 生成引擎质量升级，让钩子、性格对白、分镜和发布文案从模板化升级为多样化、可固定种子复现的输出。

### A3 知识库增量合并与去重命令轮 — 2026-07-31

本轮目标：建立可维护、可回滚的知识库扩充入口，支持分批填充、跨批次幂等、别名归一和来源合并，为后续 B1 素材扩充提供增量合并能力。

完成：

- 新增 `data/knowledge-inbox/` 目录与 README 规则，定义增量批次文件格式与合并流程；
- 新增 `src/knowledge/merge-knowledge.ts`，实现 `KnowledgeBatchSchema`（四个集合可选）和 `mergeKnowledgeBatches` 合并器：
  - 按 ID 跨批次合并：别名、角色、特征、对白风格等数组合并去重；来源按 URL 去重合并；风险等级取更保守值（blocked > high > medium > low）；`last_verified_at` 取较新者；
  - 别名归一：`UniqueStringListSchema` 在解析时拒绝同实体重复别名；合并后检测跨实体别名冲突（同一别名指向不同实体 ID 时失败，不写入）；
  - 合并结果整体通过 `KnowledgeBaseSchema` 校验（全局 ID 唯一、外键有效）；
  - 原子写入：通过 `JsonDocumentStore` 先写临时文件再 rename，校验或冲突失败时旧文件不变；
  - 合并器内部读取现有 outputPath 作为基础（未显式传入 baseDocument 时），CLI 与测试均支持幂等重复运行；
- 新增 `scripts/merge-knowledge.ts` CLI，支持 `--inbox <dir> --output <file>` 参数，默认 `data/knowledge-inbox` 和 `data/knowledge-base.json`；
- 新增 `npm run merge:knowledge` 命令；
- 新增 14 项 A3 测试，覆盖：分批填充、跨批次幂等、来源合并、别名归一、别名冲突检测、风险保守值、坏批次跳过、原子写入、空 inbox、baseDocument 合并、外键校验、Schema 拒绝重复别名和未知字段；
- `data/knowledge-base.json` 经 merge:knowledge 重新序列化为统一多行展开格式，内容不变，后续合并 diff 更清晰。

验证：

- `npm run typecheck`：通过；
- `npm run validate:data`：通过，4 份 JSON 有效；
- `npm test`：通过，94/94（新增 14 项 A3 测试）；
- `npm run build`：通过；
- `npm run merge:knowledge`：成功，inbox 为空时读取现有 knowledge-base.json，输出 6 作品/10 角色/4 关系/6 名场面，无重复；
- `git diff --check`：通过。

关键决策与遗留问题：

- 合并策略：标量字段取后处理者（按文件排序），数组字段合并去重，风险取更保守值，时间取较新者；同批次重复运行结果不变；
- 合并器内部读取 outputPath 作为基础，CLI 无需手动传入 baseDocument；测试时可显式传入 baseDocument 隔离基础文档；
- 坏批次被报告并跳过，不阻止其他有效批次合并；但合并结果为空库时仍会原子写入（空库合法）；
- 跨实体别名冲突会导致合并失败且不写入，避免歧义别名进入知识库；
- 知识库 JSON 重新序列化为多行展开格式，内容不变，已通过 validate:data 确认；
- 环境注意：本机默认 node 为 v14，需使用 `D:\development\nodejs\node.exe`（v24.14.0）运行 npm 脚本；
- `--experimental-strip-types` 不支持 TypeScript 参数属性语法，`KnowledgeMergeError` 改用显式字段赋值。

下一轮：按第 5 节执行 B1 首批小规模素材扩充，用真实批次验证增量合并命令并增加组合空间。

### B3 今日推荐流读取持久化候选轮 — 2026-07-31

本轮目标：让首页推荐流读取 SQLite 中 approved 候选，替换占位内容，形成“生成→持久化→审核→展示”的内容消费闭环。

完成：

- 新增 `CandidateExportDocumentSchema` 与类型，强制导出文档只包含 approved 候选，校验 candidate_count、唯一 ID 和状态合法性；
- 新增 `scripts/export-candidates.ts`，从 SQLite 读取 approved 候选，最多 10 条，经 Schema 校验后原子写入 `public/data/candidate-export.json`，复用 A2 的“SQLite → Schema → 原子 JSON → 前端 fetch”边界；
- 新增 `npm run export:candidates` 命令；
- 新增 8 项候选导出测试，覆盖正常导出、空库、只导出 approved（不包含 pending/rejected/archived）、默认上限 10、原子替换、count 校验、非 approved 拒绝和时间戳；
- 前端 `main.js` 新增今日推荐区域，通过 `fetch` 读取 candidate-export.json，无数据时显示明确空状态，不展示待审内容；
- `style.css` 新增推荐流卡片和空状态样式，复用现有深色 Aurora 变量；
- `.gitignore` 增加 `data/candidate-export.json` 和 `public/data/candidate-export.json`，与 trend-export.json 保持一致，导出产物不提交。

验证：

- `npm run typecheck`：通过；
- `npm run validate:data`：通过，4 份 JSON 有效；
- `npm test`：通过，80/80（新增 8 项 B3 测试）；
- `npm run build`：通过；
- `npm run export:candidates`：成功，当前 0 条 approved 候选，生成空文档（候选仍为 pending_review，符合预期）；
- `git diff --check`：通过。

关键决策与遗留问题：

- 复用 A2 导出边界，前端不直接访问 SQLite；导出文档在 Schema 层强制 status === 'approved'，前端不可能拿到待审内容；
- 当前 20 条持久化候选均为 pending_review，推荐流显示空状态是真实状态，不放宽状态或编造指标；
- 导出产物加入 .gitignore，开发者需运行 `npm run export:candidates` 生成前端所需 JSON；
- 推荐流默认上限 10 条，按 generated_at DESC 排序；
- 环境注意：本机默认 node 为 v14，需使用 `D:\development\nodejs\node.exe`（v24.14.0）运行 npm 脚本。

下一轮：按第 5 节执行 A3 知识库增量合并与去重命令。

### 独立自动化剩余任务同步轮 — 2026-07-29

完成：

- 对照 `docs/DEVELOPMENT_DIRECTION.md`、实际代码和提交核实：A1、A2、B6、A5 已完成，B3 为下一项；
- 将 Phase 1 剩余 A3、B1、B2、B3、B4、B5、A4、A6，以及 Phase 2、Phase 3 后续任务完整加入当前任务队列；
- Phase 4 保留为条件触发任务，未满足外部依赖时不得自动执行商业化、生产迁移或付费服务工作；
- 更新 `docs/DEVELOPMENT_AUTOMATION_PROMPT.md` 和桌面端“灵感项目持续开发”任务，使其完整读取方向计划、核实完成状态并按依赖选择单一垂直切片；
- 持续开发任务保持暂停，执行频率仍为每 6 小时；热点采集任务未修改。
- 数据校验、类型检查、72 项测试、SQLite 初始化、每日流水线、生产构建和差异检查通过；流水线确认正式趋势 12 条、候选 20 条且重复执行未新增重复候选。

### 双轨独立自动化计划优化轮 — 2026-07-29

完成：

- 将 `docs/DEVELOPMENT_DIRECTION.md` 明确为产品双轨独立自动化的专用任务队列，同时继承项目安全、验证、记忆和 Git 规范；
- 将强制“数据任务 + 页面任务”配对改为单一、可回滚的垂直切片，按 SQLite 输入、只读导出、页面消费、候选持久化和推荐流的依赖顺序执行；
- 明确静态页面不得直接读取 SQLite，增加正式趋势查询与原子 JSON 导出边界；
- 修正原创角色原型的数据归属：原创原型进入 `seed-entities.json`，知名角色继续保持 `reference_only`；
- 将知识库扩充改为小批次来源校验，将随机唯一率、近似检测和人工通过率改为可重复或条件触发的验收指标；
- 区分固定来源适配器与独立热点采集 Agent，增加自动化任务选择、阻塞、并发避让和完成判定规则。
- 历史交付阻塞：曾两次遇到 GitHub SSH 端口 22 连接重置；后续提交已成功同步，该阻塞当前已解除。

### 开发队列与定时任务同步轮 — 2026-07-29

完成：

- 将当前轮次和唯一首选任务统一为“每日候选流水线读取 SQLite 正式趋势”，避免顶部摘要与任务队列冲突；
- 明确后续顺序为真实公开来源适配器、网站正式趋势消费、浏览器交互回归；
- 更新开发计划，登记跨作品灵感工作台已完成并增加当前集成验收条件；
- 更新开发自动化规范及桌面端两项定时任务说明，双方必须避让并发外部修改，只提交各自本轮文件；
- 保持持续开发任务暂停，保持热点采集与 SQLite 入库任务启用及每日 07:30、13:30、19:30 计划不变；
- 数据校验、类型检查、29 项测试、生产构建和差异检查通过。

### 内容图谱与跨作品灵感工作台轮 — 2026-07-29

完成：

- 将知识库扩充至 6 部作品、10 个知名人物、4 组人物关系和 6 个抽象名场面，新增《凡人修仙传》《仙逆》《亮剑》及韩立、王林、李慕婉、李云龙等参考实体；
- 为人物补充角色类型和对白风格，为名场面补充可复用的对白模式；保留具体 IP 实体 `reference_only` 边界，不存储精确台词、镜头或复刻素材；
- 首页重构为实时热点雷达、跨作品混搭工作台和可检索知识库，支持角色 A × 角色 B × 抽象名场面 × 风格 × 时长的随机组合；
- 生成结果包括创意、前三秒钩子、节奏分镜、原创改写对白、画面提示和版权边界，并支持复制及本地收藏；
- 修复移动端跳转链接、标题溢出和角色卡片裁切问题；
- SQLite 初始化确认写入 6/10/4/6，完整 29 项测试、数据校验、类型检查、每日流水线和生产构建全部通过。

下一轮：先让每日候选流水线读取 SQLite 正式趋势；完成后依次接入首个真实公开来源适配器、让网站热点雷达与组合器消费正式趋势，并补充自动化浏览器回归。

## 1. 当前项目健康状态

| 项目 | 状态 | 说明 |
|---|---|---|
| 前端 MVP | 通过 | 已重构为热点雷达、跨作品混搭器、知识库和收藏工作台，Vite 生产构建成功 |
| 响应式 UI | 已实现基础版 | 完成桌面和移动端视觉检查，尚缺自动化浏览器回归测试 |
| 示例内容 | 已有 | 4 条首页创意和结构化种子数据 |
| 每日候选脚本 | SQLite 闭环通过 | 默认读取正式趋势、生成候选并幂等持久化；显式示例输入仅用于测试和演示 |
| 内容图谱 | 基础库可校验，增量合并已用真实批次验证 | 已有 9 部作品、19 个知名人物、7 组关系和 11 个抽象名场面；具体知名内容均为 `reference_only`；增量批次可通过 `merge:knowledge` 合并入库 |
| 创意生成引擎 | 质量升级完成 | 4 类共 24 个钩子模板、4 种性格驱动对白、按时长分镜（15/30/60s → 3/5/8 镜头）和发布文案（3 标题+描述+3 标签）；固定种子可复现，20 条规范化钩子唯一率 ≥ 70% |
| 素材库详情视图 | 基础闭环通过 | 角色/作品/名场面三类卡片可点击进入详情弹窗，展示完整字段（角色类型、对白风格、关系、情绪弧、视觉动作、可复用节拍、来源证据等）；每个详情页有"开始创作"入口带入混搭工作台；键盘可访问，移动端有适配；尚缺自动化浏览器回归 |
| 导出与收藏 | 基础闭环通过 | 混搭方案可导出 Markdown（人类可读，含分镜表格/对白/文案/版权边界）和 JSON（机器可读，完整 RemixPlan）；收藏列表保存完整方案和上下文，支持展开查看、重新加载到工作台、单条导出和删除；旧格式收藏降级显示；导出/收藏操作有 toast 反馈；尚缺浏览器交互回归 |
| 热点采集 | SQLite 入库闭环完成，任务启用 | 每天 07:30、13:30、19:30 采集；已有公开批次经 Schema、跨批次去重和事务迁移进入 SQLite |
| 来源适配器 | 首个固定适配器已建立 | 维基百科最热词条 REST API 适配器已建立，纯转换函数 + 本地 fixture 测试，输出 CollectionBatchSchema 兼容批次可被 migrate:trends 消费；CLI 已就绪但未实际拉取公网数据 |
| 本地持久化 | SQLite 通过 | 默认 `data/linggan.sqlite`；版本化迁移、知识种子、事务回滚、幂等和多来源合并测试通过 |
| 候选审核 | 基础状态机通过 | candidates 已持久化，支持 pending_review、approved、rejected、archived 合法流转；approved 候选可导出供推荐流消费；尚无自动发布目标 |
| 今日推荐 | 基础闭环通过 | 首页读取 approved 候选导出，无数据时显示空状态；当前无 approved 候选 |
| 行为分析 | 未实现 | 尚未采集曝光、复制和成片事件 |
| 测试体系 | 基础验证通过 | 已覆盖数据契约、生成、SQLite 趋势适配与导出、候选存储和状态机；浏览器回归仍待补齐 |

## 2. 已完成内容

- [x] 产品定位与 MVP 页面；
- [x] 深色 Aurora 视觉系统；
- [x] 灵感搜索入口、示例卡片、收藏和方案弹窗；
- [x] 角色 × 场景 × 叙事味道组合器；
- [x] 基础内容分类与运营规范；
- [x] 12 周自进化系统开发计划；
- [x] 定时任务配置草案；
- [x] 分类字典与首批原创种子实体；
- [x] 示例趋势输入；
- [x] 候选评分与生成脚本原型；
- [x] Agent 开发入口和持续开发规范；
- [x] 生产构建验证。
- [x] 建立公开热点暂存目录与批次文件规则；
- [x] 将内容采集并行轨道加入开发计划。
- [x] 建立核心实体 TypeScript 数据契约、运行时校验、统一数据校验命令和首批自动测试。
- [x] 将候选评分与生成拆为可测试 TypeScript 模块，注入固定时钟并让输出通过 `CandidateSchema`。
- [x] 建立作品、知名人物、人物关系和抽象名场面基础知识库 Schema 与首批样本；
- [x] 建立热点采集批次 Schema 和正式趋势存储 Schema；
- [x] 建立可替换的 `TrendStore` 接口与本地 JSON 实现；
- [x] 实现 `collection-inbox` 到正式趋势存储的跨批次去重迁移命令；
- [x] 覆盖非法数据、重复数据、部分失败、幂等和无部分写入测试。
- [x] 建立 `DATABASE_URL` 配置、版本化 SQLite 迁移和数据库初始化命令；
- [x] 将基础知识库幂等写入 SQLite；
- [x] 实现 `SqliteTrendStore` 并将热点迁移默认存储切换到 SQLite；
- [x] 保留原始采集 JSON 作为可提交、可重建数据库的事实来源。
- [x] A4 建立首个固定公开来源适配器（维基百科最热词条 REST API），纯转换函数 + 本地 fixture 测试，输出 CollectionBatchSchema 兼容批次。

## 3. 当前里程碑

### M1：本地内容数据基础验证（已完成）

目标：让基础知识和公开热点能够以可追溯、可校验、可去重和可迁移的本地数据闭环运行。

完成条件：

- 基础作品、知名人物、关系和抽象名场面有正式 Schema 与来源证据；
- 采集批次和正式趋势存储有独立 Schema；
- 正式存储通过接口与 JSON 文件实现解耦；
- 跨批次重复热点合并来源，重复运行不产生重复趋势；
- 坏批次被报告并跳过，有效批次仍可入库，失败写入不破坏旧存储；
- 数据校验、测试、类型检查、迁移、候选生成和生产构建通过。

## 4. 当前任务队列

### 已完成切片

- [x] A1 候选流水线读取 SQLite 正式趋势；
- [x] A2 正式趋势查询与原子 JSON 导出；
- [x] B6 网站热点雷达消费正式趋势导出；
- [x] A5 候选持久化与审核状态机；
- [x] B3 今日推荐流读取 approved 候选导出；
- [x] A3 知识库增量合并与去重命令；
- [x] B1 首批小规模素材扩充；
- [x] B2 生成引擎质量升级。
- [x] B4 角色、作品和名场面详情。
- [x] B5 导出与收藏升级。
- [x] A4 固定公开来源适配器。

### Phase 1 待完成

1. A6 统一任务运行日志。

### Phase 2 待完成

1. C1 兼容矩阵；C2 完整制作包；C3 近似度检测；
2. C4 工作台布局；C5 多维筛选；C6 前端模块化；
3. C7 lint/format；C8 桌面与移动端浏览器回归。

### Phase 3 待完成

1. D1 事件采集；D2 创作者偏好画像；D3 可解释排序权重；
2. D4 探索流量；D5 创作历史与项目管理。

### Phase 4 — 条件触发

E1—E5 仅在 `docs/DEVELOPMENT_DIRECTION.md` 的外部依赖和触发条件满足后执行；不得把商业化规划当作当前无条件开发任务。

## 5. 下一轮唯一首选任务

**任务 A4：固定公开来源适配器（已完成）。**

**下一轮任务：A6 — 统一任务运行日志。**

选择理由：A4 已建立维基百科最热词条适配器，Phase 1 仅剩 A6 一项。A6 为采集、迁移、生成和导出各环节建立结构化运行记录，是 Phase 1 的最后一个数据侧任务，也为 Phase 2 的质量评估和可观测性提供基础。按 `docs/DEVELOPMENT_DIRECTION.md` A6 验收条件"采集、迁移、生成、导出各环节有结构化运行记录"，建立统一的任务运行日志 Schema 和记录机制，让各环节的运行结果（成功/失败/部分失败、处理数量、耗时和错误）可追溯、可查询。本任务不依赖外部账号或公网访问，可在现有 CLI 脚本基础上独立验收。

验收条件：

- 新增任务运行日志 Schema（含任务名、开始/结束时间、状态、处理数量、错误列表等字段）；
- 采集（collect:wikipedia）、迁移（migrate:trends）、生成（pipeline:daily）和导出（export:trends、export:candidates）各环节产生结构化运行记录；
- 运行记录持久化到本地文件或 SQLite，可查询和回溯；
- 覆盖正常运行、部分失败和完全失败的测试；
- 类型检查、全部测试、数据校验和生产构建通过。

## 6. 已知限制与阻塞

- 当前本机项目绝对路径为 `E:\work\linggan`。需要通过 `cmd.exe` 调用 npm 时，显式进入该目录：

  ```powershell
  cmd /d /c "pushd E:\work\linggan && npm run build"
  ```

- SQLite 已选为当前本地正式数据库；部署目标和真实热点来源尚未选择，不阻塞本地闭环开发。
- 只有通过 `CollectionBatchSchema` 并由迁移命令写入正式趋势存储的数据才可供后续系统使用；原始批次仍不直接驱动展示或发布。
- 基础知识库当前有 9 部作品、19 个知名人物、7 组关系和 11 个抽象名场面，仍属于小规模验证，未达到 DEVELOPMENT_DIRECTION.md 4.1 节的 15+ 部作品目标，不能宣称完成大规模热门内容覆盖。
- 自动发布尚无可调用目标，不能仅通过设置 `automatic_publish=true` 宣称完成。
- 当前 20 条持久化候选均为 `pending_review`，真实热点缺少可核实热度和增速时总分约为 52—55；B3 只能展示 `approved` 候选并正确处理无已批准内容，不能为了填满首页放宽状态或编造指标。

## 7. 关键决策

1. 具体知名角色作为 `reference_only`，官方模板默认使用原创角色原型；
2. 自动发布不要求人工审核，但必须经过程序化安全、来源、重复和版权检查；
3. 开发采用小步可验收方式，每轮只推进一个核心目标；
4. `memory/PROGRESS.md` 是唯一当前进度真源；
5. 用户已授权每轮项目改动验证通过后提交并推送当前远程分支；仍禁止强制推送，且未经授权不得部署或产生第三方内容发布。
6. 用户已授权独立采集任务访问公开且允许访问的来源，并将结构化结果仅写入 `data/collection-inbox/`；该授权不包含绕过访问限制、收集敏感信息、下载受保护媒体或对外发布。
7. 开发与内容积累双轨并行：采集任务只新增不可覆盖的原始批次，开发任务负责校验、去重、迁移和后续产品能力，避免双方修改同一业务文件。
8. 项目长期记忆统一放在 `E:\work\linggan\memory`；`memory/PROGRESS.md` 是唯一当前进度真源，定时任务不得在其他目录创建第二份项目记忆。
9. 核心数据契约使用 Zod 同时提供运行时校验和 TypeScript 类型，校验命令与测试复用同一份 Schema，避免类型和运行时规则漂移。
10. 正式趋势存储通过 `TrendStore` 接口隔离，当前使用本地 JSON；未来 PostgreSQL 实现必须保持相同业务语义，不让迁移器依赖数据库客户端。
11. 热点按“分类 + 规范化名称”的 SHA-256 指纹去重，重复来源合并，风险与版权状态采取更保守值。
12. 知名作品、人物和名场面只作 `reference_only`；名场面仅保存抽象冲突、情绪和节奏，不保存台词、截图或视频。
13. SQLite 是当前默认正式存储，数据库文件不提交 Git；原始采集批次和知识库 JSON 提交 Git并可重建数据库，未来 PostgreSQL 通过同一 `TrendStore` 边界接入。
14. 使用 Node 24 内置 `node:sqlite`，当前运行会显示实验性 API 警告；该警告不影响测试和运行，但升级 Node 时必须执行回归测试。

## 8. 迭代日志

### M1 SQLite 正式存储轮 — 2026-07-29

本轮目标：用 SQLite 替换正式趋势 JSON 存储，同时保留原始采集 JSON 和可替换存储边界。

完成：

- 新增 `.env.example`，默认 `DATABASE_URL=file:./data/linggan.sqlite`；
- 新增版本化迁移执行器和 `database/migrations/001_initial.sql`；
- 创建作品、人物、人物关系、名场面、趋势、来源、指标、批次、采集运行、候选和迁移版本表；
- 新增 `npm run database:init`，执行迁移并将基础知识库幂等写入 SQLite；
- 实现 `SqliteTrendStore`，在单个事务中合并趋势、来源、指标和批次映射；
- `npm run migrate:trends` 默认写入 SQLite，仍通过 `TrendStore` 接口与业务逻辑隔离；
- SQLite 文件加入 `.gitignore`；原始采集批次继续提交，可用于重建数据库；
- 删除不再作为正式存储的空 `data/stores/trends.json`。

验证：

- `npm run typecheck`：通过；
- `npm test`：通过，29/29；
- `npm run database:init`：连续执行两次通过，种子数量保持 3 部作品、6 个人物、3 组关系、3 个名场面；
- `npm run migrate:trends`：通过，当前 0 个批次、0 个正式趋势；
- `npm run validate:data`：通过，4 份 JSON 数据有效；
- SQLite 事务测试证明第二条写入失败时第一条不会残留；
- Node 24 的 `node:sqlite` 输出实验性警告，未产生功能失败。

提交、推送和自动化更新结果以本轮最终输出为准。

下一轮：按第 5 节让候选生成读取 SQLite 正式趋势存储。

### M1 基础知识库与热点入库闭环轮 — 2026-07-29

本轮目标：建立可验证的基础内容库，并完成公开热点从采集批次到正式本地趋势存储的安全迁移闭环。

完成：

- 新增作品、知名人物、人物关系、抽象名场面及知识库组合 Schema；
- 建立电视剧、动漫、电影各 1 部的结构验证样本，共 3 部作品、6 个人物、3 组关系和 3 个抽象名场面；
- 新增公开来源证据、采集运行、采集条目、采集批次、正式趋势记录和趋势存储 Schema；
- 实现通用原子 JSON 文档存储，以及与具体数据库解耦的 `TrendStore` 接口和 JSON 适配器；
- 实现 `npm run migrate:trends`，递归读取 `data/collection-inbox/`，隔离坏批次，将有效记录跨批次去重后写入 `data/stores/trends.json`；
- 合并重复趋势的别名、来源、指标、语境、动作和批次 ID，风险与版权采用更保守值；
- 更新数据校验、README、采集目录规则和开发计划。

测试覆盖：

- 非 HTTP(S) 来源拒绝；
- 批次内重复 ID 拒绝；
- 一个坏批次不阻止其他有效批次入库；
- 跨批次重复热点合并多来源证据；
- 同一批次重复迁移保持文件内容不变；
- 无效写入不会破坏旧 JSON；
- 具体知名人物均保持 `reference_only`。

限制：

- 当前基础库是结构验证规模，不是完整热门作品库；
- 三个来源 URL 的本轮网络连通性检查均超时，因此只记录已知公开 URL，不把网络访问标记为成功；
- 正式趋势库当前为空，需热点采集任务恢复后产生首批真实批次；
- 候选生成尚未读取正式趋势库，这是下一轮唯一首选任务。

验证：

- `npm run validate:data`：通过，5 份数据文件有效；
- `npm test`：通过，24/24；
- `npm run typecheck`：通过；
- `npm run migrate:trends`：连续两次空库迁移通过，0 失败、0 重复、正式趋势总数为 0；
- `npm run pipeline:daily`：通过，示例输入生成 2 条候选；
- `npm run build`：通过；
- `git diff --check`：通过；
- 三个外部知识来源 URL 的 HEAD 检查均在 15 秒内超时，未伪造访问成功状态。

自动化：

- “灵感公开热点采集与入库”描述已更新，采集后必须运行迁移、完整验证，并只提交批次与正式趋势库；
- 任务将在本轮代码成功推送后恢复启用，继续保持每天 07:30、13:30、19:30 执行。

提交与推送结果以本轮最终 Git 输出为准。

下一轮：按第 5 节接通正式趋势存储与每日候选生成流水线。

### M0 候选生成器模块化轮 — 2026-07-29

本轮选择：完成当前唯一首选的候选生成器模块化与固定时钟注入，因为这是 M0 剩余的最后一个可重复测试条件，也是后续持久化和任务编排的输入边界。

完成：

- 将候选评分、生成、汇总和日期计算迁入 `src/generation/candidate-generator.ts`；
- 生成函数通过显式 `clock` 获取时间，并在单次运行开始时只读取一次，确保同一固定输入得到完全一致的候选和时间字段；
- 每条生成结果在返回前通过 `CandidateSchema.parse`，并遵守配置中的候选数量和发布分数阈值；
- 将每日流水线迁移为 TypeScript 薄 CLI，只负责读取 JSON、校验输入、调用生成模块和输出报告；
- 增加 4 个候选生成测试，覆盖正常输入、空趋势、固定时钟重复执行和分数边界，测试总数增至 17；
- M0 的全部完成条件已满足，下一轮进入本地持久化边界。

实际修改文件：

- `src/generation/candidate-generator.ts`；
- `scripts/daily-pipeline.ts`（替代 `scripts/daily-pipeline.mjs`）；
- `tests/candidate-generator.test.ts`；
- `package.json`；
- `memory/PROGRESS.md`。

验收与验证：

- `npm run validate:data`：通过，3 份现有 JSON 全部有效；
- `npm test`：通过，17/17；
- `npm run typecheck`：通过；
- `npm run pipeline:daily`：通过，生成 2 条待审核候选，未产生外部发布；
- `npm run build`：通过；
- `git diff --check`：通过；
- 本轮 6 项验收条件全部满足，无失败项。

关键决策与遗留问题：

- 业务模块不读取文件或系统时间，CLI 保留本地输入输出职责；生成时钟在一次调用内只采样一次，避免跨秒导致候选时间字段不一致；
- 候选仍未持久化，生产数据库、部署目标和真实热点来源仍未选择，但这些不阻塞下一轮本地持久化接口开发；
- 本轮代码随并发的规则更新提交 `eadb768` 推送到 `origin/main`，随后单独补交本进度记录；
- 无需要用户处理的阻塞项。

下一轮：按第 5 节设计并实现可测试的本地 JSON 候选持久化接口，为后续 PostgreSQL 适配保留边界。

### Git 自动交付规则更新轮 — 2026-07-29

完成：

- 用户明确要求每次修改完成后创建提交并推送；
- 更新 Agent 入口、开发标准、开发自动化提示词和项目记忆规则；
- 两个定时任务均需只提交各自本轮相关文件并推送当前远程分支；
- 禁止强制推送，远程冲突、认证或网络失败必须记录并报告。

验证与交付：将执行数据校验、测试、类型检查、候选生成、生产构建与差异检查；提交哈希和推送结果以提交后的 Git 输出及本轮最终报告为准。

下一轮：按第 5 节继续推进当前唯一首选任务。

### M0 数据契约与自动测试轮 — 2026-07-29

本轮选择：完成当前唯一首选的 TypeScript 数据契约与自动测试，因为采集、图谱、生成和发布都依赖稳定且可执行的数据边界。

完成：

- 为 `character`、`scene`、`element`、`trend`、`candidate` 及关联枚举定义 TypeScript 类型和 Zod 运行时 Schema；
- 为种子实体、分类字典和趋势收件箱建立组合 Schema；
- 增加统一数据校验命令 `npm run validate:data`；
- 增加 `npm test`、`npm run typecheck` 和 13 个自动测试；
- 覆盖正常数据、非法版权状态、缺失来源、非法来源 URL、越界信号、越界生成性、候选总分/分项越界、跨集合重复实体 ID 和分类重复值；
- 保留了运行期间并发完成的项目记忆目录迁移和运行前已有的采集轨道修改，未恢复已迁移的 `docs/PROGRESS.md`，也未覆盖无关文件。

实际修改文件：

- `src/data/contracts.ts`；
- `scripts/validate-data.ts`；
- `tests/data-contracts.test.ts`；
- `tsconfig.json`；
- `package.json`、`package-lock.json`；
- `memory/PROGRESS.md`。

验收与验证：

- `npm run validate:data`：通过，3 份现有 JSON 全部有效；
- `npm test`：通过，13/13；
- `npm run typecheck`：通过；
- `node --check scripts/daily-pipeline.mjs`：通过；
- `npm run pipeline:daily`：通过，生成 2 条待审核候选，未产生外部发布；
- `npm run build`：通过；
- 本轮验收条件全部满足，无失败项。

关键决策与遗留问题：

- 由同一份 Zod Schema 派生 TypeScript 类型并供 CLI、测试复用；分数统一限制为 0—100，生成性与趋势增速限制为 0—1；
- 当前候选生成器仍是直接读取文件和系统时间的单脚本，尚未达到 M0 的固定时钟与可重复生成要求；
- 暂存热点批次 Schema、跨批次去重和迁移继续保持为独立后续任务；无需要用户处理的阻塞项。

下一轮：按第 5 节将候选生成器拆成可测试 TypeScript 模块，并注入固定时钟。

### 项目记忆目录迁移轮 — 2026-07-29

完成：

- 创建 `memory/README.md`，定义长期记忆边界和跨轮次使用规则；
- 将唯一进度真源从 `docs/PROGRESS.md` 迁移到 `memory/PROGRESS.md`；
- 更新 `AGENTS.md`、开发标准、开发计划和定时开发提示词中的记忆路径；
- 更新“灵感项目持续开发”自动化，要求每轮读取 `memory/README.md` 与 `memory/PROGRESS.md`，并只向后者写入进度；
- 更新“灵感公开热点采集”自动化，使其只读项目记忆、禁止修改 `memory/`；
- 保留热点采集自动化迁移前的暂停状态，未擅自恢复运行；
- 保留工作区内已有的 `package.json`、`package-lock.json` 和内容暂存相关修改。

验证：

- 项目文件中不再引用 `docs/PROGRESS.md`；
- 两个定时任务描述已改为 `E:\work\linggan\memory`；
- 持续开发任务保持启用，热点采集任务保持暂停；
- `npm run build`：通过；
- `npm run typecheck`：通过；
- `npm test`：通过，12 项测试全部通过；
- `git diff --check`：通过；
- 全项目扫描确认，除迁移历史说明外没有仍生效的 `docs/PROGRESS.md` 引用。

下一轮：仍按第 5 节完成 TypeScript 数据契约、运行时校验与首批自动测试。

### 内容采集并行轨道配置轮 — 2026-07-29

完成：

- 将“开发能力建设 + 公开信息积累”确定为并行推进策略；
- 在开发计划中增加 Phase 0 公开信息暂存轨道；
- 建立 `data/collection-inbox/` 的不可覆盖批次规则、来源证据要求和安全边界；
- 调整任务队列，加入暂存数据 Schema、跨批次去重和正式入库迁移工作；
- 已创建并启用每天 07:30、13:30、19:30 运行的独立热点采集自动化。

验收与验证：

- 暂存目录和格式规则已落盘；
- 采集数据与业务数据分离，当前不会自动进入网站或发布流程；
- 旧批次禁止覆盖，无法核实的指标必须为 `null`；
- “灵感公开热点采集”自动化已创建并启用，绑定本地 `work` 项目；
- 自动化权限只允许读取公开来源并在 `data/collection-inbox/` 新增本轮 JSON，禁止修改业务代码、覆盖旧批次或对外发布；
- `npm run build`：通过。

下一轮：仍按第 5 节优先完成 TypeScript 数据契约、运行时校验与首批自动测试，并覆盖热点暂存批次的基础结构。

### 自动化配置轮 — 2026-07-29

完成：

- 将持续开发 Agent 的项目绝对路径统一为 `E:\work\linggan`；
- 清理进度文档中的旧 UNC 路径和不再适用的 UNC 环境说明；
- 创建并启用“灵感项目持续开发”本地 Codex 定时任务，每 6 小时运行一次；
- 自动化绑定本地 `work` 项目，使用高推理强度，仅在运行失败时通知；
- 自动化提示词要求完整读取项目规范、每轮只交付一个最小目标、执行测试与构建并更新本进度文件；
- 保留权限边界：不部署、不推送、不写入真实密钥、不对外发布。

实际修改文件：

- `docs/DEVELOPMENT_AUTOMATION_PROMPT.md`；
- `memory/PROGRESS.md`；
- Codex 本地自动化配置（位于项目目录之外，由桌面应用管理）。

验证结果：

- `node --check scripts/daily-pipeline.mjs`：通过；
- `npm run pipeline:daily`：通过，生成 2 条待审核候选；
- `npm run build`：通过；
- Codex 自动化配置已创建且状态为启用，项目目标为本地 `work`，工作目录为 `E:\work`；
- 项目仍未配置 `npm test` 和 `npm run typecheck`，由下一轮 M0 首选任务补齐。

下一轮：按第 5 节完成 TypeScript 数据契约、运行时校验与首批自动测试。

### 初始化轮 — 2026-07-29

完成：

- 建立 `AGENTS.md` 强制读取入口；
- 建立详细持续开发规范；
- 建立唯一进度文件；
- 盘点当前功能和缺口；
- 确定 M0 里程碑与下一轮唯一任务。

验证基线：

- 每日候选脚本成功生成 2 条候选；
- Vite 生产构建成功；
- 自动发布尚未实现。

下一轮：按第 5 节完成 TypeScript 数据契约与自动测试。
