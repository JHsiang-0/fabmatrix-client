# SYNC-002 动态看板布局设计

## 1. 总体架构

```text
MySQL / SQLite
  ├── farm_dashboard_layout（单例布局、版本、过道 JSON）
  └── farm_printer（设备物理 row/col）
          ↓
DashboardLayoutService（锁、校验、事务、审计、提交后事件）
          ↓
GET/PUT /api/v1/dashboard-layout
          ↓
frontend gridStore（权威快照 + 编辑草稿）
  ├── gridLayout 纯函数（物理/视觉坐标、越界、轨道）
  ├── GridMap / GridCell（动态渲染）
  └── FarmDashboard（编辑、保存、冲突恢复）
```

布局配置与设备坐标属于同一个保存聚合。前端可以在草稿中连续调整行列、过道和设备位置，但只有一次确认保存；后端在一个事务中验证最终状态并提交。

## 2. 服务端数据模型

新增单例表 `farm_dashboard_layout`：

| 字段 | 类型建议 | 说明 |
| --- | --- | --- |
| id | BIGINT / INTEGER | 固定为 1 |
| row_count | SMALLINT / INTEGER | 物理行数 |
| column_count | SMALLINT / INTEGER | 物理列数 |
| aisles_json | TEXT | 规范化过道数组 |
| version | BIGINT / INTEGER | 乐观锁版本，从 1 开始 |
| updated_by | BIGINT / INTEGER | 最近修改管理员 |
| created_at | DATETIME / TIMESTAMP | 创建时间 |
| updated_at | DATETIME / TIMESTAMP | 更新时间 |

默认 `aisles_json`：

```json
[
  {
    "id": "default-column-aisle",
    "axis": "COLUMN",
    "afterIndex": 7,
    "label": "过道",
    "size": 100
  }
]
```

数据库完整性要求：

- MySQL 为 `(grid_row, grid_col)` 增加唯一索引；SQLite 使用两列非空时生效的 partial unique index。
- 坐标成对为空、正数约束优先落数据库；数据库版本不适合追加 CHECK 时，由迁移重建/触发器与 Service 双层保证。
- 跨表动态上界不能用普通 CHECK，统一由 `DashboardLayoutService` 在事务中校验。

## 3. API 契约

本节是 `SYNC-002.0` 冻结的目标契约；在 `SYNC-002.2`、`SYNC-002.3` 完成前，运行中的后端尚不提供这些接口。字段名、枚举和限制在后续实现中不得自行漂移。

### 3.1 读取布局

`GET /api/v1/dashboard-layout`

权限：ADMIN、OPERATOR。

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "rowCount": 4,
    "columnCount": 12,
    "aisles": [
      {
        "id": "default-column-aisle",
        "axis": "COLUMN",
        "afterIndex": 7,
        "label": "过道",
        "size": 100
      }
    ],
    "version": 1,
    "limits": {
      "minRows": 1,
      "maxRows": 30,
      "minColumns": 1,
      "maxColumns": 60,
      "maxCells": 1800,
      "maxAisles": 20,
      "minAisleSize": 48,
      "maxAisleSize": 240
    },
    "updatedAt": "2026-09-11T10:00:00"
  },
  "timestamp": 1789092000000
}
```

前端以 `limits` 为表单约束来源，避免前后端各自维护不同上限。

### 3.2 原子保存布局

`PUT /api/v1/dashboard-layout`

权限：仅 ADMIN；服务层同时校验当前用户角色。

```json
{
  "expectedVersion": 1,
  "rowCount": 6,
  "columnCount": 16,
  "aisles": [
    {
      "id": "main-column",
      "axis": "COLUMN",
      "afterIndex": 8,
      "label": "主通道",
      "size": 100
    },
    {
      "id": "cross-row",
      "axis": "ROW",
      "afterIndex": 3,
      "label": "横向通道",
      "size": 80
    }
  ],
  "overflowPolicy": "REJECT",
  "positionChanges": [
    { "printerId": 311, "gridRow": 1, "gridCol": 2 },
    { "printerId": 312, "gridRow": null, "gridCol": null }
  ]
}
```

成功返回最新完整布局、最终坐标摘要、新版本和被下架设备列表。失败返回稳定 HTTP/业务码及结构化详情，例如 `conflicts` 或 `outOfBoundsPrinters`。

旧 `PUT /api/v1/printers/positions` 在前端切换完成前保留兼容，但标记弃用；新看板编辑不再使用其部分成功语义。打印机新增/普通更新不得绕过布局服务直接写坐标。

## 4. 保存事务

```text
锁定 layout(id=1)
  → 比较 expectedVersion
  → 读取相关打印机及当前全部已占槽位
  → 计算布局和坐标最终态
  → 校验尺寸、过道、坐标对、设备存在性、越界、重复和占位冲突
  → 若 REJECT 且存在越界设备：422，零写入
  → 暂时清空本次变化/下架设备坐标
  → 写入最终设备坐标
  → 更新布局并 version + 1
  → 写审计日志
  → 提交事务
  → 提交后发布 LAYOUT_UPDATED
```

循环内部不得吞掉 SQL 异常。任何一步失败都必须抛出并回滚布局、坐标、版本和审计。`UNALLOCATE` 由服务端从最终布局计算全部越界设备，不信任前端自行列举。

## 5. 前端状态模型

`gridStore` 管理：

- `layoutSnapshot`：最近一次服务端权威布局。
- `layoutDraft`：仅编辑模式存在的深拷贝。
- `layoutLimits`、`layoutVersion`。
- `layoutLoading`、`layoutSaving`、`layoutError`、`layoutConflict`。
- `positionDraft`：按打印机 ID 保存草稿坐标。
- `invalidPositionDevices`：后端遗留异常坐标，不进入正常矩阵但必须可见。

`deviceStore` 继续管理设备基础数据，但应遍历分页取得全部记录。矩阵由“完整设备集合 + 当前布局/草稿”计算，不再依赖静态 `GRID_CONFIG`。

建议从 `30adedc` 选择性恢复并重写以下纯函数：

- 布局归一化和服务端契约校验。
- `getVisualRows/getVisualColumns`。
- `getPhysicalRow/getPhysicalColumn`。
- 横纵过道与交叉过道判断。
- 越界和重复槽位检测。
- Excel 风格行标签（A…Z、AA…AD）。
- 可用视口与网格自然尺寸计算。

删除其中的布局 localStorage 读写；服务端快照是唯一权威来源。

## 6. 渲染与响应式策略

- `GridMap` 根据视觉轨道数组生成 CSS Grid，不再硬编码 `repeat(4, ...)` 和 `repeat(13, ...)`。
- 中小布局可在不低于可读阈值时等比适配视口。
- 当继续缩放会导致卡片或文字不可读时停止缩放，改由看板内部双向滚动；页面本身不出现横向滚动。
- 行列头与内容使用同一轨道模板，滚动时保持坐标对应；拖放命中必须转换为物理坐标。
- `ResizeObserver` 仅观察网格宿主并在卸载时断开。
- 横向、纵向和交叉过道使用 TDesign 语义色与现有主题变量，不创建新的视觉体系。

## 7. 编辑交互

- ADMIN 点击“编辑布局”后创建草稿，工具栏显示“布局设置”“新增过道”“取消”“保存”。
- “布局设置”使用 TDesign Dialog 编辑行列；“过道设置”编辑方向、插入位置、名称和尺寸。
- 拖拽、绑定、交换和下架只更新草稿，不立即写数据库。
- 保存前展示变更摘要；缩容越界时列出设备并提供“返回调整”与二次确认“下架并保存”。
- 409 时提示布局已被其他管理员修改，禁止覆盖，并提供“重新载入”。
- 422 时在弹窗中展示完整越界列表；取消/关闭不能丢失用户尚未决定的草稿。
- OPERATOR 不渲染编辑入口，仍可打开设备详情和执行其已有打印控制权限范围内的操作。

## 8. WebSocket 同步

新增 `LAYOUT_UPDATED` 事件，至少包含：

```json
{
  "type": "LAYOUT_UPDATED",
  "stateSource": "LAYOUT",
  "layoutVersion": 2,
  "eventId": "...",
  "sequence": 123
}
```

- 非编辑状态收到更高版本后重新读取布局和设备快照。
- 编辑状态收到更高版本时标记草稿已过期，不自动覆盖用户草稿；保存时由 409 阻止旧版本提交。
- 此消息不得清空打印机状态、温度、进度、任务和通信健康字段。
- 断线重连或序号缺口时通过 REST 快照收敛。
- 协议版本继续使用 `version=1`；`LAYOUT_UPDATED` 是兼容性新增类型，`printerId` 固定为 null，`data.stateSource` 固定为 `LAYOUT`。

## 9. 迁移与兼容

MySQL：

- 新增幂等增量脚本，并更新 `farm.sql`、`02-current-schema.sql` 和两份 Compose 挂载。
- 已有数据卷必须先运行只读预检 SQL，输出半空坐标、重复槽位和越界记录；问题未处理前不得创建唯一约束。

SQLite：

- 更新 `local-schema.sql` 和 `LocalSchemaMigration`。
- 使用 partial unique index 约束非空槽位；成对约束按 SQLite 能力选择表重建或触发器。

兼容顺序：先迁移数据库，再部署后端，再部署前端。后端在迁移缺失时应快速失败并输出明确错误，不能退化成固定 4×12。

## 10. 关键风险与控制

| 风险 | 控制 |
| --- | --- |
| 重复坐标导致设备消失 | 数据预检、唯一约束、前端异常清单 |
| 两管理员覆盖布局 | 行锁 + expectedVersion + 409 |
| 交换触发唯一索引冲突 | 同事务先清空变更坐标，再写最终坐标 |
| 缩容静默丢设备 | 默认 REJECT，显式 UNALLOCATE 二次确认 |
| 30×60 缩到不可读 | 最小可读阈值 + 内部双向滚动 |
| 多客户端布局不一致 | 服务端持久化 + LAYOUT_UPDATED + REST 收敛 |
| machineNumber 被槽位覆盖 | 槽位标签改为计算字段，不再二次更新打印机 |
| 只显示前 100 台 | 前端遍历分页或后端提供完整布局快照 |
