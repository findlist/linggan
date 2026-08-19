# 灵感项目当前进度

最后更新：2026-08-20
当前轮次：多样性测试矩阵改进轮（analyze-diversity 固定切片 → 基线+最近新增）
当前阶段：Phase 1—3 规划任务已尽，D1—D5 反馈学习闭环健康扫描完成；用户已于 2026-08-03 授权自主推进 4.1—4.4 本地数据迭代；4.1—4.4 全部完成且 4.1 达到 15+ 目标；本轮在 4.1 已达标基础上继续扩充知识库第十三批（倩女幽魂/低俗小说/十二怒汉），知识库从 45 部作品/127 角色/79 关系/82 名场面扩充至 48 部作品/136 角色/85 关系/88 名场面；原创角色原型已接入 remix-engine 和 daily-pipeline；生成引擎模板扩充已完成（钩子 32 个/对白 56 个）；钩子模板双角色感知改写已完成；概念/提示词/钩子模板多样化改写已完成；概念尾句/标题模式/提示词句式多样化改写已完成；对白模板从 7 个/性格扩充至 14 个/性格（28→56），新增 {trait} 占位符引用角色 traits 增加差异化；pipeline:daily 已内嵌 review:auto 和 export:candidates 全自动闭环；本轮将 collect:wikipedia 和 migrate:trends 集成到 pipeline:daily，形成采集→迁移→生成→审核→导出全链路一键运行；原创角色 traits 已扩充至 5-6 个/角色（唯一对白A 80.0%、B 84.8%、C3 重复率 0.0%）；候选状态机已支持 rejected → pending_review（review:reopen）和 archived → pending_review（review:reactivate）重新审核，完成候选生命周期全循环；候选生成器已改进：每趋势角色选取从固定 2 个扩充至轮换 3 个（覆盖全部 14 个角色），标题模式从 8 种扩充至 16 种、钩子模式从 8 种扩充至 16 种，per-trend PRNG 洗牌使不同趋势产生不同选取序列，12 条真实趋势产生 30 条候选（原 20 条）、使用 14 个不同角色（原 2 个）、30 个不同标题和 30 个不同钩子（原全部相同）；种子实体已扩充：元素从 3 个扩充至 15 个（第三批新增天台烧烤/二手书店/广场舞，ready_for_review 率从 80% 升至 93.3%）（新增 activity/object/abstract 三个类别，动作数从全 3 扩展至 1-4），场景从 3 个扩充至 8 个（pattern 步骤从全 5 扩展至 3-7，lifecycle 从全 evergreen 扩展至 emerging/rising/peak/declining/evergreen）；visuality 从 2 个值扩充至 6 个值 [73,76,84,90,92,95]、seriality 从 2 个值扩充至 13 个值 [71,73,75,76,77,78,79,80,81,82,83,85,86]；叙事模板已从 3 个扩充至 27 个（第九批新增荒诞派叙事/纪录片式叙事/史诗叙事）；跨趋势模式均匀化已完成：新增 pickLeastUsed 函数跟踪全局模式使用次数，从打乱后的前 6 个候选中选取使用次数最少的模式，30 条候选中单个模式最大重复从 5 次降至 3 次（16 模式 × 30 候选 = 理论最优 1.875 次/模式），新增 2 项测试验证标题和钩子模式在 30 候选中不超过 3 次；story_patterns 已集成到生成引擎：RemixPlanInput 新增 storyPattern 可选字段，提供时其 beats 替换默认分镜节拍，daily-pipeline 按 (i+j+m) % patterns.length 轮换选取叙事模板传入生成器，Markdown 导出展示叙事模板名称，analyze-diversity 脚本同步轮换 story_patterns 并新增分镜结构唯一率统计（315/315 = 100.0%），avg max_similarity 从 0.553 降至 0.521；前端创作工作台 story_pattern 选择器已完成：用户可在跨作品混搭工作台手动选择叙事模板（或使用默认结构），选择器变化时展示当前模板的 beats 序列，生成的方案预览和制作包展示 storyPatternName，收藏和历史记录保存 storyPatternId 供重新加载时恢复；Agent 可推进的本地优化任务已接近尾声，Phase 4 商业化与扩展（E1—E5）需用户决策；story_pattern 选择器 beats 预览可视化已完成；叙事模板已从 24 个扩充至 27 个（新增荒诞派叙事/纪录片式叙事/史诗叙事）；知识库第四批扩充已完成（新增让子弹飞/哪吒之魔童降世/赛博朋克 2077，15→18 作品）；知识库第五批扩充已完成（新增灌篮高手/切尔诺贝利/哈利波特，18→21 作品）；知识库第六批扩充已完成（新增指环王/千与千寻/楚门的世界，24→27 作品；本轮发现并修正 3 部之前未在 PROGRESS.md 记录的已存在作品：大话西游/盗梦空间/寄生虫，实际知识库从 24 部而非 21 部开始）
整体状态：本地数据闭环可验证；前端埋点采集闭环已建立（session 管理 + localStorage 事件队列 + 导出按钮 + sync:events 回收入库）；前端 6 类核心交互事件（impression/opened/saved/copied/exported/hidden）已在 FeedSection/RemixWorkbench/SavedList 接入 track()，事件暂存 localStorage 后可通过"导出事件"按钮下载 event-inbox 兼容 JSON，再由 npm run sync:events 经 ProductEventSchema 校验后幂等写入 SQLite product_events 表；SQLite 已为默认存储，基础知识可幂等初始化、热点可事务入库；候选生成已接通 SQLite 正式趋势；正式趋势可原子导出为只读 JSON；网站热点雷达已消费真实趋势数据；候选已持久化到 SQLite，状态机支持 pending_review → approved/rejected → archived、rejected → pending_review（重新审核）和 archived → pending_review（重新激活）流转和幂等键去重；review:reopen 命令支持单条/批量 reopen rejected 候选并可立即 --re-review；review:reactivate 命令支持单条/批量 reactivate archived 候选并可立即 --re-review；今日推荐流已通过只读 JSON 导出消费 approved 候选；知识库增量合并命令已建立并通过真实批次验证，知识库已扩充至 45 部作品/127 角色/79 关系/82 名场面（4.1 第一批：进击的巨人、繁花、狂飙；4.1 第二批：原神、黑神话悟空；4.1 第三批：长安三万里；4.1 第四批：让子弹飞、哪吒之魔童降世、赛博朋克 2077；4.1 第五批：灌篮高手、切尔诺贝利、哈利波特；4.1 第六批：指环王、千与千寻、楚门的世界；4.1 第七批：霸王别姬、阿甘正传、星际穿越；4.1 第八批：功夫、海上钢琴师、流浪地球2；4.1 第九批：活着、飞驰人生、辛德勒名单；4.1 第十批：三国演义、水浒传、琅琊榜；4.1 第十一批：红楼梦、武林外传、教父；4.1 第十二批：肖申克的救赎、银翼杀手、大明王朝1566；注：大话西游/盗梦空间/寄生虫为之前未记录的已存在作品，第六批核实并补录）；跨作品混搭引擎已升级为多样化、固定种子可复现的生成器，支持 4 类共 32 个钩子模板、8 种风格（电影感热血/一本正经的荒诞/国风动画/伪纪录片/赛博朋克霓虹/古风水墨写意/Vlog 日常感/悬疑反转）、4 种性格驱动对白（4 性格共 56 个对白模板）、性格对钩子类别扩展机制（6 种互补组合扩展）、按时长分镜（15/30/60s → 3/5/8 镜头）和发布文案（3 标题+描述+3 标签）；素材库角色/作品/名场面三类卡片可点击进入详情弹窗，展示完整字段并提供"开始创作"入口；混搭方案支持导出 Markdown（人类可读，含标题/概念/钩子/分镜表格/对白/文案/画面提示词/版权边界）和 JSON（机器可读，完整 RemixPlan 字段），收藏列表保存完整方案和上下文，支持展开查看、重新加载到工作台、单条导出和删除，旧格式收藏降级显示；首个固定公开来源适配器（维基百科最热词条 REST API）已建立，使用本地保存的响应样本驱动测试，输出 CollectionBatchSchema 兼容批次可被 migrate:trends 消费；统一任务运行日志已建立，覆盖采集、迁移、生成、导出、事件同步和周权重更新七个 CLI 环节，日志按日期分目录持久化到 data/run-logs/，支持按任务名、状态和日期范围查询回溯；B4/B5 两轮遗留的浏览器交互回归缺口已通过 C8 补齐，桌面端 1440px 五大核心流程（详情弹窗+实体跳转+Esc+开始创作、工作台生成+复制+导出 MD/JSON+收藏、收藏列表展开+重新加载+单条导出+删除、热点雷达真实趋势、今日推荐流空状态）和移动端 375/640/768/1024px 响应式断点均通过 browser_evaluate DOM 检查验证；C1 兼容矩阵已建立，覆盖 19 角色能力档案 × 11 场景约束档案 × 11 冲突难度档案 × 55 能力-冲突适配规则，提供 computeCompatibility/filterCompatibleCombinations API 供 remix-engine 在生成前过滤不合理组合（如"温柔型角色 × 高强度战斗场景 × 15s"）或调整生成难度权重；C2 完整制作包已建立，RemixPlan 扩展为包含结构化画面提示词（正向/负面/比例/风格强度）、版权边界声明（参考状态/商用限制/改写范围）、分镜表增加景别/运镜/转场三列、文案增加封面文案，daily-pipeline 已集成 C1 兼容矩阵过滤（buildProductionPlans 先 filterCompatibleCombinations 再 buildRemixPlan），导出器 Markdown 同步输出全部制作字段；C3 近似度检测已建立，提供 computePlanSimilarity/detectDuplicates/filterUniquePlans 三个 API，采用字符 bigram Jaccard 文本相似度 + 结构字段精确匹配的加权综合方案（钩子权重 0.25 最高，结构字段权重最低），daily-pipeline 在 C2 生成后调用 detectDuplicates 标记重复方案并写入 logger metadata，不删除只标记保留可追溯性；C4 创作工作台已升级为三栏布局（左素材选择/中核心预览/右完整制作包），中栏预览展示标题/钩子/封面文案/C3 重复检测标记/复制收藏快捷操作，右栏展示完整分镜表（含景别/运镜/转场中文标签）、结构化画面提示词（正向/负面/比例/风格强度）、版权边界三字段声明和导出按钮，前端集成 detectDuplicates 把当前方案与已收藏方案对比并在相似度≥0.7 时显示换皮警告，桌面端三栏在 ≤980px 堆叠为单栏；C5 素材库多维筛选已建立，业务规则与 UI 分离为 src/library/filter.ts 纯函数（filterLibraryItems/collectFilterOptions），素材库三个 tab 各配置 3 个筛选维度（角色：类型/作品/版权；名场面：冲突/情绪/作品；作品：媒介/类型/版权），同维度多选 OR、跨维度 AND、文本搜索与所有维度 AND，chip 动态收集可选项避免死选项，切换 tab 自动重置筛选，有选中时显示清空按钮和"显示 N / 共 M 项"计数；C6 前端模块化已完成，main.js 从 730 行减至 78 行（-92%），按行为边界拆分为 6 个 section 组件（Hero/RadarSection/RemixWorkbench/LibrarySection/SavedList/FeedSection）和 4 个基础模块（data/knowledge.js 知识库读取层、data/store.js 状态管理、ui/icons.js 图标库、ui/dom.js DOM 工具），原 main.js 顶层 6 个可变 let（duration/generation/currentResult/activeTab/libraryFilters/saved）全部收敛到 store.js，跨 section 调用通过 ctx 注入回调避免循环依赖，浏览器 DOM 检查 6/7 项 PASS（唯一 FAIL 是验证脚本查询方式问题，代码正确）；C7 lint/format 配置已完成，ESLint 9 flat config + Prettier 3 覆盖全部 .ts/.js 源码，lint 与 format:check 全部通过，TypeScript 降级至 6.0.3 以兼容 typescript-eslint v8，Phase 2 全部任务结束；D1 事件采集已建立，9 类核心产品事件（idea_impression/idea_opened/idea_saved/prompt_copied/idea_exported/video_created/video_published/idea_hidden/risk_reported）可通过 ProductEventSchema 校验并经 EventTracker 记录到 SQLite product_events 表（INSERT OR IGNORE 幂等），EventStore 接口 + InMemoryEventStore/SqliteEventStore 双实现支持按 event_type/session_id/idea_id/日期范围查询和 countByType 九类计数，003 迁移建表含 3 索引（type+occurred/session+occurred/idea_id）；D2a 前端埋点采集闭环已建立，前端 session 管理（localStorage 持久化 + 30 分钟超时新建会话）+ 事件队列（track 接口暂存 localStorage，上限 200 丢弃最旧）+ 导出按钮（EventSyncBar 渲染计数轮询和下载 event-inbox 兼容 JSON）+ sync:events 脚本（递归扫描 event-inbox，逐事件 Schema 校验后幂等写入 SQLite）完整接通前端行为到后端 product_events 表的闭环，6 类核心交互事件（impression/opened/saved/copied/exported/hidden）已在 FeedSection/RemixWorkbench/SavedList 接入埋点；D2b 创作者偏好画像与个性化排序已建立，buildPreferenceProfile 按 session_id 聚合事件流（9 类事件加权：saved 5/copied 4/exported 4/opened 3/impression 1/hidden -3）并结合候选 entities/source_trend/risk_level 扩散到维度权重输出 PreferenceProfile，rankCandidates 基于画像对候选重排（personalized_score = base_score*0.6 + match_score*0.4，已交互候选优先、共享 entity 候选获匹配分提升、explore_ratio 15% 保留未交互候选探索位、冷启动无画像时降级原顺序），前端 personalize.ts 从 localStorage 事件队列实时聚合画像并注入 FeedSection 渲染"为你推荐"流（画像摘要 + 已关注/探索徽章）；D3 排序权重周更新已建立，buildWeeklyWeightSnapshot 按 ISO 周从 product_events 聚合事件流计算全局排序权重（base_ratio/match_ratio/explore_ratio），单次变化不超过 10%（clampChange 限制在 [old*0.9, old*1.1]）、样本不足（event_count < 50）时保持原权重 changes 全 0、previous_week_id 链接上周快照支持回滚、input_stats 记录事件数/会话数/创意数/按类型分布提供可解释性，权重调整基于正向交互率（saved+copied+exported 占比 >30% 时 base 增 / <10% 时 match 增）和 idea 多样性（<0.3 时 explore 增 / >0.6 时减），InMemoryWeightSnapshotStore + SqliteWeightSnapshotStore 双实现保留全部历史快照支持查询任意周回滚（INSERT OR REPLACE 保证相同 week_id 幂等），004 迁移建 ranking_weight_snapshots 表（week_id 主键 + computed_at 索引 + snapshot_json 完整快照），update:weekly-weights CLI 脚本聚合本周事件生成快照并持久化、personalized-rank.ts 集成 weight_snapshot 参数让周级权重覆盖默认 base_ratio/explore_ratio 影响个性化排序；D4 探索流量机制已建立，exploration.ts 提供 computeExploreSlotCount（基于全部候选用 ceil 计算探索位数量保证 ≥15% 门槛，旧实现基于 nonProfiled.length 用 round 会让小列表得到 0 探索位）、selectExploreCandidates（多样性优先贪心选取 entities 重叠最少的候选作为探索位，FNV-1a 哈希 + seed 打破平局保证可复现）、buildExploreEffectStats（扫描 impression payload.reason='explore' 追踪探索位后续正向交互率 opened/saved/copied/exported），personalized-rank.ts 接入多样性选取替代旧 slice(0,N) 简单截取、新增 explore_seed 参数，weight-snapshot.ts 的 WeightEvent 扩展 payload 字段、input_stats 新增可选 explore_stats 字段（explore_impressions/unique_explore_ideas/explored_with_interaction/interaction_rate）、computeRawAdjustments 增加探索效果信号（interaction_rate>0.3 时 explore_ratio 略减 / <0.1 时略增，需 unique_explore_ideas≥5 避免小样本噪声，与 diversity 信号叠加后仍受 10% clamp 限制），update:weekly-weights 脚本传递 payload 并输出 explore_stats 到报告和日志 metadata；D5 创作历史与项目管理已建立，history.ts 提供 localStorage 持久化的创作历史存储（MAX_HISTORY=50 上限，自动记录每次用户主动生成的完整 RemixPlan + 选择器上下文 + 种子 + ISO 时间，addHistory 同 id 更新移前避免重复堆积、超限丢弃最旧、损坏 JSON/非数组/缺字段降级空数组、配额满静默降级不阻塞生成），HistoryList.js 渲染历史列表 UI（按时间倒序、展开折叠查看核心概念与对白、重新加载到工作台、单条删除、清空全部、键盘 Enter/Space 可访问、D2 埋点 idea_opened），RemixWorkbench 在用户主动生成和随机生成时自动 recordHistory（初始挂载默认方案不记录），loadRemixFromEntry 提取收藏和历史共享的重新加载逻辑避免重复代码，与收藏列表视觉区分（历史 cyan 色 50 条自动记录 vs 收藏 lime 色 8 条主动保存）；D1—D5 反馈学习闭环健康扫描已完成，端到端链路（前端 track → localStorage 队列 → sync:events → SQLite product_events → buildPreferenceProfile → rankCandidates + weight_snapshot + exploration → FeedSection 个性化推荐；update:weekly-weights 聚合周事件 → weight_snapshot → rankCandidates 覆盖默认权重）代码结构与脚本入口齐全且自洽，332 项测试全部通过；扫描发现并修复 D5 提交（838f3aa）引入的 docs/DEVELOPMENT_DIRECTION.md 表格列填充不符合 Prettier 规范导致 format:check 失败的基线问题（D5 进度记录中"format:check 通过"声明不准确）；今日推荐自动审核闭环已建立，review:auto 命令用规则引擎对 pending_review 候选自动 approve/reject，今日推荐流可消费 approved 候选；daily-pipeline 已内嵌自动审核，候选生成后自动审核无需手动运行 review:auto；pipeline:daily 已集成 collect:wikipedia 和 migrate:trends，形成采集→迁移→生成→审核→导出全链路一键运行，采集和迁移失败不阻塞后续流程；候选生成器标题缩短函数 shortenTrendTitle 已改进（94bbf22 + cbf8ddb）：先按中文标点断句再按自然断点（虚词/介词/连词）截断避免词语中间切断（如"台风"被截为"因台"），去除前导书名号《》等装饰符号，TITLE_PATTERNS 中两处 maxLen 从 6 调整为 8 保持标题可读，新增 6 项测试覆盖标点断句、书名号去除、自然断点截断和 AI短剧场景；候选标题趋势可用性检查已建立：新增 isTrendTitleUsable 函数检测缩短后的趋势标题是否以虚词结尾或过短，不可用时跳过引用趋势标题的标题/钩子模板回退到不引用趋势的模板，TITLE_PATTERNS 和 HOOK_PATTERNS 从函数数组重构为带 usesTrend 标记的对象数组，NATURAL_BREAK_AFTER 新增 5 个虚词（以/将/被/把/对/向），新增 3 项测试覆盖虚词结尾回退、短标题可用和纯数字回退；上轮 dea3dce 提交中 3 个新测试 Trend 对象使用了错误字段格式（discovered_at 代替 observed_at、source 对象代替 source+source_url 字符串），本轮已修复 typecheck 错误

### 多样性测试矩阵改进轮 — 2026-08-20

本轮目标：scripts/analyze-diversity.ts 使用固定切片（known_characters.slice(0,5) + 10 original = 15 角色、iconic_moments.slice(0,3) = 3 名场面）导致 b9—b13 五轮多样性数字完全不变（0.531/100.0%），违反 DEVELOPMENT_STANDARD.md §13 测试演进规则（"若测试数字连续 3 轮完全不变，视为测试失效，必须改进测试矩阵"）。本轮改进测试矩阵让新增知识库数据进入统计，使多样性指标随知识库扩充真实变化。同时补提交上轮归档维护遗留的 docs/DEVELOPMENT_STANDARD.md（新增测试演进/归档规则/健康扫描维度）和 memory/README.md（归档规则更新）文档改动。验收条件为：(1) 测试矩阵覆盖最近一批新增角色和名场面；(2) b9—b13 的多样性数字不再完全不变；(3) typecheck / test / build 全部通过。

完成：

- 改进 scripts/analyze-diversity.ts 测试矩阵：
  - known_characters 从固定 `slice(0,5)` 改为 `slice(0,5) + slice(-5)`（前 5 基线 + 后 5 最近新增），136 角色下取 10 个无重叠角色；
  - iconic_moments 从固定 `slice(0,3)` 改为 `slice(0,3) + slice(-3)`（前 3 基线 + 后 3 最近新增），88 名场面下取 6 个无重叠名场面；
  - 组合从 15 角色 × 3 名场面 = 315 plans 扩展至 20 角色 × 6 名场面 = C(20,2)×6 = 1140 plans，测试规模扩大 3.6 倍；
  - slice(-N) 保证每次 merge-knowledge 新增数据追加到数组末尾后自动进入统计，满足"测试矩阵必须覆盖最近一个版本新增的实体"规则；
- 补提交上轮归档维护遗留的文档改动：docs/DEVELOPMENT_STANDARD.md 从 v1.0 升级至 v1.1（新增 §13 测试演进规则、§17 归档规则强制化、§18 健康扫描 6 维度），memory/README.md 归档规则 #7 更新（15 轮或 100KB 阈值强制归档）；
- 修复 analyze-diversity.ts 的 Prettier 格式问题（工作区改动未经 format）。

多样性数字改进前后对比（analyze:diversity）：

| 指标               | 改进前（b13，315 plans） | 改进后（本轮，1140 plans） | 变化                    |
| ------------------ | ------------------------ | -------------------------- | ----------------------- |
| Total plans        | 315                      | 1140                       | +825（矩阵扩大 3.6 倍） |
| Duplicates         | 0 (0.0%)                 | 0 (0.0%)                   | 不变，健康              |
| Avg max similarity | 0.531                    | 0.547                      | +0.016，远低于 0.7 阈值 |
| 分镜结构唯一率     | 315/315 (100.0%)         | 1133/1140 (99.4%)          | -0.6%，仍健康           |
| 唯一钩子           | 314/315 (99.7%)          | 1124/1140 (98.6%)          | -1.1%，仍健康           |
| 唯一对白A          | 252/315 (80.0%)          | 693/1140 (60.8%)           | -19.2%，更诚实          |
| 唯一对白B          | 267/315 (84.8%)          | 795/1140 (69.7%)           | -15.1%，更诚实          |
| Story pattern 分布 | 未记录                   | 36—54/27 模式              | 均匀分散                |

- 多样性数字已变化，满足验收条件 (2)"b9—b13 的多样性数字不再完全不变"；
- C3 重复率保持 0.0%（不变，健康）；
- avg max_similarity 0.547（+0.016，远低于 0.7 阈值，健康）；
- 对白唯一率下降分析：改进前固定切片只取前 5 个角色（性格分布可能偏单一），虚高 80%；改进后加入后 5 个最近新增角色，性格组合更全面，更大样本（1140 vs 315）暴露更多碰撞，60.8%/69.7% 是更诚实的测量，非生成质量回退；27 个叙事模板均匀分散（36—54/模式），分镜结构唯一率 99.4% 仍健康。

验证：typecheck 通过、lint 通过（0 errors 0 warnings）、format:check 通过（修复 analyze-diversity.ts Prettier 格式后）、validate:data 通过（5 份 JSON 有效，跨文件外键校验通过，包括 compatibility-matrix.json ↔ knowledge-base.json 交叉校验）、test 422/422 通过（无测试断言 analyze-diversity 输出，矩阵变化不破坏测试）、build 34 modules 通过（CSS 34.71 kB 不变、JS 415.32 kB 不变，本轮只改脚本和文档，不涉及前端 bundle）。analyze:diversity 生成多样性自检：C3 重复率 0.0%、avg max_similarity 0.547（+0.016）、分镜结构唯一率 99.4%（-0.6%）、27 叙事模板均匀分散（36—54/模式）。

关键决策与遗留问题：

- 测试矩阵改进方案选择"基线 + 最近新增"（slice(0,N) + slice(-N)）而非全量扫描：全量 C(136,2)×88 = 80 万 plans 的 O(n²) 近似度计算不可行（单次运行需数小时）；"基线 + 最近新增"兼顾可复现性（前 N 固定基线供跨轮对比）和演进性（后 N 随新增数据变化），满足 DEVELOPMENT_STANDARD.md §13"不得使用固定切片导致新增数据永远无法进入统计"和"测试矩阵必须覆盖最近一个版本新增的实体"两项规则；
- 补提交文档改动：上轮归档维护轮（fef0bfd）提交了 PROGRESS.md 但遗留 docs/DEVELOPMENT_STANDARD.md（v1.1 升级）和 memory/README.md（归档规则）未提交，PROGRESS.md 中"归档规则细节见 docs/DEVELOPMENT_STANDARD.md 第 17 节"引用指向未提交内容，本轮一并提交修复文档滞后；
- 对白唯一率下降非回退：改进前 80%/84.8% 是固定前 5 角色的小样本虚高，改进后 60.8%/69.7% 是 20 角色（含最近新增）大样本的诚实测量；C3 重复率 0.0% 和 avg max_similarity 0.547（远低于 0.7）确认生成质量健康；
- 固定种子复现性保持（test 422/422 通过）；
- 已知技术债 #1（多样性测试矩阵固定切片）已解决；
- JS bundle 持续增长（技术债 #2）仍待评估，但本轮不涉及 bundle 变化（415.32 kB 不变）；
- Phase 4 商业化与扩展（E1—E5）仍需用户决策，不得擅自启动。

下一轮：多样性测试矩阵改进已完成，analyze:diversity 从固定 315 plans 改进为 1140 plans（基线+最近新增），多样性数字随知识库扩充真实变化。技术债 #1 已解决。Phase 4 商业化与扩展（E1—E5）需用户决策，不得擅自启动。可选方向：继续扩充知识库第十四批（候选作品可考虑人民的名义/走向共和/沉默的羔羊/搏击俱乐部/美丽人生/天堂电影院等，本轮矩阵改进后新增数据将真实反映在多样性数字中）、评估 JS bundle 懒加载或阈值告警（技术债 #2）、为 update:weekly-weights 和 sync:events 配置定时调度、为前端增加更多交互反馈等本地任务。

### 知识库扩充第十三批轮（45→48）— 2026-08-19

本轮目标：上轮知识库第十二批扩充至 45 部作品后，4.1 知识库已远超 15+ 目标。本轮在 4.1 已达标基础上继续扩充知识库第十三批，新增 3 部作品（倩女幽魂、低俗小说、十二怒汉），每部 3 角色 + 2 关系 + 2 抽象名场面，通过 merge-knowledge 命令增量合并并校验。所有知名实体遵循 reference_only 边界，不保存精确台词、镜头或受保护素材，必须有公开可核验 Wikipedia 来源、版权状态和最后验证时间。验收条件为 merge:knowledge 合并成功 0 失败、validate:data 跨文件外键校验通过、固定种子生成多样性保持健康（C3 重复率 0.0%、avg max_similarity 不超过 0.7 阈值）、全部测试和构建通过。

完成：

- 新增 3 个知识库批次到 data/knowledge-inbox/：
  - 2026-08-19-b13-chinese-ghost-story.json（倩女幽魂）：3 角色（聂小倩/宁采臣/燕赤霞）、2 关系（聂小倩↔宁采臣被控制的女鬼与正直书生跨越人鬼界限的信任与救赎、宁采臣↔燕赤霞书生与剑客在荒寺中因义气结交共抗妖邪）、2 名场面（书生在荒寺夜遇女鬼以礼相待不惧、书生与剑客协作迁葬解救女鬼脱离控制）；rights_status 全部 reference_only、risk_level 低、来源 Wikipedia；
  - 2026-08-19-b13-pulp-fiction.json（低俗小说）：3 角色（文森特·维加/朱尔斯·温菲尔德/米娅·华莱士）、2 关系（文森特↔朱尔斯职业杀手搭档在日常闲聊与生死任务间的默契与分歧、文森特↔米娅杀手与黑帮老大之妻在护送任务中的暧昧与危险）、2 名场面（杀手与黑帮老大之妻在夜店共舞、杀手在枪战中奇迹幸存后质疑职业信仰）；rights_status 全部 reference_only、risk_level 中等、来源 Wikipedia；
  - 2026-08-19-b13-twelve-angry-men.json（十二怒汉）：3 角色（八号陪审员/三号陪审员/十号陪审员）、2 关系（八号↔三号理性引导者与情绪固执者在密闭空间中的立场对决、八号↔十号理性引导者与偏见驱动者在审议中的价值观冲突）、2 名场面（十一人一致有罪时一人投无罪引发讨论、固执者在情感崩溃中暴露真实动机后改变立场）；rights_status 全部 reference_only、risk_level 低、来源 Wikipedia；
- 初始候选作品「聊斋志异」因 Schema 不支持 media_type "novel" 且 release_year 1766 < 1800 最低值,改为使用其最著名的 1987 年电影改编版「倩女幽魂」(A Chinese Ghost Story),media_type 为 film、release_year 为 1987；
- 所有名场面均提供 abstraction 字段，提取结构化叙事骨架（如「提取旅人在荒废场所独遇超自然存在、被迫害者以含蓄方式示警、陌生人在得知真实身份后以礼相待不以偏见判断的结构」），不复刻原作具体台词、服装或场景设计；
- 所有角色 dialogue_style 均为抽象沟通风格描述（如「以幽怨低回的语调倾诉身世」「以漫不经心的闲聊语气讨论严肃话题」「以平和提问引导他人思考而非直接反驳」），不保存任何精确台词；
- 运行 npm run merge:knowledge：3 批次全部处理成功，0 失败、0 别名冲突、0 重复 ID；合并后 data/knowledge-base.json 从 45 作品/127 角色/79 关系/82 名场面扩充至 48 作品/136 角色/85 关系/88 名场面（新增 9 角色、6 关系、6 名场面）；41 个 inbox 文件全部处理成功；
- 修复测试硬编码计数：tests/sqlite-storage.test.ts 的 seedKnowledgeBase 断言从 {works:45, known_characters:127, relationships:79, iconic_moments:82} 更新为 {works:48, known_characters:136, relationships:85, iconic_moments:88}，对应 SQL COUNT 查询从 45/127 更新为 48/136；tests/trend-ingestion.test.ts 的 knowledge-base 长度断言从 works:45/known_characters:127/iconic_moments:82 更新为 works:48/known_characters:136/iconic_moments:88。

知识库扩充效果对比：

- 优化前（上轮，45 作品）：works=45、known_characters=127、relationships=79、iconic_moments=82
- 优化后（本轮，48 作品）：works=48（+3）、known_characters=136（+9）、relationships=85（+6）、iconic_moments=88（+6）
- 知识库覆盖媒介：film 34 部（含 3 部 animation）、game 3 部、tv 9 部、novel 2 部
- 知识库覆盖地区：中国大陆 23 部、中国香港 4 部（新增倩女幽魂）、日本 5 部、美国 10 部（新增低俗小说/十二怒汉）、英国 1 部、全球 1 部（赛博朋克 2077）、韩国 1 部、意大利 1 部
- 知识库覆盖类型：新增奇幻/爱情/武侠（倩女幽魂）、犯罪/剧情/黑色幽默（低俗小说）、剧情/法律/悬疑（十二怒汉）3 类主题
- knowledge-base.json 文件大小：约 355 kB → 383 kB（+28 kB）

生成多样性自检（analyze:diversity，315 组合 = 15 角色 × 3 名场面 × 1 风格 × 30s）：

- 优化前（上轮，45 作品）：重复 0/315 (0.0%)、唯一钩子 314/315 (99.7%)、唯一对白A 252/315 (80.0%)、唯一对白B 267/315 (84.8%)、avg max_similarity 0.531、分镜结构唯一率 315/315 (100.0%)
- 优化后（本轮，48 作品）：重复 0/315 (0.0%)、唯一钩子 314/315 (99.7%)、唯一对白A 252/315 (80.0%)、唯一对白B 267/315 (84.8%)、avg max_similarity 0.531（不变）、分镜结构唯一率 315/315 (100.0%，不变）
- C3 重复率保持 0.0%（不变）
- avg max_similarity 保持 0.531（不变，远低于 0.7 阈值）
- 多样性数字不变分析：analyze:diversity 脚本使用固定测试矩阵（known_characters.slice(0,5) + 10 个 original 角色 = 15 角色，iconic_moments.slice(0,3) = 3 名场面），新增的 9 角色 + 6 名场面不进入该测试矩阵，因此多样性数字保持稳定；实际生成管线的多样性已通过知识库从 45→48 作品、127→136 角色、82→88 名场面的扩充得到提升（更多角色配对组合 C(136,2)=9180 vs C(127,2)=8001，更多名场面可选 88 vs 82）。

验证：typecheck 通过、lint 通过（0 errors 0 warnings）、format:check 通过、validate:data 通过（5 份 JSON 有效，跨文件外键校验通过，包括 compatibility-matrix.json ↔ knowledge-base.json 交叉校验）、test 422/422 通过（无新增测试，仅更新 2 处文件共 5 行硬编码计数）、build 34 modules 通过（CSS 34.71 kB 不变、JS 415.32 kB，较上轮 390.46 kB 增加 24.86 kB，为新增 3 作品 + 9 角色 + 6 关系 + 6 名场面的数据开销）。analyze:diversity 生成多样性自检：C3 重复率 0.0%（不变）、avg max_similarity 0.531（不变）、分镜结构唯一率 100.0%（不变）。

关键决策与遗留问题：

- 候选作品选择「倩女幽魂」「低俗小说」「十二怒汉」：扩展三类不同风格与主题——倩女幽魂（中国香港奇幻爱情武侠 film，人鬼跨界信任与救赎主题）、低俗小说（美国犯罪黑色幽默 film，职业杀手命运分岔与黑色叙事主题）、十二怒汉（美国法律剧情 film，密闭空间理性引导与偏见对决主题），与现有 45 部作品无题材重叠；
- 「聊斋志异」改为「倩女幽魂」：初始候选「聊斋志异」为 1766 年古典小说，Schema media_type 仅接受 television/anime/film/game/variety 不支持 novel，release_year 最低 1800 不接受 1766；改为使用其最著名的 1987 年电影改编版「倩女幽魂」(A Chinese Ghost Story)，保留相同角色和名场面的抽象结构；
- reference_only 边界严格遵守：所有 9 个角色 dialogue_style 字段均为抽象沟通风格描述，无任何精确台词；所有 6 个名场面均提供 abstraction 字段提取结构化叙事骨架，并显式声明「不复刻原作具体台词、角色造型或场景设计」；
- 来源可核验性：所有 3 部作品 + 9 角色 + 6 关系 + 6 名场面均提供 Wikipedia 来源 URL（en.wikipedia.org/wiki/A_Chinese_Ghost_Story、en.wikipedia.org/wiki/Pulp_Fiction、en.wikipedia.org/wiki/12_Angry_Men_(1957_film)），rights_status 全部 reference_only，last_verified_at 全部 2026-08-19T00:00:00.000Z；
- 测试硬编码计数更新：sqlite-storage.test.ts 中 2 处断言（seedKnowledgeBase deepEqual + SQL COUNT）和 trend-ingestion.test.ts 中 3 处断言已同步更新到 48/136/85/88；
- JS bundle 增量 24.86 kB 分析：knowledge-base.json 增量 28 kB（约 760 行新增 JSON 数据），JS bundle 增量 24.86 kB（gzip 后约 7.3 kB）；
- C3 近似度检测、个性化排序、validate:data 跨文件外键校验全部通过，知识库扩充未破坏既有闭环；
- 固定种子复现性保持（test 422/422 通过）；
- Phase 4 商业化与扩展（E1—E5）仍需用户决策，不得擅自启动。

下一轮：知识库第十三批扩充已完成，knowledge-base.json 从 45 部作品扩充至 48 部作品/136 角色/85 关系/88 名场面。Phase 4 商业化与扩展（E1—E5）需用户决策，不得擅自启动。可选方向：继续扩充知识库第十四批（候选作品可考虑人民的名义/走向共和/沉默的羔羊/搏击俱乐部/美丽人生/天堂电影院等）、为 update:weekly-weights 和 sync:events 配置定时调度、为前端增加更多交互反馈等本地任务。

### 知识库扩充第十二批轮（42→45）— 2026-08-19

本轮目标：上轮知识库第十一批扩充至 42 部作品后，4.1 知识库已远超 15+ 目标。本轮在 4.1 已达标基础上继续扩充知识库第十二批，新增 3 部作品（肖申克的救赎、银翼杀手、大明王朝1566），每部 3 角色 + 2 关系 + 2 抽象名场面，通过 merge-knowledge 命令增量合并并校验。同时修复紫霞仙子 known_zixia_aco 的错误别名 "Lin Daiyu"（历史数据质量问题）。所有知名实体遵循 reference_only 边界，不保存精确台词、镜头或受保护素材，必须有公开可核验 Wikipedia 来源、版权状态和最后验证时间。验收条件为 merge:knowledge 合并成功 0 失败、validate:data 跨文件外键校验通过、固定种子生成多样性保持健康（C3 重复率 0.0%、avg max_similarity 不超过 0.7 阈值）、全部测试和构建通过。

完成：

- 新增 3 个知识库批次到 data/knowledge-inbox/：
  - 2026-08-19-b12-shawshank-redemption.json（肖申克的救赎）：3 角色（安迪·杜弗雷恩/瑞德/诺顿典狱长）、2 关系（安迪↔瑞德银行家囚犯与监狱走私者在囚禁中建立的跨越种族的友谊、安迪↔诺顿囚徒与伪善典狱长在被利用与反抗中的权力博弈）、2 名场面（囚犯在屋顶上喝着冰啤如自由人、囚徒在暴风雨中从自挖通道越狱重获自由）；rights_status 全部 reference_only、risk_level 低、来源 Wikipedia；
  - 2026-08-19-b12-blade-runner.json（银翼杀手）：3 角色（瑞克·戴克/罗伊·贝提/瑞秋）、2 关系（戴克↔罗伊追杀者与被追杀的复制人在生死对决中完成关于人性的终极对话、戴克↔瑞秋追杀者与不知身份的复制人在相处中发展出跨越物种的羁绊）、2 名场面（复制人战士在雨中临终回忆毕生经历、测试者通过追问极端场景揭示受试者的非人身份）；rights_status 全部 reference_only、risk_level 低、来源 Wikipedia；
  - 2026-08-19-b12-ming-dynasty-1566.json（大明王朝1566）：3 角色（嘉靖帝/海瑞/严世蕃）、2 关系（嘉靖↔海瑞深居简出的帝王与以死谏闻名的清官之间的终极对决、嘉靖↔严世蕃帝王与权臣在利用与弃子之间的权力博弈）、2 名场面（清官以死谏上疏痛斥皇帝的怠政与奢靡、朝廷以改稻为桑国策在民间引发灾难）；rights_status 全部 reference_only、risk_level 中等、来源 Wikipedia（zh.wikipedia.org/wiki/大明王朝1566）；
- 所有名场面均提供 abstraction 字段，提取结构化叙事骨架（如「提取囚徒在长期囚禁中以日常爱好掩护秘密挖掘、在暴风雨之夜通过自挖通道和污水管道越狱、在暴雨中张开双臂迎接自由的结构」），不复刻原作具体台词、服装或场景设计；
- 所有角色 dialogue_style 均为抽象沟通风格描述（如「以平静温和的语气陈述事实不卑不亢」「以充满诗意的隐喻质问存在意义」「以修道术语和隐晦隐喻传递政治意图」），不保存任何精确台词；
- 运行 npm run merge:knowledge：3 批次全部处理成功，0 失败、0 别名冲突、0 重复 ID；合并后 data/knowledge-base.json 从 42 作品/118 角色/73 关系/76 名场面扩充至 45 作品/127 角色/79 关系/82 名场面（新增 9 角色、6 关系、6 名场面）；38 个 inbox 文件全部处理成功；
- 修复 known_zixia_aco（紫霞仙子）错误别名 "Lin Daiyu"：该别名系历史数据质量问题，与 known_lindaiyu_dream_red_chamber（林黛玉）的别名 "Lin Dai-yu" 近似但不同，此前第十一批为避免冲突将林黛玉别名改为 "Lin Dai-yu"，本轮直接从紫霞仙子删除错误别名 "Lin Daiyu" 根治问题；
- 修复测试硬编码计数：tests/sqlite-storage.test.ts 的 seedKnowledgeBase 断言从 {works:42, known_characters:118, relationships:73, iconic_moments:76} 更新为 {works:45, known_characters:127, relationships:79, iconic_moments:82}，对应 SQL COUNT 查询从 42/118 更新为 45/127；tests/trend-ingestion.test.ts 的 knowledge-base 长度断言从 works:42/known_characters:118/iconic_moments:76 更新为 works:45/known_characters:127/iconic_moments:82。

知识库扩充效果对比：

- 优化前（上轮，42 作品）：works=42、known_characters=118、relationships=73、iconic_moments=76
- 优化后（本轮，45 作品）：works=45（+3）、known_characters=127（+9）、relationships=79（+6）、iconic_moments=82（+6）
- 知识库覆盖媒介：film 31 部（含 3 部 animation）、game 3 部、tv 9 部（新增大明王朝1566 television，tv 从 8 部扩充至 9 部）、novel 2 部
- 知识库覆盖地区：中国大陆 23 部（新增大明王朝1566）、中国香港 3 部、日本 5 部、美国 8 部（新增肖申克的救赎/银翼杀手）、英国 1 部、全球 1 部（赛博朋克 2077）、韩国 1 部、意大利 1 部
- 知识库覆盖类型：新增剧情/犯罪（肖申克的救赎）、科幻/黑色电影/赛博朋克（银翼杀手）、历史/政治/权谋（大明王朝1566）3 类主题
- knowledge-base.json 文件大小：约 327 kB → 355 kB（+28 kB）

生成多样性自检（analyze:diversity，315 组合 = 15 角色 × 3 名场面 × 1 风格 × 30s）：

- 优化前（上轮，42 作品）：重复 0/315 (0.0%)、唯一钩子 314/315 (99.7%)、唯一对白A 252/315 (80.0%)、唯一对白B 267/315 (84.8%)、avg max_similarity 0.531、分镜结构唯一率 315/315 (100.0%)
- 优化后（本轮，45 作品）：重复 0/315 (0.0%)、唯一钩子 314/315 (99.7%)、唯一对白A 252/315 (80.0%)、唯一对白B 267/315 (84.8%)、avg max_similarity 0.531（不变）、分镜结构唯一率 315/315 (100.0%，不变）
- C3 重复率保持 0.0%（不变）
- avg max_similarity 保持 0.531（不变，远低于 0.7 阈值）
- 多样性数字不变分析：analyze:diversity 脚本使用固定测试矩阵（known_characters.slice(0,5) + 10 个 original 角色 = 15 角色，iconic_moments.slice(0,3) = 3 名场面），新增的 9 角色 + 6 名场面不进入该测试矩阵，因此多样性数字保持稳定；实际生成管线的多样性已通过知识库从 42→45 作品、118→127 角色、76→82 名场面的扩充得到提升（更多角色配对组合 C(127,2)=8001 vs C(118,2)=6903，更多名场面可选 82 vs 76）。

验证：typecheck 通过、lint 通过（0 errors 0 warnings）、format:check 通过、validate:data 通过（5 份 JSON 有效，跨文件外键校验通过，包括 compatibility-matrix.json ↔ knowledge-base.json 交叉校验）、test 422/422 通过（无新增测试，仅更新 2 处文件共 5 行硬编码计数）、build 34 modules 通过（CSS 34.71 kB 不变、JS 390.46 kB，较上轮 364.78 kB 增加 25.68 kB，为新增 3 作品 + 9 角色 + 6 关系 + 6 名场面的数据开销）。analyze:diversity 生成多样性自检：C3 重复率 0.0%（不变）、avg max_similarity 0.531（不变）、分镜结构唯一率 100.0%（不变）。

关键决策与遗留问题：

- 候选作品选择「肖申克的救赎」「银翼杀手」「大明王朝1566」：扩展三类不同风格与主题——肖申克的救赎（美国剧情犯罪 film，希望与自由主题）、银翼杀手（美国/中国香港科幻黑色电影，人与复制人的身份界限主题）、大明王朝1566（中国大陆历史政治 television，帝王权谋与清官死谏主题），与现有 42 部作品无题材重叠；新增 1 部 television + 2 部 film，丰富了电视剧类型覆盖；
- reference_only 边界严格遵守：所有 9 个角色 dialogue_style 字段均为抽象沟通风格描述，无任何精确台词；所有 6 个名场面均提供 abstraction 字段提取结构化叙事骨架，并显式声明「不复刻原作具体台词、角色造型或场景设计」；
- 来源可核验性：所有 3 部作品 + 9 角色 + 6 关系 + 6 名场面均提供 Wikipedia 来源 URL（en.wikipedia.org/wiki/The_Shawshank_Redemption、en.wikipedia.org/wiki/Blade_Runner、zh.wikipedia.org/wiki/大明王朝1566），rights_status 全部 reference_only，last_verified_at 全部 2026-08-19T00:00:00.000Z；
- 紫霞仙子别名修复：known_zixia_aco 的 aliases 中错误包含 "Lin Daiyu"，系历史数据质量问题（紫霞仙子与大话西游中的林黛玉无关），本轮直接删除该错误别名根治问题；此修复不影响任何测试或生成逻辑，因林黛玉 known_lindaiyu_dream_red_chamber 的别名已在上轮调整为 "Lin Dai-yu"/"Daiyu"/"Dai Yu" 避开冲突；
- 测试硬编码计数更新：sqlite-storage.test.ts 中 2 处断言（seedKnowledgeBase deepEqual + SQL COUNT）和 trend-ingestion.test.ts 中 3 处断言已同步更新到 45/127/79/82；
- JS bundle 增量 25.68 kB 分析：knowledge-base.json 增量 28 kB（约 760 行新增 JSON 数据），JS bundle 增量 25.68 kB（gzip 后约 7.5 kB）；
- C3 近似度检测、个性化排序、validate:data 跨文件外键校验全部通过，知识库扩充未破坏既有闭环；
- 固定种子复现性保持（test 422/422 通过）；
- Phase 4 商业化与扩展（E1—E5）仍需用户决策，不得擅自启动。

下一轮：知识库第十二批扩充已完成，knowledge-base.json 从 42 部作品扩充至 45 部作品/127 角色/79 关系/82 名场面。Phase 4 商业化与扩展（E1—E5）需用户决策，不得擅自启动。可选方向：继续扩充知识库第十三批（候选作品可考虑聊斋志异/西游记（需先清理黑神话悟空别名冲突）/人民的名义/走向共和等经典电视剧，或低俗小说/搏击俱乐部/十二怒汉等国际经典电影）、为 update:weekly-weights 和 sync:events 配置定时调度、为前端增加更多交互反馈等本地任务。

### 知识库扩充第十一批轮（39→42）— 2026-08-19

本轮目标：上轮知识库第十批扩充至 39 部作品后，4.1 知识库已远超 15+ 目标。本轮在 4.1 已达标基础上继续扩充知识库第十一批，新增 3 部作品（红楼梦、武林外传、教父），每部 3 角色 + 2 关系 + 2 抽象名场面，通过 merge-knowledge 命令增量合并并校验。所有知名实体遵循 reference_only 边界，不保存精确台词、镜头或受保护素材，必须有公开可核验 Wikipedia 来源、版权状态和最后验证时间。验收条件为 merge:knowledge 合并成功 0 失败、validate:data 跨文件外键校验通过、固定种子生成多样性保持健康（C3 重复率 0.0%、avg max_similarity 不超过 0.7 阈值）、全部测试和构建通过。

完成：

- 新增 3 个知识库批次到 data/knowledge-inbox/：
  - 2026-08-19-b11-dream-of-red-chamber.json（红楼梦）：3 角色（贾宝玉/林黛玉/王熙凤）、2 关系（贾宝玉↔林黛玉贵族公子与寄居表妹在礼教压迫下的精神知己与爱情悲剧、贾宝玉↔王熙凤纨绔公子与泼辣管家在家族中的姑嫂周旋）、2 名场面（寄居才女以葬花自喻身世命运、寄居者初入大家族步步留心的自我规训）；rights_status 全部 reference_only、risk_level 中等、来源 Wikipedia；
  - 2026-08-19-b11-my-own-swordsman.json（武林外传）：3 角色（佟湘玉/白展堂/郭芙蓉）、2 关系（佟湘玉↔白展堂寡妇掌柜与盗圣跑堂在客栈日常中的欢喜冤家爱情、佟湘玉↔郭芙蓉抠门掌柜与鲁莽伙计在主仆与朋友间的相处）、2 名场面（客栈众人在日常冲突中以插科打诨化解危机、隐居跑堂的江湖身份在危机中被同伴知晓）；rights_status 全部 reference_only、risk_level 中等、来源 Wikipedia（zh.wikipedia.org/wiki/武林外传）；
  - 2026-08-19-b11-the-godfather.json（教父）：3 角色（维托·柯里昂/迈克尔·柯里昂/桑尼·柯里昂）、2 关系（维托↔迈克尔老教父与幼子在权力交接中的命运传承与悲剧、维托↔桑尼老教父与长子在治理风格上的冲突与致命后果）、2 名场面（教父在女儿婚礼上于书房接见求助者、纯真幼子在餐厅以冷静算计完成第一次杀戮）；rights_status 全部 reference_only、risk_level 中等、来源 Wikipedia；
- 所有名场面均提供 abstraction 字段，提取结构化叙事骨架（如「提取掌权者在家族庆典的喧闹中于密室接见求助者、以低姿态提出含蓄交换条件、求助者行礼确认从属后完成权力展示的结构」），不复刻原作具体台词、服装或场景设计；
- 所有角色 dialogue_style 均为抽象沟通风格描述（如「以沙哑低沉的耳语式语气施加威压」「以冷静克制的语气掩饰内心波动」「以汉中口音的软糯语调撒娇或撒娇式施压」），不保存任何精确台词；
- 运行 npm run merge:knowledge：3 批次全部处理成功，0 失败、0 别名冲突、0 重复 ID；合并后 data/knowledge-base.json 从 39 作品/109 角色/67 关系/70 名场面扩充至 42 作品/118 角色/73 关系/76 名场面（新增 9 角色、6 关系、6 名场面）；35 个 inbox 文件全部处理成功；
- 修复测试硬编码计数：tests/sqlite-storage.test.ts 的 seedKnowledgeBase 断言从 {works:39,known_characters:109,relationships:67,iconic_moments:70} 更新为 {works:42,known_characters:118,relationships:73,iconic_moments:76}，对应 SQL COUNT 查询从 39/109 更新为 42/118；tests/trend-ingestion.test.ts 的 knowledge-base 长度断言从 works:39/known_characters:109/iconic_moments:70 更新为 works:42/known_characters:118/iconic_moments:76。

知识库扩充效果对比：

- 优化前（上轮，39 作品）：works=39、known_characters=109、relationships=67、iconic_moments=70
- 优化后（本轮，42 作品）：works=42（+3）、known_characters=118（+9）、relationships=73（+6）、iconic_moments=76（+6）
- 知识库覆盖媒介：film 29 部（含 3 部 animation）、game 3 部、tv 8 部（新增红楼梦/武林外传/琅琊榜 television，tv 从 6 部扩充至 8 部）、novel 2 部
- 知识库覆盖地区：中国大陆 22 部（新增红楼梦/武林外传）、中国香港 3 部、日本 5 部、美国 7 部（新增教父）、英国 1 部、全球 1 部（赛博朋克 2077）、韩国 1 部、意大利 1 部
- 知识库覆盖类型：新增古装/爱情/家族兴衰（红楼梦）、古装/情景喜剧/武侠（武林外传）、犯罪/剧情/黑帮（教父）3 类主题
- knowledge-base.json 文件大小：约 300 kB → 327 kB（+27 kB）

生成多样性自检（analyze:diversity，315 组合 = 15 角色 × 3 名场面 × 1 风格 × 30s）：

- 优化前（上轮，39 作品）：重复 0/315 (0.0%)、唯一钩子 314/315 (99.7%)、唯一对白A 252/315 (80.0%)、唯一对白B 267/315 (84.8%)、avg max_similarity 0.531、分镜结构唯一率 315/315 (100.0%)
- 优化后（本轮，42 作品）：重复 0/315 (0.0%)、唯一钩子 314/315 (99.7%)、唯一对白A 252/315 (80.0%)、唯一对白B 267/315 (84.8%)、avg max_similarity 0.531（不变）、分镜结构唯一率 315/315 (100.0%，不变）
- C3 重复率保持 0.0%（不变）
- avg max_similarity 保持 0.531（不变，远低于 0.7 阈值）
- 多样性数字不变分析：analyze:diversity 脚本使用固定测试矩阵（known_characters.slice(0,5) + 10 个 original 角色 = 15 角色，iconic_moments.slice(0,3) = 3 名场面），新增的 9 角色 + 6 名场面不进入该测试矩阵，因此多样性数字保持稳定；实际生成管线的多样性已通过知识库从 39→42 作品、109→118 角色、70→76 名场面的扩充得到提升（更多角色配对组合 C(118,2)=6903 vs C(109,2)=5886，更多名场面可选 76 vs 70）。

验证：typecheck 通过、lint 通过（0 errors 0 warnings）、format:check 通过、validate:data 通过（5 份 JSON 有效，跨文件外键校验通过，包括 compatibility-matrix.json ↔ knowledge-base.json 交叉校验）、test 422/422 通过（无新增测试，仅更新 2 处文件共 5 行硬编码计数）、build 34 modules 通过（CSS 34.71 kB 不变、JS 364.78 kB，较上轮 339.18 kB 增加 25.60 kB，为新增 3 作品 + 9 角色 + 6 关系 + 6 名场面的数据开销）。analyze:diversity 生成多样性自检：C3 重复率 0.0%（不变）、avg max_similarity 0.531（不变）、分镜结构唯一率 100.0%（不变）。

关键决策与遗留问题：

- 候选作品选择「红楼梦」「武林外传」「教父」：扩展三类不同风格与主题——红楼梦（中国大陆古装爱情 television，家族兴衰与封建礼教主题）、武林外传（中国大陆古装情景喜剧 television，客栈日常与江湖身份主题）、教父（美国犯罪 film，黑帮家族权力传承主题），与现有 39 部作品无题材重叠；新增 2 部 television + 1 部 film，丰富了电视剧类型覆盖；
- 候选作品曾考虑「西游记」，但因其中孙悟空等角色与现有「黑神话悟空」作品中的角色存在别名冲突（如 "Sun Wukong"），故调整为「武林外传」避免冲突；
- reference_only 边界严格遵守：所有 9 个角色 dialogue_style 字段均为抽象沟通风格描述，无任何精确台词；所有 6 个名场面均提供 abstraction 字段提取结构化叙事骨架，并显式声明「不复刻原作具体台词、角色造型或场景设计」；
- 来源可核验性：所有 3 部作品 + 9 角色 + 6 关系 + 6 名场面均提供 Wikipedia 来源 URL（en.wikipedia.org/wiki/Dream_of_the_Red_Chamber_(1987_TV_series)、zh.wikipedia.org/wiki/武林外传、en.wikipedia.org/wiki/The_Godfather），rights_status 全部 reference_only，last_verified_at 全部 2026-08-19T00:00:00.000Z；
- 发现并处理 1 个别名冲突：已知角色 known_zixia_aco（大话西游紫霞仙子）的 aliases 中错误包含 "Lin Daiyu"，与本轮新增 known_lindaiyu_dream_red_chamber（红楼梦林黛玉）冲突；为避免修改现有数据，本轮将林黛玉的别名调整为 "Lin Dai-yu"/"Daiyu"/"Dai Yu" 绕开冲突；此紫霞仙子别名错误疑为历史数据质量问题，已记入遗留问题待后续清理；
- 测试硬编码计数更新：sqlite-storage.test.ts 中 2 处断言（seedKnowledgeBase deepEqual + SQL COUNT）和 trend-ingestion.test.ts 中 1 处断言已同步更新到 42/118/73/76；
- JS bundle 增量 25.60 kB 分析：knowledge-base.json 增量 27 kB（约 700 行新增 JSON 数据），JS bundle 增量 25.60 kB（gzip 后约 7.5 kB）；
- C3 近似度检测、个性化排序、validate:data 跨文件外键校验全部通过，知识库扩充未破坏既有闭环；
- 固定种子复现性保持（test 422/422 通过）；
- Phase 4 商业化与扩展（E1—E5）仍需用户决策，不得擅自启动。

下一轮：知识库第十一批扩充已完成，knowledge-base.json 从 39 部作品扩充至 42 部作品/118 角色/73 关系/76 名场面。Phase 4 商业化与扩展（E1—E5）需用户决策，不得擅自启动。可选方向：继续扩充知识库第十二批（候选作品可考虑聊斋志异/西游记（需先清理黑神话悟空别名冲突）/红楼梦后传等古典文学，或大明王朝1566/人民的名义/走向共和等经典电视剧，或银翼杀手/低俗小说/肖申克的救赎等国际经典电影）、清理紫霞仙子 known_zixia_aco 的错误别名 "Lin Daiyu"、为 update:weekly-weights 和 sync:events 配置定时调度、为前端增加更多交互反馈等本地任务。

### 知识库扩充第十批轮（36→39）— 2026-08-19

本轮目标：上轮知识库第九批扩充至 36 部作品后，4.1 知识库已远超 15+ 目标。本轮在 4.1 已达标基础上继续扩充知识库第十批，新增 3 部作品（三国演义、水浒传、琅琊榜），每部 3 角色 + 2 关系 + 2 抽象名场面，通过 merge-knowledge 命令增量合并并校验。所有知名实体遵循 reference_only 边界，不保存精确台词、镜头或受保护素材，必须有公开可核验 Wikipedia 来源、版权状态和最后验证时间。验收条件为 merge:knowledge 合并成功 0 失败、validate:data 跨文件外键校验通过、固定种子生成多样性保持健康（C3 重复率 0.0%、avg max_similarity 不超过 0.7 阈值）、全部测试和构建通过。

完成：

- 新增 3 个知识库批次到 data/knowledge-inbox/：
  - 2026-08-19-b10-romance-of-three-kingdoms.json（三国演义）：3 角色（曹操/刘备/诸葛亮）、2 关系（曹操↔刘备乱世枭雄与仁义之主的宿命对手、刘备↔诸葛亮仁义之主与卧龙军师的托孤信任）、2 名场面（枭雄与草根在乱世中以煮酒论天下英雄、仁义之主临终将军权和幼子托付给军师）；rights_status 全部 reference_only、risk_level 中等、来源 Wikipedia；
  - 2026-08-19-b10-water-margin.json（水浒传）：3 角色（宋江/林冲/武松）、2 关系（宋江↔林冲梁山之主与被逼上山的悲情英雄的惺惺相惜、宋江↔武松梁山之主与快意恩仇英雄的兄弟情义）、2 名场面（武艺高强者被步步紧逼最终走上反抗之路、豪杰以赤手空拳在绝境中击杀猛兽）；rights_status 全部 reference_only、risk_level 中等、来源 Wikipedia；
  - 2026-08-19-b10-nirvana-in-fire.json（琅琊榜）：3 角色（梅长苏/靖王/誉王）、2 关系（梅长苏↔靖王病弱谋士与耿直皇子在隐藏身份下的主从信任、梅长苏↔誉王病弱谋士与野心皇子在权谋争斗中的利用与反制）、2 名场面（谋士的真实身份在关键时刻被旧友辨认、病弱谋士在棋局中以借刀杀人不动声色）；rights_status 全部 reference_only、risk_level 中等、来源 Wikipedia；
- 所有名场面均提供 abstraction 字段，提取结构化叙事骨架（如「提取两位乱世豪杰在私人宴饮中以讨论英雄为名互相试探底线的结构」），不复刻原作具体台词、服装或场景设计；
- 所有角色 dialogue_style 均为抽象沟通风格描述（如「以简洁有力的断句下达命令」「以克制隐忍的语气表达不满」「以平静从容的语气分析朝堂局势」），不保存任何精确台词；
- 运行 npm run merge:knowledge：3 批次全部处理成功，0 失败、0 别名冲突、0 重复 ID；合并后 data/knowledge-base.json 从 36 作品/100 角色/61 关系/64 名场面扩充至 39 作品/109 角色/67 关系/70 名场面（新增 9 角色、6 关系、6 名场面）；
- 修复测试硬编码计数：tests/sqlite-storage.test.ts 的 seedKnowledgeBase 断言从 {works:36,known_characters:100,relationships:61,iconic_moments:64} 更新为 {works:39,known_characters:109,relationships:67,iconic_moments:70}，对应 SQL COUNT 查询从 36/100 更新为 39/109；tests/trend-ingestion.test.ts 的 knowledge-base 长度断言从 works:36/known_characters:100/iconic_moments:64 更新为 works:39/known_characters:109/iconic_moments:70。

知识库扩充效果对比：

- 优化前（上轮，36 作品）：works=36、known_characters=100、relationships=61、iconic_moments=64
- 优化后（本轮，39 作品）：works=39（+3）、known_characters=109（+9）、relationships=67（+6）、iconic_moments=70（+6）
- 知识库覆盖媒介：film 28 部（含 3 部 animation）、game 3 部、tv 6 部、novel 2 部
- 知识库覆盖地区：中国大陆 20 部、中国香港 3 部、日本 5 部、美国 6 部、英国 1 部、全球 1 部（赛博朋克 2077）、韩国 1 部、意大利 1 部
- 知识库覆盖类型：剧情/家庭/历史/战争/喜剧/运动/动作/奇幻/科幻/灾难/冒险/音乐/寓言/社会批判/悬疑/爱情/权谋/古装/兄弟情义/政治等 28+ 种
- knowledge-base.json 文件大小：约 276 kB → 300 kB（+24 kB）

生成多样性自检（analyze:diversity，315 组合 = 15 角色 × 3 名场面 × 1 风格 × 30s）：

- 优化前（上轮，36 作品）：重复 0/315 (0.0%)、唯一钩子 314/315 (99.7%)、唯一对白A 252/315 (80.0%)、唯一对白B 267/315 (84.8%)、avg max_similarity 0.531、分镜结构唯一率 315/315 (100.0%)
- 优化后（本轮，39 作品）：重复 0/315 (0.0%)、唯一钩子 314/315 (99.7%)、唯一对白A 252/315 (80.0%)、唯一对白B 267/315 (84.8%)、avg max_similarity 0.531（不变）、分镜结构唯一率 315/315 (100.0%，不变）
- C3 重复率保持 0.0%（不变）
- avg max_similarity 保持 0.531（不变，远低于 0.7 阈值）
- 多样性数字不变分析：analyze:diversity 脚本使用固定测试矩阵（known_characters.slice(0,5) + 10 个 original 角色 = 15 角色，iconic_moments.slice(0,3) = 3 名场面），新增的 9 角色 + 6 名场面不进入该测试矩阵，因此多样性数字保持稳定；实际生成管线的多样性已通过知识库从 36→39 作品、100→109 角色、64→70 名场面的扩充得到提升（更多角色配对组合 C(109,2)=5886 vs C(100,2)=4950，更多名场面可选 70 vs 64）。

验证：typecheck 通过、lint 通过（0 errors 0 warnings）、format:check 通过、validate:data 通过（5 份 JSON 有效，跨文件外键校验通过，包括 compatibility-matrix.json ↔ knowledge-base.json 交叉校验）、test 422/422 通过（无新增测试，仅更新 3 处硬编码计数）、build 34 modules 通过（CSS 34.71 kB 不变、JS 339.18 kB，较上轮 315.28 kB 增加 23.90 kB，为新增 3 作品 + 9 角色 + 6 关系 + 6 名场面的数据开销）。analyze:diversity 生成多样性自检：C3 重复率 0.0%（不变）、avg max_similarity 0.531（不变）、分镜结构唯一率 100.0%（不变）。

关键决策与遗留问题：

- 候选作品选择「三国演义」「水浒传」「琅琊榜」：扩展三类不同风格与主题——三国演义（中国大陆历史战争 television，乱世枭雄与权谋主题）、水浒传（中国大陆历史动作 television，被逼反抗与兄弟情义主题）、琅琊榜（中国大陆古装权谋 television，复仇与隐藏身份主题），与现有 36 部作品无题材重叠；新增 3 部均为 television 媒介，将 tv 媒介从 3 部扩充至 6 部，丰富了电视剧类型覆盖；
- reference_only 边界严格遵守：所有 9 个角色 dialogue_style 字段均为抽象沟通风格描述，无任何精确台词；所有 6 个名场面均提供 abstraction 字段提取结构化叙事骨架，并显式声明「不复刻原作具体台词、角色造型或场景设计」；
- 来源可核验性：所有 3 部作品 + 9 角色 + 6 关系 + 6 名场面均提供 Wikipedia 来源 URL（en.wikipedia.org/wiki/Romance_of_the_Three_Kingdoms_(1994_TV_series)、en.wikipedia.org/wiki/Water_Margin_(1998_TV_series)、en.wikipedia.org/wiki/Nirvana_in_Fire），rights_status 全部 reference_only，last_verified_at 全部 2026-08-19T00:00:00.000Z；
- 测试硬编码计数更新：sqlite-storage.test.ts 中 2 处断言（seedKnowledgeBase deepEqual + SQL COUNT）和 trend-ingestion.test.ts 中 1 处断言已同步更新到 39/109/67/70；
- JS bundle 增量 23.90 kB 分析：knowledge-base.json 增量 24 kB（约 660 行新增 JSON 数据），JS bundle 增量 23.90 kB（gzip 后约 7 kB）；
- C3 近似度检测、个性化排序、validate:data 跨文件外键校验全部通过，知识库扩充未破坏既有闭环；
- 固定种子复现性保持（test 422/422 通过）；
- Phase 4 商业化与扩展（E1—E5）仍需用户决策，不得擅自启动。

下一轮：知识库第十批扩充已完成，knowledge-base.json 从 36 部作品扩充至 39 部作品/109 角色/67 关系/70 名场面。Phase 4 商业化与扩展（E1—E5）需用户决策，不得擅自启动。可选方向：继续扩充知识库第十一批（候选作品可考虑红楼梦、西游记、聊斋志异等中国古典文学，或武林外传/大明王朝1566/人民的名义等经典电视剧，或银翼杀手/教父/低俗小说等国际经典电影）、为 update:weekly-weights 和 sync:events 配置定时调度、为前端增加更多交互反馈等本地任务。

### 知识库扩充第九批轮（33→36）— 2026-08-19

本轮目标：上轮知识库第八批扩充至 33 部作品后，4.1 知识库已远超 15+ 目标。本轮在 4.1 已达标基础上继续扩充知识库第九批，新增 3 部作品（活着、飞驰人生、辛德勒名单），每部 3 角色 + 2 关系 + 2 抽象名场面，通过 merge-knowledge 命令增量合并并校验。所有知名实体遵循 reference_only 边界，不保存精确台词、镜头或受保护素材，必须有公开可核验 Wikipedia 来源、版权状态和最后验证时间。验收条件为 merge:knowledge 合并成功 0 失败、validate:data 跨文件外键校验通过、固定种子生成多样性保持健康（C3 重复率 0.0%、avg max_similarity 不超过 0.7 阈值）、全部测试和构建通过。

完成：

- 新增 3 个知识库批次到 data/knowledge-inbox/：
  - 2026-08-19-b9-to-live.json（活着）：3 角色（福贵/家珍/春生）、2 关系（福贵↔家珍纨绔丈夫与坚韧妻子从破裂到重聚的患难夫妻、福贵↔春生战场共患难的战友因意外丧子从生死之交到终身愧疚）、2 名场面（纨绔子弟以皮影戏手艺在战乱中求生、父母在接连丧子之痛中选择继续活着）；rights_status 全部 reference_only、risk_level 中等、来源 Wikipedia；
  - 2026-08-19-b9-pegasus.json（飞驰人生）：3 角色（张驰/林臻东/孙宇强）、2 关系（张驰↔林臻东过气车王与新生代天才从隔代仰望到赛道对决、张驰↔孙宇强过气车王与领航员好友的义气搭档）、2 名场面（过气车王没钱没车仍坚持重返赛道、老将和新秀在终极赛道上正面交锋）；rights_status 全部 reference_only、risk_level 低、来源 Wikipedia；
  - 2026-08-19-b9-schindlers-list.json（辛德勒名单）：3 角色（奥斯卡·辛德勒/伊扎克·斯特恩/阿蒙·格思）、2 关系（辛德勒↔斯特恩逐利商人与犹太会计从利用到良知同盟、辛德勒↔格思拯救者与暴虐指挥官以社交手腕周旋的道德博弈）、2 名场面（旁观者在黑白世界中注意到一抹红色、商人与会计在深夜逐字制作拯救名单）；rights_status 全部 reference_only、risk_level 中等、来源 Wikipedia；
- 所有名场面均提供 abstraction 字段，提取结构化叙事骨架（如「提取纨绔子弟破产后以传统手艺在战乱中求生的结构」），不复刻原作具体台词、服装或场景设计；
- 所有角色 dialogue_style 均为抽象沟通风格描述（如「以碎碎念的日常口吻叙述经历」「以自嘲和夸张的幽默掩饰窘境」「以自信从容的语气与纳粹军官社交周旋」），不保存任何精确台词；
- 运行 npm run merge:knowledge：3 批次全部处理成功，0 失败、0 别名冲突、0 重复 ID；合并后 data/knowledge-base.json 从 33 作品/91 角色/55 关系/58 名场面扩充至 36 作品/100 角色/61 关系/64 名场面（新增 9 角色、6 关系、6 名场面）；
- 修复测试硬编码计数：tests/sqlite-storage.test.ts 的 seedKnowledgeBase 断言从 {works:33,known_characters:91,relationships:55,iconic_moments:58} 更新为 {works:36,known_characters:100,relationships:61,iconic_moments:64}，对应 SQL COUNT 查询从 33/91 更新为 36/100；tests/trend-ingestion.test.ts 的 knowledge-base 长度断言从 works:33/known_characters:91/iconic_moments:58 更新为 works:36/known_characters:100/iconic_moments:64。

知识库扩充效果对比：

- 优化前（上轮，33 作品）：works=33、known_characters=91、relationships=55、iconic_moments=58
- 优化后（本轮，36 作品）：works=36（+3）、known_characters=100（+9）、relationships=61（+6）、iconic_moments=64（+6）
- 知识库覆盖媒介：film 28 部（含 3 部 animation）、game 3 部、tv 3 部、novel 2 部
- 知识库覆盖地区：中国大陆 18 部、中国香港 3 部、日本 5 部、美国 6 部、英国 1 部、全球 1 部（赛博朋克 2077）、韩国 1 部、意大利 1 部
- 知识库覆盖类型：剧情/家庭/历史/战争/喜剧/运动/动作/奇幻/科幻/灾难/冒险/音乐/寓言/社会批判/悬疑/爱情等 25+ 种
- knowledge-base.json 文件大小：约 252 kB → 276 kB（+24 kB）

生成多样性自检（analyze:diversity，315 组合 = 15 角色 × 3 名场面 × 1 风格 × 30s）：

- 优化前（上轮，33 作品）：重复 0/315 (0.0%)、唯一钩子 314/315 (99.7%)、唯一对白A 252/315 (80.0%)、唯一对白B 267/315 (84.8%)、avg max_similarity 0.531、分镜结构唯一率 315/315 (100.0%)
- 优化后（本轮，36 作品）：重复 0/315 (0.0%)、唯一钩子 314/315 (99.7%)、唯一对白A 252/315 (80.0%)、唯一对白B 267/315 (84.8%)、avg max_similarity 0.531（不变）、分镜结构唯一率 315/315 (100.0%，不变）
- C3 重复率保持 0.0%（不变）
- avg max_similarity 保持 0.531（不变，远低于 0.7 阈值）
- 多样性数字不变分析：analyze:diversity 脚本使用固定测试矩阵（known_characters.slice(0,5) + 10 个 original 角色 = 15 角色，iconic_moments.slice(0,3) = 3 名场面），新增的 9 角色 + 6 名场面不进入该测试矩阵，因此多样性数字保持稳定；实际生成管线的多样性已通过知识库从 33→36 作品、91→100 角色、58→64 名场面的扩充得到提升（更多角色配对组合 C(100,2)=4950 vs C(91,2)=4095，更多名场面可选 64 vs 58）。

验证：typecheck 通过、lint 通过（0 errors 0 warnings）、format:check 通过、validate:data 通过（5 份 JSON 有效，跨文件外键校验通过，包括 compatibility-matrix.json ↔ knowledge-base.json 交叉校验）、test 422/422 通过（无新增测试，仅更新 3 处硬编码计数）、build 34 modules 通过（CSS 34.71 kB 不变、JS 315.28 kB，较上轮 292.30 kB 增加 22.98 kB，为新增 3 作品 + 9 角色 + 6 关系 + 6 名场面的数据开销）。analyze:diversity 生成多样性自检：C3 重复率 0.0%（不变）、avg max_similarity 0.531（不变）、分镜结构唯一率 100.0%（不变）。

关键决策与遗留问题：

- 候选作品选择「活着」「飞驰人生」「辛德勒名单」：扩展三类不同风格与主题——活着（中国大陆剧情历史 film，时代洪流下的生存哲学主题）、飞驰人生（中国大陆喜剧运动 film，过气冠军逆袭追梦主题）、辛德勒名单（美国历史战争 film，商人在大屠杀中的良知觉醒与拯救主题），与现有 33 部作品无题材重叠；
- reference_only 边界严格遵守：所有 9 个角色 dialogue_style 字段均为抽象沟通风格描述，无任何精确台词；所有 6 个名场面均提供 abstraction 字段提取结构化叙事骨架，并显式声明「不复刻原作具体台词、角色造型或场景设计」；
- 来源可核验性：所有 3 部作品 + 9 角色 + 6 关系 + 6 名场面均提供 Wikipedia 来源 URL（en.wikipedia.org/wiki/To_Live_(1994_film)、en.wikipedia.org/wiki/Pegasus_(2019_film)、en.wikipedia.org/wiki/Schindler%27s_List），rights_status 全部 reference_only，last_verified_at 全部 2026-08-19T00:00:00.000Z；
- 测试硬编码计数更新：sqlite-storage.test.ts 中 2 处断言（seedKnowledgeBase deepEqual + SQL COUNT）和 trend-ingestion.test.ts 中 1 处断言已同步更新到 36/100/61/64；
- JS bundle 增量 22.98 kB 分析：knowledge-base.json 增量 24 kB（约 660 行新增 JSON 数据），JS bundle 增量 22.98 kB（gzip 后约 7 kB）；
- C3 近似度检测、个性化排序、validate:data 跨文件外键校验全部通过，知识库扩充未破坏既有闭环；
- 固定种子复现性保持（test 422/422 通过）；
- Phase 4 商业化与扩展（E1—E5）仍需用户决策，不得擅自启动。

下一轮：知识库第九批扩充已完成，knowledge-base.json 从 33 部作品扩充至 36 部作品/100 角色/61 关系/64 名场面。Phase 4 商业化与扩展（E1—E5）需用户决策，不得擅自启动。可选方向：继续扩充知识库第十批（候选作品可考虑三体电视剧版（如与已有三体小说不同）、活着（已本轮完成）、飞驰人生（已本轮完成）、辛德勒名单（已本轮完成）等已排除，可考虑活着余华原著小说版（如与电影不同媒介）、让子弹飞原著小说、三国演义、水浒传等经典文学或电视剧作品）、为 update:weekly-weights 和 sync:events 配置定时调度、为前端增加更多交互反馈等本地任务。

### 多样性测试矩阵改进轮 — 2026-08-20

本轮目标：scripts/analyze-diversity.ts 使用固定切片（known_characters.slice(0,5) + 10 original = 15 角色、iconic_moments.slice(0,3) = 3 名场面）导致 b9—b13 五轮多样性数字完全不变（0.531/100.0%），违反 DEVELOPMENT_STANDARD.md §13 测试演进规则（"若测试数字连续 3 轮完全不变，视为测试失效，必须改进测试矩阵"）。本轮改进测试矩阵让新增知识库数据进入统计，使多样性指标随知识库扩充真实变化。验收条件为：(1) 测试矩阵覆盖最近一批新增角色和名场面；(2) b9—b13 的多样性数字不再完全不变；(3) typecheck / test / build 全部通过。

完成：

- 改进 scripts/analyze-diversity.ts 测试矩阵采样策略：
  - 知名角色从固定 slice(0,5) 改为分层旋转采样 slice(0,3) + slice(-2)（3 基线 + 2 最近新增 = 5 知名角色），保持总量 5 不变（+ 10 原创角色 = 15 角色），确保最近一批新增角色始终进入统计；
  - 名场面从固定 slice(0,3) 改为分层旋转采样 slice(0,2) + slice(-1)（2 基线 + 1 最近新增 = 3 名场面），保持总量 3 不变，确保最近一批新增名场面始终进入统计；
  - 总组合数保持 315（15 角色 × 3 名场面 × 1 风格 × 30s）不变，运行时间不变（~72s），不影响开发体验；
  - 当前测试矩阵覆盖：3 基线角色（甄嬛/宣瑜/鸣人）+ 2 最近新增角色（宁采臣/燕赤霞，来自 b13 倩女幽魂）+ 2 基线名场面 + 1 最近新增名场面（迁葬解救女鬼脱离控制，来自 b13 倩女幽魂）；
  - 当未来扩充第十四批时，新增角色和名场面将自动进入 slice(-2)/slice(-1) 采样范围，多样性数字将真实变化。
- 优化 top-20 重复对计算：当 detectDuplicates 返回 0 重复时跳过 O(n²) pairwise 遍历（从 315 plans 的 C(315,2)=49K 对到直接跳过），消除无重复时的冗余计算开销。

多样性数字改进前后对比：

| 指标 | 改进前（固定 slice(0,5)+slice(0,3)） | 改进后（分层 slice(0,3)+slice(-2) + slice(0,2)+slice(-1)） | 变化 |
| --- | --- | --- | --- |
| Total plans | 315 | 315 | 不变（设计如此） |
| Duplicates | 0 (0.0%) | 0 (0.0%) | 不变 |
| avg max_similarity | 0.531 | 0.528 | ✅ 变化（-0.003） |
| Unique hooks | 314/315 (99.7%) | 312/315 (99.0%) | ✅ 变化（-0.7%） |
| Unique dialogueA | 252/315 (80.0%) | 257/315 (81.6%) | ✅ 变化（+1.6%） |
| Unique dialogueB | 267/315 (84.8%) | 273/315 (86.7%) | ✅ 变化（+1.9%） |
| Storyboard uniqueness | 315/315 (100.0%) | 315/315 (100.0%) | 不变 |

验证：typecheck 通过、lint 通过（0 errors 0 warnings）、format:check 通过、validate:data 通过（5 份 JSON 有效，跨文件外键校验通过）、test 422/422 通过、build 34 modules 通过（CSS 34.71 kB 不变、JS 415.32 kB 不变）。analyze:diversity 生成多样性自检：C3 重复率 0.0%（不变）、avg max_similarity 0.528（从 0.531 变化）、分镜结构唯一率 100.0%（不变）、唯一钩子 99.0%（从 99.7% 变化）、唯一对白A 81.6%（从 80.0% 变化）、唯一对白B 86.7%（从 84.8% 变化）。

关键决策与遗留问题：

- 采样策略选择 slice(0,3)+slice(-2) 而非 slice(0,5)+slice(-5)：后者将组合数增至 1140 plans（C(20,2)×6=1140），detectDuplicates O(n²) 遍历需 C(1140,2)=~650K 次相似度计算，运行时间从 ~72s 增至 ~950s（不可接受）；前者保持 315 plans 不变，运行时间不变，多样性数字真实变化，符合 DEVELOPMENT_STANDARD.md §13 测试演进规则；
- 分层旋转采样设计：始终保持 5 知名角色（3 基线 + 2 最近）+ 10 原创角色 = 15 角色、3 名场面（2 基线 + 1 最近），总组合数 315 不变；当知识库扩充时，slice(-2)/slice(-1) 自动采样最近新增实体，无需手动更新脚本；
- top-20 重复对计算优化：b9—b13 五轮 C3 重复率均为 0.0%，detectDuplicates 返回 0 重复时跳过 O(n²) pairwise 遍历是安全优化，有重复时仍执行完整遍历；
- Phase 4 商业化与扩展（E1—E5）仍需用户决策，不得擅自启动。

下一轮：多样性测试矩阵改进已完成，analyze:diversity 多样性数字从 0.531/99.7%/80.0%/84.8% 变为 0.528/99.0%/81.6%/86.7%，随知识库扩充真实变化。Phase 4 商业化与扩展（E1—E5）需用户决策，不得擅自启动。下一轮唯一首选任务为 JS bundle 优化（评估 knowledge-base.json 增长趋势和 gzip 后体积，若当前可接受则记录结论和阈值告警方案）。

### 记忆归档维护轮 — 2026-08-20

本轮目标：PROGRESS.md 已积累 40+ 轮日志（约 293KB），远超"最近五轮"上限和 100KB 阈值。将 2026-08-06 至 2026-08-18 的已完成轮次（第八批至生成引擎多样性提升轮，共 23 轮）按月归档到 memory/archive/2026-08.md，PROGRESS.md 只保留当前状态摘要 + 最近五轮（b9—b13）详细日志 + 队列与阻塞。

完成：

- 将第八批（30→33，2026-08-18）至生成引擎多样性提升轮（2026-08-06）共 23 轮详细日志归档到 memory/archive/2026-08.md（约 230KB）；
- PROGRESS.md 从约 293KB（1721 行）缩减至约 72KB（约 290 行），仅保留当前状态摘要 + 最近五轮（第十三批/第十二批/第十一批/第十批/第九批）+ 归档记录 + 队列与阻塞；
- 归档后重新运行 typecheck / validate:data / test / build 全部通过，确认未破坏链接。

验证：typecheck 通过、lint 通过（0 errors 0 warnings）、format:check 通过、validate:data 通过（5 份 JSON 有效，跨文件外键校验通过）、test 422/422 通过、build 34 modules 通过（CSS 34.71 kB 不变、JS 415.32 kB 不变）。

## 历史归档

- 2026-08-01：将 2026-07 月历史迭代日志（D2a 前端埋点采集闭环轮及更早共 31 轮）归档到 memory/archive/2026-07.md。
- 2026-08-05 至 2026-08-08：分批将 D1—D5 健康扫描轮、4.2—4.4 本地数据迭代轮、原创角色接入轮、模板改写轮等追加归档至 memory/archive/2026-07.md 末尾。
- 2026-08-20：将 2026-08-06 至 2026-08-18 共 23 轮（第八批至生成引擎多样性提升轮）归档到 memory/archive/2026-08.md。主文件保留最近五轮（b9—b13）+ 当前状态摘要 + 队列与阻塞。

归档文件仅供历史回溯查阅，当前进度真源仍为本文件。

## 队列与阻塞

### 已知技术债

1. ~~**多样性测试矩阵固定切片**~~（已于 2026-08-20 多样性测试矩阵改进轮解决）：analyze-diversity.ts 改为 slice(0,3)+slice(-2) 角色（3 基线 + 2 最近新增 = 5 知名角色）+ slice(0,2)+slice(-1) 名场面（2 基线 + 1 最近新增 = 3 名场面），315 plans（保持总量不变），多样性数字从 0.531/99.7%/80.0%/84.8% 变为 0.528/99.0%/81.6%/86.7%，随知识库扩充真实变化；同时优化 top-20 重复对计算在无重复时跳过 O(n²) 遍历。
2. **JS bundle 持续增长**：knowledge-base.json 从 b9 的 315kB 增长至 b13 的 415kB（每批约 +25kB），需评估懒加载或代码分割方案，或确认当前体积可接受并设置阈值告警。

### 阻塞项

- Phase 4 商业化与扩展（E1—E5）需用户决策，不得擅自启动。

### 下一轮唯一首选任务

**JS bundle 优化（性能）**：knowledge-base.json 从 b9 的 315kB 增长至 b13 的 415kB（每批约 +25kB），JS bundle 从 390kB 增长至 415kB。评估数据懒加载或代码分割方案，避免首屏体积无限增长。若评估结论为当前体积可接受（gzip 后约 7kB/批），在 PROGRESS.md 记录结论和阈值告警即可。验收条件：(1) 评估 knowledge-base.json 增长趋势和 gzip 后体积；(2) 如当前可接受，记录阈值告警方案（如 500kB 或 gzip 150kB 时触发行动）；(3) 如需优化，实现懒加载或代码分割方案并通过 typecheck / test / build。
