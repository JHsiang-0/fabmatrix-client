# SYNC-002 动态看板布局任务

> 参考样式实现：`30adedc`
> 当前功能基线：`integration/ui-sync-30adedc`
> 关联规格：[requirements.md](./requirements.md) / [design.md](./design.md)
> 实施仓库：`fabmatrix-server` + `fabmatrix-client`

## 依赖顺序

```text
SYNC-002.0 契约冻结
  ↓
SYNC-002.1 数据预检与迁移
  ↓
SYNC-002.2 后端布局资源 ──→ SYNC-002.3 原子保存与坐标约束
                                   ↓
SYNC-002.4 前端 API/Store/纯函数
                                   ↓
SYNC-002.5 动态网格渲染
                                   ↓
SYNC-002.6 布局编辑交互
                                   ↓
SYNC-002.7 多客户端同步与 Mock
                                   ↓
SYNC-002.8 回归护栏与双端验收
                                   ↓
SYNC-002.9 迁移交付与文档收口
```

## 任务清单

### [x] SYNC-002.0 冻结动态布局契约

- 确认首版为单农场共享布局，不新增车间实体和用户私有布局。
- 冻结边界：行 `1–30`、列 `1–60`、总槽位 `≤1800`、过道 `≤20`、尺寸 `48–240`、名称 `≤12`。
- 冻结多横向/纵向过道模型、默认 4×12/第 7 列后过道、物理/视觉坐标规则。
- 冻结 `GET/PUT /api/v1/dashboard-layout`、`expectedVersion`、`overflowPolicy`、结构化错误和 `LAYOUT_UPDATED`。
- 明确 `machineNumber` 不再跟随槽位变化，槽位标签由坐标计算。
- 更新前后端 API handoff/OpenAPI 设计文档，不修改业务实现。
- 验收：字段、枚举、权限、错误码、上限、事务和迁移顺序无待定项。

完成记录：已冻结单农场共享布局、4×12 默认值、1–30 行、1–60 列、最多 20 条横纵过道、`GET/PUT /api/v1/dashboard-layout`、乐观版本、原子坐标变更、REJECT/UNALLOCATE 缩容、ADMIN/OPERATOR 权限、结构化错误和 `version=1` 的 `LAYOUT_UPDATED` 扩展。前后端交接文档均明确标记为目标契约、尚未实现；后端新增独立 OpenAPI 设计文档，未修改业务代码、数据库或运行时协议。

### [x] SYNC-002.1 完成数据预检与 MySQL/SQLite 迁移

- 为 MySQL 和 SQLite 提供只读预检，列出半空坐标、重复槽位、非正数和超出默认 4×12 的设备。
- 新增并初始化 `farm_dashboard_layout` 单例表和默认布局。
- 增加坐标成对、正数和槽位唯一约束；异常数据不得被脚本静默删除或覆盖。
- 更新 `farm.sql`、`02-current-schema.sql`、`local-schema.sql`、`LocalSchemaMigration` 和两份 Compose 挂载。
- 提供已有 MySQL 数据卷和已有 SQLite 文件的备份、执行、验证、回滚说明。
- 验收：MySQL/SQLite 新库与已有库均可重复执行迁移；异常数据时迁移安全停止并给出清单。

完成记录：已新增 MySQL 8.4/SQLite 独立只读坐标预检、MySQL 编号 16 幂等迁移、SQLite 新库约束和已有库启动迁移；追加修复后，MySQL 新库/增量脚本均由 `farm_printer` 表定义成对与正数 CHECK 及联合唯一索引，布局表和默认行仅由编号 16 在预检通过后创建。编号 16 会核对已有布局表的真实列、启用 CHECK、主键和时间列语义，并在失败/成功路径清理辅助例程；SQLite 严格核对 partial unique index，预检后安全重建项目自有坐标触发器并阻断同名伪对象。默认布局为 4×12、物理第 7 列后 100px 过道、版本 1。已补齐两份 Compose 的 MySQL 14、15、16 只读挂载，并新增备份、执行、验证、回滚及失败新卷处理说明。未进行真实 MySQL 数据卷验收，因当前没有安全隔离的 MySQL 容器环境。

### [x] SYNC-002.2 实现后端布局读取资源

- 新增 Layout Entity/Mapper/DTO/VO/Service/Controller。
- 实现 `GET /api/v1/dashboard-layout`，返回规范化布局、版本、限制和更新时间。
- 在 `SecurityConfig` 显式配置 GET 为 ADMIN/OPERATOR、PUT 为 ADMIN；服务层重复校验写权限。
- 空库或缺失单例时在受控事务中创建默认布局，不依赖前端默认值。
- 补充 OpenAPI、统一异常映射和 Controller/Service 测试。
- 验收：ADMIN/OPERATOR 可读，匿名 401；返回结构在 MySQL/SQLite 一致。

完成记录：后端已新增布局 Entity/Mapper/DTO/VO/Service/Controller，提供规范化的
`GET /api/v1/dashboard-layout`。缺失单例时服务在事务内创建 4×12 默认布局，并返回固定限制、版本和更新时间；
SecurityConfig 显式限制 GET 为 ADMIN/OPERATOR、PUT 为 ADMIN（PUT 保存逻辑留在 SYNC-002.3）。
新增 Controller 安全测试和 Service 默认创建/规范化测试，后端专项与全量 Maven 测试通过。

### [x] SYNC-002.3 实现原子布局保存与坐标约束

- 实现 `PUT /api/v1/dashboard-layout`，一次提交布局草稿、位置变化、版本和缩容策略。
- 锁定布局行并校验 `expectedVersion`；重复保存、并发冲突返回 409。
- 整体校验设备存在性、坐标对、边界、重复 ID、重复目标槽位和已有占位。
- 支持设备交换：事务内先清空变更坐标，再写最终坐标；任何异常整体回滚。
- `REJECT` 缩容返回 422 和完整越界设备清单；`UNALLOCATE` 在同一事务中下架并返回清单。
- 移除/封堵 PrinterAddDTO、PrinterUpdateDTO 和旧位置服务绕过动态布局约束的路径；旧 positions API 标记弃用。
- 审计日志与 WebSocket 事件只在事务提交后发布。
- 验收：交换、冲突、并发、越界、不存在设备和第 N 条 SQL 故障注入均符合规格，绝不部分成功。

完成记录：后端新增带 `expectedVersion` 的布局原子保存、MySQL/SQLite 锁定读取、设备最终态校验、交换前清空坐标、
`REJECT/UNALLOCATE` 缩容策略和结构化冲突响应；审计及 `LAYOUT_UPDATED` 均在事务提交后处理，旧 `/printers/positions`
入口已停用。新增保存、版本冲突、缩容、权限、结构化错误和 WebSocket 提交后广播测试，后端专项与全量 Maven 测试通过。

### [x] SYNC-002.4 实现前端布局 API、Store 与纯函数

- 新增布局 API 和响应适配，Long ID 继续按字符串安全规范处理。
- `gridStore` 增加权威快照、编辑草稿、版本、限制、loading/error/conflict 和保存动作。
- `deviceStore` 遍历打印机分页取得全部设备，不再限制为前 100 台。
- 从 `30adedc` 选择性恢复并重写布局归一化、视觉/物理坐标映射、横纵/交叉过道、越界与重复检测、行标签和视口计算。
- 删除布局 localStorage 权威读写，不修改 realtimeStore 的设备状态合并语义。
- 增加纯函数、API、Store 和超过 100 台设备的单元测试。
- 验收：1×1、4×12、30×60、多过道、交叉、AA 行标签、非法输入和异常坐标均有确定结果。

完成记录：已新增布局 GET/PUT API 适配，Long 类型打印机 ID 在响应边界统一为字符串；`gridStore` 管理服务端权威快照、编辑草稿、版本、限制、保存状态和冲突详情，设备 Store 聚合全部打印机分页且保留异常坐标。新增无 localStorage 权威读写的布局纯函数，支持 1×1、默认 4×12、30×60、多横纵过道交叉、Excel 风格 AA 行标签、严格布局校验、半空/越界/重复槽位清单与视口计算；专项和前端全量测试、lint、build 均通过。

### [x] SYNC-002.5 实现动态网格渲染与大布局滚动

- 改造 `GridMap.vue`、`GridCell.vue` 和矩阵计算，动态生成行列头、设备轨道、横纵过道及交叉格。
- 移除固定 `repeat(4, ...)`、`repeat(13, ...)` 和单一 `AISLE_COL` 依赖。
- 加入最小可读阈值；中小布局适配视口，大布局使用网格内部双向滚动。
- 保证列头、行头、卡片和拖放命中始终对齐；正确清理 ResizeObserver。
- 保留 TDesign 视觉语言、详情 Drawer、业务/通信状态和现有控制动作。
- 验收：800×560、1024×640、1440×900、1920×1080 下无页面级溢出，30×60 可滚动且坐标不漂移。

完成记录：GridMap 已改为依据服务端布局生成动态行列头、设备轨道、横纵过道及交叉格，GridCell 展示过道语义并保留原有设备状态与拖放事件；看板初始化先加载布局再加载完整设备快照，30×60 大布局使用网格内部双向滚动。已更新固定 4×12 回归护栏为动态布局断言；前端全量测试 217/217、lint 和 build 均通过。

### [x] SYNC-002.6 实现 ADMIN 布局编辑工作流

- 改造 `FarmDashboard.vue`，进入编辑时创建草稿；拖拽、绑定、交换、下架不再立即请求后端。
- 使用 TDesign 完成行列设置、过道新增/编辑/删除、变更摘要、取消和保存交互。
- 缩容前展示越界设备；默认返回调整，选择下架时必须二次确认。
- 保存期间禁用重复提交；成功替换快照，400/404 显示校验信息，409 提供重新载入，422 展示越界列表，5xx 保留草稿。
- OPERATOR 隐藏编辑入口并阻止通过事件或路由触发写操作。
- 绑定槽位时不再二次更新 `machineNumber`。
- 验收：保存前刷新/关闭提示未保存变更；取消无服务端写入；成功后刷新页面布局不丢失。

完成记录：ADMIN 布局编辑已改为快照加草稿工作流，行列/过道设置、拖拽移动与交换、绑定、下架均只修改草稿；保存时携带 `expectedVersion` 一次提交，成功后刷新设备快照，失败保留草稿。已加入 TDesign 布局/过道 Dialog、保存 loading、防重复提交、取消确认、缩容越界下架二次确认、409/422 提示、OPERATOR 写入保护和 beforeunload 未保存保护；绑定不再改写 `machineNumber`。前端全量测试 219/219、lint 和 build 均通过。

### [x] SYNC-002.7 实现多客户端同步与 Mock 契约

- 后端提交后发送 `LAYOUT_UPDATED`，包含 `layoutVersion/eventId/sequence`。
- 前端非编辑状态收到新版本后刷新布局和设备快照；编辑状态只标记草稿过期，不覆盖草稿。
- 断线、事件缺口和重连后通过 REST 快照收敛，布局消息不得清空设备实时字段。
- Mock 实现布局 GET/PUT、版本冲突、权限、越界、原子坐标和布局事件。
- 验收：两个客户端同步；两个管理员并发只允许一个保存；OPERATOR 客户端自动看到已提交布局。

完成记录：Mock 已实现布局 GET/PUT、ADMIN/OPERATOR 权限、版本冲突、REJECT/UNALLOCATE 缩容、槽位冲突和原子更新，
并通过共享订阅广播 `LAYOUT_UPDATED`。realtimeStore 仅记录递增布局版本，不覆盖设备实时状态；非编辑看板通过 REST
刷新布局和完整设备快照，编辑状态保留草稿并标记过期；断线重连后按同样规则收敛。新增 Mock 双客户端、权限、冲突、
原子性和状态分层测试；前端全量测试 224/224、lint、build 均通过。

### [ ] SYNC-002.8 建立回归护栏并完成联调验收

- 替换 `dashboardOverview.test.js` 中固定 4×12 和禁止动态布局的旧门禁。
- 恢复/重写 `gridLayout.test.js`、`gridAisleUi.test.js`，补充权限、事务、冲突、缩容、超过 100 台和 WebSocket 测试。
- 覆盖现有绑定、移动、交换、下架、详情、暂停、恢复、取消、急停及 REST/WS 状态分层非回归。
- 执行后端 `mvn test`，前端 `npm test`、`npm run lint`、`npm run build`、浏览器 E2E、Electron E2E 和 desktop dist 验证。
- 验收：全部命令通过；MySQL 与 SQLite 至少各完成一次真实约束/事务验收。

自动化完成记录：已将浏览器与 Electron 全屏看板断言更新为现行 Header 文案，新增 `gridAisleUi.test.js`，
覆盖动态横/纵过道、交叉标签、内部滚动和共享模板，并保留已有布局、权限、事务、冲突、缩容、超过 100 台和
WebSocket 回归护栏。前端全量测试 227/227、lint、生产/desktop/desktop-mock 构建、浏览器 E2E 9/9、
Electron E2E 3/3、Electron-dist E2E 1/1 通过；后端 `mvn test` 通过。真实 MySQL/SQLite 数据卷验收未执行，
因当前任务明确禁止连接真实数据库或数据卷，待具备隔离环境后补做，故本任务暂不标记 DONE。

### [ ] SYNC-002.9 完成迁移交付与文档收口

- 更新部署、升级、回滚、数据库预检、API handoff 和管理员操作说明。
- 明确部署顺序为“数据库迁移 → 后端 → 前端”，并记录旧 positions API 的弃用窗口。
- 检查前后端 diff、敏感信息、锁文件、备份文件和无关工作区改动。
- 前后端按子任务独立创建 Conventional Commit，不 push、不覆盖已有提交。
- 验收：新环境和升级环境均可按文档复现；规格、接口、迁移和实际实现一致。

## 实施纪律

- 每次只完成一个 `SYNC-002.x`，通过该项验证后再提交。
- 后端迁移和契约任务先于前端业务实现；前端不得用 localStorage 或 Mock 代替真实后端契约。
- 所有业务代码、测试和构建配置修改按项目 AGENTS 交给唯一 `farm_coder`，完成后再由 reviewer/verifier 只读审查。
- 不修改或引用 `src/stores/printerStore.js.backup`，不连接或控制真实打印机。
