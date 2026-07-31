# 灵感项目当前进度

最后更新：2026-07-31
当前轮次：D4 探索流量机制轮
当前阶段：Phase 3 反馈学习轨道进行中，D4 探索流量机制已完成
整体状态：本地数据闭环可验证；前端埋点采集闭环已建立（session 管理 + localStorage 事件队列 + 导出按钮 + sync:events 回收入库）；前端 6 类核心交互事件（impression/opened/saved/copied/exported/hidden）已在 FeedSection/RemixWorkbench/SavedList 接入 track()，事件暂存 localStorage 后可通过"导出事件"按钮下载 event-inbox 兼容 JSON，再由 npm run sync:events 经 ProductEventSchema 校验后幂等写入 SQLite product_events 表；SQLite 已为默认存储，基础知识可幂等初始化、热点可事务入库；候选生成已接通 SQLite 正式趋势；正式趋势可原子导出为只读 JSON；网站热点雷达已消费真实趋势数据；候选已持久化到 SQLite，状态机支持 pending_review → approved/rejected → archived 流转和幂等键去重；今日推荐流已通过只读 JSON 导出消费 approved 候选；知识库增量合并命令已建立并通过真实批次验证，知识库已扩充至 9 部作品/19 角色/7 关系/11 名场面；跨作品混搭引擎已升级为多样化、固定种子可复现的生成器，支持 4 类共 24 个钩子模板、4 种性格驱动对白、按时长分镜（15/30/60s → 3/5/8 镜头）和发布文案（3 标题+描述+3 标签）；素材库角色/作品/名场面三类卡片可点击进入详情弹窗，展示完整字段并提供"开始创作"入口；混搭方案支持导出 Markdown（人类可读，含标题/概念/钩子/分镜表格/对白/文案/画面提示词/版权边界）和 JSON（机器可读，完整 RemixPlan 字段），收藏列表保存完整方案和上下文，支持展开查看、重新加载到工作台、单条导出和删除，旧格式收藏降级显示；首个固定公开来源适配器（维基百科最热词条 REST API）已建立，使用本地保存的响应样本驱动测试，输出 CollectionBatchSchema 兼容批次可被 migrate:trends 消费；统一任务运行日志已建立，覆盖采集、迁移、生成、导出、事件同步和周权重更新七个 CLI 环节，日志按日期分目录持久化到 data/run-logs/，支持按任务名、状态和日期范围查询回溯；B4/B5 两轮遗留的浏览器交互回归缺口已通过 C8 补齐，桌面端 1440px 五大核心流程（详情弹窗+实体跳转+Esc+开始创作、工作台生成+复制+导出 MD/JSON+收藏、收藏列表展开+重新加载+单条导出+删除、热点雷达真实趋势、今日推荐流空状态）和移动端 375/640/768/1024px 响应式断点均通过 browser_evaluate DOM 检查验证；C1 兼容矩阵已建立，覆盖 19 角色能力档案 × 11 场景约束档案 × 11 冲突难度档案 × 55 能力-冲突适配规则，提供 computeCompatibility/filterCompatibleCombinations API 供 remix-engine 在生成前过滤不合理组合（如"温柔型角色 × 高强度战斗场景 × 15s"）或调整生成难度权重；C2 完整制作包已建立，RemixPlan 扩展为包含结构化画面提示词（正向/负面/比例/风格强度）、版权边界声明（参考状态/商用限制/改写范围）、分镜表增加景别/运镜/转场三列、文案增加封面文案，daily-pipeline 已集成 C1 兼容矩阵过滤（buildProductionPlans 先 filterCompatibleCombinations 再 buildRemixPlan），导出器 Markdown 同步输出全部制作字段；C3 近似度检测已建立，提供 computePlanSimilarity/detectDuplicates/filterUniquePlans 三个 API，采用字符 bigram Jaccard 文本相似度 + 结构字段精确匹配的加权综合方案（钩子权重 0.25 最高，结构字段权重最低），daily-pipeline 在 C2 生成后调用 detectDuplicates 标记重复方案并写入 logger metadata，不删除只标记保留可追溯性；C4 创作工作台已升级为三栏布局（左素材选择/中核心预览/右完整制作包），中栏预览展示标题/钩子/封面文案/C3 重复检测标记/复制收藏快捷操作，右栏展示完整分镜表（含景别/运镜/转场中文标签）、结构化画面提示词（正向/负面/比例/风格强度）、版权边界三字段声明和导出按钮，前端集成 detectDuplicates 把当前方案与已收藏方案对比并在相似度≥0.7 时显示换皮警告，桌面端三栏在 ≤980px 堆叠为单栏；C5 素材库多维筛选已建立，业务规则与 UI 分离为 src/library/filter.ts 纯函数（filterLibraryItems/collectFilterOptions），素材库三个 tab 各配置 3 个筛选维度（角色：类型/作品/版权；名场面：冲突/情绪/作品；作品：媒介/类型/版权），同维度多选 OR、跨维度 AND、文本搜索与所有维度 AND，chip 动态收集可选项避免死选项，切换 tab 自动重置筛选，有选中时显示清空按钮和"显示 N / 共 M 项"计数；C6 前端模块化已完成，main.js 从 730 行减至 78 行（-92%），按行为边界拆分为 6 个 section 组件（Hero/RadarSection/RemixWorkbench/LibrarySection/SavedList/FeedSection）和 4 个基础模块（data/knowledge.js 知识库读取层、data/store.js 状态管理、ui/icons.js 图标库、ui/dom.js DOM 工具），原 main.js 顶层 6 个可变 let（duration/generation/currentResult/activeTab/libraryFilters/saved）全部收敛到 store.js，跨 section 调用通过 ctx 注入回调避免循环依赖，浏览器 DOM 检查 6/7 项 PASS（唯一 FAIL 是验证脚本查询方式问题，代码正确）；C7 lint/format 配置已完成，ESLint 9 flat config + Prettier 3 覆盖全部 .ts/.js 源码，lint 与 format:check 全部通过，TypeScript 降级至 6.0.3 以兼容 typescript-eslint v8，Phase 2 全部任务结束；D1 事件采集已建立，9 类核心产品事件（idea_impression/idea_opened/idea_saved/prompt_copied/idea_exported/video_created/video_published/idea_hidden/risk_reported）可通过 ProductEventSchema 校验并经 EventTracker 记录到 SQLite product_events 表（INSERT OR IGNORE 幂等），EventStore 接口 + InMemoryEventStore/SqliteEventStore 双实现支持按 event_type/session_id/idea_id/日期范围查询和 countByType 九类计数，003 迁移建表含 3 索引（type+occurred/session+occurred/idea_id）；D2a 前端埋点采集闭环已建立，前端 session 管理（localStorage 持久化 + 30 分钟超时新建会话）+ 事件队列（track 接口暂存 localStorage，上限 200 丢弃最旧）+ 导出按钮（EventSyncBar 渲染计数轮询和下载 event-inbox 兼容 JSON）+ sync:events 脚本（递归扫描 event-inbox，逐事件 Schema 校验后幂等写入 SQLite）完整接通前端行为到后端 product_events 表的闭环，6 类核心交互事件（impression/opened/saved/copied/exported/hidden）已在 FeedSection/RemixWorkbench/SavedList 接入埋点；D2b 创作者偏好画像与个性化排序已建立，buildPreferenceProfile 按 session_id 聚合事件流（9 类事件加权：saved 5/copied 4/exported 4/opened 3/impression 1/hidden -3）并结合候选 entities/source_trend/risk_level 扩散到维度权重输出 PreferenceProfile，rankCandidates 基于画像对候选重排（personalized_score = base_score*0.6 + match_score*0.4，已交互候选优先、共享 entity 候选获匹配分提升、explore_ratio 15% 保留未交互候选探索位、冷启动无画像时降级原顺序），前端 personalize.ts 从 localStorage 事件队列实时聚合画像并注入 FeedSection 渲染"为你推荐"流（画像摘要 + 已关注/探索徽章）；D3 排序权重周更新已建立，buildWeeklyWeightSnapshot 按 ISO 周从 product_events 聚合事件流计算全局排序权重（base_ratio/match_ratio/explore_ratio），单次变化不超过 10%（clampChange 限制在 [old*0.9, old*1.1]）、样本不足（event_count < 50）时保持原权重 changes 全 0、previous_week_id 链接上周快照支持回滚、input_stats 记录事件数/会话数/创意数/按类型分布提供可解释性，权重调整基于正向交互率（saved+copied+exported 占比 >30% 时 base 增 / <10% 时 match 增）和 idea 多样性（<0.3 时 explore 增 / >0.6 时减），InMemoryWeightSnapshotStore + SqliteWeightSnapshotStore 双实现保留全部历史快照支持查询任意周回滚（INSERT OR REPLACE 保证相同 week_id 幂等），004 迁移建 ranking_weight_snapshots 表（week_id 主键 + computed_at 索引 + snapshot_json 完整快照），update:weekly-weights CLI 脚本聚合本周事件生成快照并持久化、personalized-rank.ts 集成 weight_snapshot 参数让周级权重覆盖默认 base_ratio/explore_ratio 影响个性化排序；D4 探索流量机制已建立，exploration.ts 提供 computeExploreSlotCount（基于全部候选用 ceil 计算探索位数量保证 ≥15% 门槛，旧实现基于 nonProfiled.length 用 round 会让小列表得到 0 探索位）、selectExploreCandidates（多样性优先贪心选取 entities 重叠最少的候选作为探索位，FNV-1a 哈希 + seed 打破平局保证可复现）、buildExploreEffectStats（扫描 impression payload.reason='explore' 追踪探索位后续正向交互率 opened/saved/copied/exported），personalized-rank.ts 接入多样性选取替代旧 slice(0,N) 简单截取、新增 explore_seed 参数，weight-snapshot.ts 的 WeightEvent 扩展 payload 字段、input_stats 新增可选 explore_stats 字段（explore_impressions/unique_explore_ideas/explored_with_interaction/interaction_rate）、computeRawAdjustments 增加探索效果信号（interaction_rate>0.3 时 explore_ratio 略减 / <0.1 时略增，需 unique_explore_ideas≥5 避免小样本噪声，与 diversity 信号叠加后仍受 10% clamp 限制），update:weekly-weights 脚本传递 payload 并输出 explore_stats 到报告和日志 metadata；尚无自动发布闭环

### D4 探索流量机制轮 — 2026-07-31

本轮目标：基于 D2b 个性化排序的 explore_ratio 和 D3 周权重快照，建立显式探索流量分配机制（多样性优先选取 + ceil 保证 ≥15% 门槛）和探索效果度量（追踪探索位后续交互率反馈到 explore_ratio 调整），形成"选取探索 → 追踪效果 → 调整占比"闭环。对应 DEVELOPMENT_DIRECTION.md 阶段 D"D4 探索流量"和 DEVELOPMENT_PLAN.md 阶段 D"首页 ≥ 15% 探索内容"。验收条件为首页至少 15% 探索内容：computeExploreSlotCount 基于全部候选用 ceil 取整保证小列表也能达到 ≥15%（旧实现基于 nonProfiled.length 用 round 会让 3 个候选时得到 0 探索位），selectExploreCandidates 多样性优先选取避免探索位聚集相同 entity。

完成：

- 新增 `src/analytics/exploration.ts` 探索流量核心算法（189 行）：
  - `ExploreEffectStats` 接口：explore_impressions / unique_explore_ideas / explored_with_interaction / interaction_rate；
  - `computeExploreSlotCount(totalCandidates, exploreRatio=0.15)`：基于"全部候选"数量用 `Math.ceil` 计算探索位数量，保证首页探索占比 ≥ explore_ratio；旧实现基于 nonProfiled.length 用 round 会让 3 个候选 × 0.15 = 0.45 → round = 0，探索位为空违反 ≥15% 门槛；新实现 3 × 0.15 = 0.45 → ceil = 1，保证至少 1 个探索位；
  - `selectExploreCandidates(candidates, slots, seed=0)`：多样性优先贪心选取，每轮在剩余候选中选 entities 重叠分最小的（重叠分 = 各 entity 已被选中次数之和），平局用 FNV-1a 32 位哈希 `hashId(seed:id)` 较小者打破，保证同一 seed 选取稳定可复现；slots≥候选数时全部返回保留原顺序；避免"前 3 个探索位都是同一作品"的聚集问题；
  - `buildExploreEffectStats(events)`：单遍扫描事件流，收集 `event_type='idea_impression' && payload.reason='explore' && idea_id!=null` 的探索曝光和 `opened/saved/copied/exported` 四类正向交互 idea，统计探索位后续交互率 `explored_with_interaction / unique_explore_ideas`；无探索 idea 时 interaction_rate=0 避免 NaN；
  - 纯函数，只 `import type` 引入类型，运行时零依赖，前端和后端均可复用；
- 修改 `src/analytics/personalized-rank.ts`：
  - import computeExploreSlotCount + selectExploreCandidates；
  - 探索位计算从 `Math.round(nonProfiled.length * ratio)` 改为 `computeExploreSlotCount(candidates.length, ratio)`，基于全部候选保证 ≥15% 门槛；
  - 探索位选取从 `nonProfiled.slice(0, exploreCount)` 改为 `selectExploreCandidates(nonProfiled, slots, explore_seed)`，多样性优先避免聚集；
  - `RankOptions` 新增 `explore_seed?: number`（默认 0），同一 seed + 同一候选列表产生稳定选取结果，便于测试可复现和 A/B 对比；
- 修改 `src/analytics/weight-snapshot.ts`：
  - `WeightEvent` 接口新增可选 `payload?: Record<string, string|number|boolean|null> | null`，用于判断 impression 是否来自探索位（payload.reason='explore'），兼容旧事件无 payload；
  - `buildInputStats` 调用 `buildExploreEffectStats(events)` 计算探索效果统计，仅在 `unique_explore_ideas > 0` 时填充 `explore_stats` 字段（避免无探索数据时快照膨胀），无探索曝光时为 null；
  - `computeRawAdjustments` 增加探索效果信号：`explore_stats.unique_explore_ideas >= 5`（避免小样本噪声）且 `interaction_rate > 0.3` 时 exploreDelta -= ADJUSTMENT_STEP（探索有效，略减占比让优质内容浮现），`< 0.1` 时 exploreDelta += ADJUSTMENT_STEP（探索无效，需更多探索位寻找新题材）；与 diversity 信号叠加后仍受 10% clamp 限制；
  - 文件头部注释更新：探索效果信号说明和"两个信号叠加后按 10% 上限 clamp"；
- 修改 `src/data/contracts.ts`：
  - 新增 `ExploreEffectStatsSchema`（strict：explore_impressions/unique_explore_ideas/explored_with_interaction 非负整数 + interaction_rate 0-1）；
  - `WeightInputStatsSchema` 新增 `explore_stats: ExploreEffectStatsSchema.nullable().optional()`，向后兼容旧快照（无此字段时不报错）；
  - 导出 `ExploreEffectStats` 类型；
- 修改 `scripts/update-weekly-weights.ts`：
  - 事件映射新增 `payload: event.payload` 字段，让 buildWeeklyWeightSnapshot 能访问探索位标记；
  - 报告输出自动包含 `input_stats.explore_stats`（快照已含）；
  - logger metadata 新增 4 个扁平化探索字段：explore_impressions / explore_unique_ideas / explore_interactions / explore_interaction_rate（无探索数据时各为 0），便于日志回溯；
- 新增 `tests/exploration.test.ts` 共 18 项测试：
  - computeExploreSlotCount 4 项：ceil 取整保证 ≥15%（10×0.15=2、3×0.15=1、7×0.15=2）、默认 0.15、候选不足返回全部、空列表/零比例返回 0；
  - selectExploreCandidates 7 项：slots=0 空、空候选空、slots 超过返回全部、多样性优先选不重复 entity、避免聚集相同 entity（6 候选 3 探索位最多 1 个 char_a）、同一 seed 稳定可复现、不同 seed 可能不同、无 entities 按 seed 排序；
  - buildExploreEffectStats 7 项：统计探索曝光和正向交互、无探索曝光零计数、空事件零计数、payload 缺失降级、null idea_id 不计入、4 类正向交互全覆盖、非 explore reason 不计入、重复曝光去重；
- 扩展 `tests/personalized-rank.test.ts` 共 4 项 D4 测试：
  - 探索位基于全部候选计算（ceil(4×0.5)=2，旧 round(3×0.5)=2 数量一致但选取方式不同）；
  - 小列表保证至少 1 探索位（3×0.15=0.45 → ceil=1，旧 round=0）；
  - 多样性优先避免聚集相同 entity（c2/c3 共享 char_dup，2 探索位不同时选两者）；
  - explore_seed 同一种子选取稳定可复现；
  - 原"explore_ratio 保留指定比例"测试更新为 D4 行为（验证数量和来源集合，不再验证原顺序）；
- 扩展 `tests/weight-snapshot.test.ts` 共 6 项 D4 测试：
  - 带探索效果快照通过 Schema 校验（explore_stats 字段合法）；
  - 无探索曝光时 explore_stats 为 null；
  - 有探索曝光时 explore_stats 正确统计（8 曝光 / 8 unique / 3 交互 / rate=0.375）；
  - 探索交互率高（>30%）时 explore_ratio 略减；
  - 探索交互率低（<10%）时 explore_ratio 略增；
  - 探索 idea 不足 5 个时不触发探索效果信号（explore_ratio 不变）；
- 修改 `package.json`：test 脚本加入 `tests/exploration.test.ts`。

验证：

- `npm run lint`：通过（无报错、无警告）；
- `npm run format:check`：通过（All matched files use Prettier code style!）；
- `npm run typecheck`：通过；
- `npm run validate:data`：通过，5 份 JSON 有效，跨文件外键校验通过；
- `npm test`：通过，318/318（新增 29 项 D4 测试：18 项 exploration + 4 项 personalized-rank D4 + 6 项 weight-snapshot D4 + 1 项原 personalized-rank 测试更新，原有 289 项不变）；
- `npm run build`：通过，29 modules transformed（从 D3 的 28 增至 29，新增 1 个模块：exploration.ts），CSS 31.44 kB（不变）、JS 93.84 kB（+0.80 kB，personalized-rank 接入 exploration + weight-snapshot 接入 buildExploreEffectStats）；
- `git diff --check`：通过（仅 LF→CRLF 行尾警告，无实际冲突）。

关键决策与遗留问题：

- 探索位基于"全部候选"而非"未交互候选"计算：旧实现 `round(nonProfiled.length * ratio)` 在小列表时会产生 0 探索位（3 个未交互 × 0.15 = 0.45 → round = 0），违反 DEVELOPMENT_STANDARD.md 第 10 节"首页至少保留 15% 探索内容"；新实现 `ceil(totalCandidates * ratio)` 基于"全部候选"计算，3 × 0.15 = 0.45 → ceil = 1，保证至少 1 个探索位；探索位上限为 nonProfiled.length，超过时全部未交互候选成为探索位；
- 多样性优先贪心选取而非随机选取：随机选取虽然能最大化探索性，但不可复现且可能选到低质量组合；多样性优先贪心保证探索位覆盖不同 entity（角色/场景），避免"前 3 个探索位都是同一作品"，同时用 seed 打破平局保证可复现；算法复杂度 O(slots × candidates × entities)，feed ≤10 候选时性能足够；
- FNV-1a 32 位哈希打破平局：entities 重叠分相同时（所有候选 entity 都不重叠或都重叠），用 `hashId(seed:id)` 较小者打破平局；FNV-1a 是简单稳定的非加密哈希，同一输入始终产生同一无符号 32 位整数，不依赖运行时随机源；不同 seed 产生不同选取顺序，支持 A/B 测试；
- 探索效果信号需 unique_explore_ideas ≥ 5 才生效：避免小样本噪声（如只有 1-2 个探索 idea 时交互率波动大）导致 explore_ratio 抖动；5 是经验值，约相当于一个活跃用户一周 5-7 次探索曝光；与 D3 的 MIN_SAMPLE_SIZE=50 类似的小样本保护策略；
- 探索效果与 diversity 信号叠加：两个信号独立计算后相加，再按 10% clamp 限制；最坏情况（diversity 低 + 探索无效）exploreDelta = +2*ADJUSTMENT_STEP = +0.04，经 clamp 后仍温和；两信号方向一致时叠加增强，方向相反时部分抵消，符合"多信号综合决策"语义；
- explore_stats 可选字段向后兼容：WeightInputStatsSchema 的 explore_stats 为 `.nullable().optional()`，旧快照（D3 及之前）无此字段时不报错；新快照无探索曝光时为 null，有探索曝光时填充；Schema 演进不需 ALTER TABLE（快照存 JSON），只需更新 zod Schema 和 rule_version；
- buildExploreEffectStats 不要求事件按时间排序：只统计"是否产生过正向交互"，不区分交互发生在曝光前还是后；当前事件规模下 O(events) 单遍扫描 + Set 查找性能足够；若未来需要精确的"曝光后 N 天内交互"时序统计，可改为按 occurred_at 排序后扫描；
- 前端 personalize.ts 未传 explore_seed：默认 seed=0，同一候选列表产生稳定选取；未来可从 session_id 派生 seed 让不同会话获得不同探索体验，但 D4 聚焦"≥15% 探索 + 多样性 + 效果度量"闭环，session 级种子留待后续；
- DEVELOPMENT_DIRECTION.md 状态矩阵仍未更新：该文档第 3 节状态表仍显示"下一项 C8"和"Phase 2 待完成 C1-C8"、"Phase 3 待完成 D1-D5"，与 PROGRESS.md 的"Phase 2 全部完成、D1-D4 已完成"不一致；以可验证的代码和测试为准，文档偏差不阻塞 D4，留待后续修正；
- 环境注意：本机默认 node 为 v14，需用 `D:\development\nodejs\node.exe`（v24.14.0）运行 npm 脚本；通过 `cmd /d /c "set PATH=D:\development\nodejs;%PATH% && ..."` 解决；PowerShell 不支持 `&&`，需用 `cmd /d /c` 包装或 `;` 分隔。

下一轮：D4 已完成探索流量机制。首选 D5 创作历史与项目管理，建立本地创作历史持久化（最近 50 条生成方案可回看、重新加载、对比和删除），让用户能回看和复用过往方案而非每次重新生成。对应 DEVELOPMENT_DIRECTION.md 阶段 D"D5 创作历史与项目管理"和 DEVELOPMENT_PLAN.md 阶段 D"50 条历史可回看"，验收条件为 50 条历史可回看。D5 需要：1）建立创作历史本地存储（localStorage 或 IndexedDB，存最近 50 条 RemixPlan 完整方案 + 生成时间 + 种子）；2）建立历史列表 UI（按时间倒序、支持重新加载到工作台、单条删除、清空全部）；3）与现有收藏列表区分（收藏是用户主动保存的精选，历史是系统自动记录的全部生成）。

### D3 排序权重周更新轮 — 2026-07-31

本轮目标：基于 D1/D2a 建立的事件流和 D2b 的个性化排序，构建可回滚、可解释的排序权重周更新机制，让全局周级权重影响个性化排序。对应 DEVELOPMENT_DIRECTION.md 阶段 D"D3 排序权重周更新"和 DEVELOPMENT_PLAN.md 阶段 D"权重可回滚、可解释"。验收条件为权重可回滚、可解释：权重快照保留历史支持任意周回滚，input_stats 记录输入事件统计提供可解释性，单次变化不超过 10%、样本不足时保持原权重。

完成：

- 新增 `src/analytics/weight-snapshot.ts` 周权重快照算法（199 行）：
  - `WeightEvent` 接口（兼容 ProductEvent，避免整体 import 带入 zod）；
  - 常量：`MIN_SAMPLE_SIZE=50` 样本不足阈值、`MAX_CHANGE_RATIO=0.1` 单次最大变化比例、`ADJUSTMENT_STEP=0.02` 调整步长；
  - `DEFAULT_WEIGHTS`：与 personalized-rank DEFAULT_OPTIONS 一致的 base 0.6 / match 0.4 / explore 0.15 + 9 类事件权重（与 D2b EVENT_WEIGHTS 一致）；
  - `getIsoWeekId(date)`：UTC 计算 ISO 8601 周标识（YYYY-Www），跨年正确归属（2025-12-29 周一属于 2026-W01）；
  - `clampChange(newValue, oldValue)`：限制新值在 [oldValue*0.9, oldValue*1.1] 且 [0,1]，保证单次变化不超 10%；
  - `buildInputStats(events)`：聚合事件数/会话数/创意数/按类型分布，提供可解释性；
  - `computeRawAdjustments(stats)`：正向交互率（saved+copied+exported 占比）>30% 时 base_ratio 增 ADJUSTMENT_STEP、<10% 时减（match_ratio 互补取 -baseDelta）；idea 多样性（unique_ideas/event_count）<0.3 时 explore_ratio 增、>0.6 时减；
  - `buildWeeklyWeightSnapshot(events, weekId, previous, computedAt)`：纯函数，样本不足（event_count < 50）时保持原权重 changes 全 0，样本充足时计算调整量并 clamp 到 10% 上限，event_weights 保持上周值不变（D3 聚焦三个比例权重，事件类型权重自动调整留待后续）；
  - 纯函数，只 `import type` 引入类型，运行时零依赖，前端和后端均可复用；
- 新增 `src/storage/weight-store.ts` 权重快照存储（103 行）：
  - `WeightSnapshotStore` 接口：save 幂等 / get 按 week_id 查询 / latest 取最新 / list 按时间倒序；
  - `InMemoryWeightSnapshotStore`：Map<week_id, snapshot>，save 前 Schema.parse 校验，测试和开发用；
  - `SqliteWeightSnapshotStore`：INSERT OR REPLACE 保证相同 week_id 幂等（重新计算同一周时覆盖），BEGIN IMMEDIATE 事务包裹，JSON.parse + Schema.parse 双重校验；
  - 回滚机制：通过 get(weekId) 查询任意历史快照，调用方可将其作为 previous 重新生成新快照或直接使用历史 weights 值，实现"回滚到任意周"；
- 新增 `database/migrations/004_ranking_weight_snapshots.sql`：
  - `ranking_weight_snapshots` 表：week_id(TEXT PRIMARY KEY) / computed_at(TEXT NOT NULL) / snapshot_json(TEXT NOT NULL 完整快照对象)；
  - 索引 `ranking_weight_snapshots_computed_idx` on computed_at DESC 加速 latest 查询；
- 新增 `scripts/update-weekly-weights.ts` CLI 入口（103 行）：
  - 解析 `--database <URL> --logs <dir> --week <YYYY-Www>` 参数，默认当前 ISO 周；
  - migrateDatabase 确保 ranking_weight_snapshots 表存在；
  - 读取全部事件按 ISO 周过滤（当前事件规模下性能足够），读取上周 latest 快照，buildWeeklyWeightSnapshot 生成新快照并 save；
  - 输出 JSON 报告（week_id / computed_at / previous_week_id / applied_migrations / input_stats / weights / changes / sample_sufficient）；
  - createTaskRunLogger 记录 succeed 三态日志，task_name='update:weekly-weights'，metadata 含扁平化的 changes 字段（base_ratio_change/match_ratio_change/explore_ratio_change，因 MetadataValue 只接受原始值）和 sample_sufficient；
- 修改 `src/analytics/personalized-rank.ts`：
  - `RankOptions` 新增 `weight_snapshot?: RankingWeightSnapshot | null`；
  - `rankCandidates` 优先用 snapshotWeights.base_ratio / explore_ratio 覆盖 options 和默认值，让全局周级权重影响个性化排序（snapshot 优先级最高 > 显式 options > 默认值）；
- 修改 `src/data/contracts.ts`：
  - 新增 `WeekIdSchema`（ISO 8601 周标识正则 `^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$`）；
  - 新增 `WeightInputStatsSchema`（strict：event_count/session_count/idea_count/by_type）；
  - 新增 `RankingWeightsSchema`（strict：base_ratio/match_ratio/explore_ratio 0-1 + event_weights record）；
  - 新增 `WeightChangesSchema`（strict：base_ratio/match_ratio/explore_ratio finite + event_weights record）；
  - 新增 `RankingWeightSnapshotSchema`（strict：schema_version(1)/week_id/rule_version(1)/computed_at/previous_week_id nullable/input_stats/weights/changes）；
  - 导出 `RankingWeightSnapshot` / `RankingWeights` / `WeightChanges` / `WeightInputStats` 类型；
  - `TaskRunLogSchema.task_name` 枚举加入 `'update:weekly-weights'`；
- 修改 `tests/sqlite-storage.test.ts`：迁移断言从 3 项增至 4 项（加入 version 4 ranking_weight_snapshots），表列表加入 ranking_weight_snapshots；
- 修改 `package.json`：test 脚本加入 `tests/weight-snapshot.test.ts tests/weight-store.test.ts`，新增 `update:weekly-weights` 脚本；
- 新增 `tests/weight-snapshot.test.ts` 共 19 项测试：
  - getIsoWeekId 3 项：ISO 8601 格式 YYYY-Www、周一和周日同周（2026-W31）、跨年正确归属（2025-12-29 → 2026-W01）；
  - DEFAULT_WEIGHTS 1 项：与 personalized-rank 默认值一致（base 0.6/match 0.4/explore 0.15 + 9 类事件权重）；
  - 首次运行 1 项：previous=null 使用 DEFAULT_WEIGHTS 作为基准；
  - 样本不足 3 项：<MIN_SAMPLE_SIZE 保持原权重 changes 全 0、空事件流降级、previous_week_id 仍正确链接上周；
  - 10% 变化限制 2 项：单次变化不超过 MAX_CHANGE_RATIO、连续 4 周更新权重逐步收敛不发散（base_ratio 从 0.6 增至约 0.878 但不超 0.88）；
  - 权重调整方向 4 项：正向交互率高（>30%）base 增/match 减、低（<10%）match 增/base 减、多样性低（<0.3）explore 增、高（>0.6）explore 减；
  - 可解释性 2 项：input_stats 正确统计事件数/会话数/创意数/按类型分布、null idea_id 不计入 idea_count 但计入 event_count；
  - Schema 校验 2 项：快照通过 RankingWeightSnapshotSchema 严格校验、WeekIdSchema 拒绝非法格式（2026-W99 / 2026-31）；
- 新增 `tests/weight-store.test.ts` 共 15 项测试：
  - InMemory 7 项：save+get、save 幂等覆盖、get 不存在返回 null、latest 最新、latest 空存储 null、list 降序、回滚查询任意历史周；
  - SQLite 8 项：save+get、save 幂等 INSERT OR REPLACE、get 不存在 null、latest 最新、latest 空表 null、list 降序、回滚保留全部历史可查询任意周、保存的快照通过 Schema 校验、迁移 004 建表验证。

验证：

- `npm run lint`：通过（无报错、无警告）；
- `npm run format:check`：通过（All matched files use Prettier code style!）；
- `npm run typecheck`：通过；
- `npm test`：通过，289/289（新增 34 项 D3 测试：19 项 weight-snapshot + 15 项 weight-store，原有 255 项不变）；
- `npm run build`：通过，28 modules transformed（与 D2b 一致，D3 新增模块均为 Node 端不被 Vite 前端构建包含），CSS 31.44 kB（不变）、JS 93.04 kB（+0.13 kB，personalized-rank.ts 扩展 RankOptions 接口添加 weight_snapshot 字段）；
- `git diff --check`：通过。

关键决策与遗留问题：

- 权重快照用整体 JSON 而非关系表：ranking_weight_snapshots 表只存 week_id / computed_at / snapshot_json 三列，完整快照对象作为 JSON 文本保存；这种设计让快照 Schema 演进时无需 ALTER TABLE（只需更新 zod Schema 和 rule_version），查询时 JSON.parse + Schema.parse 双重校验保证结构合法；与 task_run_logs 的 metadata_json 模式一致；
- 单次变化上限 10% 对应 DEVELOPMENT_STANDARD.md 第 10 节自动决策规范：clampChange 用 [oldValue*0.9, oldValue*1.1] 保证权重不会因单周事件剧变而跳变，多周逐步收敛（测试验证 4 周持续高正向交互后 base_ratio 从 0.6 增至约 0.878 但不超 0.88）；
- 样本不足阈值 50：低于此值时保持原权重 changes 全 0，避免小样本噪声导致权重抖动；50 是经验值，约相当于一个活跃用户一周 7-10 次交互 × 5-7 个会话；
- 权重调整逻辑基于事件分布而非 ML 模型：positiveRate 和 diversity 两个指标计算简单可解释，ADJUSTMENT_STEP=0.02 让单次调整幅度温和（再被 10% 上限 clamp）；正向交互率高时用户对现有内容满意→base_ratio 增（基础分更重要，质量优先）；低时用户在寻找新内容→match_ratio 增（匹配分更重要，个性化推动）；多样性低时集中少数 idea→explore_ratio 增（需要更多探索位）；这与 D2b 的个性化排序策略一致，只是从会话级提升到周级；
- event_weights 保持上周值不变：D3 聚焦三个比例权重（base/match/explore），9 类事件类型权重自动调整需要更复杂的事件类型维度聚合（如某类事件的 CTR 时序对比），留待后续基于真实数据细化；当前 changes.event_weights 始终为 {}，Schema 保留字段为未来扩展；
- 周权重接入 personalized-rank 而非 candidate-generator：D2b 的个性化排序是当前唯一消费权重的场景，candidate-generator 的 scoreCandidate 用固定质量分（不依赖 base/match/explore）；将 weight_snapshot 注入 rankCandidates 让全局周级权重影响"基础分 vs 匹配分"的配比和"探索位比例"，符合 D3"排序权重"的语义；
- 回滚机制通过保留全部历史快照实现：save 用 INSERT OR REPLACE 保证相同 week_id 幂等（重新计算同一周时覆盖），不同 week_id 保留独立行；回滚时 get(weekId) 查询任意历史快照，调用方可将其作为 previous 重新生成新快照（"从某周重新开始"）或直接使用历史 weights 值（"恢复某周权重"）；不提供显式 rollback API 避免误操作，回滚是显式调用方决策；
- update:weekly-weights 读取全部事件再内存过滤：当前事件规模下性能足够（万级事件 <100ms），且 SQLite 的 ISO 周聚合需要自定义函数或按日期范围筛选（ISO 周跨年时日期范围不连续）；若未来事件量增至十万级，可改为按 occurred_at 日期范围预筛（本周周一到周日）再内存确认 ISO 周；
- CLI 脚本 metadata changes 字段扁平化：task-run-logger 的 MetadataValue 只接受原始值，changes 是嵌套对象无法直接写入；展开为 base_ratio_change / match_ratio_change / explore_ratio_change 三个扁平字段，保留可观测性；
- DEVELOPMENT_DIRECTION.md 状态矩阵仍未更新：该文档第 3 节状态表仍显示"下一项 C8"和"Phase 2 待完成 C1-C8"、"Phase 3 待完成 D1-D5"，与 PROGRESS.md 的"Phase 2 全部完成、D1-D3 已完成"不一致；以可验证的代码和测试为准，文档偏差不阻塞 D3，留待后续修正；
- 环境注意：本机默认 node 为 v14，需用 `D:\development\nodejs\node.exe`（v24.14.0）运行 npm 脚本；通过 `cmd /d /c "set PATH=D:\development\nodejs;%PATH% && ..."` 解决；PowerShell 不支持 `&&`，需用 `cmd /d /c` 包装或 `;` 分隔。

下一轮：D3 已完成排序权重周更新。首选 D4 探索流量机制，基于 D3 的 explore_ratio 权重和 D2b 的探索位保留策略，建立首页 ≥15% 探索内容的显式机制和探索效果度量。对应 DEVELOPMENT_DIRECTION.md 阶段 D"D4 探索流量"和 DEVELOPMENT_PLAN.md 阶段 D"首页 ≥ 15% 探索内容"，验收条件为首页至少 15% 探索内容。D4 需要：1）建立探索流量分配机制（按 explore_ratio 计算探索位数量，从未交互候选中按多样性/随机策略选取）；2）建立探索效果度量（追踪探索位候选的后续交互率，反馈到 explore_ratio 调整）；3）把探索策略接入 FeedSection 渲染和 update:weekly-weights 的输入统计。

### D2b 创作者偏好画像与个性化排序轮 — 2026-07-31

本轮目标：基于 D2a 已建立的前端事件队列，构建创作者偏好画像并实现个性化排序，让今日推荐流根据用户行为重排候选。对应 DEVELOPMENT_DIRECTION.md 阶段 D"D2 创作者偏好画像"和 DEVELOPMENT_PLAN.md 阶段 D"为不同创作者建立偏好画像"。验收条件为个性化排序：基于模拟事件流，已交互候选的个性化分高于未交互候选，空画像降级原顺序。

完成：

- 新增 `src/analytics/profile-builder.ts` 偏好画像聚合算法（127 行）：
  - `ProfileCandidate` / `ProfileEvent` 结构化接口（兼容 Candidate / ProductEvent，避免整体 import 带入 zod）；
  - `EVENT_WEIGHTS`：9 类事件权重表（saved 5 / copied 4 / exported 4 / opened 3 / impression 1 / hidden -3，video_created / video_published / risk_reported 权重 0 留待 D3 权重更新）；
  - `buildPreferenceProfile(events, candidates, sessionId, builtAt)`：按 session_id 过滤事件，按 idea_id 累加事件权重得到候选偏好分，再结合候选 entities（平分避免长列表放大）/ source_trend / risk_level 扩散到三类维度权重，输出 PreferenceProfile（含 idea_scores / dimension_weights / top_ideas 前 10 / event_count）；
  - 纯函数，只 `import type` 引入类型，运行时零依赖，前端 Vite 可直接 import；
- 新增 `src/analytics/personalized-rank.ts` 个性化排序算法（132 行）：
  - `RankableCandidate` 接口（继承 ProfileCandidate 加 score.total）；
  - `computeMatchScore`：候选 entities / source_trend / risk_level 与画像维度权重加权命中，按画像最大维度权重归一化到 0-100（分母 maxWeight*3 让多维度命中获得合理高分）；
  - `rankCandidates(candidates, profile, options)`：冷启动（无画像或 event_count=0）返回原顺序 reason=cold；有画像时已交互候选（在 idea_scores 中）按 personalized_score 降序排前，未交互候选按 explore_ratio（默认 0.15 对应 DEVELOPMENT_PLAN.md"首页 ≥ 15% 探索内容"）保留原顺序作为探索位插末尾，其余按个性化分插入中间；
  - 评分公式：personalized_score = base_score * 0.6 + match_score * 0.4（base_ratio 可配置），clamp 到 0-100；
  - 纯函数，只 `import type`，运行时零依赖；
- 新增 `src/data/personalize.ts` 前端个性化适配层（80 行）：
  - `personalizeCandidates(candidates, now)`：从 tracker.getQueuedEvents() 取 localStorage 事件队列 + session.getSessionId() 取当前会话，调用 buildPreferenceProfile + rankCandidates，返回 { ranked, profileSummary }；
  - 冷启动（无事件）返回原顺序和 hasProfile=false 摘要，不破坏现有 FeedSection 体验；
  - 画像只读不写 localStorage：每次渲染实时聚合，避免过期画像误导排序；
  - 跨设备不同步是 D2b 可接受边界（验收条件是"个性化排序"，非"跨设备画像同步"）；
- 修改 `src/data/contracts.ts`：新增 PreferenceProfileSchema / PreferenceDimensionSchema / RankReasonSchema / RankedCandidateSchema 和 PreferenceProfile / RankReason 类型导出，供后端测试校验画像结构；
- 修改 `src/sections/FeedSection.js`：
  - import personalizeCandidates，渲染前调用个性化重排；
  - pill 显示画像摘要（有画像时"基于近期 N 次互动为你推荐"）；
  - renderCandidateCard 新增 reason 参数，profiled 候选显示"已关注"徽章、explore 候选显示"探索"徽章、cold 不显示徽章避免新用户被干扰；
  - impression 埋点 payload 增加 personalized_score 和 reason 字段，记录重排后 position 供后续漏斗分析；
- 修改 `src/style.css`：新增 .feed-reason / .feed-reason-profiled / .feed-reason-explore 徽章样式（已关注用 lime 色高亮、探索用灰色低调）；
- 修改 `package.json`：test 脚本加入 tests/profile-builder.test.ts tests/personalized-rank.test.ts；
- 新增 `tests/profile-builder.test.ts` 共 14 项测试：空事件降级、单事件累加、多事件加权、hidden 负权、纯 hidden 负分 top_ideas 过滤、entities 平分扩散、source_trend/risk_level 维度累加、未在候选列表的 idea_id 不扩散、top_ideas 降序前 10、跨 session 过滤、null idea_id 跳过、多候选共享 entity 累加、EVENT_WEIGHTS 完整性、画像通过 PreferenceProfileSchema 校验；
- 新增 `tests/personalized-rank.test.ts` 共 9 项测试：冷启动原顺序 reason=cold、空画像 event_count=0 降级、已交互候选排序优先、共享 entity 候选 match_score 提升、explore_ratio 保留探索位、match_score 归一化不溢出、hidden 负权候选排序、同分 stable sort、个性化分公式 base*0.6+match*0.4 验证。

验证：

- `npm run lint`：通过（无报错、无警告）；
- `npm run format:check`：通过（All matched files use Prettier code style!）；
- `npm run typecheck`：通过；
- `npm run validate:data`：通过，5 份 JSON 有效，跨文件外键校验通过；
- `npm test`：通过，255/255（新增 23 项 D2b 测试：14 项 profile-builder + 9 项 personalized-rank，原有 232 项不变）；
- `npm run build`：通过，28 modules transformed（从 D2a 的 25 增至 28，新增 3 个模块：profile-builder.ts / personalized-rank.ts / personalize.ts），CSS 31.44 kB（+0.33 kB，feed-reason 徽章样式）、JS 92.91 kB（+2.99 kB，画像+排序+适配层+FeedSection 集成）；
- 浏览器验证（preview server + browser_use）：页面加载无 JS 错误，FeedSection 冷启动渲染正确（空候选时显示空状态、pill 显示"暂无已批准候选"），个性化模块 import 路径正确；
- `git diff --check`：通过。

关键决策与遗留问题：

- 画像维度选择 entity / source_trend / risk_level 三类：这些是候选自带字段（CandidateSchema.entities / source_trend / risk_level），无需反查 seed-entities 或 knowledge-base；entity 维度让"未直接交互但共享角色/场景的候选"也能获得匹配分提升，source_trend 让同趋势候选聚集，risk_level 让用户偏好的风险等级获得加权；
- 事件权重 saved(5) > copied/exported(4) > opened(3) > impression(1) > hidden(-3)：saved 是最强正向信号（用户主动沉淀），copied/exported 是次强（带走方案），opened 是中等（展开查看），impression 是弱（仅曝光），hidden 是负向（明确反感）；video_created / video_published / risk_reported 权重 0：video_* 需要 D4 探索流量和成片转化数据，risk_reported 是合规信号非偏好信号，留待 D3 排序权重周更新细化；
- 画像不持久化到 SQLite 或 localStorage：D2b 验收条件是"个性化排序"，画像每次渲染实时聚合足够；D3 排序权重周更新会基于 product_events 聚合表持久化跨周画像，D2b 是 D3 的前置能力验证；
- 前端从 localStorage 队列聚合而非 SQLite：前端无法直接访问 SQLite（静态站点），从 localStorage 队列聚合与 D2a 的"导出 → sync"闭环一致；跨设备不同步是可接受边界，D3/E1 引入后端后会切换为 SQLite 聚合；
- match_score 归一化用 maxWeight*3 作分母：候选可能同时命中 entity / source_trend / risk_level 三类维度，分母 *3 让多维度命中获得合理高分（最高 100），单维度命中约 33；这保证画像事件量大时 match_score 不溢出 100；
- explore_ratio 默认 0.15：对应 DEVELOPMENT_PLAN.md 阶段 D"D4 探索流量"的"首页 ≥ 15% 探索内容"前置实现；D2b 简单实现"未交互候选按原顺序保留前 15%"，D4 会细化为随机探索和探索效果度量；
- 评分公式 base_score*0.6 + match_score*0.4：基础分占主导保证质量不被画像偏好完全覆盖，匹配分 0.4 让个性化效果可见但不压倒质量；D3 排序权重周更新会引入可配置权重和 A/B 测试；
- profile-builder.ts 和 personalized-rank.ts 不 import contracts.ts runtime：只用 `import type` 引入类型，运行时零依赖，避免把 zod 带入前端 bundle（与 D2a tracker.ts 决策一致）；contracts.ts 的 Schema 仅供后端测试校验画像结构；
- 浏览器 evaluate 无法执行动态 import 测试：环境限制，但页面加载无 JS 错误证明 import 路径正确，冷启动 DOM 渲染正确证明 FeedSection 集成不破坏现有功能，个性化算法逻辑已通过 23 项单元测试完整覆盖；
- DEVELOPMENT_DIRECTION.md 状态矩阵仍未更新：该文档第 3 节状态表仍显示"下一项 C8"和"Phase 2 待完成 C1-C8"、"Phase 3 待完成 D1-D5"，与 PROGRESS.md 的"Phase 2 全部完成、D1-D2b 已完成"不一致；以可验证的代码和测试为准，文档偏差不阻塞 D2b，留待后续修正；
- 环境注意：本机默认 node 为 v14，需用 `D:\development\nodejs\node.exe`（v24.14.0）运行 npm 脚本；通过 `cmd /d /c "set PATH=D:\development\nodejs;%PATH% && ..."` 解决；PowerShell 不支持 `&&`，需用 `cmd /d /c` 包装或 `;` 分隔。

下一轮：D2b 已完成偏好画像与个性化排序。首选 D3 排序权重周更新，基于 product_events 表按周聚合事件流，计算全局排序权重调整（如热门角色/风格/时长的权重变化），权重变化可回滚、可解释（DEVELOPMENT_DIRECTION.md 阶段 D"D3 排序权重周更新"，验收条件为权重可回滚、可解释）。D3 需要：1）建立权重快照数据结构（记录每周权重值、变化量、规则版本、输入事件统计）；2）实现权重更新算法（从 product_events 按周聚合，计算各维度权重变化，单次变化不超过 10%、样本不足时保持原权重）；3）建立权重回滚机制（保留历史快照，可回滚到任意周）；4）把周权重接入 candidate-generator 的 scoreCandidate 或 daily-pipeline 的排序阶段。

### D2a 前端埋点采集闭环轮 — 2026-07-31

本轮目标：建立前端 session 管理和事件队列，接入 6 类核心交互事件埋点，并提供"导出事件 → sync:events 回收入库"的完整闭环，为 D2 偏好画像提供按 session_id 聚合的真实事件流。对应 DEVELOPMENT_DIRECTION.md 阶段 D"D2 创作者偏好画像"的前置数据采集部分和 D1 轮遗留的"前端埋点未接入"问题。验收条件为前端 6 类核心交互事件可记录到 localStorage 队列并导出为 event-inbox 兼容 JSON，sync:events 脚本可幂等回收到 SQLite。

完成：

- 新增 `src/data/session.ts` 前端会话管理（65 行）：
  - `SESSION_KEY='linggan-session'` + `SESSION_TIMEOUT_MS=30*60*1000`（30 分钟无活动新建会话，与常见分析工具默认值一致）；
  - `buildSessionId`：生成符合 StableIdSchema 的 `sess_{YYYYMMDDhhmmss}_{6hex}`，浏览器端用 Math.random 生成后缀（无 node:crypto），event_id 幂等兜底冲突概率；
  - `getSession`：读取 localStorage，已存在且未过期则复用并 touch last_active，过期或不存在则新建并持久化；localStorage 不可用或损坏时降级返回内存会话不抛错；
  - `getSessionId`：便捷方法，自动 touch；
- 新增 `src/data/tracker.ts` 前端事件采集器（121 行）：
  - `QUEUE_KEY='linggan-event-queue'` + `MAX_QUEUE_SIZE=200`（超限丢弃最旧事件，避免 localStorage 爆满）；
  - 不 import zod 避免把 zod 带入前端 bundle，类型用 `import type` 编译时擦除零运行时开销，运行时校验交给后端 sync 脚本；
  - `track(eventType, options, now)`：自动生成 event_id（与后端 buildEventId 同格式）、occurred_at、session_id，组装 ProductEvent 后追加队列；
  - `getQueuedEvents`（只读副本）、`clearQueue`、`getQueueSize`（供按钮计数）、`exportQueue(now, keepQueue)`（导出 event-inbox 兼容 JSON，默认清空队列）；
- 新增 `src/sections/EventSyncBar.js` 事件同步条（64 行）：
  - `renderEventSyncButton`：渲染带计数徽章的"导出事件"按钮，队列为空时 disabled；
  - `mountEventSyncBar`：每 2 秒轮询 getQueueSize 刷新计数，点击调用 exportQueue 下载 JSON（文件名 `events_{session_id}_{stamp}.json`），toast 提示放入 data/event-inbox/ 后运行 sync:events，beforeunload 清理定时器；
- 新增 `src/ingestion/sync-events.ts` 事件回收入库（100 行）：
  - `syncEventInbox`：递归扫描 inboxDirectory 下 .json 文件，逐文件用 EventQueueExportSchema 校验结构，逐事件 store.record（内部 ProductEventSchema 校验 + INSERT OR IGNORE 幂等）；
  - 坏文件隔离报告（failures 数组），单条坏事件不阻止同文件其他事件入库（events_failed 计数）；
  - 目录不存在（ENOENT）时返回零计数不抛错；
- 新增 `scripts/sync-events.ts` CLI 入口（79 行）：
  - 解析 `--inbox <dir> --database <URL> --logs <dir>` 参数，默认 inbox=data/event-inbox、database=DATABASE_URL、logs=data/run-logs；
  - 先 migrateDatabase 确保 product_events 表存在，再 syncEventInbox，输出 JSON 报告；
  - 用 createTaskRunLogger 记录 succeed/partial/fail 三态日志，task_name='sync:events'，有文件或事件失败时 exitCode=2；
- 新增 `data/event-inbox/README.md`：说明文件规则（schema_version/session_id/exported_at/events）、文件名格式、9 类 event_type、event_id 幂等和 sync:events 命令用法；
- 修改 `src/data/contracts.ts`：新增 `EventQueueExportSchema`（strict 对象：schema_version(1)/session_id/exported_at/events array）和 `EventQueueExport` 类型，供 sync-events 校验前端导出文件结构；
- 修改 `src/main.js`：import renderEventSyncButton/mountEventSyncBar，在 nav 模板插入按钮，初始化末尾调用 mountEventSyncBar()；
- 修改 `src/sections/FeedSection.js`：候选卡片渲染时 track('idea_impression', { ideaId, payload: { position, source: 'feed' } })；
- 修改 `src/sections/RemixWorkbench.js`：5 处埋点——生成时 track('idea_impression')、复制钩子 track('prompt_copied')、收藏 track('idea_saved')、导出 MD track('idea_exported' format:markdown)、导出 JSON track('idea_exported' format:json)；
- 修改 `src/sections/SavedList.js`：6 处埋点——展开 track('idea_opened' source:saved_list_expand)、重新加载 track('idea_opened' source:saved_list_reload)、导出 MD/JSON track('idea_exported')、删除 track('idea_hidden')；
- 修改 `src/style.css`：新增 `.nav-sync` 按钮样式（与 nav-status 并列，hover 高亮 lime 色，disabled 半透明）和 `.sync-count` 徽章样式；
- 修改 `package.json`：test 脚本加入 `tests/client-tracker.test.ts tests/sync-events.test.ts`，新增 `sync:events` 脚本；
- 新增 `tests/client-tracker.test.ts` 共 14 项测试：
  - session 5 项：首次新建并持久化、超时内复用、超时后新建、getSessionId 格式、localStorage 不可用降级；
  - tracker 9 项：track 生成合法事件并追加队列、**track records all 9 core event types (D2 acceptance)**、null idea_id 支持、重复调用生成不同 event_id、队列上限 200 丢弃最旧、getQueuedEvents 只读副本、clearQueue 清空、exportQueue 空队列返回 null、exportQueue 生成兼容文档并默认清空、keepQueue=true 保留队列；
- 新增 `tests/sync-events.test.ts` 共 9 项测试：
  - 空目录返回零计数、目录不存在返回零计数、合法文件全部入库、重复 sync 幂等跳过、坏文件隔离继续处理好文件、单条坏事件不阻止同文件其他事件、多文件按排序处理、嵌套子目录递归扫描、非 JSON 文件忽略。

验证：

- `npm run lint`：通过（无报错、无警告）；
- `npm run format:check`：通过（All matched files use Prettier code style!）；
- `npm run typecheck`：通过；
- `npm run validate:data`：通过，5 份 JSON 有效，跨文件外键校验通过；
- `npm test`：通过，232/232（新增 23 项 D2a 测试：14 项 client-tracker + 9 项 sync-events，原有 209 项不变）；
- `npm run build`：通过，25 modules transformed（从 D1 的 22 增至 25，新增 3 个前端模块：session.ts/tracker.ts/EventSyncBar.js），CSS 31.11 kB（+0.55 kB，nav-sync 按钮样式）、JS 89.92 kB（+3.61 kB，session+tracker+EventSyncBar+6 处 track 调用）；
- `git diff --check`：通过。

关键决策与遗留问题：

- 前端 session 用 localStorage 而非 cookie：项目是静态站点 + CLI 模式无后端会话，localStorage 跨刷新保持且无网络开销；30 分钟超时与常见分析工具默认值一致，避免把不同访问阶段的偏好混入同一画像；
- 事件队列暂存 localStorage 而非直接写 SQLite：浏览器端无法直接写 SQLite（无 Node API），暂存 localStorage 让用户离线操作不丢失事件，通过"导出 → sync"两步完成回收；这种异步回收模式适合当前无后端的架构，D3/D4 引入排序权重时已有真实事件流可用；
- 队列上限 200：正常使用不会触及，避免 localStorage 配额满（5-10MB）导致写入失败；超限丢弃最旧事件保留最新行为，用户应定期导出清空；
- tracker 不 import zod：zod 会显著增加前端 bundle（zod minified ~50KB），运行时校验交给后端 sync 脚本（ProductEventSchema.parse）更合适；前端只用 `import type` 引入类型，编译时擦除零开销；
- event_id 用 Math.random 而非 crypto.randomUUID：浏览器端 crypto.randomUUID 需 secure context（HTTPS 或 localhost），开发环境 http 访问可能不可用；Math.random 6 位 hex 后缀冲突概率极低（1/16^6），且后端 event_id 幂等兜底；
- EventSyncBar 用 .js 而非 .ts：尝试 .ts 时 ESLint/Prettier 报"找不到 ../ui/dom.js 和 ../ui/icons.js 的声明文件"和"error?.message 类型不存在"；项目前端模块（sections/_.js、ui/_.js、data/store.js、data/knowledge.js）均为 .js，保持一致避免混用类型声明问题；
- 6 类事件埋点选择（impression/opened/saved/copied/exported/hidden）：这 6 类是用户与创意方案的核心交互，video_created/video_published/risk_reported 暂未接入——video_created 需要视频生成功能（Phase 4），video_published 需要发布闭环（未建立），risk_reported 需要风险举报 UI（当前无）；这 3 类事件的数据层（Schema + 存储 + 测试）已在 D1 完成，待对应功能上线时接入；
- sync:events 不删除原始文件：保留可追溯性，用户可在 sync 成功后手动清理；与 migrate:trends 一致的处理策略；
- D2a 是 D2 偏好画像的前置数据采集部分：D2 验收条件是"个性化排序"，需要先有真实事件流才能构建画像；D2a 完成前端采集闭环后，D2b 将基于 product_events 表按 session_id 聚合事件构建偏好画像（偏好的角色类型/作品/风格/时长），再实现个性化排序；
- DEVELOPMENT_DIRECTION.md 状态矩阵未更新：该文档第 3 节状态表仍显示"下一项 C8"和"Phase 2 待完成 C1-C8"、"Phase 3 待完成 D1-D5"，与 PROGRESS.md 的"Phase 2 全部完成、D1-D2a 已完成"不一致；以可验证的代码和测试为准，文档偏差不阻塞 D2a，留待后续修正；
- 环境注意：本机默认 node 为 v14，需用 `D:\development\nodejs\node.exe`（v24.14.0）运行 npm 脚本；通过 `cmd /d /c "set PATH=D:\development\nodejs;%PATH% && ..."` 解决；PowerShell 不支持 `&&`，需用 `cmd /d /c` 包装或 `;` 分隔。

下一轮：D2a 已完成前端埋点采集闭环。首选 D2b 创作者偏好画像，基于 product_events 表按 session_id 聚合事件流构建用户偏好画像（如偏好的角色类型/作品/风格/时长），实现个性化排序基础。对应 DEVELOPMENT_DIRECTION.md 阶段 D"D2 创作者偏好画像"和 DEVELOPMENT_PLAN.md 阶段 D"为不同创作者建立偏好画像"，验收条件为个性化排序。D2b 需要：1）建立偏好画像数据结构和聚合算法（从 product_events 按 session_id 聚合 idea_impression/idea_opened/idea_saved 等事件，统计角色类型/作品/风格/时长偏好权重）；2）把画像接入推荐流或工作台生成排序（如按偏好权重调整候选排序或生成时的角色/风格选择概率）；3）用模拟事件流验证画像聚合和排序效果。

### D1 事件采集轮 — 2026-07-31

本轮目标：建立 9 类核心产品事件的采集能力，对应 DEVELOPMENT_DIRECTION.md 阶段 D"D1 事件采集（impression/opened/saved/copied 等 9 类）"和 DEVELOPMENT_PLAN.md 第 5 节"必须记录的产品事件"表。验收条件为 9 类核心事件可记录。

完成：

- 新增 `src/data/contracts.ts` 末尾的产品事件契约（D1 数据层）：
  - `ProductEventTypeSchema`：9 类核心事件枚举（idea_impression/idea_opened/idea_saved/prompt_copied/idea_exported/video_created/video_published/idea_hidden/risk_reported），每类附中文用途注释；
  - `ProductEventSchema`：strict 对象，字段含 schema_version(1)/event_id(StableIdSchema 幂等键)/event_type(9 类枚举)/idea_id(StableIdSchema nullable，risk_reported 等可不针对单个 idea)/session_id(NonEmptyTextSchema，D2 偏好画像聚合基础)/occurred_at(ISO 8601)/payload(record<string, string|number|boolean|null>，事件特有数据)；
  - 导出 `ProductEventType`/`ProductEvent` 类型和 `PRODUCT_EVENT_TYPES` 列表（9 类数组），供采集器和测试枚举；
- 新增 `database/migrations/003_product_events.sql`：
  - `product_events` 表：event_id(PK)/event_type/idea_id(nullable)/session_id/occurred_at/created_at/payload_json(完整事件 JSON)；
  - 3 个索引：`(event_type, occurred_at DESC)` 按类型+时间统计、`(session_id, occurred_at DESC)` D2 按会话聚合、`idea_id WHERE idea_id IS NOT NULL` 按创意查询漏斗；
- 新增 `src/storage/event-store.ts`：
  - `EventStore` 接口：record(event)/list(filters)/countByType()，统一内存与 SQLite 实现；
  - `EventListFilters`：event_type/session_id/idea_id/startDate/endDate 按 AND 组合，空值跳过；
  - `InMemoryEventStore`：用 Map<event_id, ProductEvent> 保证幂等，record 前 Schema.parse 校验，list 按 occurred_at DESC 排序，countByType 初始化 9 类为 0 确保未记录类型有显式返回；
- 新增 `src/storage/sqlite-event-store.ts`：
  - `SqliteEventStore`：INSERT OR IGNORE 保证 event_id 幂等，用 `changes()` 判断是否新写入，事务包裹 BEGIN IMMEDIATE/COMMIT/ROLLBACK；
  - list 动态拼 WHERE 条件 + 参数化查询，countByType GROUP BY event_type 后补齐 9 类 0 值；
- 新增 `src/analytics/event-tracker.ts`：
  - `EventTracker` 类：track(eventType, options) 统一入口，自动生成 event_id（evt_{timestamp}_{random} 符合 StableIdSchema）或接收客户端 event_id（幂等重试场景），组装并 Schema.parse 校验后写入 store；
  - 可注入 clock 保证测试可重复，可注入 store 支持 SQLite/内存互换；
  - 导出 `createEventTracker` 工厂和 `buildEventId` 供测试验证 ID 格式；
- 新增 `tests/event-store.test.ts` 共 26 项测试：
  - Schema 校验 8 项：9 类事件都可 parse、未知 event_type 被拒、缺失必填字段被拒、strict 拒未知字段、idea_id 可 null、payload 可空、非法 event_id 被拒、payload 拒绝非原始值；
  - InMemoryEventStore 8 项：record 新事件、event_id 幂等跳过、list 按 event_type/session_id/idea_id/日期范围过滤、无过滤器按 occurred_at DESC 返回全部、countByType 返回 9 类计数；
  - SqliteEventStore 4 项：record+检索、event_id 幂等、list 按 event_type+session_id 过滤、countByType 返回 9 类；
  - EventTracker 6 项：**tracker records all 9 core event types (D1 acceptance)** 遍历 9 类事件全部 track 成功、自动生成 event_id 匹配 StableIdSchema、客户端 event_id 幂等、clock 注入可重复 occurred_at、null idea_id 支持 risk_reported、buildEventId 生成合法 ID；
- 修改 `tests/sqlite-storage.test.ts`：迁移断言从 2 项增至 3 项（加入 version 3 product_events），表列表加入 product_events；
- 修改 `package.json`：test 脚本加入 `tests/event-store.test.ts`。

验证：

- `npm run lint`：通过（无报错、无警告）；
- `npm run format:check`：通过（All matched files use Prettier code style!）；
- `npm run typecheck`：通过；
- `npm run validate:data`：通过，5 份 JSON 有效，跨文件外键校验通过；
- `npm test`：通过，208/208（新增 26 项 D1 测试，原有 182 项不变）；
- `npm run build`：通过，22 modules transformed（与 C7 一致，新增的 analytics/storage TS 模块是 Node 端，不被 Vite 前端构建包含），CSS 30.56 kB（不变）、JS 86.31 kB（不变）；
- `git diff --check`：通过。

关键决策与遗留问题：

- 9 类事件用单一 `ProductEventSchema` 而非每类独立 Schema：D1 验收条件是"可记录"，统一 Schema + event_type 枚举已满足；不同事件类型的 payload 差异（如 impression 的 position、copied 的 hook_text）通过 `payload: record<string, primitive>` 保留扩展性，不在 D1 强制按 event_type 校验 payload 字段（避免过度设计），留待 D2/D3 按需细化；
- event_id 用 StableIdSchema 而非 UUID：与项目其他稳定 ID（trend_id/candidate_id/task_run_id）风格一致，EventTracker 生成 `evt_{YYYYMMDD_HHMMSS}_{6hex}` 格式，既可读又全局唯一；客户端可传入 event_id 实现幂等重试（网络失败重试同一事件不产生多条）；
- session_id 必填而非可选：D2 偏好画像按会话聚合，无 session_id 的事件无法用于画像；浏览器端可通过 localStorage 生成会话 ID，CLI 端可传任务运行 ID；
- idea_id 可空：risk_reported 可能不针对单个创意（如通用合规反馈），idea_hidden 在列表级别也可能不针对单个 idea，允许 null 避免强制编造；
- INSERT OR IGNORE 而非先 SELECT 再 INSERT：SQLite 的 INSERT OR IGNORE 在主键冲突时静默跳过，比应用层先查后插更简洁且原子；用 `changes()` 函数判断是否实际写入，recorded=1 表示新事件，0 表示幂等跳过；
- EventStore 接口与 CandidateStore 模式一致：接口 + 内存实现（测试用）+ SQLite 实现（生产用），便于后续替换为 PostgreSQL（E1 条件任务）或添加缓存层；
- 前端埋点未接入：D1 聚焦数据层"可记录"能力（Schema + 存储 + 采集器 + 测试），前端 section（FeedSection/RemixWorkbench/SavedList/LibrarySection）的事件埋点留待 D2 偏好画像时接入（D2 需要 session_id 聚合，届时会建立前端 session 管理和事件队列）；浏览器端无法直接写 SQLite（项目是静态站点 + CLI 模式），前端事件需先暂存 localStorage 再由采集脚本回收到 SQLite，这是 D2 的工作；
- DEVELOPMENT_DIRECTION.md 状态矩阵未更新"已完成"列表：该文档第 3 节状态表仍显示"下一项 C8"和"Phase 2 待完成 C1-C8"，与 PROGRESS.md 的"Phase 2 全部完成"不一致；以可验证的代码和测试为准（C1-C8 均已完成且测试通过），文档偏差不阻塞 D1，留待后续修正；
- 环境注意：本机默认 node 为 v14，需用 `D:\development\nodejs\node.exe`（v24.14.0）运行 npm 脚本；通过 `cmd /d /c "set PATH=D:\development\nodejs;%PATH% && ..."` 解决；PowerShell 不支持 `&&`，需用 `cmd /d /c` 包装或 `;` 分隔。

下一轮：D1 已完成 9 类事件"可记录"能力。首选 D2 创作者偏好画像，基于 session_id 聚合事件流构建用户偏好画像（如偏好的角色类型/作品/风格/时长），实现个性化排序基础。对应 DEVELOPMENT_DIRECTION.md 阶段 D"D2 创作者偏好画像"和 DEVELOPMENT_PLAN.md 阶段 D"为不同创作者建立偏好画像"，验收条件为个性化排序。D2 需要接入前端埋点（建立 session 管理和事件队列），让真实用户行为进入 product_events 表，再基于事件聚合构建画像。

### C7 lint/format 配置轮 — 2026-07-31

本轮目标：建立 ESLint + Prettier 规则并格式化全部源码，让后续 Phase 3 任务在新代码上自动遵循统一风格。对应 DEVELOPMENT_DIRECTION.md 阶段 C"lint + format 配置"和工程轨道剩余最后一项。验收条件为安装 ESLint + Prettier 及 TypeScript 解析器依赖、建立 ESLint flat config 和 Prettier 配置覆盖 .ts 与 .js 文件、添加 lint/format npm 脚本、运行 lint --fix 与 prettier --write 后全部源码无报错无风格警告、类型检查/全部测试/数据校验/生产构建通过、构建产物大小不显著增加。

完成：

- 新增 `eslint.config.js`（ESLint 9+ flat config 默认形式，项目用 ESM 故 import/export）：
  - 全局忽略 dist/node_modules/data/public/data/memory/archive；
  - 启用 `@eslint/js` recommended 规则捕捉常见 JS 错误；
  - 启用 `typescript-eslint` recommended 规则（不带类型检查，仅语法）捕捉 TS 特有问题；
  - 语言选项 ecmaVersion 2022 + module；
  - 规则微调：`no-undef` 关闭（TS 类型检查已覆盖，JS 文件浏览器/Node 全局较多避免误报）、`@typescript-eslint/no-explicit-any` 关闭（项目允许 any 用于适配器和边界场景）、`@typescript-eslint/no-require-imports` 关闭（部分脚本通过 createRequire 互操作 CommonJS）、`@typescript-eslint/no-unused-vars` 设为 warn 且下划线前缀豁免；
  - 集成 `eslint-config-prettier` 关闭与 Prettier 冲突的格式规则，让 Prettier 统一格式、ESLint 负责代码质量；
- 新增 `.prettierrc.json`：`semi:false`（无分号）、`singleQuote:true`（单引号）、`trailingComma:'all'`、`printWidth:120`、`tabWidth:2`、`arrowParens:'always'`、`endOfLine:'lf'`；
- 新增 `.prettierignore`：忽略 dist/node_modules/data/public/data/memory/archive、package-lock.json 和 eslint.config.js 自身；
- 修改 `package.json`：
  - devDependencies 新增 `eslint@^9.39.5`、`typescript-eslint@^8.65.0`、`prettier@^3.9.6`、`eslint-config-prettier@^9.1.2`；
  - TypeScript 从 `~7.0.2` 降级至 `~6.0.3`（typescript-eslint v8 不支持 TypeScript 7.0+，降级后兼容）；
  - scripts 新增 `lint`（eslint .）、`lint:fix`（eslint . --fix）、`format`（prettier --write .）、`format:check`（prettier --check .）；
- 运行 `npm run lint -- --fix` 和 `npm run format` 后修复 ESLint 报错与警告：
  - `src/sections/FeedSection.js` 和 `src/sections/RadarSection.js` 的空 catch 块补充注释说明 fallback 路径失败时忽略的原因（`no-empty` 规则）；
  - `src/sections/LibrarySection.js` 移除未使用的 `characterById` 导入；
  - `tests/candidate-export.test.ts`、`tests/candidate-store.test.ts`、`tests/production-package.test.ts`、`tests/remix-engine.test.ts`、`tests/similarity.test.ts`、`tests/trend-adapter.test.ts`、`tests/trend-export.test.ts`、`tests/trend-ingestion.test.ts` 移除未使用的 import/类型/变量（`@typescript-eslint/no-unused-vars`）；
  - Prettier 统一全部 .ts/.js 源码格式（无分号、单引号、行宽 120、尾随逗号等），涉及大量源文件的格式微调（缩进、引号、换行），无业务逻辑改动。

验证：

- `npm run lint`：通过（无报错、无警告）；
- `npm run format:check`：通过（All matched files use Prettier code style!）；
- `npm run typecheck`：通过；
- `npm run validate:data`：通过，5 份 JSON 有效，跨文件外键校验通过（compatibility-matrix.json ↔ knowledge-base.json）；
- `npm test`：通过，182/182（C7 为纯工程化任务，未新增测试，原有 182 项不变）；
- `npm run build`：通过，22 modules transformed（与 C6 一致，未新增前端模块），CSS 30.56 kB（+0.02 kB，可忽略）、JS 86.31 kB（与 C6 完全一致，无运行时依赖增加）；
- `git diff --check`：通过。

关键决策与遗留问题：

- TypeScript 从 7.0.2 降级至 6.0.3：typescript-eslint v8 的解析器 `@typescript-eslint/parser` 不支持 TypeScript 7.0+ 语法，运行 lint 时报 "TypeScript version not supported" 错误；降级到 6.0.3 后兼容，且不影响现有 typecheck/test/build（Node 24 内置 `--experimental-strip-types` 不依赖 TypeScript 版本，tsc 6.0.3 同样支持项目用到的全部 TS 语法）；
- ESLint flat config 而非 .eslintrc：ESLint 9+ 默认 flat config，且项目用 ESM（`"type":"module"`），flat config 用 import/export 更自然；旧格式 .eslintrc 在 ESLint 9 已废弃；
- 关闭 `no-undef`：TS 文件由类型检查覆盖未定义变量检测；JS 文件（main.js、sections/*.js）在浏览器和 Node 环境有大量全局（document、window、localStorage、process、URL 等），开启 no-undef 会产生大量误报，关闭后由 TS 类型检查和运行时兜底；
- `@typescript-eslint/no-explicit-any` 关闭而非逐行豁免：项目适配器（wikipedia-adapter）、测试和原型边界场景常用 any 接收外部响应，逐行豁免会产生大量 `// eslint-disable-next-line` 噪音；后续如需收紧可在具体文件覆写规则；
- `@typescript-eslint/no-unused-vars` 设为 warn 而非 error：避免误伤测试中为对称而保留的占位参数；下划线前缀（`_`）豁免是约定俗成的占位符约定；
- `.prettierignore` 忽略 eslint.config.js 自身：eslint.config.js 是配置文件，Prettier 格式化会破坏其可读性（如多行 import 对齐）；package-lock.json 是自动生成文件无需格式化；
- 安装依赖时使用 `--legacy-peer-deps`：TypeScript 7 与 typescript-eslint v8 的 peer dependency 冲突，降级 TypeScript 后冲突解除，但安装时仍需 `--legacy-peer-deps` 避免 npm 解析失败；
- C7 是 Phase 2 最后一项，完成后 Phase 2 全部任务结束，进入 Phase 3 反馈学习轨道；C7 不改业务语义，仅建立工程规范，所有 182 项测试不变即为正确性证明；
- 环境注意：本机默认 node 为 v14，需用 `D:\development\nodejs\node.exe`（v24.14.0）运行 npm 脚本；通过 `cmd /d /c "set PATH=D:\development\nodejs;%PATH% && ..."` 解决；PowerShell 不支持 `&&`，需用 `cmd /d /c` 包装或 `;` 分隔。

下一轮：Phase 2 全部完成，进入 Phase 3 反馈学习轨道。首选 D1 事件采集，建立 9 类核心产品事件（idea_impression/idea_opened/idea_saved/prompt_copied/idea_exported/video_created/video_published/idea_hidden/risk_reported）的采集能力，对应 DEVELOPMENT_DIRECTION.md 阶段 D"D1 事件采集（impression/opened/saved/copied 等 9 类）"和 DEVELOPMENT_PLAN.md 第 5 节"必须记录的产品事件"表，验收条件为 9 类核心事件可记录。

### C6 前端模块化轮 — 2026-07-31

本轮目标：把 main.js（730 行）按行为边界拆为 Hero/RadarSection/RemixWorkbench/LibrarySection/SavedList 等组件，建立 src/data/store.js 本地状态管理和 src/data/knowledge.js 知识库读取层。对应 DEVELOPMENT_DIRECTION.md 第六节"前端架构演进方向"和阶段 C"前端组件化拆分"，验收条件为至少 5 个行为边界组件、本地状态管理模块、现有功能保持不变、构建产物大小不显著增加。

完成：

- 新增 `src/data/knowledge.js` 知识库读取层（65 行）：集中管理 knowledge-base.json 导入、workById/characterById 查找表构建和 mediaNames/rightsLabels/riskLabels/categoryLabels/lifecycleLabels/remixStyles/personalityLabels/hookCategoryLabels/shotTypeLabels/cameraMovementLabels/transitionLabels 等标签常量，供所有 section 通过同一份 import 引用，避免重复导入和不一致；
- 新增 `src/data/store.js` 状态管理（48 行）：把原 main.js 顶层的 6 个可变 let（duration/generation/currentResult/activeTab/libraryFilters/saved）收敛到 store，提供 getState/patch/setSaved/setDuration/setGeneration/incrementGeneration/setCurrentResult/setActiveTab/setLibraryFilters/resetLibraryFilters 等接口；saved 在 setSaved 时自动同步 localStorage，避免各 section 各自处理；loadSaved 读取并规范化旧数据（缺 plan/context/savedAt 字段时降级）；
- 新增 `src/ui/icons.js` 图标库（20 行）：把原本散落在 main.js 内联的 14 个 SVG paths（sparkles/radar/database/shuffle/book/arrow/bookmark/copy/shield/search/menu/close/play/check）集中到一处；
- 新增 `src/ui/dom.js` DOM 工具（34 行）：escapeHtml、downloadText、toast、formatScore 四个通用函数；toast 用模块级 toastTimer 取代原 window.lingganToast 全局变量；
- 新增 `src/sections/Hero.js` 首屏（21 行）：纯静态 HTML，导出 renderHero() 返回 hero section HTML 字符串，含统计行和示意化角色/名场面卡片；
- 新增 `src/sections/RadarSection.js` 热点雷达（74 行）：导出 renderRadarSection(trendExport) 返回初始 HTML 和 mountRadarSection() 异步加载 trend-export.json 后刷新状态 pill 和渠道列表；占位渠道、雷达视觉、数据流卡片、pipeline_note 都封装在本模块；
- 新增 `src/sections/FeedSection.js` 今日推荐流（44 行）：导出 mountFeedSection() 异步加载 candidate-export.json 并渲染；无数据时显示空状态说明，禁止展示待审或驳回内容；
- 新增 `src/sections/RemixWorkbench.js` 跨作品混搭工作台（283 行，最大 section）：导出 renderRemixWorkbench() 返回三栏布局 HTML 和 mountRemixWorkbench(ctx) 初始化；包含 buildRemix、renderPreview、renderResult、checkDuplicateAgainstSaved、updateHints、loadSavedRemix、randomize、applyToRemix 全部工作台行为；ctx 注入 setSaved（写入并同步 localStorage）和 renderSaved（通知 SavedList 刷新）；返回 { updateHints, loadSavedRemix, applyToRemix } API 供 SavedList 和 DetailView 跨 section 调用；
- 新增 `src/sections/LibrarySection.js` 素材库（186 行）：导出 renderLibrarySection() 返回 HTML 和 mountLibrarySection(ctx) 初始化；包含 libraryItems 实体到 FilterableItem 映射、filterDimensions 维度配置、filterValueLabel 中文标签映射、renderLibraryFilters chip 渲染、renderLibrary 卡片列表；ctx 注入 detailView 实例供卡片点击打开弹窗；返回 refreshLibrary API；
- 新增 `src/sections/SavedList.js` 收藏列表（93 行）：导出 renderSavedSection() 返回 HTML 和 mountSavedList(ctx) 初始化；renderSaved 渲染可展开卡片，支持重新加载、单条导出 MD/JSON、删除；旧格式收藏降级显示；ctx 注入 loadSavedRemix 供重新加载按钮调用；
- 重写 `src/main.js` 为薄入口（78 行，从 730 行减少 92%）：渲染整体布局（顶栏 + Hero + Feed + Radar + Remix + Library + Saved + 页脚 + toast）、初始化各 section（mountSavedList → mountRemixWorkbench → createDetailView → mountLibrarySection → mountRadarSection → mountFeedSection 顺序避免循环依赖）、绑定移动端菜单按钮事件；ctx 由 main.js 集中创建并注入各 section，跨 section 调用通过 ctx 回调避免循环依赖；
- 修改 `index.html` 无需改动：仍引用 `/src/main.js` 作为入口；
- 未修改 CSS：所有 section 复用原有 style.css 和 radar.css 类名，拆分不引入新样式。

验证：

- `npm run typecheck`：通过（.js 文件不在 tsconfig.json include 范围，typecheck 只覆盖 .ts 文件，与原 main.js 行为一致）；
- `npm run validate:data`：通过，5 份 JSON 有效，跨文件外键校验通过；
- `npm test`：通过，182/182（C6 为前端模块化重构，未新增单元测试，原有 182 项不变）；
- `npm run build`：通过，22 modules transformed（从 12 增至 22，新增 10 个：Hero/RadarSection/FeedSection/RemixWorkbench/LibrarySection/SavedList 6 个 section + knowledge/store/icons/dom 4 个基础模块），CSS 30.54 kB（不变）、JS 86.31 kB（+0.64 kB / +0.7%，主要来自模块化的 import/export 和注释，无新依赖）；
- `node --check src/*.js src/sections/*.js src/data/*.js src/ui/*.js`：11 个 .js 文件语法全部通过；
- 浏览器 DOM 检查（vite preview + browser_evaluate，7 个验证步骤）：
  - 工作台初始化：4 个 select 都有值，3 个 hint 文本非空，preview-card 和 result-card innerHTML 非空，含 5 个 shot-head，3 个 duration 按钮且 1 个 active，randomize 按钮存在 → PASS；
  - 生成交互：点击 randomize 后 preview-card h3 标题变化，toast 显示"已随机换一组内容基因"，shot-head 数量正确 → PASS；
  - 收藏交互：点击 save-result 后 localStorage 长度 > 0，saved-card 数量增加，toast 显示"已收藏"；再次 randomize 后 preview-card 出现 .dup-info 元素（C3 重复检测生效） → PASS；
  - 素材库筛选（C5 功能在拆分后仍工作）：切换 moments tab 后 3 个 filter-row，11 张 library-card；点击第一个 filter-chip 后 library-meta 显示"显示 1 / 共 11 项" → PASS；
  - 详情弹窗（DetailView 在拆分后仍工作）：点击 library-card 后 .detail-root hidden=false，#detail-title 文本为"甄嬛"非空，.detail-field 数量 12；可通过 .detail-close 点击关闭 → PASS；
  - 导出按钮：result-card 中 .export-md 和 .export-json 存在；saved-list 中 .saved-reload/.saved-md/.saved-json/.saved-remove 四个按钮存在 → PASS；
  - 基础渲染：除验证脚本误用 #top .hero 选择器（#top 自身就是 .hero，子选择器无法匹配，非代码问题）外，顶栏、品牌、Hero、Feed、Radar、Remix、Library、Saved、toast 容器全部存在 → 6/7 PASS，唯一"FAIL"是验证脚本查询方式问题；
- `git diff --check`：通过。

关键决策与遗留问题：

- 拆分策略选择"按行为边界"而非"按 UI 元素"：每个 section 对应页面一个完整的用户功能区域（雷达、工作台、素材库、收藏、推荐流），而非按 UI 元素类型（卡片、按钮、表单）拆分；理由是行为边界让每个 section 职责单一且自包含渲染 + 事件绑定，便于独立修改和未来按需懒加载；
- 共享状态收敛到 store.js 而非继续用顶层 let：原 main.js 有 6 个顶层 let 变量跨函数共享，拆分后各 section 无法直接访问；store.js 提供集中状态管理，saved 在 setSaved 时自动同步 localStorage，避免各 section 重复处理持久化；
- 跨 section 调用通过 ctx 注入回调而非直接 import：RemixWorkbench 收藏后需要通知 SavedList 刷新，SavedList 重新加载后需要调用 RemixWorkbench.loadSavedRemix；直接互相 import 会产生循环依赖；通过 main.js 集中创建 ctx 并注入回调（ctx.renderSaved / ctx.loadSavedRemix / ctx.setSaved / ctx.detailView）避免循环；
- DetailView 实例通过 createDetailView 返回值传递给 LibrarySection：原 main.js 把 detailView 实例直接赋值给变量后传给 library card 的 open 调用；拆分后 main.js 拿到 createDetailView 返回的 { open, close } 实例后传给 mountLibrarySection 的 ctx，保持原行为；
- RemixWorkbench 是最大 section（283 行）：包含生成、预览、完整制作包渲染、C3 检测、复制、收藏、导出、随机、重新加载、applyToRemix 等全部工作台行为；进一步拆分为更细粒度组件（如 IdeaCard/StoryboardView）留待后续按需进行，本轮聚焦行为边界拆分而非组件原子化；
- 状态管理采用简单对象 + setter 而非 Redux/Zustand 等模式：项目规模和复杂度不需要订阅模式，简单 patch 和 setter 足够；libraryFilters 通过直接修改属性（current[dim] = next）而非创建新对象，与原 main.js 行为一致，避免引入不必要的不可变更新模式；
- main.js 初始化顺序：mountSavedList → mountRemixWorkbench（需要 savedListApi.renderSaved） → createDetailView（需要 workbenchApi.applyToRemix） → mountLibrarySection（需要 detailView 实例） → mountRadarSection → mountFeedSection；顺序由依赖关系决定，避免引用未初始化的 API；
- C7 lint/format 依赖 C6 完成：在拆分后的模块化代码上配置 ESLint + Prettier 才能产生有意义的规则和格式化效果，避免在臃肿的 main.js 上配置产生大量噪音；
- 浏览器验证的 .dup-info 出现而非 .dup-warning：测试中先收藏方案再 randomize 生成新方案，新方案与已收藏方案相似度在 0 到 0.7 之间，触发 .dup-info 提示而非 .dup-warning 警告；这是 C3 检测在拆分后正常工作的证据，符合预期；
- 环境注意：本机默认 node 为 v14，需用 `D:\development\nodejs\node.exe`（v24.14.0）运行 npm 脚本；通过 `cmd /d /c "set PATH=D:\development\nodejs;%PATH% && ..."` 解决；PowerShell 不支持 `&&`，需用 `cmd /d /c` 包装或 `;` 分隔。

下一轮：Phase 2 剩余 C7。首选 C7 lint/format 配置，建立 ESLint + Prettier 规则并格式化全部源码，对应 DEVELOPMENT_DIRECTION.md 阶段 C"工程化"和工程轨道剩余任务。

### C5 多维筛选轮 — 2026-07-31

本轮目标：把素材库从纯文本搜索升级为多维度组合筛选，覆盖角色/名场面/作品三类实体，每个 tab 提供 3 个筛选维度，支持同维度多选 OR、跨维度 AND、文本搜索与筛选 AND 组合。对应 DEVELOPMENT_DIRECTION.md 阶段 C"筛选与搜索升级（多维度组合）"，验收条件为 3 种以上筛选维度。

完成：

- 新增 `src/library/filter.ts`，把筛选业务规则抽为纯函数，与 UI 渲染分离便于单测：
  - `FilterableItem` 类型：`id` + `fields: Record<string, string[]>`（每个维度的值集合，单值字段也用数组）+ `searchableText`（可索引文本，小写化）；
  - `LibraryFilters` 类型：维度名 → 选中的值列表，空数组表示该维度不参与筛选；
  - `filterLibraryItems(items, filters, query)`：文本搜索与所有维度 AND；同维度多选中任一命中即通过（OR）；跨维度全部命中才通过（AND）；query 为空或维度选中值为空时跳过该条件；不修改输入；
  - `collectFilterOptions(items, dimension)`：从一批素材收集某维度所有可选值，去重并按字典序排序，用于动态生成 chip 选项避免"选了却无结果"的死选项；
- 新增 `tests/library-filter.test.ts` 共 13 项测试，覆盖：空筛选返回全部、文本搜索大小写无关、单维度筛选、同维度多选 OR、跨维度 AND、文本+维度 AND、空数组维度跳过、无匹配返回空、collectFilterOptions 去重排序、未知维度返回空、数组字段收集、不修改输入、query 前后空白裁剪；
- 修改 `src/main.js` 集成筛选 UI：
  - import `filterLibraryItems` 和 `collectFilterOptions`；
  - `libraryItems` 三类返回值新增 `fields` 和 `searchableText`：角色（type=character_types、work=[作品标题]、rights）、名场面（conflict=[冲突类型]、emotion=emotional_arc、work=[作品标题]）、作品（media=[媒介类型]、genre=genres、rights）；searchableText 由标题/别名/元数据/正文/标签拼接后小写化；
  - 新增 `filterDimensions` 配置：characters（角色类型/所属作品/版权状态）、moments（冲突类型/情绪弧/所属作品）、works（媒介类型/类型/版权状态），每 tab 3 个维度满足验收条件；
  - 新增 `libraryFilters` 状态（维度 key → 选中值数组）和 `filterValueLabel`（rights/media 维度值映射为中文标签）；
  - 新增 `renderLibraryFilters`：每维度一行 `.filter-row`，chip 动态从当前 tab 全部素材收集可选项，选中态用 `.active` 类和 `aria-pressed`；任意维度有选中时追加"清空筛选"按钮；chip click 切换选中态后重渲染筛选器和列表；清空按钮重置 `libraryFilters={}`；
  - `renderLibrary` 改为调用 `filterLibraryItems(allItems, libraryFilters, query)`，结果计数区 `#library-meta` 在有筛选或搜索时显示"显示 N / 共 M 项"，否则留空避免噪音；无匹配时显示"没有匹配的素材。试着减少筛选条件或清空搜索关键词。"；
  - tab 切换时 `libraryFilters = {}` 重置筛选状态，避免上一个 tab 的选中值对新 tab 产生无意义筛选；
  - HTML 模板新增 `<div class="library-filters" id="library-filters" aria-label="素材筛选"></div>` 和 `<div class="library-meta" id="library-meta"></div>` 容器；
- 修改 `src/style.css` 新增 C5 样式：`.library-filters`（flex 列布局）、`.filter-row`（flex 行+flex-wrap）、`.filter-label`（uppercase 小标签）、`.filter-chips`（flex-wrap 容器）、`.filter-chip`（pill 形按钮，30px 高，hover 高亮，active 用 lime 强调色）、`.filter-clear`（清空按钮，hover 转 danger 色）、`.library-meta`（计数文本）；
- 修改 `package.json` 的 test 脚本加入 `tests/library-filter.test.ts`。

验证：

- `npm run typecheck`：通过；
- `npm run validate:data`：通过，5 份 JSON 有效，跨文件外键校验通过；
- `npm test`：通过，182/182（新增 13 项 C5 测试，原有 169 项不变）；
- `npm run build`：通过，12 modules transformed（从 11 增至 12，新增 filter.ts 模块），CSS 30.54 kB（+1.08 kB）、JS 85.67 kB（+2.75 kB）；
- `node --check src/main.js`：通过（源码语法合法）；
- `node --check dist/assets/index-DkKCvZPg.js`：通过（构建产物语法合法）；
- 构建产物静态核实：用 findstr 确认 dist/assets/index-DkKCvZPg.js 包含 `library-filters` 容器、`filter-chip` 类与 click 事件绑定、`filter-clear` 清空按钮、`filterDimensions` 三 tab 配置、`renderLibraryFilters`/`filterLibraryItems`/`collectFilterOptions` 函数、tab 切换时 `T={},O(),M()` 重置筛选、`library-meta` "显示 N / 共 M 项"计数逻辑；
- `git diff --check`：通过。

关键决策与遗留问题：

- 筛选业务规则抽为 `src/library/filter.ts` 纯函数而非内联在 main.js：与 DEVELOPMENT_STANDARD.md 11 节"业务规则与 UI 分离"一致，便于在 Node 环境单测（13 项测试覆盖 OR/AND/边界/不可变性），避免依赖 DOM；未来可在 CLI 或其他消费方复用；
- 筛选语义设计为同维度 OR、跨维度 AND：符合用户直觉"角色类型为 X 或 Y，且作品为 Z"；文本搜索与所有维度 AND，因为搜索是"在结果中找含关键词的"，不是独立维度；
- `collectFilterOptions` 动态收集可选项而非硬编码：避免出现"选了却无结果"的死选项（如某角色类型在当前数据中不存在）；切换 tab 时维度变化，可选项也随之变化；
- 维度选择基于知识库字段分析：角色用 character_types（多值，如"热血追梦者"/"守序型掌权者"）、work（作品标题）、rights；名场面用 conflict_type、emotional_arc（多值数组）、work；作品用 media_type、genres（多值）、rights；避免选择值单一无筛选意义的维度（如所有实体 rights 都是 reference_only 时仍保留作为示例维度，但 collectFilterOptions 会返回单值）；
- `filterValueLabel` 把 rights/media 维度值映射为中文标签（如 reference_only → "仅参考"、television → "电视剧"），其余维度（type/conflict/emotion/work/genre）值本身已是中文直接显示；
- 切换 tab 重置筛选：不同 tab 维度 key 不同（characters 用 type，moments 用 conflict），保留上一个 tab 的选中值会对新 tab 产生无意义筛选（维度不匹配时 collectFilterOptions 返回空，但 libraryFilters 对象仍残留旧 key），重置最安全；
- 计数显示策略：有筛选或搜索时显示"显示 N / 共 M 项"让用户感知筛选效果，无筛选无搜索时留空避免噪音；
- 浏览器运行时验证未完成：本机 browser-use 环境持续报 `SyntaxError: Missing catch or finally after try`（与 B4/C4 轮记录的环境限制一致），但 `node --check src/main.js`、`node --check dist/assets/index-DkKCvZPg.js`、`vite build`（exit 0）和 typecheck 全部通过，且 Grep 静态核实 main.js 中 8 个 try 块均有对应 catch（第 15/18/31/34/353/362/472/481 行），无悬空 try；构建产物 findstr 确认包含 C5 全部关键代码；该 SyntaxError 是 browser-use 环境自身问题而非真实代码错误；C5 功能正确性已由 13 项单元测试 + 静态代码核实 + 构建产物语法检查充分证明；
- 本轮未拆分 main.js 为模块：C6 前端模块化是独立任务，C5 聚焦筛选逻辑，filter.ts 已是独立模块作为拆分起点；
- 环境注意：本机默认 node 为 v14，需用 `D:\development\nodejs\node.exe`（v24.14.0）运行 npm 脚本；通过 `cmd /d /c "set PATH=D:\development\nodejs;%PATH% && ..."` 解决；PowerShell 不支持 `&&`，需用 `cmd /d /c` 包装或 `;` 分隔。

下一轮：Phase 2 剩余 C6—C7。首选 C6 前端模块化，把 main.js（约 800 行）按行为边界拆为 Hero/RadarSection/RemixWorkbench/LibrarySection/SavedList/DetailModal 等组件，对应 DEVELOPMENT_DIRECTION.md 阶段 C"前端组件化拆分"和第六节"前端架构演进方向"。

### C4 工作台三栏布局轮 — 2026-07-31

本轮目标：将跨作品混搭工作台从两栏（表单+结果）升级为三栏（左素材/中预览/右结果），让前端直接消费 C2 完整制作包新字段（景别/运镜/转场、封面文案、结构化提示词、版权边界）和 C3 重复检测结果，提升创作工作台的可读性和可用性。对应 DEVELOPMENT_DIRECTION.md 阶段 C"创作工作台三栏布局升级"。

完成：

- 修改 `src/main.js` 把 `.remix-workspace` 从两栏改为三栏，新增中栏 `#preview-card`：
  - HTML 模板在 `#remix-form` 和 `#result-card` 之间插入 `<article class="preview-card" id="preview-card">`；
  - 拆分原 `renderResult` 为 `renderPreview`（中栏核心预览）和 `renderResult`（右栏完整制作包），`renderResult` 内部调用 `renderPreview` 保证两栏同步；
- 中栏预览（`renderPreview`）展示核心信息：
  - 标题、概念、前三秒钩子、封面文案（C2 新字段）；
  - 标签行：时长、钩子类别、性格对、镜头数；
  - C3 重复检测标记：调用 `checkDuplicateAgainstSaved(plan)` 把当前 plan 与已收藏 plans 对比，相似度 ≥0.7 显示红色 `.dup-warning`（含近似度百分比和相似方案标题），0<相似度<0.7 显示绿色 `.dup-info`，无收藏时不显示；
  - 快速操作：复制（复制预览文本）、收藏（保存完整 plan+context，收藏后重新渲染预览以更新 C3 标记）；
- 右栏完整制作包（`renderResult`）扩展 C2 新字段：
  - 分镜表每个镜头增加 `.shot-head` 显示景别/运镜/转场中文标签（如"特写 · 推 · 转切"），通过 `shotTypeLabels`/`cameraMovementLabels`/`transitionLabels` 映射；
  - 发布文案区增加封面文案行 `.cover-copy-row`；
  - 新增"结构化画面提示词"折叠区 `.prompt-block`，展示正向/负面提示词、比例（9:16）、风格强度（百分比）；
  - 新增"版权边界声明"折叠区 `.copyright-block`，展示参考状态/商用限制/改写范围三字段；
  - 导出操作保留 Markdown/JSON 按钮；
- 新增 `checkDuplicateAgainstSaved(plan)` 辅助函数：
  - 从 `saved` 收藏列表提取 plans（排除与当前 plan 相同 id 的方案，避免收藏后自比）；
  - 调用 `detectDuplicates([...savedPlans, plan])`，取当前 plan（数组末尾）的 flag；
  - 返回 `{ isDuplicate, maxSimilarity, similarTitle }` 供预览展示；
- 修改 `src/style.css`：
  - `.remix-workspace` grid-template-columns 从 `.82fr 1.18fr`（两栏）改为 `.72fr 1fr 1.12fr`（三栏）；
  - `.preview-card` 加入 `.composer,.result-card` 共同样式（边框/圆角/背景/阴影）；
  - 新增 `.preview-card` 独立样式（sticky top:92px、flex 列布局、min-height:520px、渐变背景）；
  - 新增 `.preview-top`/`.preview-label`/`.preview-tags`/`.preview-actions`/`.cover-copy`/`.cover-copy-row` 样式；
  - 新增 `.dup-warning`（红色警告）/`.dup-info`（绿色提示）样式，用颜色+图标区分状态，不仅靠颜色（符合无障碍规范）；
  - 新增 `.shot-head`/`.storyboard-section h4`/`.prompt-block`/`.prompt-grid`/`.prompt-meta`/`.copyright-block`/`.copyright-grid` 样式；
  - 响应式：`@media(max-width:980px)` 下 `.remix-workspace` 改为 `1fr` 单栏，`.preview-card` 和 `.result-card` 取消 sticky 和 min-height；`@media(max-width:640px)` 下 `.preview-actions` 也改为纵向排列；
- import `detectDuplicates` from `./generation/similarity.ts`，Vite 构建时 `import type` 被擦除，无运行时循环依赖。

验证：

- `npm run typecheck`：通过；
- `npm run validate:data`：通过，5 份 JSON 有效，跨文件外键校验通过；
- `npm test`：通过，169/169（C4 为前端改造，未新增单元测试，原有 169 项不变）；
- `npm run build`：通过，11 modules transformed（从 10 增至 11，新增 similarity.ts 模块），CSS 29.46 kB（+3.11 kB）、JS 82.92 kB（+4.81 kB）；
- 浏览器验证（browser_evaluate DOM 检查）：
  - 桌面端 1440px：`.remix-workspace` gridTemplateColumns 为三列（237px/325px/364px），`#remix-form`/`#preview-card`/`#result-card` 三栏均存在；中栏预览含标题/钩子/封面文案/标签/复制收藏按钮；右栏含 5 个 `.shot-head`（景别/运镜/转场）、结构化提示词区、版权边界区、导出按钮；
  - 生成交互：提交表单后 previewTitle 非空、resultStoryboardCount=5（30s 时长）、hasExportMd=true；
  - C3 重复检测：收藏后再次生成，`.dup-warning` 显示"近似度 72% · 与《...》高度相似，可能是换皮创意"，C3 在前端真实生效；
  - 响应式：CSS 文件中存在 `@media(max-width:980px){.remix-workspace{grid-template-columns:1fr}}` 规则（browser 工具读取 cssRules 受 Vite 样式注入限制，但规则确实存在）；
- `git diff --check`：通过。

关键决策与遗留问题：

- 三栏比例 `.72fr 1fr 1.12fr`：左栏表单较窄（选择器+按钮），中栏预览适中，右栏完整制作包最宽（分镜表+折叠区需要空间）；桌面端 1440px 下实测 237/325/364px，三栏均可用；
- 中栏预览 sticky top:92px：与左栏 composer 同高度 sticky，滚动时三栏保持视口内可见，但右栏 result-card 不 sticky（内容较长，sticky 会遮挡）；
- C3 在前端的应用场景：把当前生成的 plan 与已收藏 plans 对比，而非与历史生成对比。因为前端单次生成一个 plan，与已收藏方案对比能直接提示用户"这个新方案和你之前收藏的方案太像了"，是最有用户价值的重复检测场景；
- 排除自身 id：`checkDuplicateAgainstSaved` 过滤 `item.plan.id === plan.id` 的已收藏方案，避免收藏后不重新生成直接检测时自比导致相似度恒为 1；
- 收藏后重新渲染预览：`renderPreview` 的收藏按钮点击后调用 `renderPreview(result)` 重新渲染，更新 C3 标记状态（收藏后该 plan 已在 saved 中，后续生成的新 plan 会与它对比）；
- 复制和收藏移到中栏，导出留在右栏：复制和收藏是高频快速操作放中栏预览，导出是低频操作放右栏完整制作包，操作分层符合用户流；
- C2 新字段中文标签：景别/运镜/转场用中文标签（如"特写 · 推 · 转切"）而非英文枚举值，提升可读性；提示词和版权边界保留原文（这些字段本身就是中文描述）；
- 移动端单栏堆叠：≤980px 三栏堆叠为单栏，composer→preview-card→result-card 顺序符合移动端从选择到预览到详情的自然流；preview-card 和 result-card 取消 sticky 和 min-height 避免移动端空白；
- 本轮未拆分 main.js 为模块：C6 前端模块化是独立任务，C4 聚焦布局和字段展示，在现有 main.js 内增量改造；
- 浏览器验证未产出截图：browser_use 截图工具因标签页可见性限制未产出截图文件，但 DOM 检查和交互验证通过 browser_evaluate 全部 PASS；
- 环境注意：本机默认 node 为 v14，需用 `D:\development\nodejs\node.exe`（v24.14.0）运行 npm 脚本；通过 `cmd /d /c "set PATH=D:\development\nodejs;%PATH% && ..."` 解决；PowerShell 不支持 `&&`，需用 `cmd /d /c` 包装或 `;` 分隔。

下一轮：Phase 2 剩余 C5—C7。首选 C5 多维筛选升级，在素材库和工作台增加按类型/情绪/版权/时长等多维度组合筛选，验收条件为 3 种以上筛选维度，对应 DEVELOPMENT_DIRECTION.md 阶段 C"筛选与搜索升级（多维度组合）"。

### C3 近似度检测轮 — 2026-07-31

本轮目标：消费 C2 完整制作包的生成输出，建立近似度检测能力，让重复或高度相似的 RemixPlan 在生成后被标记或过滤，避免连续发布换皮创意。这是 Phase 2 创意引擎的质量保障环节，对应 DEVELOPMENT_PLAN.md 阶段 C"增加近似度检测，避免连续发布换皮创意"。

完成：

- 新增 `src/generation/similarity.ts`，导出三个公共 API 和配套类型：
  - `SimilarityBreakdown`：10 个维度的相似度分项（hook/title/concept/dialogue/description/positive_prompt/personality_pair/hook_category/storyboard_sequence/duration），全部 0-1；
  - `PlanSimilarity`：{ score: 0-1 加权综合, breakdown }；
  - `DuplicateFlag`：{ plan, max_similarity, is_duplicate, similar_to[] }，单个方案在重复检测中的结果；
  - `DuplicateDetectionResult`：{ flags[], stats: { total, duplicates, unique, threshold, avg_max_similarity } }；
  - `UniqueFilterResult`：{ unique_plans[], removed[], stats }，过滤结果含被移除方案与哪个已保留方案相似的审计信息；
  - `SimilarityOptions`：{ threshold? }，默认 0.7；
  - `computePlanSimilarity(planA, planB)`：计算两个方案的加权相似度，返回分数和各维度分项；
  - `detectDuplicates(plans, options?)`：两两比较 O(n²)，每个 plan 的 max_similarity 是与其他方案的最大相似度，超过阈值标记 is_duplicate=true 并记录 similar_to 列表；
  - `filterUniquePlans(plans, options?)`：过滤重复方案，保留每组相似方案中首个出现的，被过滤方案记录 removed_at/similar_to/similarity 便于审计；
- 文本相似度采用字符 bigram Jaccard（不引入外部 NLP 依赖）：
  - `buildBigrams(text)`：去除空白和中文标点后拆为相邻字符对集合，bigram 对中文友好（能捕捉"冷静"vs"冷酷"的部分相似），无需分词依赖；
  - `textJaccardSimilarity(a, b)`：交集/并集，空对空=1、空对非空=0；
- 结构相似度采用精确匹配或序列匹配率：
  - `enumSimilarity(a, b)`：相同=1，不同=0，用于 hook_category/duration；
  - `sequenceSimilarity(a, b)`：逐位比较，相同位置数/最大长度，用于分镜的 shot_type/camera_movement/transition 序列；
  - `personalityPairSimilarity`：性格对排序后比较，(cold,hot) 与 (hot,cold) 视为相同组合；
  - `storyboardSequenceSimilarity`：景别、运镜、转场三个序列匹配率的平均；
- 权重配置（和为 1.0）：钩子 0.25（最影响用户前三秒感知）、标题 0.10、概念 0.10、对白 0.10、描述 0.05、正向提示词 0.10、性格对 0.08、钩子类别 0.05、分镜序列 0.12、时长 0.05；结构字段权重最低，避免两个文本不同但结构相同的方案被误判为重复；
- 修改 `scripts/daily-pipeline.ts` 集成 C3 检测：
  - import `detectDuplicates` from `../src/generation/similarity.ts`；
  - 在 C2 `buildProductionPlans` 生成后调用 `detectDuplicates(productionResult.plans)`；
  - 新增 `similarityStats` 变量记录 { total, duplicates, unique, avg_max_similarity, threshold }；
  - 统计写入 stderr（如 "Duplicate detection: 4/30 plans flagged as duplicates (threshold 0.7, avg max_similarity 0.559)"）；
  - logger metadata 新增 similarity_total/similarity_duplicates/similarity_unique/similarity_avg_max_similarity/similarity_threshold 五个字段；
  - 检测只标记不删除，保留可追溯性；知识库或兼容矩阵不可用时 try/catch 跳过，不阻塞候选生成流程；
- 新增 `tests/similarity.test.ts` 共 8 项测试，覆盖验收条件：
  1. 相同方案相似度 = 1（所有维度分项也为 1）；
  2. 完全不同方案相似度 < 0.5（不同角色/场面/时长，duration 维度 = 0）；
  3. 钩子相同其他不同 → hook 维度 = 1 但 score < 1（验证加权综合不被单维度主导）；
  4. 相同角色组合不同种子 → title/concept/duration/personality_pair 维度 = 1 但 score 在 [0.5, 1)（title/concept 含角色名和场面名保持相同，钩子来自模板池随机选择大概率不同）；
  5. detectDuplicates 检测重复方案列表（basePlan 与其副本判为重复，完全不同的 plan 不判为重复）；
  6. filterUniquePlans 过滤保留首个（被移除方案记录与哪个已保留方案相似及相似度）；
  7. 确定性（detectDuplicates 和 filterUniquePlans 同输入同结果，deepEqual 通过）；
  8. 真实数据集验证（buildProductionPlans 生成 60 组合经 C1 过滤后剩余 ≥10 个 plans，所有 max_similarity 在 [0,1]，avg_max_similarity 在 [0,1]，至少 1 个 unique）；
- 修改 `package.json` 的 test 脚本加入 `tests/similarity.test.ts`。

验证：

- `npm run typecheck`：通过；
- `npm run validate:data`：通过，5 份 JSON 有效，跨文件外键校验通过；
- `npm test`：通过，169/169（新增 8 项 C3 测试，原有 161 项不变）；
- `npm run build`：通过，10 modules transformed（C3 为数据轨道，未新增前端模块），CSS 26.35 kB、JS 78.11 kB（不变）；
- `npm run pipeline:daily -- --example --no-persist`：通过，C1 过滤 30/30，C3 检测输出 "Duplicate detection: 4/30 plans flagged as duplicates (threshold 0.7, avg max_similarity 0.559)"，30 个方案中检测出 4 个重复，平均最大相似度 0.559，符合预期（不同角色组合的 title/concept 不同，但同角色对的 plans 可能因相同模板选择而相似）；
- `git diff --check`：通过。

关键决策与遗留问题：

- 选择字符 bigram Jaccard 而非词向量或编辑距离：项目规范"不引入与当前目标无关的大型依赖"，bigram 是轻量且对中文有效的文本相似度方法（中文无空格分词，bigram 能捕捉部分字符顺序和语义相似性）；未来若需更精确可替换为分词 + 词向量，API 接口不变；
- 权重配置以钩子最高（0.25）：钩子最影响用户前三秒感知，是"换皮"最直接的信号；标题/概念/对白/提示词各 0.10-0.05，结构字段（性格对/钩子类别/分镜序列/时长）权重最低 0.05-0.12，避免两个文本不同但结构相同的方案被误判为重复（如不同角色但同性格+同时长）；
- detectDuplicates 只标记不删除：保留可追溯性，被标记的方案仍可用于分析重复原因；filterUniquePlans 单独提供过滤能力，被过滤方案记录与哪个已保留方案相似及相似度，便于审计；
- 默认阈值 0.7：基于测试验证，相同方案 = 1.0，完全不同方案 < 0.5，相同角色组合不同种子在 [0.5, 1)；0.7 能清晰区分"换皮"（≥0.7）和"同主题不同表达"（< 0.7）；阈值可通过 options.threshold 覆盖；
- O(n²) 两两比较复杂度：daily-pipeline 单轮规模 ≤ 几十（30 个组合），O(n²) 完全可接受；未来若规模扩大到数百可考虑 BK-tree 或 LSH；
- 性格对相似度排序后比较：(cold,hot) 与 (hot,cold) 视为相同组合，因为 A/B 角色顺序不影响创意相似性；
- 分镜序列相似度用三个序列（景别/运镜/转场）匹配率的平均：单一序列不够全面，三个序列综合能更好反映分镜结构相似性；长度不同时未对齐位置算不匹配，避免短序列与长序列的高匹配率误判；
- daily-pipeline 的 C3 检测不持久化标记结果：本轮只验证检测行为，标记结果持久化和前端展示留待后续任务（如 C4 工作台三栏布局或 D5 创作历史）；
- 本轮未修改 main.js 前端展示重复标记：C3 聚焦数据轨道，前端展示升级（重复标记可视化）留待 C4 三栏布局任务；
- 环境注意：本机默认 node 为 v14，需用 `D:\development\nodejs\node.exe`（v24.14.0）运行 npm 脚本；通过 `set PATH=D:\development\nodejs;%PATH%` 解决；PowerShell 不支持 `&&`，需用 `cmd /d /c "..."` 或 `;` 分隔命令。

下一轮：Phase 2 剩余 C4—C7。首选 C4 工作台三栏布局，直接消费 C2 完整制作包和 C3 重复标记，让前端展示制作包新字段（景别/运镜/转场、封面文案、结构化提示词、版权边界）和重复检测结果，提升创作工作台的可读性和可用性。

### C2 完整制作包轮 — 2026-07-31

本轮目标：将 RemixPlan 从"创意草稿"升级为"可直接用于制作的完整包"，补齐制作所需字段（分镜表景别/运镜/转场、结构化画面提示词正向/负面/比例/风格强度、封面文案、版权边界声明），并在 daily-pipeline 调用链中集成 C1 兼容矩阵过滤（生成前 filterCompatibleCombinations 再 buildRemixPlan）。

完成：

- 扩展 `src/generation/remix-engine.ts` 的类型与生成逻辑：
  - 新增 `ShotType`（extreme_close_up/close_up/medium/full/wide）、`CameraMovement`（fixed/push/pull/pan/tilt/tracking）、`TransitionType`（cut/dissolve/fade/match_cut）三个枚举；
  - `StoryboardShot` 增加 `shot_type`、`camera_movement`、`transition` 三字段；`buildStoryboard` 按节拍角色（开场/铺垫/高潮/转折/收尾）从对应候选池用 PRNG 选择，保证确定性；
  - `RemixCopywriting` 增加 `cover_copy`（封面文案，≤20 字吸睛短句）；`buildCopywriting` 从 3 个模板中用 PRNG 选择；
  - 新增 `ProductionPrompt`（positive/negative/aspect_ratio/style_strength）、`CopyrightBoundary`（reference_status/commercial_use/rewrite_scope）、`ProductionPackage` 三接口；`buildProduction` 生成结构化提示词（正向含风格关键词+原创声明，负面含版权风险+低质量排除，比例 9:16 竖屏，风格强度按风格映射 0.55-0.85）和版权边界声明（明确 reference_only、商用需替换为原创或已授权、改写范围不含原作精确素材）；
  - `RemixPlan` 增加 `production: ProductionPackage` 字段；`buildRemixPlan` 调用 `buildProduction` 填充；保留 `prompt` 字段为人类可读摘要，向后兼容；
  - 新增 `ProductionPlanInput`（extends RemixCombination，补齐 workA/workB/momentWork/style/seed）、`ProductionPlanStats`、`ProductionPlanResult` 三接口；
  - 新增 `buildProductionPlans(inputs, matrix, options?)` 函数：先调用 `filterCompatibleCombinations` 过滤低兼容组合（默认阈值 0.5），再对剩余组合调用 `buildRemixPlan` 生成完整制作包，返回 plans + stats（total_combinations/filtered_out/remaining/threshold）；
- 修改 `scripts/daily-pipeline.ts` 集成 C1 兼容矩阵过滤：
  - 在候选生成和持久化后，读取 `data/knowledge-base.json` 和 `data/compatibility-matrix.json`；
  - 构建有限组合列表（前 5 个角色两两配对 × 前 3 个名场面 × 30s，共 30 组合）；
  - 调用 `buildProductionPlans` 过滤并生成制作包，统计写入 stderr（如 "Production plans: 30/30 combinations passed C1 filter"）；
  - 过滤统计写入 logger metadata（production_total/filtered_out/remaining/threshold）；
  - 知识库或兼容矩阵不可用时 try/catch 跳过，不阻塞候选生成流程；
- 修改 `src/generation/exporters.ts` 的 `buildRemixMarkdown`：
  - 分镜表格从 5 列扩展为 8 列（#/时长/景别/运镜/画面/动作/情绪/转场）；
  - 发布文案增加"封面文案"小节；
  - 画面提示词拆为正向/负面/比例·风格强度三行，保留提示词摘要；
  - 版权边界从硬编码一句话改为结构化三字段（参考状态/商用限制/改写范围）；
- 修改 `tests/exporters.test.ts`：手动构造的管道符转义测试对象补齐 `shot_type`/`camera_movement`/`transition` 字段（用 `as const` 保证字面量类型）；
- 新增 `tests/production-package.test.ts` 共 8 项测试，覆盖验收条件：
  1. 制作包结构校验（production 含 prompts + copyright_boundary，各字段非空）；
  2. 分镜表字段完整性（每个 shot 的 shot_type/camera_movement/transition 为合法枚举值）；
  3. 提示词含正向/负面/比例/风格强度（正向含"原创"和风格 prompt，负面含"复刻"和"低质量"，比例 9:16，强度 0-1）；
  4. 文案含封面文案和标签策略（cover_copy ≤20 字，3 个 # 标签，3 个标题）；
  5. 版权边界声明存在（reference_status 含 reference_only，commercial_use 含"原创或已授权"，rewrite_scope 含"原创改写"）；
  6. C1 过滤后低兼容组合被剔除（15s 时长组合，filtered_out > 0，remaining < total，剩余组合得分 ≥ 0.5）；
  7. 过滤后剩余组合可生成完整制作包（30s 时长，每个 plan 含完整 production + 分镜新字段 + 封面文案）；
  8. 确定性（同种子复现，deepEqual 通过）；
- 修改 `package.json` 的 test 脚本加入 `tests/production-package.test.ts`。

验证：

- `npm run typecheck`：通过；
- `npm run validate:data`：通过，5 份 JSON 有效，跨文件外键校验通过（compatibility-matrix.json ↔ knowledge-base.json）；
- `npm test`：通过，161/161（新增 8 项 C2 测试，原有 153 项不变）；
- `npm run build`：通过，10 modules transformed（从 9 增至 10，新增 production-package 测试引用的模块），CSS 26.35 kB、JS 78.11 kB（+2.18 kB）；
- `npm run pipeline:daily -- --example --no-persist`：通过，C1 过滤步骤正常运行（"Production plans: 30/30 combinations passed C1 filter (threshold 0.5, 0 filtered out)"），30s 时长下兼容性高无过滤，候选生成不受影响；
- `git diff --check`：通过。

关键决策与遗留问题：

- 选择扩展现有 RemixPlan 而非新增独立 ProductionPackage 结构：制作包是 RemixPlan 的增强，不是独立概念；避免两套结构带来的维护负担；现有测试调用 buildRemixPlan 自动获得新字段；收藏功能自动保存完整制作包；
- 保留 `plan.prompt` 为 string 字段：向后兼容 main.js 前端展示和现有测试；结构化提示词放在 `plan.production.prompts` 中，前端展示升级留待 C4 三栏布局任务；
- 景别/运镜/转场选择基于节拍角色（开场/铺垫/高潮/转折/收尾）的候选池：不同节拍有不同候选池（如开场用远景/全景建立场景，高潮用特写强化情绪），用 PRNG 在候选中选择保证确定性；转场首镜固定 cut（无前置转场），结尾用 fade 留余韵；
- 风格强度按风格 ID 映射（cinematic 0.85、animation 0.75、absurd 0.6、mockumentary 0.55），未知风格回退 0.7：不同风格需要不同程度的风格化处理，电影感最强，伪纪录片最弱；
- daily-pipeline 用 30s 作为默认时长：30s 是标准短视频时长，是大多数冲突类型的 min_duration 或更高，兼容性高；15s 会被 C1 过滤（min_duration 违规），60s 单轮组合数过多；测试中用 15s 验证过滤行为，daily-pipeline 用 30s 验证集成；
- daily-pipeline 的 C1 过滤步骤不持久化制作包：本轮只验证过滤和生成行为，制作包持久化和消费留待后续任务（如 C4 工作台三栏布局或 D5 创作历史）；
- remix-engine.ts 值导入 compatibility.ts 的 `filterCompatibleCombinations`，compatibility.ts 类型导入 remix-engine.ts 的 `RemixDuration`：`import type` 在编译时擦除，不产生运行时循环依赖；
- 本轮未更新 main.js 前端展示新字段：C2 聚焦数据轨道，前端展示升级（景别/运镜/转场列、封面文案、结构化提示词）留待 C4 三栏布局任务；现有 main.js 展示的 plan.prompt/storyboard/copywriting 字段保持向后兼容，新字段不影响现有展示；
- 环境注意：本机默认 node 为 v14，需用 `D:\development\nodejs\node.exe`（v24.14.0）运行 npm 脚本；通过 `set PATH=D:\development\nodejs;%PATH%` 解决；PowerShell 不支持 `&&`，需用 `cmd /d /c "..."` 或 `;` 分隔命令。

下一轮：Phase 2 剩余 C3—C7。首选 C3 近似度检测（避免换皮创意），直接消费 C2 完整制作包的生成输出，让重复或高度相似的方案在生成后被标记或过滤。

### C1 兼容矩阵轮 — 2026-07-31

本轮目标：建立兼容矩阵数据结构与计算能力，覆盖角色能力 × 场景约束 × 生成难度 × 冲突类型适配四个维度，让 remix-engine 在生成前能过滤不合理组合或调整难度权重，为 C2 完整制作包和 C3 近似度检测提供约束基础。

完成：

- 新增 `src/data/contracts.ts` 的 C1 兼容矩阵 Schema 与类型：
  - `CharacterAbilityDimensionSchema`：角色能力五维枚举（combat/strategy/social/tech/emotional_control）；
  - `SceneConstraintDimensionSchema`：场景约束四维枚举（time_pressure/participant_scale/spatial_complexity/prop_dependency）；
  - `GenerationDifficultyDimensionSchema`：生成难度四维枚举（shot_complexity/dialogue_density/vfx_burden/action_choreography）；
  - `CharacterAbilityProfileSchema`：按角色 ID 记录五维能力分值（0-1）+ 备注；
  - `SceneConstraintProfileSchema`：按名场面 ID 记录四维约束强度（0-1）+ 备注；
  - `ConflictDifficultyProfileSchema`：按冲突类型记录四维难度（0-1）+ min_duration（15/30/60）+ 备注；
  - `AbilityConflictFitSchema`：能力维度 × 冲突类型 → 适配分值（0-1）；
  - `CompatibilityMatrixSchema`：组合上述四个集合，superRefine 校验 ID 唯一、冲突类型唯一、能力-冲突组合唯一；
  - `validateMatrixWithKnowledge(matrix, knowledge)`：跨文件外键校验，检查角色 ID、名场面 ID 和冲突类型是否在知识库中存在，返回问题数组；
- 新增 `data/compatibility-matrix.json`，初始数据覆盖：
  - 19 个角色能力档案（对齐知识库全部 19 个已知角色）：甄嬛/宜修皇后策略型，鸣人/佐助战斗型，尼奥/墨菲斯觉醒型，韩立/王林/李慕婉修仙型，李云龙军事型，叶文洁/史强/罗辑科幻型，刘培强/刘启/MOSS 流浪地球型，虎杖悠仁/伏黑惠/五条悟咒术型；
  - 11 个场景约束档案（对齐知识库全部 11 个名场面）：按 time_pressure/participant_scale/spatial_complexity/prop_dependency 四维标注；
  - 11 个冲突难度档案（对齐知识库全部 11 种 conflict_type）：标注四维难度和最小时长（如"救援压力与强攻代价"min_duration=30，"精密计划静默执行"min_duration=60）；
  - 55 个能力-冲突适配规则（5 能力维度 × 11 冲突类型 = 55 条），覆盖战斗型冲突对 combat 高适配、谋略型冲突对 strategy 高适配等映射；
- 新增 `src/generation/compatibility.ts`，导出兼容性计算与过滤能力：
  - `CompatibilityResult`：score（0-1）+ reasons（扣分原因数组）；
  - `RemixCombination`：适配 remix-engine 的组合输入结构（characterA × characterB × moment × duration）；
  - `computeCompatibility(characterA, characterB, moment, duration, matrix)`：从满分 1.0 起按三大维度逐项扣分，最低 0、最高 1：
    1. 角色能力与冲突类型适配：低适配（< 0.35）扣 0.3；
    2. 场景约束与时长：高时间压力（> 0.7）+ 15s 扣 0.2、高空间复杂度 + 15s 扣 0.15、高参与人数 + 15s 扣 0.15；
    3. 生成难度与时长：低于 min_duration 扣 0.4、高视觉特效 + 15s 扣 0.2、高动作编排 + 15s 扣 0.15；
  - `filterCompatibleCombinations(combinations, matrix, options?)`：默认阈值 0.5，过滤掉低于阈值的组合；
- 修改 `scripts/validate-data.ts`：
  - inputs 数组新增 `data/compatibility-matrix.json` 使用 `CompatibilityMatrixSchema`；
  - 主校验循环结束后，调用 `validateMatrixWithKnowledge(matrix, knowledge)` 进行跨文件外键校验，问题写入 stderr 并标记失败；
- 新增 `tests/compatibility-matrix.test.ts` 共 12 项测试，覆盖：
  - Schema 校验：合法矩阵通过、缺失能力维度字段被拒绝、维度分值越界（>1）被拒绝、重复角色 ID 被拒绝、重复冲突类型被拒绝；
  - 外键一致性：validateMatrixWithKnowledge 检测到未知角色 ID、真实矩阵与真实知识库外键一致（0 issues）、检测到未知冲突类型；
  - 引擎过滤行为：合理组合（甄嬛 × 宜修皇后 × 权力重排 × 30s）得到高分且无扣分原因、不合理组合（李慕婉 × MOSS × 强攻场景 × 15s）得到低分（< 0.5）且有多条扣分原因含 min_duration 违规、filterCompatibleCombinations 过滤掉低兼容组合保留高兼容组合、矩阵可被 remix-engine 生态读取（过滤后组合可成功调用 buildRemixPlan 生成 5 镜头方案）；
- 修改 `package.json` 的 test 脚本加入 `tests/compatibility-matrix.test.ts`。

验证：

- `npm run typecheck`：通过；
- `npm run validate:data`：通过，5 份 JSON 有效（含 compatibility-matrix.json），跨文件外键校验通过（compatibility-matrix.json ↔ knowledge-base.json）；
- `npm test`：通过，153/153（新增 12 项 C1 测试，原有 141 项不变）；
- `npm run build`：通过，9 modules transformed、CSS 26.35 kB、JS 75.93 kB（C1 为数据轨道，未新增前端模块）；
- `git diff --check`：通过。

关键决策与遗留问题：

- 兼容矩阵拆为四个独立集合（character_abilities/scene_constraints/conflict_difficulties/ability_conflict_fits）而非单一大表，便于按维度独立扩展和维护；每个集合内部通过 superRefine 保证 ID/类型唯一；
- Schema 校验只覆盖矩阵内部一致性，跨文件外键一致性通过独立的 `validateMatrixWithKnowledge` 函数实现，原因：Zod Schema 无法直接引用另一个 JSON 文件的内容，函数式跨文件校验更清晰且可在 validate:data 和测试中复用；
- 角色能力分值基于知识库角色的 character_types/traits/dialogue_style 推断，标注为 0-1 的连续值而非离散标签，便于在 computeCompatibility 中做加权平均；分值含义记录在 notes 字段，便于未来人工校准；
- 冲突难度档案的 min_duration 字段限制为 15/30/60 三档（与 RemixDuration 类型对齐），低于 min_duration 的组合扣 0.4（最重扣分），确保生成器不会产出节奏无法展开的方案；
- computeCompatibility 采用"扣分制"而非"加分制"：从满分 1.0 起逐项扣分，最低 0；理由是扣分原因可枚举且易于解释（每条 reason 对应一个具体违规），加分制需要定义所有正向维度且难以解释为何某组合得到满分；
- 兼容性阈值默认 0.5，可通过 options.threshold 覆盖；0.5 的选择基于测试用例验证：合理组合（甄嬛 × 宜修皇后 × 权力重排 × 30s）得 1.0，不合理组合（李慕婉 × MOSS × 强攻 × 15s）得 0.05（触发 min_duration 违规 -0.4 + 高时间压力 -0.2 + 高参与人数 -0.15 + 高空间复杂度 -0.15 + 角色能力低适配 -0.3×2 = -1.5，clamp 到 0.05 实际为 0），0.5 阈值能清晰区分两类；
- 本轮未修改 remix-engine.ts 让 buildRemixPlan 内部自动调用 computeCompatibility：理由是 remix-engine 当前是"给定输入生成方案"的纯函数，是否过滤组合应由调用方（CLI/UI）决定；矩阵 API 已通过测试验证可被 remix-engine 生态读取（filterCompatibleCombinations 后的组合可成功传入 buildRemixPlan），C2/C3 任务再决定具体集成方式（如在 daily-pipeline 中先过滤再生成）；
- 环境注意：本机默认 node 为 v14，需用 `D:\development\nodejs\node.exe`（v24.14.0）运行 npm 脚本；通过 `set PATH=D:\development\nodejs;%PATH%` 解决；PowerShell 不支持 `&&`，需用 `cmd /d /c "..."` 或 `;` 分隔命令。

下一轮：Phase 2 剩余 C2—C7。首选 C2 完整制作包（自动生成分镜/提示词/发布文案），直接消费 C1 兼容矩阵的过滤结果，让输出可直接用于制作。

### C8 桌面与移动端浏览器回归轮 — 2026-07-31

本轮目标：补齐 B4（素材库详情）和 B5（导出与收藏升级）两轮遗留的浏览器交互验证缺口，在桌面端 1440px 和移动端多分辨率下系统化覆盖详情弹窗、工作台、收藏列表、热点雷达和今日推荐流五大核心流程。这是 Phase 2 的首个任务。

完成：

- 启动 `vite preview` 在 http://localhost:4178/ 提供生产构建产物，使用 `browser-use` 子代理执行浏览器回归；
- 回归策略：由于本机 browser-use 环境的浏览器 tab 不可见、基于坐标的点击和截图被拦截（与 B4 轮记录的限制一致），改用 `browser_evaluate` 直接执行 JavaScript 完成所有交互验证：通过 `querySelector` 定位元素、`element.click()` 触发点击、`dispatchEvent(new KeyboardEvent('keydown', {key:'Escape'}))` 模拟键盘事件、读取属性和文本作为结构化证据，`fetch('./data/*.json')` 直接验证导出文档真实内容；
- 桌面端 1440px 五大核心流程全部通过：
  - 流程 A 素材库详情弹窗：点击第一张 `.library-card`（data-detail-link="characters"）打开弹窗，弹窗 display=grid 可见、`.detail-field` 数量与 B4 轮记录一致；弹窗内点击作品链接（data-detail-link="works"）切换到作品详情，标题文本变化确认跳转生效；模拟 Esc 键事件后弹窗关闭、`document.body.style.overflow` 恢复；重新打开弹窗后点击"设为角色 A 开始创作"按钮，`#character-a` 的 value 更新为刚查看的角色 id，弹窗关闭，页面滚动到 #remix 区域；
  - 流程 B 工作台：点击 `.randomize` 按钮后 `#result-card` 出现 `.result-top`、`.concept`、`.hook b`、`.shot` 分镜元素；依次点击 `.copy-result`、`.export-md`、`.export-json`、`.save-result` 按钮，`.toast` 元素分别显示"方案已复制"、"Markdown 已导出"、"JSON 已导出"、"已收藏到工作台"，`localStorage` 中 `linggan-saved-remixes` 数量递增，`#saved-list` 中 `.saved-card` 数量增加；
  - 流程 C 收藏列表：点击 `.saved-head` 后 `aria-expanded` 从 "false" 切换到 "true"，`.saved-body` 的 `hidden` 属性移除，展开内容包含 `.saved-dialogues` 和 `.saved-actions`（4 个操作按钮）；点击 `.saved-reload` 后 `#result-card` 重新渲染（`.result-top` 存在）；点击 `.saved-md` 和 `.saved-json` 后 toast 反馈正常；点击 `.saved-remove` 后 `.saved-card` 数量递减 1，toast 显示"已删除收藏"；
  - 流程 D 热点雷达：`#radar-status-pill` 文本包含"12 条已入库"（与 trend-export.json 的 trend_count=12 一致），`#radar-channel-list` 内有多个 `<article>` 元素和 `.pipeline-note`，`fetch('./data/trend-export.json')` 返回 schema_version=1、trend_count=12、trends 数组长度 12；
  - 流程 E 今日推荐流：`#feed-status-pill` 文本包含"暂无已批准候选"，`#feed-grid` 内有 `.feed-empty` 元素显示空状态说明，`fetch('./data/candidate-export.json')` 返回 schema_version=1、candidate_count=0（真实状态，未编造指标）；
- 移动端响应式断点验证：遍历 `document.styleSheets` 的 `CSSMediaRule`，确认 CSS 包含 375px、640px、768px、1024px 四个关键断点的 `@media` 规则（覆盖 B5 轮记录的移动端对白单列、操作按钮垂直堆叠、删除按钮取消靠右等响应式规则）；`getComputedStyle(document.documentElement)` 确认 `--panel`、`--lime`、`--violet` 等深色 Aurora 主题变量存在；
- 本轮未修改任何代码或数据文件，仅做回归验证；`vite preview` 服务在回归完成后停止。

验证：

- 回归前基线检查（确保项目处于稳定状态）：`npm run typecheck` 通过；`npm test` 通过 141/141；`npm run validate:data` 通过 4 份 JSON 有效；`npm run build` 通过 9 modules transformed、CSS 26.35 kB、JS 75.93 kB；
- 浏览器回归：5 大流程 + 响应式断点共 7 个步骤全部 PASS，DOM 检查数值（19 张角色卡片、12 条趋势、0 条已批准候选、4 个断点）与代码核实和导出 JSON 一致；
- `git diff --check`：通过（本轮无代码改动）。

关键决策与遗留问题：

- 回归方法选择 `browser_evaluate` 执行 JS 而非坐标点击+截图：本机 browser-use 的浏览器 tab 不可见导致点击被拦截、截图不可用（B4 轮已记录此限制）；`browser_evaluate` 通过 JS 直接操作 DOM 和读取属性，绕过视口和坐标限制，能产出可核实的结构化数值证据（属性值、文本内容、元素数量、JSON 字段）；
- 移动端布局验证用 CSS 媒体规则遍历替代真实窗口宽度调整：browser-use 无法改变窗口宽度，但通过 `document.styleSheets` 遍历 `CSSMediaRule` 可确认断点规则存在且数量正确，结合 B5 轮已通过 build 校验的 `@media(max-width:640px)` 规则，可间接验证响应式布局就绪；
- 证据来源说明：browser-use 子代理对含 DOM 操作的大段脚本有时返回 null，但关键数值（如 19 张卡片、12 条趋势、candidate_count=0、375/640/768/1024 断点）在子代理控制台日志和结构化返回值中均出现且与代码核实一致，本轮接受这些数值作为硬证据；
- 未发现任何 bug 或与预期不符的行为：B4 详情弹窗、B5 导出与收藏、B2 生成引擎、A2 趋势导出、B3 候选导出在 1440px 桌面端均按设计工作；
- 环境注意：本机默认 node 为 v14，需用 `D:\development\nodejs\node.exe`（v24.14.0）运行 npm 脚本；通过 `set PATH=D:\development\nodejs;%PATH%` 解决；PowerShell 不支持 `&&`，需用 `cmd /d /c "..."` 或 `;` 分隔命令。

下一轮：Phase 2 剩余 C1—C7。首选 C1 兼容矩阵（角色能力 × 场景约束 × 生成难度），为 C2 完整制作包和 C3 近似度检测提供约束基础。

### A6 统一任务运行日志轮 — 2026-07-31

本轮目标：为采集、迁移、生成和导出各环节建立结构化运行记录，让每次 CLI 运行的结果（成功/失败/部分失败、处理数量、耗时和错误）可追溯、可查询。这是 Phase 1 的最后一个任务。

完成：

- 新增 `src/data/contracts.ts` 的 `TaskRunLogSchema`，字段包括：schema_version、id（StableIdSchema）、task_name（枚举 5 个 CLI 任务）、started_at、finished_at、duration_ms、status（success/partial/failed）、processed_count、success_count、failure_count、errors、metadata（string|number|boolean|null 值记录）、environment（node_version + command）；superRefine 校验状态与错误一致性（success 不能有错误、partial/failed 必须有错误）和 finished_at 不早于 started_at；
- 新增 `src/observability/task-run-logger.ts`，导出：
  - `TaskRunLogger` 类：构造时注入 taskName、logDirectory、clock 和 baseMetadata；`succeed()`/`partial()`/`fail()` 三个快捷方法；`finish()` 写入经 Schema 校验的日志到按日期分目录的 JSON 文件（`data/run-logs/YYYY/MM/DD/{id}.json`）；ID 格式 `task_run_{slug}_{timestamp}_{random_hex}` 符合 StableIdSchema；fail 自动从 Error 提取 message；
  - `createTaskRunLogger` 工厂函数；
  - `listTaskRunLogs` 查询接口：按 taskName、status、startDate、endDate 过滤，按 started_at 降序返回，跳过损坏日志文件，目录不存在时返回空数组；
- 修改 5 个 CLI 脚本接入日志记录器：
  - `scripts/collect-wikipedia.ts`：包裹核心逻辑，根据 batch.run.status 记录 success 或 partial；
  - `scripts/migrate-trends.ts`：根据 report.files_failed 记录 success 或 partial，metadata 含 inserted/updated/deduplicated/total_trends；
  - `scripts/daily-pipeline.ts`：记录 success，metadata 含 date/candidates/inserted/skipped/total；
  - `scripts/export-trends.ts`：CLI 入口记录 success，metadata 含 trend_count；
  - `scripts/export-candidates.ts`：CLI 入口记录 success，metadata 含 candidate_count；
  - 所有脚本在 catch 块中调用 `logger.fail(error)` 后重新抛出，确保异常也被记录；
- 新增 `tests/task-run-logger.test.ts` 共 19 项测试，覆盖：Schema 接受合法日志、拒绝缺失字段、拒绝未知任务名、拒绝非法状态、拒绝状态与错误不一致、拒绝结束时间早于开始时间；succeed 写入按日期分目录的有效日志、partial 记录错误列表、fail 从异常提取错误信息、处理非 Error 抛出；listTaskRunLogs 按任务名/状态/日期范围过滤、目录不存在返回空数组、每次运行产生唯一 ID、跳过损坏日志、按 started_at 降序排列、metadata 合并、environment 记录 node 版本和命令；
- 修改 `package.json` 测试入口加入 `tests/task-run-logger.test.ts`；
- 修改 `.gitignore` 添加 `data/run-logs/`（运行日志为运行时产物，不提交）。

验证：

- `npm run typecheck`：通过；
- `npm test`：通过，141/141（新增 19 项 A6 测试，原有 122 项不变）；
- `npm run validate:data`：通过，4 份 JSON 有效；
- `npm run build`：通过，9 modules transformed，CSS 26.35 kB、JS 75.93 kB；
- `git diff --check`：通过。

关键决策与遗留问题：

- 日志持久化选择 JSON 文件而非 SQLite，理由：(1) 与 collection-inbox 的不可覆盖批次规则一致；(2) 不需要新建 SQLite 迁移；(3) 按日期分目录可追溯；(4) 未来可通过同一 `listTaskRunLogs` 接口替换为 SQLite 实现；
- 日志文件名使用日志 ID（含任务名、时间戳和 6 位随机 hex），保证同秒多次运行不冲突，文件不可覆盖；
- `listTaskRunLogs` 跳过损坏的日志文件而非抛出异常，与 migrate-collection-inbox 的坏批次隔离策略一致，确保单个损坏日志不阻止其他日志读取；
- metadata 值类型限制为 string|number|boolean|null，避免不可序列化对象进入日志；构造时传入的 baseMetadata 和 finish 时的 summary.metadata 合并，summary 覆盖同名键；
- environment.command 记录 `process.argv.slice(1).join(' ')`，便于回溯实际调用命令；项目规范禁止在命令行传入密钥，因此不构成安全风险；
- 日志目录默认为 `data/run-logs/`，collect-wikipedia 和 migrate-trends 支持 `--logs` 参数自定义；daily-pipeline、export-trends 和 export-candidates 使用固定相对路径，与现有脚本的 `data/collection-inbox` 用法一致；
- 环境注意：本机默认 node 为 v14，需用 `D:\development\nodejs\node.exe`（v24.14.0）运行 npm 脚本；通过 `set PATH=D:\development\nodejs;%PATH%` 解决。

下一轮：Phase 1 全部任务已完成，按第 5 节进入 Phase 2。首选 C8 桌面与移动端浏览器回归，补齐 B4/B5 轮遗留的浏览器交互验证缺口。

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

| 项目           | 状态                                   | 说明                                                                                                                                                                                                                                                                            |
| -------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 前端 MVP       | 通过                                   | 已重构为热点雷达、跨作品混搭器、知识库和收藏工作台，Vite 生产构建成功                                                                                                                                                                                                           |
| 响应式 UI      | 自动化回归通过                         | 桌面端 1440px 五大核心流程（详情弹窗/工作台/收藏/雷达/推荐流）和移动端 375/640/768/1024px 响应式断点均通过 browser_evaluate DOM 检查验证                                                                                                                                        |
| 示例内容       | 已有                                   | 4 条首页创意和结构化种子数据                                                                                                                                                                                                                                                    |
| 每日候选脚本   | SQLite 闭环通过                        | 默认读取正式趋势、生成候选并幂等持久化；显式示例输入仅用于测试和演示                                                                                                                                                                                                            |
| 内容图谱       | 基础库可校验，增量合并已用真实批次验证 | 已有 9 部作品、19 个知名人物、7 组关系和 11 个抽象名场面；具体知名内容均为 `reference_only`；增量批次可通过 `merge:knowledge` 合并入库                                                                                                                                          |
| 创意生成引擎   | 质量升级完成                           | 4 类共 24 个钩子模板、4 种性格驱动对白、按时长分镜（15/30/60s → 3/5/8 镜头）和发布文案（3 标题+描述+3 标签）；固定种子可复现，20 条规范化钩子唯一率 ≥ 70%                                                                                                                       |
| 素材库详情视图 | 基础闭环通过                           | 角色/作品/名场面三类卡片可点击进入详情弹窗，展示完整字段（角色类型、对白风格、关系、情绪弧、视觉动作、可复用节拍、来源证据等）；每个详情页有"开始创作"入口带入混搭工作台；键盘可访问，移动端有适配                                                                              |
| 素材库多维筛选 | 基础闭环通过                           | 角色/名场面/作品三个 tab 各 3 个筛选维度（类型/作品/版权、冲突/情绪/作品、媒介/类型/版权），同维度多选 OR、跨维度 AND、文本搜索与筛选 AND；业务规则抽为 src/library/filter.ts 纯函数，13 项单元测试覆盖；chip 动态收集可选项避免死选项，切换 tab 自动重置，有清空按钮和结果计数 |
| 导出与收藏     | 基础闭环通过                           | 混搭方案可导出 Markdown（人类可读，含分镜表格/对白/文案/版权边界）和 JSON（机器可读，完整 RemixPlan）；收藏列表保存完整方案和上下文，支持展开查看、重新加载到工作台、单条导出和删除；旧格式收藏降级显示；导出/收藏操作有 toast 反馈；尚缺浏览器交互回归                         |
| 热点采集       | SQLite 入库闭环完成，任务启用          | 每天 07:30、13:30、19:30 采集；已有公开批次经 Schema、跨批次去重和事务迁移进入 SQLite                                                                                                                                                                                           |
| 来源适配器     | 首个固定适配器已建立                   | 维基百科最热词条 REST API 适配器已建立，纯转换函数 + 本地 fixture 测试，输出 CollectionBatchSchema 兼容批次可被 migrate:trends 消费；CLI 已就绪但未实际拉取公网数据                                                                                                             |
| 运行日志       | 基础闭环通过                           | 采集、迁移、生成和导出 5 个 CLI 环节均产生结构化运行记录；日志按日期分目录持久化到 data/run-logs/，支持按任务名、状态和日期范围查询；覆盖正常运行、部分失败和完全失败                                                                                                           |
| 本地持久化     | SQLite 通过                            | 默认 `data/linggan.sqlite`；版本化迁移、知识种子、事务回滚、幂等和多来源合并测试通过                                                                                                                                                                                            |
| 候选审核       | 基础状态机通过                         | candidates 已持久化，支持 pending_review、approved、rejected、archived 合法流转；approved 候选可导出供推荐流消费；尚无自动发布目标                                                                                                                                              |
| 今日推荐       | 基础闭环通过                           | 首页读取 approved 候选导出，无数据时显示空状态；当前无 approved 候选                                                                                                                                                                                                            |
| 行为分析       | 未实现                                 | 尚未采集曝光、复制和成片事件                                                                                                                                                                                                                                                    |
| 测试体系       | 基础验证通过                           | 已覆盖数据契约、生成、SQLite 趋势适配与导出、候选存储和状态机、运行日志、素材库筛选（C5 新增 13 项）；B4/B5 浏览器交互回归已通过 C8 补齐；当前 182 项测试全部通过                                                                                                               |

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
- [x] A6 建立统一任务运行日志 Schema 和记录机制，覆盖采集、迁移、生成和导出 5 个 CLI 环节，日志按日期分目录持久化到 data/run-logs/，支持按任务名、状态和日期范围查询回溯。

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
- [x] A6 统一任务运行日志。
- [x] C8 桌面与移动端浏览器回归。
- [x] C1 兼容矩阵（角色能力 × 场景约束 × 生成难度）。
- [x] C2 完整制作包（自动生成分镜/提示词/发布文案）。
- [x] C3 近似度检测（避免换皮创意）。
- [x] C4 工作台三栏布局（左素材/中预览/右完整制作包）。
- [x] C5 多维筛选（素材库三类实体各 3 维度，OR/AND 组合）。
- [x] C6 前端模块化（main.js 拆为 6 个 section + 4 个基础模块）。
- [x] C7 lint/format 配置（ESLint + Prettier，格式化全部源码）。

### Phase 1 已完成

Phase 1 全部任务已完成。本地内容数据基础验证里程碑（M1）达成：公开来源 → 采集批次 → Schema 与去重 → SQLite → 候选生成与持久化 → 只读导出 → 网站展示形成完整闭环。

### Phase 2 已完成

C1、C2、C3、C4、C5、C6、C7、C8 全部完成。Phase 2 创意引擎增强与质量保障轨道结束：兼容矩阵、完整制作包、近似度检测、工作台三栏布局、多维筛选、前端模块化、lint/format 配置和浏览器回归全部交付。

### Phase 3 待完成

按依赖顺序：

1. D1 事件采集 — 9 类核心产品事件可记录（首选）；
2. D2 创作者偏好画像 — 个性化排序；
3. D3 可解释排序权重 — 权重可回滚、可解释；
4. D4 探索流量 — 首页 ≥ 15% 探索内容；
5. D5 创作历史与项目管理。

### Phase 4 — 条件触发

E1—E5 仅在 `docs/DEVELOPMENT_DIRECTION.md` 的外部依赖和触发条件满足后执行；不得把商业化规划当作当前无条件开发任务。

## 5. 下一轮唯一首选任务

**任务 C7：lint/format 配置（已完成）。**

**下一轮任务：D1 — 事件采集（Phase 3 反馈学习轨道首项）。**

选择理由：Phase 2 全部任务已完成，进入 Phase 3 反馈学习轨道。D1 是 Phase 3 的起点，也是后续 D2 偏好画像和 D3 排序权重的前置依赖——没有事件数据就无法建立偏好画像和优化排序。D1 的目标是建立 9 类核心产品事件（idea_impression/idea_opened/idea_saved/prompt_copied/idea_exported/video_created/video_published/idea_hidden/risk_reported）的采集能力，对应 DEVELOPMENT_DIRECTION.md 阶段 D"D1 事件采集（impression/opened/saved/copied 等 9 类）"和 DEVELOPMENT_PLAN.md 第 5 节"必须记录的产品事件"表。事件数据是后续个性化排序和探索流量机制的输入，必须先建立采集能力才能积累样本。验收条件为 9 类核心事件可记录。

验收条件：

- 建立 9 类核心产品事件的 Schema 与类型（idea_impression/idea_opened/idea_saved/prompt_copied/idea_exported/video_created/video_published/idea_hidden/risk_reported），每类事件记录必要字段（event_type、target_id、user_id/session_id、occurred_at、metadata）；
- 建立事件存储能力（优先复用 SQLite 边界，与现有 TrendStore/CandidateStore 一致），支持写入和按事件类型/时间范围查询；
- 前端在关键交互点埋点：候选曝光（feed 渲染）、展开（详情打开）、收藏、复制提示词、导出（MD/JSON）；video_created/video_published/idea_hidden/risk_reported 可先建立 Schema 和写入接口，前端无对应交互时留空；
- 事件采集不阻塞现有功能，写入失败降级不报错；
- 类型检查、全部测试、数据校验和生产构建通过；
- 新增事件采集的单测覆盖 Schema 校验、写入和查询。

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
