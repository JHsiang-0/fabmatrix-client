# FabMatrix V3 批量派发设计约束

## 当前版本门禁

使用统一功能开关控制导航和路由。V2 默认关闭 `batchDispatch`：导航过滤该功能，路由守卫拒绝直接访问。V3 完成后端验收后只需开启同一开关，不需要恢复被删除的页面代码。

## V3 状态流

```text
PREVIEWED -> EXECUTING -> COMPLETED | PARTIAL_FAILED | RECOVERY_REQUIRED
                         item: PENDING -> UPLOADING/ASSIGNED/QUEUED
                                       -> READY/SUCCEEDED
                                       -> RETRYABLE/FAILED/RECOVERY_REQUIRED/SKIPPED
```

计划认领、单项数据库写入和设备副作用必须分离。设备操作前先保存可恢复状态，设备返回后再提交结果；进程中断由租约和恢复扫描处理。

## 重新开放门槛

- MySQL 真实事务和双线程确认测试通过。
- 设备上传中断、服务重启、网络超时和存储暂时失败均有恢复测试。
- `ROUND_ROBIN`、离线设备、心跳更新、部分确认和 TTL 后幂等回放测试通过。
- Browser/Electron 验证导航、路由门禁、预览、确认、部分失败和恢复流程。
- 至少一次真实后端联调；真实设备未验证时不得默认开放。

## 权限矩阵与错误边界

| 操作 | ADMIN | 计划创建者（ADMIN/OPERATOR） | 其他 OPERATOR | 匿名/未知角色 |
| --- | --- | --- | --- | --- |
| 创建预览 | 允许 | 允许 | 允许 | 401/登录守卫 |
| 确认计划 | 允许 | 允许 | 403 | 401 |
| 恢复/重试计划 | 允许 | 允许 | 403 | 401 |
| 终态结果回放 | 允许 | 允许 | 403 | 401 |

预览和确认服务端都按会话重新计算可见资源。创建预览时，单个不存在、已删除或不可见的私有文件以 HTTP 200 中的脱敏 `FILE_NOT_FOUND` 明细表达，不回显其资源元数据；确认、恢复和结果回放中的计划不存在或不可见时返回 404，其他 `OPERATOR` 对可见计划越权时返回 403。`ADMIN` 具有跨用户计划管理权，但仍须遵守资源可见性、版本和设备状态校验。

## 计划执行与租约

```text
create preview
    -> PREVIEWED
    -> short claim transaction
    -> EXECUTING + lease(owner, expiresAt, attempt)
    -> per-item persist -> device side effect -> per-item result
       |                         |                  |
       |                         |                  +-> READY/SUCCEEDED
       |                         +-> RETRYABLE/FAILED/RECOVERY_REQUIRED
       +-> lease timeout/startup scan -> reconcile -> retry or RECOVERY_REQUIRED
    -> COMPLETED | PARTIAL_FAILED | RECOVERY_REQUIRED
```

计划认领、明细写入和设备副作用分层；设备调用不持有整批数据库事务。恢复扫描只处理过期 `EXECUTING` 租约，先通过设备查询或任务状态核对副作用，再决定重试、补写成功态或进入 `RECOVERY_REQUIRED`。后者必须经恢复检查/人工核对退出，且在不确定时禁止再次发送相同设备副作用。

动作映射必须在 API、Mock 和前端适配器中一致：`UPLOAD_ONLY` 成功为 `READY`；`QUEUE` 成功为 `QUEUED` 或已绑定时的 `ASSIGNED`；`START_AFTER_CONFIRM` 只产生 `ASSIGNED`/`QUEUED` 的待确认任务，不得将确认动作等同于设备已开始打印。失败必须区分 `RETRYABLE`、`FAILED` 和 `RECOVERY_REQUIRED`。计划汇总时先判断是否存在副作用未知项并进入 `RECOVERY_REQUIRED`，再判断是否全部成功并进入 `COMPLETED`，其余确定性结果（包括全部失败）统一进入 `PARTIAL_FAILED`。

## 幂等与并发

- 计划确认以 `planId + version + confirmationToken` 校验，明细以 `planId + itemId` 幂等；重复确认直接回放持久化结果。
- 终态计划允许 TTL 之后回放，不重新执行设备动作；未完成计划的 TTL、版本或资源版本冲突返回 409 并要求重新预览。
- 同一计划内同一打印机最多锁定一个可执行明细；未选项必须落为 `SKIPPED` 或被明确拒绝确认。
- 确认、恢复和回放都先做权限校验再读取计划结果，计划创建者和 `ADMIN` 之外的 `OPERATOR` 不得通过猜测 ID、令牌或回放接口越权。
