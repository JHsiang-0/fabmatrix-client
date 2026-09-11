# TC-008 真实环境验收记录

日期：2026-09-12
状态：本轮自动化修复验证通过；真实环境项及本轮未执行项按表标记 NOT RUN

本记录对应任务重试、历史快照、任务写操作防重复和测试环境 RustFS 隔离。自动化 Mock 与静态契约验证可在本地执行；真实后端、真实 RustFS、真实打印机和生产数据库迁移不在本次自动化执行范围。

后端 `392/392` 是本次 TC-008 最近一次已执行结果；本轮前端修复后未重复运行，且后端未变，因此沿用该最近结果，不将其记为失败。

## 本轮自动化验收（2026-09-12）

| 验收项 | 结果 | 备注 |
| --- | --- | --- |
| FAILED 历史行展示 TDesign 重试并保留原记录 | PASS | 重试创建新的 QUEUED 子任务，原 FAILED 任务不变 |
| retry Long ID 字符串、root/attempt、重复幂等及谱系冲突 | PASS | 回放前校验 rootJobId/attemptNumber/userId/fileId，冲突返回 HTTP 409/业务码 409；`RETRY_LINEAGE_CONFLICT` 仅表示审计含义 |
| 创建/分配/实际 PRINTING 写入快照 | PASS | 文件、打印机、机器编号和操作员快照均有断言 |
| 改名/删除后文件筛选与历史 snapshot-first 显示 | PASS | 筛选优先当前 originalName，关联缺失才回退 fileNameSnapshot；历史显示仍 snapshot-first |
| DispatchPlanItemVO 严格字段护栏 | PASS | Mock preview/confirm/recovery 均断言 Java VO 16 字段；成功/失败由 status 派生，响应无 success/errorCode/job |
| JobQueue 设备写操作 action+job 锁 | PASS | 暂停/恢复/取消/safe-confirm/启动均在确认框前持锁，取消/关闭释放；统一锁单测通过 |
| 前端全量自动化 | PASS | `npm.cmd test`：338/338 |
| Browser 真实确认回归 | PASS | 合计 5/5（批量派发 4/4 + JobQueue 1/1）；Mock 调试计数证据：正常预览确认 `0→1`、确认框取消后 `0`（两次取消均为 0）、快速双击 `0→1`；JobQueue 暂停确认框展示时请求为 `0`、确认后为 `1`；预览展示前均为 0 |
| JobQueue Browser 真实写请求计数 | PASS | Playwright Browser 定向 1/1；Mock 调试计数可重置，暂停确认框展示时 `POST /api/v1/control/403/pause` 为 `0`，确认后为 `1` |
| 后端 RustFS 启动探测隔离定向测试 | PASS | `RustFsClientTest`：10/10；关闭开关 `headBucket=0/createBucket=0`，默认开启且桶存在 `1/0`，默认开启且桶不存在 `1/1` |
| 后端完整 Maven 测试 | PASS（沿用最近结果） | 本次 TC-008 最近一次执行为 `mvnw test`：392/392，0 failures/errors；本轮前端修复后未重复运行，后端未变；未连接真实 RustFS |
| 前端非修复 lint | PASS | `npx oxlint .` 与 `npx eslint . --no-cache` 均 0 warning/error |
| 前端生产构建 | PASS | `npm run build` 成功；仅有既有动态导入与大 chunk 提示 |
| 两仓 diff-check | PASS | `git diff --check` 通过；未提交、未 push |

## 本轮未执行项（不等同于失败）

| 验收项 | 结果 | 说明 |
| --- | --- | --- |
| Browser 三尺寸 TC-008 历史/重试 | NOT RUN | 本轮只重跑批量派发 Browser 4/4 调用次数回归 |
| Electron 800×560 / 1024×640 / 1200×760 与 Electron dist-file | NOT RUN | 本轮未启动 Electron 验证 |
| 四种前端构建（build、build:mock、build:desktop、build:desktop:mock） | NOT RUN | 本轮仅执行 `npm run build` |

上述项目的 PASS 属于先前执行记录，不计入本轮执行结果：Browser 三尺寸 TC-008 1/1、Electron TC-008 1/1/完整 Electron 4/4/dist-file 1/1、四种构建均曾通过；本轮未复验，避免将历史记录写成本轮证据。

## 真实环境验收

| 验收项 | 结果 | 备注 |
| --- | --- | --- |
| 真实 Java 服务/API/RustFS 联调 | NOT RUN | 不启动真实后端依赖 |
| 真实设备控制、打印上传/暂停/急停/完成链路 | NOT RUN | 不连接或控制真实设备 |
| 生产数据库迁移 | NOT RUN | 不执行迁移或修改数据库 |

安全边界：验收执行期间不记录密码、Token、密钥或真实服务器地址，不连接真实设备或生产基础设施；交付阶段仅按任务范围创建本地 Git 提交，不执行 `git push`。
