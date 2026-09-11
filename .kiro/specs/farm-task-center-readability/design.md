# FabMatrix 任务中心可读性与可靠性改造设计

版本：v1.1
对应需求：`.kiro/specs/farm-task-center-readability/requirements.md`
冻结任务：TC-001
状态：TC-001 已冻结；后续任务负责实施，不得在实施前假设目标字段已经由接口返回。

## 1. 契约边界

本设计冻结任务查询读模型、查询集合、任务状态机、权限、快照、重试和统一响应语义。TC-001 只修改契约文档、OpenAPI 描述和前端说明，不实现 Mapper、Service、数据库迁移、页面或 Store 业务。

当前后端仍以 `PrintJobVO` 返回任务数据。`PrintJobSummaryVO`、`PrintJobDetailVO` 以及新增查询字段属于 TC-001 之后的目标实现任务；当前接口未返回的字段不得由前端伪造。

## 2. 任务读模型

### 2.1 `PrintJobSummaryVO`

queue、active、history 分页和详情的摘要部分使用统一字段集合。现有状态、进度、时间、优先级和技术 ID 保留，摘要新增以下当前可读字段：

```text
fileName
printerName
machineNumber
creatorUsername
operatorUsername
materialType
nozzleSize
```

历史执行快照字段固定为：

```text
fileNameSnapshot
printerNameSnapshot
machineNumberSnapshot
creatorUsernameSnapshot
operatorUsernameSnapshot
```

重试关联字段固定为：

```text
retryOfJobId
rootJobId
attemptNumber
```

所有 ID 在 JSON 中均为十进制字符串，前端不得转成 JavaScript `Number`。`materialType`、`nozzleSize` 是任务摘要字段；没有字段值时不得用虚构值补齐。

### 2.2 `PrintJobDetailVO`

详情至少包含完整的 `PrintJobSummaryVO` 字段集合，并保留 `id`、`fileId`、`printerId`、`userId`、`operatorId` 等技术 ID。详情可以增加仅用于详情页面的诊断字段，但不得删除摘要字段或改变 ID 的字符串语义。

列表显示规则固定为：queue/active 使用 current-first；history 使用 snapshot-first，快照为空时回退当前可读字段，仍为空时回退技术 ID。资源被删除或当前用户无权读取时仍保留任务记录。

## 3. 三个查询集合

```text
queue   = QUEUED
active  = ASSIGNED | UPLOADING | READY | PRINTING | PAUSED | RECONCILING
history = COMPLETED | FAILED | CANCELLED
```

`PENDING`、`MANUAL`、`CANCELED` 只允许由独立迁移规范化为 `QUEUED`、`CANCELLED`。任何 GET 查询不得写库、迁移状态或修复数据。

## 4. 查询接口契约

### 4.1 `GET /api/v1/print-jobs/queue`

目标响应为 `Result<PrintJobSummaryVO[]>`。服务端必须在查询阶段下推当前用户权限条件，并固定排序：

```text
priority DESC, createdAt ASC, id ASC
```

队列只包含规范化后的 `QUEUED`。

### 4.2 `POST /api/v1/print-jobs/page`

目标响应为 `Result<PageResult<PrintJobSummaryVO>>`。请求兼容单值 `status`，并新增：

```json
{
  "statuses": ["COMPLETED", "FAILED", "CANCELLED"],
  "fileName": "model.gcode",
  "timeField": "COMPLETED_AT"
}
```

`status` 与 `statuses` 互斥，同时传递返回 `400`。`timeField` 只能为 `CREATED_AT` 或 `COMPLETED_AT`。`startTime`、`endTime` 使用 `yyyy-MM-dd'T'HH:mm:ss` 的 ISO-8601 local datetime，由服务配置的农场时区解释，默认 `Asia/Shanghai`；`startTime > endTime` 返回 `400`。

history 查询固定使用 `COMPLETED_AT`，排序为 `completedAt DESC, id DESC`，`completedAt=null` 排在最后。其他集合使用 `createdAt DESC, id DESC`。`fileName`、打印机、创建人等筛选不得绕过权限条件。

### 4.3 `GET /api/v1/print-jobs/{id}`

目标响应为 `Result<PrintJobDetailVO>`。详情不存在或当前用户不可访问时统一返回 `404`，不得通过错误消息泄露资源是否存在。

## 5. 权限边界

`ADMIN` 可以查询全部任务。`OPERATOR` 只能查询本人可访问的任务。请求体中的 `userId` 只允许作为 ADMIN 的筛选条件；它不能扩大 OPERATOR 权限，权限条件必须在查询阶段生效。详情、重试、重排、取消、核对和控制操作均再次校验当前 JWT 用户与任务归属。

## 6. 状态机和操作矩阵

| 操作 | 允许的当前状态 | 结果/约束 |
|---|---|---|
| cancel | `QUEUED`、`ASSIGNED`、`UPLOADING`、`READY`、`PRINTING`、`PAUSED` | 进入 `CANCELLED`；设备命令失败返回 `503`，非法状态返回 `422` |
| cancel | `RECONCILING`、`COMPLETED`、`FAILED`、`CANCELLED` | 不允许；`RECONCILING` 必须走 reconcile |
| retry | `FAILED` | 新建任务记录；原失败任务不可变；返回新任务 ID 字符串 |
| requeue | `ASSIGNED`、`READY` | 解绑设备并进入 `QUEUED`；非法状态返回 `422` |
| reconcile | `RECONCILING` | 只能到 `COMPLETED`、`FAILED`、`CANCELLED`、`QUEUED`；参数错误 `400`，状态错误 `422` |
| priority | `QUEUED` | 仅修改排队任务优先级 |
| safe assign | `QUEUED` | 进入 `ASSIGNED`，不启动设备 |
| safe start | `ASSIGNED` 经安全确认 | 按 `action` 走现有流程到 `UPLOADING`、`READY` 或 `PRINTING` |

除 create/retry 返回新任务 ID 字符串外，safe assign、safe start、cancel、requeue、reconcile、priority 等写操作的 `data` 均为 `null`。前端写操作成功后刷新详情和相关列表。

重试采用“新建任务记录”方案，不建立 attempt 表：新任务状态为 `QUEUED`，无 `printerId`、`operatorId`、`startedAt`、`completedAt`、`errorReason`，保留原 `userId`、`fileId`、`priority` 以及文件/创建人快照；`retryOfJobId` 指向直接来源，`rootJobId` 指向首次任务，`attemptNumber` 为原任务值加一。

`POST /api/v1/print-jobs/{jobId}/assign` 标记为 deprecated。当前兼容实现的存在不构成新前端调用许可；后续实施任务必须拒绝旧直启链路，目标错误码为 `410`，以防绕过安全确认。

## 7. 快照时机

快照写入时机固定如下：

```text
创建任务：fileNameSnapshot、creatorUsernameSnapshot
分配任务：printerNameSnapshot、machineNumberSnapshot
启动任务：operatorUsernameSnapshot
```

快照字段一旦非空不得因文件、打印机或用户改名而覆盖。历史展示按 snapshot-first 规则读取；queue/active 展示当前名称并在缺失时按统一回退规则处理。

## 8. 错误和响应语义

任务接口统一记录以下 HTTP 状态与业务语义：

| HTTP 状态 | 含义 |
|---:|---|
| 400 | 参数格式、status/statuses 互斥或时间范围错误 |
| 401 | 未登录、Token 无效或过期 |
| 403 | 已认证但角色、归属或操作无权 |
| 404 | 资源不存在或当前用户不可访问 |
| 409 | 并发、幂等或资源冲突 |
| 422 | 状态机或业务前置条件不满足 |
| 503 | 设备或外部依赖失败 |

成功响应的 `data` 类型固定为：

```text
queue       = PrintJobSummaryVO[]
page        = PageResult<PrintJobSummaryVO>
detail      = PrintJobDetailVO
create      = 新任务 ID 字符串
retry       = 新任务 ID 字符串
其他写操作  = null
```

## 9. 实施边界和验收

TC-002/TC-003/TC-007 负责把目标读模型、查询下推、分页、快照和新建重试记录落到后端；TC-004/TC-005/TC-006 负责前端展示和实时收敛。TC-001 完成时只验收契约、OpenAPI、API handoff 和前端 API 说明的一致性，不声明目标字段已经上线。
