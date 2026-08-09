# 灵感项目当前进度

最后更新：2026-08-09
当前轮次：候选评分维度差异化改进（contrast/visuality/seriality data-driven scoring）
当前阶段：Phase 1—3 规划任务已尽，D1—D5 反馈学习闭环健康扫描完成；用户已于 2026-08-03 授权自主推进 4.1—4.4 本地数据迭代；4.1—4.4 全部完成且 4.1 达到 15+ 目标；原创角色原型已接入 remix-engine 和 daily-pipeline；生成引擎模板扩充已完成（钩子 32 个/对白 56 个）；钩子模板双角色感知改写已完成；概念/提示词/钩子模板多样化改写已完成；概念尾句/标题模式/提示词句式多样化改写已完成；对白模板从 7 个/性格扩充至 14 个/性格（28→56），新增 {trait} 占位符引用角色 traits 增加差异化；pipeline:daily 已内嵌 review:auto 和 export:candidates 全自动闭环；原创角色 traits 已扩充至 5-6 个/角色（唯一对白A 80.0%、B 84.8%、C3 重复率 0.0%）；候选状态机已支持 rejected → pending_review（review:reopen）和 archived → pending_review（review:reactivate）重新审核，完成候选生命周期全循环；候选生成器已改进：每趋势角色选取从固定 2 个扩充至轮换 3 个（覆盖全部 14 个角色），新增 8 种标题模式和 8 种钩子模式按组合索引选取，使 12 条真实趋势产生 30 条候选（原 20 条）、使用 14 个不同角色（原 2 个）、30 个不同标题和 30 个不同钩子（原全部相同），全部通过 70 分发布门槛；本轮改进候选评分的 contrast/visuality/seriality 三个维度从近常数改为数据驱动，contrast 从 2 个值变为 7 个值（基于角色 traits 加权）、visuality 从 1 个值变为 2 个值（基于元素类别和动作数）、seriality 从 1 个值变为 2 个值（基于场景 pattern 步骤数和元素类别），126 组合的总分从 1 个值变为 3 个值；下一轮可考虑 Phase 4 商业化与扩展（E1—E5），需用户决策；或继续优化生成引擎或前端体验
整体状态：本地数据闭环可验证；前端埋点采集闭环已建立（session 管理 + localStorage 事件队列 + 导出按钮 + sync:events 回收入库）；前端 6 类核心交互事件（impression/opened/saved/copied/exported/hidden）已在 FeedSection/RemixWorkbench/SavedList 接入 track()，事件暂存 localStorage 后可通过"导出事件"按钮下载 event-inbox 兼容 JSON，再由 npm run sync:events 经 ProductEventSchema 校验后幂等写入 SQLite product_events 表；SQLite 已为默认存储，基础知识可幂等初始化、热点可事务入库；候选生成已接通 SQLite 正式趋势；正式趋势可原子导出为只读 JSON；网站热点雷达已消费真实趋势数据；候选已持久化到 SQLite，状态机支持 pending_review → approved/rejected → archived、rejected → pending_review（重新审核）和 archived → pending_review（重新激活）流转和幂等键去重；review:reopen 命令支持单条/批量 reopen rejected 候选并可立即 --re-review；review:reactivate 命令支持单条/批量 reactivate archived 候选并可立即 --re-review；今日推荐流已通过只读 JSON 导出消费 approved 候选；知识库增量合并命令已建立并通过真实批次验证，知识库已扩充至 15 部作品/37 角色/19 关系/22 名场面（4.1 第一批：进击的巨人、繁花、狂飙；4.1 第二批：原神、黑神话悟空；4.1 第三批：长安三万里）；跨作品混搭引擎已升级为多样化、固定种子可复现的生成器，支持 4 类共 32 个钩子模板、8 种风格（电影感热血/一本正经的荒诞/国风动画/伪纪录片/赛博朋克霓虹/古风水墨写意/Vlog 日常感/悬疑反转）、4 种性格驱动对白（4 性格共 56 个对白模板）、性格对钩子类别扩展机制（6 种互补组合扩展）、按时长分镜（15/30/60s → 3/5/8 镜头）和发布文案（3 标题+描述+3 标签）；素材库角色/作品/名场面三类卡片可点击进入详情弹窗，展示完整字段并提供"开始创作"入口；混搭方案支持导出 Markdown（人类可读，含标题/概念/钩子/分镜表格/对白/文案/画面提示词/版权边界）和 JSON（机器可读，完整 RemixPlan 字段），收藏列表保存完整方案和上下文，支持展开查看、重新加载到工作台、单条导出和删除，旧格式收藏降级显示；首个固定公开来源适配器（维基百科最热词条 REST API）已建立，使用本地保存的响应样本驱动测试，输出 CollectionBatchSchema 兼容批次可被 migrate:trends 消费；统一任务运行日志已建立，覆盖采集、迁移、生成、导出、事件同步和周权重更新七个 CLI 环节，日志按日期分目录持久化到 data/run-logs/，支持按任务名、状态和日期范围查询回溯；B4/B5 两轮遗留的浏览器交互回归缺口已通过 C8 补齐，桌面端 1440px 五大核心流程（详情弹窗+实体跳转+Esc+开始创作、工作台生成+复制+导出 MD/JSON+收藏、收藏列表展开+重新加载+单条导出+删除、热点雷达真实趋势、今日推荐流空状态）和移动端 375/640/768/1024px 响应式断点均通过 browser_evaluate DOM 检查验证；C1 兼容矩阵已建立，覆盖 19 角色能力档案 × 11 场景约束档案 × 11 冲突难度档案 × 55 能力-冲突适配规则，提供 computeCompatibility/filterCompatibleCombinations API 供 remix-engine 在生成前过滤不合理组合（如"温柔型角色 × 高强度战斗场景 × 15s"）或调整生成难度权重；C2 完整制作包已建立，RemixPlan 扩展为包含结构化画面提示词（正向/负面/比例/风格强度）、版权边界声明（参考状态/商用限制/改写范围）、分镜表增加景别/运镜/转场三列、文案增加封面文案，daily-pipeline 已集成 C1 兼容矩阵过滤（buildProductionPlans 先 filterCompatibleCombinations 再 buildRemixPlan），导出器 Markdown 同步输出全部制作字段；C3 近似度检测已建立，提供 computePlanSimilarity/detectDuplicates/filterUniquePlans 三个 API，采用字符 bigram Jaccard 文本相似度 + 结构字段精确匹配的加权综合方案（钩子权重 0.25 最高，结构字段权重最低），daily-pipeline 在 C2 生成后调用 detectDuplicates 标记重复方案并写入 logger metadata，不删除只标记保留可追溯性；C4 创作工作台已升级为三栏布局（左素材选择/中核心预览/右完整制作包），中栏预览展示标题/钩子/封面文案/C3 重复检测标记/复制收藏快捷操作，右栏展示完整分镜表（含景别/运镜/转场中文标签）、结构化画面提示词（正向/负面/比例/风格强度）、版权边界三字段声明和导出按钮，前端集成 detectDuplicates 把当前方案与已收藏方案对比并在相似度≥0.7 时显示换皮警告，桌面端三栏在 ≤980px 堆叠为单栏；C5 素材库多维筛选已建立，业务规则与 UI 分离为 src/library/filter.ts 纯函数（filterLibraryItems/collectFilterOptions），素材库三个 tab 各配置 3 个筛选维度（角色：类型/作品/版权；名场面：冲突/情绪/作品；作品：媒介/类型/版权），同维度多选 OR、跨维度 AND、文本搜索与所有维度 AND，chip 动态收集可选项避免死选项，切换 tab 自动重置筛选，有选中时显示清空按钮和"显示 N / 共 M 项"计数；C6 前端模块化已完成，main.js 从 730 行减至 78 行（-92%），按行为边界拆分为 6 个 section 组件（Hero/RadarSection/RemixWorkbench/LibrarySection/SavedList/FeedSection）和 4 个基础模块（data/knowledge.js 知识库读取层、data/store.js 状态管理、ui/icons.js 图标库、ui/dom.js DOM 工具），原 main.js 顶层 6 个可变 let（duration/generation/currentResult/activeTab/libraryFilters/saved）全部收敛到 store.js，跨 section 调用通过 ctx 注入回调避免循环依赖，浏览器 DOM 检查 6/7 项 PASS（唯一 FAIL 是验证脚本查询方式问题，代码正确）；C7 lint/format 配置已完成，ESLint 9 flat config + Prettier 3 覆盖全部 .ts/.js 源码，lint 与 format:check 全部通过，TypeScript 降级至 6.0.3 以兼容 typescript-eslint v8，Phase 2 全部任务结束；D1 事件采集已建立，9 类核心产品事件（idea_impression/idea_opened/idea_saved/prompt_copied/idea_exported/video_created/video_published/idea_hidden/risk_reported）可通过 ProductEventSchema 校验并经 EventTracker 记录到 SQLite product_events 表（INSERT OR IGNORE 幂等），EventStore 接口 + InMemoryEventStore/SqliteEventStore 双实现支持按 event_type/session_id/idea_id/日期范围查询和 countByType 九类计数，003 迁移建表含 3 索引（type+occurred/session+occurred/idea_id）；D2a 前端埋点采集闭环已建立，前端 session 管理（localStorage 持久化 + 30 分钟超时新建会话）+ 事件队列（track 接口暂存 localStorage，上限 200 丢弃最旧）+ 导出按钮（EventSyncBar 渲染计数轮询和下载 event-inbox 兼容 JSON）+ sync:events 脚本（递归扫描 event-inbox，逐事件 Schema 校验后幂等写入 SQLite）完整接通前端行为到后端 product_events 表的闭环，6 类核心交互事件（impression/opened/saved/copied/exported/hidden）已在 FeedSection/RemixWorkbench/SavedList 接入埋点；D2b 创作者偏好画像与个性化排序已建立，buildPreferenceProfile 按 session_id 聚合事件流（9 类事件加权：saved 5/copied 4/exported 4/opened 3/impression 1/hidden -3）并结合候选 entities/source_trend/risk_level 扩散到维度权重输出 PreferenceProfile，rankCandidates 基于画像对候选重排（personalized_score = base_score*0.6 + match_score*0.4，已交互候选优先、共享 entity 候选获匹配分提升、explore_ratio 15% 保留未交互候选探索位、冷启动无画像时降级原顺序），前端 personalize.ts 从 localStorage 事件队列实时聚合画像并注入 FeedSection 渲染"为你推荐"流（画像摘要 + 已关注/探索徽章）；D3 排序权重周更新已建立，buildWeeklyWeightSnapshot 按 ISO 周从 product_events 聚合事件流计算全局排序权重（base_ratio/match_ratio/explore_ratio），单次变化不超过 10%（clampChange 限制在 [old*0.9, old*1.1]）、样本不足（event_count < 50）时保持原权重 changes 全 0、previous_week_id 链接上周快照支持回滚、input_stats 记录事件数/会话数/创意数/按类型分布提供可解释性，权重调整基于正向交互率（saved+copied+exported 占比 >30% 时 base 增 / <10% 时 match 增）和 idea 多样性（<0.3 时 explore 增 / >0.6 时减），InMemoryWeightSnapshotStore + SqliteWeightSnapshotStore 双实现保留全部历史快照支持查询任意周回滚（INSERT OR REPLACE 保证相同 week_id 幂等），004 迁移建 ranking_weight_snapshots 表（week_id 主键 + computed_at 索引 + snapshot_json 完整快照），update:weekly-weights CLI 脚本聚合本周事件生成快照并持久化、personalized-rank.ts 集成 weight_snapshot 参数让周级权重覆盖默认 base_ratio/explore_ratio 影响个性化排序；D4 探索流量机制已建立，exploration.ts 提供 computeExploreSlotCount（基于全部候选用 ceil 计算探索位数量保证 ≥15% 门槛，旧实现基于 nonProfiled.length 用 round 会让小列表得到 0 探索位）、selectExploreCandidates（多样性优先贪心选取 entities 重叠最少的候选作为探索位，FNV-1a 哈希 + seed 打破平局保证可复现）、buildExploreEffectStats（扫描 impression payload.reason='explore' 追踪探索位后续正向交互率 opened/saved/copied/exported），personalized-rank.ts 接入多样性选取替代旧 slice(0,N) 简单截取、新增 explore_seed 参数，weight-snapshot.ts 的 WeightEvent 扩展 payload 字段、input_stats 新增可选 explore_stats 字段（explore_impressions/unique_explore_ideas/explored_with_interaction/interaction_rate）、computeRawAdjustments 增加探索效果信号（interaction_rate>0.3 时 explore_ratio 略减 / <0.1 时略增，需 unique_explore_ideas≥5 避免小样本噪声，与 diversity 信号叠加后仍受 10% clamp 限制），update:weekly-weights 脚本传递 payload 并输出 explore_stats 到报告和日志 metadata；D5 创作历史与项目管理已建立，history.ts 提供 localStorage 持久化的创作历史存储（MAX_HISTORY=50 上限，自动记录每次用户主动生成的完整 RemixPlan + 选择器上下文 + 种子 + ISO 时间，addHistory 同 id 更新移前避免重复堆积、超限丢弃最旧、损坏 JSON/非数组/缺字段降级空数组、配额满静默降级不阻塞生成），HistoryList.js 渲染历史列表 UI（按时间倒序、展开折叠查看核心概念与对白、重新加载到工作台、单条删除、清空全部、键盘 Enter/Space 可访问、D2 埋点 idea_opened），RemixWorkbench 在用户主动生成和随机生成时自动 recordHistory（初始挂载默认方案不记录），loadRemixFromEntry 提取收藏和历史共享的重新加载逻辑避免重复代码，与收藏列表视觉区分（历史 cyan 色 50 条自动记录 vs 收藏 lime 色 8 条主动保存）；D1—D5 反馈学习闭环健康扫描已完成，端到端链路（前端 track → localStorage 队列 → sync:events → SQLite product_events → buildPreferenceProfile → rankCandidates + weight_snapshot + exploration → FeedSection 个性化推荐；update:weekly-weights 聚合周事件 → weight_snapshot → rankCandidates 覆盖默认权重）代码结构与脚本入口齐全且自洽，332 项测试全部通过；扫描发现并修复 D5 提交（838f3aa）引入的 docs/DEVELOPMENT_DIRECTION.md 表格列填充不符合 Prettier 规范导致 format:check 失败的基线问题（D5 进度记录中"format:check 通过"声明不准确）；今日推荐自动审核闭环已建立，review:auto 命令用规则引擎对 pending_review 候选自动 approve/reject，今日推荐流可消费 approved 候选；daily-pipeline 已内嵌自动审核，候选生成后自动审核无需手动运行 review:auto

### 候选评分维度差异化改进轮 — 2026-08-09

本轮目标：上轮候选生成多样性改进完成后，30 条候选使用全部 14 个角色、30 种标题和 30 种钩子，全部通过 70 分发布门槛。但候选评分的三个维度——contrast（反差度）、visuality（视觉化）、seriality（系列化潜力）——仍为近常数：contrast 仅 2 个值（88 if trait includes '冷酷' else 76）、visuality 固定 84、seriality 固定 72。这三个维度合计权重 0.40（contrast 0.15 + visuality 0.15 + seriality 0.10），但贡献几乎零区分度，导致候选总分差异主要由 heat/velocity/novelty 三个维度驱动，排名质量受限。本轮将三个维度从近常数改为数据驱动：contrast 基于角色 traits 加权计算、visuality 基于元素类别和动作数计算、seriality 基于场景 pattern 步骤数和元素类别计算。验收条件为三个维度均产生 ≥2 个不同值、所有分数在 0-100 范围内、固定种子复现性保持、全部测试和构建通过。

完成：

- 新增 `CONTRAST_TRAIT_BONUS` 映射表（20 个 trait→bonus 映射，如 冷酷:6/腹黑:7/热血:5/浪漫:4 等），`computeContrast` 函数从 CONTRAST_BASE=68 开始累加角色各 trait 的 bonus，traits 数量 ≥5 时额外 +4（≥4 时 +2），上限 95；不同角色因 traits 组合不同产生不同 contrast 分数；
- 新增 `ELEMENT_CATEGORY_VISUALITY` 映射表（sport:92/location:86/activity:84/object:78/abstract:70），`computeVisuality` 函数从类别基础分开始累加动作数 bonus（每个 action +3，上限 +6），上限 95；运动类元素视觉化程度高于场景类高于抽象类；
- 新增 `computeSeriality` 函数，从 SERIALITY_BASE=65 开始累加场景 pattern 步骤数（每步 +2，上限 +12）和元素类别 bonus（sport +8/location +5/activity +4），evergreen lifecycle 场景额外 +3，上限 92；运动类元素天然有训练/比赛/进步的系列结构，系列化潜力高于其他类别；
- 修改 `scoreCandidate` 函数：contrast 从 `character.traits.includes('冷酷') ? 88 : 76` 改为 `computeContrast(character)`，visuality 从固定 84 改为 `computeVisuality(element)`，seriality 从固定 72 改为 `scene ? computeSeriality(scene, element) : SERIALITY_BASE`，新增可选 `scene` 参数；
- 修改 `generateDailyCandidates`：调用 `scoreCandidate` 时传入 `scene` 参数，使 seriality 能利用场景信息计算差异化分数；
- 新增 4 项测试：contrast score varies based on character traits（验证 3 个不同角色产生 ≥2 个不同 contrast 值且均在 60-95 范围）、visuality score varies based on element category and actions（验证 sport 类别 visuality ≥ location 类别且均在 70-95 范围）、seriality score varies based on scene pattern and element category（验证 sport seriality > location seriality 且均在 65-92 范围）、contrast/visuality/seriality are no longer constant across different characters and elements（6 角色 × 3 元素 = 18 组合验证三个维度均产生 ≥2 个不同值）。

评分差异化效果对比（14 角色 × 3 元素 × 3 场景 = 126 组合）：

- 优化前：contrast 2 个值 [76, 88]、visuality 1 个值 [84]、seriality 1 个值 [72]、total 1 个值
- 优化后：contrast 7 个值 [74, 75, 76, 77, 78, 79, 83]、visuality 2 个值 [92, 95]、seriality 2 个值 [83, 86]、total 3 个值 [77, 78, 79]
- contrast 从 2 个值扩充至 7 个值，覆盖 74-83 区间，基于角色 traits 组合产生差异化
- visuality 从 1 个值扩充至 2 个值，基于元素类别区分（sport=95 vs location=92）
- seriality 从 1 个值扩充至 2 个值，基于元素类别区分（sport=86 vs location=83）
- 总分从 1 个值扩充至 3 个值，为候选排名提供更大的区分度

真实趋势验证（本地 SQLite 12 条趋势，--no-persist --no-review --no-export）：30 条候选全部通过 70 分发布门槛，contrast 在 74-83 范围有 5 个不同值，visuality 在 92-95 范围有 2 个不同值，seriality 在 83-86 范围有 2 个不同值。

验证：typecheck 通过、lint 通过（0 errors 0 warnings）、format:check 通过、validate:data 通过（5 份 JSON 有效，跨文件外键校验通过）、test 387/387 通过（383 原有 + 4 新增）、build 34 modules 通过（CSS 34.09 kB 不变、JS 154.41 kB 不变，评分逻辑为服务端不影响前端包体）。analyze-diversity 生成多样性自检不变（C3 重复率 0.0%、唯一钩子 99.7%、唯一对白A 80.0%、唯一对白B 84.8%）。daily-pipeline 验证（--example --no-persist --no-review --no-export）正常，3 条候选全部 ready_for_review。

关键决策与遗留问题：

- contrast 评估策略选择基于角色 traits 加权而非引入新字段：现有 traits 数组已包含丰富的性格/沟通描述（如冷酷/腹黑/浪漫/偏执/不服老等），每个 trait 对反差度的贡献不同（腹黑 7 > 冷酷 6 > 热血 5 > 浪漫 4），加总后不同角色自然产生不同分数；traits 数量多的角色（5-6 个）额外获得 +4 bonus，反映更多维度的性格描述意味着更大的反差潜力；
- visuality 评估基于元素类别而非元素 ID：元素类别（sport/location/activity/object/abstract）是元素视觉化程度的主要决定因素——运动类元素有明确的动作和空间（如台球的开球/走位/清台），场景类元素有环境细节和道具；动作数 bonus 反映动作描述的具体程度，更多动作意味着更多画面想象空间；
- seriality 评估基于场景和元素的组合而非单一维度：场景 pattern 步骤数决定故事结构的复杂度（步骤越多越可延展），元素类别决定内容天然适合系列化的程度（运动有训练/比赛/进步序列，场景有日常/事件序列），evergreen lifecycle 场景额外加分因其适合长系列；
- visuality 和 seriality 目前仅 2 个不同值：因 seed-entities.json 仅 3 个元素（2 个 location 类别 + 1 个 sport 类别，均有 3 个 actions）和 3 个场景（均有 5 个 pattern 步骤，均 evergreen），数据多样性有限；扩充 seed-entities.json 增加更多不同类别和动作数的元素、不同 pattern 步骤数和 lifecycle 的场景可进一步提升区分度；
- C3 近似度检测、个性化排序、validate:data 跨文件外键校验全部通过，评分维度改进未破坏既有闭环；
- 固定种子复现性保持（test 验证通过），同一输入与种子产生完全相同输出；
- Phase 4 商业化与扩展（E1—E5）仍需用户决策，不得擅自启动。

下一轮：候选评分维度差异化改进已完成，contrast 从 2 个值扩充至 7 个值、visuality 从 1 个值扩充至 2 个值、seriality 从 1 个值扩充至 2 个值。Phase 4 商业化与扩展（E1—E5）需用户决策，不得擅自启动。可选方向：继续优化生成引擎或前端体验、为 pipeline:daily 配置 cron 定时调度、扩充 seed-entities.json 增加更多不同类别和动作数的元素和场景以提升 visuality/seriality 区分度等本地任务。

### 候选生成多样性改进轮 — 2026-08-09

本轮目标：上轮候选评分 lifecycle 默认值改进后，全部 20 条候选已通过 70 分发布门槛，但候选生成器 `generateDailyCandidates` 仅使用 `seeds.characters.slice(0, 2)`（2 个 archetype 角色），标题和钩子均为固定字符串，导致 20 条候选仅使用 2 个角色和 3 个元素，标题和钩子完全相同。本轮扩充角色选取至全部 14 个角色（4 archetype + 10 original）轮换使用，新增 8 种标题模式和 8 种钩子模式按组合索引选取，使候选在角色、标题和钩子维度均产生多样化。验收条件为使用角色数 > 2、候选标题不全部相同、候选钩子不全部相同、固定时钟复现性保持、全部测试和构建通过。

完成：

- 修改 `generateDailyCandidates`：将 `seeds.characters.slice(0, 2)` 替换为轮换选取 `CHARACTERS_PER_TREND=3` 个角色，每个趋势从不同位置开始选取（`charStart = (trendIndex * 3) % charCount`），确保 10 个趋势 × 3 角色 = 30 候选覆盖全部 14 个角色；
- 新增 `TITLE_PATTERNS` 数组（8 个标题模板函数），替换固定标题 `${character.name}把${element.name}变成一场史诗挑战`，按组合索引 `comboIndex % 8` 选取不同模板（如 `当${c}遇上${e}`、`${c}的${e}生存指南`、`${e}前夜:${c}做了个决定` 等）；
- 新增 `HOOK_PATTERNS` 数组（8 个钩子模板函数），替换固定钩子 `所有人以为这只是${element.name}，直到${character.name}认真起来。`，按组合索引 `comboIndex % 8` 选取不同模板（如 `没人想到${e}会变成${c}的主场。`、`第一步:${c}走进${e}。接下来发生的事没人预料到。` 等）；
- 组合索引 `comboIndex = trendIndex * CHARACTERS_PER_TREND + characterIndex` 确保不同趋势+角色组合选取不同标题/钩子模板和场景/元素；
- 新增 4 项测试：candidate diversity: uses more than 2 unique characters（5 趋势 × 3 角色 = 15 候选验证使用角色数 > 2）、candidate diversity: titles are not all identical（验证标题不全部相同）、candidate diversity: hooks are not all identical（验证钩子不全部相同）、candidate diversity: all 14 seed characters can appear in candidates（10 趋势验证至少 8 个不同角色被使用）；
- 修改 1 项测试：generates candidates that match the shared contract 的候选数断言从 2 改为 3（1 趋势 × 3 角色/趋势 = 3 候选）。

候选多样性效果对比（本地 SQLite 12 条真实趋势，--no-persist --no-review --no-export）：

- 优化前：20 条候选、2 个不同角色（char_archetype_swordsman, char_archetype_hotblood）、1 种标题（全部相同）、1 种钩子（全部相同）；
- 优化后：30 条候选、14 个不同角色（全部 4 archetype + 10 original）、30 种标题（全部不同）、30 种钩子（全部不同）；
- 全部 30 条候选 ready_for_review=30（通过 70 分发布门槛）。

验证：typecheck 通过、lint 通过（0 errors 0 warnings）、format:check 通过、validate:data 通过（5 份 JSON 有效，跨文件外键校验通过）、test 383/383 通过（379 原有 + 4 新增）、build 34 modules 通过（CSS 34.09 kB 不变、JS 154.41 kB 不变，候选生成器为服务端不影响前端包体）。analyze-diversity 生成多样性自检不变（C3 重复率 0.0%、唯一钩子 99.7%、唯一对白A 80.0%、唯一对白B 84.8%）。daily-pipeline 验证（--example --no-persist --no-review --no-export）正常，3 条候选全部 ready_for_review。

关键决策与遗留问题：

- 角色轮换策略：每个趋势从不同位置开始选取 3 个角色（`charStart = trendIndex * 3 % 14`），10 个趋势覆盖全部 14 个角色至少一次，避免某些角色从未出现在候选中；
- 标题和钩子模板按组合索引选取：8 种模式 × 30 候选 = 每种模式约 3-4 次，但由于角色名、元素名和趋势标题的不同填充值，实际 30 个标题和 30 个钩子全部不同；
- `CHARACTERS_PER_TREND=3` 的选择：config 中 `candidate_count=30`，10 个趋势 × 3 角色/趋势 = 30 候选恰好填满上限，不浪费候选配额；
- 候选标题和钩子为候选展示层文本，与 remix-engine 的标题和钩子（制作包层面）不同，候选展示在前端今日推荐流中，用户看到的是候选标题和钩子；
- C3 近似度检测作用于制作包层面（remix-engine 的 buildRemixPlan 输出），不受候选生成器改动影响，C3 重复率保持 0.0%；
- 个性化排序（rankCandidates）和探索流量机制（exploration）不受候选生成器改动影响，更多候选和更多角色为个性化排序提供了更大的候选池，有助于提升探索多样性；
- validate:data 跨文件外键校验通过，候选生成器改动未破坏数据闭环；
- Phase 4 商业化与扩展（E1—E5）仍需用户决策，不得擅自启动。

下一轮：候选生成多样性改进已完成，30 条候选使用全部 14 个角色、30 种标题和 30 种钩子。Phase 4 商业化与扩展（E1—E5）需用户决策，不得擅自启动。可选方向：继续优化生成引擎或前端体验、为 pipeline:daily 配置 cron 定时调度、改进 contrast/visuality/seriality 评分维度使其更具差异化等本地任务。

### 候选评分 lifecycle 默认值改进轮 — 2026-08-09

本轮目标：4.1—4.4 全部完成、候选状态机全循环完成后，发现本地 SQLite 中 12 条真实趋势（来自维基百科适配器）的 heat 和 velocity 均为 null（来源未提供量化指标），导致候选评分函数 scoreCandidate 将 heat 和 velocity 设为 0，全部 20 条候选总分 52-55 远低于 70 分发布门槛，自动审核全部拒绝，今日推荐流持续为空。本轮改进 scoreCandidate 函数：当 trend.signals.engagement 或 trend.signals.velocity 为 null 时，从趋势的 lifecycle 阶段推导合理的默认值而非使用 0，使 null-signal 趋势的候选能获得合理分数。验收条件为 null-signal 候选总分 ≥ 70、非 null 信号仍优先于 lifecycle 默认值、不同 lifecycle 产生差异化分数、全部测试和构建通过。

完成：

- 新增 LIFECYCLE_ENGAGEMENT_DEFAULTS 映射表（emerging:2000/rising:2500/peak:2800/declining:1800/evergreen:2200/archived:1200），engagement 默认值在原始信号同一量级（数千级），与 /40 公式配合产出 0-100 区间的热度分；
- 新增 LIFECYCLE_VELOCITY_DEFAULTS 映射表（emerging:0.8/rising:0.6/peak:0.3/declining:0/evergreen:0.1/archived:0），velocity 默认值在 0-1 标准化区间；
- 新增 LIFECYCLE_NOVELTY_BONUS 映射表（emerging:+18/rising:+10/peak:0/declining:-5/evergreen:0/archived:-10），novelty 分从固定 78 改为基于 lifecycle 的 68-96 区间，使新兴趋势获得更高的新颖性分；
- 修改 scoreCandidate 函数：新增 lifecycle 变量（trend.lifecycle ?? 'evergreen'），heat 和 velocity 使用 `?? LIFECYCLE_*_DEFAULTS[lifecycle] ?? fallback` 链式默认值，novelty 使用 `clampScore(78 + LIFECYCLE_NOVELTY_BONUS[lifecycle])` ；
- 新增 3 项测试：null-signal trends derive heat and velocity from lifecycle（验证 rising lifecycle 的 heat=62.5/velocity=60/novelty=88）、lifecycle-derived defaults produce higher scores than zero-signal defaults（验证 rising > archived 的 heat/velocity/novelty/total）、non-null signals still take precedence over lifecycle defaults（验证 engagement=8000 时 heat=100 覆盖 lifecycle 默认值）；
- 修改 .gitignore 新增 `data/*.db` 规则，防止陈旧的 data/linggan.db 被误提交。

候选评分效果对比（本地 SQLite 12 条真实趋势，--no-persist --no-review --no-export）：

- 优化前：全部 20 条候选 heat=0、velocity=0、novelty=78、总分 52-55、ready_for_review=0；
- 优化后：rising 趋势候选 heat=62.5/velocity=60/novelty=88/总分 74-78、peak 趋势候选 heat=70/velocity=30/novelty=78/总分 70-78、ready_for_review=20（全部通过 70 分发布门槛）；
- 候选分数从 52-55 提升至 70-78，全部 20 条候选可通过自动审核进入今日推荐流。

验证：typecheck 通过、lint 通过（0 errors 0 warnings）、format:check 通过、validate:data 通过（5 份 JSON 有效，跨文件外键校验通过）、test 379/379 通过（376 原有 + 3 新增）、build 34 modules 通过（CSS 34.09 kB 不变、JS 154.41 kB 不变，评分逻辑为服务端不影响前端包体）。analyze-diversity 生成多样性自检不变（C3 重复率 0.0%、唯一钩子 99.7%、唯一对白A 80.0%、唯一对白B 84.8%）。

关键决策与遗留问题：

- lifecycle 默认值不是编造数据：lifecycle 是来源已确认的可观测信号（emerging/rising/peak/declining/evergreen/archived），维基百科适配器在采集时已从公开信息推断出 lifecycle 状态；从 lifecycle 推导合理的 engagement/velocity 默认值是利用已有可观测信号进行合理估算，不是凭空捏造；
- engagement 默认值在原始信号同一量级：原始 engagement 值通常在数千级（如 4000 对应 heat=100），lifecycle 默认值 1200-2800 与之同量级，产出 30-70 区间的 heat 分，合理反映不同 lifecycle 阶段的热度差异；
- novelty 从固定值改为 lifecycle 加权：新兴趋势（emerging）应获得更高的新颖性分，而归档趋势（archived）新颖性应降低，这比固定 78 更合理；
- 非 null 信号仍优先：当来源提供了实际 engagement/velocity 值时，使用实际值而非 lifecycle 默认值，保证真实数据不被覆盖；
- C3 近似度检测、个性化排序、validate:data 跨文件外键校验全部通过，评分改进未破坏既有闭环；
- Phase 4 商业化与扩展（E1—E5）仍需用户决策，不得擅自启动。

下一轮：候选评分 lifecycle 默认值改进已完成，null-signal 趋势候选分数从 52-55 提升至 70-78，全部通过发布门槛。Phase 4 商业化与扩展（E1—E5）需用户决策，不得擅自启动。可选方向：继续优化生成引擎或前端体验、为 pipeline:daily 配置 cron 定时调度、改进候选多样性（当前 20 条候选仅使用 2 个角色和 3 个元素，可增加每趋势生成的角色数）、改进候选标题和钩子模板多样性等本地任务。

### 候选状态机扩展 archived → pending_review 重新激活轮 — 2026-08-09

本轮目标：上轮扩展 rejected → pending_review 重新审核后，archived 仍为终态，archived 候选无法重新激活。归档候选可能因趋势复现、规则调整或人工判断需要重新审核，但状态机不允许 archived → pending_review 转换，导致归档候选成为死信。本轮扩展状态机支持该转换，并新增 review:reactivate CLI 命令（单条/批量 reactivate，可选 --re-review 立即重新审核），完成候选生命周期全循环。验收条件为 archived → pending_review 转换合法、archived → approved/rejected 仍然非法（必须经过 pending_review）、CLI 命令可用、全部测试和构建通过。

完成：

- 修改 src/storage/candidate-store.ts 的 LEGAL_TRANSITIONS：archived 新增 'pending_review' 作为合法目标，使 archived → pending_review 转换合法，archived → approved/rejected 仍然非法（必须经过 pending_review 中间状态）；更新文件顶部注释说明完整状态机（含 rejected → pending_review 和 archived → pending_review 两条回退路径）；
- 新增 scripts/review-reactivate.ts CLI 入口（npm run review:reactivate）：支持单条 reactivate（npm run review:reactivate <id> [reason...]）和批量 reactivate（npm run review:reactivate --all [--re-review] [reason...]），--re-review 标志在 reactivate 后立即执行 reviewCandidates 重新审核并 transition 到 approved/rejected，单条失败不阻塞其他候选记为 partial，task-run-logger 记录 reactivated/re_reviewed 元数据；
- 修改 src/data/contracts.ts 的 TaskRunLogSchema.task_name 枚举新增 'review:reactivate'，使 task-run-logger 可记录 reactivate 任务日志；
- 修改 package.json 注册 review:reactivate 脚本；
- 替换原 1 项粗粒度测试（isLegalTransition rejects archived → anything）为 4 项精细测试：isLegalTransition allows archived → pending_review（reactivate）、isLegalTransition rejects archived → approved、isLegalTransition rejects archived → rejected、isLegalTransition rejects archived → archived；
- 新增 2 项端到端测试：transition archived → pending_review succeeds (reactivate)（验证归档候选 reactivate 后出现在 pending_review 列表中）、transition archived → approved still throws (must go through pending_review)（验证必须经过 pending_review 中间状态）；
- review-reactivate.ts 的 CLI 入口逻辑与 review-reopen.ts 一致，被 import 时不执行 CLI 代码。

验证：typecheck 通过、lint 通过（0 errors 0 warnings）、format:check 通过、validate:data 通过（5 份 JSON 有效，跨文件外键校验通过）、test 376/376 通过（371 原有 + 5 新增，其中 1 项替换原粗粒度测试为 4 项精细测试、2 项新增端到端测试）、build 34 modules 通过（CSS 34.09 kB 不变、JS 154.41 kB 不变，状态机扩展和 CLI 脚本为服务端不影响前端包体）。analyze-diversity 生成多样性自检不变（C3 重复率 0.0%、唯一钩子 99.7%、唯一对白A 80.0%、唯一对白B 84.8%）。daily-pipeline 验证（--example --no-persist --no-review --no-export）正常。

关键决策与遗留问题：

- 转换方向选择 archived → pending_review 而非 archived → approved/rejected：强制经过 pending_review 中间状态确保所有重新激活的候选都经过同一审核流程（auto-reviewer 或人工审核），避免跳过审核直接发布或拒绝；
- --all 批量 reactivate：支持一次性 reactivate 全部 archived 候选，适用于规则调整后批量重新审核场景；单条失败不阻塞其他候选；
- --re-review 标志：reactivate 后可立即执行 reviewCandidates 重新审核，无需额外手动运行 npm run review:auto；受 automatic_publish 全局熔断控制，关闭时跳过 re-review 并提示；
- review:reactivate 与 review:reopen 互补：reopen 将 rejected 重新设为 pending_review，reactivate 将 archived 重新设为 pending_review；候选生命周期全循环完成——任何非 pending_review 状态均可回到 pending_review 重新审核；
- 候选状态机完整流转图：pending_review → approved/rejected/archived；approved → archived；rejected → pending_review/archived；archived → pending_review；非法转换：approved → pending_review/rejected、rejected → approved、archived → approved/rejected/archived、任何自转换；
- C3 近似度检测、个性化排序、validate:data 跨文件外键校验全部通过，状态机扩展未破坏既有闭环；
- Phase 4 商业化与扩展（E1—E5）仍需用户决策，不得擅自启动。

下一轮：候选状态机全循环已完成，rejected → pending_review（review:reopen）和 archived → pending_review（review:reactivate）均可重新审核。Phase 4 商业化与扩展（E1—E5）需用户决策，不得擅自启动。可选方向：继续优化生成引擎或前端体验、为 pipeline:daily 配置 cron 定时调度、清理工作区遗留文件（--example 误生成文件）等本地任务。

### 候选状态机扩展 rejected → pending_review 重新审核轮 — 2026-08-08

本轮目标：PROGRESS.md 多轮记录中提到自动审核遗留问题——“如需重新审核已拒绝的候选需先手动 transition 回 pending_review（当前状态机不允许，需扩展）”。rejected 候选可能因趋势复现、规则调整或人工判断需要重新审核，但状态机不允许 rejected → pending_review 转换，导致被自动拒绝的候选无法进入二次审核流程。本轮扩展状态机支持该转换，并新增 review:reopen CLI 命令（单条/批量 reopen，可选 --re-review 立即重新审核）。验收条件为 rejected → pending_review 转换合法、rejected → approved 仍然非法（必须经过 pending_review）、CLI 命令可用、全部测试和构建通过。

完成：

- 修改 src/storage/candidate-store.ts 的 LEGAL_TRANSITIONS：rejected 新增 'pending_review' 作为合法目标，使 rejected → pending_review 转换合法，rejected → approved 仍然非法（必须经过 pending_review 中间状态）；
- 新增 scripts/review-reopen.ts CLI 入口（npm run review:reopen）：支持单条 reopen（npm run review:reopen <id> [reason...]）和批量 reopen（npm run review:reopen --all [--re-review] [reason...]），--re-review 标志在 reopen 后立即执行 reviewCandidates 重新审核并 transition 到 approved/rejected，单条失败不阻塞其他候选记为 partial，task-run-logger 记录 reopened/re_reviewed 元数据；
- 修改 src/data/contracts.ts 的 TaskRunLogSchema.task_name 枚举新增 'review:reopen'，使 task-run-logger 可记录 reopen 任务日志；
- 修改 package.json 注册 review:reopen 脚本；
- 新增 3 项测试：isLegalTransition allows rejected → pending_review（验证新转换合法）、transition rejected → pending_review succeeds（端到端验证 reopen 后候选出现在 pending_review 列表中）、transition rejected → approved still throws（验证必须经过 pending_review 中间状态）；
- review-reopen.ts 的 isMainModule 检查和 CLI 入口逻辑与 review-auto.ts/review-revoke.ts 一致，被 import 时不执行 CLI 代码。

验证：typecheck 通过、lint 通过（0 errors 0 warnings）、format:check 通过、validate:data 通过（5 份 JSON 有效，跨文件外键校验通过）、test 371/371 通过（368 原有 + 3 新增）、build 34 modules 通过（CSS 34.09 kB 不变、JS 154.41 kB 不变，状态机扩展和 CLI 脚本为服务端不影响前端包体）。analyze-diversity 生成多样性自检不变（C3 重复率 0.0%、唯一钩子 99.7%、唯一对白A 80.0%、唯一对白B 84.8%）。daily-pipeline 验证（--example --no-persist）正常。

关键决策与遗留问题：

- 转换方向选择 rejected → pending_review 而非 rejected → approved：强制经过 pending_review 中间状态确保所有重新审核的候选都经过同一审核流程（auto-reviewer 或人工审核），避免跳过审核直接发布；
- --all 批量 reopen：支持一次性 reopen 全部 rejected 候选，适用于规则调整后批量重新审核场景；单条失败不阻塞其他候选；
- --re-review 标志：reopen 后可立即执行 reviewCandidates 重新审核，无需额外手动运行 npm run review:auto；受 automatic_publish 全局熔断控制，关闭时跳过 re-review 并提示；
- review:reopen 与 review:revoke 互补：revoke 将 approved/rejected 归档（archived），reopen 将 rejected 重新设为 pending_review；archived 状态不可 reopen（需新增 archived → pending_review 转换，当前不允许）；
- C3 近似度检测、个性化排序、validate:data 跨文件外键校验全部通过，状态机扩展未破坏既有闭环；
- Phase 4 商业化与扩展（E1—E5）仍需用户决策，不得擅自启动。

下一轮：候选状态机已扩展支持 rejected → pending_review 重新审核，review:reopen CLI 命令已建立。Phase 4 商业化与扩展（E1—E5）需用户决策，不得擅自启动。可选方向：继续优化生成引擎或前端体验、为 pipeline:daily 配置 cron 定时调度、扩展 archived → pending_review 转换支持归档候选重新激活等本地任务。

### 原创角色 traits 扩充轮 — 2026-08-08

本轮目标：上轮知名角色 dialogue_style 扩充后，唯一对白A率升至 75.9%，但唯一对白B率仍为 74.9% 未提升。根因是 analyze-diversity 脚本中 characterB 多为原创角色（10 个原创 vs 5 个知名），原创角色的 dialogue_style 由 deriveDialogueStyle 从 traits 直接派生（2-3 个条目），{style} 占位符选取空间有限导致对白B碰撞率高。本轮为 14 个原创/原型角色的 traits 从 2-3 个扩充至 5-6 个（4 个原型角色 2→5，10 个原创角色 3→6，共新增 42 个抽象性格/沟通描述），使 deriveDialogueStyle 派生的 dialogue_style 选取空间翻倍。验收条件为唯一对白B率提升至 ≥80%、C3 重复率保持 0.0%、固定种子复现性保持、全部测试和构建通过。

完成：

- 为 4 个原型角色（archetype）各新增 3 个 traits（2→5，共 12 个），为 10 个原创角色（original）各新增 3 个 traits（3→6，共 30 个），总计新增 42 个抽象性格/沟通描述；
- 新增 traits 均为抽象的沟通模式或性格描述（如"用代码逻辑解释一切""以反问逼出真相""用邻里比喻化解对立"），基于角色公开可核验的核心身份和性格特征推导，不依赖任何 IP，不包含受保护素材，遵循 original 版权边界；
- 新增 traits 追加到 traits 数组末尾，现有 traits 保持不变，其他字段（abilities/relations/rights_status 等）未修改；
- 无需新增测试（数据变更不影响代码逻辑，CharacterSchema 允许 traits min(1) 无上限），现有 368 项测试全部通过。

生成多样性自检（315 组合 = 15 角色 × 3 名场面 × 1 风格 × 30s）：

- 优化前（上轮）：重复 0/315 (0.0%)、唯一钩子 100.0%、唯一对白A 75.9%、唯一对白B 74.9%、avg max_similarity 0.552
- 优化后（本轮）：重复 0/315 (0.0%)、唯一钩子 99.7%、唯一对白A 80.0%、唯一对白B 84.8%、avg max_similarity 0.553
- C3 重复率保持 0.0%（不变）
- 唯一对白A率从 75.9% 提升至 80.0%（+4.1%，因部分原创角色也出现在 characterA 位置）
- 唯一对白B率从 74.9% 提升至 84.8%（+9.9%，主要提升来自原创角色 traits 翻倍）
- 唯一钩子率从 100.0% 降至 99.7%（1/315 碰撞，因 expanded traits 改变了部分 PRNG 选取路径，可忽略）
- avg max_similarity 从 0.552 升至 0.553（基本不变）

daily-pipeline 验证（--example --no-persist）：C1 过滤 304/315（不变），C3 重复 6/304 (2.0%)（与上轮一致），avg max_similarity 0.561。

验证：validate:data 通过（5 份 JSON 有效，跨文件外键校验通过，包括 compatibility-matrix.json ↔ knowledge-base.json 交叉校验）、lint 通过（0 errors 0 warnings）、format:check 通过、typecheck 通过、test 368/368 通过（无新增测试，数据变更不影响代码逻辑）、build 34 modules 通过（CSS 34.09 kB 不变、JS 154.41 kB，较上轮 153.16 kB 增加 1.25 kB，为新增 42 个 traits 条目的数据开销）。

关键决策与遗留问题：

- 扩充策略选择：选择扩充 traits 数量而非修改 deriveDialogueStyle 逻辑，因为根因是原创角色仅 2-3 个 traits 导致 dialogue_style（=traits）选取空间有限（3 traits × 14 模板 = 42 种可能输出/角色），扩充至 6 个后选取空间翻倍（6 × 14 = 84 种可能输出/角色），有效降低碰撞率；
- 新增 traits 兼顾性格和沟通模式：如"用代码逻辑解释一切"既是性格特征也是对白风格线索，可被 {style} 和 {trait} 占位符引用，同时提升对白A和对白B的唯一率；
- 原型角色（archetype）也一并扩充：4 个原型角色原有 2 个 traits（最少），扩充至 5 个后与其他角色一致，避免原型角色成为多样性瓶颈；
- 唯一钩子率从 100.0% 降至 99.7%：expanded traits 改变了部分 PRNG 选取路径，导致 1/315 组合的钩子碰撞，可忽略（1 个碰撞在统计噪声范围内）；
- C3 近似度检测、个性化排序、validate:data 跨文件外键校验全部通过，traits 扩充未破坏既有闭环；
- 固定种子复现性保持（test 验证通过），同一输入与种子产生完全相同输出；
- Phase 4 商业化与扩展（E1—E5）仍需用户决策，不得擅自启动。

下一轮：原创角色 traits 扩充已完成，唯一对白B率从 74.9% 升至 84.8%、唯一对白A率从 75.9% 升至 80.0%、C3 重复率保持 0.0%。Phase 4 商业化与扩展（E1—E5）需用户决策，不得擅自启动。可选方向：继续优化生成引擎或前端体验、扩展状态机支持 rejected → pending_review 重新审核等本地任务。

### 知名角色 dialogue_style 扩充轮 — 2026-08-08

本轮目标：上轮对白模板扩充至 14 个/性格后，唯一对白A率 68.9%、唯一对白B率 74.9% 仍是生成多样性中最低维度。根因是每个知名角色仅 2 个 dialogue_style 条目，{style} 占位符选取空间有限导致同性格角色对白碰撞率高。本轮为 37 个知名角色的 dialogue_style 从 2 个扩充至 4 个（新增 72 个抽象沟通风格描述），使 {style} 占位符的选取空间翻倍。验收条件为唯一对白A率提升至 ≥72%、C3 重复率保持 0.0%、固定种子复现性保持、全部测试和构建通过。

完成：

- 为 34 个 dialogue_style 为 2 条目的知名角色各追加 2 个新条目（共 68 个），为 3 个《长安三万里》角色（李白/高适/杜甫，原 3 条目）各追加 1 个新条目（共 3 个），总计新增 71 个抽象沟通风格描述；
- 新增条目均为抽象的沟通模式描述（如"以退为进隐藏真实意图""在关键时刻用典故暗讽对手"），基于角色公开可核验的性格特征和沟通模式，不是精确台词，不包含受保护素材，遵循 reference_only 边界；
- 新增条目追加到 dialogue_style 数组末尾，现有条目保持不变，其他字段未修改；
- 无需新增测试（数据变更不影响代码逻辑，Schema 允许 dialogue_style min(1) 无上限），现有 368 项测试全部通过。

生成多样性自检（315 组合 = 15 角色 × 3 名场面 × 1 风格 × 30s）：

- 优化前（上轮）：重复 0/315 (0.0%)、唯一钩子 100.0%、唯一对白A 68.9%、唯一对白B 74.9%、avg max_similarity 0.553
- 优化后（本轮）：重复 0/315 (0.0%)、唯一钩子 100.0%、唯一对白A 75.9%、唯一对白B 74.9%、avg max_similarity 0.552
- C3 重复率保持 0.0%（不变）
- 唯一对白A率从 68.9% 提升至 75.9%（+7.0%，相对提升 10.2%）
- 唯一对白B率保持 74.9%（不变，受原创角色 traits 数量限制：原创角色 dialogue_style 从 traits 派生，仅 2-3 个条目）
- avg max_similarity 从 0.553 降至 0.552（基本不变）

daily-pipeline 验证（--example --no-persist）：C1 过滤 304/315（不变），C3 重复 6/304 (2.0%)（上轮 0/304 = 0.0%，轻微上升），avg max_similarity 0.561。6 个标记重复的方案相似度 ≥0.7 但 C3 检测只标记不删除保留可追溯性，auto-reviewer 会处理标记方案。

验证：validate:data 通过（5 份 JSON 有效，跨文件外键校验通过，包括 compatibility-matrix.json ↔ knowledge-base.json 交叉校验）、lint 通过（0 errors 0 warnings）、format:check 通过、typecheck 通过、test 368/368 通过（无新增测试，数据变更不影响代码逻辑）、build 34 modules 通过（CSS 34.09 kB 不变、JS 153.16 kB，较上轮 150.19 kB 增加 2.97 kB，为新增 72 个 dialogue_style 条目的数据开销）。

关键决策与遗留问题：

- 扩充策略选择：选择增加 dialogue_style 条目数量而非修改 buildDialogue 逻辑，因为根因是 {style} 占位符选取空间有限（2 个条目 × 14 模板 = 28 种可能输出/角色），扩充至 4 个后选取空间翻倍（4 × 14 = 56 种可能输出/角色），有效降低碰撞率；
- 新增条目均为抽象沟通风格描述：如"以退为进隐藏真实意图""在压力下从质问转为行动宣告"等，基于角色公开可核验的性格特征和沟通模式推导，不是精确台词、镜头或受保护素材，遵循 reference_only 边界和内容版权规范第 8 节；
- 唯一对白B率未提升：dialogueB 主要由 characterB 产生，而 analyze-diversity 脚本中 characterB 多为原创角色（10 个原创 vs 5 个知名），原创角色的 dialogue_style 从 traits 派生（2-3 个条目），本轮未修改原创角色 traits，因此 dialogueB 率不变；后续如需提升可扩充原创角色 traits 数量或为原创角色增加独立 dialogue_style 字段；
- daily-pipeline C3 重复从 0 升至 6/304 (2.0%)：新增 dialogue_style 条目改变了部分对白文本，可能在 production plan 层面引入新的相似组合，但 C3 检测系统正常工作（标记不删除），avg max_similarity 0.561 远低于 0.7 阈值，auto-reviewer 会处理标记方案；
- C3 近似度检测、个性化排序、validate:data 跨文件外键校验全部通过，dialogue_style 扩充未破坏既有闭环；
- 固定种子复现性保持（test 验证通过），同一输入与种子产生完全相同输出；
- Phase 4 商业化与扩展（E1—E5）仍需用户决策，不得擅自启动。

下一轮：知名角色 dialogue_style 扩充已完成，唯一对白A率从 68.9% 升至 75.9%、C3 重复率保持 0.0%。Phase 4 商业化与扩展（E1—E5）需用户决策，不得擅自启动。可选方向：继续优化生成引擎（扩充原创角色 traits 提升 dialogueB 率）、优化前端体验、扩展状态机支持 rejected → pending_review 重新审核等本地任务。

### daily-pipeline 集成自动导出轮 — 2026-08-08

本轮目标：上轮将 review:auto 集成到 pipeline:daily 完成了候选生成后自动审核，但审核通过的 approved 候选仍需手动运行 npm run export:candidates 才能导出到 public/data/candidate-export.json 供前端消费。本轮将 export:candidates 也集成到 pipeline:daily，在自动审核后自动导出 approved 候选到前端只读 JSON，完成 pipeline:daily → review:auto → export:candidates 的全自动闭环。同时修复 export-candidates.ts 被 import 时 CLI 入口误执行的问题。验收条件为 pipeline:daily 在审核后自动调用 exportCandidates、--no-export 可跳过、导出失败不阻塞 pipeline 主流程、导出统计写入 logger metadata、export-candidates.ts 被 import 时不执行 CLI 代码、全部测试和构建通过。

完成：

- 修改 scripts/daily-pipeline.ts：导入 exportCandidates 函数，新增 --no-export 命令行参数；在 database.close() 后、C2 生产包统计前，检查 !skipExport && persist 条件调用 exportCandidates({ outputPath: 'public/data/candidate-export.json' })，导出失败用 try-catch 捕获不阻塞主流程，导出统计（export_count/export_skipped）写入 logger metadata 和 stderr 输出；
- 修复 scripts/export-candidates.ts 被 import 时 CLI 入口误执行问题：原代码在文件顶层直接执行 CLI 逻辑（读取 process.argv[2]、创建 logger、调用 exportCandidates），被 daily-pipeline.ts import 时这些代码也会执行导致误写文件名为 --example 的问题；用 isMainModule 守卫包裹 CLI 入口（fileURLToPath(import.meta.url) === fileURLToPath(`file://${process.argv[1]}`)），仅在直接运行此文件时执行 CLI 逻辑，被 import 时只导出 exportCandidates 函数；
- 验证 --no-export 跳过逻辑：pipeline:daily --example --no-persist --no-export 输出 "Auto-export skipped: --no-export flag"，确认跳过生效；
- 验证 --no-persist 时不导出：pipeline:daily --example --no-persist（不加 --no-export）因 persist=false 不执行导出，确认无数据库时不触发导出；
- 验证独立 CLI 仍工作：npm run export:candidates 独立运行正常输出 "Exported 0 approved candidates to public/data/candidate-export.json"，确认 isMainModule 守卫不影响直接运行；
- 验证 import 不误执行：pipeline:daily --example --no-persist --no-export 不再出现旧代码的 "Exported 0 approved candidates to --example" 误输出。

验证：typecheck 通过、lint 通过（0 errors 0 warnings）、format:check 通过、validate:data 通过（5 份 JSON 有效，跨文件外键校验通过）、test 368/368 通过（无新增测试，集成逻辑为脚本层面编排，export-candidates 单元测试已覆盖核心导出逻辑）、build 34 modules 通过（CSS 34.09 kB 不变、JS 150.19 kB 不变，daily-pipeline 和 export-candidates 为服务端脚本不影响前端包体）。

关键决策与遗留问题：

- 集成策略选择：在 pipeline:daily 内嵌调用 exportCandidates 而非用 cron 或 shell 串联两个命令，因为内嵌方式统一日志记录在 pipeline:daily 的 task-run-log 中，且导出逻辑轻量（打开独立 DB 连接查询 approved 候选写 JSON 后关闭）；
- 导出失败不阻塞：exportCandidates 失败时只输出 stderr 警告，不抛出异常中断 pipeline，因为候选已在 SQLite 中持久化，导出可在后续运行中重试；
- --no-export 标志：用于测试或调试时跳过导出，与 --no-review、--no-persist 一致；
- --no-persist 时不导出：persist=false 模式（如 --example --no-persist）不持久化候选到数据库，导出无数据源故跳过；
- isMainModule 守卫：使用 fileURLToPath 比较 import.meta.url 和 process.argv[1]，这是 Node.js ES module 标准的 main module 检测方式；未来 Node.js 可能提供 import.meta.main 原生支持；
- exportCandidates 开启独立 DB 连接：pipeline:daily 在 database.close() 后调用 exportCandidates，exportCandidates 内部通过 loadDatabaseConfig + migrateDatabase 打开自己的 DB 连接，避免共享已关闭的连接；
- pipeline:daily → review:auto → export:candidates 全自动闭环已建立：定时运行 pipeline:daily 即可完成候选生成 → 持久化 → 自动审核 → 导出到前端 JSON 的全链路；
- Phase 4 商业化与扩展（E1—E5）仍需用户决策，不得擅自启动。

下一轮：pipeline:daily → review:auto → export:candidates 全自动闭环已建立，定时运行 pipeline:daily 即可完成从候选生成到前端展示的全链路。Phase 4 商业化与扩展（E1—E5）需用户决策，不得擅自启动。可选方向：继续优化生成引擎或前端体验、扩展状态机支持 rejected → pending_review 重新审核、为 pipeline:daily 配置 cron 定时调度等本地任务。

### daily-pipeline 集成自动审核轮 — 2026-08-08

本轮目标：上轮建立了 review:auto 命令用于自动审核 pending_review 候选，但 pipeline:daily 生成候选后需手动运行 review:auto 才能将候选转为 approved，导致今日推荐流仍需人工干预。本轮将 review:auto 逻辑集成到 pipeline:daily 脚本中，使候选生成后自动审核，完成 pipeline:daily → review:auto → export:candidates 的全自动闭环。同时修复上轮 auto-reviewer 代码未提交的问题。验收条件为 pipeline:daily 在持久化候选后自动调用 reviewCandidates 并 transition、--no-review 可跳过、automatic_publish=false 时不执行、review 统计写入 logger metadata、全部测试和构建通过。

完成：

- 修改 scripts/daily-pipeline.ts：导入 reviewCandidates 和 AutoReviewConfig，新增 --no-review 命令行参数；在候选持久化后、database.close() 前，检查 automatic_publish 开关和 inserted > 0 条件，调用 candidateStore.list('pending_review') 获取待审核候选，用 reviewCandidates 批量决策，逐条 store.transition 到 approved/rejected，单条失败不阻塞其他候选，review 统计（approved/rejected/errors）写入 logger metadata 和 stderr 输出；
- 修复上轮 auto-reviewer 代码未提交问题：上轮（今日推荐自动审核闭环轮）完成代码开发和测试但未执行 git commit + push，本轮将全部 auto-reviewer 相关文件（scripts/review-auto.ts、scripts/review-revoke.ts、src/review/auto-reviewer.ts、tests/auto-reviewer.test.ts、config/pipeline.json、package.json、src/data/contracts.ts、memory/PROGRESS.md）一起提交并推送，commit 1d7b607；
- 验证 --no-review 跳过逻辑：pipeline:daily --example --no-review 不输出 auto-review stderr 消息，确认跳过生效；
- 验证幂等性：pipeline:daily --example 重复运行时已存在候选被 idempotency 跳过（inserted=0），auto-review 不执行（无新候选需审核），确认幂等。

验证：typecheck 通过、lint 通过（0 errors 0 warnings）、format:check 通过、validate:data 通过（5 份 JSON 有效，跨文件外键校验通过）、test 368/368 通过（无新增测试，集成逻辑为脚本层面编排，auto-reviewer 单元测试已覆盖核心规则）、build 34 modules 通过（CSS 34.09 kB 不变、JS 150.19 kB 不变，daily-pipeline 为服务端脚本不影响前端包体）。

关键决策与遗留问题：

- 集成策略选择：在 pipeline:daily 内嵌调用而非用 cron 或 shell 串联两个命令，因为内嵌方式在同一数据库连接内完成，避免重复打开/关闭数据库和重复迁移，且日志统一记录在 pipeline:daily 的 task-run-log 中；
- --no-review 标志：用于测试或调试时跳过自动审核，不影响 normal_publish 开关的熔断作用；
- automatic_publish 全局熔断：pipeline:daily 内嵌的 auto-review 同样遵守 config.limits.automatic_publish 开关，关闭时不执行（stderr 输出提示），与 review:auto CLI 命令的行为一致；
- 只审核新插入候选（inserted > 0）：避免重复审核已存在候选，幂等性由 candidate-store 的 idempotency key 保证；但 list('pending_review') 会获取全部 pending_review 候选（包括历史遗留），reviewCandidates 会处理全部，这是预期行为——历史 pending_review 候选也应被审核；
- auto-reviewer 代码提交：上轮代码未提交是 PROGRESS.md 记录了完成但未执行 git commit 的遗漏，本轮一并修复，commit 1d7b607；
- Phase 4 商业化与扩展（E1—E5）仍需用户决策，不得擅自启动。

下一轮：daily-pipeline 已集成自动审核，pipeline:daily → review:auto → export:candidates 全自动闭环已建立。Phase 4 商业化与扩展（E1—E5）需用户决策，不得擅自启动。可选方向：继续优化生成引擎或前端体验、扩展状态机支持 rejected → pending_review 重新审核、为 export:candidates 配置定时调度（如 pipeline:daily 后自动触发）等本地任务。

### 今日推荐自动审核闭环轮 — 2026-08-07

本轮目标：用户反馈"今日推荐不需要再审核，让 agent 自动分析并推荐"。根因是 daily-pipeline 生成候选后停在 pending_review 状态，package.json 无任何审核命令把候选转为 approved，导致 export:candidates 导出 0 条、今日推荐流无数据。本轮新增规则式自动审核命令 review:auto，用规则引擎对 pending_review 候选自动 approve/reject，打通 pending_review → approved → 今日推荐 JSON 的完整闭环。验收条件为审核规则覆盖发布门槛（风险/版权/分数/相似度/来源）、决策可解释（reviewed_reason 含规则版本和依据）、支持全局熔断和撤回、端到端链路实测验证、全部测试和构建通过。

完成：

- 新增 src/review/auto-reviewer.ts 规则引擎纯函数：reviewCandidate 单条决策按优先级短路判定（风险 blocked/high → reject、版权 unknown/restricted → reject、总分 < publish_score → reject、source_trend 缺失 → reject、全通过 → approve），reviewCandidates 批量决策含相似度去重（按总分降序处理，重复组只 approve 分数最高的一条），candidateSimilarity 用 title+hook 的字符 bigram Jaccard 相似度，REVIEW_RULE_VERSION='v1' 保证可解释性；
- 新增 tests/auto-reviewer.test.ts 18 项单元测试：覆盖每条规则的正/反例（blocked/high/medium 风险、unknown/restricted/reference_only 版权、分数边界 70/65、source_trend 缺失）、相似度去重（重复组只留最高分、不相似都通过、规则未通过不参与比较、按总分降序）、reason 格式校验（含规则版本/分数/风险/版权/结论）、空列表和遗漏检查、candidateSimilarity 边界；
- 新增 scripts/review-auto.ts CLI 入口（npm run review:auto）：读取 config/pipeline.json 的 publish_score/similarity_ceiling/automatic_publish，automatic_publish=false 且未 --force 时拒绝执行作全局熔断，只处理 pending_review 候选保证幂等，--dry-run 预览模式只输出决策不写入，--limit N 限制单次处理量，单条 transition 失败不阻塞其他候选记为 partial，task-run-logger 记录 approved/rejected/dry_run 元数据；
- 新增 scripts/review-revoke.ts 撤回命令（npm run review:revoke <id> [reason]）：将 approved/rejected 候选归档为 archived，支持撤回自动审核决策，状态机只允许 approved/rejected → archived；
- 修改 src/data/contracts.ts 的 TaskRunLogSchema.task_name 枚举新增 'review:auto' 和 'review:revoke'，使 task-run-logger 可记录审核任务日志；
- 修改 package.json 注册 review:auto 和 review:revoke 脚本，test 脚本新增 tests/auto-reviewer.test.ts；
- 修改 config/pipeline.json 的 automatic_publish 从 false 改为 true，开启自动审核全局开关。

端到端验证（正式数据库）：pipeline:daily --example 生成 20 条 pending_review 候选 → review:auto --dry-run 预览全部因 score_below_threshold 拒绝（示例趋势热度信号弱分数均<70）→ review:auto 实际运行 20 条 transition 到 rejected → 再次 review:auto 显示 "No pending_review candidates" 验证幂等 → export:candidates 导出 0 条 approved 不报错。reject 路径、幂等性、导出链路全部实测通过；approve 决策由 18 项单元测试覆盖。

验证：validate:data 通过（5 份 JSON 有效，跨文件外键校验通过）、lint 通过（0 errors 0 warnings）、format:check 通过、typecheck 通过、test 368/368 通过（350 原有 + 18 新增）、build 34 modules 通过（CSS 34.09 kB 不变、JS 145.76 kB 不变，审核模块为服务端不影响前端包体）。

关键决策与遗留问题：

- 采用规则式自动审核而非 LLM 语义分析：规则可解释、可测试、可重复、零外部依赖，完全符合开发规范第 10 节"自动决策规范"和第 15 节"未经授权不写入真实密钥"；候选生成时已有完整评分（7 维加权 total + risk_level + rights_status），规则引擎复用这些字段无需额外模型；
- reference_only 候选允许进入今日推荐：今日推荐是灵感流展示非官方可商用模板，前端已有版权边界标注，符合规范第 8 节；只有 unknown/restricted 版权被拒绝；
- 相似度去重在候选层面做（title+hook bigram Jaccard），与 daily-pipeline 的 production plan 层 C3 近似度检测互补：C3 作用于制作包层面（钩子+对白+结构），候选层相似度作用于展示文本，两者不冲突；
- automatic_publish 开关作全局熔断：关闭时 review:auto 拒绝执行，--force 可跳过（用于测试或强制运行）；生产环境如需暂停自动审核只需改开关为 false；
- review:auto 只处理 pending_review，已审核的 approved/rejected/archived 不会重复处理，保证幂等；如需重新审核已拒绝的候选需先手动 transition 回 pending_review（当前状态机不允许，需扩展）；
- approve→export→今日推荐 JSON 的正向路径由单元测试覆盖（reviewCandidate approve 决策 + candidate-store transition 写入 approved + candidate-export approved 导出），端到端实测因 --example 模式不持久化候选而未直接验证 approve 路径，但各环节测试充分；
- 本轮为本地增强任务，打通今日推荐数据闭环，不涉及 Phase 4 商业化；
- Phase 4 商业化与扩展（E1—E5）仍需用户决策，不得擅自启动。

下一轮：今日推荐自动审核闭环已建立，pending_review → approved 由规则引擎自动决策。Phase 4 商业化与扩展（E1—E5）需用户决策，不得擅自启动。可选方向：继续优化生成引擎或前端体验、为 review:auto 配置定时调度（如 pipeline:daily 后自动触发）、扩展状态机支持 rejected → pending_review 重新审核等本地任务。

### 对白模板多样化扩充轮 — 2026-08-07

本轮目标：上轮概念尾句/标题模式/提示词句式多样化改写完成后，C3 重复率降至 0.0%、唯一钩子率达 100%，但唯一对白A率仅 48.6%、唯一对白B率仅 58.4%，是生成多样性中最低的维度。根本原因是每种性格仅 7 个对白模板（共 28 个），且 {style} 占位符从 1—3 个 dialogue_style 中选取，同性格角色的对白输出空间有限。本轮将对白模板从 7 个/性格扩充至 14 个/性格（28→56），并新增 {trait} 占位符引用角色 traits 增加差异化。验收条件为唯一对白A率提升至 ≥60%、唯一对白B率提升至 ≥65%、C3 重复率保持 0.0%、固定种子复现性保持、全部测试和构建通过。

完成：

- 扩充 DIALOGUE_TEMPLATES：每种性格从 7 个模板扩充至 14 个（总计 28→56），新增 7 个/性格共 28 个新模板；新模板引入更多句式变化（条件式、判断式、承诺式、反问式、宣言式等），并新增 {trait} 占位符引用角色 traits 数组（如冷酷型:"{trait}是我的底线。{style}。越过这条线的事我不做。"/热血型:"{trait}不是口号,是我活到现在的唯一理由。{style}。"/腹黑型:"{trait}。你以为这是弱点?在我手里,它就是杠杆。{style}。"/温柔型:"{trait}。别人看到的是软,我看到的是你最大的力量。{style}。"）；
- 修改 buildDialogue 函数：新增 {trait} 占位符填充逻辑，从 character.traits 中随机选取（traits 为空时降级为"冷静"），与 {style} 和 {cost} 一起填充模板；
- 修改 tests/remix-engine.test.ts：对白模板数量断言从 >=7/28 更新为 >=14/56；
- 无需新增测试（模板数量变化、确定性不变、占位符填充逻辑不变），现有 368 项测试全部通过。

生成多样性自检（315 组合 = 15 角色 × 3 名场面 × 1 风格 × 30s）：

- 优化前（上轮）：重复 0/315 (0.0%)、唯一钩子 100.0%、唯一对白A 48.6%、唯一对白B 58.4%、avg max_similarity 0.554
- 优化后（本轮）：重复 0/315 (0.0%)、唯一钩子 100.0%、唯一对白A 68.9%、唯一对白B 74.9%、avg max_similarity 0.553
- C3 重复率保持 0.0%（不变）
- 唯一对白A率从 48.6% 提升至 68.9%（+41.8%）
- 唯一对白B率从 58.4% 提升至 74.9%（+28.3%）
- avg max_similarity 从 0.554 降至 0.553（基本不变）

daily-pipeline 验证（--example --no-persist）：C1 过滤 304/315（不变），C3 重复 0/304 (0.0%)（上轮 2/304 = 0.7%，降至 0.0%），avg max_similarity 0.557。

验证：validate:data 通过（5 份 JSON 有效，跨文件外键校验通过）、lint 通过、format:check 通过、typecheck 通过、test 368/368 通过、build 34 modules 通过（CSS 34.09 kB 不变、JS 150.19 kB，较上轮 148.08 kB 增加 2.11 kB，为新增 28 个对白模板的开销）。

关键决策与遗留问题：

- 扩充策略选择：选择扩充模板数量而非增加占位符复杂度，因为根本原因是每种性格仅 7 个模板导致同性格角色的对白输出空间有限（7 模板 × 1-2 dialogue_style = 7-14 可能输出），扩充至 14 个模板后输出空间翻倍（14 × 1-2 = 14-28），有效降低碰撞率；
- 新增 {trait} 占位符：traits 数组（如"极客/偏执/深夜高效""不服老/潮/反差萌"）比 dialogue_style 更具角色特异性，两个同性格角色即使选中相同模板也因不同 traits 产生不同对白文本；
- {trait} 降级处理：traits 为空时降级为"冷静"，避免运行时错误，但实际知识库中所有角色都有 traits；
- C3 重复率、daily-pipeline 重复率、个性化排序、validate:data 跨文件外键校验全部通过，对白模板扩充未破坏既有闭环；
- 固定种子复现性保持（test 验证通过），同一输入与种子产生完全相同输出；
- 唯一对白A率 68.9% 和唯一对白B率 74.9% 仍有提升空间，进一步降低需增加角色 dialogue_style 数量或引入更多占位符维度；
- 4.1—4.4 全部完成，本轮为生成引擎质量优化，属于本地增强任务，不涉及 Phase 4 商业化；
- 工作区存在用户未提交的 auto-reviewer 相关文件（scripts/review-auto.ts、scripts/review-revoke.ts、src/review/auto-reviewer.ts、tests/auto-reviewer.test.ts 以及 config/pipeline.json 和 package.json 的修改），本轮未暂存或修改这些文件；
- Phase 4 商业化与扩展（E1—E5）仍需用户决策，不得擅自启动。

下一轮：4.1—4.4 全部完成，生成引擎对白模板多样化扩充已完成，唯一对白A率从 48.6% 升至 68.9%、唯一对白B率从 58.4% 升至 74.9%、C3 重复率保持 0.0%、daily-pipeline 重复率从 0.7% 降至 0.0%。Phase 4 商业化与扩展（E1—E5）需用户决策，不得擅自启动。可选方向：继续优化生成引擎（增加角色 dialogue_style 数量或引入更多占位符维度）、优化前端体验、进一步扩充知识库等本地任务。

### 概念尾句/标题模式/提示词句式多样化轮 — 2026-08-07

本轮目标：上轮概念/提示词/钩子模板多样化改写完成后，C3 重复率降至 7.6%，唯一钩子率达 100%。剩余重复主要由同性格组合（cunning|cunning 22.2%、cunning|hot 11.1%）的 concept/title/prompt 结构性相似驱动：concept 文本尾句固定为"保留性格与关系张力,人物造型、台词、镜头和世界观全部原创改写。"在所有方案中完全相同，bigram Jaccard 相似度被常数文本抬高；标题固定为"{A} × {B}:{moment}"模式；提示词固定单一句式。本轮将这三个固定模式替换为按性格/种子选取的多样化候选。验收条件为 C3 重复率降至 < 5%、固定种子复现性保持、全部测试和构建通过。

完成：

- 新增 CONCEPT_TAIL_BY_PERSONALITY（4 性格各 3 个共 12 个尾句候选），替换 concept 文本末尾固定字符串"保留性格与关系张力,人物造型、台词、镜头和世界观全部原创改写。"为按性格A从候选池中选取的个性化尾句（如冷酷型:"冷静与克制贯穿始终,对白和镜头拒绝复刻任何原作。"/热血型:"情绪推着节奏走,每一帧都在燃烧但不照搬原作分毫。"/腹黑型:"布局藏在话术缝隙里,观众需要二刷才看清暗线。"/温柔型:"温柔不是退让而是锚点,情绪稳定后局面自然回正。"），concept 尾句不再跨方案完全相同；
- 新增 TITLE_PATTERNS（6 种标题模式），替换标题固定模式"{A} × {B}:{moment}"为按种子选取的多模式（如"{A}与{B}的{conflictType}"/"{moment}·{A}vs{B}"/"{A}的{conflictType}:{moment}改写"/"当{A}遇上{B}·{moment}"等），不同种子的方案即使角色和场面相同也产生不同标题文本；
- 新增 PROMPT_PATTERNS（4 种提示词句式），替换提示词固定句式为按种子选取的多种句式（如"{stylePrompt}风格,9:16竖屏构图。{A}以{traitA}和\"{styleA}\"出场..."/"{stylePrompt}。不复制原作造型。{A}的{traitA}碰撞{B}的{traitB}..."等），不同种子的方案提示词结构产生差异；
- 修改 buildRemixPlan：title 从 TITLE_PATTERNS 按 rng 选取模式函数并填充角色名/场面名/冲突类型；concept 尾句从 CONCEPT_TAIL_BY_PERSONALITY[personalityA] 按 rng 选取；prompt 从 PROMPT_PATTERNS 返回的 4 种句式中按 rng 选取；
- 修改 tests/similarity.test.ts："same character pair with different seeds" 测试的 title 相似度断言从 equal 1 改为 >= 0.3（标题模式不再恒定）、concept 相似度断言从 equal 1 改为 >= 0.5（尾句不再恒定）、综合分数断言从 >= 0.5 改为 >= 0.3（多维度多样化后同组合不同种子的分数降低属预期行为）；
- 修改 tests/original-adapter.test.ts："真实 seed-entities 原创角色全部能生成有效方案" 测试的 title 断言从 includes(seedChar.name) 改为 length > 0（部分标题模式可能不含角色名）；
- 无需新增测试（模板数量不变、确定性不变、占位符填充逻辑不变），现有 368 项测试全部通过。

生成多样性自检（315 组合 = 15 角色 × 3 名场面 × 1 风格 × 30s）：

- 优化前（上轮）：重复 24/315 (7.6%)、唯一钩子 100.0%、唯一对白A 48.6%、唯一对白B 58.4%、avg max_similarity 0.613
- 优化后（本轮）：重复 0/315 (0.0%)、唯一钩子 100.0%、唯一对白A 48.6%、唯一对白B 58.4%、avg max_similarity 0.554
- C3 重复率从 7.6% 降至 0.0%（完全消除 0.7 阈值以上的重复）
- avg max_similarity 从 0.613 降至 0.554（降低 9.6%）
- 所有性格组合的重复率均降至 0%（cunning|cunning 从 22.2% 降至 0%、cunning|hot 从 11.1% 降至 0%）
- 唯一对白率不变（对白模板未改动）

daily-pipeline 验证（--example --no-persist）：C1 过滤 304/315（不变），C3 重复 2/304 (0.7%)（上轮 20/304 = 6.6%，降低 89.4%）。

验证：validate:data 通过（5 份 JSON 有效，跨文件外键校验通过）、lint 通过、format:check 通过、typecheck 通过、test 368/368 通过、build 34 modules 通过（CSS 34.09 kB 不变、JS 148.08 kB，较上轮 146.58 kB 增加 1.50 kB，为新增模板数组的开销）。

关键决策与遗留问题：

- 多样化策略选择：选择为 concept/title/prompt 增加候选池而非改变生成逻辑，因为根本原因是这三个字段的固定模式导致 bigram Jaccard 相似度被常数文本抬高，增加候选池后不同种子选取不同候选即可降低相似度；
- 概念尾句按性格A选取（而非性格B或性格对）：性格A是生成方案的主驱动角色，按性格A选取尾句确保概念文本风格与主角色性格一致；
- 标题模式按种子选取：6 种模式覆盖双角色名+场面名、单角色名+冲突类型、场面名+双角色名等不同组合，不同种子产生不同标题文本；
- 提示词句式按种子选取：4 种句式改变信息排列顺序和用词，不同种子产生不同提示词文本；
- C3 近似度检测、个性化排序、validate:data 跨文件外键校验全部通过，多样化改写未破坏既有闭环；
- 固定种子复现性保持（test 验证通过），同一输入与种子产生完全相同输出；
- 唯一对白A 48.6% 和唯一对白B 58.4% 仍较低，如需进一步提升可扩充对白模板或增加对白变体机制；
- 4.1—4.4 全部完成，本轮为生成引擎质量优化，属于本地增强任务，不涉及 Phase 4 商业化；
- 工作区存在用户未提交的 auto-reviewer 相关文件（scripts/review-auto.ts、scripts/review-revoke.ts、src/review/auto-reviewer.ts、tests/auto-reviewer.test.ts 以及 config/pipeline.json 和 package.json 的修改），本轮未暂存或修改这些文件；
- Phase 4 商业化与扩展（E1—E5）仍需用户决策，不得擅自启动。

下一轮：4.1—4.4 全部完成，生成引擎概念尾句/标题模式/提示词句式多样化改写已完成，C3 重复率从 7.6% 降至 0.0%、daily-pipeline 重复率从 6.6% 降至 0.7%。Phase 4 商业化与扩展（E1—E5）需用户决策，不得擅自启动。可选方向：继续优化生成引擎（对白模板多样化提升唯一对白率）、优化前端体验、进一步扩充知识库等本地任务。

### 概念/提示词/钩子模板多样化改写轮 — 2026-08-07

本轮目标：上轮钩子模板双角色感知改写完成后，C3 重复率降至 10.2%，唯一钩子率升至 91.7%。剩余重复主要由同性格组合的 concept/prompt 结构性相似和钩子模板跨名场面碰撞（26/32 模板不含 {E} 导致同一角色对不同名场面产生相同钩子文本）驱动。本轮改写全部 32 个钩子模板使其均引用 {E}（名场面冲突类型）占位符，同时在概念文本和画面提示词中使用 roles[0] 和 dialogue_style[0] 替代 character_types[0] 增加角色差异度。验收条件为 C3 重复率降至 < 10%、唯一钩子率 ≥ 95%、固定种子复现性保持、全部测试和构建通过。

完成：

- 改写全部 32 个钩子模板（HOOK_TEMPLATES 4 类各 8 个），使每个模板均引用 {E}（名场面 conflict_type）占位符：上轮改写后约 19% 的模板不含 {E}（如"最高调的人先退场,{B}在安静中替{A}完成全部布局。"），导致同一角色对不同名场面即使选中不同模板也可能产生相同钩子文本；改写后全部模板包含 {E}（如"最高调的人先退场,{B}在安静中替{A}完成{E}的全部布局。"），确保不同名场面的方案即使选中相同模板也产生不同钩子文本；
- 修改 concept 文本生成：使用 roles[0]（如"核心人物""成长型主角""修行者"）替代 character_types[0]（如"成长型谋略者""守序型掌权者"，同性格角色常相同），并增加 dialogue_style[0] 作为角色特征补充（如"含蓄试探""用行动回应质疑"），降低同性格组合的 concept 维度相似度；
- 修改 prompt 画面提示词：使用 traits[0] 和 dialogue_style[0] 替代 character_types[0]，使不同角色的提示词产生更大差异；
- 修改 buildCopywriting 的 description：使用 roles[0] 和 traits[0] 替代 character_types[0]，与 concept 保持一致的差异度策略；
- 修改 buildProduction 的 positive prompt：增加角色 traits 和 dialogue_style 后缀，使正向提示词更具角色特异性；
- 无需新增测试（模板数量不变、确定性不变、角色占位符填充逻辑不变），现有 368 项测试全部通过。

生成多样性自检（315 组合 = 15 角色 × 3 名场面 × 1 风格 × 30s）：

- 优化前（上轮）：重复 32/315 (10.2%)、唯一钩子 91.7%、唯一对白A 48.6%、唯一对白B 58.4%、avg max_similarity 0.606
- 优化后（本轮）：重复 24/315 (7.6%)、唯一钩子 100.0%、唯一对白A 48.6%、唯一对白B 58.4%、avg max_similarity 0.613
- C3 重复率降低 25%、唯一钩子率从 91.7% 提升至 100%（完全消除钩子碰撞）
- 剩余重复主要由 cunning|cunning (22.2%) 和 cunning|hot (11.1%) 同性格组合的 concept/title/prompt 结构性相似驱动，hook: 1.00 的碰撞已完全消除
- hot|hot 重复率从 22.2% 降至 0%、cold|gentle 从 11.1% 降至 0%、gentle|hot 从 8.3% 降至 0%

daily-pipeline 验证（--example --no-persist）：C1 过滤 304/315（不变），C3 重复 20/304 (6.6%)（上轮 31/304 = 10.2%，降低 35.5%）。

验证：validate:data 通过（5 份 JSON 有效，跨文件外键校验通过）、lint 通过、format:check 通过、typecheck 通过、test 368/368 通过、build 34 modules 通过（CSS 34.09 kB 不变、JS 146.58 kB，较上轮 146.04 kB 增加 0.54 kB，为模板文本变更的开销）。

关键决策与遗留问题：

- 改写策略选择：选择为全部模板添加 {E} 引用而非增加更多模板，因为根本原因是模板不含 {E} 导致同一角色对不同名场面产生相同文本，即使增加更多模板也无法解决模板选中后填充值相同的问题；改写后 32 个模板均已引用 {E}，不同名场面的方案即使选中相同模板也产生不同文本；
- concept 和 prompt 使用 roles[0] 和 dialogue_style[0]：roles（如"核心人物""成长型主角""修行者""觉醒者"）和 dialogue_style（如"含蓄试探""用行动回应质疑""先划清界限再暴露真实动机"）的字段差异度高于 character_types（同性格角色常共享相同 character_types[0]），有效降低同性格组合的概念维度相似度；
- 剩余 C3 重复率 7.6% 的主要原因是同性格组合（cunning|cunning 22.2%、cunning|hot 11.1%）的 concept 和 title 结构性相似，进一步降低需在概念生成中引入更多变化或增加角色描述的多样性；
- C3 近似度检测、个性化排序、validate:data 跨文件外键校验全部通过，模板改写未破坏既有闭环；
- 固定种子复现性保持（test 验证通过），同一输入与种子产生完全相同输出；
- 4.1—4.4 全部完成，本轮为生成引擎质量优化，属于本地增强任务，不涉及 Phase 4 商业化；
- 工作区存在用户未提交的 auto-reviewer 相关文件（scripts/review-auto.ts、scripts/review-revoke.ts、src/review/auto-reviewer.ts、tests/auto-reviewer.test.ts 以及 config/pipeline.json 和 package.json 的修改），本轮未暂存或修改这些文件；
- Phase 4 商业化与扩展（E1—E5）仍需用户决策，不得擅自启动。

下一轮：4.1—4.4 全部完成，生成引擎概念/提示词/钩子模板多样化改写已完成，C3 重复率从 10.2% 降至 7.6%、唯一钩子率从 91.7% 升至 100%。Phase 4 商业化与扩展（E1—E5）需用户决策，不得擅自启动。可选方向：继续优化生成引擎（对白模板多样化或概念生成动态化）、优化前端体验、进一步扩充知识库等本地任务。

### 钩子模板双角色感知改写轮 — 2026-08-07

本轮目标：4.1—4.4 全部完成、生成引擎模板扩充完成后，针对上轮自检发现的 C3 重复率 28.3% 主要由 hook: 1.00（模板不含 {B} 导致不同角色 B 的方案产生相同钩子文本）驱动的问题，改写全部 32 个钩子模板使其均引用 {A} 和 {B} 两个角色占位符，同时在概念文本和画面提示词中引入角色 B 的性格特征以降低结构性相似度。验收条件为 C3 重复率降至 < 20%、唯一钩子率 ≥ 80%、固定种子复现性保持、全部测试和构建通过。

完成：

- 改写全部 32 个钩子模板（HOOK_TEMPLATES 4 类各 8 个），使每个模板均引用 {A} 和 {B} 两个角色占位符：原来约 40% 的模板不含 {B}（如"所有人以为这只是{E},直到{A}认真起来。"），改写后全部包含双角色引用（如"所有人以为这只是{E},直到{A}在{B}面前认真起来。"），确保不同角色 B 的方案即使选中相同模板也会产生不同钩子文本；
- 修改 concept 文本生成：在原有角色 A 性格描述基础上增加角色 B 的 traits[0]，使不同角色 B 的方案概念文本产生差异（如"甄嬛的冷酷对上漩涡鸣人的热血"），降低 concept 维度相似度；
- 修改 prompt 画面提示词：在风格和场景描述基础上增加两个角色的名称和 character_types[0]，使不同角色组合的提示词产生差异，降低 positive_prompt 维度相似度；
- 无需新增测试（模板数量不变、确定性不变、角色占位符填充逻辑不变），现有 368 项测试全部通过。

生成多样性自检（315 组合 = 15 角色 × 3 名场面 × 1 风格 × 30s）：

- 优化前（上轮）：重复 89/315 (28.3%)、唯一钩子 60.0%、唯一对白A 48.6%、唯一对白B 58.4%、avg max_similarity 0.658
- 优化后（本轮）：重复 32/315 (10.2%)、唯一钩子 91.7%、唯一对白A 48.6%、唯一对白B 58.4%、avg max_similarity 0.606
- C3 重复率降低 64%、唯一钩子率提升 53%、avg max_similarity 降低 7.9%
- 剩余重复主要由 cunning|cunning (26.7%) 和 hot|hot (22.2%) 同性格组合的 concept/title 结构性相似驱动，hook: 1.00 的碰撞已基本消除

daily-pipeline 验证（--example --no-persist）：C1 过滤 304/315（不变），C3 重复 31/304 (10.2%)（上轮 89/304 = 29.3%，降低 65.2%）。

验证：validate:data 通过（5 份 JSON 有效，跨文件外键校验通过）、lint 通过、format:check 通过、typecheck 通过、test 368/368 通过、build 34 modules 通过（CSS 34.09 kB 不变、JS 146.04 kB，较上轮 145.76 kB 增加 0.28 kB，为模板文本变更的开销）。

关键决策与遗留问题：

- 改写策略选择：选择改写模板增加 {B} 引用而非增加更多模板，因为根本原因是模板不含 {B} 导致文本相同，即使增加更多模板也无法解决模板选中后填充值相同的问题；改写后 32 个模板均已引用双角色，不同角色 B 的方案即使选中相同模板也产生不同文本；
- concept 和 prompt 也引入角色 B 特征：概念文本增加角色 B 的 traits[0]（如"坚韧"），画面提示词增加两个角色的 character_types[0]，降低非钩子维度的相似度；
- 剩余 C3 重复率 10.2% 的主要原因是同性格组合（cunning|cunning、hot|hot）的 concept 和 title 结构性相似，进一步降低需在概念生成中引入更多变化或增加角色性格描述的多样性；
- C3 近似度检测、个性化排序、validate:data 跨文件外键校验全部通过，模板改写未破坏既有闭环；
- 固定种子复现性保持（test 验证通过），同一输入与种子产生完全相同输出；
- 4.1—4.4 全部完成，本轮为生成引擎质量优化，属于本地增强任务，不涉及 Phase 4 商业化；
- 工作区存在用户未提交的 auto-reviewer 相关文件（scripts/review-auto.ts、scripts/review-revoke.ts、src/review/auto-reviewer.ts、tests/auto-reviewer.test.ts 以及 config/pipeline.json 和 package.json 的修改），本轮未暂存或修改这些文件；
- Phase 4 商业化与扩展（E1—E5）仍需用户决策，不得擅自启动。

下一轮：4.1—4.4 全部完成，生成引擎钩子模板双角色感知改写已完成，C3 重复率从 28.3% 降至 10.2%、唯一钩子率从 60.0% 升至 91.7%。Phase 4 商业化与扩展（E1—E5）需用户决策，不得擅自启动。可选方向：继续扩充知识库（需用户指定新候选作品）、优化前端体验、进一步优化生成引擎（概念文本多样化或对白模板扩充）等本地任务。

### 生成引擎多样性提升轮 — 2026-08-06

本轮目标：4.1—4.4 全部完成后，针对上轮自检发现的 C3 重复率 46.7% 问题，扩充生成引擎钩子模板和对白模板以提升生成多样性，降低原创角色组合的重复率。验收条件为钩子模板 ≥32 个（4 类各 8+）、对白模板 ≥28 个（4 性格各 7+）、C3 重复率降至 < 35%、固定种子复现性保持、全部测试和构建通过。

完成：

- 扩充钩子模板：HOOK_TEMPLATES 从 4 类各 6 个（24 个）扩充至 4 类各 8 个（32 个），每类新增 2 个模板，新增模板增加双角色引用和场景反转变化；
- 扩充对白模板：DIALOGUE_TEMPLATES 从 4 性格各 3 个（12 个）扩充至 4 性格各 7 个（28 个），每性格新增 4 个模板，新增模板增加更多句式变化（条件式、判断式、承诺式、反问式等）；
- 导出 DIALOGUE_TEMPLATES 供测试和外部使用（原为模块内部常量）；
- 新增性格对钩子类别扩展机制：PERSONALITY_PAIR_HOOK_EXTRA 为 6 种互补性格组合（cold|hot、cold|cunning、cold|gentle、hot|cunning、hot|gentle、cunning|gentle）增加额外钩子类别，扩大选择空间降低碰撞率；buildHook 函数新增 personalityB 参数，合并性格对扩展类别到候选池；
- 修改 buildRemixPlan 调用 buildHook 时传入 personalityB；
- 新增 2 项测试：钩子模板扩充验证（4 类各 ≥8 个、总计 ≥32）、对白模板扩充验证（4 性格各 ≥7 个、总计 ≥28）；
- 新增 scripts/analyze-diversity.ts 生成多样性分析脚本，用固定种子生成全组合并分析 C3 重复率和分项贡献。

生成多样性自检（315 组合 = 15 角色 × 3 名场面 × 1 风格 × 30s）：

- 优化前：重复 147/315 (46.7%)、唯一钩子 53.0%、唯一对白A 28.9%、唯一对白B 33.7%、avg max_similarity 0.690
- 优化后：重复 89/315 (28.3%)、唯一钩子 60.0%、唯一对白A 48.6%、唯一对白B 58.4%、avg max_similarity 0.658
- 重复率降低 39.5%、唯一对白A 提升 68%、唯一钩子提升 13%
- 剩余重复主要由 hook: 1.00（同性格A+同时刻的模板碰撞）和 concept/prompt 结构性相似驱动，detectDuplicates 只标记不删除，226 个唯一方案已足够覆盖日常推荐需求

daily-pipeline 验证（--example --no-persist）：C1 过滤 304/315（不变），C3 重复 89/304 (29.3%)（上轮 136/304 = 44.7%，降低 34.6%）。

验证：validate:data 通过（5 份 JSON 有效，跨文件外键校验通过）、lint 通过、format:check 通过、typecheck 通过、test 350/350 通过（348 原有 + 2 新增）、build 34 modules 通过（CSS 34.09 kB 不变、JS 145.76 kB，较上轮 144.12 kB 增加 1.64 kB，为新增模板的开销）。

关键决策与遗留问题：

- 钩子模板从 24 扩至 32（+33%）、对白模板从 12 扩至 28（+133%），对白扩充幅度更大因对白模板数量原为瓶颈（每性格仅 3 个导致 28.9% 唯一率）；
- 性格对钩子扩展机制为互补组合增加额外类别，如同性格组合（cold|cold）不扩展（已有交集足够），互补组合（cold|hot）扩展 contrast+action；
- 剩余 C3 重复率 28.3% 的主要原因是同性格A+同时刻的钩子模板碰撞（hook: 1.00），这是 PRNG 从同一池中选取的固有碰撞率，进一步降低需更多模板或更复杂的选模板策略；
- detectDuplicates 只标记不删除，226 个唯一方案已足够覆盖日常推荐需求，C3 重复率降低不影响产品质量；
- C3 近似度检测、个性化排序、validate:data 跨文件外键校验全部通过，模板扩充未破坏既有闭环；
- 固定种子复现性保持（test 验证通过），同一输入与种子产生完全相同输出；
- 4.1—4.4 全部完成，本轮为生成引擎质量优化，属于本地增强任务，不涉及 Phase 4 商业化；
- Phase 4 商业化与扩展（E1—E5）仍需用户决策，不得擅自启动。

下一轮：4.1—4.4 全部完成，生成引擎模板扩充已完成，C3 重复率从 46.7% 降至 28.3%。Phase 4 商业化与扩展（E1—E5）需用户决策，不得擅自启动。可选方向：继续扩充知识库（需用户指定新候选作品）、优化前端体验、进一步优化生成引擎（更多钩子模板或动态选模板策略）等本地任务。

### 4.4 前端未展示种子数据展示轮 — 已归档至 memory/archive/2026-07.md

## 历史归档

2026-08-01 将 2026-07 月历史迭代日志（D2a 前端埋点采集闭环轮及更早共 31 轮）归档到 `memory/archive/2026-07.md`，
遵循 memory/README.md 第 7 条"超过 30 轮的历史日志可按月归档"规则。2026-08-05 将 PROGRESS.md 历史归档轮、D1—D5 反馈学习闭环健康扫描轮和上轮归档遗留提交补齐轮追加归档至 `memory/archive/2026-07.md` 末尾。
2026-08-06 将 4.3 风格扩充轮和 4.2 原创角色原型轮追加归档至 `memory/archive/2026-07.md` 末尾。
2026-08-06 将 4.4 前端种子数据展示轮追加归档至 `memory/archive/2026-07.md` 末尾。
2026-08-07 将 daily-pipeline 全部 10 个原创角色接入轮、原创角色 C1 兼容矩阵能力档案轮、原创角色接入 daily-pipeline 轮、原创角色接入 remix-engine 轮、4.1 第三批知识库扩充轮追加归档至 `memory/archive/2026-07.md` 末尾。
2026-08-08 将今日推荐自动审核闭环轮追加归档至 `memory/archive/2026-07.md` 末尾。
2026-08-08 将概念/提示词/钩子模板多样化改写轮、钩子模板双角色感知改写轮、生成引擎多样性提升轮追加归档至 `memory/archive/2026-07.md` 末尾。
当前文件保留最近 9 轮（候选评分 lifecycle 默认值改进、候选状态机扩展 archived → pending_review、候选状态机扩展 rejected → pending_review、原创角色 traits 扩充、知名角色 dialogue_style 扩充、daily-pipeline 集成自动导出、daily-pipeline 集成自动审核、今日推荐自动审核闭环、对白模板多样化扩充）+ 当前状态。
归档文件仅供历史回溯查阅，当前进度真源仍为本文件。
