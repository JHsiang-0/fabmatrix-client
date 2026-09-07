# FabMatrix 独立前端 UI 整改设计

版本：v1.2
对应需求：.kiro/specs/farm-ui-remediation/requirements.md  
视觉基线：FRONTEND_UI_SPECIFICATION.md

## 9. UI-002 Electron 优先设计补充

### 9.1 验收优先级

UI-002 采用“Electron 实机窗口 → 页面工作流 → 状态矩阵 → 浏览器回归”的顺序。Electron 使用当前项目的实际主进程和隔离用户目录；`desktop-mock` 只用于稳定复现前端状态，不能替代真实后端联调。

### 9.2 Electron 页面壳

Electron 窗口不改变业务页面的信息架构。统一结构仍为：

`t-layout → Aside/Menu → Header → Content → PageHeader → QueryToolbar → DataRegion`

约束：

- `Content View` 是页面纵向滚动 owner。
- `Table` 只有内容区横向/局部纵向滚动，分页位于滚动内容之外。
- 文件库目录树、结果区和 Drawer Body 可以独立滚动，但每个区域只能有一个实际滚动容器；目录树滚动只存在于固定高度的 `TAside` 内，不能再叠加页面级或工作区级滚动。
- 800px 宽度下隐藏低优先级表格列或允许明确横向滚动，不压缩核心操作到不可点击。
- Drawer Header/Footer 不随 Body 内容滚动；关闭后恢复触发按钮焦点。

### 9.3 打印机详情数据流

`OpenAPI/API_HANDOFF → printers API → Printer Store/selector → detail view model → TDesign Drawer`

列表只提供标识和摘要。详情组件先根据稳定 ID 打开 Drawer，再在 Body 内展示 detail loading、success、empty 或 error。实时 Store 只能覆盖契约允许的实时字段；不能使用列表数据拼装静态详情，也不能用 0、epoch 或空字符串伪造后端未返回的值。

### 9.4 文件库数据工作台

文件库采用单一主工作区：PageHeader、TDesign Card 工作区、inline Form 筛选栏、面包屑、当前目录 Table/Grid、分页和文件详情 Drawer。取消常驻左侧目录树，文件夹只在当前目录正式结果中出现一次；Table 是默认视图，Grid 是共享同一分页结果的可选视图。

当前目录和筛选状态由 `parentId`、`fileName`、`materialType`、分页和刷新状态组成，统一通过 `POST /print-files/page` 读取。根目录使用 `parentId=null`，文件夹打开后更新 `parentId` 和面包屑；不得把 `GET /print-files/tree` 与当前结果同时渲染为两份文件列表。`GET /print-files/folder/content` 仅在后续明确需要非分页直接子节点场景时使用，不能与分页结果混用造成状态分叉。

文件夹仅展示名称、目录标识、打开和删除；文件展示安全元数据、详情、打印、下载和删除。详情通过行/卡片点击或操作菜单打开，不依赖额外的“详情”按钮。右键菜单使用 TDesign `Dropdown` 的 `trigger="context-menu"`，作为可见操作按钮之外的辅助入口：文件夹只提供打开/删除，文件提供详情/打印/下载/删除，多选只提供正式批量删除。后端未提供重命名、移动、复制、分享接口时，界面不得展示这些操作。

空目录、无结果、列表加载、刷新失败、上传逐项失败和详情加载失败均在当前 Card 工作区或 Drawer Body 内原位表达；不以文件夹统计、文件大小汇总或其他未由接口返回的字段填充卡片空白。

### 9.5 任务与批量派发

任务中心将正式状态集合映射到三个用户工作区：待派发、活动任务、历史。详情和动作通过状态适配器决定显示。活动进度使用 TDesign Progress，状态使用统一 Tag，缺失时间使用语义空值。

批量派发使用 Steps + 单一当前工作区 + 稳定操作栏。已完成步骤只保留摘要；预览只读；确认执行以后展示服务端返回的计划、确认和逐项结果，不增加前端自造的结果状态。

### 9.6 样式收口

- 业务页面使用 TDesign 组件和 `--app-*` 语义 token。
- Tailwind 仅用于不改变视觉语义的布局辅助类。
- `TdTable` 只用于现有列插槽迁移，新增表格优先使用 TDesign 原生 Table。
- 页面 CSS 不再重复定义 TDesign Button、Tag、Alert、Card 的主色和交互状态。
- 每次涉及 `height`、`overflow`、定位或 Loading 父级的修改，都必须附带 Electron 三窗口尺寸滚动回归。

### 9.7 证据格式

每个 UI-002 子任务完成记录必须包含：影响页面、契约来源、Loading/Empty/Error、Electron 窗口尺寸、操作步骤、截图或失败证据、测试/lint/build 命令、提交哈希和剩余限制。

## 1. 设计原则

TDesign Vue Next 是业务页面的组件和视觉基础。页面不通过大量自定义 CSS 模拟另一套设计系统。

| 场景 | TDesign 组件 |
| --- | --- |
| 应用框架 | Layout、Aside、Header、Content |
| 导航 | Menu、Breadcrumb、Dropdown |
| 页面结构 | Card、Space、Divider |
| 表格 | Table、Pagination |
| 表单 | Form、Input、Select、DatePicker、Upload |
| 反馈 | Loading、Skeleton、Empty、Alert、Result |
| 状态 | Tag、Badge、Progress |
| 详情 | Drawer、Descriptions、Statistic、Tabs |
| 确认 | Dialog、Popconfirm |
| 工作流 | Steps |

## 2. 数据流设计

OpenAPI/API_HANDOFF → src/api 参数和响应适配 → Pinia Store/Selector → 页面 View Model → TDesign Component。

页面不直接使用 Axios，不自行解包统一响应，不在模板中判断大量原始枚举。

## 3. 应用壳设计

### 3.1 尺寸

| Token | 值 | 用途 |
| --- | ---: | --- |
| app sidebar width | 232px | 桌面 Sidebar |
| app sidebar collapsed width | 64px | 折叠 Sidebar |
| app header height | 64px | 桌面 Header |
| app content padding | 24px | 桌面 Content |
| app mobile padding | 16px | 窄屏 Content |
| app content max width | 1600px | 内容最大宽度 |

通过项目语义 token 或 TDesign token 管理，不在业务页面重复硬编码。

### 3.2 页面骨架

App Layout → Sidebar → Main Layout → Header → Content → Breadcrumb（可选）→ Route View。

页面组件使用 Page Header、Query Toolbar 和 Data Region 三段结构。Page Card 只用于有独立内容生命周期的区域，不能用于填充页面剩余高度。

### 3.3 滚动

- App Shell 负责布局高度。
- 页面内容默认自然增长。
- 文件库 `TTree`、Table/Grid 结果区和 Drawer Body 是允许局部滚动的区域；目录树和结果区各自只能有一个滚动容器。
- 每个局部区域只有一个滚动容器。
- 分页位于表格滚动区域之外。

## 4. 公共页面模式

### Page Header

标题、说明、主操作和次操作只出现一套。重复标题必须删除或改为区域说明。

### Query Toolbar

查询字段位于左侧，查询、重置、刷新位于右侧。桌面使用 inline Form，窄屏换行或抽屉化。字段名、默认值和空值语义由 src/api 决定。

### Data Region

默认结构为 Page Header → Query Toolbar → Table → Pagination。不得用整页 Card、空白伸展和绝对定位 Table 作为默认模式。

### Status View Model

状态适配器统一输出 code、label、theme、icon、description。模板只使用适配后的结果，不直接显示后端枚举。

## 5. 页面设计

### 5.1 服务器连接

页面结构：协议、IP/Host、端口、地址预览、测试、保存并连接。

测试只验证连接；保存并连接才持久化并进入认证流程。没有后端发现协议时，不展示伪造的局域网服务器搜索结果。

### 5.2 打印机管理

页面结构：Page Header、搜索和状态 Toolbar、核心字段 Table、详情 Drawer。

列表核心字段为 ID、名称、机器编号、IP、状态、协议、当前任务和操作。热床安全、耗材、喷嘴等低频信息进入详情。

静态详情来自正式详情接口，实时覆盖来自实时 Store。缺少实时值显示占位，不显示伪造零值。

### 5.3 文件库

页面结构：Page Header、TDesign Card 工作区、`TLayout`、`TAside` 文件夹树、`TContent` 当前目录工作区、inline Form 筛选栏、面包屑、文件 Table 或 Grid、分页和文件详情 Drawer。

左侧文件夹树是目录导航，不是第二份文件结果列表。树数据来自完整的 `GET /api/v1/print-files/tree`，只渲染 `folder=true` 的节点；文件节点及其文件元数据不在树中展示。根节点“我的文件夹”是前端导航名称，选中根节点时向后端传 `parentId=null`。

右侧结果区只请求当前目录的直接子节点，使用 `POST /api/v1/print-files/page` 的 `parentId`、`fileName`、`materialType` 和分页字段。不得把完整树中的文件节点再次渲染为右侧结果。若当前目录接口返回直接子文件夹，必须保留其正式返回语义；前端不得在分页完成后自行过滤并伪造 `total`。严格的“仅文件”结果需要后端提供正式筛选契约。

TDesign 组合使用 `TLayout`、`TAside`、`TContent`、`TTree`、`TInput`、`TButton`、`TBreadcrumb`、`TTable`、`TPagination`、`TEmpty`、`TAlert` 和 `TLoading`。文件夹树支持 `activable`、`hover`、`expanded` 和 `keys`，不启用 `checkable` 或 `draggable`；当前后端没有重命名、移动、复制和分享接口，树节点不得显示这些操作。

默认以 TDesign Table 处理大量文件，Grid 作为用户选择。Table 第一列统一承载文件夹/文件图标、名称和类型；文件夹显示目录专属操作，文件显示打印、下载、删除等正式操作，详情通过行或卡片点击进入 Drawer。Grid 使用紧凑 TDesign Card，文件夹不复用文件的耗时、耗材和成功率字段，不为缺失字段填充默认值。

右键菜单采用 TDesign Dropdown `trigger="context-menu"`，必须与可见按钮保持同一权限和接口边界，不替代键盘和按钮操作。当前后端契约只支持目录创建、分页/直接子节点读取、上传、预览、缩略图、关联任务、下载、打印任务创建、单删和批量删除；重命名、移动、复制、分享等能力在后端接口出现前不进入 UI。

### 5.4 任务中心

页面结构：Page Header、待派发任务和活动任务 Tabs、Toolbar、任务 Table、任务详情 Drawer。

历史作为独立页面，不与活动队列混用。只有实际有数据的区域才使用内容高度；空数据使用带行动建议的 Empty。

### 5.5 批量派发

Steps 只显示当前步骤工作区，已完成步骤保留摘要。当前步骤的主操作固定在明确位置，不能藏在首屏以下。

### 5.6 管理、日志和个人中心

用户管理、操作日志和个人中心使用自然内容高度，不以超大 Card 填满视口。日志动作通过文案适配器展示，原始枚举只作为开发信息保留。

## 6. 异步状态设计

页面状态：idle → loading → success(data)，success 还可以进入 success(empty) 或 error(retryable)。

刷新状态：success(data) → refreshing → success(newData)，失败时保留旧数据并标记 stale。

Drawer 先打开结构，再在 Body 内显示 detail loading、success、empty 或 error。标题不能依赖尚未返回的名称字段。

| 语义 | UI 表达 | 恢复动作 |
| --- | --- | --- |
| 401 | 会话失效提示 | 重新登录 |
| 403 | 无权限 Result/Alert | 返回可访问页面 |
| 404 | 资源不存在 | 返回列表或刷新 |
| 409 | 状态冲突 | 刷新后重试 |
| 422 | 表单或状态错误 | 修正输入或重新选择 |
| 503 | 服务不可用 | 重试并保留已有数据 |

## 7. CSS 和兼容层

- TDesign token 管理颜色、字体、组件尺寸和状态主题。
- 项目语义 token 管理品牌色、应用壳尺寸和页面间距。
- 页面 CSS 只处理必要的布局和数据密度。
- Tailwind 在迁移期间只保留少量辅助类。
- TdTable 只在现有列插槽无法安全迁移时使用。
- 涉及高度、overflow、绝对定位和 Loading 父级的修改必须单独做滚动验收。

## 8. 测试设计

浏览器测试使用真实用户点击、输入、Tab、Enter、Escape、分页、筛选、详情、上传和确认。

禁止使用 dispatchEvent 代替核心点击，禁止复制 DOM 行制造滚动数据，禁止在页面稳定前截图。

视口：375×812、768×1024、1024×768、1440×900、1920×855。

Electron 验收使用实际 Electron 壳和构建产物，检查窗口尺寸、缩放、滚动、快捷键、API/WebSocket 地址解析和主要业务流程。
