# Farm UI v2 需求与验收标准

> 历史范围说明：本文早期的固定网格与旧位置接口方案已被 SYNC-002 动态布局契约取代。当前布局以服务端 `GET/PUT /api/v1/dashboard-layout` 为准；旧 `PUT /api/v1/printers/positions` 仅保留 ADMIN 废弃兼容入口，并使用同一原子事务语义。

## 1. 约定

- `系统` 指 Farm 前端。
- `服务端` 指 `D:\WorkSpace\Java\Farm` 当前实现。
- 所有成功 REST 响应均为 `{ code: 200, message, data, timestamp }`。
- 所有分页数据均为 `{ records, total, pageNum, pageSize, pages }`。
- 角色只允许 `ADMIN`、`OPERATOR`。
- “无权访问的用户私有资源”按后端当前规则表现为 404，避免泄露资源是否存在。
- 所有设备写操作都必须由用户明确触发，本需求不包含后台自动派单。

## 2. 认证和首次管理员初始化

### R-AUTH-01 首次初始化状态

- 前置条件：浏览器没有有效登录态，服务端允许 Local Edition 首次初始化。
- 操作：打开登录页，系统调用 `GET /api/v1/auth/setup/status`。
- 预期结果：`setupAvailable=true` 时显示首次管理员表单；`initialized=true` 或 `setupAvailable=false` 时显示普通登录；查询失败时保留可用的登录入口并显示非阻塞错误状态。

### R-AUTH-02 创建首次管理员

- 前置条件：初始化状态允许创建管理员。
- 操作：输入符合规则的 `username/password/confirmPassword` 并提交 `POST /api/v1/auth/setup/admin`。
- 预期结果：成功后直接保存返回的 Token 和 ADMIN 身份并进入系统；重复初始化的 409 提示重新进入登录；不出现公开注册入口。

### R-AUTH-03 登录

- 前置条件：系统已经初始化，账号存在且未禁用。
- 操作：输入 3-20 位用户名和 7-20 位密码，提交 `POST /api/v1/auth/login`。
- 预期结果：前端按 7-20 位长度规则校验密码，不要求大小写或数字；成功保存 `token/expiresIn/userId/username/role`；401、403、503 分别显示账号凭据、禁用或依赖服务提示。

### R-AUTH-04 Token 保存、恢复和过期

- 前置条件：用户曾选择会话保存或“记住我”。
- 操作：刷新或重新打开客户端。
- 预期结果：系统先读取本地会话，再用 `GET /api/v1/auth/me` 校验并刷新用户资料；过期、无效、未知角色或被禁用时清理全部登录态、断开 WebSocket 并返回登录页；不得只相信本地保存的角色。

### R-AUTH-05 退出登录

- 前置条件：用户已登录，可能存在 WebSocket 连接。
- 操作：确认退出。
- 预期结果：清除 sessionStorage/localStorage 中的会话、内存用户状态和实时连接；无需调用不存在的服务端 logout；跳转登录页。

## 3. 权限和路由

### R-PERM-01 页面权限

- 前置条件：用户身份已通过 `/auth/me` 校验。
- 操作：访问任意受保护路由。
- 预期结果：未登录用户跳转登录；ADMIN/OPERATOR 均可访问看板、打印机查看、文件和任务；只有 ADMIN 可访问用户管理；未知角色不能进入受保护路由且不会产生重定向循环。

### R-PERM-02 操作权限

- 前置条件：用户位于打印机、用户、文件或任务页面。
- 操作：页面渲染操作按钮。
- 预期结果：新增/编辑/删除/扫描打印机及位置维护只对 ADMIN 显示；暂停、恢复、取消、急停按后端规则对 ADMIN/OPERATOR 显示；用户管理只对 ADMIN 显示；前端 403 后保持上下文并提示无权限。

### R-PERM-03 资源归属

- 前置条件：OPERATOR 请求文件或任务数据。
- 操作：分页、详情、下载、删除或控制资源。
- 预期结果：前端不发送其他用户 ID 绕过隔离；404 统一显示“资源不存在或无权访问”；ADMIN 可使用明确的用户筛选查看全部资源。

## 4. 用户管理

### R-USER-01 用户列表

- 前置条件：ADMIN 已登录。
- 操作：按 `username/role/email/pageNum/pageSize` 查询 `GET /api/v1/auth/admin/users`。
- 预期结果：展示脱敏 UserVO；不读取密码；分页字段正确；启用状态只有在后端正式返回可判定字段后才展示，不得由缺失值推断。

### R-USER-02 创建操作员

- 前置条件：ADMIN 位于用户管理页面。
- 操作：填写 `username/password/confirmPassword/email?/phone?`，调用 `POST /api/v1/auth/admin/users`。
- 预期结果：前端只创建 OPERATOR，不提供创建 ADMIN 的误导选项；密码规则与后端一致；冲突和参数错误可定位到表单字段。

### R-USER-03 更新、禁用和启用

- 前置条件：ADMIN 已获取目标用户及可判定的禁用状态。
- 操作：调用更新、`disable` 或 `enable` 接口。
- 预期结果：不允许禁用当前账号；成功后刷新列表；失败不乐观修改；如果后端没有状态字段，界面使用明确的单向操作或等待契约补齐。

### R-USER-04 个人资料和密码

- 前置条件：用户已登录。
- 操作：通过当前用户资料入口读取资料、更新资料或修改密码。
- 预期结果：读取优先使用 `/auth/me`；更新成功后同步内存和持久化会话；密码修改成功后清除会话并要求重新登录。

## 5. 打印机管理

### R-PRINTER-01 列表、搜索和状态

- 前置条件：ADMIN 或 OPERATOR 已登录。
- 操作：使用 `GET /api/v1/printers/page` 按 `name/status/pageNum/pageSize` 查询。
- 预期结果：展示 `PrinterVO`，分页正确；完整识别 `OFFLINE/IDLE/PREPARING/PRINTING/PAUSED/ERROR/UNKNOWN`；`ONLINE` 不作为持久化状态。

### R-PRINTER-02 详情

- 前置条件：打印机列表已有记录。
- 操作：打开打印机详情并调用 `GET /api/v1/printers/{id}`。
- 预期结果：分别展示 `printer/realtimeStatus/currentJob`；缓存未命中或无任务时允许 null；不得用列表行拼出伪详情或显示虚构温度。

### R-PRINTER-03 ADMIN 维护

- 前置条件：ADMIN 位于打印机管理页。
- 操作：新增、编辑或删除打印机。
- 预期结果：字段符合 PrinterAddDTO/PrinterUpdateDTO；编辑时空 `apiKey` 表示保留；新增/重新录入状态按 `UNKNOWN` 展示；删除忙碌设备的冲突不会从列表移除。

### R-PRINTER-04 扫描和批量添加

- 前置条件：ADMIN 输入合法三段 IPv4 网段。
- 操作：扫描并选择设备批量添加。
- 预期结果：保留每项 `ipAddress/macAddress/firmwareType/apiKey?`；RRF 不会被默认为 KLIPPER；展示 `totalCount/insertedCount/updatedCount/failedCount/items` 的逐项结果。

### R-PRINTER-05 位置

- 前置条件：ADMIN 进入网格编辑模式。
- 操作：在动态布局草稿中绑定、移动、交换或下架设备，并通过 `PUT /api/v1/dashboard-layout` 一次提交布局与位置变化。
- 预期结果：行范围 `1–30`、列范围 `1–60` 且总槽位不超过 `1800`；默认值是 4×12、物理第 7 列后纵向过道，不是固定上限。未知设备、重复目标、越界或占位冲突均整体失败并保持服务端原状；OPERATOR 不能进入编辑模式。旧 positions 接口仅供 ADMIN 兼容旧客户端，不允许部分成功。

### R-PRINTER-06 历史和统计

- 前置条件：打印机存在。
- 操作：查询历史分页和时间范围统计。
- 预期结果：历史按 `recordedAt` 倒序；统计字段和秒单位正确；`from > to` 显示参数错误；空数据与加载失败分开呈现。

## 6. 文件库

### R-FILE-01 分页、搜索和目录

- 前置条件：用户已登录。
- 操作：按 `fileName/materialType/userId?/parentId/pageNum/pageSize` 查询或加载 `/tree`。
- 预期结果：文件搜索只发送 `fileName`；使用 `folder` 布尔字段；目录导航、分页、搜索结果和树结构一致；不依赖 `isFolder`。

### R-FILE-02 单文件上传

- 前置条件：用户选择后端配置允许的文件，大小未超限。
- 操作：以 multipart `file` 和可选 `parentId` 上传。
- 预期结果：显示进度、取消和重试；400 显示具体校验原因；503/5003 显示存储不可用；成功后只刷新当前目录。

### R-FILE-03 批量上传

- 前置条件：用户选择 1-100 个文件，每个文件不超过 1GB；客户端按单请求约 1GB 自动分组，不设置批量总量阻断。
- 操作：以重复字段 `files` 和可选 `parentId` 调用 `/batch-upload`。
- 预期结果：展示每个 `index/fileId/fileName/status/errorCode/message/retryable`；只重试 `retryable=true` 的失败项；部分失败不能显示为全部成功；Mock 行为相同。

### R-FILE-04 预览和缩略图

- 前置条件：用户可访问普通文件。
- 操作：请求 `/preview` 和 `/thumbnail`。
- 预期结果：预览只展示安全元数据；缩略图 data=null 显示占位图；预签名 URL 过期时重新请求一次；不读取存储 key 或原始 G-code。

### R-FILE-05 下载

- 前置条件：用户可访问普通文件。
- 操作：请求 `/download` 获取预签名 URL 后下载。
- 预期结果：URL 过期时丢弃旧 URL、重新签发并仅重试一次；5003 显示存储错误；弹窗拦截或 CORS 回退不伪报成功。

### R-FILE-06 删除

- 前置条件：用户选择文件或批量文件。
- 操作：确认后调用单删或批量删除。
- 预期结果：关联任务的 409 不重试；目录不允许使用文件删除接口；批量删除展示逐项成功/失败；失败项保留在列表。

### R-FILE-07 文件关联任务

- 前置条件：文件存在且用户可访问。
- 操作：打开关联任务并调用 `GET /api/v1/print-files/{id}/jobs`。
- 预期结果：按真实分页展示 PrintJobVO；OPERATOR 只见自己的任务；无权访问按 404 处理。

## 7. 单任务手动操作

### R-JOB-01 创建任务

- 前置条件：用户选择自己可访问的普通文件。
- 操作：提交 `fileId/priority/printerId?/idempotencyKey?` 到 `POST /api/v1/print-jobs`。
- 预期结果：不指定打印机时为 `QUEUED`；指定空闲打印机时为 `ASSIGNED` 且仍需安全确认；返回 data 是任务 ID；复制任务与指定同一打印机不能并发造成部分成功却提示全部成功。

### R-JOB-02 手动派发

- 前置条件：任务为 `QUEUED`，打印机为 `IDLE` 且无 `currentJobId`。
- 操作：调用 `/safe/assign`。
- 预期结果：任务进入 `ASSIGNED`、打印机被绑定且安全标记为 false；409/10002 提示刷新可用打印机；任务仍能在活动任务界面继续操作。

### R-JOB-03 安全确认和启动

- 前置条件：任务为 `ASSIGNED` 或 `READY`，打印机已绑定。
- 操作：当前登录用户先确认安全，再选择 `START_PRINT` 或 `UPLOAD_ONLY`。
- 预期结果：不发送前端 operatorId；上传阶段显示 `UPLOADING`；`UPLOAD_ONLY` 最终为 `READY`，`START_PRINT` 最终为 `PRINTING`；任何一步失败均不显示成功。

### R-JOB-04 控制

- 前置条件：任务和打印机处于允许状态。
- 操作：用户明确执行暂停、恢复、取消或急停。
- 预期结果：按钮按状态禁用并二次确认危险操作；422 显示状态不允许；10001/5004 显示设备问题；急停后的任务显示 `RECONCILING`，不伪造为已取消或失败。

### R-JOB-05 重试、重新排队和优先级

- 前置条件：任务分别处于 `FAILED`、`ASSIGNED/READY`、`QUEUED`。
- 操作：调用 retry、requeue 或 priority 接口。
- 预期结果：状态和字段按后端规则更新；非法状态返回 422；列表依据 REST 刷新，因为无 printerId 的队列任务不会收到 JOB_STATUS。

## 8. 队列、活动任务和历史

### R-LIST-01 排队列表

- 前置条件：存在 `QUEUED` 任务。
- 操作：调用 `GET /api/v1/print-jobs/queue`。
- 预期结果：页面只把它当作待派发队列，按优先级和创建时间展示；不假定该接口包含 ASSIGNED、READY 或 PAUSED。

### R-LIST-02 活动任务

- 前置条件：任务已派发、上传、打印、暂停或等待核对。
- 操作：通过任务分页/详情和任务 Store 查看。
- 预期结果：用户可继续安全确认、启动或控制；派发后不会因离开 QUEUED 队列而丢失操作入口。

### R-LIST-03 任务详情和历史

- 前置条件：用户打开任务详情或历史。
- 操作：调用任务详情/分页，按状态、打印机、用户和时间筛选。
- 预期结果：字段以 PrintJobVO 为准；结束时间使用 `completedAt`；需要文件或打印机摘要时组合调用对应详情；加载、空、错误分开显示。

## 9. 批量分配预览和确认

### R-BATCH-01 入口和资源选择

- 前置条件：用户已登录并有可访问文件及共享打印机。
- 操作：从任务导航进入批量分配，选择 1-100 个文件和打印机。
- 预期结果：入口可发现；只选择普通文件；显示设备当前状态和占用；不提供后台自动派单开关。

### R-BATCH-02 无副作用预览

- 前置条件：已选择资源、策略和动作。
- 操作：调用 `/batch/preview`。
- 预期结果：展示 planId、version、action、过期时间、确认令牌对应的计划、items 和 conflicts；预览不创建任务、不占设备、不调用设备写接口。

### R-BATCH-03 确认

- 前置条件：预览未过期且用户明确确认可执行项。
- 操作：提交 `planId/version/itemIds/confirmationToken`。
- 预期结果：展示计划状态、repeated 和每项 jobId/status/reasonCode/message/attemptCount/retryable；部分失败不丢失成功项；409 要求重新预览；403 确认令牌错误不重试。

### R-BATCH-04 失败项处理

- 前置条件：确认结果含 `RETRYABLE` 或 `FAILED`。
- 操作：用户选择处理失败项。
- 预期结果：在后端冻结直接重试契约前，前端以失败项资源重新生成预览；不得假设重复调用已完成计划会执行重试；永久失败与可重试项分开显示。

## 10. WebSocket 实时状态

### R-WS-01 鉴权连接

- 前置条件：存在经 `/auth/me` 校验的 Token。
- 操作：连接 `/ws/farm-status?token=<JWT>`。
- 预期结果：未登录不连接；关闭码 1008 或鉴权失败触发一次身份复核；不使用旧 `/ws`；Token 不写日志。

### R-WS-02 协议解析

- 前置条件：收到业务消息。
- 操作：校验 `version/type/eventId/sequence/printerId/timestamp/data`。
- 预期结果：只处理 version=1 和五种冻结类型（含 LAYOUT_UPDATED）；未知版本标记数据陈旧并回退 REST；重复 eventId 或乱序事件不重复应用。

### R-WS-03 快照和增量

- 前置条件：连接成功。
- 操作：接收 `SNAPSHOT.data.printers`、PRINTER_STATUS、PRINTER_OFFLINE、JOB_STATUS。
- 预期结果：快照正确读取 PrinterVO 的 `status`；增量不覆盖静态配置；离线和失败产生可去重告警；JOB_STATUS 同步任务 Store 和设备绑定摘要。

### R-WS-04 重连和恢复

- 前置条件：连接断开、服务端重启或 sequence 断档。
- 操作：指数退避重连并恢复。
- 预期结果：每次新连接不沿用旧 sequence 连续性；重新取得 REST/服务端 SNAPSHOT；恢复期间显示“数据可能不是最新”；组件销毁和退出登录清理所有定时器。

### R-WS-05 心跳

- 前置条件：服务端每 30 秒发送 WebSocket 协议级 Ping。
- 操作：浏览器保持连接。
- 预期结果：依赖浏览器自动 Pong，不发送服务端未定义的文本 `ping`，也不等待文本 `pong`；心跳判断不会把正常连接误关为手动关闭。

## 11. 错误、加载、空状态和异常状态

### R-ERR-01 统一错误映射

- 前置条件：任意请求失败。
- 操作：请求层解析 HTTP 状态和业务 code。
- 预期结果：400、401、403、404、409、422、503 及 10001、10002、5001-5004 映射为稳定提示；保留后端具体 message；同一错误不由拦截器和页面重复弹两次。

### R-ERR-02 页面状态

- 前置条件：页面正在加载、没有数据、无权限、网络断开或服务维护。
- 操作：用户打开列表或详情。
- 预期结果：加载骨架、真实空状态、可重试错误、403、离线和 503 分开显示；失败时不清空已有可用上下文，除非服务端确认资源不存在。

### R-ERR-03 CORS 和文件错误

- 前置条件：浏览器跨域请求 API 或对象存储 URL。
- 操作：发生预检、下载或上传错误。
- 预期结果：区分后端不可达、CORS、URL 过期、上传超限和存储服务失败；不把 CORS 失败统一解释为文件不存在。

## 12. Mock 和真实接口切换

### R-MOCK-01 同构切换

- 前置条件：分别以真实模式和 `VITE_USE_MOCK=true` 启动。
- 操作：执行相同 API 模块调用。
- 预期结果：业务组件无需分支；两种模式返回相同 envelope、分页、DTO 字段、状态和错误；生产构建禁止 Mock。

### R-MOCK-02 错误场景

- 前置条件：开发者选择 Mock 错误场景。
- 操作：触发 400、401、403、404、409、422、503。
- 预期结果：HTTP status、业务 code 和 message 与后端映射一致；另覆盖 10001、10002、5003、5004；场景可重复且互不污染。

### R-MOCK-03 状态流

- 前置条件：Mock 中创建并人工操作任务。
- 操作：派发、确认、上传、启动、暂停、恢复、完成/失败/取消。
- 预期结果：遵循 `QUEUED -> ASSIGNED -> UPLOADING -> READY -> PRINTING -> PAUSED/COMPLETED/FAILED/CANCELLED` 的合法分支；急停进入 RECONCILING；不模拟 v3 自动派单。

### R-MOCK-04 批量和 WebSocket

- 前置条件：Mock 模式。
- 操作：批量上传、预览、确认并接收实时事件。
- 预期结果：预览无副作用；确认逐项成功/失败；文件上传逐项返回；WebSocket 含 version/eventId/sequence、标准 SNAPSHOT 和状态事件；重置后恢复确定性种子。

## 13. 构建和测试

### R-TEST-01 自动化测试

- 前置条件：完成任一 P0/P1 Task。
- 操作：执行相关单元/组件/请求/路由测试。
- 预期结果：覆盖请求 envelope、Token 恢复、角色守卫、全部状态、Mock 契约、WebSocket 重连和关键按钮可用性；测试不连接真实打印机。

### R-TEST-02 构建验收

- 前置条件：准备合并任务。
- 操作：执行 `npm test`、`npm run lint`、`npm run build`；涉及桌面端时补充 `npm run build:desktop`。
- 预期结果：命令通过；lint 自动修复经过人工检查；构建产物不包含 Token、密码、API Key 或生产凭据。

### R-TEST-03 端到端验收

- 前置条件：P0 契约任务完成，后端测试环境可用但真实设备写操作关闭。
- 操作：先做 Mock E2E，再做真实后端只读与模拟设备链路。
- 预期结果：登录、上传、创建、派发、确认、启动模拟、状态同步的链路有可复现记录；真实打印机动作必须另行获得现场授权。
