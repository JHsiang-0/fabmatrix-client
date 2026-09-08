# Farm UI v2 设计与审计

## 1. 审计方法与可信度

本设计基于实际源码静态审计，不按文件名、旧页面文案或 TODO 勾选推断功能完成度。已核对：

- 后端交接/项目文档、全部 Controller、Service 接口和实现、DTO/VO/Entity、状态枚举、SecurityConfig、WebSocket 端点和事件发布器、OpenAPI 注解。
- 前端交接/TODO、package.json、全部 API、views、components、stores、router、request/dataAdapters/websocket、Mock 和测试。
- 前后端 `API_HANDOFF.md` 当前无内容差异。

状态定义：

- 已实现：地址、参数、返回、权限、页面与 Mock 的主要链路均可成立。
- 部分实现：已有 API 或 UI，但真实联调存在字段、状态、可达性、错误处理或 Mock 缺口。
- 未实现：前端没有调用/页面，或 Mock 没有对应路由。
- 调用错误：当前实现会稳定发送错误参数、读取不存在字段或错误模拟状态。

## 2. 推荐页面与组件结构

```text
src/
├─ views/
│  ├─ Login.vue                    初始化与登录
│  ├─ Dashboard.vue                汇总，只消费 Store 派生数据
│  ├─ PrinterManage.vue            打印机资产列表（ADMIN 写、双方读）
│  ├─ PrinterDetail.vue/drawer      配置、实时、当前任务、历史、统计
│  ├─ FileLibrary.vue              分页目录、上传、预览、下载、关联任务
│  ├─ JobQueue.vue                 只显示 QUEUED 待派发任务
│  ├─ ActiveJobs.vue               ASSIGNED/UPLOADING/READY/PRINTING/PAUSED/RECONCILING
│  ├─ JobHistory.vue               全量筛选与终态历史
│  ├─ BatchDispatch.vue            用户批量选择、预览、确认、逐项结果
│  ├─ UserManagement.vue           ADMIN 创建 OPERATOR 与状态管理
│  └─ Profile.vue                  当前用户资料与密码
├─ components/
│  ├─ common/AsyncState.vue         loading/empty/error/retry
│  ├─ printer/PrinterStatusTag.vue  持久化状态唯一映射
│  ├─ job/JobStatusTag.vue          任务状态唯一映射
│  ├─ job/JobActions.vue            合法动作矩阵
│  ├─ batch/BatchItemResult.vue     逐项结果和重试策略
│  └─ file/UploadItemResult.vue     上传逐项结果
└─ stores/
   ├─ user.js                       认证真值与会话生命周期
   ├─ printer/deviceStore.js        PrinterVO 静态资产
   ├─ printer/realtimeStore.js      实时覆盖、连接与陈旧状态
   ├─ job.js                        队列、活动任务、详情及 JOB_STATUS 合并
   └─ file.js（按需要）             目录上下文与上传队列
```

现有页面采用渐进迁移，不在单一 Task 内重写全部布局。`src/stores/printerStore.js.backup` 不进入运行时，也不修改。

## 3. API 模块划分

| 模块 | 目标职责 | 当前问题 | 设计决定 |
|---|---|---|---|
| `api/auth.js` 或现有 `api/user.js` | login/setup/me/profile/password | 缺 `/me`；旧 profile 路径为主 | 新增 `/me`，保留个人更新兼容路径；会话恢复只走 `/me` |
| `api/users.js` | ADMIN 用户分页、创建、更新、启停 | 创建参数错误，更新 API 未被页面使用 | 创建固定 OPERATOR 并发送 confirmPassword；禁用状态等待契约 |
| `api/printer.js` | 资产、详情、扫描、位置、历史、统计 | 缺详情/历史/统计；批量扫描字段丢失 | 增加查询方法，批量请求原样保留 firmwareType |
| `api/printerControl.js` | pause/resume/cancel/emergency-stop | 目前混在 printer.js | 可先保留文件，逻辑上隔离；统一动作错误模型 |
| `api/printFile.js` | 文件、目录、批量上传、预览、缩略图、下载 | 缺 tree/jobs；下载重签缺失 | 增加 tree/jobs；预签名 URL 统一 helper |
| `api/job.js` | 队列、分页、详情、创建、安全流、批量流 | 缺详情；旧 create 仍导出；JSDoc 旧字段 | 增加详情；旧接口放 compatibility 文件且业务不可导入 |
| `api/file.js` | 旧兼容门面 | 仍存在重复入口 | 迁移完引用后只保留短期兼容并加测试防新增引用 |

API 方法返回统一 envelope，不在页面同时兼容多种返回形态。只有数据适配层允许处理历史响应。

## 4. Store 状态划分

### 4.1 User Store

```text
anonymous -> restoring -> authenticated
          \-> expired/forbidden/error -> anonymous
authenticated --logout/401--> anonymous
```

保存 `token`、`expiresAt`、`user`、`restoreState`。启动时读取存储并调用 `/auth/me`；本地 role 只用于恢复中的占位，不作为最终授权依据。logout 统一触发实时 Store disconnect。

### 4.2 Printer Stores

- `deviceStore` 保存 PrinterVO 和分页元数据。
- `realtimeStore` 保存按 printerId 索引的实时覆盖字段、连接状态、`stale/recovering`、最后 eventId/sequence。
- 展示模型由 selector 合并静态 PrinterVO 与实时覆盖，不把 WebSocket 的设备原始状态写回持久化对象。
- 新连接、服务重启、版本未知或 sequence 断档时清除该连接的序列基线并恢复 REST/快照。

### 4.3 Job Store

- `queuedById`：只存 QUEUED。
- `activeById`：ASSIGNED、UPLOADING、READY、PRINTING、PAUSED、RECONCILING。
- `page`：历史分页结果。
- `detailsById`：PrintJobVO；文件/打印机摘要单独缓存。
- JOB_STATUS 只更新存在的任务；未知 jobId 标记列表需刷新，不凭事件构造缺字段完整任务。
- retry/requeue/priority 后主动刷新，因为无绑定打印机的任务不广播 JOB_STATUS。

## 5. 数据适配器与字段映射

### 5.1 统一响应和分页

- 请求层只接受 `code===200` 为成功，允许 `data=null`。
- 业务 code 与 HTTP status 分开保留为 `error.businessCode`、`error.httpStatus`。
- 分页以服务端 `pages` 为准；历史 `current/size` 兼容只留在临时适配器并记录移除条件。
- Long ID 在进入 Store 前转字符串；发送 Path/Body 时保持数字字符串，不做 Number 强转。

### 5.2 冻结映射

| 后端字段/状态 | 前端领域字段 | 当前偏差 | 处理 |
|---|---|---|---|
| `PrintFileVO.folder` | `folder` boolean | Mock 同时给 `isFolder` | Mock 删除旧字段；适配器短期只读兼容 |
| `PrintFileVO.estTime` 秒 | `estTime` 秒 | Mock 给 `estimatedSeconds` | 删除旧字段 |
| `filamentLength` 米 | `filamentLengthMeters` 或原字段米 | FileDetailDrawer 再除 1000 | 只格式化，不换算 |
| `completedAt` | `completedAt` | JobHistory 读取 `endedAt` | 页面改读 completedAt |
| `priority` 0-100 | number | 多处又使用 0/1/2、HIGH/NORMAL/LOW 文档 | 统一 0/50/100 UI 预设，允许任意 0-100 |
| PrinterVO `status` | 持久化设备状态 | Dashboard/颜色缺 PREPARING、UNKNOWN | 单一完整映射 |
| WS `data.unifiedState` | 实时设备状态 | 被转成 STANDBY/FAULT 等第二套枚举 | 保留设备领域状态；原始细粒度状态另存 `rawState` |
| SNAPSHOT printer `status` | 实时初始状态 | 当前解析器不读 status | 快照适配明确读取 `status` |
| PrintJobVO | 不嵌套摘要 | Mock 添加 fileName/printerName/materialType | Mock 删除；前端组合查询或显示 ID |
| LoginResult `expiresIn` 秒 | `expiresAt` 毫秒 | 当前未保存 | 登录时计算并恢复校验 |
| UserVO | 用户资料 | 前端依赖未定义 `enabled` | 契约确认前不得推断 |
| DTO camelCase | camelCase | Mock/历史兼容存在额外旧字段 | 新代码和 Mock 禁止 snake_case |

## 6. 权限控制设计

| 能力 | ADMIN | OPERATOR | 前端行为 |
|---|---:|---:|---|
| 看板、打印机列表/详情 | 是 | 是 | 共享路由 |
| 打印机新增/编辑/删除/扫描/位置 | 是 | 否 | 路由内按钮和动作双重约束 |
| 文件读写 | 全部 | 自己 | 不给 OPERATOR 发送任意 userId |
| 任务读写 | 全部 | 自己 | 404 不提示他人资源存在 |
| 暂停/恢复/取消/急停 | 是 | 是 | 按任务/设备状态启用 |
| 用户管理 | 是 | 否 | 路由 `roles:['ADMIN']` |
| 创建账号 | OPERATOR | 否 | UI 不提供创建 ADMIN |

路由进入前必须完成身份恢复。未知角色、损坏存储或 `/me` 失败都回到登录页。后端仍是最终权限边界。

## 7. WebSocket 状态同步设计

```text
已验证 Token
    ↓
连接 /ws/farm-status?token=...
    ↓
接收 version=1 SNAPSHOT ──→ 合并 PrinterVO.status
    ↓
记录本连接 sequence/eventId
    ↓
PRINTER_STATUS / PRINTER_OFFLINE / JOB_STATUS 增量
    ↓
断线、未知版本、sequence 断档
    ↓
标记 stale → 新连接重置序列基线 → REST/SNAPSHOT 恢复 → 清除 stale
```

服务端发送协议级 Ping，浏览器自动 Pong。前端不得发送文本 `ping` 或等待文本 `pong`。关闭码 1008 触发 `/auth/me` 校验；普通网络关闭才指数退避。Token、完整 WS URL 不写日志。

## 8. 任务状态机展示设计

| 状态 | 展示 | 允许的主要前端动作 |
|---|---|---|
| QUEUED | 等待分配 | 派发、改优先级、取消 |
| ASSIGNED | 已分配，待安全确认/上传 | 安全确认、重新排队、取消 |
| UPLOADING | 上传中 | 禁止重复动作，显示进行中 |
| READY | 已上传，待开始 | 启动、重新排队、取消 |
| PRINTING | 打印中 | 暂停、急停；常规取消按后端当前规则谨慎显示 |
| PAUSED | 已暂停 | 恢复、取消、急停 |
| RECONCILING | 待人工核对 | 禁止伪造终态，显示现场处理提示 |
| COMPLETED | 已完成 | 只读 |
| FAILED | 失败 | retry |
| CANCELLED | 已取消 | 只读 |

动作矩阵集中实现，页面不得各自复制状态判断。

## 9. 文件上传和批量上传设计

- 单文件使用独立 AbortController、30 分钟超时和进度。
- 批量上传使用重复 multipart 字段 `files`，保留原选择数组与 item.index 对应。
- 批量文件最多 100 个；客户端按单请求原始文件总量约 1GB 分组，服务端单请求上限约 1.2GB。
- 批量总请求成功不等于每项成功；结果列表显示状态、原因和重试按钮。
- 预签名资源 helper 接受“签发函数 + 消费函数”，401/403/410 或明确过期时重新签发一次，第二次失败终止。
- 文件详情统一使用后端单位：大小字节、时间秒、耗材长度米、温度摄氏度。
- 目录不调用文件删除；在后端无目录删除契约时隐藏/禁用该动作。

## 10. 批量预览确认设计

1. 资源选择仅加载当前用户可见普通文件和共享打印机。
2. `AUTO_MATCH` 文案为“本次智能匹配”，不出现自动派单开关。
3. Preview 保存 `planId/version/confirmationToken/expiresAt`，UI 倒计时并显示 conflicts。
4. Confirm 只提交用户勾选且 `canExecute=true` 的 itemId。
5. Confirm 逐项展示 `status/jobId/reasonCode/message/attemptCount/retryable`。
6. 重复确认显示 `repeated=true`，不再次提示“已新建”。
7. 当前后端不支持对 PARTIAL_FAILED 计划直接重执行；`retryable` 仅用于选择失败资源后重新 Preview，直至后端冻结独立重试契约。
8. `START_AFTER_CONFIRM` 只创建 ASSIGNED 任务，之后逐项进入安全确认，不允许批量直接启动。

## 11. Mock 设计

### 11.1 路由和响应

- 每个正式 API 都注册 method+path，未实现即测试失败。
- 所有返回经过统一 success/fail factory，包含 timestamp。
- 错误场景精确模拟：400/400、401/401、403/403、404/404、409/409、422/422、503/5003 或 5004，以及 10001/10002。
- 分页固定返回 `records/total/pageNum/pageSize/pages`。

### 11.2 数据安全

- 对外 Mock DTO 删除 password、safeName、fileUrl、rustfsKey、apiKey、isFolder、estimatedSeconds、endedAt 和人为嵌套摘要。
- 打印机新增默认为 UNKNOWN；扫描状态使用真实扫描 DTO 值，不作为 PrinterVO 持久化状态。
- OPERATOR 无权资源按真实服务规则返回 404，而不是 Mock 特有的 403。

### 11.3 状态与副作用

- 状态转换由一个 transition 表驱动，非法转换 422。
- Preview 只写计划快照，不创建 job、不占 printer。
- Confirm 重新校验打印机，逐项产生成功/失败/可重试结果。
- 创建任务带 printerId 时进入 ASSIGNED 并绑定；不带时进入 QUEUED。
- Mock WebSocket 使用 version=1、唯一 eventId、递增 sequence 和 `data.printers` 快照。

## 12. 错误处理设计

| 条件 | UI 行为 | 自动动作 |
|---|---|---|
| 400 | 显示后端字段/参数提示 | 不重试 |
| 401 | 显示登录过期 | 清会话、断 WS、去登录 |
| 403 | 保留页面上下文，提示无权限 | 不改本地数据 |
| 404 | 资源不存在或无权访问 | 详情可关闭，列表按需刷新 |
| 409 | 显示冲突和刷新建议 | 不自动重复写请求 |
| 422 | 显示当前状态不允许 | 刷新任务/打印机快照 |
| 503/5001-5004 | 显示依赖服务或设备不可用 | 仅只读查询可人工重试 |
| 10001 | 打印机离线 | 标记设备异常并保留任务 |
| 10002 | 打印机忙碌 | 刷新可用打印机 |

请求层负责一次全局提示或输出结构化错误，页面负责上下文提示；两者不可同时弹同一句错误。

## 13. 前后端接口差距清单

### 13.1 认证与用户

| 模块 | 后端接口方法 | 后端接口地址 | 当前前端调用地址 | 当前前端文件位置 | 当前状态 | 请求参数是否一致 | 返回结构是否一致 | 权限处理是否一致 | Mock 是否一致 | 前端需要修改的内容 | 优先级 | 联调风险 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 登录 | POST | `/api/v1/auth/login` | 相同 | `api/user.js`、`views/Login.vue` | 部分实现 | 否：登录 UI 多加复杂度规则 | 基本一致 | 基本一致 | 部分：无锁定/503准确场景 | 放宽登录校验，保存 expiresAt | P0 | 高：合法旧账号可能无法登录 |
| 初始化状态 | GET | `/api/v1/auth/setup/status` | 相同 | `api/user.js`、`views/Login.vue` | 部分实现 | 是 | 是 | 匿名一致 | 否：种子始终已有用户 | 增加未初始化 Mock 场景和异常态 | P0 | 中 |
| 首次 ADMIN | POST | `/api/v1/auth/setup/admin` | 相同 | 同上 | 部分实现 | 是 | 是 | 匿名一致 | 部分 | 冲突后切回登录，测试唯一创建 | P0 | 中 |
| 当前用户 | GET | `/api/v1/auth/me` | 无 | 无 | 未实现 | — | — | 否：恢复只信本地 role | 未实现 | 新增 API、启动恢复流程 | P0 | 高：过期/禁用/伪造角色 |
| 创建 OPERATOR | POST | `/api/v1/auth/admin/users` | 相同 | `api/user.js`、`views/UserManagement.vue` | 调用错误 | 否：缺 confirmPassword，UI 发送 role | data Long；API可处理 | 路由 ADMIN 正确 | 否：Mock 可创建 ADMIN | 固定 OPERATOR，补确认密码和校验 | P1 | 高：真实请求 400 |
| 兼容创建账号 | POST | `/api/v1/auth/register` | 相同但页面未用 | `api/user.js` | 部分实现 | 注释缺 confirmPassword | data Long，不应 normalizeUser 对象 | ADMIN 一致 | 基本 | 标记兼容，业务统一 admin/users | P2 | 低 |
| 用户分页 | GET | `/api/v1/auth/admin/users` | 相同 | `api/user.js`、`views/UserManagement.vue` | 部分实现 | 是 | 否：页面依赖不存在的 enabled | ADMIN 一致 | 否：Mock 额外 enabled | 等待禁用状态契约，修页面 | P1 | 高 |
| 用户更新 | PUT | `/api/v1/auth/admin/users/{id}` | 相同 | `api/user.js`，页面未用 | 部分实现 | API 可用，UI 未实现 | 是 | ADMIN 一致 | 否：Mock 还接受 password | 增加受限编辑或删除未用入口 | P1 | 中 |
| 禁用/启用 | POST | `/api/v1/auth/admin/users/{id}/disable|enable` | 相同 | `api/user.js`、`views/UserManagement.vue` | 部分实现 | 是 | 是 | ADMIN/禁止自禁用前端仅按钮处理 | 否：依赖 Mock enabled | 契约补齐后按真实状态操作 | P1 | 高 |
| 个人资料读取 | GET | `/api/v1/auth/me`（优先）；`/{id}/profile`兼容 | 只用旧 profile | `api/user.js`、`views/Profile.vue` | 部分实现 | 兼容路径一致 | 是 | 当前 ID 来自本地存储 | Mock 无 `/me` | 改用 `/me`，资料持久化 | P0 | 中 |
| 资料更新 | PUT | `/api/v1/auth/{id}/profile` | 相同 | 同上 | 部分实现 | 是 | 是 | 基本一致 | 部分：错误码/乱码 | 保存后更新持久化 session | P1 | 中 |
| 修改密码 | POST | `/api/v1/auth/{id}/change-password` | 相同 | 同上 | 部分实现 | 是 | 是 | 基本一致 | 部分 | 成功后强制本地退出 | P1 | 中 |
| 可用性检查 | GET | `/check-username`、`/check-email` | 无 | 无 | 未实现 | — | — | ADMIN-only 未体现 | 未实现 | 创建表单可选接入 | P2 | 低 |
| 密码运维 | GET/POST | `/admin/password-status`、`/admin/migrate-passwords` | 无 | 无 | 未实现/不纳入业务 UI | — | — | ADMIN+secret | 未实现 | 不进入 v2 普通 UI | P2 | 低 |

### 13.2 打印机与控制

| 模块 | 后端接口方法 | 后端接口地址 | 当前前端调用地址 | 当前前端文件位置 | 当前状态 | 请求参数是否一致 | 返回结构是否一致 | 权限处理是否一致 | Mock 是否一致 | 前端需要修改的内容 | 优先级 | 联调风险 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 列表 | GET | `/api/v1/printers/page` | 相同 | `api/printer.js`、多个 view/store | 部分实现 | 是 | 是 | 双角色读取一致 | 基本 | 完整状态映射，移除 ATTENTION 服务端伪筛选 | P0 | 中 |
| 详情 | GET | `/api/v1/printers/{id}` | 无 | 当前用列表行和零温度拼详情 | 未实现 | — | — | 双角色未问题 | 未实现 | 新增 API 和真实详情状态 | P0 | 高 |
| 状态历史 | GET | `/api/v1/printers/{id}/history` | 无 | 无 | 未实现 | — | — | — | 未实现 | 增加分页、时间、异常态 | P1 | 中 |
| 统计 | GET | `/api/v1/printers/{id}/statistics` | 无 | 无 | 未实现 | — | — | — | 未实现 | 增加统计卡片和单位 | P1 | 中 |
| 新增 | POST | `/api/v1/printers/add` | 相同 | `api/printer.js`、`PrinterManage.vue` | 部分实现 | 部分：表单字段少但合法 | data=null，前端误走 printer normalize 无害 | ADMIN 按钮正确 | 否：Mock 状态 IDLE，应 UNKNOWN | 校验 IP/协议/凭据语义 | P0 | 中 |
| 编辑 | PUT | `/api/v1/printers/update` | 相同 | 同上 | 部分实现 | 部分：未覆盖凭据保留提示 | data=null | ADMIN 正确 | 部分 | 明确空 apiKey 语义和完整字段 | P0 | 中 |
| 删除 | DELETE | `/api/v1/printers/delete/{id}` | 相同 | 同上 | 部分实现 | 是 | 是 | ADMIN 正确 | 否：Mock 不阻止忙碌 | 保留冲突上下文、Mock 409 | P0 | 中 |
| 扫描 | GET | `/api/v1/printers/scan` | 相同 | 同上 | 部分实现 | subnet 一致 | 基本一致 | ADMIN 正确 | 否：扫描 status/协议不一致 | 展示真实协议和逐项状态 | P0 | 中 |
| 批量添加 | POST | `/api/v1/printers/batch-add` | 相同 | 同上 | 调用错误 | 否：丢 firmwareType，带无用 name | 否：读 successCount，后端是 inserted/updated | ADMIN 正确 | 否：返回模型错误 | 保留协议，按 BatchUpsertResult 展示 | P0 | 高：RRF 会误录 KLIPPER |
| MAC/IP查询 | GET | `/by-mac/{mac}`、`/by-ip/{ip}` | 无 | 无 | 未实现/非主流程 | — | — | 双角色 | 未实现 | 仅扫描去重需要时接入 | P2 | 低 |
| 位置 | PUT | `/api/v1/printers/positions` | 相同 | API、deviceStore、FarmDashboard | 部分实现 | 是 | 只返回总成功消息，无逐项 | ADMIN 正确 | 部分：忽略不存在设备 | 失败回滚视图并刷新 | P0 | 中 |
| 未分配 | GET | `/api/v1/printers/unallocated?keyword` | 未发送 keyword，客户端筛选 | `api/printer.js`、BindDeviceDialog | 部分实现 | 部分 | 是 | 页面仅 ADMIN 使用，API本身双角色 | 否：保留 ONLINE 映射 | 支持 keyword，统一状态 | P1 | 低 |
| 暂停/恢复 | POST | `/api/v1/control/{id}/pause|resume` | 相同 | API、FarmDashboard | 部分实现 | 是 | 是 | 双角色一致 | 否：resume 未路由 | 集中动作矩阵，补 Mock | P0 | 高 |
| 取消当前设备任务 | POST | `/api/v1/control/{id}/cancel` | 相同 | 同上 | 部分实现 | 是 | 是 | 双角色一致 | 未实现 | 补 Mock 和 422/409 状态 | P0 | 高 |
| 急停 | POST | `/api/v1/control/{id}/emergency-stop` | 相同 | 同上 | 部分实现 | 是 | 是 | 双角色一致 | 调用错误：Mock 当取消 | 明确 RECONCILING，删除无接口 reboot | P0 | 高 |

### 13.3 文件

| 模块 | 后端接口方法 | 后端接口地址 | 当前前端调用地址 | 当前前端文件位置 | 当前状态 | 请求参数是否一致 | 返回结构是否一致 | 权限处理是否一致 | Mock 是否一致 | 前端需要修改的内容 | 优先级 | 联调风险 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 文件分页 | POST | `/api/v1/print-files/page` | 相同 | `api/printFile.js`、FileLibrary | 部分实现 | 前端正确 fileName；Mock 错用 keyword | 是 | 双角色/归属基本 | 否 | Mock 修 fileName，错误态 | P0 | 高：Mock 掩盖搜索失败 |
| 目录内容 | GET | `/folder/content?parentId` | 未调用，以 page+parentId 替代 | FileLibrary | 已实现（等价主流程） | page 契约支持 parentId | 分页而非数组 | 权限一致 | Mock page 可用 | 保留 page 方案，API标注替代 | P1 | 低 |
| 目录树 | GET | `/print-files/tree` | 无 | 无 | 未实现 | — | — | — | 未实现 | API、Store、树组件 | P1 | 中 |
| 创建目录 | POST | `/folder/create` | 相同 | API、FileLibrary | 部分实现 | 是 | 是 | 双角色一致 | 否：输出旧字段 | 统一 folder DTO和非法字符 | P0 | 中 |
| 单文件上传 | POST | `/upload` | 相同 | API、FileLibrary | 部分实现 | 基本一致 | 是 | 双角色一致 | 否：允许类型、旧字段 | 统一配置提示、错误/取消测试 | P0 | 中 |
| 批量上传 | POST | `/batch-upload` | 相同 | API、BatchDispatch | 部分实现 | FormData 正确 | API原样返回 | 双角色一致 | 未实现，FormData解析也丢 files | 增加超时/进度/逐项结果 Mock | P1 | 高 |
| 安全预览 | GET | `/{id}/preview` | 相同 | API、FileLibrary | 部分实现 | 是 | 基本一致 | 归属由后端 | 未实现 | loading/error、单位修正 | P1 | 中 |
| 缩略图 | GET | `/{id}/thumbnail` | 相同 | 同上 | 部分实现 | expires 一致 | string/null 一致 | 一致 | 未实现 | 过期重签一次，Mock | P1 | 中 |
| 下载 | GET | `/{id}/download` | 相同 | `api/printFile.js` | 部分实现 | 未传 expires，默认合法 | string 一致 | 一致 | 部分：泄露 fileUrl 内部种子 | 实现重签一次并区分 CORS | P1 | 高 |
| 本地流 | GET | `/storage?key` | 仅预签名 URL 可能内部使用 | 无直接调用 | 已实现（无需直接接入） | — | — | 服务端保护 | 不需要直接 Mock | 禁止前端构造 key | P2 | 低 |
| 单删 | DELETE | `/{id}` | 相同 | API、FileLibrary | 部分实现 | 是 | 是 | 归属后端 | 否：不阻止关联任务/目录 | 目录禁删、409提示、Mock修正 | P0 | 高 |
| 批量删除 | DELETE | `/batch` | 相同 | 同上 | 部分实现 | 是 | 否：页面忽略逐项结果 | 一致 | 否：返回 null | 展示 items，保留失败项 | P1 | 高 |
| 文件关联任务 | GET | `/{id}/jobs` | 无 | 无 | 未实现 | — | — | — | 未实现 | 新增分页抽屉 | P1 | 中 |

### 13.4 任务和批量分配

| 模块 | 后端接口方法 | 后端接口地址 | 当前前端调用地址 | 当前前端文件位置 | 当前状态 | 请求参数是否一致 | 返回结构是否一致 | 权限处理是否一致 | Mock 是否一致 | 前端需要修改的内容 | 优先级 | 联调风险 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 待派发队列 | GET | `/api/v1/print-jobs/queue` | 相同 | API、JobQueue | 调用错误（语义） | 是 | 数组一致 | 归属一致 | 否：Mock混入 ASSIGNED/READY/PAUSED | 页面只显示 QUEUED，另建活动列表 | P0 | 高：派发后操作入口消失 |
| 任务分页 | POST | `/print-jobs/page` | 相同 | API、JobHistory/Dashboard | 部分实现 | 基本一致 | 分页一致 | 归属一致 | 部分：缺时间过滤 | 使用 completedAt、完整状态 | P0 | 中 |
| 任务详情 | GET | `/print-jobs/{id}` | 无 | TaskDetailDrawer仅用行数据 | 未实现 | — | — | — | 未实现 | 新增 API，组合摘要 | P0 | 高 |
| 标准创建 | POST | `/api/v1/print-jobs` | 相同 | API、FileLibrary | 部分实现 | 字段一致，但 copies+同printer并发有冲突 | data Long；当前 JSDoc/Mock错误 | 归属一致 | 否：返回对象且 printerId仍QUEUED | 单/多份策略、准确成功提示 | P0 | 高 |
| 旧创建 | POST | `/api/v1/print-jobs/create` deprecated | 兼容函数仍导出，无页面引用 | `api/job.js` | 部分迁移 | 是 | 同标准 | 同标准 | Mock保留 | 移入 compatibility，测试禁止新引用 | P1 | 低 |
| 旧立即派发 | POST | `/{jobId}/assign?printerId` | 无 | 无 | 正确未使用 | — | — | — | 未实现 | 不接入 v2 新 UI | P2 | 低 |
| 安全派发 | POST | `/safe/assign` | 相同 | API、JobQueue | 部分实现 | 是 | data=null，前端 normalize无害 | 一致 | 部分 | 派发后进入活动列表 | P0 | 高 |
| 安全确认 | POST | `/safe/confirm` | 相同 | printer API、多个组件 | 部分实现 | 是，不传 operatorId正确 | data=null，API注释错误 | 一致 | 否：Mock返回 Printer | 统一调用位置/结果语义 | P0 | 中 |
| 安全启动/上传 | POST | `/safe/start` | 相同 | API、JobQueue/Drawer | 部分实现 | 是 | data=null，API注释错误 | 一致 | 部分：跳过 UPLOADING | 显示中间态，防重复动作 | P0 | 高 |
| 取消任务 | DELETE | `/print-jobs/{id}` | 相同 | API、队列/历史 | 部分实现 | 是 | 是 | 归属一致 | 部分：无设备调用错误 | 动作矩阵和准确提示 | P0 | 高 |
| 失败重试 | POST | `/{id}/retry` | 相同 | API、JobHistory | 部分实现 | 是 | 是 | 归属一致 | 未实现 | 补 Mock/刷新策略 | P1 | 中 |
| 重新排队 | POST | `/{id}/requeue` | 相同 | API、队列/历史 | 部分实现 | 是 | 是 | 归属一致 | 未实现 | 补 Mock/活动列表 | P1 | 中 |
| 优先级 | PUT | `/{id}/priority` | 相同 | API、队列/历史 | 部分实现 | 是 | 是 | 归属一致 | 未实现 | 统一 0-100 显示和测试 | P1 | 中 |
| 批量预览 | POST | `/api/v1/print-jobs/batch/preview` | 相同 | API、BatchDispatch | 部分实现 | 是 | 基本一致 | 双角色 | 未实现 | 导航入口、过期/conflict、Mock | P1 | 高 |
| 批量确认 | POST | `/api/v1/print-jobs/batch/confirm` | 相同 | 同上 | 部分实现 | 是 | 页面未完整展示逐项字段 | 双角色 | 未实现 | repeated/逐项结果/错误处理 | P1 | 高 |
| 批量失败重试 | 无独立接口；当前需重新 preview | 当前只重试批量上传，不处理确认失败项 | BatchDispatch | 未实现/契约待确认 | — | retryable仅返回标识 | — | 未实现 | 先实现失败项重新预览，等待契约决策 | P1 | 高 |

### 13.5 WebSocket

| 模块 | 后端接口方法 | 后端接口地址 | 当前前端调用地址 | 当前前端文件位置 | 当前状态 | 请求参数是否一致 | 返回结构是否一致 | 权限处理是否一致 | Mock 是否一致 | 前端需要修改的内容 | 优先级 | 联调风险 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 实时连接 | WS | `/ws/farm-status?token=` | 相同 | realtimeStore | 部分实现 | token一致 | 未校验 version | 缺1008后的/me复核 | 否 | 协议解析器和鉴权关闭处理 | P0 | 高 |
| SNAPSHOT | 消息 | `data.printers: PrinterVO[]` | 接收但解析 `unifiedState/state` | realtimeStore/realtimeAlerts | 调用错误 | — | 否：忽略 printer.status | — | 否：Mock用旧数组 | 快照专用适配 | P0 | 高：全量初始状态为未知 |
| sequence/eventId | 消息 | 每事件唯一、单进程递增 | 检查 sequence，未去重 eventId | realtimeStore | 部分实现 | — | 部分 | — | 否：Mock均缺 | 重连重置基线、event去重 | P0 | 高 |
| 心跳 | 协议 Ping/Pong | 服务端每30秒 Ping | 客户端发文本 ping并等文本pong | websocket.js | 调用错误 | 不一致 | 不一致 | — | 测试禁用心跳而未发现 | 删除文本心跳，修重连关闭 | P0 | 高：90秒后正常连接被关闭且不重连 |
| JOB_STATUS | 消息 | printerId+jobId/status/progress/errorReason | 只写设备实时 Map | realtimeStore | 部分实现 | — | 部分 | — | 旧字段 | 增加 Job Store 合并/刷新策略 | P0 | 高 |
| 陈旧/恢复 UI | 客户端状态 | 断档需REST快照 | Store有变量但组合Store/UI未暴露 | realtimeStore/FarmDashboard | 部分实现 | — | — | — | 未测试页面 | 暴露 stale/recovering 并展示 | P1 | 中 |

## 14. 当前 Mock 差距清单

1. `mock/data.js` 对外种子含 `isFolder/safeName/fileUrl/estimatedSeconds`，违反安全 DTO。
2. 文件分页处理 `keyword`，真实字段是 `fileName`。
3. 新增打印机 Mock 状态为 IDLE，真实新增为 UNKNOWN。
4. 扫描和批量添加状态、协议字段、统计字段与 BatchUpsertResult 不一致。
5. Mock FormData 解析只读单个 `file`，不读取重复 `files`。
6. 未实现 batch-upload、tree、preview、thumbnail、file jobs、printer detail/history/statistics。
7. 单删不模拟关联任务 409 或目录 422；批量删除返回 null 而非逐项结果。
8. 创建任务返回 `{id}` 而非 Long；传 printerId 后仍 QUEUED，未绑定设备。
9. queue 错误包含 ASSIGNED/READY/PAUSED，并额外嵌套 fileName/printerName 等字段。
10. 未实现任务详情、retry、requeue、priority、resume、device cancel、batch preview/confirm。
11. emergency-stop 被当作普通取消，未进入 ERROR/RECONCILING。
12. 错误场景映射错误：10001、5003、5004 的 HTTP/code/message 与后端不一致，并缺标准 400/503。
13. 无法稳定模拟“系统尚未初始化”。
14. Mock 用户响应额外包含 enabled；管理员创建错误允许 role=ADMIN；资源越权多返回403而非后端隐藏式404。
15. Mock WebSocket 缺 version/eventId/sequence，SNAPSHOT 结构错误，未模拟合法状态流。

## 15. 当前页面功能差距

- `BatchDispatch.vue` 已存在但没有侧边栏入口。
- `PrinterManage.vue` 的详情来自列表行并填充零值，没有调用真实详情。
- `DeviceDetailDrawer.vue` 显示无后端接口的“重启”按钮。
- `JobQueue.vue` 把 QUEUED 专用接口当活动任务列表，后续安全流在真实后端不可持续。
- `JobHistory.vue` 读 `endedAt`，真实字段为 `completedAt`。
- `FileDetailDrawer.vue` 把已是米的 filamentLength 再除 1000。
- `UserManagement.vue` 新建请求缺 confirmPassword，并提供后端不会创建的 ADMIN 选项。
- `AppUserMenu.vue` 仍提示个人中心未开放，虽然 Profile 路由和页面存在。
- 加载/空状态已在部分列表出现，但 403、503、网络错误、陈旧实时数据通常只弹 Toast，没有稳定页面状态。

## 16. 必须先确认的后端契约问题

以下不是前端可安全猜测的字段：

1. **用户禁用状态**：UserVO 不含 `enabled/disabled`，但 v2 要求管理员查看并切换用户状态。需后端决定把 Redis 禁用状态加入 UserVO（建议 `disabled:boolean`），或提供单独状态接口，并更新 `API_HANDOFF.md`/OpenAPI。
2. **批量失败重试**：BatchDispatchConfirmVO 返回 `retryable`，但当前 `confirm` 对非 PREVIEWED 计划只返回 stored result，不会重执行 RETRYABLE item，也没有 item retry API。需确认 v2 固定为“失败项重新预览”，还是新增明确重试接口；在确认前前端不得重复调用 confirm 假装重试。
3. **批量 item 的 action**：后端 TODO 曾描述 item 返回 action，但实际 DispatchPlanItemVO 无 action，action 仅在计划级。前端按计划级展示可工作；文档应明确是否保持此设计。

2026-09-04 T001 复核补充：

- 统一响应固定为 `{code,message,data,timestamp}`；`data` 可以是 `null` 或标量。分页固定为 `{records,total,pageNum,pageSize,pages}`，服务端 `pages` 为权威值。
- 批量上传失败只允许客户端重新提交原始失败文件，不存在服务端 item retry。
- 批量 confirm 重复调用只回放已存结果，不会重新执行；`retryable=true && jobId==null` 可重新预览，已有 `jobId` 的失败项仍缺少安全补偿契约。
- action 冻结为计划级 `UPLOAD_ONLY/QUEUE/START_AFTER_CONFIRM`；`START_AFTER_CONFIRM` 仍需逐项安全确认和启动。
- 后端批量预览存在 OPERATOR 文件归属校验风险，WebSocket 对角色和禁用用户的边界也未完整冻结；这些问题必须由后端修复，前端不得用隐藏入口或 Mock 绕过。

因此 T001 当前为部分完成并保持后端阻塞。与统一响应和通用错误处理相关的 T002 可以先行；T107 用户启停和 T104 批量失败补偿不得在契约补齐前宣称完成。

## 17. 任务依赖关系

```text
T001 契约决策
 ├─ T002 请求错误模型 ─┬─ T003 认证恢复 ── T004 路由权限
 │                    ├─ T005 领域适配器 ─┬─ T006 Mock 基础
 │                    │                  ├─ T007 打印机查询
 │                    │                  ├─ T009 文件基础
 │                    │                  └─ T011 任务 Store/列表
 │                    └─ T014 WebSocket 协议 ── T015 实时同步
 ├─ T008 打印机维护/控制
 ├─ T010 文件删除/下载
 ├─ T012 单任务安全流
 └─ T013 P0 Mock 场景

P0 稳定后
 ├─ T101 批量上传 ── T102 批量预览 ── T103 批量确认 ── T104 失败项处理
 ├─ T105 文件预览/缩略图/关联任务
 ├─ T106 打印机历史统计
 ├─ T107 用户管理
 ├─ T108 任务历史筛选
 └─ T109 P1 Mock/E2E

P1 稳定后
 └─ T201-T207 体验、性能、大文件、看板、日志、自动化与 v3 预留
```
