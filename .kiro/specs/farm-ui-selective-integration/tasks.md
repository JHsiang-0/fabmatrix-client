# SYNC-001 选择性界面集成任务

> 基线：`2896a55d7d0623d2ff798bf863ef0ebb35c99255`  
> 远程审计目标：`origin/feat/ui-003-electron` / `30adedc`  
> 共同祖先：`27bcc42a1494e85da8adac63da821fb1e9c191fb`

## 任务清单

### [x] SYNC-001.0 冻结集成基线

- 从 `2896a55` 创建日期化备份分支和 `integration/ui-sync-30adedc`。
- 记录远程 SHA、远程视觉提交清单、保护文件清单和回滚点。
- 禁止直接 pull、整分支 merge/rebase、整文件选择 `theirs`。
- 验收：基线 `git status --short` 干净，远程 SHA 可复现。

完成记录：已基于本地 `4b45769`（功能基线 `2896a55` 加入本 Spec 文档）创建备份分支 `backup/feat-ui-003-electron-before-selective-sync-20260910` 和集成分支 `integration/ui-sync-30adedc`；重新 fetch 后确认远程目标为 `30adedc`，未执行整分支合并或覆盖操作。

### [x] SYNC-001.1 建立防回退门禁

- 只补充或保留契约回归测试，不修改生产逻辑。
- 覆盖文件权限/目录操作、逐文件上传、打印机监控、REST/WS 合并、RECONCILING、批量派发幂等和 ADMIN/OPERATOR 权限。
- 验收：现有 Node 测试全通过，且不得删除 `tests/printerMonitoring.test.js`、文件库和 WebSocket 测试。

完成记录：由 Luna 补充 `tests/sync0011RegressionGuard.test.js`，覆盖文件库目录与权限、逐项上传、打印机监控、REST/WS 合并、RECONCILING、批量派发幂等和关键测试文件保留；相关测试 77/77、全量测试 197/197，lint/build 均通过。

### [x] SYNC-001.2 应用壳、登录和导航视觉适配

- 范围：`src/App.vue`、`src/components/layout/*`、`src/views/Login.vue`、`src/views/ServerConnection.vue`、`src/config/navigation.js`、必要主题样式和对应测试。
- 保留自绘 Electron 标题栏、IPC、权限过滤、登录守卫和唯一滚动所有者。
- 不整体重写登录业务和服务器连接保存逻辑。
- 验收：登录、导航、窗口缩放、权限菜单和服务器配置行为不变，视觉改动使用 TDesign。

完成记录：选择性移植应用壳、导航品牌入口、折叠菜单图标、登录语义主题变量和服务器连接卡片视觉；保留 Electron IPC、自定义标题栏、登录守卫、权限过滤、实时连接生命周期与服务器配置保存逻辑。相关测试 21/21、全量测试 197/197，lint/build 均通过；Electron 标题保留为“嘉东三维联动3D打印机实时控制系统”。

### [x] SYNC-001.3 打印机中心视觉移植

- 范围：`src/views/PrinterManage.vue`、`src/components/device/DeviceDetailDrawer.vue`、打印机视觉回归测试。
- 可移植状态卡片、筛选栏、表格密度、hover、分页和详情布局。
- 必须保留监控开关、业务/通信状态分离、最近通信信息、权限控制、未分配设备和详情分析。
- 验收：ADMIN 可管理监控，OPERATOR 只能查看；断线不会把业务状态显示成空闲；详情和操作 Loading/错误态完整。

完成记录：选择性移植打印机筛选工具栏、状态标签、表格密度、hover、分页摘要、任务进度和详情抽屉卡片/历史布局；保留监控开关、ADMIN/OPERATOR 权限、业务/通信状态分离、OFFLINE 状态保留、最近通信信息、错误态、空态和设备控制。相关测试 27/27、全量测试 199/199，lint/build 均通过。

### [x] SYNC-001.4 任务中心视觉移植

- 范围：`src/views/JobQueue.vue`、`src/views/JobHistory.vue`、`src/components/TaskDetailDrawer.vue` 及任务测试。
- 可移植任务分区、表格、筛选、操作栏、分页和详情展示。
- 必须保留十状态、合法操作矩阵、RECONCILING 四种人工核对结果、原因校验、重复提交保护和错误刷新。
- 验收：任务状态和按钮权限不回退，人工核对和重新排队链路通过。

完成记录：选择性移植任务分区、表格密度、hover、错误提示、分页、响应式滚动和详情 Drawer 视觉；保留十状态、合法操作矩阵、RECONCILING 四种核对结果、原因校验、重复提交保护和核对刷新链路。关键测试 30/30、全量测试 201/201，lint/build 通过。

### [x] SYNC-001.5 文件库视觉移植

- 范围：`src/views/FileLibrary.vue`、`src/components/file/FileDetailDrawer.vue`、`src/components/file/FileFolderTree.vue` 和文件库视觉测试。
- 只移植 TDesign 容器、工具栏、表格/网格外观、目录树间距和空错态。
- 不删除或替换当前目录 capability、公共目录、二级目录、批量移动、逐项上传和详情逻辑。
- 验收：文件树与右侧目录内容联动，文件夹操作、批量移动、1GB 单文件上传和独立进度均可回归。

完成记录：选择性移植 TDesign 工具栏、列表/网格容器、目录树间距、空错态、独立滚动和文件卡片边框/hover；保留公共目录 capability、默认目录、二级目录、目录操作、批量移动、逐文件上传进度/1GB/100 文件约束、详情及打印下载。文件库相关测试 58/58、全量测试 202/202，lint/build 通过。

### [x] SYNC-001.6 批量派发视觉移植

- 范围：`src/views/BatchDispatch.vue` 及批量派发测试。
- 可移植步骤、资源表格、预览、确认和结果区域的视觉结构。
- 必须保留 Preview 零副作用、Confirm 四字段、幂等、过期、部分失败和恢复预览。
- 验收：不会因视觉重构创建额外任务、占用打印机或丢失失败项。

完成记录：选择性移植步骤条、资源选择、预览、确认和结果区域的 TDesign 视觉层级、滚动、长文本和响应式布局；保留 Preview 零副作用、Confirm 四字段、幂等、过期、部分失败和恢复预览/重试。相关测试 30/30、全量测试 203/203，lint/build 通过。

### [ ] SYNC-001.7 总览和全屏看板视觉移植

- 范围：`src/views/Dashboard.vue`、`src/views/FullscreenDashboard.vue`、`src/components/FarmDashboard.vue`、`DashboardHeader.vue`、`DashboardDetailsPanel.vue` 和看板测试。
- 可移植统计卡片、趋势、头部、区域切换、空态和响应式布局。
- 暂不接入动态 30×60 网格，网格后端契约另立 `SYNC-002`。
- 验收：REST 初始化、WS 增量、断线/陈旧/恢复、空错态、全屏退出和 Electron 尺寸行为均通过。

### [ ] SYNC-001.8 个人中心和审计视觉移植

- 范围：`src/views/Profile.vue`、`src/views/AuditLog.vue` 及对应测试。
- 可移植卡片、筛选、表单、分页和详情 Drawer 样式。
- 保留字段白名单、脱敏、ADMIN 权限、脏表单取消、改密后重新登录和统一错误提示。
- 验收：不新增未定义字段，不暴露敏感信息，权限与真实接口调用不变。

### [ ] SYNC-001.9 全量验收和集成交付

- 执行 `npm test`、`npm run lint`、`npm run build`、普通浏览器回归和 Electron/desktop-mock 回归。
- 检查 800×560、1024×640、1200×760、1440×900、1920×855 下页面溢出、滚动所有者、弹窗和详情 Drawer。
- 执行 `git status --short`、`git diff --check`，只暂存本 Spec 实际文件并创建 Conventional Commit。
- 验收通过后只推送新的集成分支，不直接覆盖 `origin/feat/ui-003-electron`。

## 依赖关系

```text
SYNC-001.0 → SYNC-001.1 → SYNC-001.2
                         ├→ SYNC-001.3 → SYNC-001.7
                         ├→ SYNC-001.4 → SYNC-001.6
                         ├→ SYNC-001.5
                         └→ SYNC-001.8
SYNC-001.3–SYNC-001.8 → SYNC-001.9
```

## 非目标

- 不修改后端、数据库、接口路径和正式字段。
- 不删除当前功能测试来迁就远程分支。
- 不使用远程旧版 API、Mock 或文件库实现替换本地功能。
- 不实施动态网格布局；需后端契约确认后另立任务。
