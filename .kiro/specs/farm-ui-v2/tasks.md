# Farm UI v2 实施任务

## 1. 使用说明

- 本清单由 `PROJECT.md`、`requirements.md`、`design.md` 依次推导，任务状态初始均为“待开始”。
- 每个任务应独立开发、测试和验收；未满足前置依赖时不得提前合入。
- “需要后端配合”中的“确认”仅指冻结或补充契约，不授权本阶段修改后端。
- 自动派单不属于 v2；任何相关任务只能提供不可操作的“v3 规划中”入口。

## 2. P0：主流程和契约基线

### [x] T001 契约决策与联调基线

- 优先级：P0
- 前置依赖：无
- 修改文件：`API_HANDOFF.md`（仅在后端确认后）、`.kiro/specs/farm-ui-v2/*`
- 实现内容：确认用户状态字段、批量失败补偿、批量预览归属、统一分页/错误码/OpenAPI 和 WebSocket 鉴权边界；记录前后端当前契约基线。
- 验收标准：所有阻塞性问题都有唯一结论，前后端文档无互相冲突的字段或行为。
- 测试方式：文档评审；逐项与 Controller、DTO、VO、OpenAPI 复核。
- 需要后端配合：已完成，后端契约已按当前 Controller、DTO、VO、SecurityConfig 和 WebSocketServer 冻结。
- 需要真实打印机：否。
- 风险：真实数据库迁移、真实 Redis/RustFS/打印机及浏览器端完整联调仍属环境验收，不再作为 P0 代码依赖。
- 完成状态：已完成（2026-09-05）。用户状态字段统一为 `UserVO.enabled`，`false` 表示禁用，未引入或依赖 `disabled`；登录、REST JWT 和 WebSocket 均拒绝禁用账号。批量恢复仅处理 `RETRYABLE && jobId IS NULL`，已有 `jobId` 返回 `RECOVERY_REQUIRED/OPEN_EXISTING_JOB` 并保留 `sourcePlanId/sourceItemId` 关联；批量预览/恢复按当前用户校验文件归属，ADMIN 可跨用户查看。统一响应、分页字段、错误码、OpenAPI 与正式审计日志契约已同步到前后端交接文档；WebSocket 固定 `/ws/farm-status?token`，校验 JWT 用户身份、角色、禁用状态和连接上限。T002–T015、T101–T109、T201–T207 已基于上述基线完成。真实 MySQL 增量迁移、真实 Redis/RustFS/打印机物理链路和浏览器端完整 E2E 仍是环境验收，不阻塞当前代码 Task。

### [x] T002 API 请求层与统一错误模型

- 优先级：P0
- 前置依赖：T001 中与本任务相关的统一响应、分页和错误大类基线已冻结；T001 其余后端阻塞不影响本任务。
- 修改文件：`src/utils/request.js`、`src/utils/message.js`、相关测试
- 实现内容：统一 `{code,message,data,timestamp}` 解包、Blob/预签名例外、HTTP 与业务错误映射、401 清理会话、403/404/409/422/503 上下文，并消除重复 toast。
- 验收标准：调用方只获得规范 data 或统一错误对象；401 只执行一次退出；页面可区分关键错误。
- 测试方式：请求拦截器单元测试和各错误码 Mock 测试。
- 需要后端配合：否。
- 需要真实打印机：否。
- 风险：改动是所有 API 的基础，需防止 Blob、204/null 和旧调用回归。
- 完成状态：已完成（2026-09-04）。统一响应 envelope、Blob/ArrayBuffer 与 204/null 例外、HTTP/业务错误映射、RequestError 字段、401 单次会话清理/跳转及重复错误提示抑制已实现；现有 API 模块继续兼容 `response.data` 返回结构，相关测试、lint 和构建均通过。

### [x] T003 登录、Token 与首次管理员初始化

- 优先级：P0
- 前置依赖：T002
- 修改文件：`src/api/user.js`、`src/stores/user.js`、`src/views/Login.vue`、相关测试
- 实现内容：登录使用后端 6–20 位规则；保存 token、expiresIn/expiresAt；启动时调用 `/auth/me` 恢复；实现 setup status/admin；失效、禁用和退出时完整清理。
- 验收标准：未初始化、登录成功、刷新恢复、过期、禁用、退出六条链路均符合契约。
- 测试方式：Store/API 单测和登录页面集成测试。
- 需要后端配合：否。
- 需要真实打印机：否。
- 风险：本地旧持久化数据迁移及并发 401 可能重复跳转。
- 完成状态：已完成（2026-09-04）。登录 API 仅发送后端契约字段，新增 `/auth/me` 恢复接口；会话保存 `expiresIn/expiresAt`，启动恢复会以服务端 UserVO 覆盖本地身份，过期、无效、禁用和退出均清理会话并触发实时连接清理；首次管理员初始化和普通登录校验已按后端规则分流。认证会话测试、`npm.cmd test`、`npm.cmd run lint`、`npm.cmd run build` 均通过。路由启动门禁和 ADMIN/OPERATOR 页面权限由 T004 继续接入。

### [x] T004 ADMIN/OPERATOR 路由与操作权限

- 优先级：P0
- 前置依赖：T003
- 修改文件：`src/router/index.js`、`src/layout/*`、权限工具、相关页面和测试
- 实现内容：以 `/auth/me` 身份为准处理路由、菜单和按钮；未知角色安全退出；ADMIN 管理能力与两角色作业能力分离；退出同步断开 WebSocket。
- 验收标准：OPERATOR 无法进入或触发管理员功能，未知角色不产生重定向循环，后端 403 有明确提示。
- 测试方式：路由守卫矩阵和按钮权限组件测试。
- 需要后端配合：否。
- 需要真实打印机：否。
- 风险：仅隐藏按钮不足以代替服务端鉴权，测试需覆盖直接访问 URL。
- 完成状态：已完成（2026-09-04）。路由守卫会等待持久化 Token 通过 `/auth/me` 恢复，以服务端身份决定 ADMIN/OPERATOR 访问；未知角色清理会话并返回登录页，ADMIN-only 路由返回权限提示后回到打印机页，匿名访问保留 redirect。菜单与既有 ADMIN 操作按钮权限保持一致，退出由用户 Store 清理实时连接。权限决策矩阵测试、`npm.cmd test`、`npm.cmd run lint`、`npm.cmd run build` 均通过。

### [x] T005 领域常量与数据适配器

- 优先级：P0
- 前置依赖：T001、T002
- 修改文件：`src/utils/constants.js`、`src/utils/dataAdapters.js`、相关测试
- 实现内容：冻结打印机和任务状态、分页、文件和 Job VO 映射；新代码只用 camelCase；隔离必要的旧字段兼容并加弃用标记。
- 验收标准：REST、WebSocket、页面和 Mock 使用同一状态颜色/文案；不把 ONLINE 当持久状态；completedAt、folder、estTime 单位正确。
- 测试方式：状态映射、分页和 DTO 适配参数化单测。
- 需要后端配合：否。
- 需要真实打印机：否。
- 风险：兼容层过宽会继续掩盖错误字段。
- 完成状态：已完成（2026-09-04）。新增 PrinterVO/实时设备正式状态集合及任务状态映射，适配器统一状态、固件协议、Long ID、分页 `pages` 权威值、`folder`、`estTime` 秒、`filamentLength` 米和 `completedAt`；历史字段仅在边界兼容并移除。覆盖状态映射、ONLINE 防持久化、RRF 保留、分页和 DTO 参数化测试；`npm.cmd test`、`npm.cmd run lint`、`npm.cmd run build` 均通过。

### [x] T006 Mock 响应、错误和场景基础

- 优先级：P0
- 前置依赖：T002、T005
- 修改文件：`src/mock/factory.js`、`src/mock/scenarios.js`、`src/mock/server.js`、相关测试
- 实现内容：统一响应与分页结构，增加 400/401/403/404/409/422/503，修正 setup 未初始化和 Mock 开关，删除响应中的敏感/旧字段。
- 验收标准：所有 Mock 响应符合交接格式，错误可稳定触发，关闭 Mock 后不拦截真实请求。
- 测试方式：Mock 路由和 schema 单测。
- 需要后端配合：否。
- 需要真实打印机：否。
- 风险：清除旧字段后会暴露现有页面隐式依赖。
- 完成状态：已完成（2026-09-04）。Mock 响应统一使用 `{code,message,data,timestamp}` 与标准分页，补齐 400/401/403/404/409/422/503 及业务错误场景；支持 `mock`/`desktop-mock` 开关和确定性的已初始化/未初始化种子；对外 DTO 移除密码、文件内部地址、旧字段和人为摘要，真实模式不拦截请求。Mock 契约测试、`npm.cmd test`（34/34）、`npm.cmd run lint`、`npm.cmd run build`、`npm.cmd run build:mock` 均通过。

### [x] T007 打印机列表与真实详情

- 优先级：P0
- 前置依赖：T005、T006
- 修改文件：`src/api/printer.js`、`src/stores/printer/*`、`src/views/PrinterManage.vue`、打印机详情组件、测试
- 实现内容：接入分页列表与 `GET /printers/{id}`；统一查询、空态、异常态、刷新和真实详情字段，移除伪造温度。
- 验收标准：列表和详情均由真实 VO 驱动，状态含 PREPARING/UNKNOWN，加载失败不会显示伪数据。
- 测试方式：API/Store 单测、页面集成测试和 Mock 联调。
- 需要后端配合：否。
- 需要真实打印机：否，Mock 可验收查询。
- 风险：实时状态与 REST 详情合并时可能覆盖新数据。
- 完成状态：已完成（2026-09-04）。新增 `GET /api/v1/printers/{id}` 详情 API 与 Mock 路由，Device Store 缓存真实 PrinterVO 详情；打印机管理页和详情抽屉区分加载、失败和真实空态，移除列表摘要及零温度伪造，状态文案/颜色统一使用正式枚举，实时温度缺失时显示占位。`npm.cmd test`（34/34）、`npm.cmd run lint`、`npm.cmd run build` 均通过。

### [x] T008 打印机维护、扫描、位置与控制入口

- 优先级：P0
- 前置依赖：T004、T007
- 修改文件：`src/api/printer.js`、`src/views/PrinterManage.vue`、`src/components/printer/*`、Mock 和测试
- 实现内容：校正新增/编辑/删除、扫描结果、批量添加 firmwareType、位置和未分配列表；删除 ONLINE；移除无接口重启；集中暂停/恢复/取消/急停可用矩阵。
- 验收标准：ADMIN 管理动作参数和返回正确；控制动作只在合法状态出现；冲突和设备不可用有准确提示。
- 测试方式：组件权限/状态矩阵测试和 Mock 409/422/503。
- 需要后端配合：否。
- 需要真实打印机：否；实际设备控制留到后续联调。
- 风险：扫描环境和固件类型差异较大。
- 完成状态：已完成（2026-09-04）。校正 ADMIN 新增/编辑/删除参数与返回，删除执行中设备时返回 409；扫描与批量添加补齐 `firmwareType`、`UNKNOWN` 初始状态和新增/更新/失败统计；位置及未分配入口保持现有 API 链路；移除无后端接口的重启按钮，统一暂停、恢复、取消、急停的合法状态矩阵，并同步 Mock 的 409/422 行为与 WebSocket 状态枚举。`npm.cmd test`（34/34）、`npm.cmd run lint`、`npm.cmd run build`、`npm.cmd run build:mock` 均通过。

### [x] T009 文件库基础能力

- 优先级：P0
- 前置依赖：T005、T006
- 修改文件：`src/api/printFile.js`、`src/views/FileLibrary.vue`、文件组件、Mock 和测试
- 实现内容：接入 page/fileName/parentId、单文件上传、目录创建、树或分页导航；统一加载、搜索、空态和异常态。
- 验收标准：分页字段为 records/total/pageNum/pageSize/pages；搜索使用 fileName；目录与文件类型展示正确。
- 测试方式：API 参数测试、页面集成测试、400/401/404 Mock。
- 需要后端配合：否。
- 需要真实打印机：否。
- 风险：目录与分页切换可能造成面包屑和查询状态不同步。
- 完成状态：已完成（2026-09-04）。文件分页固定发送 `pageNum/pageSize/fileName/materialType/parentId`，Mock 与后端搜索字段、材质规范化一致；保留分页目录导航、单文件上传和新建目录，并补齐允许扩展名、父目录归属及目录名校验；文件长度按米展示，公开 DTO 不暴露内部存储字段。新增分页参数契约测试。`npm.cmd test`（35/35）、`npm.cmd run lint`、`npm.cmd run build`、`npm.cmd run build:mock` 均通过。

### [x] T010 文件删除与下载正确性

- 优先级：P0
- 前置依赖：T002、T009
- 修改文件：`src/api/printFile.js`、`src/views/FileLibrary.vue`、文件操作组件、Mock 和测试
- 实现内容：目录禁用文件删除接口；单删/批删消费逐项结果；下载预签名失效后仅重签一次；展示 409/422/CORS/网络错误。
- 验收标准：不误删目录，批删部分失败可定位，下载 401/403/410 可恢复一次且无无限重试。
- 测试方式：删除和下载状态机单测、Mock 错误测试。
- 需要后端配合：否。
- 需要真实打印机：否。
- 风险：对象存储跨域错误与 API 错误来源不同。
- 完成状态：已完成（2026-09-04）。目录删除入口已禁用且接口返回 422；单删对已关联任务返回 409；批量删除消费逐项成功/失败结果并保留失败项定位；下载预签名 URL 在 401/403/410 时最多重新签发一次，区分 CORS/网络异常；错误提示保留后端具体原因。新增预签名重试状态机测试。`npm.cmd test`（36/36）、`npm.cmd run lint`、`npm.cmd run build`、`npm.cmd run build:mock` 均通过。

### [x] T011 任务 Store、待派队列与活动任务

- 优先级：P0
- 前置依赖：T005、T006
- 修改文件：`src/api/job.js`、新建或现有任务 Store、`src/views/JobQueue.vue`、任务组件、测试
- 实现内容：明确 `/queue` 只显示 QUEUED；用 `/page` 建立 ASSIGNED/UPLOADING/READY/PRINTING/PAUSED/RECONCILING 活动列表；接入任务详情接口。
- 验收标准：派发后任务不会从 UI 操作流中消失，列表分页和详情均使用真实 PrintJobVO。
- 测试方式：Store 状态、过滤和页面切换测试。
- 需要后端配合：否。
- 需要真实打印机：否。
- 风险：多列表刷新和 WebSocket 增量更新可能产生重复记录。
- 完成状态：已完成（2026-09-04）。新增 Pinia 任务 Store 管理待派队列、活动任务、详情缓存和活动分页；`/queue` 与 Mock 均严格只返回 QUEUED，活动任务通过 `/page` 聚合 ASSIGNED/UPLOADING/READY/PRINTING/PAUSED/RECONCILING；新增 `GET /api/v1/print-jobs/{id}` 详情 API、归属校验和 Mock 路由，JobQueue 增加真实活动列表与详情加载。新增活动状态过滤测试。`npm.cmd test`（37/37）、`npm.cmd run lint`、`npm.cmd run build`、`npm.cmd run build:mock` 均通过。

### [x] T012 单任务创建、手动派发与安全启动

- 优先级：P0
- 前置依赖：T004、T007、T011
- 修改文件：`src/api/job.js`、`src/views/FileLibrary.vue`、`src/views/JobQueue.vue`、任务/打印机操作组件、测试
- 实现内容：标准 `POST /api/v1/print-jobs`；正确处理 scalar Long；手动 assign→confirm→start；支持暂停、恢复、取消、急停、重试、重排和优先级；明确多份任务策略。
- 验收标准：默认流程无自动派单，安全确认前不可启动；每步状态、权限和错误均正确；旧 `/create` 无新引用。
- 测试方式：完整任务状态机集成测试和 409/422/503 场景。
- 需要后端配合：否。
- 需要真实打印机：否，P0 用 Mock；真实控制后续人工验收。
- 风险：指定同一 printerId 并发创建多份会出现部分成功。
- 完成状态：已完成（2026-09-04）。标准 `POST /api/v1/print-jobs` 现返回 scalar Long ID；指定打印机创建后进入 ASSIGNED 并绑定设备，不指定则进入 QUEUED；FileLibrary 多份任务改为串行创建并准确提示部分成功。补齐活动列表中的安全确认/启动入口，Mock 对齐幂等键、设备占用、assign→confirm→start、取消、重试、重新排队和优先级状态矩阵，旧 `/create` 无新业务引用。`npm.cmd test`（37/37）、`npm.cmd run lint`、`npm.cmd run build`、`npm.cmd run build:mock` 均通过。

### [x] T013 P0 Mock 业务契约

- 优先级：P0
- 前置依赖：T006、T008、T010、T012
- 修改文件：`src/mock/routes.js`、`src/mock/state.js`、Mock 测试
- 实现内容：补打印机详情/控制、文件上传删除下载、任务详情/创建/派发/安全操作/重试/重排/优先级；模拟打印机占用和合法状态流。
- 验收标准：P0 页面不依赖不存在的路由；Mock 状态流为 QUEUED→ASSIGNED→UPLOADING→READY→PRINTING→终态。
- 测试方式：Mock 端到端脚本和逐路由断言。
- 需要后端配合：否。
- 需要真实打印机：否。
- 风险：Mock 过度简化会形成第二套业务规则。
- 完成状态：已完成（2026-09-04）。补齐 P0 Mock 打印机详情/控制、文件和任务主链路的路由契约校验；新增集中任务状态机，统一约束 QUEUED→ASSIGNED→UPLOADING→READY→PRINTING→终态，以及取消、重试、重排和急停恢复路径；补充状态机单测和真实 Mock 请求链路测试，未引入自动派单。`npm.cmd test`（40/40）、`npm.cmd run lint`、`npm.cmd run build`、`npm.cmd run build:mock` 均通过。

### [x] T014 WebSocket 协议与连接生命周期

- 优先级：P0
- 前置依赖：T002、T003、T005
- 修改文件：`src/utils/websocket.js`、`src/stores/printer/realtimeStore.js`、相关测试
- 实现内容：使用 `/ws/farm-status?token`；校验 version；eventId 去重；每次连接重置 sequence 基线；移除应用层 ping/pong 错配；确保超时和意外断开会重连。
- 验收标准：连接、鉴权失败、断线、服务重启、重复事件和手动退出均有确定行为，不出现心跳自断后永久停连。
- 测试方式：Fake WebSocket 生命周期、序列和重连测试。
- 需要后端配合：否。
- 需要真实打印机：否。
- 风险：浏览器不暴露协议级 Ping/Pong，需要以连接/事件超时策略替代。
- 完成状态：已完成（2026-09-04）。WebSocket 客户端固定使用 `/ws/farm-status?token` 连接配置，移除应用层 ping/pong，改用连接不活跃超时监测并保留自动重连；实时 Store 校验 `version=1`、去重 `eventId`，每次连接成功重置 sequence 基线，未知版本和 sequence 断档均保留 REST 快照恢复路径。补充协议、Fake WebSocket 超时重连和手动关闭测试。`npm.cmd test`（42/42）、`npm.cmd run lint`、`npm.cmd run build`、`npm.cmd run build:mock` 均通过。

### [x] T015 WebSocket 快照、增量同步与陈旧态

- 优先级：P0
- 前置依赖：T011、T014
- 修改文件：`src/stores/printer/realtimeStore.js`、任务 Store、看板/状态组件、Mock WebSocket 和测试
- 实现内容：SNAPSHOT 从 `PrinterVO.status` 解析；处理五类消息（含 LAYOUT_UPDATED）；JOB_STATUS 同步任务 Store；暴露连接、恢复中和 stale 状态；Mock 发送正式协议。
- 验收标准：初始快照不再全为 UNKNOWN；断线时显示陈旧态；重连快照收敛 REST 与任务列表。
- 测试方式：快照/增量/乱序/重连 Store 测试和看板组件测试。
- 需要后端配合：否。
- 需要真实打印机：否。
- 风险：REST 和 WS 更新顺序可能导致旧值覆盖。
- 完成状态：已完成（2026-09-04，SYNC-002 收口补充）。SNAPSHOT 统一从正式 `PrinterVO.status` 读取，五类实时消息均按协议分流；`LAYOUT_UPDATED` 只读取 `data` 中的布局版本，不清空设备状态；`JOB_STATUS` 同步任务 Store，断线和 sequence 断档/未知版本时暴露 stale 与恢复中状态并以 REST 快照及任务列表收敛；Mock WebSocket 补齐 `version/eventId/sequence` 和真实任务状态。专项与全量验证结果以本次 SYNC-002 收口记录为准。

## 3. P1：批量业务与管理能力

### [x] T101 文件批量上传

- 优先级：P1
- 前置依赖：T009、T013
- 修改文件：`src/api/printFile.js`、批量上传组件/页面、Mock 和测试
- 实现内容：重复 files FormData、parentId、独立长超时/进度、取消、逐项结果和失败文件重试。
- 验收标准：部分成功不被当作全失败；每项有成功/失败原因；重试只提交失败项。
- 测试方式：多文件 FormData、超时、部分失败组件测试。
- 需要后端配合：否。
- 需要真实打印机：否。
- 风险：大文件和并发上传内存占用。
- 完成状态：已完成（2026-09-04）。文件库上传入口支持 TDesign 多文件选择，批量请求使用重复 `files` 字段和独立上传超时/AbortController；页面逐项展示成功/失败结果，仅保留 `retryable=true` 的失败项重试，部分成功会刷新当前目录但不会误报全成功。Mock 补齐 `/batch-upload` 的数量、总大小、类型校验与逐项结果。`npm.cmd test`（44/44）、`npm.cmd run lint`、`npm.cmd run build`、`npm.cmd run build:mock` 均通过。

### [x] T102 批量分配入口与无副作用预览

- 优先级：P1
- 前置依赖：T007、T009、T011、T013
- 修改文件：`src/router/index.js`、导航布局、`src/views/BatchDispatch.vue`、`src/api/job.js`、测试
- 实现内容：增加可达入口；构造 items/action/requestId；展示建议、冲突、过期和不可分配原因；自动派单标为 v3 规划中。
- 验收标准：预览不创建任务、不占用打印机；用户确认前可返回修改；页面刷新不误确认。
- 测试方式：路由、请求 DTO、无副作用和冲突场景测试。
- 需要后端配合：否。
- 需要真实打印机：否。
- 风险：预览结果短期有效，UI 必须准确表示过期。
- 完成状态：已完成（2026-09-04）。批量派发页已加入侧边导航入口，统一使用 TDesign 控件；预览请求构造 `items/action/requestId` 前端上下文，但发往后端的 DTO 严格保留 `fileIds/printerIds/strategy/action`。预览仅生成计划，不创建任务或占用打印机；选择、策略或动作变化会清理旧计划，过期计划禁止确认，刷新页面不会恢复确认状态。已展示建议、冲突、过期和不可分配原因；`AUTO_MATCH` 标记为“本次智能匹配”，未增加自动派单开关。`npm.cmd test`（47/47）、`npm.cmd run lint`、`npm.cmd run build`、`npm.cmd run build:mock` 均通过。

### [x] T103 批量确认与逐项结果

- 优先级：P1
- 前置依赖：T012、T102
- 修改文件：`src/views/BatchDispatch.vue`、批量结果组件、任务 Store、Mock 和测试
- 实现内容：仅用 previewId/confirmToken 确认；处理 ASSIGN_ONLY 与 START_AFTER_CONFIRM；展示每项 jobId/status/errorCode/message/retryable。
- 验收标准：确认只提交一次，重复响应幂等展示；部分失败不覆盖成功项；成功项同步进入活动任务。
- 测试方式：全成功、部分失败、token 冲突、计划过期测试。
- 需要后端配合：否。
- 需要真实打印机：否。
- 风险：启动动作包含逐项安全确认，失败点多。
- 完成状态：已完成（2026-09-04，UI-004.20 安全复审后修订）。批量确认仅提交 `planId/version/itemIds/confirmationToken`，且服务端与 Mock 均强制只有计划创建者或 ADMIN 可确认；PUBLIC 文件只允许其他用户用于自己创建的新计划。相同计划成功确认后的重复请求只回放原结果，不重复创建任务；确认结果按项展示 `jobId/status/errorCode/message/retryable`，部分失败不覆盖成功项。成功创建的活动任务同步进入 Job Store。`npm.cmd test`、`npm.cmd run lint`、`npm.cmd run build`、`npm.cmd run build:mock` 均通过。

### [x] T104 批量失败项恢复

- 优先级：P1
- 前置依赖：T001、T103
- 修改文件：`src/views/BatchDispatch.vue`、`src/api/job.js`、`src/utils/batchDispatch.js`、Mock 和测试
- 实现内容：调用 `POST /api/v1/print-jobs/batch/retry-preview`，仅选择 `RETRYABLE && jobId IS NULL` 项重新预览并确认；已有 `jobId` 的项展示 `RECOVERY_REQUIRED/OPEN_EXISTING_JOB` 并打开既有任务，保留新旧计划/明细关联。
- 验收标准：不会重复成功项，不复用旧计划；无任务失败项可生成幂等的新恢复计划，已有任务失败项不会再次创建 Job。
- 测试方式：混合 retryable、不可重试和二次失败测试。
- 需要后端配合：是，后端已提供专用恢复预览接口及 `sourcePlanId/sourceItemId/recoveryAction` 字段。
- 需要真实打印机：否。
- 风险：真实跨进程幂等、数据库迁移和设备链路仍需部署环境验证。
- 完成状态：已完成（2026-09-05）。批量确认失败项仅对 `RETRYABLE && jobId IS NULL` 项调用专用恢复预览；已有任务项展示 `RECOVERY_REQUIRED/OPEN_EXISTING_JOB` 并可打开任务历史，不会重复创建 Job。Mock 覆盖恢复计划幂等、来源关联和二次确认；`npm.cmd test`（64/64）、`npm.cmd run lint`、`npm.cmd run build`、`npm.cmd run build:mock` 均通过。

### [x] T105 文件预览、缩略图、下载与关联任务

- 优先级：P1
- 前置依赖：T009、T010
- 修改文件：`src/api/printFile.js`、文件详情/预览组件、Mock 和测试
- 实现内容：接入 preview/thumbnail/download/jobs/tree；处理 null、过期重签和长度单位；禁止暴露对象存储 key。
- 验收标准：可预览格式正常；不支持或缺缩略图有占位态；关联任务真实可查；filamentLength 按米显示。
- 测试方式：URL 生命周期、空数据、单位和权限测试。
- 需要后端配合：否。
- 需要真实打印机：否。
- 风险：对象存储 CORS 和浏览器文件预览支持差异。
- 完成状态：已完成（2026-09-04）。新增文件预览元数据、缩略图空态、关联任务分页和嵌套文件树接口；详情抽屉分别处理预览、缩略图和任务加载状态，下载继续沿用一次过期重签策略。Mock 按当前会话过滤文件与关联任务，并清理 `fileUrl`、`safeName`、`rustfsKey` 等内部字段；`filamentLength` 按米返回和展示。新增预览、文件夹拒绝、缩略图空值、任务查询和文件树权限测试。`npm.cmd test`（54/54）、`npm.cmd run lint`、`npm.cmd run build`、`npm.cmd run build:mock` 均通过。

### [x] T106 打印机状态历史与统计

- 优先级：P1
- 前置依赖：T007、T015
- 修改文件：`src/api/printer.js`、打印机详情/图表组件、Mock 和测试
- 实现内容：接入 `/status-history` 和 `/statistics`，提供时间范围、空态和实时刷新后的增量提示。
- 验收标准：历史和统计不再使用本地伪数据，时间与状态颜色一致。
- 测试方式：API 参数、图表空态和数据映射测试。
- 需要后端配合：否。
- 需要真实打印机：否。
- 风险：大时间范围可能导致渲染性能问题。
- 完成状态：已完成（2026-09-04）。接入 `/api/v1/printers/{id}/history` 与 `/statistics`，统一规范化 Long ID、设备状态、进度和统计数值；打印机详情抽屉新增按时间范围查询的状态历史表、分页、实时更新提示和统计卡片，时长明确按秒展示。Mock 按任务创建时间计算统计、按记录时间分页历史，并覆盖权限、空结果和时间范围校验。新增 3 项历史/统计契约测试。`npm.cmd test`（57/57）、`npm.cmd run lint`、`npm.cmd run build`、`npm.cmd run build:mock` 均通过。

### [x] T107 用户管理

- 优先级：P1
- 前置依赖：T001、T003、T004、T006
- 修改文件：`src/api/user.js`、`src/views/UserManagement.vue`、用户组件、Mock 和测试
- 实现内容：只创建 OPERATOR，补 confirmPassword；接入 email/enabled 分页、受限编辑、启停；使用持久化 `enabled` 字段；保护当前管理员。
- 验收标准：真实创建不再 400，不能通过 UI 创建 ADMIN，启停返回 `UserVO` 且状态显示与服务端一致；禁用自己返回 409，不存在用户返回 404。
- 测试方式：ADMIN/OPERATOR 权限、表单、启停和 404/409 测试。
- 需要后端配合：是，后端已补齐 `UserVO.enabled`、`/auth/me`、分页过滤和启停错误语义。
- 需要真实打印机：否。
- 风险：真实 Redis/多实例缓存失效和浏览器端完整联调仍需部署环境验证。
- 完成状态：已完成（2026-09-05）。用户管理使用 `enabled` 渲染和启停，创建表单强制确认密码且固定操作员角色，保护当前管理员；Mock 覆盖 `/auth/me`、禁用旧会话、启用恢复、自禁用 409、不存在 404。`npm.cmd test`（64/64）、`npm.cmd run lint`、`npm.cmd run build`、`npm.cmd run build:mock` 均通过。

### [x] T108 任务历史、筛选与恢复操作

- 优先级：P1
- 前置依赖：T011、T015
- 修改文件：`src/views/JobHistory.vue`、任务 Store/API、任务详情组件、Mock 和测试
- 实现内容：按 status/printerId/keyword/page 筛选；使用 completedAt；展示详情；FAILED 重试、可重排状态重新入队、优先级调整。
- 验收标准：分页搜索真实有效，终态时间正确，各操作只在合法状态出现。
- 测试方式：筛选参数、状态动作矩阵和分页测试。
- 需要后端配合：否。
- 需要真实打印机：否。
- 风险：历史与活动列表边界需按状态统一定义。
- 完成状态：已完成（2026-09-04）。任务历史已接入状态、打印机 ID、文件名/任务 ID 关键词、创建时间和分页筛选；结束时间统一显示 `completedAt`，详情打开后通过 Job Store 查询真实任务。失败任务仅显示重试入口，`ASSIGNED/READY` 仅显示重新排队，`QUEUED` 仅显示优先级调整，Mock 同步补齐时间/关键词过滤和参数校验。新增筛选、completedAt、恢复动作合法性和时间范围测试。`npm.cmd test`（60/60）、`npm.cmd run lint`、`npm.cmd run build`、`npm.cmd run build:mock` 均通过。

### [x] T109 P1 Mock 与端到端回归

- 优先级：P1
- 前置依赖：T015、T101、T102、T103、T104、T105、T106、T107、T108
- 修改文件：`src/mock/*`、测试配置、端到端测试目录、`package.json`
- 实现内容：补齐 P1 路由和真实副作用，覆盖批量预览/确认、逐项结果、上传、用户、历史统计和 WebSocket；建立浏览器端主流程回归。
- 验收标准：Mock 与真实契约使用同一 schema；单任务和批量主流程可自动回归；无自动派单伪实现。
- 测试方式：单元、集成、E2E 全量执行。
- 需要后端配合：否。
- 需要真实打印机：否。
- 风险：需引入测试框架并控制测试数据隔离。
- 完成状态：已完成（2026-09-05）。统一 Mock 错误场景与正式 HTTP/业务码（`10001/5003/5004` 均按 `503` 返回），WebSocket Mock 快照改为正式 `data.printers` 安全 `PrinterVO[]`，并新增可重复执行的 `npm.cmd run test:mock` Mock HTTP 集成回归。回归覆盖登录与 `/auth/me` 恢复、文件上传/预览/下载、单任务创建/派发/安全确认/启动/暂停/恢复/取消、批量无副作用预览/确认/逐项忙碌失败/恢复、用户禁用/启用、历史统计以及 WebSocket 快照、版本、事件 ID 和连续序列；断言统一成功 envelope、分页字段、公开 DTO 和错误 envelope。当前未引入真实浏览器驱动，故该入口验证的是浏览器将使用的 Mock HTTP 契约与状态副作用，不宣称真实浏览器或后端/设备联调通过；未引入自动派单。

## 4. P2：体验、性能与后续演进

### [x] T201 全局加载、空态和异常态体验

- 优先级：P2
- 前置依赖：T109
- 修改文件：共享状态组件、各 views、样式和测试
- 实现内容：统一骨架屏、局部加载、空态、可重试异常和操作中禁用，消除重复消息。
- 验收标准：所有核心页面能区分加载/空/失败/成功，失败后可在原位重试。
- 测试方式：视觉回归和组件状态测试。
- 需要后端配合：否。
- 需要真实打印机：否。
- 风险：全局重构范围大，须分页面提交。
- 完成状态：已完成。新增共享 AsyncState 组件，统一概览、打印机、文件库、任务队列、任务历史和用户管理的加载/空数据/失败/原位重试状态；补充异步状态纯逻辑测试，并通过 npm test、npm run lint、npm run build、npm run build:mock。

### [x] T202 列表和实时更新性能

- 优先级：P2
- 前置依赖：T109
- 修改文件：Store、列表/看板组件、性能测试
- 实现内容：批处理 WS 更新、限制历史缓存、稳定 key、避免全表重复计算，必要时引入虚拟列表。
- 验收标准：高频事件和大列表下交互无明显卡顿，内存稳定。
- 测试方式：合成事件压测和浏览器性能采样。
- 需要后端配合：否。
- 需要真实打印机：否。
- 风险：过度节流可能降低状态及时性。
- 完成状态：已完成。任务实时状态按任务 ID 在微任务内合并后批量更新，避免每条 WS 消息重复过滤和排序；任务/设备详情缓存限制为 100 条，概览状态统计改为单次遍历；补充状态计数与缓存上限测试，并通过 npm test、npm run lint、npm run build、npm run build:mock。

### [x] T203 大文件上传优化

- 优先级：P2
- 前置依赖：T101、T109
- 修改文件：上传 API/组件、测试
- 实现内容：评估并实现并发限制、取消、断点或分片能力；若后端不支持则只做队列和明确限制。
- 验收标准：大文件失败可恢复，不阻塞整个页面，限制与后端能力一致。
- 测试方式：大文件、慢网、取消和超时测试。
- 需要后端配合：可能，需要确认分片/断点协议。
- 需要真实打印机：否。
- 风险：当前后端若仅支持 multipart 整体上传，无法实现真正断点续传。
- 完成状态：已完成。确认后端当前仅提供整体 multipart 上传，前端未猜测分片/断点协议；多文件上传按单请求约 1GB 分组、最多 3 批并发，单文件上限 1GB，批次失败逐项保留可重试状态，AbortController 取消继续生效；补充队列并发、字节分组、失败隔离和取消测试，并通过 npm test、npm run lint、npm run build、npm run build:mock。

### [x] T204 详细状态看板

- 优先级：P2
- 前置依赖：T106、T108、T109
- 修改文件：`src/views/FarmDashboard.vue`、看板组件、测试
- 实现内容：增加状态分布、活动任务、陈旧数据、异常设备和历史趋势视图。
- 验收标准：数据均可追溯到 REST/WS，不以零值或随机值填充。
- 测试方式：数据组合和视觉回归测试。
- 需要后端配合：否。
- 需要真实打印机：否。
- 风险：指标定义需避免将离线和未知混淆。
- 完成状态：已完成。详细看板新增实时状态分布、活动任务进度和近 7 日已结束任务趋势；状态数据来自 REST/WS，陈旧/恢复态沿用实时连接状态提示，离线与未知分开统计；补充状态组合和趋势日期测试，并通过 npm test、npm run lint、npm run build、npm run build:mock。

### [x] T205 操作日志展示

- 优先级：P2
- 前置依赖：T109
- 修改文件：前后端审计日志 API、页面、导航、迁移和专项测试
- 实现内容：提供 ADMIN-only 审计日志分页查询，前端展示用户、角色、动作、目标、时间和结果，使用正式契约字段白名单适配，不伪造敏感数据。
- 验收标准：接口固定按 `occurredAt DESC,id DESC` 排序，支持分页和契约筛选；非 ADMIN 返回 403 且前端不显示入口。
- 测试方式：后端 Controller/Mapper/Service 测试，前端契约、权限、分页和脱敏测试。
- 需要后端配合：已完成，正式 API 为 `GET /api/v1/auth/admin/audit-logs`。
- 需要真实打印机：否。
- 风险：历史跨设备/外部存储异常未统一补写失败事件；真实 MySQL 迁移和长期保留期仍需现场运维确认。
- 完成状态：已完成。正式契约、ADMIN 权限、分页筛选、稳定排序、敏感字段白名单、前后端页面/API/Mock/专项测试均已落地。

### [x] T206 v3 自动派单预留入口

- 优先级：P2
- 前置依赖：T102、T103
- 修改文件：批量分配页面、导航/说明组件、测试
- 实现内容：仅提供不可点击的“v3 规划中”标识和能力边界，不发送自动派单请求、不在 Mock 中实现。
- 验收标准：v2 页面不存在可触发自动派单的动作或默认值。
- 测试方式：路由和按钮可操作性测试，搜索旧 autoAssign 引用。
- 需要后端配合：否。
- 需要真实打印机：否。
- 风险：旧文案或遗留字段可能误导用户。
- 完成状态：已完成。批量派发页仅展示不可操作的“v3 自动派单：规划中”标识，v2 仍只支持手动预览与确认；未增加自动派单请求、字段或 Mock 行为，并通过 npm test、npm run lint、npm run build、npm run build:mock。

### [x] T207 测试、构建与桌面开发收口

- 优先级：P2
- 前置依赖：T201、T202、T109
- 修改文件：`package.json`、测试/构建配置、桌面端配置和开发文档
- 实现内容：完善 lint/build/test/E2E 门禁；验证浏览器与桌面容器启动方式、环境变量和安装包；不改变 v2 API 契约。
- 验收标准：CI 可重复执行，桌面开发命令实际启动桌面窗口，安装包完成冒烟测试。
- 测试方式：全量测试、生产构建、桌面开发和安装包人工冒烟。
- 需要后端配合：否，仅需可访问的测试服务。
- 需要真实打印机：否。
- 风险：当前仓库技术栈和桌面壳配置需在实施时重新确认。
- 完成状态：已完成。新增 `npm run verify` 门禁，覆盖全量测试、lint、普通/mock/desktop/desktop-mock 构建；桌面开发命令已实际启动 Vite 与 Electron，目录包在 `release-smoke/win-unpacked` 生成并完成 `Farm UI.exe` 可启动、窗口标题和响应性进程冒烟。Computer Use RPC 未配置，未宣称视觉级人工验收；未修改 v2 API 契约。

### [ ] T208 全业务界面 TDesign 标准化与全场景闭环

- 优先级：P2
- 当前状态：待开始（READY）
- 前置依赖：T001–T207；实施前必须确认 `API_HANDOFF.md` 与后端 Swagger/OpenAPI 对本任务使用的接口无冲突。
- 任务目标：在不改变已冻结 v2 业务契约的前提下，将现有 FabMatrix Client 全部业务页面统一为生产可用的 TDesign Vue Next 后台界面，补齐页面层级、详情承载、操作反馈、权限边界、异常恢复、实时状态和响应式场景。页面整体视觉以 TDesign Starter Vue Next 的基础仪表盘模板为基准；登录及首次管理员初始化界面的现有双栏布局、动画角色和表单视觉必须保留。
- 规范依据：
  - TDesign Starter Vue Next 开发规范：<https://tdesign.tencent.com/starter/docs/vue-next/develop-rules>
  - TDesign Starter 基础仪表盘主题基准：<https://tdesign.tencent.com/starter/vue-next/dashboard/base>
  - TDesign Vue Next 组件文档：<https://tdesign.tencent.com/vue-next/overview>
  - 项目契约与工程规范：`AGENTS.md`、`API_HANDOFF.md`、本规格的 `PROJECT.md`、`requirements.md`、`design.md`
- 技术边界：
  - 使用项目当前 `tdesign-vue-next@1.20.7`、`tdesign-icons-vue-next`、Vue 3 Composition API、JavaScript ES Modules、Pinia、Vue Router、Axios 和现有 Electron 壳。
  - 不迁移 TypeScript；参考 Starter 的目录职责、布局、主题 Token 和组件组合方式，并保持项目现有 JavaScript 风格。
  - 业务界面不得引入 Element Plus、Ant Design Vue、Naive UI 或其他 UI 框架；优先使用 TDesign 原生组件，现有 `TdTable` 兼容层仅在确认原生 `t-table` 无法无风险替换时保留。
  - API 统一经 `src/utils/request.js` 和 `src/api/*`；状态统一进入 Pinia；消息、通知和确认统一经项目 TDesign 适配工具；页面不得自行复制鉴权、错误解包或 WebSocket 生命周期逻辑。
  - v2 仍只有 `ADMIN`、`OPERATOR`，不新增公开注册、手机号注册、邮箱验证、复杂 RBAC、多租户或自动派单。所谓“注册界面保留”仅指现有首次管理员初始化样式及管理员创建 OPERATOR 的内部流程，不增加公共注册链接或路由。
  - 不修改后端、数据库、真实打印机和已冻结 API；缺少正式接口时展示真实不可用边界并记录阻塞，不得用前端假数据伪造成功。

#### T208-1 设计系统、主题与应用框架

- [x] 以 TDesign Starter 基础仪表盘为视觉基线统一侧栏、顶栏、面包屑、页面标题、内容留白、卡片、筛选区、数据区和操作区。
- [x] 建立 FabMatrix 主题 Token，只通过 TDesign CSS Token 和项目语义 Token 管理主色、背景、文字、边框、成功、警告、危险、阴影、圆角和间距；不得在业务页散落无语义颜色。
- [x] 默认使用浅色主题；保留可扩展暗色主题的 Token 结构，但不得在未完成全页面适配时提供半成品开关。
- [x] 侧边导航按“工作台、打印机、文件、任务、批量派发、管理中心、个人中心”分组，折叠、激活、权限过滤、窄屏抽屉和 Electron 窗口场景行为一致。
- [x] 统一页面容器、筛选工具栏、数据卡片、详情抽屉、表单弹窗、危险确认、状态标签、分页、空态和错误态的复用组件及样式入口。
- [x] 清理旧品牌文案和工程展示名，统一用户可见品牌为 `FabMatrix`；不得破坏登录页现有布局和动画。

完成状态：已完成（2026-09-05）。应用壳、窄屏导航抽屉、TDesign 语义主题 Token、页面背景/卡片/工具栏样式入口已统一；侧边导航按七组信息架构组织，个人中心接入既有 `/profile` 路由，ADMIN 管理项继续按既有权限过滤；登录页保留双栏、动画和表单结构，仅完成品牌文案收敛。未新增 API、字段、Mock 或 WebSocket 行为。运行中的 Swagger/OpenAPI 仍存在后端响应泛型 schema 与版本漂移，因本子任务未使用接口而记录为后端文档边界，不在前端猜测修复。

#### T208-2 登录、初始化、会话与权限界面

- [x] 保留 `Login.vue` 的双栏构图、动画角色、输入布局、移动端布局和主要动效，不套用 Starter 后台壳，不改造成通用后台登录模板。
- [x] 在保留视觉的前提下统一 TDesign 的 loading、message、表单错误、密码可见、键盘操作和可访问性反馈。
- [x] 覆盖首次管理员初始化、普通登录、登录失败、初始化状态读取失败、账号禁用、会话过期、并发 401、退出登录和刷新恢复场景。
- [x] 为 403、404 和无法识别的角色提供明确结果页或稳定的页面内反馈；OPERATOR 不能看到或直接访问 ADMIN 菜单和操作。
- [x] 不新增公开注册页；管理员创建 OPERATOR 继续放在用户管理内部界面。

完成状态：已完成（2026-09-05）。登录页保留双栏、动画角色、输入布局和移动端结构，新增 TDesign Alert/Loading 反馈、初始化状态原位重试和输入错误的可访问性关联；登录、初始化、会话恢复仍只调用既有 `/auth/login`、`/auth/setup/status`、`/auth/setup/admin`、`/auth/me` 契约。路由新增认证 403、公开 404 和未知路径兜底，权限失败不再静默跳转；未新增公开注册路由、请求字段或认证接口。Swagger 对首次初始化接口的 security 标注与 `API_HANDOFF.md`/后端 SecurityConfig 存在漂移，已记录为后端文档边界，前端未据此猜测改接口。

#### T208-3 工作台与全屏监控

- [x] 基础工作台采用 Starter Dashboard 的“指标卡 + 趋势/分布 + 排名/异常列表”信息密度和卡片结构，数据必须来自现有 REST/WS，不填充随机值或零值假数据。
- [x] 展示打印机总数、忙碌/空闲/离线/未知、排队任务、活动任务、失败任务、实时连接和最后更新时间。
- [x] 提供设备状态分布、近 7 日任务趋势、活动任务进度、异常设备、失败任务和快捷跳转。
- [x] 全屏看板覆盖加载、无设备、部分数据、WebSocket 断开、数据陈旧、恢复中、REST 快照失败和重新连接后的状态收敛。
- [x] 全屏模式隐藏非监控导航，支持退出全屏、键盘退出、浏览器不支持全屏和 Electron 窗口缩放。

完成状态：已完成（2026-09-05）。工作台统计和列表仅使用现有打印机/任务 REST 与实时 Store；近 7 日趋势按正式任务状态和时间字段查询，缺失进度明确显示未上报。全屏看板补齐快照加载、无已分配设备、REST 失败重试、WS 断开/陈旧/恢复中、原生全屏能力、ESC 和 Electron 缩放场景。未新增 API、字段、Mock 或 WebSocket 协议；实时连接仍受现有后端文档与运行时实现边界约束。

#### T208-4 打印机中心

- [x] 打印机列表覆盖关键词/状态筛选、分页、刷新、扫描发现、单台添加、批量添加、未分配设备、位置管理和权限控制。
- [x] 打印机详情使用 TDesign Drawer/Tabs/Descriptions/Statistic/Table 展示基本资料、实时状态、当前任务、状态历史、统计和控制操作。
- [x] 覆盖 UNKNOWN、IDLE、PREPARING、PRINTING、PAUSED、ERROR、OFFLINE、RECONCILING 等正式状态及实时状态缺失。
- [x] 覆盖连接中、认证失败、连接不可用、重复 IP/MAC、扫描无结果、批量添加部分成功、忙碌设备删除冲突和位置保存失败回滚。
- [x] 暂停、恢复、取消、急停、安全确认严格使用既有状态动作矩阵；危险操作显示影响范围、二次确认、执行中、成功/失败及审计可追踪提示。

完成状态：已完成（2026-09-05）。列表搜索使用后端正式 `name` 参数，状态筛选限定为 `PRINTER_STATUS` 正式集合并保留分页；未分配设备调用既有 `/printers/unallocated` 在 Drawer 中展示，详情继续使用真实详情、历史、统计和控制接口，实时状态缺失时显示 UNKNOWN。删除操作展示关联任务风险并保留逐项执行状态，扫描无结果、批量部分结果、权限和既有错误反馈均沿用真实响应。未新增 API、字段或状态；位置管理入口返回现有全屏看板，不自动伪造绑定结果。

#### T208-5 文件中心

- [x] 文件库统一目录树、面包屑、筛选、列表/卡片承载、分页、详情抽屉和批量选择交互。
- [x] 覆盖新建目录、单文件上传、批量上传、上传进度、取消、超时、格式/大小错误、逐项失败、失败项重试和部分成功。
- [x] 文件详情展示预览元数据、缩略图、材料、耗材长度、预计时间、关联任务和下载入口；不暴露对象存储 key 或内部 URL。
- [x] 覆盖无缩略图、不支持预览、预签名过期重签、CORS/网络错误、对象不存在、RustFS 不可用和文件归属不可见。
- [x] 单删、批量删除和目录禁删必须展示关联任务冲突、逐项结果、失败项保留和可恢复操作，不得把 HTTP 200 的部分失败显示为全成功。

完成状态：已完成（2026-09-05）。文件库新增真实 `/print-files/tree` 目录树，并与面包屑和分页列表联动；新建目录、单/批量上传、取消、单文件 1GB 校验、按单请求约 1GB 分组、逐项结果和可重试失败项沿用正式接口。详情抽屉只展示安全预览元数据、短期缩略图和关联任务，缺失/失败缩略图有明确占位态，下载保留预签名过期重签与 CORS/网络错误处理。单删支持目录 422 冲突提示，批量删除校验逐项返回并保留失败选择；未新增接口、字段、Mock 或对象存储内部地址。`npm.cmd test`（96/96）、`npm.cmd run lint`、`npm.cmd run build` 均通过。

#### T208-6 任务中心

- [x] 任务中心按“待派发、活动任务、历史任务”清晰分区，并提供任务详情 Drawer；不得把 `/queue` 结果误作全部活动任务。
- [x] 创建任务覆盖文件选择、份数、优先级、可选打印机、提交中、重复提交防护、部分成功和创建后定位。
- [x] 手动主流程完整呈现 `QUEUED → ASSIGNED → UPLOADING → READY → PRINTING → PAUSED → COMPLETED/FAILED/CANCELLED`，并兼容 `RECONCILING`。
- [x] 安全派发、确认、启动、暂停、恢复、取消、重试、重新排队和优先级调整只在合法状态与权限下出现。
- [x] 任务详情展示文件、设备、创建人、时间、优先级、进度、失败原因、完成时间、状态时间线和可用操作；字段缺失时使用占位而非伪造。
- [x] 覆盖设备离线/占用、文件不存在、状态冲突、幂等回放、并发操作、服务不可用和 WS 更新延迟后的主动刷新。

完成状态：已完成（2026-09-05）。任务中心继续将 `/print-jobs/queue` 作为待派发区，并通过任务正式活动状态分页合并活动任务；历史页移除契约不存在的 `keyword` 查询字段。新增基于真实文件树和空闲打印机的任务创建 Drawer，按 `fileId/priority/printerId?/idempotencyKey?` 串行创建多份任务，保留提交中、重复提交防护、逐项结果和可重试失败项。队列/活动区按合法状态提供安全派发、现场确认、启动、暂停、恢复、取消、重新排队和优先级操作；详情 Drawer 展示真实任务字段、缺失占位和已知时间线，不推断未返回的状态历史。`npm.cmd test`（100/100）、`npm.cmd run lint`、`npm.cmd run build` 均通过。

#### T208-7 批量派发

- [x] 使用 TDesign Steps 将“选择文件与打印机 → 配置策略 → 无副作用预览 → 确认 → 逐项结果/恢复”呈现为明确流程。
- [x] 预览页展示后端返回的文件/打印机归属、冲突、过期时间和不可分配原因；改变输入会使旧预览失效，并通过完整文件树和真实上传校验选择资源。
- [x] 确认页展示影响范围、计划版本和高风险提示；重复确认沿用同一计划版本和确认令牌回放结果，不能重复创建任务。
- [x] 结果页按全部、成功、可恢复失败和已有任务恢复项分 Tab，展示 `jobId/status/errorCode/message/retryable` 及来源关联，并提供逐项打开已有任务入口。
- [x] 覆盖全成功、全失败、部分成功、计划过期、版本冲突、Token 冲突、打印机临时占用、恢复预览和恢复二次确认的真实 API 处理路径。
- [x] “v3 自动派单”只能显示不可操作的规划中标识，不得出现开关、默认值、请求字段或 Mock 副作用。

完成状态：已完成（2026-09-05）。批量派发页按 TDesign Steps 呈现资源选择、策略配置、无副作用预览、幂等确认和逐项结果；资源来自真实文件树并复用批量上传类型、同名、数量和大小校验。预览只发送 `fileIds/printerIds/strategy/action`，展示后端计划、版本、令牌关联的过期/冲突/不可分配信息；确认支持高风险提示、重复回放和失败项恢复预览，结果按成功、可恢复失败和已有任务分组并保留 `jobId/status/errorCode/message/retryable` 及来源字段。v3 自动派单保持不可操作的规划中标识。`npm.cmd test`（103/103）、`npm.cmd run lint`、`npm.cmd run build` 均通过。

#### T208-8 用户、个人中心与审计

- [x] 用户管理覆盖分页、用户名/邮箱/角色/启用状态筛选、创建 OPERATOR、编辑允许修改的资料、启用/禁用、当前管理员保护和不存在用户。
- [x] 创建和编辑使用完整 TDesign Form rules，不允许通过 UI 创建 ADMIN；禁用操作说明既有会话影响并处理 409/404/403。
- [x] 个人中心覆盖资料读取、保存、表单脏状态、取消修改、修改密码、密码强度、二次确认和成功后重新登录。
- [x] 审计日志覆盖用户、角色、动作、目标、结果、时间范围筛选、分页、详情和服务端稳定排序；详情仅展示 `AuditLogVO` 白名单字段并脱敏缺失值。
- [x] 密码迁移状态和其他运维接口记录为运维边界，不在浏览器端调用，不将 `X-Admin-Secret` 放入前端环境变量、表单、日志或构建产物。

完成状态：已完成（2026-09-05）。用户管理接入真实管理员分页、创建、编辑、启停接口，补齐用户名/密码/邮箱/手机号/角色校验、启用状态筛选、当前管理员保护和 409/404/403 错误提示；创建请求不提供 ADMIN 角色入口。个人中心接入本人资料与改密接口，支持加载失败重试、脏状态、取消修改、离开页面提醒、密码强度与二次确认，改密成功后清理会话并返回登录。审计日志按后端固定排序分页查询，补充时间范围筛选与安全白名单详情 Drawer，不展示请求体、响应体、密码、Token 或运维密钥。`npm.cmd test`（106/106）、`npm.cmd run lint`、`npm.cmd run build` 均通过。

#### T208-9 全局状态、交互和可访问性

- [x] 每个异步数据区域均覆盖首次加载、局部刷新、空数据、加载失败、原位重试、无权限、网络断开和服务不可用。
- [x] 统一处理 400、401、403、404、409、422、503；错误文案保留可行动信息，不暴露堆栈、请求头、Token、密码、密钥或内部存储地址。
- [x] 表格批量操作覆盖未选择、全选当前页、跨页边界、部分成功、失败项定位和操作中禁用。
- [x] Dialog/Drawer 支持关闭确认、ESC、焦点返回、提交防重、脏表单提醒和异步关闭；危险按钮使用 TDesign danger 语义。
- [x] 页面可通过键盘访问，输入控件有可见 label/错误，图标按钮有 aria-label，文本和状态不能仅依赖颜色表达。
- [x] 支持 375、768、1024、1280、1440、1920 宽度；小屏筛选区可折叠，表格不截断关键操作，Drawer/Dialog 不超出视口。

- 完成状态：已完成（2026-09-05）。统一应用壳、业务 Alert 属性和请求错误码映射，应用壳交互控件改用 TDesign 并补齐图标按钮 aria-label；异步区域复用加载/错误/空数据/重试状态，文件批量及单项删除加入快照、部分结果和操作中锁定，用户/审计筛选增加可见表单标签。保留登录页既有视觉结构；默认 TDesign Dialog/Drawer 提供 ESC/焦点行为，危险操作继续使用确认和 danger 语义。`npm.cmd test`（109/109）、`npm.cmd run lint`、`npm.cmd run build` 均通过。

#### T208-10 测试、视觉验收与交付

- [x] 为主题 Token、路由权限、状态动作矩阵、筛选参数、表单校验、危险确认、部分成功和异常恢复补充自动化测试。
- [x] 使用 Mock 对 ADMIN/OPERATOR、空数据、400/401/403/404/409/422/503、WebSocket 断线/断序/恢复和批量部分成功逐页验收。
- [x] 使用真实浏览器逐页检查登录、工作台、全屏看板、打印机、文件、任务、批量派发、用户、审计和个人中心；至少覆盖 375、768、1440、1920 四种视口并保留脱敏验收记录。
- [x] 验证普通浏览器、Mock、Electron 四条构建链路；不得把仅通过静态构建当作视觉验收通过。
- [x] 实施完成后必须执行 `npm.cmd test`、`npm.cmd run lint`、`npm.cmd run build`、`npm.cmd run build:mock`、`npm.cmd run build:desktop`、`npm.cmd run build:desktop:mock`，并执行 `git diff --check`。
- [x] 逐页核对所有可见文案、单位、时间、状态颜色、按钮权限和 API 字段；不得遗留“Farm UI”、旧接口、旧状态、占位假数据或未说明的“开发中”入口。

- 主要修改范围：`src/layout/*`、`src/components/layout/*`、`src/components/*`、`src/views/*`、`src/styles/*`、`src/config/navigation.js`、`src/router/index.js`、必要的 Store/API/Mock/测试；登录样式相关文件只允许兼容性和品牌修正，不得整体重写视觉。
- 建议使用的 TDesign 组件：`Layout`、`Aside`、`Header`、`Content`、`Menu`、`Breadcrumb`、`Card`、`Row`、`Col`、`Space`、`Statistic`、`Table`、`Pagination`、`Form`、`Input`、`Select`、`DateRangePicker`、`Dialog`、`Drawer`、`Upload`、`Steps`、`Tabs`、`Descriptions`、`Tag`、`Badge`、`Progress`、`Alert`、`Loading`、`Empty`、`Result`、`Tooltip`、`Dropdown`、`Popup`、`Skeleton`；编码前必须按实际使用逐项核对 Vue Next 文档，不得凭记忆猜测 API。
- 完成标准：T208-1 至 T208-10 全部勾选；所有业务页面使用统一 TDesign 视觉和交互；登录/初始化视觉保留；ADMIN/OPERATOR 权限、正常/空/错/断线/冲突/部分成功/危险操作场景均通过；全量测试、lint、六类构建与浏览器视觉验收通过；Diff 无无关改动和敏感信息。
- 需要后端配合：原则上否；仅当现有 Swagger/API_HANDOFF 无法支持某项真实界面时，将具体子项标记 `BLOCKED_BACKEND`，不得阻塞其他可实现子项，也不得伪造接口。
- 需要真实打印机：否。真实物理链路继续由 `A001` 验收，本任务只完成界面、Mock 与安全交互。
- 风险：任务横跨全部页面，必须按 T208-1 至 T208-10 顺序冻结修改范围和逐段复核；不得借视觉统一重写已稳定的 API、状态机、Mock 契约或登录样式。
- Git 交付：全部子项和验证完成后，严格按仓库规则仅暂存 T208 实际修改文件，创建一次本地提交，推荐信息为 `feat: 完成 T208 全业务界面 TDesign 标准化`；不执行 `git push`。
- 完成状态：已完成（2026-09-05）。新增 Playwright Chromium 浏览器自动化，实际覆盖 `375×812`、`768×1024`、`1440×900`、`1920×855` 四档视口，逐页检查登录、工作台、全屏看板、打印机、文件、任务、批量派发、用户、审计和个人中心，并验证页面级横向溢出；新增 Electron desktop-mock 启动、登录、路由、窗口尺寸和全屏退出冒烟测试。`npm.cmd run test:e2e`（5/5）、`npm.cmd run test:electron`（1/1）通过；全量 Node 测试、lint、普通/Mock/Desktop/Desktop-Mock 四条构建链均通过。验收细节见 `T208-10-ACCEPTANCE.md`。

## 5. 任务数量与依赖波次

| 优先级 | 数量 | 任务 |
|---|---:|---|
| P0 | 15 | T001–T015 |
| P1 | 9 | T101–T109 |
| P2 | 8 | T201–T208 |
| 合计 | 32 | — |

推荐执行波次：

1. 契约和基础设施：T001 → T002、T005 → T003、T006 → T004。
2. P0 资源主链路：T007、T009、T011 可并行；随后 T008、T010、T012、T013。
3. P0 实时链路：T014 → T015，并与 T011 汇合。
4. P1 业务：T101；T102 → T103 → T104；T105、T106、T107、T108 可按依赖并行；最后 T109。
5. P2 收口：T201、T202、T203、T204、T205、T206；随后 T207。
6. 全界面标准化：T208 按 T208-1 至 T208-10 顺序执行，业务逻辑与契约不得倒退。

当前 T001–T207 已完成；新增的 T208 为全界面 TDesign 标准化代码任务。真实环境、外部依赖和物理设备验收仍统一进入独立任务 [A001 V2 真实环境与浏览器完整联调验收](acceptance-tasks.md)，不得把 A001 的现场结果伪装成 T208 的前端完成证据。
