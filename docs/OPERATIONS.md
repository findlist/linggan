# 本地定时调度与运维说明

版本：1.0（2026-08-22）
适用范围：单机本地开发环境（Windows）。本文只描述本地调度入口与验证方法，不涉及任何部署、云服务、外部账号或真实密钥。

## 调度任务清单

| 任务           | 入口脚本                                      | npm 命令                        | 建议频率                      | 作用                                                                                     |
| -------------- | --------------------------------------------- | ------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------- |
| 前端事件回收   | `scripts/scheduled/sync-events.cmd`           | `npm run sync:events`           | 每天 1 次（或导出事件后手动） | 把 `data/event-inbox/` 中导出的事件批次校验后写入 SQLite `product_events` 表             |
| 排序权重周更新 | `scripts/scheduled/update-weekly-weights.cmd` | `npm run update:weekly-weights` | 每周一 06:00（ISO 周开始）    | 聚合本周产品事件生成 `ranking_weight_snapshots` 权重快照，供个性化排序与探索流量机制消费 |

## 幂等与重复执行语义

两个任务都设计为可安全重复执行（调度器补跑、重复触发、手动加跑均属正常场景）：

- `sync:events`：`event_id` 为幂等键，`INSERT OR IGNORE` 跳过已入库事件；同一文件重复 sync 不产生重复记录；坏文件隔离报告，不影响其他文件入库；空收件箱报告 `files_discovered: 0` 且仍为 success。
- `update:weekly-weights`：同一 ISO 周重复运行覆盖本周快照（`INSERT OR REPLACE`）；更新基准取"目标周之外最近的快照"（`src/analytics/weight-snapshot.ts` 的 `findPreviousSnapshot`），不会把本周快照自身当作上周基准，因此同一周内重复触发不会对权重二次调整；样本不足（< 50 事件）时保持原权重，changes 全 0。

## 调度入口脚本说明

`scripts/scheduled/*.cmd` 是为 Windows 任务计划程序准备的可执行入口，依次做四件事：

1. 设置 `PATH` 优先使用 `LINGGAN_NODE_DIR`（默认 `D:\development\nodejs`，Node 24）。本机默认 node 为 v14，无法运行 `--experimental-strip-types` 脚本；
2. 切换工作目录到项目根（脚本自身位置上溯两级），保证 `data/` 相对路径与 `DATABASE_URL` 默认值 `file:./data/linggan.sqlite` 解析正确；
3. Node 版本守卫：解析到的 Node 主版本低于 22 时立即以退出码 1 失败并写包装日志，避免误用旧 Node 产生难排查的 TypeScript 语法错误；
4. 调用对应 npm 命令，把退出码原样返回给任务计划程序（体现为"上次运行结果"）。

包装日志：每次运行的完整输出追加到 `data/run-logs/scheduled-<task>-wrapper.log`（目录已被 Git 忽略，可定期清理）。结构化运行结果仍以 `data/run-logs/<年>/<月>/<日>/task_run_*.json` 为准（统一任务运行日志写入，含状态、时长、元数据）。

脚本内注释使用 ASCII 英文的原因：cmd.exe 按系统 OEM 代码页解析批处理文件，UTF-8 中文注释在中文 Windows 上会显示为乱码；中文说明集中放在本文档。

## 注册本地任务计划（样例，由用户按需执行）

以下命令仅供本地参考，本仓库与开发 Agent 不会自动注册任何计划任务：

```cmd
rem 每天上午 9 点回收前端事件（当前用户身份）
schtasks /Create /TN "Linggan\sync-events" /SC DAILY /ST 09:00 /TR "E:\work\linggan\scripts\scheduled\sync-events.cmd" /F

rem 每周一上午 6 点更新排序权重
schtasks /Create /TN "Linggan\update-weekly-weights" /SC WEEKLY /D MON /ST 06:00 /TR "E:\work\linggan\scripts\scheduled\update-weekly-weights.cmd" /F
```

常用管理命令：

```cmd
schtasks /Query /TN "Linggan\sync-events" /V /FO LIST   rem 查看状态与上次运行结果
schtasks /Run /TN "Linggan\sync-events"                 rem 手动触发一次
schtasks /Delete /TN "Linggan\sync-events" /F           rem 删除计划任务
```

说明：

- `/F` 覆盖同名任务，重复注册幂等；`/TN` 使用 `Linggan\` 前缀便于集中管理；
- 默认以当前用户身份、仅登录时运行（会弹出命令行窗口）；如需无人值守可自行在"任务计划程序"图形界面改为"不管用户是否登录都要运行"，无需管理员权限（不写系统目录）；
- 两个任务默认错峰（09:00 与周一 06:00），避免同时写同一 SQLite 文件。

## 运行验证与排障

手动运行（与调度执行完全等价）：

```cmd
E:\work\linggan\scripts\scheduled\sync-events.cmd
E:\work\linggan\scripts\scheduled\update-weekly-weights.cmd
```

验证要点：

1. 退出码为 0；
2. `data/run-logs/<年>/<月>/<日>/` 出现对应 `task_run_*` JSON 且 `status` 为 `success`；
3. `sync:events` 空收件箱时报告 `files_discovered: 0` 且仍为 success；
4. `update:weekly-weights` 空库首跑生成 `sample_sufficient: false` 的基线快照（DEFAULT_WEIGHTS，changes 全 0）。

常见问题：

| 现象                     | 原因与处理                                                                                                 |
| ------------------------ | ---------------------------------------------------------------------------------------------------------- |
| 退出码 9009              | `LINGGAN_NODE_DIR` 目录不存在或其中无 npm；确认 Node 24 安装路径后修正该环境变量或脚本内默认值并重新注册   |
| 版本守卫失败（退出码 1） | 解析到的 Node 低于 22.6；检查是否有其他 Node 路径抢先，或 `LINGGAN_NODE_DIR` 指向了旧版本                  |
| `SQLITE_BUSY` 类错误     | SQLite 单写者；避免与 `pipeline:daily` 等写库任务同一时刻运行，按上文建议错峰调度                          |
| 数据库位置不符合预期     | 调度入口依赖默认 `DATABASE_URL=file:./data/linggan.sqlite`；如需自定义，为该用户设置系统环境变量后重新运行 |
| 任务计划中窗口闪烁       | 属"仅登录时运行"的正常表现；改为"不管用户是否登录都要运行"即可后台执行                                     |

## 边界声明

- 本文档仅覆盖本地单机调度；生产级调度（重试队列、告警、多机部署）属于 Phase 4 之后的工作，需用户决策后另行设计；
- 不部署、不创建外部账号、不购买服务、不写入真实密钥；`DATABASE_URL` 仅指向本地 SQLite 文件；
- `data/collection-inbox/` 由独立采集自动化写入，两个调度任务均不编辑、暂存或删除其中文件。
