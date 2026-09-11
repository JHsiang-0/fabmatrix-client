# FabMatrix 任务中心可读性与可靠性改造设计

版本：v1.0
对应需求：`.kiro/specs/farm-task-center-readability/requirements.md`

## 1. 总体数据流

```text
PrintJob + PrintFile + Printer + User + JobAttempt/Snapshot
  → 任务查询 Read Model
  → PrintJobSummaryVO / PrintJobDetailVO
  → /queue、/page、/{id}
  → api/job.js
  → jobStore
  → 队列、活动、历史和详情 ViewModel
```

列表接口直接返回可展示摘要，前端不通过逐行详情请求或全量资源字典拼装名称。

## 2. 后端读模型

### 2.1 摘要字段

现有 ID、状态、进度和时间字段保持不变，增量增加：

```text
fileName
printerName
machineNumber
creatorUsername
operatorUsername
```

实现可以使用一次 `LEFT JOIN`，也可以先分页读取任务，再按本页唯一 ID 集合批量读取关联资源。禁止按任务逐条查询。

### 2.2 历史快照字段

推荐将不可变显示快照保存在任务或执行尝试记录中：

```text
fileNameSnapshot
printerNameSnapshot
machineNumberSnapshot
creatorUsernameSnapshot
operatorUsernameSnapshot
```

队列和活动任务优先显示当前资源摘要；历史任务优先显示快照，快照缺失时回退当前摘要，再回退 ID。

### 2.3 重试模型

优先方案：失败任务保持不可变，重试创建新任务，并保存：

```text
retryOfJobId
rootJobId
attemptNumber
```

备选方案：新增 `farm_print_job_attempt`，但主任务与尝试的状态聚合、权限和分页复杂度更高。实施前由 TC-001 冻结方案，不允许继续清空原失败记录。

## 3. 查询契约

### 3.1 待派发队列

保留 `GET /api/v1/print-jobs/queue`，返回 `PrintJobSummaryVO[]`。查询阶段直接应用用户权限和规范状态，排序增加 ID 兜底。

### 3.2 活动与历史分页

优先扩展 `POST /api/v1/print-jobs/page`：

```json
{
  "pageNum": 1,
  "pageSize": 20,
  "statuses": ["ASSIGNED", "UPLOADING", "READY", "PRINTING", "PAUSED", "RECONCILING"],
  "printerId": 311,
  "fileName": "model.gcode",
  "userId": 1,
  "timeField": "COMPLETED_AT",
  "startTime": "2026-09-01T00:00:00",
  "endTime": "2026-09-30T23:59:59"
}
```

兼容原有单值 `status`；`statuses` 与 `status` 不得同时传递。后端以 ISO-8601 明确时间格式和时区语义。

## 4. 前端显示模型

### 4.1 待派发任务

主列显示文件名，第二行小字显示 `任务 #id`。保留耗材、喷嘴、优先级、状态、创建时间和调度操作；耗材与喷嘴必须来自正式摘要字段或文件摘要，不能依赖不存在的任务字段。

### 4.2 活动任务

建议列：

- 文件/任务
- 打印机（机器编号 + 名称）
- 状态
- 进度
- 开始时间/最近更新
- 操作

未分配时显示“未分配”。打印机名称或机号缺失时逐级回退到另一可读字段，最后才显示 `设备 #id`。

### 4.3 打印历史

建议列：

- 文件/任务
- 打印机快照
- 结果状态
- 创建人/操作员
- 开始/完成时间
- 失败原因
- 详情

历史页不继续提供排队、分配、暂停等活动操作；重试产生新任务后跳转或提示新任务编号，原历史保持不变。

### 4.4 任务详情

标题区域显示文件名和状态；资源与人员使用名称。技术 ID 收拢到“技术信息”折叠区域。RECONCILING 告警和人工核对流程保持最高视觉优先级。

## 5. 实时同步

Store 根据状态维护三个集合：

```text
QUEUED                     → queue
ASSIGNED..RECONCILING      → active
COMPLETED/FAILED/CANCELLED → history invalidation
```

未知任务消息只记录刷新意图，合并短时间内重复刷新；详情或分页响应完成前不创建空壳行。实时消息缺失名称时保留 REST 初始化名称，不得清空摘要字段。

## 6. 兼容和迁移

- 数据库迁移先补快照/重试字段或尝试表，再回填可推导的历史名称。
- 无法回填的旧数据保留空快照，前端按当前名称和 ID 回退。
- 独立迁移遗留 `PENDING → QUEUED`、`MANUAL → QUEUED`、`CANCELED → CANCELLED`，查询接口不再写数据。
- OpenAPI、`API_HANDOFF.md`、前端 JSDoc、Mock 和测试同步更新。

## 7. 测试策略

- 后端：Mapper/Service 集成测试覆盖 LEFT JOIN、权限、删除资源、稳定排序、多状态分页、完成时间范围和重试历史。
- 前端：Store 测试覆盖分页、状态集合迁移、未知 WebSocket 任务和名称保留。
- UI：覆盖长文件名、长机器名、名称缺失回退、Tooltip、终态筛选和详情技术信息。
- 真实联调：ADMIN 与 OPERATOR 各完成一次创建、分配、启动、结束、失败重试和人工核对闭环。
