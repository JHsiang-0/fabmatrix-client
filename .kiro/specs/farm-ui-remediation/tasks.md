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

## 2. 执行顺序

UI-001.0 → UI-001.1 → UI-001.2 → UI-001.3 → UI-001.4 → UI-001.5 → UI-001.6 → UI-001.7 → UI-001.8 → UI-001.9 → UI-001.10

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

## 8. UI-004 文件库工作台信息架构重写（独立任务）

任务：UI-004 File Library Information Architecture Remediation

任务类型：独立文件库 UI/UX 重写，不属于 `farm-ui-v2`，不修改 UI-001、UI-002、UI-003 的历史完成状态。

背景：当前文件库同时把完整 `FileNodeVO` 树和分页文件列表展示在左右两栏。文件树包含文件节点，右侧列表又展示同一批文件，导致用户感知为重复功能；顶部操作按钮还因缺少统一 `Space` 间距而粘连。现有上传、删除、详情、下载和创建任务逻辑已有正式 API 支持，但页面模板、视图模型和样式需要重新组织。

任务边界：

- 不更换 Vue、Pinia、Axios、TDesign Vue Next、Electron 或现有 API 层。
- 不新增或猜测 API、字段、状态、业务数据和材质枚举。
- 不修改登录页、首次管理员初始化页和 `src/stores/printerStore.js.backup`。
- 不修改 `farm-ui-v2` 任务状态，也不回写 UI-001、UI-002、UI-003 的历史完成记录。
- 保留 `UI-002.3` 已验证的正式文件接口行为，只重写文件库的信息架构、视图承载和交互表达。

统一门禁：

- 每个 UI-004 子任务单独完成、单独测试、单独 lint、单独 build 和单独创建本地 Git 提交。
- 提交前必须执行 `git status --short`、`git diff --check`，只暂存当前子任务实际修改的文件，禁止 `git add .`。
- 不执行 `git push`；不提交环境配置、Token、密码、预签名 URL 或其他敏感信息。
- 每项记录真实 API/OpenAPI 来源、Loading/Empty/Error、状态同步、Electron 窗口尺寸、浏览器视口和未验证的真实环境限制。

### [x] UI-004.0 文件库运行基线与契约冻结

优先级：P0

范围：`src/views/FileLibrary.vue`、`src/api/printFile.js`、`src/components/file/*`、`API_HANDOFF.md`、运行时 `/v3/api-docs`、文件库相关测试。

工作内容：

- 记录当前文件库实际加载的前端 Bundle、API 地址、WebSocket 状态和 Electron 窗口尺寸。
- 核对 `GET /api/v1/print-files/tree` 返回完整目录树，明确 `folder=true` 的目录导航边界。
- 核对分页、创建文件夹、单/批量上传、预览、缩略图、关联任务、下载、单删和批量删除接口及参数。
- 确认运行时 OpenAPI 泛型 `Result` 与 `API_HANDOFF.md` 的字段差异；存在冲突时记录，不在前端猜测。
- 建立根目录、含文件夹目录、空目录、筛选结果和接口失败的稳定截图与操作记录。

验收：

- 契约只保留 `pageNum`、`pageSize`、`fileName`、`materialType`、`parentId`、`folder` 等正式字段。
- 明确文件树只用于目录上下文，不能把文件节点直接作为主文件列表的第二份展示。
- 基线记录不修改代码，不伪造登录或后端数据。

完成后提交：`docs: 建立 UI-004 文件库重写基线`。

完成记录：已建立 [`UI-004-BASELINE.md`](./UI-004-BASELINE.md)，冻结当前源码提交、前端代理与 Electron 端口/尺寸、后端健康检查和运行时 OpenAPI 文件接口。已核对 `API_HANDOFF.md` 的完整文件树、`parentId` 分页、新建文件夹、单/批量上传、预览、缩略图、关联任务、下载、单删和批量删除约束；记录了运行时泛型 `Result` 结构不足、当前完整文件树与分页主列表重复、工具栏 action 缺少统一 `Space`、Grid/兼容表格双渲染器分叉，以及浏览器过期登录态导致的现场截图限制。本阶段未修改业务代码、未新增接口/字段/业务数据。

测试：`npm test`、`npm run lint`、`npm run build` 通过。

Git 检查：提交前执行 `git status --short`、`git diff --check` 和暂存后的 `git diff --cached --check`，仅暂存本子任务的基线文档和任务记录。

提交：`af8418a` 之后创建独立本地提交 `docs: 建立 UI-004 文件库重写基线`；不执行 `git push`。

### [x] UI-004.1 目录导航与页面信息架构

优先级：P0

范围：文件库页面布局、目录导航 View Model、面包屑、目录选择入口和响应式布局。

工作内容：

- 将完整文件树转换为仅包含文件夹的目录导航数据，保留层级和真实目录 ID。
- 默认采用单一主工作区：Page Header → 目录/筛选工具栏 → 文件数据区 → 分页。
- 使用 TDesign `Breadcrumb` 与 `TreeSelect` 或等价的官方目录组件承载目录上下文。
- 若保留常驻目录树，左侧只能展示文件夹，不得展示与右侧重复的文件节点；窄窗口改为可打开的目录面板。
- 目录切换、根目录返回、面包屑和分页必须共享 `parentId` 上下文，切换目录后页码回到第一页。

验收：

- 根目录文件只在主数据区出现一次。
- 用户可以完成根目录、子目录、返回上级和多级目录跳转。
- Electron `800×560`、`1024×640`、`1200×760` 下目录入口、当前路径和主数据区均可达。
- 页面不出现无来源的水平溢出或重复滚动容器。

完成后提交：`refactor: 重组文件库目录导航信息架构`。

完成记录：完整 `FileNodeVO` 树在进入 TDesign Tree 前只保留 `folder=true` 的目录节点，并递归清理文件节点；文件详情不再由目录树触发，主分页列表保留显式“详情”入口。目录树、面包屑、当前目录 `parentId` 和分页仍共享现有正式状态，目录切换继续回到第一页；未新增接口、字段或业务数据。

测试：`npm test`（143/143）、`npm run lint`、`npm run build` 通过。构建保留既有 realtimeStore 动静态导入提示和大 chunk 警告，不影响退出码。

Git 检查：提交前执行 `git status --short`、`git diff --check` 和暂存后的 `git diff --cached --check`，仅暂存 `src/views/FileLibrary.vue`、`tests/fileLibrary.test.js` 和本任务记录。

提交：完成最终检查后创建独立本地提交 `refactor: 重组文件库目录导航信息架构`，不执行 `git push`。

### [x] UI-004.2 顶部工具栏与筛选操作统一

优先级：P1

范围：Page Header 操作区、文件名/材质筛选、视图切换、刷新和批量选择入口。

工作内容：

- 使用单一 TDesign `Space` 统一新建文件夹、上传、刷新、视图切换和批量操作的间距。
- 明确 Primary、Default、Text、Danger 操作层级，避免按钮视觉粘连和主次不清。
- 文件名继续映射正式 `fileName`；材质筛选不硬编码 OpenAPI 未声明的枚举。
- 搜索、清空、刷新和目录切换时同步页码、选中项和加载状态。
- 批量删除只在存在合法选中文件时显示，失败项保留并展示后端逐项结果。

验收：

- 桌面端按钮有稳定间距，窄屏可换行且不遮挡主操作。
- 筛选条件不会发送 `keyword` 或其他未定义字段。
- 查询 Loading、失败、清空和恢复状态均在工具栏或数据区有明确反馈。

完成后提交：`style: 统一文件库工具栏与筛选交互`。

完成记录：文件库 Page Header action 改为单一 TDesign `Space`，统一视图切换、新建文件夹、上传、批量删除和刷新按钮间距，并允许窄窗口换行；筛选区增加“查询”“重置”，查询仍只发送正式 `fileName`、`materialType`、`parentId` 和分页字段。切换离开批量模式、重置筛选和列表刷新时同步清理选中项；未新增接口、字段、材质枚举或业务数据。

测试：`npm test`（144/144）、`npm run lint`、`npm run build` 通过。构建保留既有 realtimeStore 动静态导入提示和大 chunk 警告，不影响退出码。

Git 检查：提交前执行 `git status --short`、`git diff --check` 和暂存后的 `git diff --cached --check`，仅暂存 `src/views/FileLibrary.vue`、`tests/fileLibrary.test.js` 和本任务记录。

提交：完成最终检查后创建独立本地提交 `style: 统一文件库工具栏与筛选交互`，不执行 `git push`。

### [x] UI-004.3 Table/Grid 数据视图统一

优先级：P0

范围：文件列表、可选网格、表格列、选择状态、操作列、分页和滚动模型。

工作内容：

- TDesign `Table` 作为默认数据视图，Grid 仅作为同一数据 View Model 的可选表达。
- 优先使用原生 TDesign Table 的 `rowKey`、`loading`、`maxHeight/height`、固定操作列和空状态能力；只有兼容现有列插槽时才保留 `TdTable` 适配层。
- 文件夹和文件使用同一数据源，但按正式 `folder` 字段表达不同操作，不复制业务请求逻辑。
- 操作列只展示正式能力：文件夹打开/删除，文件详情/打印/删除；下载继续通过详情抽屉或正式下载接口。
- 控制表格内容区为唯一列表滚动所有者，分页位于滚动区域之外。

验收：

- Table 与 Grid 的当前目录、筛选、分页、选中项和刷新状态一致。
- 视图切换不重复请求、不丢失当前目录，也不生成两套不同的业务行为。
- 大量数据、空数据、无结果、表格加载和表格错误状态均可访问。
- 不出现旧版自绘文件卡片导致的视觉体系分裂。

完成后提交：`refactor: 统一文件库表格与网格数据视图`。

完成记录：Table/Grid 现在共用由当前分页结果派生的 `fileRows` View Model，显式传递 `row-key="id"`；列表仍以 TDesign Table 适配层承载 `loading`、选择、固定操作列和内容区滚动，默认视图保持 Table。Grid 文件卡片补齐显式详情入口，Table/Grid 的文件夹打开、文件详情/打印、删除语义保持一致；操作按钮阻止行点击冒泡，避免一次操作触发重复动作。未新增接口、字段或业务数据。

测试：`npm test`（144/144）、`npm run lint`、`npm run build` 通过。构建保留既有 realtimeStore 动静态导入提示和大 chunk 警告，不影响退出码。

Git 检查：提交前执行 `git status --short`、`git diff --check` 和暂存后的 `git diff --cached --check`，仅暂存 `src/views/FileLibrary.vue`、`tests/fileLibrary.test.js` 和本任务记录。

提交：完成最终检查后创建独立本地提交 `refactor: 统一文件库表格与网格数据视图`，不执行 `git push`。

### [x] UI-004.4 上传、删除与文件详情工作流

优先级：P1

范围：上传 Dialog、批量上传结果、创建文件夹、单/批量删除、文件详情 Drawer、创建打印任务入口。

工作内容：

- 继续使用正式单文件/批量上传接口，并正确传递当前目录 `parentId`。
- 使用 TDesign `Upload`、`Dialog`、`Alert`、`Progress`、`Empty` 和 `Drawer` 统一表达上传、错误、部分成功和重试。
- 详情 Drawer 只展示 `PrintFilePreviewVO` 安全字段、短期缩略图、关联任务和下载入口，不展示 `safeName`、`rustfsKey`、`fileUrl`。
- 删除继续遵守目录 422、关联任务 409、对象存储 503 和批量逐项结果语义。
- 创建任务继续使用正式 `fileId`、可选 `printerId`、`priority` 和幂等键，不增加前端业务字段。

验收：

- 上传成功、取消、超时、格式/大小错误、部分成功和可重试失败均有原位状态。
- Drawer 标题、关闭、Loading、错误、空关联任务和 Escape 行为稳定。
- 删除冲突后不会把列表误刷新为成功状态；失败项仍可恢复操作。
- 从文件详情到创建任务的流程在桌面和窄窗口可完成。

完成后提交：`fix: 完善文件库上传删除与详情工作流`。

完成记录：文件详情预览/缩略图和关联任务请求拆分为可重试的加载函数；详情 Drawer 的预览错误和关联任务错误均提供 TDesign 原位重试，保留安全字段、短期缩略图和正式下载入口。删除成功后等待当前目录同步，继续保留 422 文件夹冲突和批量逐项失败语义；未新增接口、字段、状态或业务数据。

测试：`npm test`（144/144）、`npm run lint`、`npm run build` 通过。构建保留既有 realtimeStore 动静态导入提示和大 chunk 警告，不影响退出码。

Git 检查：提交前执行 `git status --short`、`git diff --check` 和暂存后的 `git diff --cached --check`，仅暂存 `src/views/FileLibrary.vue`、`src/components/file/FileDetailDrawer.vue`、`tests/fileLibrary.test.js` 和本任务记录。

提交：完成最终检查后创建独立本地提交 `fix: 完善文件库上传删除与详情工作流`，不执行 `git push`。

### [x] UI-004.5 Electron、浏览器视觉与交互验收

优先级：P0

范围：文件库相关浏览器/Electron Playwright 测试、稳定截图和任务记录。

工作内容：

- Electron 覆盖 `800×560`、`1024×640`、`1200×760`，浏览器覆盖 `375×812`、`768×1024`、`1440×900`、`1920×855`。
- 使用真实点击、输入、键盘、滚轮、分页、目录跳转、筛选、上传入口、详情关闭和创建任务入口。
- 检查页面级 `scrollWidth/scrollHeight`、Table 内容区滚动、Drawer Body 滚动和操作列可达性。
- 生成稳定状态截图，人工检查 TDesign 层级、间距、焦点、按钮层级、空/错/加载态和是否仍存在重复文件展示。
- 记录真实后端、实体文件存储、生产 CORS 和 Electron DPI/主题未验证限制。

验收：

- 浏览器和 Electron 文件库主流程均可完成，不能仅凭接口测试通过判定 UI 完成。
- 无页面级水平溢出、无按钮粘连、无重复文件树列表、无原始滚动条残留。
- 完成全量测试、相关浏览器/Electron 测试、lint、build，并通过提交前 Git 检查。

完成后提交：`test: 完成 UI-004 文件库视觉与交互验收`。

完成记录：浏览器 Playwright 9/9 通过，覆盖 `375×812`、`768×1024`、`1440×900`、`1920×855`，验证文件库列表/Grid、目录/筛选/详情/弹窗入口和局部滚动；Electron Playwright 3/3 通过，覆盖实际 BrowserWindow 内容尺寸 `800×560`、`1024×640`、`1200×760`，验证文件库目录打开、根目录返回、详情 Drawer、创建任务和上传/新建文件夹入口；`test:electron:dist` 及桌面构建通过。现有稳定截图生成于 Playwright test-results 目录，不提交截图产物。

测试：`npm test`（144/144）、`npm run test:e2e`（9/9）、`npm run test:electron`（3/3）、`npm run test:electron:dist`（1/1，含 `npm run build:desktop`）、`npm run lint`、`npm run build`、`npm run build:desktop` 全部通过。构建保留既有 realtimeStore 动静态导入提示和大 chunk 警告，不影响退出码。

视觉和交互结论：文件树不再显示文件节点，主列表成为文件唯一结果承载区；顶部操作无粘连；默认 Table、可选 Grid、详情 Drawer、上传入口、目录和分页均可达，页面级横向溢出未出现。真实 RustFS/对象存储、生产 CORS、实体文件上传、物理打印机、Windows DPI/主题和安装包签名仍需现场验收。

Git 检查：提交前执行 `git status --short`、`git diff --check` 和暂存后的 `git diff --cached --check`，仅暂存本任务记录。

提交：完成最终检查后创建独立本地提交 `test: 完成 UI-004 文件库视觉与交互验收`，不执行 `git push`。

### [x] UI-004.6 单一主工作区文件导航

优先级：P0

目标：移除文件库左侧常驻目录树，避免目录导航与当前目录结果重复；以真实分页文件接口返回的文件夹行作为唯一文件夹导航入口，保留面包屑和根目录/上级目录跳转。

工作内容：

- 文件库只保留 Page Header、筛选与面包屑、当前目录 Table/Grid、分页组成的主工作区，不再挂载完整目录树或额外目录滚动容器。
- 文件夹在正式 `/print-files/page` 结果中只展示一次，列表和网格视图均通过“打开”进入；不新增 API、字段或伪造业务数据。
- 收敛文件库 CSS 和响应式布局，保证表格/网格继续承担局部滚动，页面不产生重复纵向滚动。
- 更新静态契约测试与 Electron Playwright，验证 800×560、1024×640、1200×760 窗口下无侧栏残留、无页面级水平溢出，且根目录、文件夹打开、面包屑返回、详情和创建任务入口保持可用。

验收：

- 左侧目录树和其独立滚动条不存在；文件夹仅在主数据区展示一次。
- 根目录、文件夹进入、面包屑返回和分页均基于当前正式接口结果同步更新。
- 完成 `npm test`、浏览器/Electron 相关测试、`npm run lint`、`npm run build` 和桌面构建，并通过提交前 Git 检查。

完成后提交：`refactor: 收口文件库单一主工作区导航`。

完成记录：移除 FileLibrary 左侧常驻目录树、目录树独立加载态和滚动容器；文件夹只由正式 `/print-files/page` 分页结果承载，Table/Grid 均通过打开操作进入，面包屑统一管理根目录和上级目录状态。同步收敛文件库布局 CSS，Electron Playwright 增加无侧栏和无目录树回归断言；未新增接口、字段或业务数据。真实 RustFS/对象存储、生产 CORS、实体文件上传、物理打印机和 Windows DPI/主题仍需现场验收。

测试：`npm test`（144/144）、`npm run test:e2e`（9/9）、`npm run test:electron`（3/3）、`npm run test:electron:dist`（1/1，含 `npm run build:desktop`）、`npm run lint`、`npm run build`、`npm run build:desktop` 全部通过。构建保留既有 realtimeStore 动静态导入提示和大 chunk 警告，不影响退出码。

Git 检查：提交前执行 `git status --short`、`git diff --check` 和暂存后的 `git diff --cached --check`，仅暂存本子任务涉及的文件。

提交：完成最终检查后创建独立本地提交 `refactor: 收口文件库单一主工作区导航`，不执行 `git push`。

### [x] UI-004.7 文件库 TDesign 卡片、筛选和操作对齐

优先级：P1

目标：进一步收敛文件库到 TDesign 默认视觉语言，降低筛选区域高度，统一文件夹和文件的操作层级。

工作内容：

- 将文件筛选区改为 TDesign inline Form 单行布局，桌面宽度下保持当前位置、模式、搜索、材质和查询操作同一行。
- 文件库工作区和网格条目使用 TDesign Card，移除重复的外层自定义卡片边框、阴影和圆角实现。
- 移除文件“详情”操作按钮，详情仍通过列表行或网格卡片点击打开；文件夹与文件操作列保持同等数量和位置，避免按钮错位。
- 更新文件库静态契约测试和 Electron 真实点击回归，不新增接口、字段或业务数据。

验收：

- 桌面端筛选区为单行；窄窗口允许按 TDesign Form 规则换行，不产生页面级水平溢出。
- 文件夹和文件操作按钮对齐，详情 Drawer、文件夹打开、打印、删除、上传和分页入口保持可用。
- 完成 `npm test`、浏览器/Electron 相关测试、`npm run lint`、`npm run build` 和桌面构建，并通过提交前 Git 检查。

完成记录：文件库外层和网格条目改用 TDesign Card，筛选区改为 inline Form；列表和网格均移除单独的“详情”按钮，详情入口统一为行/卡片点击，文件操作列保持“打开/打印 + 删除”的同构布局。未新增接口、字段或业务数据；真实 RustFS/对象存储、生产 CORS、实体文件上传、物理打印机和 Windows DPI/主题仍需现场验收。

测试：`npm test`（144/144）、`npm run test:e2e`（9/9）、`npm run test:electron`（3/3）、`npm run test:electron:dist`（1/1，含 `npm run build:desktop`）、`npm run lint`、`npm run build`、`npm run build:desktop` 全部通过。构建保留既有 realtimeStore 动静态导入提示和大 chunk 警告，不影响退出码。

Git 检查：提交前执行 `git status --short`、`git diff --check` 和暂存后的 `git diff --cached --check`，仅暂存本子任务涉及的文件。

提交：完成最终检查后创建独立本地提交 `style: 统一文件库 TDesign 卡片与筛选布局`，不执行 `git push`。

### [x] UI-004.8 文件子系统重写：Table/Grid 视图与右键菜单

优先级：P0

目标：基于 [`design.md`](./design.md) 的最新文件库子系统规范，重写文件夹/文件的视图模型和操作入口，解决文件夹卡片字段错位、文件与文件夹卡片复用不合理、操作列不对齐和右键能力缺失问题。

范围：`src/views/FileLibrary.vue`、必要的文件库组件/API 适配、文件库静态测试、浏览器/Electron Playwright 测试；不得修改登录/注册既有视觉，不得引入新的后端接口或伪造字段。

工作内容：

- 以 TDesign Table 作为默认大数据量视图，文件夹和文件共享同一 `fileRows` 结果模型；文件夹行不渲染耗时、耗材、成功率等文件专属字段。
- Grid 作为可选视图，使用紧凑 TDesign Card；文件夹只展示名称、目录标识和打开/删除，文件只展示正式安全元数据和打印/删除，避免使用缺失字段填充卡片。
- 使用 TDesign Dropdown 的 `trigger="context-menu"` 提供右键辅助菜单，并保留可见按钮和键盘/行点击入口。右键菜单只能映射已有接口：打开、详情、打印、下载、删除、批量删除；不得显示重命名、移动、复制、分享等未有后端契约的动作。
- 当前目录、搜索和筛选继续以 `POST /print-files/page`、`parentId`、`fileName`、`materialType` 和分页字段为唯一主结果来源；根目录、文件夹进入、面包屑和刷新必须同步同一状态模型。
- 明确 Loading、Refreshing、Empty、Error、删除部分失败、上传逐项失败、详情/缩略图/关联任务失败和右键菜单关闭后的焦点恢复行为；不展示 `safeName`、`rustfsKey`、`fileUrl` 或其他内部存储字段。
- 在 Electron `800×560`、`1024×640`、`1200×760` 及浏览器四视口下验证表格/网格结果区滚动、无页面级水平溢出、右键菜单定位、Escape 关闭、点击外部关闭、键盘可达和详情 Drawer。

验收：

- 文件夹名称、图标、类型和操作完整可见；文件夹卡片不再出现文件专属空白指标。
- Table 默认加载；Grid 与 Table 使用相同接口结果、分页、筛选、选择和刷新状态。
- 右键菜单只提供真实后端支持的动作，操作失败按 HTTP/业务错误原位反馈并刷新服务端状态。
- 完成 `npm test`、`npm run test:e2e`、`npm run test:electron`、`npm run test:electron:dist`、`npm run lint`、`npm run build` 和桌面构建，并通过提交前 Git 检查。

完成后提交：`refactor: 重写文件子系统视图与右键菜单`。

完成记录：默认 Table 与可选 Grid 复用同一 `fileRows`，文件夹卡片只展示目录标识、名称和打开/删除，文件卡片仅展示正式安全元数据与打印/删除；Table 文件夹行不再填充文件专属指标。列表名称单元格和 Grid 卡片均接入 TDesign `Dropdown trigger="context-menu"`，右键仅提供打开、详情、打印、下载、删除和已选项批量删除，保留行点击、卡片点击和可见操作按钮；菜单动作兼容 TDesign 当前实际回调对象并沿用现有 API。

测试：`npm test`（145/145）、`npm run test:e2e`（9/9，覆盖 `375×812`、`768×1024`、`1440×900`、`1920×855`）、`npm run test:electron`（3/3，包含右键打开文件详情）、`npm run test:electron:dist`（1/1，含 `npm run build:desktop`）、`npm run lint`、`npm run build` 全部通过。构建保留既有 realtimeStore 动静态导入提示和大 chunk 警告，不影响退出码。

Git 检查：提交前执行 `git status --short`、`git diff --check` 和暂存后的 `git diff --cached --check`，仅暂存本子任务的 `src/views/FileLibrary.vue`、`tests/fileLibrary.test.js`、`tests/e2e/electron.spec.js` 和本任务记录。

提交：完成最终检查后创建独立本地提交 `refactor: 重写文件子系统视图与右键菜单`，不执行 `git push`。

### [x] UI-004.9 文件库信息密度与右键定位优化

优先级：P1

目标：根据 Electron 实际窗口验收，进一步降低文件库视觉噪声和 Grid 卡片密度，收敛筛选区信息层级，并修正 TDesign 右键菜单应在鼠标位置打开的问题。

范围：`src/views/FileLibrary.vue`、文件库静态测试和 Electron 文件库 E2E；不得新增后端接口、字段或伪造业务数据。

工作内容：

- 移除 Page Header 描述、当前位置/模式标签、结果标题和结果数量；仅保留面包屑路径。
- 移除材质筛选，保留文件名搜索并将其置于查询按钮之前；模式改为“浏览/选择”，Grid/List 切换与模式控制并列。
- 缩小 Grid 卡片媒体、内边距和最小宽度，去掉 Table 条纹背景并增加 TDesign 语义悬停反馈。
- 在实际 `contextmenu` 事件节点捕获鼠标坐标，通过 TDesign Popup/Popper 定位右键菜单，并处理窗口边界。

验收：

- 文件库桌面首屏不再显示冗余描述、结果标题、数量或材质筛选，Grid 卡片密度适合 Electron 窗口。
- Table 行默认白底，鼠标悬停有明确反馈；Grid 卡片鼠标悬停有边框/阴影反馈。
- 右键菜单在触发鼠标附近打开，仍支持详情流程，且不改变正式 API 数据来源。
- 完成 `npm test`、相关浏览器/Electron Playwright、`npm run lint`、`npm run build` 和提交前 Git 检查。

完成记录：已完成文件库文案收敛、搜索与视图控制重排、Grid 卡片压缩、Table 条纹移除和悬停反馈；右键菜单捕获真实 `contextmenu` 坐标后按 Electron 窗口边界定位。更新静态测试和 Electron 坐标断言，未修改后端接口或文件数据契约。

提交：完成最终检查后创建独立本地提交 `style: 优化文件库密度与右键定位`，不执行 `git push`。

### [x] UI-004.10 文件库控制栏分段控件与搜索布局

优先级：P1

目标：统一文件库顶部控制栏的 TDesign 交互语言，消除左侧空白、视图切换控件样式不一致和搜索操作间距过大的问题。

范围：`src/views/FileLibrary.vue`、文件库静态测试、文件库浏览器/Electron 语义回归测试和本任务记录；不得新增后端接口、字段或伪造业务数据。

工作内容：

- 将“浏览/选择”和网格/列表切换统一为 TDesign `default-filled` 分段单选组，并使用一致的中等尺寸；图标视图切换保留可访问名称。
- 明确控制栏路径、模式和搜索操作的布局边界，移除首项空白，搜索框与查询/重置按钮组成相邻操作组。
- 搜索框使用 TDesign 输入组件的灰色容器背景和无边框样式，保留键盘回车、清空和焦点反馈。
- 更新文件库静态契约测试，确保不改变真实文件查询字段和现有视图/分页/右键功能。

验收：

- 桌面端控制栏左侧从文件夹路径开始，两个选择器高度、边框和选中态一致。
- 搜索框紧邻查询按钮左侧，使用灰底无边框样式；重置按钮保持同组且不产生异常空白。
- 窄窗口按既有响应式规则换行，不产生页面级水平溢出。
- 完成 `npm test`、`npm run test:e2e`、`npm run test:electron`、`npm run test:electron:dist`、`npm run lint`、`npm run build` 和提交前 Git 检查。

完成记录：控制栏路径项取消表单预留空白，浏览/选择与网格/列表统一为 TDesign `default-filled` 分段单选组；搜索、查询和重置合并为相邻操作组，搜索框改为灰色容器背景、无边框并保留焦点反馈。同步更新浏览器/Electron Playwright 对 TDesign radio 语义和可见 label 的断言，未修改文件查询接口、字段和业务数据来源。

测试：`npm test`（145/145）、`npm run test:e2e`（9/9，覆盖 375px、768px、1440px、1920px）、`npm run test:electron`（3/3）、`npm run test:electron:dist`（1/1，含 `npm run build:desktop`）、`npm run lint`、`npm run build` 全部通过。构建保留既有 realtimeStore 动静态导入提示和大 chunk 警告，不影响退出码。

Git 检查：提交前执行 `git status --short`、`git diff --check`，仅暂存本子任务涉及的 `src/views/FileLibrary.vue`、文件库静态测试、浏览器/Electron 回归测试和本任务记录。

提交：完成最终检查后创建独立本地提交 `style: 统一文件库控制栏与搜索布局`，不执行 `git push`。

### [x] UI-004.11 文件库 inline Form 默认间距修复

优先级：P1

目标：修复 TDesign inline Form 默认 `min-width` 和右外边距造成的文件库控制栏空白及搜索操作组被裁剪问题。

范围：`src/views/FileLibrary.vue`、文件库静态测试和本任务记录；不得新增后端接口、字段或伪造业务数据。

工作内容：

- 显式覆盖文件库控制栏表单项的 `min-width` 和 `margin-right`，使路径、模式、视图和搜索操作按页面自定义间距参与布局。
- 保留搜索操作组相邻、搜索框灰底无边框和窄窗口响应式换行行为。
- 增加静态契约断言，防止 TDesign 默认 inline Form 尺寸规则回归。

验收：

- 桌面端控制栏从路径项开始，左侧不再保留额外 200px 空白。
- 搜索框、查询、重置均在控制栏可视范围内，搜索框紧邻查询按钮左侧。
- 完成 `npm test`、`npm run test:e2e`、`npm run test:electron`、`npm run test:electron:dist`、`npm run lint`、`npm run build` 和提交前 Git 检查。

完成记录：显式覆盖 TDesign inline Form 表单项的 `min-width` 和右外边距，解决路径项左侧空白以及搜索操作组被推到可视区域外的问题；保留分段选择器、搜索相邻操作和响应式换行，未修改后端接口/字段/业务数据。

测试：`npm test`（145/145）、`npm run test:e2e`（9/9，覆盖 375px、768px、1440px、1920px）、`npm run test:electron`（3/3）、`npm run test:electron:dist`（1/1，含 `npm run build:desktop`）、`npm run lint`、`npm run build` 全部通过。构建保留既有 realtimeStore 动静态导入提示和大 chunk 警告，不影响退出码。

Git 检查：提交前执行 `git status --short`、`git diff --check`，仅暂存本子任务涉及的文件。

提交：完成最终检查后创建独立本地提交 `style: 修复文件库控制栏默认间距`，不执行 `git push`。

### [x] UI-004.12 文件夹树与当前目录联动重构

优先级：P0

目标：按照最新文件管理工作流恢复左侧文件夹树，使用真实目录树作为导航，右侧只承载当前 `parentId` 对应的直接目录结果；解决文件夹导航缺失、完整树与分页结果职责混淆以及文件库布局不符合参考工作台的问题。

说明：UI-004.6 中“移除常驻目录树”的完成记录属于此前设计基线。本任务作为最新需求的显式覆盖，只恢复文件夹导航，不恢复第二份文件结果列表；不得回写或删除 UI-004.6 的历史记录。

范围：

- `src/views/FileLibrary.vue`
- 新增必要的文件夹树组件，例如 `src/components/file/FileFolderTree.vue`
- `src/api/printFile.js`（仅在需要补充已有正式接口适配时修改，不新增后端接口）
- `tests/fileLibrary.test.js`
- `tests/e2e/browser.spec.js`、`tests/e2e/electron.spec.js` 中的文件库场景
- 本任务记录

工作内容：

- 使用 TDesign `TLayout`、`TAside`、`TContent` 构建文件库左右工作区；左侧宽度使用项目语义尺寸，目标约 208px，不通过自绘卡片模拟另一套布局。
- 使用真实 `GET /api/v1/print-files/tree` 加载完整 `FileNodeVO[]`；文件夹树只保留 `folder=true` 的节点，保留真实 `id/name/parentId/children` 层级，不把文件节点或内部存储字段渲染到树中。
- 根目录使用前端导航名称“我的文件夹”，不作为后端字段发送；根节点对应 `parentId=null`，文件夹节点对应其真实 ID。
- 使用 TDesign `TTree` 的 `activable`、`hover`、`expanded`、`keys` 和必要的 `maxHeight`；不启用 `checkable`、`draggable`，不展示后端未提供的重命名、移动、复制、分享操作。
- 使用 TDesign `TInput` 完成文件夹树本地搜索；搜索只作用于已加载的树数据，并保留匹配节点的父级路径，不调用未定义的树搜索接口。
- 点击树节点、根目录或面包屑时，统一更新 `currentParentId`、路径状态、分页状态和右侧查询；右侧通过正式 `POST /api/v1/print-files/page` 携带 `parentId` 读取当前目录结果。
- 完整目录树只作为左侧导航来源，不能将树中的文件节点再次渲染到右侧。右侧若收到当前目录的直接子文件夹，必须遵从分页接口正式结果，不在前端过滤后伪造分页总数；若产品要求严格“仅文件”，记录为后端筛选契约缺口，不猜测接口。
- 新建文件夹成功后刷新目录树和当前目录结果；刷新失败保留已有结果并在对应区域展示 TDesign `TAlert` 与重试入口。
- 左侧树覆盖加载中、空树、加载失败和当前节点不存在状态；右侧覆盖列表加载、空目录、无搜索结果、刷新失败、分页和详情 Drawer 状态。
- 将文件库页面中与目录树强耦合的状态和展示逻辑拆分到独立组件，主页面保留 API 调用协调、当前目录状态、上传、删除、详情和创建任务流程。
- 保留现有 Table 默认、Grid 可选、文件详情 Drawer、上传、删除、右键菜单和创建任务能力，不能因为恢复目录树而改变已有正式接口字段或业务动作。

真实契约依据：

- `GET /api/v1/print-files/tree` 返回完整树，节点字段为 `id`、`parentId`、`folder`、`name`、`fileSize`、`materialType`、`createdAt`、`children`。
- `POST /api/v1/print-files/page` 支持 `pageNum`、`pageSize`、`fileName`、`materialType`、`parentId`。
- `POST /api/v1/print-files/folder/create` 支持 `parentId` 和 `folderName`。
- 当前真实开发数据已验证根目录存在 2 个文件夹和 9 个文件，两个文件夹分别可通过 `parentId` 查询到 4 个文件。

验收：

- 登录后文件库左侧显示真实文件夹树、搜索框和新建文件夹入口；树不显示文件节点，不产生第二份文件列表。
- 选中根目录、一级文件夹和二级文件夹时，右侧请求的 `parentId` 分别为 `null` 或对应真实 ID；面包屑、树高亮、分页和右侧结果保持同步。
- 根目录及各文件夹的右侧结果来自真实分页接口，不读取完整树中的文件数据冒充列表；文件字段、数量和分页不被前端伪造。
- 树和右侧结果分别有清晰的局部滚动边界；外层页面不出现第三层滚动，分页不随表格内容滚动。
- 覆盖树加载、树为空、树失败重试、当前目录为空、搜索无结果、目录创建后刷新、目录切换竞态和详情 Drawer 关闭焦点恢复。
- Electron 使用实际窗口内容尺寸 `800×560`、`1024×640`、`1200×760` 验证；浏览器覆盖 `375×812`、`768×1024`、`1440×900`、`1920×855`。
- 不新增重命名、移动、复制、分享等未在当前后端契约中存在的操作，不修改后端代码。
- 完成 `npm test`、相关浏览器/Electron Playwright、`npm run lint`、`npm run build`、`npm run build:desktop`，并执行 `git status --short`、`git diff --check` 和暂存后的 `git diff --cached --check`。

完成后提交：`refactor: 重构文件夹树与当前目录联动`。

完成记录：新增 FileFolderTree，通过正式 GET /api/v1/print-files/tree 加载当前用户可见的目录树，仅保留文件夹节点；使用 TDesign TLayout、TAside、TContent、TTree、TInput、TAlert、TEmpty 和 TLoading 建立左侧目录导航。根节点使用前端标签“我的文件夹”并映射 parentId=null，目录树支持本地搜索、父级路径保留、激活态、展开态、刷新、创建入口、空态和失败重试。右侧继续只通过正式 POST /api/v1/print-files/page 携带当前 parentId 查询目录结果，未从完整树复制文件数据或伪造分页；面包屑、目录树、分页和列表/网格切换保持同步。新建目录成功后同时刷新目录树和当前目录，保留文件上传、删除、下载、详情、打印、右键菜单和创建任务流程，并明确不展示后端未提供的重命名、移动、复制、分享动作。

修改文件：src/components/file/FileFolderTree.vue、src/views/FileLibrary.vue、tests/fileLibrary.test.js、tests/e2e/browser.spec.js、tests/e2e/electron.spec.js、playwright.config.js、本任务记录。

用户流程影响：文件库现在以左侧真实目录树作为导航，右侧只呈现当前目录的正式分页结果；用户可从根目录、树节点、面包屑或右侧目录行进入目录，也可在左侧搜索文件夹和直接创建文件夹。桌面端和窄屏端分别使用左右布局与上下布局，目录树和结果区各自拥有明确滚动边界。

API/OpenAPI 核对：未新增或修改后端接口；目录树使用 /api/v1/print-files/tree 的 id、parentId、folder、name、children，当前目录使用 /api/v1/print-files/page 的 parentId、fileName、分页字段，创建目录继续使用 /api/v1/print-files/folder/create 的 parentId、folderName。真实开发数据已验证根目录 2 个文件夹、9 个文件，两个目录各有 4 个文件。

Loading/Empty/Error：目录树独立提供加载、空树和失败重试；右侧保留列表加载、空目录、查询错误、刷新重试和详情 Drawer 状态。目录切换继续以当前请求结果为准，失败时不伪造结果或总数。

响应式视口：Electron Playwright 覆盖实际窗口内容尺寸 800×560、1024×640、1200×760；浏览器 Playwright 覆盖 375×812、768×1024、1440×900、1920×855。最终浏览器验收使用独立 Mock 端口 PW_BROWSER_PORT=5185，避免复用旧的非 Mock 5173 服务。

测试：npm test（155/155）、PW_BROWSER_PORT=5185 npm run test:e2e（9/9）、npm run test:electron（3/3）。

lint：npm run lint 通过，Oxlint 和 ESLint 均无错误。

build：npm run build、npm run build:desktop 通过；保留既有 realtimeStore 动静态导入提示和大 chunk 警告。

git status --short：提交前仅包含本子任务的目录树组件、文件库页面、Playwright/文件库测试和本任务记录。

git diff --check：通过。

提交：完成最终检查后创建独立本地提交 refactor: 重构文件夹树与当前目录联动，不执行 git push。

### [x] UI-004.13 文件库单一树导航与常驻选择工具栏

优先级：P0

目标：移除右侧重复的页面导航和浏览/选择模式切换，使文件库由左侧真实文件夹树统一导航；将文件操作、视图切换和搜索收敛到右侧列表上方同一工具栏，并让选择列始终可见。

范围：`src/views/FileLibrary.vue`、`src/components/TdTable.vue`、`src/components/TdTableColumn.vue`、`tests/fileLibrary.test.js`、`tests/e2e/electron.spec.js` 和本任务记录；不得修改后端接口、字段、数据适配器或 `src/stores/printerStore.js.backup`。

工作内容：

- 移除右侧面包屑、右侧文件夹打开动作和“浏览/选择”模式状态；右侧目录结果中的文件夹保留正式分页返回，但只能通过左侧树进入。
- 列表视图永久显示 TDesign Table 的多选列；网格视图永久显示选择框，文件夹不参与文件批量操作，批量删除入口根据实际选择显示。
- 将“新建文件夹”“上传 G-Code 文件”“刷新”与搜索框、查询、重置放入同一行工具栏；删除 PageHeader 中重复的顶部操作入口。
- 保留 TDesign `RadioGroup` 的 `default-filled` 视图切换，仅使用组件默认尺寸与选中态，不再为列表/网格切换器绘制自定义按钮样式。
- 保留搜索框灰底无边框、键盘回车查询、加载/空目录/错误重试、分页、右键菜单、详情和真实 `parentId` 查询链路。

验收：

- 文件库右侧不存在面包屑和浏览/选择模式切换；切换目录只能通过左侧 `FileFolderTree` 更新 `parentId` 并重新查询。
- 列表首列始终显示选择框，网格选择框不因模式切换布局跳动，批量操作仅使用已选文件。
- 三个文件操作按钮与搜索框处于同一工具栏行，窄窗口按 TDesign Space 规则换行，不产生重复顶部按钮或异常横向溢出。
- 视图切换使用 TDesign `RadioGroup` 默认分段样式，无 `.file-library-mode-controls` 或自定义 `.t-radio-button` 尺寸覆盖。
- 完成 `npm test`、浏览器/Electron Playwright、`npm run lint`、`npm run build`、`npm run build:desktop`，并执行提交前 Git 检查。

完成记录：文件库改为左侧文件夹树唯一导航，移除右侧面包屑、文件夹打开入口和浏览/选择模式；列表选择列与网格选择框常驻，文件夹不参与文件批量操作。新建文件夹、上传、刷新与 TDesign 默认视图分段、灰底无边框搜索框、查询/重置合并到结果区同一工具栏，PageHeader 不再重复承载操作按钮。未修改后端接口、字段和真实数据查询链路。

测试：`npm test`（155/155）、`PW_BROWSER_PORT=5186 npm run test:e2e`（9/9）、`npm run test:electron`（3/3）、`npm run test:electron:dist`（1/1，含 `npm run build:desktop`）、`npm run lint`、`npm run build` 全部通过。构建保留既有 realtimeStore 动静态导入提示和大 chunk 警告，不影响退出码。

Git 检查与提交：提交前执行 `git status --short`、`git diff --check`，仅暂存本子任务涉及的文件；完成后再次检查工作区并提交本地变更，不执行 `git push`。

### 8.6 UI-004 执行顺序与统一约束

`UI-004.0 → UI-004.1 → UI-004.2 → UI-004.3 → UI-004.4 → UI-004.5 → UI-004.6 → UI-004.7 → UI-004.8 → UI-004.9 → UI-004.10 → UI-004.11 → UI-004.12 → UI-004.13 → UI-004.14 → UI-004.15 → UI-004.16`

- UI-004 是独立文件库 UI/UX 重写任务，不属于 `farm-ui-v2`，不回写 UI-001、UI-002、UI-003 的历史状态。
- 所有文件数据必须来自 API_HANDOFF、运行时 OpenAPI 和现有数据适配器；运行时泛型 schema 与正式文档冲突时记录并暂停相关猜测。
- TDesign 官方组件优先；页面 CSS 只负责必要的布局和数据密度，不重新创造按钮、标签、表格、弹窗和状态视觉体系。
- 任何 `height`、`overflow`、滚动容器或 Drawer Body 修改，都必须在 Electron 三种窗口尺寸下实际验证。
- 每个子任务完成后单独提交，不执行 `git push`；所有完成记录必须包含测试、lint、build、Git 检查、提交哈希和环境限制。

### [x] UI-004.14 文件库工具栏与结果表格视觉分层修复

优先级：P1

目标：修复文件库右侧工具栏与表格首行视觉粘连的问题，让操作区、结果区和表格滚动区形成清晰且稳定的 TDesign 信息层级。

范围：`src/views/FileLibrary.vue`、`tests/fileLibrary.test.js`、`tests/e2e/electron.spec.js` 和本任务记录；不修改后端接口、数据适配器、滚动业务逻辑或 `src/stores/printerStore.js.backup`。

工作内容：

- 将文件操作、视图切换和搜索工具栏改为 TDesign 语义色和边框 token 定义的独立浅色表面，保留窄窗口换行能力。
- 为列表结果区增加独立白色表面、边框和圆角，使表头/首行不再直接连接工具栏；保留 TDesign Table 原生表格结构和单一内容滚动容器。
- 增加源码与 Electron 布局断言，验证两个区域实际存在边界和最小间距，同时确保表格仍可滚动。

验收：

- 工具栏和结果表格之间至少保留 8px 视觉间距，二者具有可辨识的独立边界，首行不与工具栏粘连。
- 不引入第二个表格滚动容器，不改变文件夹树导航、选择、右键菜单、搜索、分页及 API 查询行为。
- 在 Electron 端文件库页面验证工具栏背景/边框、表格边框/圆角和滚动属性；窄窗口不产生异常横向溢出。
- 完成 `npm test`、浏览器/Electron Playwright、`npm run lint`、`npm run build`、`npm run build:desktop`，并执行提交前 Git 检查。

完成记录：文件库工具栏改为独立 TDesign 语义浅色表面，结果表格增加独立白色边界与圆角，并保留单一表格内容滚动；补充源码和 Electron 间距/边界断言，避免工具栏与首行再次视觉粘连。

验证：`npm test`（155/155）、`npm run test:e2e`（9/9）、`npm run test:electron`（3/3）、`npm run lint`、`npm run build`、`npm run build:desktop` 全部通过；构建保留既有 realtimeStore 动静态导入提示和大 chunk 警告，不影响退出码。

Git 检查与提交：已执行 `git status --short`、`git diff --check`，仅提交本子任务涉及的 4 个文件；提交哈希：`bcbf7da`。未执行 `git push`。

### [x] UI-004.15 文件库右侧内容区平级结构整理

优先级：P1

目标：让文件库右侧操作栏、结果视图和分页在内容区保持清晰的平级结构，避免操作栏被误认为表格的一部分。

范围：`src/views/FileLibrary.vue`、`tests/fileLibrary.test.js`、`tests/e2e/electron.spec.js` 和本任务记录；不修改后端接口、数据适配器、文件操作逻辑或 `src/stores/printerStore.js.backup`。

工作内容：

- 移除包裹操作栏、状态、文件视图和分页的 `.file-library-results` 容器。
- 让操作栏、加载/错误/空状态、网格/表格视图和分页成为 `.file-library-main` 的直接子级，并继续保持表格单一滚动容器。
- 保留 TDesign Table、TDesign Empty、TDesign Alert 的原有交互和视觉语义；加载失败且已有数据时只显示错误提示并保留已有列表。
- 补充源码和 Electron DOM 层级断言，覆盖列表、分页、滚动和右键菜单视口避让行为。

验收：

- 操作栏、结果表格/网格和分页不再共享结果包裹层，视觉上分属独立区域。
- 列表模式仍可滚动，网格模式仍可展示，加载、空数据和已有数据错误状态不互相覆盖。
- 右键菜单在窗口底部触发时允许按视口边界向上避让，但仍保持在鼠标附近可见区域。
- 完成 `npm test`（155/155）、`npm run test:e2e`（9/9）、`npm run test:electron`（3/3）、`npm run lint`、`npm run build`、`npm run build:desktop`。

完成记录：文件库右侧移除结果包裹层，操作栏、结果视图与分页改为主内容区平级节点；加载/空态/错误态按结果状态独立呈现，保留 TDesign Table 单一滚动模型，并修正 Electron 右键菜单在底部视口的断言方式。

验证：`npm test`（155/155）、`npm run test:e2e`（9/9）、`npm run test:electron`（3/3）、`npm run lint`、`npm run build`、`npm run build:desktop` 全部通过；构建保留既有 realtimeStore 动静态导入提示和大 chunk 警告，不影响退出码。一次并行回归曾因两个 Playwright 项目抢占 5177 端口失败，改为串行后全部通过。

Git 检查与提交：已执行 `git status --short`、`git diff --check`，仅提交本子任务涉及的 4 个文件；提交哈希：`92d2c51`。未执行 `git push`。

### [x] UI-004.16 文件库 TDesign 容器重构

优先级：P1

目标：移除旧版文件库外层大卡片和自定义表面拼接，使用 TDesign Card、Layout 和 Table 的默认设计语言组织文件夹树、操作栏和文件结果区。

范围：`src/views/FileLibrary.vue`、`src/components/file/FileFolderTree.vue`、`tests/fileLibrary.test.js`、`tests/e2e/electron.spec.js` 和本任务记录；不修改后端接口、数据适配器、文件操作逻辑或 `src/stores/printerStore.js.backup`。

工作内容：

- 移除包裹左右区域的旧 `file-library-workspace` 外层 Card。
- 左侧文件夹树使用独立 TDesign Card，右侧工具栏和网格/表格结果分别使用独立 TDesign Card，页面灰底承担区域间留白。
- 让 TDesign Table 通过 `hover` 使用官方悬停语义，移除强制覆盖表格行背景的自定义 CSS。
- 保留单一表格内容滚动、分页、选择、右键菜单、加载/空态/错误态和现有 API 行为。
- 增加源码及 Electron DOM 层级断言，验证独立卡片和主内容区层级关系。

验收：

- 工作区不再以一个白色大 Card 包裹左右内容；左树、右工具栏、右结果区分别具有 TDesign Card 边界。
- 操作栏不再与表格首行共享背景，表格使用 TDesign 默认表头、行边界和 hover 语义。
- 列表和网格均可正常切换，表格仅保留一个内容滚动区，分页不被卡片内容遮挡。
- 完成 `npm test`（155/155）、`npm run test:e2e`（9/9）、`npm run test:electron`（3/3）、`npm run lint`、`npm run build`、`npm run build:desktop`。

完成记录：文件库改为页面灰底上的 TDesign 多卡片布局，移除旧版工作区大卡片和表格行背景覆盖，左侧文件夹树、右侧工具栏及结果区各自独立；表格启用 TDesign hover，保留原有查询、操作和单一滚动模型。

验证：`npm test`（155/155）、`npm run test:e2e`（9/9）、`npm run test:electron`（3/3）、`npm run lint`、`npm run build`、`npm run build:desktop` 全部通过；构建保留既有 realtimeStore 动静态导入提示和大 chunk 警告，不影响退出码。

Git 检查与提交：已执行 `git status --short`、`git diff --check`，仅提交本子任务涉及的 5 个文件；提交哈希：`41f85be`。未执行 `git push`。

### [x] UI-004.17 文件库滚动、网格与实时搜索修复

优先级：P1

目标：修复 UI-004.16 后文件库结果区高度约束、网格铺开、操作入口和搜索交互回归，确保列表/图标模式在 Electron 桌面窗口中可用。

范围：`src/views/FileLibrary.vue`、`src/components/file/FileFolderTree.vue`、`tests/fileLibrary.test.js`、`tests/e2e/browser.spec.js`、`tests/e2e/electron.spec.js` 和本任务记录；不修改后端接口、文件数据适配器或 `src/stores/printerStore.js.backup`。

工作内容：

- 将新建文件夹入口从右侧工具栏移除，保留在文件树标题区，并使用带主题的 TDesign 按钮。
- 为结果 Card、Card body、表格视图和网格视图补齐可收缩宽高约束，恢复列表滚动并让网格按可用宽度平铺。
- 将列表/图标切换器统一为与搜索框相同的 medium 高度，保证图标在按钮内水平垂直居中且尺寸一致。
- 为文件名搜索增加防抖实时查询，保留回车、查询和重置操作的兼容行为，并在组件卸载时清理定时器。
- 补充源码断言，覆盖新增按钮位置、控件尺寸、结果区高度和网格尺寸约束。

验收：

- 列表模式的表格内容区可独立上下滚动，页面不会被结果内容撑开。
- 图标模式的文件卡片在结果区内按多列平铺，窗口缩放后仍能自适应。
- 新建文件夹按钮只出现在左侧文件树区域，并具有明确的 TDesign 按钮样式。
- 列表/图标切换按钮与搜索框等高，两个图标均在按钮内部居中。
- 输入文件名后约 300ms 自动刷新当前目录结果；切换目录、重置和卸载不会留下重复请求或定时器。
- 完成 `npm test`、`npm run test:e2e`、`npm run test:electron`、`npm run lint`、`npm run build` 和 `npm run build:desktop`。

完成记录：新建文件夹入口移至左侧文件树并使用主色描边按钮；结果 Card 及其 body 增加可收缩高度，恢复列表单一滚动区；网格固定占满结果区并按 220px 最小宽度自适应平铺；视图切换器统一 medium 高度并将图标居中；文件名搜索增加 300ms 防抖实时查询，卸载时清理定时器。

验证：`npm test`（155/155）、`npm run test:e2e`（9/9）、`npm run test:electron`（3/3）、`npm run lint`、`npm run build`、`npm run build:desktop` 全部通过；额外验证网格实际多列铺开；构建保留既有 realtimeStore 动静态导入提示和大 chunk 警告，不影响退出码。

Git 检查与提交：已执行 `git status --short`、`git diff --check`，仅提交本子任务涉及的 6 个文件；提交哈希：`b338ab8`。未执行 `git push`。

### [x] UI-004.18 文件库入口精简与控件细节修复

优先级：P2

目标：继续精简文件库操作入口，修复视图切换器图标裁切，并统一文件树搜索与新增按钮的 TDesign 细节。

范围：`src/views/FileLibrary.vue`、`src/components/file/FileFolderTree.vue`、`tests/fileLibrary.test.js`、`tests/e2e/electron.spec.js` 和本任务记录；不修改后端接口、文件数据适配器或 `src/stores/printerStore.js.backup`。

工作内容：

- 移除文件树标题区刷新按钮，保留组件内部刷新方法供新建文件夹成功后同步目录树和错误态重试使用。
- 移除右侧工具栏刷新和重置按钮，保留查询按钮、回车查询及文件名输入的实时搜索。
- 将工具栏“上传 G-Code 文件”简化为“上传”，并同步空目录操作入口。
- 移除文件树“按目录查看文件”辅助文案。
- 为文件树搜索框补充灰色背景、透明边框和 TDesign 阴影；新增文件夹按钮缩小为 small。
- 为网格/列表图标显式设置统一尺寸，保证在 medium 切换器内水平垂直居中。

验收：

- 文件树和右侧工具栏不再展示无效或重复的刷新按钮；目录创建后的程序化刷新和错误重试仍可用。
- 右侧不再展示重置按钮，输入文件名继续防抖实时搜索，查询和回车兼容保留。
- 上传按钮显示为“上传”。
- 文件树搜索具有灰色阴影输入样式，新增文件夹 `+` 按钮为 small 尺寸。
- 网格/列表图标不被按钮内部裁切，且两个图标尺寸一致、居中显示。
- 完成 `npm test`、`npm run test:e2e`、`npm run test:electron`、`npm run lint`、`npm run build` 和 `npm run build:desktop`。

完成记录：移除文件树和右侧工具栏的无效刷新入口，移除重置按钮并保留实时搜索及查询操作；上传按钮简化为“上传”；删除文件树辅助文案；文件树搜索使用灰色阴影输入样式；新增文件夹按钮调整为 small；视图图标固定 16px 并保持 medium 切换器布局。

验证：`npm test`（155/155）、`npm run test:e2e`（9/9）、`npm run test:electron`（3/3）、`npm run lint`、`npm run build`、`npm run build:desktop` 全部通过；构建保留既有 realtimeStore 动静态导入提示和大 chunk 警告，不影响退出码。

Git 检查与提交：已执行 `git status --short`、`git diff --check`，仅提交本子任务涉及的 5 个文件；提交信息：`refactor: 完成 UI-004.18 文件库入口精简与控件细节修复`。未执行 `git push`。
