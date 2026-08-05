# 灵感项目当前进度

最后更新：2026-08-06
当前轮次：原创角色接入 daily-pipeline 生产计划生成
当前阶段：Phase 1—3 规划任务已尽，D1—D5 反馈学习闭环健康扫描完成；用户已于 2026-08-03 授权自主推进 4.1—4.4 本地数据迭代；4.1 已完成三批共 6 部作品扩充（9→15 作品/37 角色/19 关系/22 名场面，达到 15+ 目标）；4.2 已完成：10 个原创角色原型；4.3 已完成：remixStyles 从 4 种扩充至 8 种；4.4 已完成：新增 SeedLibrarySection 前端展示种子数据；4.1—4.4 全部完成且 4.1 达到 15+ 目标；原创角色原型已接入 remix-engine，10 个原创角色可在跨作品混搭工作台中选择并生成有效方案；原创角色 C1 兼容矩阵能力档案已建立；原创角色已接入 daily-pipeline 生产计划生成，前 3 个原创角色与前 5 个知名角色混合参与 C1 兼容过滤和生产计划生成，管线组合从 30 增至 84（+54），C1 过滤后 80 个有效方案（+50），其中 50 个含原创角色版权边界声明；下一轮可考虑 Phase 4 商业化与扩展（E1—E5），需用户决策；或继续扩充知识库/优化体验
整体状态：本地数据闭环可验证；前端埋点采集闭环已建立（session 管理 + localStorage 事件队列 + 导出按钮 + sync:events 回收入库）；前端 6 类核心交互事件（impression/opened/saved/copied/exported/hidden）已在 FeedSection/RemixWorkbench/SavedList 接入 track()，事件暂存 localStorage 后可通过"导出事件"按钮下载 event-inbox 兼容 JSON，再由 npm run sync:events 经 ProductEventSchema 校验后幂等写入 SQLite product_events 表；SQLite 已为默认存储，基础知识可幂等初始化、热点可事务入库；候选生成已接通 SQLite 正式趋势；正式趋势可原子导出为只读 JSON；网站热点雷达已消费真实趋势数据；候选已持久化到 SQLite，状态机支持 pending_review → approved/rejected → archived 流转和幂等键去重；今日推荐流已通过只读 JSON 导出消费 approved 候选；知识库增量合并命令已建立并通过真实批次验证，知识库已扩充至 15 部作品/37 角色/19 关系/22 名场面（4.1 第一批：进击的巨人、繁花、狂飙；4.1 第二批：原神、黑神话悟空；4.1 第三批：长安三万里）；跨作品混搭引擎已升级为多样化、固定种子可复现的生成器，支持 4 类共 24 个钩子模板、8 种风格（电影感热血/一本正经的荒诞/国风动画/伪纪录片/赛博朋克霓虹/古风水墨写意/Vlog 日常感/悬疑反转）、4 种性格驱动对白、按时长分镜（15/30/60s → 3/5/8 镜头）和发布文案（3 标题+描述+3 标签）；素材库角色/作品/名场面三类卡片可点击进入详情弹窗，展示完整字段并提供"开始创作"入口；混搭方案支持导出 Markdown（人类可读，含标题/概念/钩子/分镜表格/对白/文案/画面提示词/版权边界）和 JSON（机器可读，完整 RemixPlan 字段），收藏列表保存完整方案和上下文，支持展开查看、重新加载到工作台、单条导出和删除，旧格式收藏降级显示；首个固定公开来源适配器（维基百科最热词条 REST API）已建立，使用本地保存的响应样本驱动测试，输出 CollectionBatchSchema 兼容批次可被 migrate:trends 消费；统一任务运行日志已建立，覆盖采集、迁移、生成、导出、事件同步和周权重更新七个 CLI 环节，日志按日期分目录持久化到 data/run-logs/，支持按任务名、状态和日期范围查询回溯；B4/B5 两轮遗留的浏览器交互回归缺口已通过 C8 补齐，桌面端 1440px 五大核心流程（详情弹窗+实体跳转+Esc+开始创作、工作台生成+复制+导出 MD/JSON+收藏、收藏列表展开+重新加载+单条导出+删除、热点雷达真实趋势、今日推荐流空状态）和移动端 375/640/768/1024px 响应式断点均通过 browser_evaluate DOM 检查验证；C1 兼容矩阵已建立，覆盖 19 角色能力档案 × 11 场景约束档案 × 11 冲突难度档案 × 55 能力-冲突适配规则，提供 computeCompatibility/filterCompatibleCombinations API 供 remix-engine 在生成前过滤不合理组合（如"温柔型角色 × 高强度战斗场景 × 15s"）或调整生成难度权重；C2 完整制作包已建立，RemixPlan 扩展为包含结构化画面提示词（正向/负面/比例/风格强度）、版权边界声明（参考状态/商用限制/改写范围）、分镜表增加景别/运镜/转场三列、文案增加封面文案，daily-pipeline 已集成 C1 兼容矩阵过滤（buildProductionPlans 先 filterCompatibleCombinations 再 buildRemixPlan），导出器 Markdown 同步输出全部制作字段；C3 近似度检测已建立，提供 computePlanSimilarity/detectDuplicates/filterUniquePlans 三个 API，采用字符 bigram Jaccard 文本相似度 + 结构字段精确匹配的加权综合方案（钩子权重 0.25 最高，结构字段权重最低），daily-pipeline 在 C2 生成后调用 detectDuplicates 标记重复方案并写入 logger metadata，不删除只标记保留可追溯性；C4 创作工作台已升级为三栏布局（左素材选择/中核心预览/右完整制作包），中栏预览展示标题/钩子/封面文案/C3 重复检测标记/复制收藏快捷操作，右栏展示完整分镜表（含景别/运镜/转场中文标签）、结构化画面提示词（正向/负面/比例/风格强度）、版权边界三字段声明和导出按钮，前端集成 detectDuplicates 把当前方案与已收藏方案对比并在相似度≥0.7 时显示换皮警告，桌面端三栏在 ≤980px 堆叠为单栏；C5 素材库多维筛选已建立，业务规则与 UI 分离为 src/library/filter.ts 纯函数（filterLibraryItems/collectFilterOptions），素材库三个 tab 各配置 3 个筛选维度（角色：类型/作品/版权；名场面：冲突/情绪/作品；作品：媒介/类型/版权），同维度多选 OR、跨维度 AND、文本搜索与所有维度 AND，chip 动态收集可选项避免死选项，切换 tab 自动重置筛选，有选中时显示清空按钮和"显示 N / 共 M 项"计数；C6 前端模块化已完成，main.js 从 730 行减至 78 行（-92%），按行为边界拆分为 6 个 section 组件（Hero/RadarSection/RemixWorkbench/LibrarySection/SavedList/FeedSection）和 4 个基础模块（data/knowledge.js 知识库读取层、data/store.js 状态管理、ui/icons.js 图标库、ui/dom.js DOM 工具），原 main.js 顶层 6 个可变 let（duration/generation/currentResult/activeTab/libraryFilters/saved）全部收敛到 store.js，跨 section 调用通过 ctx 注入回调避免循环依赖，浏览器 DOM 检查 6/7 项 PASS（唯一 FAIL 是验证脚本查询方式问题，代码正确）；C7 lint/format 配置已完成，ESLint 9 flat config + Prettier 3 覆盖全部 .ts/.js 源码，lint 与 format:check 全部通过，TypeScript 降级至 6.0.3 以兼容 typescript-eslint v8，Phase 2 全部任务结束；D1 事件采集已建立，9 类核心产品事件（idea_impression/idea_opened/idea_saved/prompt_copied/idea_exported/video_created/video_published/idea_hidden/risk_reported）可通过 ProductEventSchema 校验并经 EventTracker 记录到 SQLite product_events 表（INSERT OR IGNORE 幂等），EventStore 接口 + InMemoryEventStore/SqliteEventStore 双实现支持按 event_type/session_id/idea_id/日期范围查询和 countByType 九类计数，003 迁移建表含 3 索引（type+occurred/session+occurred/idea_id）；D2a 前端埋点采集闭环已建立，前端 session 管理（localStorage 持久化 + 30 分钟超时新建会话）+ 事件队列（track 接口暂存 localStorage，上限 200 丢弃最旧）+ 导出按钮（EventSyncBar 渲染计数轮询和下载 event-inbox 兼容 JSON）+ sync:events 脚本（递归扫描 event-inbox，逐事件 Schema 校验后幂等写入 SQLite）完整接通前端行为到后端 product_events 表的闭环，6 类核心交互事件（impression/opened/saved/copied/exported/hidden）已在 FeedSection/RemixWorkbench/SavedList 接入埋点；D2b 创作者偏好画像与个性化排序已建立，buildPreferenceProfile 按 session_id 聚合事件流（9 类事件加权：saved 5/copied 4/exported 4/opened 3/impression 1/hidden -3）并结合候选 entities/source_trend/risk_level 扩散到维度权重输出 PreferenceProfile，rankCandidates 基于画像对候选重排（personalized_score = base_score*0.6 + match_score*0.4，已交互候选优先、共享 entity 候选获匹配分提升、explore_ratio 15% 保留未交互候选探索位、冷启动无画像时降级原顺序），前端 personalize.ts 从 localStorage 事件队列实时聚合画像并注入 FeedSection 渲染"为你推荐"流（画像摘要 + 已关注/探索徽章）；D3 排序权重周更新已建立，buildWeeklyWeightSnapshot 按 ISO 周从 product_events 聚合事件流计算全局排序权重（base_ratio/match_ratio/explore_ratio），单次变化不超过 10%（clampChange 限制在 [old*0.9, old*1.1]）、样本不足（event_count < 50）时保持原权重 changes 全 0、previous_week_id 链接上周快照支持回滚、input_stats 记录事件数/会话数/创意数/按类型分布提供可解释性，权重调整基于正向交互率（saved+copied+exported 占比 >30% 时 base 增 / <10% 时 match 增）和 idea 多样性（<0.3 时 explore 增 / >0.6 时减），InMemoryWeightSnapshotStore + SqliteWeightSnapshotStore 双实现保留全部历史快照支持查询任意周回滚（INSERT OR REPLACE 保证相同 week_id 幂等），004 迁移建 ranking_weight_snapshots 表（week_id 主键 + computed_at 索引 + snapshot_json 完整快照），update:weekly-weights CLI 脚本聚合本周事件生成快照并持久化、personalized-rank.ts 集成 weight_snapshot 参数让周级权重覆盖默认 base_ratio/explore_ratio 影响个性化排序；D4 探索流量机制已建立，exploration.ts 提供 computeExploreSlotCount（基于全部候选用 ceil 计算探索位数量保证 ≥15% 门槛，旧实现基于 nonProfiled.length 用 round 会让小列表得到 0 探索位）、selectExploreCandidates（多样性优先贪心选取 entities 重叠最少的候选作为探索位，FNV-1a 哈希 + seed 打破平局保证可复现）、buildExploreEffectStats（扫描 impression payload.reason='explore' 追踪探索位后续正向交互率 opened/saved/copied/exported），personalized-rank.ts 接入多样性选取替代旧 slice(0,N) 简单截取、新增 explore_seed 参数，weight-snapshot.ts 的 WeightEvent 扩展 payload 字段、input_stats 新增可选 explore_stats 字段（explore_impressions/unique_explore_ideas/explored_with_interaction/interaction_rate）、computeRawAdjustments 增加探索效果信号（interaction_rate>0.3 时 explore_ratio 略减 / <0.1 时略增，需 unique_explore_ideas≥5 避免小样本噪声，与 diversity 信号叠加后仍受 10% clamp 限制），update:weekly-weights 脚本传递 payload 并输出 explore_stats 到报告和日志 metadata；D5 创作历史与项目管理已建立，history.ts 提供 localStorage 持久化的创作历史存储（MAX_HISTORY=50 上限，自动记录每次用户主动生成的完整 RemixPlan + 选择器上下文 + 种子 + ISO 时间，addHistory 同 id 更新移前避免重复堆积、超限丢弃最旧、损坏 JSON/非数组/缺字段降级空数组、配额满静默降级不阻塞生成），HistoryList.js 渲染历史列表 UI（按时间倒序、展开折叠查看核心概念与对白、重新加载到工作台、单条删除、清空全部、键盘 Enter/Space 可访问、D2 埋点 idea_opened），RemixWorkbench 在用户主动生成和随机生成时自动 recordHistory（初始挂载默认方案不记录），loadRemixFromEntry 提取收藏和历史共享的重新加载逻辑避免重复代码，与收藏列表视觉区分（历史 cyan 色 50 条自动记录 vs 收藏 lime 色 8 条主动保存）；D1—D5 反馈学习闭环健康扫描已完成，端到端链路（前端 track → localStorage 队列 → sync:events → SQLite product_events → buildPreferenceProfile → rankCandidates + weight_snapshot + exploration → FeedSection 个性化推荐；update:weekly-weights 聚合周事件 → weight_snapshot → rankCandidates 覆盖默认权重）代码结构与脚本入口齐全且自洽，332 项测试全部通过；扫描发现并修复 D5 提交（838f3aa）引入的 docs/DEVELOPMENT_DIRECTION.md 表格列填充不符合 Prettier 规范导致 format:check 失败的基线问题（D5 进度记录中"format:check 通过"声明不准确）；尚无自动发布闭环

### 原创角色 C1 兼容矩阵能力档案轮 — 2026-08-05

本轮目标：为 4.2 节创建的 10 个原创角色原型补齐 C1 兼容矩阵 ability profile，解决"原创角色在 C1 兼容矩阵中无 ability profile，生成时兼容性检查跳过能力适配扣分"的遗留技术债（PROGRESS.md 上轮"关键决策与遗留问题"记录）。验收条件为 10 个原创角色在 compatibility-matrix.json 的 character_abilities 中各有五维能力档案，computeCompatibility 按真实分值评估不再降级，validateMatrixWithKnowledge 接受原创角色 ID，全部测试和构建通过。

完成：

- 在 data/compatibility-matrix.json 的 character_abilities 数组新增 10 个原创角色 ability profile（char_original_hardcore_coder 等），每个包含 combat/strategy/social/tech/emotional_control 五维 0-1 分值和中文 notes，分值基于角色 abilities/traits 设计（如硬核程序员 tech=0.95/combat=0.15，社区调解员 social=0.9/emotional_control=0.85，独立侦探 strategy=0.9）；
- 修改 src/data/contracts.ts 的 validateMatrixWithKnowledge：新增可选第三参数 seedCharacters?: readonly Character[]，把 seed-entities 的 kind=original 角色 ID 纳入合法角色集合，原创角色 ability profile 不再被报告为 unknown character id；保持向后兼容（不传时仍按原逻辑校验）；
- 修改 scripts/validate-data.ts：跨文件外键校验传入 seed-entities.json 的 characters，兼容矩阵原创角色 profile 通过外键校验；
- 修改 src/generation/original-adapter.ts 顶部注释：更新"C1 兼容矩阵在找不到原创角色 ability profile 时降级为 0.5"为"已为 10 个原创角色建立 ability profile，computeCompatibility 按真实分值评估"；
- 修改 tests/compatibility-matrix.test.ts：计数断言 19→29，加载 seed-entities.json，新增 5 项测试（10 个原创角色各有 profile、硬核程序员×强攻场景低适配扣分、空矩阵对比验证 profile 生效、原创×知名组合可生成方案、不传 seedCharacters 时检测到 10 个原创角色为未知）。

验证：validate:data 通过（5 份 JSON 有效，跨文件外键校验通过）、lint 通过、format:check 通过、typecheck 通过、test 346/346 通过（341 原有 + 5 新增）、build 34 modules 通过（CSS 34.09 kB 不变、JS 144.12 kB 不变，前端不导入 compatibility-matrix.json 故无开销）。

关键决策与遗留问题：

- ability profile 分值设计基于角色 abilities/traits 语义映射到五维（如"系统架构"→strategy/tech 高，"游戏操作"→combat 高，"情绪共情"→social/emotional_control 高），分值梯度合理反映角色能力分布；
- validateMatrixWithKnowledge 第三参数可选，保持向后兼容：不传时原创角色 ID 被报告为 unknown（原有严格行为不变），传入 seedCharacters 时原创角色通过校验；
- 原创角色 ability profile 不影响 buildRemixPlan 生成内容（computeCompatibility 只用于过滤），生成多样性与上轮一致；daily-pipeline 当前只用 knowledge.known_characters 不含原创角色，但原创角色接入 daily-pipeline 后 ability profile 即生效；
- C3 近似度检测、个性化排序测试全部通过，数据扩充未破坏既有闭环；
- 4.1—4.4 全部完成，本轮为 4.2 遗留技术债补齐，属于本地增强任务，不涉及 Phase 4 商业化；
- Phase 4 商业化与扩展（E1—E5）仍需用户决策，不得擅自启动。

### 原创角色接入 daily-pipeline 生产计划生成轮 — 2026-08-06

本轮目标：将原创角色接入 daily-pipeline 的生产计划生成环节，解决上轮遗留的"daily-pipeline 当前只用 knowledge.known_characters 不含原创角色"问题。验收条件为 daily-pipeline 的 C2 生产计划组合包含原创角色，C1 兼容矩阵对原创角色生效，管线日志和 metadata 记录原创角色参与数，全部测试和构建通过。

完成：

- 修改 scripts/daily-pipeline.ts：导入 toRemixCharacter/createOriginalWork，读取 seed-entities.json，将前 3 个原创角色通过适配器转换为 KnownCharacter 格式，与前 5 个知名角色混合参与生产计划组合生成；注册 createOriginalWork() 合成作品到 workById 映射，使原创角色的 work_id 可解析为合法 Work 对象；日志和 logger metadata 新增 production_known_chars 和 production_original_chars 字段；
- 修改 tests/original-adapter.test.ts：新增"daily-pipeline integration with original characters"测试组（2 项测试），验证管线风格的知名+原创混合组合经 C1 过滤后生成有效制作包（含原创角色版权边界声明），以及 C1 ability profile 对低战斗能力原创角色（硬核程序员）在高强度战斗场景中的过滤效果；
- 管线运行验证（--example --no-persist）：84 组合输入（5 知名 + 3 原创 × 前 3 名场面 × 30s），C1 过滤 4 个低兼容组合后 80 个有效方案，C3 近似度检测标记 16/80 重复，stderr 输出"5 known + 3 original characters"；
- 生成多样性自检：场景 A（仅知名 5 角色）30 组合 → 30 方案；场景 B（知名 5 + 原创 3 = 8 角色）84 组合 → 80 方案（+50），其中 50 个含原创角色版权边界，54 个唯一钩子（68%），80 个唯一标题（100%），原创角色真实提升了生成多样性。

验证：validate:data 通过（5 份 JSON 有效，跨文件外键校验通过）、lint 通过、format:check 通过、typecheck 通过、test 348/348 通过（346 原有 + 2 新增）、build 34 modules 通过（CSS 34.09 kB 不变、JS 144.12 kB 不变，管线改动为服务端不影响前端包体）。

关键决策与遗留问题：

- 原创角色选取前 3 个（hardcore_coder/delivery_poet/esports_granny）参与管线，控制单轮组合规模（8 角色 × 3 名场面 = 84 组合），如需全部 10 个原创角色参与可后续调整 slice 数量；
- createOriginalWork 合成的 Work 对象 media_type 为 'variety'、genres 为 ['原创']，不映射到任何真实媒介类型，remix-engine 只使用 work.title 和 work.rights_status 字段；
- 管线组合数从 30 增至 84（+180%），C1 过滤后 80 个方案（+167%），C3 检测 16/80 重复（20% 重复率与上轮一致），原创角色未导致重复率上升；
- C3 近似度检测、个性化排序、validate:data 跨文件外键校验全部通过，数据扩充未破坏既有闭环；
- 4.1—4.4 全部完成且原创角色已接入 daily-pipeline，属于本地增强任务，不涉及 Phase 4 商业化；
- Phase 4 商业化与扩展（E1—E5）仍需用户决策，不得擅自启动。

下一轮：4.1—4.4 全部完成，原创角色已接入 remix-engine 和 daily-pipeline，C1 兼容矩阵能力档案已补齐。Phase 4 商业化与扩展（E1—E5）需用户决策，不得擅自启动。可选方向：继续扩充知识库（需用户指定新候选作品）、优化前端体验、增强生成引擎质量等本地任务。

### 原创角色接入 remix-engine 轮 — 2026-08-05

本轮目标：将 4.2 节创建的 10 个原创角色原型接入 remix-engine，使原创角色可在跨作品混搭工作台中选择并生成有效方案。这是 4.1—4.4 全部完成后的本地增强任务，属于“增强生成引擎质量”方向。验收条件为原创角色可在工作台选择、buildRemixPlan 能处理原创角色生成有效 RemixPlan、版权边界声明区分原创和参考角色、全部测试和构建通过。

完成：

- 新增 src/generation/original-adapter.ts：提供 toRemixCharacter() 和 createOriginalWork() 适配器函数，把 seed-entities.json 的 Character 转换为 remix-engine 可用的 KnownCharacter 格式，从 abilities/traits/kind 派生 character_types 和 dialogue_style，合成 work_id/sources/risk_level/last_verified_at；
- 修改 src/data/knowledge.js：导入 seed-entities.json 的原创角色，通过 toRemixCharacter 适配后合并到统一 characterById 查找表，注册合成原创作品到 workById，导出 originalCharacterIds 集合供前端区分展示；
- 修改 src/sections/RemixWorkbench.js：角色 A/B 下拉选择器在知名角色后增加“── 原创角色原型 ──”分隔和 10 个原创角色选项（显示“角色名 · 原创原型”），applyToRemix 在查找不同角色时改用 characterById（含原创角色）而非 knowledge.known_characters；
- 修改 src/generation/remix-engine.ts 的 buildProduction 函数：版权边界声明区分原创角色（original）和参考角色（reference_only），两个原创角色组合的商用限制提示“可直接用于商业发布”，混合组合仍提示“替换为原创或已授权资产”；
- 新增 tests/original-adapter.test.ts：9 项测试覆盖适配器字段派生、archetype 角色处理、buildRemixPlan 处理原创×知名/原创×原创组合、版权边界声明区分、固定种子复现、全部 10 个真实原创角色生成有效性；
- 生成多样性自检（20 plans）：15/20 unique hooks（75%）、20/20 unique titles（100%），原创角色正确出现在生成内容中。

验证：validate:data 通过（5 份 JSON 有效，跨文件外键校验通过）、lint 通过、format:check 通过、typecheck 通过、test 341/341 通过（332 原有 + 9 新增）、build 34 modules 通过（CSS 34.09 kB不变、JS 144.12 kB，较上轮 142.64 kB 增加 1.48 kB，为 original-adapter.ts 的开销）。

关键决策与遗留问题：

- 适配器设计：toRemixCharacter 返回的对象 rights_status 为 'original' 而非 'reference_only'，运行时安全——remix-engine 只读取字段值用于版权边界文案，不会用 KnownCharacterSchema 重新校验；C1 兼容矩阵在找不到原创角色的 ability profile 时降级为 0.5 中等分（已有逻辑）；
- 前端角色选择器用 disabled option 作为分组分隔符（── 原创角色原型 ──），不增加额外 DOM 组件；
- 原创角色暂未在素材库（LibrarySection）展示，仅在创作工作台角色选择器中可选，因 LibrarySection 数据源为 knowledge-base.json；前端 SeedLibrarySection 已展示原创角色卡片（4.4 节完成）；
- 原创角色暂未在 C1 兼容矩阵中建立 ability profile，生成时兼容性检查降级为中等分，后续可考虑为原创角色添加能力档案；
- 4.1—4.4 全部完成，本轮为 4.2 遗留的“原创角色暂未接入 remix-engine”问题的补齐，属于本地增强任务，不涉及 Phase 4 商业化；
- Phase 4 商业化与扩展（E1—E5）仍需用户决策，不得擅自启动。

下一轮：4.1—4.4 全部完成且原创角色已接入 remix-engine。Phase 4 商业化与扩展（E1—E5）需用户决策，不得擅自启动。可选方向：继续扩充知识库（需用户指定新候选作品）、为原创角色添加 C1 兼容矩阵能力档案、优化前端体验、增强生成引擎质量等本地任务。

### 4.1 第三批知识库扩充轮 — 2026-08-05

本轮目标：DEVELOPMENT_DIRECTION.md 4.1 节知识库扩充第三批，从 14 部作品扩充至 15 部作品，达到 15+ 目标。新增长安三万里（animation film, 2023），3 角色 + 2 关系 + 2 抽象名场面。验收条件为知识库 15 部作品，Schema 和跨文件外键校验通过，全部测试和构建通过。

完成：

- 新增 1 个知识库增量批次文件到 data/knowledge-inbox/：
  - 2026-08-05-b3-chang-an.json：长安三万里（film，2023，animation/history/biographical），3 角色（李白/高适/杜甫），2 关系，2 抽象名场面（诗才在宴会上即兴征服质疑者、盛世好友在时代转折点各奔前程）；
- 所有知名实体遵循 reference_only 边界，不保存精确台词/镜头/受保护素材，公开来源可核验（Wikipedia），last_verified_at = 2026-08-05T00:00:00.000Z；
- npm run merge:knowledge 合并成功：9 批次全部处理（files_failed=0），15 作品/37 角色/19 关系/22 名场面（new_ids=8, merged_ids=59）；
- 修复 2 项硬编码计数测试：sqlite-storage.test.ts（14/34/17/20→15/37/19/22）和 trend-ingestion.test.ts（14/34/20→15/37/22）；
- 生成多样性自检（固定种子 20 plans）：12/20 unique hooks（60%），同一角色对多样性合理；新角色李白/高适/杜甫已入库。

验证：validate:data 通过（5 份 JSON 有效，跨文件外键校验通过）、lint 通过、format:check 通过、typecheck 通过、test 332/332 通过、build 33 modules 通过（CSS 34.09 kB、JS 142.64 kB）。

关键决策与遗留问题：

- 长安三万里选材理由：覆盖 animation+history+biographical 类型组合，角色为历史人物（李白/高适/杜甫），公开来源丰富，版权风险低（reference_only）；
- 4.1 目标 15+ 部作品已达成（当前 15 部），DEVELOPMENT_DIRECTION.md 候选列表全部使用完毕；如需继续扩充需用户指定新候选；
- 4.1—4.4 全部完成，本轮为 4.1 补齐批次，用户授权自主推进范围内；
- 环境注意：本机默认 node 为 v14，需用 D:\development\nodejs；PowerShell 不支持 &&，需 cmd /d /c 包装。

下一轮：4.1—4.4 全部完成且 4.1 达到 15+ 目标。Phase 4 商业化与扩展（E1—E5）需用户决策，不得擅自启动。可选方向：继续扩充知识库（需用户指定新候选作品）、优化前端体验、增强生成引擎质量等本地任务。

### 4.4 前端未展示种子数据展示轮 — 2026-08-05

本轮目标：DEVELOPMENT_DIRECTION.md 4.4 节，data/seed-entities.json 中已有但前端未展示的热门元素和叙事模板种子数据，在前端增加对应展示区域。验收条件为前端展示 seed-entities.json 的 4 个集合（characters/scenes/story_patterns/elements），全部测试和构建通过。

完成：

- 新增 src/sections/SeedLibrarySection.js（种子数据展示 section），渲染 4 个 tab：
  - 原创角色（14 项）：4 个经典原型 + 10 个原创角色原型，展示名称/类型/媒介/性格/能力/关系；
  - 叙事场景（3 项）：展示名称/生命周期/版权/结构模式（用箭头连接）；
  - 故事模板（3 项）：展示名称/结构节拍（用箭头连接）；
  - 热门元素（3 项）：展示名称/分类/可生成度/动作。
- 在 src/main.js 中导入并挂载 SeedLibrarySection，位于素材库和收藏列表之间；
- 导航栏新增“种子库”入口（#seed-library）；
- 复用 LibrarySection 的 CSS 类名（library-section/library-toolbar/tabs/library-grid/library-card/library-badge/mini-tags），保持视觉一致性；
- 种子卡片展示 original 版权标记（区别于 LibrarySection 的 reference_only）；
- tab 切换时显示对应集合的卡片列表，每个 tab 标注数量。

验证：validate:data 通过（5 份 JSON 有效，跨文件外键校验通过）、lint 通过、format:check 通过、typecheck 通过、test 332/332 通过、build 33 modules 通过（CSS 34.09 kB不变、JS 136.56 kB，较上轮 129.18 kB 增加 7.38 kB，为新增 SeedLibrarySection + seed-entities.json 内联的开销）。

关键决策与遗留问题：

- SeedLibrarySection 与 LibrarySection 视觉风格保持一致，但数据源不同（seed-entities.json vs knowledge-base.json），不共享筛选器；
- 种子库展示为只读卡片，暂不支持点击详情弹窗和“开始创作”入口（与 LibrarySection 不同），因种子实体结构简单且无关联 works/moments；
- 种子库暂未接入埋点（D2 事件采集），后续可考虑增加 idea_impression 等事件；
- 4.1 目标 15+ 部作品，当前 14 部，差 1 部，4.1—4.4 全部完成后可补齐；
- 环境注意：本机默认 node 为 v14，需用 D:\development\nodejs；PowerShell 不支持 &&，需 cmd /d /c 包装。

下一轮：4.1—4.4 全部完成。可补齐 4.1 第三批（1+ 部作品达到 15+ 目标），或等待用户决策启动 Phase 4 商业化与扩展（E1—E5）。Phase 4 商业化与扩展（E1—E5）仍需用户决策。

## 历史归档

2026-08-01 将 2026-07 月历史迭代日志（D2a 前端埋点采集闭环轮及更早共 31 轮）归档到 `memory/archive/2026-07.md`，
遵循 memory/README.md 第 7 条"超过 30 轮的历史日志可按月归档"规则。2026-08-05 将 PROGRESS.md 历史归档轮、D1—D5 反馈学习闭环健康扫描轮和上轮归档遗留提交补齐轮追加归档至 `memory/archive/2026-07.md` 末尾。
2026-08-06 将 4.3 风格扩充轮和 4.2 原创角色原型轮追加归档至 `memory/archive/2026-07.md` 末尾。
当前文件保留最近 5 轮（原创角色接入 daily-pipeline、原创角色 C1 兼容矩阵能力档案、原创角色接入 remix-engine、4.1 第三批知识库扩充、4.4 前端种子数据展示）+ 当前状态。
归档文件仅供历史回溯查阅，当前进度真源仍为本文件。
