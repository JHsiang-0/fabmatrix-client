# FabMatrix 独立前端 UI 整改任务清单

任务：UI-001 独立前端 UI/UX 整改  
所属 Spec：farm-ui-remediation  
状态说明：[ ] 待完成；[x] 已完成；[-] 有条件跳过并记录原因  
视觉基线：FRONTEND_UI_SPECIFICATION.md

## 0. 任务边界

- 本任务不属于 farm-ui-v2，不修改 v2 任务勾选状态。
- 不新增或猜测 API、字段、业务状态和数据。
- 不修改登录页和首次管理员初始化页已有主视觉。
- 不修改 src/stores/printerStore.js.backup。
- 不执行 git push。
- 每个子任务只暂存本子任务实际修改的文件。

## 1. UI-001 总体验收

### [x] UI-001.0 整改基线和运行实例确认

范围：

- 读取本 Spec、FRONTEND_UI_SPECIFICATION.md、API_HANDOFF.md 和 v2 文档。
- 检查前端地址、Mock 地址、后端健康检查和运行时 OpenAPI。
- 确认实际页面不是旧 Bundle 或旧开发服务器。
- 建立主要页面截图和问题清单。

验收：

- 记录前端实际访问地址和版本来源。
- 记录后端健康状态、OpenAPI 地址和 Swagger UI 访问差异。
- 记录主要页面当前截图。
- 说明 5173、5174 和 Electron 的环境差异。

提交建议：docs: 建立独立 UI 整改验收基线

基线记录：baseline.md。5174 当前无法从终端或浏览器重新导航复现，5173 直接导航后的会话连续性风险已记录；两项转入后续子任务和最终 Electron/浏览器验收，不作为已验证功能。

### [x] UI-001.1 App Shell 和滚动模型

范围：

- src/layout
- src/styles
- 公共页面壳和必要的 Loading 容器

要求：

- 固定 Sidebar、Header、Content 尺寸和间距 token。
- 明确页面、表格、目录树和 Drawer 的滚动所有者。
- 改造互相冲突的 height、overflow 和绝对定位布局。
- 窄屏 Sidebar 不保留桌面布局宽度。

验收：

- 五个目标视口无页面级水平溢出。
- 页面底部、表格分页和 Drawer Footer 完整可见。
- Table、Drawer、文件树可以独立滚动。
- 登录页无视觉回归。

提交建议：fix: 统一独立 UI 整改的应用壳滚动模型

完成记录：页面壳恢复自然纵向高度，滚动责任收敛到 App Content View、TDesign Table 内容区和 Drawer Body；已通过单元测试、浏览器 E2E、Oxlint、ESLint 和生产构建。

### [x] UI-001.2 公共页面模式

范围：

- Page Header
- Query Toolbar
- Data Region
- AsyncState
- Status Tag
- 相关公共组件和语义 token

验收：

- 页面不存在重复标题。
- 主操作层级一致。
- 状态文案、颜色和图标跨页面一致。
- Loading、Empty、Error 不依赖单一 Toast。

提交建议：feat: 建立独立 UI 整改公共页面模式

完成记录：新增 PageHeader、QueryToolbar、DataRegion、StatusTag 公共组件和状态视图模型；打印机、任务、看板及详情组件复用统一状态 Tag；AsyncState 提供区域级 Loading/Empty/Error 与重试语义；已通过单元测试、Oxlint、ESLint 和生产构建。

### [x] UI-001.3 服务器连接和认证入口

范围：

- ServerConnection.vue
- 登录和首次初始化相关反馈，不重做既有主视觉

验收：

- IP/Host 与端口分离。
- 测试不会意外保存配置。
- 保存并连接成功后进入正确认证流程。
- 初始化未开放、已初始化、请求失败三种状态可区分。
- 登录双栏、动画角色、品牌和表单视觉保持。

提交建议：fix: 完善独立 UI 整改的连接与初始化入口

完成记录：复核服务器连接页已使用正式健康检查接口，IP/Host 与端口独立输入，测试和保存并连接动作分离且仅后者持久化；登录页通过正式初始化状态接口原位切换初始化模式并提供重试，保留既有登录/初始化主视觉；未展示后端未提供的局域网服务器发现。补充 UI 契约测试并通过浏览器回归、全量测试、Oxlint、ESLint 和生产构建。

### [x] UI-001.4 打印机管理和详情 Drawer

范围：

- PrinterManage.vue
- 打印机详情组件
- 打印机状态适配器和相关测试

验收：

- 列表提供显式详情入口。
- 详情使用正式接口，不由列表行拼装。
- 不出现 undefined、伪造温度和伪造详情。
- Drawer Header/Footer 固定，Body 独立滚动。
- 表格最后一行、分页和操作列完整可见。
- ADMIN/OPERATOR 权限和按钮显隐正确。

提交建议：fix: 重构独立 UI 整改的打印机管理体验

完成记录：打印机列表改为核心字段优先，使用 TDesign Table 明确局部高度滚动并保留分页；新增显式详情入口，刷新失败保留已有权威数据；详情 Drawer 稳定回退标题、独立 Body 滚动，并保证历史/统计请求在切换设备后正确收敛 Loading 状态。已通过打印机专项测试、全量测试、浏览器回归、Oxlint、ESLint 和生产构建。

### [x] UI-001.5 文件库工作台

范围：

- FileLibrary.vue
- 文件树、文件列表、文件详情和上传相关组件

验收：

- 目录、搜索、视图切换和分页状态同步。
- Table 为大数据量默认视图，Grid 为可选视图。
- 空目录有下一步操作。
- 上传失败可区分可重试与不可重试。
- 文件详情不显示内部存储字段。
- 桌面和窄屏均可完成上传或创建任务。

提交建议：fix: 重构独立 UI 整改的文件库工作台

完成记录：文件库页头和筛选区接入公共 PageHeader/QueryToolbar，默认使用 TDesign Table 列表并保留网格显式切换；目录树、文件结果和分页的滚动边界重新收敛，刷新失败保留已有结果，文件行提供详情/打印/删除明确入口。继续复用正式 fileName、materialType、parentId、folder 和分页契约；已通过文件库专项测试、全量测试、浏览器回归、Oxlint、ESLint 和生产构建。

### [x] UI-001.6 任务队列、活动任务和历史

范围：

- JobQueue.vue
- JobHistory.vue
- 任务详情 Drawer
- 任务状态和动作适配器

验收：

- 待派发只显示 QUEUED。
- 活动任务与历史使用独立数据集和页面表达。
- 少量数据时页面高度自然。
- 操作列显式展示详情和合法动作。
- 409/422 失败后列表和详情恢复服务端状态。

提交建议：fix: 优化独立 UI 整改的任务队列工作流

完成记录：待派发、活动任务和历史继续使用独立真实数据集与状态语义；任务表格仅在数据量足够时启用 TDesign 局部滚动，少量数据保持自然高度；列表刷新和任务动作失败保留已有数据并提供页面内重试或重新同步；队列与历史均提供显式详情入口。已通过任务中心专项测试、全量测试、Playwright 浏览器回归、Oxlint、ESLint 和生产构建。

### [x] UI-001.7 批量派发向导

范围：

- BatchDispatch.vue
- 批量预览、确认和结果相关组件

验收：

- 选择、策略、预览、确认、结果五步清晰可回退或前进。
- 预览不会创建任务。
- 部分失败保留逐项结果。
- 失败项只在 retryable=true 时出现重试入口。

提交建议：fix: 优化独立 UI 整改的批量派发向导

完成记录：批量派发改为单步工作区，仅渲染当前步骤内容；资源选择、策略配置、无副作用预览、确认执行和逐项结果均提供明确的前进/回退入口，保留计划版本、确认令牌、幂等回放和 retryable 恢复契约。已通过批量派发专项测试、全量测试、Playwright 浏览器回归、Oxlint、ESLint 和生产构建。

### [x] UI-001.8 管理中心、个人中心和全局反馈

范围：

- UserManagement.vue
- AuditLog.vue
- Profile.vue
- 全局通知、403/404/503 和实时连接提示

验收：

- 页面不使用大片无意义留白。
- 日志原始动作转换为用户文案。
- 用户权限和敏感字段不越权。
- 失败刷新保留已有内容。
- 退出、会话失效、实时断开和恢复状态同步。

提交建议：fix: 完善独立 UI 整改的管理与全局反馈

完成记录：用户管理、操作日志和个人中心统一使用公共 PageHeader；列表刷新失败保留已有权威数据并提供页面内重试，少量数据保持自然高度；审计动作与目标转换为用户文案并继续限制白名单字段；个人资料和改密错误原位展示；应用 Header 增加真实实时连接、陈旧和恢复状态及重连入口。已通过管理/日志/个人中心专项测试、全量测试、Playwright 浏览器回归、Oxlint、ESLint 和生产构建。

### [x] UI-001.9 Tailwind 和遗留 CSS 收口

范围：

- 业务页面自定义 CSS
- tailwind.config.js
- 公共 token 和兼容表格层

验收：

- 业务页面不出现第二套颜色和按钮体系。
- 登录页样式无回归。
- 删除重复 CSS 后页面无布局回归。
- 未通过增大局部高度掩盖滚动问题。

提交建议：refactor: 收口独立 UI 整改的遗留样式

完成记录：收口 Tailwind 自定义颜色为 TDesign 语义 token，统一 sans 字体来源；删除无调用方且与 Tailwind 插件重复的 `src/styles/responsive.css` 及入口引用，保留登录页视觉和仍在使用的布局辅助类。已通过样式治理专项测试、全量测试、Playwright 浏览器回归、Oxlint、ESLint 和生产构建。

### [x] UI-001.10 真实浏览器和 Electron 视觉验收

范围：

- Playwright 浏览器测试
- Electron smoke/视觉测试
- 主要页面截图和验收报告

验收：

- 使用真实点击、输入、键盘、Drawer、Dialog、分页和滚动。
- 使用真实 Mock/API 数据量，不复制 DOM 制造滚动。
- 页面稳定后再截图。
- 覆盖成功、空、错误、403、409、503、断线和恢复。
- 登录、文件、创建任务、派发和详情主流程可完成。
- 记录未能验证的真实后端、设备或 CORS 条件。

完成记录：使用 Playwright 浏览器项目覆盖 375/768/1440/1920 四个视口，完成登录、逐页导航、文件库、任务创建/派发预览确认、连接地址拆分操作、打印机和文件滚动、任务详情 Drawer 与 Escape 关闭；新增移动端表格固定列遮挡回归，修复侧栏层级。Electron 使用隔离临时用户目录完成启动、登录、窗口尺寸/横向溢出、打印机、服务器连接、文件库和全屏看板冒烟。测试坚持真实点击/输入/键盘/滚动，未复制 DOM 制造滚动，截图在稳定状态后生成。真实后端、实体打印机、生产 CORS 与真实局域网发现未在 Mock/desktop-mock 环境中验证，不能据此宣称通过。

修改文件：`electron/main.cjs`、`src/components/layout/AppSidebar.vue`、`src/layout/index.vue`、`tests/e2e/browser.spec.js`、`tests/e2e/electron.spec.js`、本任务记录。

用户流程影响：移动端侧栏在表格固定列页面可被真实点击，桌面端保留全屏看板入口；Electron E2E 使用隔离临时用户目录，不影响开发环境单实例和用户数据。

API/OpenAPI 核对：本子任务未新增接口或字段，继续使用项目正式 Mock/desktop-mock 数据与既有页面调用链。

Loading/Empty/Error：沿用前序页面状态整改，并在浏览器流程中覆盖登录、数据加载后的成功视图和既有重试/空态；真实 403/409/503 与断线恢复的生产联调仍需后端环境。

响应式视口：浏览器 375/768/1440/1920 全部通过；Electron 桌面窗口通过尺寸和横向溢出检查。

测试：`npm test`、`npx playwright test --project=browser --reporter=line`（9/9）、`npx playwright test --project=electron --reporter=line`（1/1）。

lint：`npx oxlint .`、`npx eslint . --no-cache`。

build：`npm run build`、`npm run build:mock`、`npm run build:desktop`、`npm run build:desktop:mock` 均通过；保留既有 chunk 体积和 realtimeStore 动静态导入提示。

git status --short：提交前确认仅包含本子任务文件和用户既有的 `AGENTS.md` 修改，后者不暂存。

git diff --check：通过。

提交：完成最终验证后创建独立本地提交 `test: 完成独立 UI 整改的浏览器与 Electron 验收`，不执行 push。

### [x] UI-001.11 打印历史工作台结构重构

范围：

- `src/views/JobHistory.vue`
- 打印历史筛选区、表格内容区和底部分页区

验收：

- 页面整体使用与打印机管理一致的 TDesign 卡片工作台结构。
- 筛选区固定在卡片上方，表格或空状态位于中间内容区。
- 表格数据较多时只滚动内容区，不推动页面和底部分页区。
- “共 X 条数据”和分页器固定在卡片底部，且在空数据、错误和 Loading 状态下仍可达。
- 保留现有历史查询、筛选、详情、重试、重新排队和取消任务功能，不修改 API 契约。
- 兼容窄屏和 Electron 小窗口，不产生页面级横向溢出。

提交建议：`refactor: 重构打印历史工作台布局`

完成记录：打印历史改为与打印机管理一致的 TDesign 卡片工作台结构，筛选区固定在卡片主体上方，表格/空状态收敛到独立内容区，底部统计和分页器移动到卡片 footer；移除按数据量动态设置表格高度的逻辑，保留历史查询、筛选、详情、重试、重新排队和取消任务链路。已通过 `npm run lint` 和 `npm run build`。

修改文件：`src/views/JobHistory.vue`、本任务记录。

验证说明：`npm test` 共 142 项，139 项通过、3 项失败；失败项为既有任务队列结构断言，涉及 `JobQueue.vue` 的旧 `job-panel`、局部滚动和 `StatusTag` 预期，与本任务修改范围无关，未为通过测试而回退任务队列融合结果。

### [x] UI-001.12 打印历史筛选栏 TDesign 重构

范围：
- `src/views/JobHistory.vue`
- 打印历史页面顶部筛选区域

目标：
- 使用 TDesign Form/FormItem 统一筛选项的语义、标签和布局。
- 保留任务状态、打印机 ID、时间范围、查询和重置功能，不修改 API 契约。
- 大窗口保持紧凑横向布局，中小窗口自动换行，不产生页面级横向溢出。
- 查询 Loading、错误、空数据和键盘回车提交行为保持可用。

验收标准：
- 筛选栏视觉层级、控件高度和间距统一，符合 TDesign 默认主题。
- 查询和重置按钮位置明确，输入项在 375、768、1024、1440 宽度下均可访问。
- 不影响表格、分页、详情抽屉和其他页面的现有功能。
- 完成 `npm run lint`、`npm run build` 和 `git diff --check` 验证。

完成记录：打印历史筛选区改用 TDesign Form/FormItem、Space、Select、Input 和 DateRangePicker，统一标签与控件布局；查询操作保留表单提交和回车行为，重置按钮使用 outline 变体；通过局部响应式样式实现横向紧凑布局和小屏单列布局，未修改 API、表格、分页或详情抽屉。

验证说明：`npm run lint` 和 `npm run build` 通过，`git diff --check` 通过。`npm test` 共 142 项，139 项通过、3 项失败；失败项为既有 `JobQueue.vue` 结构断言（旧 `job-panel`、局部滚动和 `StatusTag` 预期），与本任务修改范围无关。

### [x] UI-001.13 批量派发资源选择区 TDesign 表格化

范围：

- `src/views/BatchDispatch.vue`
- 批量派发第一步的步骤条、上传入口、文件选择表格和打印机选择表格

目标：

- 移除步骤条中与页面内容重复的辅助小字，压缩首屏垂直空间。
- 将批量上传移动到文件选择区，以 TDesign Dialog 作为低频操作入口，保留多文件校验、上传进度、失败重试和资源刷新反馈。
- 使用 TDesign Table 多选行替代文件和打印机 Checkbox 列表，展示稳定的文件名/ID/材料类型及打印机/IP/状态字段。
- 保留既有资源加载、选择校验、预览、确认和错误处理契约，不新增或伪造后端字段。
- 选择表格在资源较多和窄屏场景下可滚动，不产生页面级横向溢出。

验收标准：

- 第一步只展示简洁的五阶段步骤标题，文件和打印机选择均通过表格行选择完成。
- “批量上传”按钮位于文件选择卡片标题区域，打开弹窗后仍可选择、上传、取消和重试文件。
- 选择计数与 `selectedFileIds`、`selectedPrinterIds` 实时同步，下一步按钮和后续预览请求行为不变。
- 文件、打印机为空时仍显示对应 TDesign Empty；资源加载时表格显示 Loading。
- 完成 `npm test`、`npm run lint`、`npm run build` 和 `git diff --check`，并记录既有失败项（如有）。

完成记录：批量派发第一步已移除步骤说明小字，批量上传改为文件选择卡片内的 TDesign Dialog；文件和打印机资源改用 TDesign Table 多选行，保留资源加载、空态、上传进度、失败重试、选择校验、预览和确认链路。表格使用局部滚动容器适配较多资源和窄屏，不修改 API 契约。

验证说明：批量派发专项测试 `node --test tests/batchDispatch.test.js tests/batchDispatchPage.test.js` 9/9 通过；`npm run lint`、`npm run build` 和 `git diff --check` 通过。完整 `npm test` 共 142 项，139 项通过、3 项失败；失败项为既有 `JobQueue.vue` 结构断言，与本任务修改范围无关。浏览器 E2E 因当前工作区缺少 `@playwright/test` 未能启动，未修改依赖或锁文件。

### [x] UI-001.14 批量派发首步全高布局与标题操作区优化

范围：

- `src/views/BatchDispatch.vue`
- 批量派发页面标题操作区和首步资源选择工作区

目标：

- 移除“批量手动派发”标题下重复的说明文字，减少首屏冗余信息。
- 将“下一步：配置策略”放入页面顶部操作区，与“刷新资源”并列，避免额外占用底部空间。
- 让文件和打印机两个选择卡片共同填满页面剩余高度，表格在卡片内部继续承担资源较多时的滚动。

验收标准：

- 首步标题下不再显示说明副标题，刷新资源和下一步按钮均位于顶部操作区。
- 两个资源选择卡片从步骤条下方延伸到页面底部，窗口变化时不产生页面级横向溢出。
- 下一步按钮的禁用条件、选择计数、资源表格、上传弹窗和后续步骤行为保持不变。
- 完成批量派发专项测试、`npm run lint`、`npm run build` 和 `git diff --check`。

完成记录：批量派发标题移除重复说明，下一步配置策略按钮移动到顶部刷新资源右侧；首步资源选择网格改为弹性高度，文件和打印机卡片共同填满可用工作区，表格在卡片内部继续滚动，未修改上传、选择和后续派发流程。

验证说明：批量派发专项测试 `node --test tests/batchDispatch.test.js tests/batchDispatchPage.test.js` 9/9 通过；`npm run lint`、`npm run build` 和 `git diff --check` 通过。浏览器 E2E 当前因工作区缺少 `@playwright/test` 未能启动，未修改依赖或锁文件。

### [x] UI-001.15 批量派发表格交互与状态标签统一

范围：

- `src/views/BatchDispatch.vue`
- 批量派发首步文件和打印机资源表格

目标：

- 参考 TDesign Table 多选示例，启用点击行选中并保持受控选中状态。
- 打印机状态复用项目公共 `StatusTag`，使用带图标的 `light-outline` 主题表达状态。
- 保留现有资源字段、选择计数、局部滚动、Loading/Empty 和后续派发流程。

验收标准：

- 文件和打印机表格均支持点击行选中/取消，表头多选和 `selected-row-keys` 仍可用。
- 打印机状态显示项目统一的标签文案、图标和主题色，不引入审批示例字段或业务状态。
- 完成批量派发专项测试、`npm run lint`、`npm run build` 和 `git diff --check`。

完成记录：批量派发首步文件和打印机表格启用 TDesign 点击行选中，继续通过 `selected-row-keys` 受控同步；打印机状态复用公共 `StatusTag`，改为带图标的 `light-outline` 标签，未改变资源字段和派发流程。

验证说明：批量派发专项测试 `node --test tests/batchDispatch.test.js tests/batchDispatchPage.test.js` 9/9 通过；`npm run lint`、`npm run build` 和 `git diff --check` 通过。构建仅保留既有动态导入和大 chunk 提示。

### [x] UI-001.16 操作日志筛选操作区布局优化

范围：

- `src/views/AuditLog.vue`
- 操作日志筛选表单的字段间距与查询操作区

目标：

- 将查询、重置按钮与筛选字段放在同一排的操作区，避免按钮单独掉到下一行。
- 使用响应式网格重新分配字段宽度和左右间距，大屏保持紧凑横向布局，小屏自动换行。
- 保留原有查询、重置、回车提交、分页和日志表格逻辑。

验收标准：

- 大屏下操作者、动作、目标类型、目标 ID、结果、时间范围和操作按钮按一行对齐。
- 1280px 以下按四列布局、768px 以下按单列布局，控件不会被压缩或产生页面级横向溢出。
- 完成操作日志相关测试、`npm run lint`、`npm run build` 和 `git diff --check`。

完成记录：操作日志筛选表单改为响应式网格，查询和重置按钮与筛选项在大屏同排，并按中等窗口和窄屏断点自动换行；通过统一控件宽度与间距避免筛选项被挤压，未修改查询字段、请求参数和表格逻辑。

验证说明：操作日志相关测试 10/10 通过；`npm run lint`、`npm run build` 和 `git diff --check` 通过。构建仅保留既有动态导入和大 chunk 提示。

### [x] UI-001.17 个人中心账户工作台重构

范围：

- `src/views/Profile.vue`
- 个人中心账户概览、资料设置和账户安全区域

目标：

- 参考个人工作台的信息层级，在页面顶部增加简洁的账户概览区，集中展示当前用户身份、角色和用户 ID。
- 使用 TDesign 卡片、头像、标签、描述列表和表单组件重排资料设置与账户安全区域，保持 TDesign 默认主题色和组件行为。
- 保留现有个人资料加载/保存、取消修改、字段校验、密码修改确认、退出登录、Loading、Error 和重试逻辑，不新增接口、Store 字段或路由。
- 不引入参考页面中的虚构团队、产品、统计图表或外部 Tailwind/渐变视觉体系。

验收标准：

- 个人中心在桌面宽度下形成“账户概览 + 双栏设置”的清晰结构，窄屏自动变为单列，页面不产生意外的水平溢出。
- 当前用户名、角色和用户 ID 来自已认证 Store；资料和密码区域继续使用既有真实 API 与提交反馈。
- 资料加载失败可原位重试，资料未保存修改可取消，密码提交继续校验并在成功后退出到登录页。
- 完成个人中心专项测试、`npm run lint`、`npm run build` 和 `git diff --check`。

提交建议：feat: 重构个人中心账户工作台

完成记录：个人中心新增基于 Store 身份信息的账户概览卡片，使用 TDesign Avatar、Tag、Descriptions 和 Card 形成清晰的账户信息层级；资料设置与账户安全改为响应式双栏卡片，窄屏自动单列。保留个人资料加载/保存、取消修改、字段校验、密码修改确认、改密成功退出登录、原位错误提示和重试逻辑，未新增接口、Store 字段或路由。

验证说明：个人中心专项测试 4/4 通过；`npm run lint` 通过；`npm run build` 通过；`git diff --check` 通过。构建仅保留项目既有动态导入和大 chunk 提示。

## 2. 执行顺序

UI-001.0 → UI-001.1 → UI-001.2 → UI-001.3 → UI-001.4 → UI-001.5 → UI-001.6 → UI-001.7 → UI-001.8 → UI-001.9 → UI-001.10 → UI-001.11 → UI-001.13 → UI-001.14 → UI-001.15 → UI-001.16 → UI-001.17

UI-001.0、UI-001.1 和 UI-001.2 是页面整改前置条件。发现 API 或状态契约冲突时暂停对应子任务并记录，不得在 UI 层伪造解决方案。

## 3. 每个子任务完成模板

子任务：

修改文件：

用户流程影响：

API/OpenAPI 核对：

Loading/Empty/Error：

响应式视口：

测试：

lint：

build：

git status --short：

git diff --check：

提交：

## 4. 总体验收结论

只有所有必选子任务完成、主要业务页面统一采用 TDesign 默认语言、真实 API 数据与页面状态一致、主要视口和 Electron 通过验收、每个子任务有独立提交后，才可将 UI-001 标记为完成。

## 5. UI-002 Electron 优先二次整改

任务批次：UI-002
前置资料：`FRONTEND_UI_SPECIFICATION.md`、本 Spec 的 `requirements.md` 与 `design.md`、`API_HANDOFF.md`、运行时 `/v3/api-docs`  以及 `test-results/electron-ui-audit/ELECTRON_FRONTEND_UI_UX_AUDIT.md`

范围：只整改当前 Electron 桌面应用及其共享业务页面，不更换技术栈，不修改 `farm-ui-v2`，不重做登录页和首次管理员初始化页的既有主视觉。

统一门禁：

- 每个 UI-002 子任务单独完成、单独验证、单独本地提交。
- 涉及 Vue/JavaScript 时执行相关测试、`npm run lint` 和 `npm run build`；lint 自动修复产生的改动必须人工检查。
- 提交前执行 `git status --short`、`git diff --check`，只暂存当前子任务文件，禁止 `git add .`。
- 不得新增或猜测 API、字段、状态、业务数据；契约冲突时暂停并记录。
- 不执行 `git push`，不修改或引用 `src/stores/printerStore.js.backup`。
- 每项记录 Loading、Empty、Error、状态同步、Electron 窗口尺寸和未验证的真实环境限制。

### [x] UI-002.0 Electron 运行基线与版本一致性

优先级：P0
范围：`electron/main.cjs`、`electron/preload.cjs`、`vite.config.js`、`playwright.config.js`、`tests/e2e/electron.spec.js`、桌面启动文档（如需）

工作内容：

- 记录 Electron 开发、desktop-mock、打包产物分别加载的 URL/Bundle、API 目标、WebSocket 目标和用户数据目录。
- 核对窗口标题、品牌名称、最小/默认窗口尺寸和全屏 IPC 状态同步。
- 增加不依赖生产凭据的 Electron 运行诊断或测试证据，不能以静态字符串伪造运行结果。

验收：

- Electron 不使用过期开发服务器或旧 Bundle。
- 800×560、1024×640、1200×760 可启动并进入登录/主工作区。
- 开发 Mock 与真实后端边界记录清楚；真实后端未验证时明确标记。
- 完成后提交：`docs: 建立 Electron UI-002 运行基线`（若包含代码测试，则按代码任务门禁执行）。

完成记录：Electron 主进程增加只读运行诊断，记录 appId、版本、运行模式、渲染资源来源、隔离用户目录和窗口边界；preload 暴露诊断入口；渲染层记录 Vite mode、BASE_URL、API 基地址、WebSocket 地址和 Mock 模式。桌面页面标题由 Web 统一为 Desktop。Playwright 增加真实 BrowserWindow 内容尺寸回归，使用 800×560、1024×640、1200×760 验证窗口尺寸和文档宽度；增加 dist-file smoke，实际加载 `dist/index.html`，不登录、不写业务数据。

修改文件：`AGENTS.md`、`electron/main.cjs`、`electron/preload.cjs`、`index.html`、`package.json`、`playwright.config.js`、`src/main.js`、`tests/e2e/electron.spec.js`、`tests/e2e/electron-dist.spec.js`。

用户流程影响：不改变业务接口和登录/初始化主视觉；Electron 开发模式与 desktop 构建产物的资源来源、窗口尺寸和运行配置现在有可重复诊断证据。

API/OpenAPI 核对：未新增接口、字段或业务数据；渲染层诊断只读取现有环境配置，业务 API 仍按 API_HANDOFF 和既有 request 层执行。

Loading/Empty/Error：本子任务不改变业务状态处理；dist-file smoke 不登录、不触发业务写操作，真实后端和实体设备状态仍由后续子任务验证。

响应式视口：Electron 实际 BrowserWindow 内容尺寸覆盖 800×560、1024×640、1200×760；开发模式通过无页面级水平溢出检查，构建模式通过 dist-file 启动和无页面级水平溢出检查。

测试：`npm test`（139/139）、`npm run test:electron`（1/1）、`npm run test:electron:dist`（包含 `npm run build:desktop`，1/1）。

lint：`npm run lint` 通过，Oxlint 和 ESLint 均无错误。

build：`npm run build`、`npm run build:desktop` 通过；保留既有 realtimeStore 分包提示和大 chunk 警告。

git status --short：提交前仅包含 UI-002.0 的运行诊断、Electron 测试、构建配置、AGENTS 说明和本任务记录。

git diff --check：通过。

提交：完成最终检查后创建独立本地提交 `feat: 完成 UI-002.0 Electron 运行基线`，不执行 push。

### [x] UI-002.1 App Shell 与滚动所有权复验

优先级：P0
范围：`src/layout`、`src/styles`、公共布局/状态组件、相关 Electron E2E

工作内容：

- 在 Electron 三个窗口尺寸复验 Sidebar、Header、Content、PageHeader、数据区和 Drawer。
- 收敛 `body`、App Shell、Content View、Table、文件树和 Drawer 的 overflow 责任。
- 验证登录页和首次初始化页不发生视觉回归。

验收：

- 页面底部、表格分页、固定操作列、Drawer Footer 均可通过滚动访问。
- 不新增绝对定位或多层 `overflow:hidden` 掩盖布局问题。
- 真实滚轮、Shift+滚轮/横向滚动、Tab、Escape 均有可重复测试。
- 完成后提交：`fix: 收敛 Electron 应用壳滚动模型`。

完成记录：为 `app-main-layout` 增加明确的 flex 收缩和最小高度约束，移除 `app-content__inner` 对 `height:100%` 的重复依赖，保留 Content View 作为页面纵向滚动 owner。Electron 测试新增实际 BrowserWindow 尺寸回归和打印机页真实滚轮验证，覆盖 800×560、1024×640、1200×760，并检查 body/App Shell/Main Layout 无额外纵向滚动、页面无水平溢出。

修改文件：`src/layout/index.vue`、`tests/e2e/electron.spec.js`、本任务记录。

用户流程影响：不改变业务页面数据和登录/初始化视觉；Electron 小窗口下页面壳可以收缩，内容滚动、打印机页滚轮和页面底部可达性有自动化门禁。

API/OpenAPI 核对：未新增接口、字段或业务数据；本子任务只调整 Layout CSS 和 Electron 交互测试。

Loading/Empty/Error：未改变业务状态组件；后续打印机、文件、任务子任务继续验证各自局部状态。

响应式视口：Electron 实际 BrowserWindow 内容尺寸覆盖 800×560、1024×640、1200×760；三尺寸检查页面无水平溢出，Content View 使用 `overflow-y:auto`，打印机页通过真实滚轮产生滚动。

测试：`npm test`（139/139）、`npm run test:electron`（2/2）。

lint：`npm run lint` 通过，Oxlint 和 ESLint 均无错误。

build：`npm run build`、`npm run build:desktop` 通过；保留既有 realtimeStore 分包提示和大 chunk 警告。

git status --short：提交前仅包含 `src/layout/index.vue`、`tests/e2e/electron.spec.js` 和本任务记录。

git diff --check：通过。

提交：完成最终检查后创建独立本地提交 `fix: 收敛 Electron 应用壳滚动模型`，不执行 push。

### [x] UI-002.2 打印机管理与详情 Drawer 闭环

优先级：P0
范围：`src/views/PrinterManage.vue`、`src/components/device/DeviceDetailDrawer.vue`、打印机 API/Store/状态适配器、相关测试

工作内容：

- 先核对正式 OpenAPI 详情、历史、统计和控制接口，再调整 UI；接口不明确时暂停。
- 让详情入口稳定可见，列表以核心字段为主，低频字段进入详情。
- 修复详情加载、标题回退、切换设备、空字段、失败重试、固定 Footer 和焦点返回。
- 修复小窗口下表格横向滚动、固定操作列、最后一行和分页可达性。

验收：

- 不出现 `undefined`、epoch 零时间、伪造温度或伪造设备详情。
- 详情确实来自正式详情请求，列表行不拼装详情。
- ADMIN/OPERATOR 操作显隐与后端权限一致。
- 删除、重连或控制失败后重新同步服务端状态。
- 完成后提交：`fix: 闭环 Electron 打印机详情工作流`。

完成记录：核对并继续使用正式打印机详情、状态历史、统计和控制接口；详情 Drawer 改为标准受控 `v-model:visible`，使用 TDesign Header 与显式关闭按钮，稳定展示真实设备名称并保留 Drawer Body 独立滚动。修复状态历史渲染缺失 `formatDateTime` 导致的 Vue 更新异常，补充无 `undefined`、详情字段、滚动尺寸和关闭操作的 Electron 回归，打印机图标尺寸改为 TDesign 组件要求的字符串属性。

修改文件：`src/components/device/DeviceDetailDrawer.vue`、`src/views/PrinterManage.vue`、`tests/e2e/electron.spec.js`、`tests/printerCenter.test.js`、本任务记录。

用户流程影响：Electron 中从打印机列表打开详情后，可以看到稳定的设备标题、设备信息、实时/历史/统计区域；详情过长时由 Drawer Body 独立滚动，Header 关闭按钮可用，关闭后返回打印机列表上下文。列表仍由 UI-002.1 的 TDesign Table 局部滚动模型承载。

API/OpenAPI 核对：未新增接口、字段或业务数据；详情使用 `GET /api/v1/printers/{id}`，历史使用 `GET /api/v1/printers/{id}/history`，统计使用 `GET /api/v1/printers/{id}/statistics`，控制和安全确认继续复用既有正式 API 与权限约束。未验证真实实体设备控制，仅在 desktop-mock 运行链路验证页面行为。

Loading/Empty/Error：保留详情加载、详情失败重试、统计/历史分别加载与分别失败的 TDesign 状态；缺少实时数据、统计数据或历史数据时继续显示正式字段占位和空状态，不以列表行伪造详情或温度。

响应式视口：Electron 详情回归在实际桌面壳中执行，验证 TDesign Drawer Body 的 `overflow-y:auto` 且内容高度超过可视高度；应用壳 800×560、1024×640、1200×760 的滚动和无水平溢出由 UI-002.1 测试继续覆盖。

测试：`npm test`（139/139）、`npm run test:electron`（2/2）。

lint：`npm run lint` 通过，Oxlint 和 ESLint 均无错误。

build：`npm run build`、`npm run build:desktop` 通过；保留既有 realtimeStore 分包提示和大 chunk 警告。

git status --short：提交前仅包含本子任务的打印机 Drawer、打印机图标告警修复、打印机专项断言和本任务记录。

git diff --check：通过。

### [x] UI-002.3 文件库工作台统一

优先级：P1
范围：`src/views/FileLibrary.vue`、文件树/文件详情/上传组件、文件 API/Store、相关测试

工作内容：

- 保持 TDesign Table 为默认视图，Grid 作为同一数据状态的可选视图。
- 统一目录上下文、搜索、材质筛选、选择集、分页、刷新和上传状态。
- 重新梳理文件夹与文件的打开、详情、打印、删除、创建任务入口。
- 消除旧界面残留的卡片层级、重复标题和无意义固定高度。

验收：

- Electron 800×560 下仍能完成上传/创建文件夹/打开目录/创建任务路径。
- 目录树和文件列表滚动边界清晰，不相互抢滚轮。
- 空目录、无结果、上传部分失败、刷新失败均提供原位状态和下一步。
- 文件详情不展示内部存储字段，所有字段来自正式契约。
- 完成后提交：`fix: 重构 Electron 文件库工作台`。

完成记录：文件库改为单一 TDesign `DataRegion` 工作台，默认列表视图使用 TDesign Table，网格视图仅作为同一分页数据的可选表达；目录树、面包屑、文件名/材质筛选、批量选择、分页和刷新均共享当前目录上下文。空目录提供新建文件夹和上传下一步，列表失败保留已有数据并提供区域重试，上传结果继续按正式批量上传契约区分成功、可重试失败和不可重试项。文件夹打开、根目录返回、文件详情、打印任务、下载和删除入口统一，详情抽屉改为受控 TDesign Drawer、Descriptions、Alert 和 Table，移除旧版 Tailwind 卡片拼装及内部存储字段展示。

修改文件：`src/views/FileLibrary.vue`、`src/components/file/FileDetailDrawer.vue`、`tests/fileLibrary.test.js`、`tests/e2e/electron.spec.js`、本任务记录。

用户流程影响：Electron 800×560 下可以通过真实点击打开文件库、切换目录并返回根目录、打开上传和新建文件夹对话框、打开文件详情并关闭、从文件进入创建打印任务；列表和目录树拥有各自清晰的滚动边界，页头操作和当前目录上下文保持可见。

API/OpenAPI 核对：未新增接口、字段或业务数据；继续使用 `POST /api/v1/print-files/page` 的 `pageNum`、`pageSize`、`fileName`、`materialType`、`parentId`，`GET /api/v1/print-files/tree`，`POST /api/v1/print-files/folder/create`，单/批量上传，预览、缩略图、关联任务、下载、单项删除和批量删除正式接口；创建打印任务继续使用既有 `fileId`、可选 `printerId`、`priority` 和幂等键。详情只展示 `PrintFilePreviewVO` 的安全字段，不展示 `safeName`、`rustfsKey`、`fileUrl` 等内部字段。

Loading/Empty/Error：目录树和列表分别提供 TDesign Loading、Error/Retry 和 Empty/下一步；刷新失败不清除已有权威结果；缩略图不可用时保留元数据并给出 Warning；上传保留逐项结果、失败原因和 retryable 重试入口；删除和创建任务沿用统一消息与操作中保护。

响应式视口：Electron 实际 BrowserWindow 内容尺寸覆盖 800×560、1024×640、1200×760；文件库回归检查目录树与 Table 内容区局部滚动、窗口级宽度约束，并在 800×560 实际点击上传、创建文件夹、目录导航、详情关闭和创建任务入口。浏览器四视口回归继续覆盖文件库列表/网格滚动。

测试：`npm test`（140/140）、`npm run test:electron`（2/2）、`npm run test:e2e`（9/9）。

lint：`npm run lint` 通过，Oxlint 和 ESLint 均无错误。

build：`npm run build`、`npm run build:desktop` 通过；保留既有 realtimeStore 分包提示和大 chunk 警告。

git status --short：提交前仅包含本子任务的文件库工作台、文件详情抽屉、Electron/文件库测试和本任务记录。

git diff --check：通过。

提交：完成最终检查后创建独立本地提交 `fix: 重构 Electron 文件库工作台`，不执行 push。

### [x] UI-002.4 任务中心与批量派发工作流

优先级：P1
范围：`src/views/JobQueue.vue`、`src/views/JobHistory.vue`、`src/views/BatchDispatch.vue`、任务详情/状态适配器、相关测试

工作内容：

- 复核 QUEUED、活动任务和历史的正式数据集与状态机。
- 固定详情为显式入口，将低频动作收进更多菜单，按状态控制动作。
- 修复缺失时间的展示语义、分页可达性、任务详情 Drawer 和 409/422 恢复。
- 将批量派发收敛为“Steps + 当前步骤单工作区 + 稳定操作栏”。

验收：

- 不展示 `1970-01-01` 等无意义 epoch 值。
- 预览不创建任务；确认执行后保留计划/确认/逐项结果契约。
- 只有 `retryable=true` 的失败项显示重试。
- 小数据量不使用空白撑满内容；底部操作和分页可达。
- 完成后提交：`fix: 优化 Electron 任务工作流`。

完成记录：队列、活动任务和历史页面统一为单一任务工作区，保留 QUEUED、活动任务和历史独立数据集；少量数据保持自然高度，仅在数据量足够时启用 TDesign Table 局部滚动。队列和活动任务保留显式详情入口，低频操作按正式状态收进“更多”，历史筛选接入公共 QueryToolbar；任务详情 Drawer 改为受控 `v-model:visible` 并提供明确关闭按钮。批量派发继续使用五步 TDesign Steps，但每一步只呈现一个当前工作区，保留可回退操作、无副作用预览、确认幂等、逐项结果和 retryable 恢复入口，移除旧版 Card 堆叠。

修改文件：`src/views/JobQueue.vue`、`src/views/JobHistory.vue`、`src/views/BatchDispatch.vue`、`src/components/TaskDetailDrawer.vue`、`tests/taskCenter.test.js`、`tests/batchDispatchPage.test.js`、本任务记录。

用户流程影响：Electron 下可从队列/历史稳定打开和关闭任务详情；队列动作继续按任务状态显示，409/422 后重新读取服务端数据；新建任务、指派、取消、暂停、恢复、重排队和安全确认入口未改变业务语义；批量派发可在当前步骤完成资源选择、策略配置、预览、确认和逐项恢复。

API/OpenAPI 核对：未新增接口、字段或业务数据；队列、活动、历史继续使用既有 `/api/v1/print-jobs/queue`、`/api/v1/print-jobs/active`、`/api/v1/print-jobs/page` 及状态动作接口；任务创建只提交正式 `fileId`、可选 `printerId`、`priority`、`idempotencyKey`；批量派发只复用文件树、打印机列表、预览、确认和 retryable 恢复契约。页面不把任务列表或预览对象扩展为未定义业务字段。

Loading/Empty/Error：队列、活动、历史保留区域级 Loading、Empty、Error/Retry；刷新失败保留已有数据；任务详情加载失败保留列表任务上下文；任务创建、派发和设备动作保持操作中防重复提交，并在失败后重新同步服务端状态；批量上传部分失败和确认结果继续逐项展示，仅对 retryable 项显示恢复入口。

响应式视口：浏览器 375/768/1440/1920 四视口及 Electron 800×560、1024×640、1200×760 均通过现有主流程回归；重点覆盖任务中心详情 Drawer、Escape 关闭、批量派发预览确认和页面级水平溢出。

测试：`npm test`（141/141）、`npm run test:e2e`（9/9）、`npm run test:electron`（2/2）。

lint：`npm run lint` 通过，Oxlint 和 ESLint 均无错误。

build：`npm run build`、`npm run build:desktop` 通过；保留既有 realtimeStore 分包提示和大 chunk 警告。

git status --short：提交前仅包含本子任务的队列、历史、批量派发、任务详情 Drawer、相关测试和本任务记录。

git diff --check：通过。

提交：完成最终检查后创建独立本地提交 `fix: 优化 Electron 任务工作流`，不执行 push。

### [x] UI-002.5 全局反馈与桌面交互语义

优先级：P1
范围：`src/components/layout/AppHeader.vue`、`src/utils`、`src/views/RouteResult.vue`、各页面异步状态、相关测试

工作内容：

- 覆盖 401、403、404、409、422、503、网络失败、WebSocket 断开/陈旧/恢复。
- 让错误在页面或 Drawer 原位展示，保留已有数据和用户上下文。
- 对尚未实现的帮助、设置、通知入口明确 disabled 或移除，不用 Toast 冒充功能。
- 统一 ESC、Dialog/Drawer 关闭、焦点返回和键盘操作。

验收：

- 状态不只依靠颜色表达，Status Tag 文案、主题和图标一致。
- 重试动作不会重复提交或污染其他页面状态。
- 页面刷新、返回、重新登录和实时恢复后的数据状态一致。
- 完成后提交：`fix: 完善 Electron 全局状态反馈`。

完成记录：Header 中通知、帮助、系统设置等尚未有正式业务能力支撑的入口改为明确 disabled 并提供暂未开放说明，不再使用 Toast 冒充功能；实时连接、陈旧、恢复和重连入口继续绑定真实 realtime Store。任务与文件详情 Drawer 统一使用 TDesign 受控 `v-model:visible`、显式关闭按钮和 Escape 关闭，页面级错误继续通过区域 Alert/Retry 保留上下文，请求层错误保留正式 HTTP/业务码映射和去重提示。

修改文件：`src/components/layout/AppHeader.vue`、`tests/accessibilityInteraction.test.js`、本任务记录。任务/文件 Drawer 的受控关闭能力已分别在 UI-002.3 和 UI-002.4 完成，本子任务通过全局回归复核。

用户流程影响：桌面和移动端都能识别哪些 Header 入口可用、哪些仍未开放；实时状态异常有文案和重连操作；任务/文件详情支持鼠标关闭和 Escape 关闭，关闭后父页面上下文同步恢复；401/403/404/409/422/503、网络失败和实时断开继续由现有请求/Store 链路处理，不把失败状态伪装成成功。

API/OpenAPI 核对：未新增接口、字段或业务数据；本子任务只调整全局交互表达和既有错误上下文，实时状态继续使用已核对的 WebSocket 快照/事件协议，业务请求继续通过统一 request 层和 API 模块。

Loading/Empty/Error：未移除既有页面/Drawer 的 Loading、Empty、Error/Retry；请求层继续按正式 HTTP 与业务错误码生成上下文；实时断开、陈旧和恢复通过状态 Tag/文案表达，重连动作由 Store 负责并避免重复连接。

响应式视口：浏览器 375/768/1440/1920 四视口和 Electron 800×560、1024×640、1200×760 回归通过；通知入口在移动端保持可见但禁用，帮助/设置按现有移动端信息密度隐藏并保留桌面端明确 disabled 语义。

测试：`npm test`（141/141）、`npm run test:e2e`（9/9）、`npm run test:electron`（2/2）。

lint：`npm run lint` 通过，Oxlint 和 ESLint 均无错误。

build：`npm run build`、`npm run build:desktop` 通过；保留既有 realtimeStore 分包提示和大 chunk 警告。

git status --short：提交前仅包含本子任务的 Header、详情交互、相关测试和本任务记录。

git diff --check：通过。

提交：完成最终检查后创建独立本地提交 `fix: 完善 Electron 全局状态反馈`，不执行 push。

### [x] UI-002.6 Electron 视觉回归与发布门禁

优先级：P0
范围：`tests/e2e/electron.spec.js`、新增 Electron 视觉/交互测试、审查报告和任务记录

工作内容：

- 对 UI-002.0 至 UI-002.5 的主流程做 Electron 最终回归。
- 覆盖登录、服务器连接、打印机列表/详情、文件库、任务队列/历史、批量派发、个人中心和全屏看板。
- 对成功、空、错误、403、409、503、断线恢复至少记录可复现结果；真实环境限制单独列出。
- 生成稳定状态截图，并人工检查 TDesign 视觉层级、滚动、焦点和操作可达性。

验收：

- Electron 800×560、1024×640、1200×760 全部通过核心操作和无页面级水平溢出检查。
- `npm test`、相关 Playwright 浏览器/Electron 测试、`npm run lint`、`npm run build` 均通过。
- 提交前 `git status --short`、`git diff --check` 通过，提交只包含本子任务文件。
- 完成后提交：`test: 完成 Electron UI-002 视觉回归`。
- 只有所有 UI-002 子任务完成且真实环境限制已记录，才可在本批次末尾添加总结性完成记录；不自动修改 UI-001 历史状态。

完成记录：完成 Electron desktop-mock 最终回归和稳定截图检查，覆盖登录、服务器连接、打印机列表/详情、文件库、任务队列/历史、批量派发、个人中心和全屏看板。新增测试在 800×560、1024×640、1200×760 三种窗口尺寸逐页打开 7 个主业务路由，验证标题可达、关键区域完成加载、刷新/资源操作可用、无页面级水平溢出，并生成对应稳定状态截图；已人工检查队列页面截图，确认无登录成功 Toast、无加载态残留，侧栏/Header、Tabs、工作区、表格和局部滚动层级稳定。既有浏览器回归继续覆盖 375/768/1440/1920 视口、服务器地址双动作、打印机/文件结果区滚动、任务详情 Escape 关闭和移动端导航。

修改文件：`tests/e2e/electron.spec.js`、本任务记录。

API/OpenAPI 核对：本子任务未新增接口、字段或业务数据；所有 Electron 页面继续使用 UI-002.0 至 UI-002.5 已核对的正式 API 模块、Mock 合同和 WebSocket 状态链路。`npm test` 中已有正式错误矩阵覆盖 HTTP/业务错误码、空资源、403 权限、409 冲突、503 服务不可用、断线恢复和任务状态机；这些结果与 UI 回归分开记录，不把接口通过当作 UI 完成。

真实环境限制：本轮使用 `desktop-mock` 和 Playwright Electron 驱动，没有生产账号、真实后端部署、实际局域网发现环境或物理打印机，因此未宣称生产 CORS、真实服务器地址、局域网扫描、设备控制和安装后原生打包行为已验收；这些需在目标环境补做发布验收。

测试：`npm test`（141/141）、`npm run test:e2e`（9/9）、`npm run test:electron`（3/3）；稳定截图输出于 `test-results/playwright/`，生成物未加入提交。

lint：`npm run lint` 通过，Oxlint 和 ESLint 均无错误。

build：`npm run build`、`npm run build:desktop` 通过；保留既有 realtimeStore 动态/静态导入提示和超过 500 kB 的 chunk 警告。

git status --short：提交前仅包含 `tests/e2e/electron.spec.js` 和本任务记录。

git diff --check：通过。

提交：完成最终检查后创建独立本地提交 `test: 完成 Electron UI-002 视觉回归`，不执行 push。

批次总结：UI-002.0 至 UI-002.6 均已完成。Electron 应用壳、服务器连接、打印机中心、文件工作台、任务工作流、全局状态反馈和视觉回归门禁均已按 TDesign 规范闭环；UI-001 历史状态未修改。

## 6. UI-002 执行顺序

`UI-002.0 → UI-002.1 → UI-002.2 → UI-002.3 → UI-002.4 → UI-002.5 → UI-002.6`

任何子任务发现 OpenAPI、API_HANDOFF、Mock 或运行时数据冲突时，暂停该子任务并记录冲突，不得用前端假字段或静态数据继续推进。

## 7. UI-003 Electron 自绘窗口与滚动所有权重构（独立任务）

任务：UI-003 Electron Window Chrome & Scroll Ownership Remediation
所属 Spec：farm-ui-remediation
状态说明：[ ] 待完成；[x] 已完成；[-] 有条件跳过并记录原因
任务状态：进行中
任务类型：独立 Electron UI/UX 与运行时布局整改，不属于 farm-ui-v2，不修改 UI-001、UI-002 历史完成状态。

### 7.0 任务目标与边界

- 移除 Windows Electron 原生标题栏，使用 FabMatrix 自绘 DesktopTitleBar；登录页、首次管理员初始化页的既有主视觉不改，只在窗口边缘增加必要的桌面窗口控制。
- 明确 Electron 根窗口、App Shell、页面、表格、文件树、Drawer 和全屏看板的唯一滚动所有者，消除不应出现的页面级滚动和重复滚动。
- 不使用 `100vh` 直接推导表格高度；改为基于 App Shell 可用高度的 Flex 布局和明确的局部滚动区域。
- 统一 Chromium/Electron 与 Firefox 的滚动条表现，只给具有滚动语义的区域应用滚动条样式，不全局覆盖浏览器滚动条。
- 清理活动页面中的旧版 `overflow-auto`、仅针对 Firefox 的滚动条样式和与新 TDesign 页面壳冲突的高度规则；不修改备份文件。
- 不新增、伪造或修改后端 API、字段、业务状态、账号和数据；窗口控制只使用 Electron IPC，不经过业务 API。

### [x] UI-003.0 Electron 运行实例与窗口基线

优先级：P0
范围：`electron/main.cjs`、`electron/preload.cjs`、`tests/e2e/electron.spec.js`、`tests/e2e/electron-dist.spec.js`、任务记录

工作内容：

- 区分 `desktop`、`desktop-mock`、开发服务器 `5176` 和 `dist-file` 的实际渲染来源。
- 增强运行时诊断，使测试可以证明当前 Electron 没有连接到旧的或错误模式的 5176 Vite 进程。
- 记录窗口 content size、DPI/放大场景、Renderer source、开发/构建模式和单实例锁行为。
- 为后续无边框窗口与滚动审计建立 800×560、1024×640、1200×760 和 1920×1032 的稳定基线。

验收：

- `desktop:dev` 只加载 `desktop` Vite；`desktop:dev:mock` 只加载 `desktop-mock` Vite；`desktop:run` 在无 5176 服务时加载最新 `dist`，不意外连接旧服务。
- 运行时诊断能区分 `dev-server` 与 `dist-file`，测试失败时记录实际 renderer source。
- 不杀死或覆盖用户启动的未知进程；测试使用隔离用户目录并在结束后清理。
- 完成后提交：`test: 建立 Electron 窗口渲染基线`。

完成记录：已修正 Electron 运行时来源诊断，主进程在实际 `loadURL`/`loadFile` 完成后记录 `activeRenderer`；新增 `--farm-dist` 强制使用当前构建产物，并将 `desktop:run`、`desktop:run:mock` 改为构建后强制加载当前 `dist`，避免旧的 5176 Vite 进程污染桌面运行结果。项目脚本测试同步覆盖该入口约束。

修改文件：`electron/main.cjs`、`package.json`、`tests/projectScripts.test.js`、本任务记录。

验证记录：`npm test` 141/141 通过；`npm run test:electron:dist` 1/1 通过，运行时报告 `rendererMode=dist-file`、file URL、renderer mode `desktop`、`useMock=false`；`npm run lint` 通过；`npm run build` 与 `npm run build:desktop` 通过。构建仍有既有动态导入和大 chunk 警告，不影响退出码。

环境限制：当前 5176 由用户启动的真实 `desktop` Vite 实例占用，本轮不杀死或覆盖该进程，因此没有对该实例运行依赖 `desktop-mock` 的常规 Electron E2E；此前已有的 desktop-mock 运行链路保持不改。本子任务使用隔离的 dist Electron 测试验证构建运行入口。未新增 API、字段、业务状态、Mock 数据或真实凭据。

提交前检查：`git status --short` 仅包含本子任务文件；`git diff --check` 通过。提交：`test: 建立 Electron 窗口渲染基线`。

### [x] UI-003.1 Electron 无边框窗口与自绘标题栏

优先级：P0
范围：`electron/main.cjs`、`electron/preload.cjs`、`src/App.vue`、新增 `src/components/layout/DesktopTitleBar.vue`、相关样式和 Electron 测试

工作内容：

- 将 BrowserWindow 改为无边框窗口，保留 Windows 调整大小能力和现有最小/最大窗口约束。
- 通过受限的 `contextBridge` 暴露最小化、最大化/还原、关闭、最大化状态和窗口状态变化事件；禁止向 Renderer 暴露原始 `ipcRenderer`。
- 自绘标题栏提供 FabMatrix 标识、当前应用标题、最小化、最大化/还原、关闭按钮；按钮使用真实 TDesign/Icon 语义和无障碍名称。
- 标题栏拖拽区域使用 `-webkit-app-region: drag`，窗口控制和交互元素使用 `no-drag`；支持双击标题栏最大化/还原，不遮挡页面 Header 操作。
- 全屏看板、登录、服务器连接和主 App Shell 均正确处理标题栏存在/隐藏状态；不把标题栏高度重复计入页面滚动高度。

验收：

- Electron 中不再出现 Windows 原生标题栏，且自绘标题栏可以最小化、最大化/还原和关闭窗口。
- 拖拽标题栏可以移动窗口；窗口边缘仍可调整大小；窗口控制按钮可聚焦、可通过键盘触发并有稳定 `aria-label`。
- 双击标题栏、窗口最大化变化、全屏切换和路由切换不会造成页面跳动或额外滚动。
- 浏览器预览保持可用，不依赖 Electron API；登录与首次管理员初始化页面视觉主结构保持不变。
- 完成后提交：`feat: 完成 Electron 自绘标题栏`。

完成记录：BrowserWindow 已启用 `frame: false`，新增 FabMatrix 自绘 DesktopTitleBar；标题栏按钮使用 TDesign Button 和 `tdesign-icons-vue-next` 官方图标。preload 只暴露窗口控制、状态读取和状态订阅方法，未暴露原始 `ipcRenderer`。普通应用路由显示标题栏，全屏看板路由隐藏标题栏，窗口最大化/还原状态通过 IPC 事件同步。

修改文件：`electron/main.cjs`、`electron/preload.cjs`、`src/App.vue`、`src/components/layout/DesktopTitleBar.vue`、`src/styles/theme.css`、相关 Electron/项目脚本测试、本任务记录。

验证记录：`npm test` 141/141 通过；`npm run test:electron:dist` 1/1 通过，验证标题栏无障碍名称、最小化/最大化/还原/关闭入口和最大化状态 IPC；`npm run lint` 通过；`npm run build` 与 `npm run build:desktop` 通过。构建仍有既有动态导入和大 chunk 警告，不影响退出码。

环境限制：当前 5176 由用户启动的真实 `desktop` Vite 实例占用，本轮不杀死或覆盖该进程，因此没有对该实例运行依赖 `desktop-mock` 的常规 Electron E2E；dist Electron 验证在隔离用户目录中完成。登录和首次管理员初始化的主体视觉结构未改；未新增 API、字段、业务状态、Mock 数据或真实凭据。

提交前检查：`git status --short` 仅包含本子任务文件；`git diff --check` 和 `git diff --cached --check` 通过。提交：`feat: 完成 Electron 自绘标题栏`。

### [x] UI-003.2 App Shell 高度与滚动所有权重构

优先级：P0
范围：`src/App.vue`、`src/layout/index.vue`、`src/styles/index.css`、`src/styles/theme.css`、页面壳和相关页面样式

工作内容：

- 将根节点改为固定视口、可计算剩余高度的 Flex 结构：DesktopTitleBar、App Shell、Header、Content 的高度关系明确，所有中间 Flex 节点设置 `min-height: 0`。
- 禁止 App Shell、Header 和无内容溢出的页面自动生成滚动；不再依赖页面子节点的 `min-height: 100%` 撑高父容器。
- 建立页面滚动策略：仪表盘/批量派发在内容确实超过可视区时允许页面滚动；打印机、任务队列、打印历史只允许表格 Body 滚动；文件库只允许目录树和结果区滚动；Drawer 只允许 Body 滚动；全屏看板只允许看板内容区滚动。
- 将打印机、任务、历史、审计、用户管理和文件库中的 `calc(100vh - ...)` 改为基于父级可用高度的布局，避免 Header、padding 和标题栏重复计算。
- 保证页面底部工具栏、分页器、Drawer Footer、表格最后一行在 800×560 等最小 Electron 窗口中可达。

验收：

- 800×560、1024×640、1200×760 和 1920×1032 下，核心页面没有意外的页面级纵向滚动或水平溢出。
- 每个页面最多只有任务定义的滚动区域；滚动一个区域不会带动不相关的外层页面。
- 打印机、文件、任务、历史、批量派发、个人中心、仪表盘和全屏看板在 Loading、Empty、Error、正常数据下均保持滚动模型一致。
- 通过真实鼠标滚轮、触控板/滚轮事件和键盘焦点检查，不以脚本直接设置 `scrollTop` 代替用户操作。
- 完成后提交：`fix: 重构 Electron 页面滚动所有权`。

完成记录：App Shell 现在由固定视口 Flex 链路承接可用高度，`app-content__view` 默认不滚动，仅由路由 `meta.pageScroll` 明确开启页面滚动。打印机、任务队列、打印历史、用户管理和操作日志的表格高度改为父级 `100%`，文件库布局改为父级 `100%`，保留目录树、文件结果区和 TDesign Table Body 的局部滚动。移除了本批页面对 `calc(100vh - ...)` 的依赖，并修正 Electron 测试对滚动所有者的断言。

修改文件：`src/layout/index.vue`、`src/styles/index.css`、`src/router/index.js`、打印机/任务/历史/用户/日志/文件库页面样式、浏览器与 Electron 滚动测试、本任务记录。

验证记录：`npm test` 141/141 通过；`npm run test:e2e` 9/9 通过（375、768、1440、1920 视口及真实滚轮交互）；`npm run test:electron:dist` 1/1 通过；`npm run lint`、`npm run build`、`npm run build:desktop` 均通过。构建仍有既有动态导入和大 chunk 警告，不影响退出码。

环境限制：当前 5176 由用户启动的真实 `desktop` Vite 实例占用，本轮不杀死或覆盖该进程，因此没有对该实例运行依赖 `desktop-mock` 的常规 Electron E2E；浏览器 Mock 与隔离 dist Electron 已完成滚动模型验证。未新增 API、字段、业务状态、Mock 数据或真实凭据。

提交前检查：`git status --short` 仅包含本子任务文件；`git diff --check` 和 `git diff --cached --check` 通过。提交：`fix: 重构 Electron 页面滚动所有权`。

### [x] UI-003.3 滚动条样式与旧版样式清理

优先级：P1
范围：`src/styles/index.css`、`src/styles/theme.css`、`src/components/FarmDashboard.vue`、页面滚动区域、相关测试

工作内容：

- 新增语义化滚动区域样式，例如 `.app-scroll-region`，同时覆盖 Chromium 的 `::-webkit-scrollbar` 和 Firefox 的 `scrollbar-width/scrollbar-color`。
- 滚动条颜色、轨道、悬停状态使用 TDesign/应用语义 Token；不对 `html`、`body` 和所有元素强制设置滚动条，保留系统辅助功能和平台行为。
- 删除或迁移仅对 Firefox 生效的内联滚动条样式，清理活动业务页面中旧版 Tailwind `overflow-auto` 与新布局冲突的规则。
- 保留必要的 `overflow: hidden`（图片、状态条、拖拽区域等），不得把内容裁剪当作解决滚动的手段。
- 检查滚动条出现/消失时的布局抖动，必要时只在明确的表格/列表区域使用 `scrollbar-gutter: stable`。

验收：

- Electron Chromium 中指定滚动区不再显示未经设计的原生粗滚动条；无滚动的页面不预留或显示误导性滚动条。
- 滚动条不遮挡表格固定列、分页器、Drawer Footer、标题栏按钮和焦点环。
- 不产生新的 Tailwind 与 TDesign 样式覆盖冲突；登录/初始化主视觉回归通过。
- 完成后提交：`style: 统一 Electron 滚动条视觉`。

完成记录：新增 `.app-scroll-region` 语义滚动区域及 TDesign Token 驱动的 Chromium/Firefox 滚动条样式；表格适配层、文件表格、打印机详情 Drawer 使用同一套滚动条语义。FarmDashboard 移除旧版 `overflow-auto`、Firefox 内联颜色、无效的 `workshop-canvas-wrapper` 滚动规则和 `100vh` 高度计算，侧栏、文件树、看板、认证页均改为显式滚动区域。未对 `html`、`body` 或全局所有元素覆盖滚动条。

修改文件：`src/styles/theme.css`、`src/components/TdTable.vue`、`src/components/FarmDashboard.vue`、`src/components/device/DeviceDetailDrawer.vue`、`src/components/layout/AppSidebar.vue`、`src/layout/index.vue`、`src/views/Login.vue`、`src/views/ServerConnection.vue`、`src/views/FileLibrary.vue`、滚动相关测试、本任务记录。

验证记录：`npm test` 142/142 通过；`npm run test:e2e` 9/9 通过；`npm run test:electron:dist` 1/1 通过；`npm run lint`、`npm run build`、`npm run build:desktop` 均通过。遗留扫描确认活动源码无 `overflow-auto` 和旧 `100vh - ...` 滚动高度规则；构建仍有既有动态导入和大 chunk 警告，不影响退出码。

环境限制：当前 5176 由用户启动的真实 `desktop` Vite 实例占用，本轮不杀死或覆盖该进程，因此没有对该实例运行依赖 `desktop-mock` 的常规 Electron E2E；浏览器 Mock 与隔离 dist Electron 已完成样式和交互验证。未新增 API、字段、业务状态、Mock 数据或真实凭据。

提交前检查：`git status --short` 仅包含本子任务文件；`git diff --check` 和 `git diff --cached --check` 通过。提交：`style: 统一 Electron 滚动条视觉`。

### [x] UI-003.4 Electron 视觉回归与发布门禁

优先级：P0
范围：Electron/浏览器 Playwright 测试、截图、审查记录和本任务记录

工作内容：

- 覆盖登录、服务器连接、打印机、文件库、任务队列、历史、批量派发、个人中心、仪表盘和全屏看板。
- 覆盖普通数据、空数据、Loading、错误、Drawer、表格滚动、窗口最大化/还原、标题栏按钮和全屏切换。
- 对每个窗口尺寸记录页面级 `scrollWidth/scrollHeight`、指定滚动容器和实际用户滚轮结果。
- 生成稳定状态截图并人工检查：无旧窗口标题栏、无错误页面滚动、滚动条样式统一、TDesign 层级稳定、焦点可见、底部操作可达。
- 真实后端、实际安装包、不同 Windows DPI/系统主题和物理打印机行为单独记录限制，不以 Mock 结果代替生产验收。

验收：

- `npm test`、`npm run test:e2e`、`npm run test:electron`、`npm run test:electron:dist`、`npm run lint`、`npm run build`、`npm run build:desktop` 全部通过。
- Electron 800×560、1024×640、1200×760、1920×1032 四种尺寸完成标题栏和滚动回归。
- 提交前执行 `git status --short`、`git diff --check` 和 `git diff --cached --check`；每个子任务只暂存自己的文件，不使用 `git add .`。
- 不执行 git push；真实环境限制必须写入本任务完成记录。
- 完成后提交：`test: 完成 Electron 窗口与滚动回归`。

完成记录：完成 Electron 自绘标题栏、窗口最小化/最大化/还原、全屏路由、打印机表格真实滚轮、文件库窄窗口布局、文件/任务/历史/批量派发/个人中心/仪表盘和服务器连接页面回归。修复 TDesign Card Body 未进入可收缩 Flex 链导致表格被裁剪的问题；文件库在 800×560 下改为上下分区，保留目录与结果区的局部滚动，避免窄窗口筛选区把结果表压成零高度；桌面 Mock E2E 与用户正在使用的 5176 Vite 实例隔离到 5177，避免加载过期开发服务器。

修改文件：`electron/main.cjs`、`playwright.config.js`、`src/components/TdTable.vue`、`src/styles/index.css`、`src/styles/theme.css`、`src/views/FileLibrary.vue`、`tests/e2e/electron.spec.js`、`tests/e2e/electron-dist.spec.js`、`tests/projectScripts.test.js`、本任务记录。

用户流程影响：Electron 无原生旧标题栏残留；主业务页面在小窗口可继续访问标题、筛选、表格、分页和操作；打印机表格和文件表格由指定内容区承接滚轮；页面没有新增全局或无语义滚动条。登录、注册/初始化既有主视觉未改动。

API/OpenAPI 核对：本子任务未新增接口、字段、Mock 业务数据或状态；仅调整 Electron 渲染源隔离、布局、滚动和自动化验证，继续使用既有正式 API/desktop-mock 契约。

Loading/Empty/Error：沿用既有页面 AsyncState、TDesign Empty/Error、Drawer 和表格 Loading 状态；本轮验证了正常数据、加载完成、页面级横向溢出、打印机/文件滚动、详情 Drawer、全屏切换和窗口控制。真实后端错误矩阵、真实局域网发现、物理打印机和安装包签名仍需生产环境单独验收。

响应式视口：浏览器 Playwright 覆盖 375/768/1440/1920；Electron desktop-mock 覆盖实际 BrowserWindow 800×560、1024×640、1200×760；dist-file 测试通过 `setContentSize` 等待并覆盖 800×560、1024×640、1200×760、1920×1032，检查页面宽度、文档宽度和 Body 高度无意外溢出。稳定截图生成于 `test-results/playwright/`，已人工检查自绘标题栏、滚动区域和 TDesign 层级。

测试：`npm test`（142/142）、`npm run test:e2e`（9/9）、`npm run test:electron`（3/3）、`npm run test:electron:dist`（1/1，含 `npm run build:desktop`）。

lint：`npm run lint` 通过，Oxlint 和 ESLint 均无错误。

build：`npm run build`、`npm run build:desktop` 通过；保留既有 realtimeStore 动静态导入提示和大 chunk 警告，不影响退出码。

git status --short：提交前仅包含本子任务文件；用户已运行的 5176 Vite 进程未终止或修改。

git diff --check：通过；暂存后另行执行 `git diff --cached --check`。

提交：完成最终检查后创建独立本地提交 `test: 完成 Electron 窗口与滚动回归`，不执行 push。

### 7.6 UI-003 执行顺序与统一约束

执行顺序：

`UI-003.0 → UI-003.1 → UI-003.2 → UI-003.3 → UI-003.4`

统一约束：

- UI-003 是独立 Electron UI/UX 整改任务，不属于 farm-ui-v2，也不回写 UI-001、UI-002 的历史状态。
- 任何窗口控制能力必须通过最小化的 preload API 暴露；Renderer 不得直接访问 Node/Electron 内部对象。
- 任何滚动整改必须先确认滚动所有者，再改 `overflow`；不得通过全局 `overflow: hidden`、绝对定位或裁剪内容伪造“无滚动”。
- 不新增或猜测 API、字段、业务状态、Mock 数据和真实凭据；窗口状态不是业务数据，不进入后端请求。
- 每完成一个子任务必须独立测试、lint、build、执行提交前检查并创建一次本地 Git 提交；不执行 push。
- 发现当前运行实例与源码 Bundle 不一致、真实后端或 Electron 原生行为无法验证时，暂停对应验收并记录限制，不得标记为完成。
