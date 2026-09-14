# Farm UI v2 项目计划

## 1. 文档基线

> 版本归属：本目录是 v2 功能基线和实施来源，不是当前产品发布版本。当前产品版本为 `1.0.0` 准正式版，发布范围由 `.kiro/specs/farm-v1-release-readiness/` 决定；后台自动派单继续归入 v3，不在 1.0.0 默认开放。

- 前端仓库：`D:\WorkSpace\Vue\fabmatrix-client`
- 后端仓库：`D:\WorkSpace\Java\fabmatrix-server`
- 契约基准：后端 `API_HANDOFF.md`、Controller/OpenAPI 注解、DTO/VO、Service/ServiceImpl、`SecurityConfig`、WebSocket 实现
- 审计日期：2026-09-04
- 前端与后端仓库中的 `API_HANDOFF.md` 当前内容一致；若文档与实现冲突，以后端 Controller、DTO/VO、Service 和安全配置的共同结论为准，并把冲突列为契约阻塞项。

原请求给出的 `D:\workspace\farm-ui` 与 `D:\workspace\Farm` 在当前机器上不存在。本计划基于上面列出的实际仓库生成，不修改原有 `API_HANDOFF.md`、业务代码、后端代码、数据库或 Mock 数据。

## 2. 前端项目目标

Farm UI 是局域网单农场的 Vue 3 客户端。它连接一个本地 Farm 服务端，为 ADMIN 和 OPERATOR 提供可审计、可恢复、默认人工确认的 3D 打印农场管理流程。

v2 的目标不是增加功能数量，而是让下列主链路在真实接口和 Mock 下表现一致：

1. 首次管理员初始化或登录。
2. 浏览打印机和文件。
3. 创建单个任务，默认进入人工派单队列。
4. 人工选择打印机、现场安全确认、上传或启动。
5. 查看队列、活动任务、历史和错误原因。
6. 用户主动选择文件与打印机，预览批量方案后明确确认。
7. 通过 REST 快照与鉴权 WebSocket 同步状态。

## 3. v2 正式业务范围

- 单任务手动操作是默认主流程。
- 用户发起批量分配，必须先预览、再确认。
- 默认手动派单；创建任务时可选打印机，但只进入 `ASSIGNED`，不能绕过安全确认直接启动。
- 批量上传逐项返回成功、失败及可重试标识。
- 批量确认逐项返回执行结果；失败项通过重新预览或后续冻结的重试契约处理。
- 角色只有 `ADMIN` 和 `OPERATOR`。
- ADMIN 管理用户和打印机配置；ADMIN/OPERATOR 均可管理自己的文件、任务及执行生产控制。
- 打印机为农场共享资源；OPERATOR 只能访问自己的文件和任务，ADMIN 可访问全部。
- 支持 Klipper/Moonraker 与 RRF，前端统一使用 `KLIPPER`、`RRF`。
- 正式 WebSocket 地址为 `/ws/farm-status`，连接携带 JWT。

## 4. 不在 v2 范围内

- 后台自动派单、定时自动调度和无人值守自动启动；这些属于 v3。
- 手机号注册、邮箱验证、公开注册。
- 多租户、跨农场隔离和复杂 RBAC。
- 前端保存或展示打印机 API Key、RustFS key、内部文件路径。
- 前端直连 Moonraker/RRF 发送生产指令。
- 在本计划阶段修改后端、数据库、真实设备或执行暂停、恢复、取消、急停。
- 在本计划阶段删除旧页面、删除 Mock 或提交 Git。

`AUTO_MATCH` 仅表示用户主动点击后在本次批量预览中匹配资源，不等于 v3 后台自动派单。界面必须用“本次智能匹配”等文案消除歧义。

## 5. 与后端 API_HANDOFF.md 的关系

前端不自行发明接口、状态或字段。以下契约必须作为 v2 的固定边界：

- REST 统一响应：`{ code, message, data, timestamp }`。
- 分页：`{ records, total, pageNum, pageSize, pages }`。
- 登录：`POST /api/v1/auth/login`。
- 首次初始化：`GET /api/v1/auth/setup/status`、`POST /api/v1/auth/setup/admin`。
- 当前用户：`GET /api/v1/auth/me`。
- 标准任务创建：`POST /api/v1/print-jobs`；`POST /api/v1/print-jobs/create` 只作兼容，不得被新页面调用。
- 批量预览和确认：`POST /api/v1/print-jobs/batch/preview`、`POST /api/v1/print-jobs/batch/confirm`。
- WebSocket：`/ws/farm-status?token=<JWT>`。
- 文件搜索字段：`fileName`。
- 打印机持久化状态：`OFFLINE`、`IDLE`、`PREPARING`、`PRINTING`、`PAUSED`、`ERROR`、`UNKNOWN`。
- 任务状态：`QUEUED`、`ASSIGNED`、`UPLOADING`、`READY`、`PRINTING`、`PAUSED`、`RECONCILING`、`COMPLETED`、`FAILED`、`CANCELLED`。

前端可以在适配层兼容历史响应，但 Mock、业务组件和新增代码不得继续产生 `ONLINE`、`CUSTOMER`、`PENDING`、`CANCELED`、任务态 `PREPARING`、`isFolder`、`estimatedSeconds` 或 snake_case 业务字段。

## 6. 当前静态审计结论

### 6.1 已有可复用基础

- Vue 3、Vite、Pinia、Vue Router、Axios、TDesign、Electron 脚手架已存在。
- API 模块已经覆盖多数核心地址，标准任务创建地址正确。
- 请求层已注入 Bearer Token、校验统一成功码并对修改请求做进行中去重。
- 分页、Long ID、文件和任务基础适配器已存在。
- 登录、首次初始化、打印机管理、文件库、队列、历史、批量分配、用户管理页面已有 UI 骨架。
- WebSocket 已有 Token、指数退避、序列检测和 REST 恢复的基础代码。
- 现有 3 个 Node 测试文件覆盖部分适配器、告警、序列和通用 WebSocket 行为。

### 6.2 主要阻塞

- 登录态恢复只相信浏览器存储，不校验 `expiresIn`，也不调用 `/auth/me`。
- 登录表单错误地强制密码复杂度，可能阻止后端允许的既有账号登录。
- 用户创建缺少必填 `confirmPassword`，且错误地允许创建 ADMIN；用户列表依赖后端未返回的 `enabled`。
- 打印机详情、历史和统计 API/页面未接入；扫描批量添加会丢失 `firmwareType`，并按错误返回字段统计。
- REST 打印机状态与 WebSocket 设备状态混用两套枚举，颜色和统计不完整。
- 文件长度已由后端按米返回，详情组件又除以 1000；下载和缩略图未按契约重新签发一次。
- Mock 保留 `isFolder`、`safeName`、`fileUrl`、`estimatedSeconds` 等旧字段，并缺少大量正式接口。
- `/print-jobs/queue` 后端只返回 `QUEUED`，当前页面却依赖它承载 `ASSIGNED/READY/PAUSED` 后续操作，真实联调会导致派单后任务从页面消失。
- WebSocket 首次 `SNAPSHOT.data.printers` 中的 `status` 未被解析，重连时序列未重置；客户端文本心跳与服务端协议级 Ping 不一致，超时关闭还会禁止自动重连。
- `JOB_STATUS` 只写入打印机实时 Map，没有同步任务列表 Store。
- 批量页面没有导航入口，Mock 也未实现批量上传、预览和确认。
- 现有 TODO 的多个 `[x]` 与真实实现不一致，不能作为验收证据。

## 7. 前端改造原则

1. 契约优先：先修请求、响应、状态和权限边界，再改页面交互。
2. 单一模型：REST、WebSocket、Mock、Store 和组件共享同一领域枚举与适配器。
3. 手动优先：任何上传、启动、取消和急停都由用户明确操作；不增加后台自动派单。
4. 安全默认：按钮隐藏只是体验，后端权限是最终边界；前端仍要避免展示无权限入口和误导状态。
5. 快照加事件：REST 提供可恢复真值，WebSocket 只做增量更新；连接、重连、断档后恢复快照。
6. 逐项结果：批量上传、批量添加和批量确认不能用一个总成功提示覆盖部分失败。
7. 错误可行动：400、401、403、404、409、422、503 及业务码按场景给出下一步。
8. 渐进改造：先新增适配层、Store 和测试，再替换页面调用，避免一次性重写。
9. Mock 同构：Mock 只能模拟真实契约，不得通过额外字段让错误页面“看起来可用”。
10. 验证留痕：每个 Task 独立测试、构建和记录真实后端/真实打印机依赖。

## 8. 验收目标

- ADMIN 和 OPERATOR 可以登录；首次无用户时可创建唯一 ADMIN。
- 刷新页面后通过 `/auth/me` 恢复身份；Token 无效或过期统一退出并断开 WebSocket。
- ADMIN-only 页面和按钮不可由 OPERATOR 访问，生产控制按后端权限对两种角色开放。
- 打印机列表、详情、位置、历史和统计按真实字段展示，状态颜色覆盖全部冻结状态。
- 文件分页、目录、上传、下载、预览、缩略图、删除和关联任务符合归属与错误契约。
- 单任务可完整经历创建、手动派发、安全确认、上传/启动、暂停/恢复、完成/失败/取消。
- 批量预览无业务副作用；确认后逐项显示结果，不把部分失败显示为全部成功。
- WebSocket 验证版本、事件、序列和 Token；断线与断档可恢复，不把陈旧数据显示为实时。
- Mock 与真实接口使用同一响应、分页、字段、状态流和错误码。
- API/适配器/Store/路由/状态按钮有自动化测试，`npm test`、`npm run lint`、`npm run build` 通过。
- v2 页面不出现后台自动派单开关；如保留入口，只能标记“v3 规划中”且不可操作。

## 9. 阶段边界

本目录当前只定义审计结论和执行计划。开始任何 Task 前，必须由产品/后端确认 `design.md` 中列出的契约决策；未经确认不修改业务代码。
