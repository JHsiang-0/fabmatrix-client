# 前端 Kiro 任务清单

## Kiro Task UI-001.39：增加打印机管理表格悬停反馈

状态：已完成（专项测试 8/8；lint/build 通过）

范围：

- `src/views/PrinterManage.vue`
- `tests/printerHover.test.js`
- `.kiro/specs/farm-frontend/tasks.md`

目标：

- 为打印机管理列表视图增加清晰、稳定的行悬停反馈。
- 使用 TDesign Table 官方 `hover` 能力，并复用项目语义颜色。
- 保持行点击、详情、编辑、删除和状态展示逻辑不变。
- 让卡片视图与列表视图保持一致的悬停和键盘焦点视觉反馈。

实施方案：

- 为内部 `TdTable` 传入 `hover`，由兼容层透传到 TDesign Table。
- 悬停行使用容器 hover 背景色，首列增加品牌色内侧强调线，并添加短暂过渡。
- 卡片 hover 增加同源背景色，focus-visible 增加品牌色轮廓，避免仅依赖鼠标操作。
- 增加静态回归测试，锁定模板属性和语义化样式。

验收标准：

- 鼠标移入列表任意数据行时，整行出现浅色高亮，首列显示强调线。
- 表格行不会因 hover 发生位移，行内操作按钮仍可正常点击。
- 卡片视图保留圆角、边框和阴影，并使用一致的 hover 背景。
- 相关专项测试、lint、build 和 `git diff --check` 通过。

完成记录：

- 已为列表模式的 `TdTable` 开启 TDesign 行悬停能力。
- 已增加浅色背景、首列品牌色强调线和短暂过渡，避免 hover 导致表格布局抖动。
- 已增强卡片模式 hover，并补充按钮语义、键盘焦点和 Enter/Space 操作。
- `node --test tests/printerHover.test.js tests/printerCenter.test.js` 通过（8/8）。
- `npm run lint`、`npm run build` 和 `git diff --check` 通过。

提交建议：`feat: 增加打印机管理表格悬停反馈`

## Kiro Task UI-001.38：修复打印机管理未分配设备抽屉数据与关闭交互

状态：已完成（专项测试 6/6；lint/build 通过；全量测试保留 3 项既有失败）

范围：

- `src/views/PrinterManage.vue`
- `tests/printerCenter.test.js`
- `.kiro/specs/farm-frontend/tasks.md`

目标：

- 修复未分配设备接口响应对象未读取 `data` 数组，导致抽屉表格无数据的问题。
- 统一未分配设备抽屉的加载、空数据、错误、重试和关闭状态。
- 确保底部“关闭”按钮、抽屉自身关闭事件和重新打开流程可用。
- 增加回归断言，防止接口响应层级和关闭事件再次退化。

实施方案：

- 在加载方法中读取 `response.data`，并通过数组校验后传给 TDesign Table。
- 请求开始时清空旧数据，保留 `AsyncState` 的 Loading、Empty、Error 和 Retry 展示。
- 将关闭逻辑提取为 `closeUnallocatedDialog`，统一清理可见状态、列表和错误信息。
- 通过 `@close` 和底部按钮共同调用关闭方法。

验收标准：

- 点击“未分配设备”后，接口返回设备时显示 TDesign 表格。
- 无设备时显示“暂无未分配设备”，请求失败时可点击“重试”。
- 点击底部“关闭”或抽屉关闭入口后，抽屉能够关闭且下次打开重新请求。
- 专项测试、lint、build 和 `git diff --check` 通过。

完成记录：

- 已将未分配设备响应解析为 `response.data` 数组，并增加数组兜底。
- 已统一抽屉关闭方法，接入 TDesign Drawer 的 `close` 事件和底部关闭按钮。
- 已在加载时清理旧列表，保持加载、空态、错误和重试状态正确切换。
- `node --test tests/printerCenter.test.js` 通过（6/6）。
- `npm run lint`、`npm run build` 和 `git diff --check` 通过。
- `npm test` 通过 164 项，保留 3 项与本任务无关的任务中心/UI 既有静态断言失败。

提交建议：`fix: 修复未分配设备抽屉数据与关闭交互`

## Kiro Task UI-001.37：优化看板区域切换状态与头部操作区

状态：已完成（专项验证通过；全量测试保留 3 项既有失败）
范围：
- `src/components/DashboardHeader.vue`
- `src/components/FarmDashboard.vue`
- `src/views/FullscreenDashboard.vue`
- `tests/dashboardOverview.test.js`
- `tests/fullscreenDashboardHeader.test.js`
- `.kiro/specs/farm-frontend/tasks.md`

目标：
- 删除头部重复的设备状态统计标签，保留下方看板中的状态统计数据。
- 将区域切换按钮移动到更新时间之后，并统一头部操作按钮尺寸、间距和 TDesign 语义颜色。
- 为暂无区域数据的区域提供“该区域暂未开发”空状态，不继续展示上一个区域的网格数据。
- 使用区域 ID 和可用状态管理切换，保留未来接入后端区域查询的扩展点。

完成记录：
- 已删除头部重复状态统计，区域按钮已移动到更新时间之后。
- 已统一刷新、区域切换、布局设置、取消编辑和退出全屏按钮的尺寸，并使用 TDesign 语义颜色。
- 切换到未开发区域时显示“该区域暂未开发”，切回一号车间时恢复设备网格。
- 专项 Node 测试 16/16、`npm run lint`、`npm run build`、`git diff --check` 通过。
- 全量 `npm test` 仍有 3 项既有任务中心/UI 规范静态断言失败，与本任务无关。

验收标准：
- 头部不再渲染截图中的设备状态统计区域。
- 区域按钮位于更新时间之后，刷新、布局设置、取消编辑、退出全屏按钮尺寸统一，颜色表达操作语义。
- 切换到未开发区域后隐藏旧网格并显示“该区域暂未开发”；切回已开发区域后恢复网格。
- 现有设备状态、实时连接、刷新、布局编辑和全屏退出逻辑不回归。
- 专项 Node 测试、`npm run lint`、`npm run build` 和 `git diff --check` 通过。

提交建议：`feat: 优化看板区域切换与头部操作区`

## Kiro Task UI-001.36：优化全屏看板品牌头部与区域切换

状态：已完成（专项验证通过；全量测试存在 3 项既有静态断言失败）
范围：
- `src/components/DashboardHeader.vue`
- `src/components/FarmDashboard.vue`
- `tests/fullscreenDashboardHeader.test.js`
- `.kiro/specs/farm-frontend/tasks.md`

目标：
- 使用公共资源 `public/icon.png` 作为全屏看板品牌图标。
- 将品牌标题调整为“嘉东__联动3D打印实时控制系统”。
- 将当前车间名称改为 TDesign 下拉按钮，支持切换预置区域并提供操作反馈。
- 保持现有状态统计、刷新、布局设置、全屏操作和实时数据逻辑不变。
- 确保标题较长或窗口缩小时品牌区、区域按钮和状态区仍可用，不出现头部横向溢出。

完成记录：
- 看板头部已使用 `/icon.png`，标题已调整为“嘉东__联动3D打印实时控制系统”。
- 车间名称已改为 TDesign 下拉按钮，支持预置区域切换、父级状态更新和成功提示；未伪造后端区域过滤。
- 已同步更新全屏看板端到端测试中的标题断言。
- 专项 Node 测试 18/18 通过，`npm run lint`、`npm run build`、`git diff --check` 通过。
- 全量 `npm test` 为 163/166 通过，失败项来自既有任务中心/UI 规范静态断言，不涉及本任务文件。

验收标准：
- 看板头部显示 `icon.png` 和指定中文标题。
- 点击区域按钮可打开区域选项，切换后按钮显示新区域并给出成功反馈；当前数据仍明确保持全局看板口径，未伪造后端区域过滤。
- 头部原有状态统计、刷新和操作插槽行为不回归。
- Node 静态契约测试、`npm run lint`、`npm run build` 和 `git diff --check` 通过。

提交建议：`feat: 优化全屏看板品牌头部与区域切换`

## Kiro Task UI-001.35：重构全屏看板顶部统计卡片

状态：已完成

范围：
- `src/components/FarmDashboard.vue`
- `tests/fullscreenDashboardCards.test.js`
- `.kiro/specs/farm-frontend/tasks.md`

目标：
- 移除全屏看板顶部的状态分布、活动任务和近 7 日任务趋势详情卡片。
- 复用打印机管理/总览页面的四张统计卡片结构，展示打印机总数、正在打印、空闲打印机和异常设备。
- 保持实时状态数据、卡片跳转、加载、错误、空数据和 WebSocket 处理逻辑一致。

验收标准：
- 全屏看板不再渲染 `DashboardDetailsPanel`，顶部使用四张统计卡片。
- 卡片使用实时 Store 状态，离线/未知设备纳入异常统计，状态卡片可跳转到对应打印机筛选。
- 桌面端四列、中等宽度两列、窄屏单列，卡片内容不溢出。
- 不再为已删除的详情区域发起历史任务请求，并有 Node 静态回归测试覆盖。

提交建议：`feat: 重构全屏看板统计卡片`

完成记录：全屏看板已移除状态分布、活动任务和近 7 日任务趋势详情卡片，改为复用总览页面视觉规范的四张统计卡片。卡片使用打印机 Store 的实时状态统计，支持打印机总数、在线数、正在打印、空闲和异常设备展示，并保留打印机管理及状态筛选跳转。已删除全屏看板不再需要的历史任务请求，保留设备刷新、加载、错误、空数据和 WebSocket 处理。

验证记录：`node --test tests/fullscreenDashboardCards.test.js tests/dashboardOverview.test.js` 15/15 通过；`npm run lint` 通过；`npm run build` 通过；`git diff --check` 通过。完整 `npm test` 为 160 通过、3 个既有任务中心/界面规范测试失败，与本 Task 文件无关；构建仍有既有动态/静态导入及大 chunk 警告。

## Kiro Task UI-001.34：修复看板过道方向与网格溢出

状态：已完成

范围：
- `src/components/grid/GridMap.vue`
- `src/components/grid/GridCell.vue`
- `tests/gridAisleUi.test.js`
- `.kiro/specs/farm-frontend/tasks.md`

目标：
- 根据视觉行列过道方向渲染横向、纵向及交叉过道标记。
- 去除过道、空位和设备根单元的固定最小高度，避免 CSS Grid 轨道溢出覆盖相邻内容。

验收标准：
- GridMap 向 GridCell 传递 `row`、`column` 或 `cross` 过道方向，交叉格同时显示两条标记。
- 横向过道使用 `repeating-linear-gradient(to right)`，纵向过道使用 `repeating-linear-gradient(to bottom)`，根单元服从 CSS Grid 轨道尺寸。
- Node 静态测试覆盖方向传递、方向样式和固定 `min-h` 移除，不引入 Vue 测试依赖。

提交建议：`fix: 修复看板过道方向与网格溢出`

完成记录：GridMap 已根据视觉行列向 GridCell 传递 `row`、`column` 或 `cross` 过道方向；GridCell 已将横向过道点线改为横向重复渐变、纵向过道保留纵向重复渐变，交叉过道同时呈现两种方向。过道、空位和设备根单元移除固定响应式最小高度，改为服从 CSS Grid 轨道并限制溢出，避免横向过道覆盖相邻行。新增 Node 静态测试覆盖方向传递、方向样式和根单元尺寸约束。

验证记录：`node --test tests/gridAisleUi.test.js tests/gridLayout.test.js` 10/10 通过；`npm run lint` 通过；`npm run build` 通过；`git diff --check` 通过。构建仍有既有的动态/静态导入及大 chunk 警告。

## Kiro Task UI-001.33：修复看板行列标签与内容对齐

状态：已完成

范围：
- `src/components/grid/GridMap.vue`
- `src/utils/gridLayout.js`
- `tests/gridLayout.test.js`

目标：
- 修复表头、行标签与设备网格在编辑态因额外内边距和 TDesign 菜单包装层产生的偏移。
- 让整体画布适配计算与实际网格盒模型保持一致。

验收标准：
- 列标题与设备卡片的左边界、宽度和列间距一致。
- 行名称与设备卡片的上边界、高度和行间距一致。
- 编辑态和普通态均不产生额外错位，新增过道后仍保持对齐。
- 对齐计算专项测试、`npm run lint`、`npm run build` 和 `git diff --check` 通过。

提交建议：`fix: 修复看板行列标签对齐`

完成记录：移除编辑态设备网格额外内边距，改用不影响布局尺寸的内描边；让 TDesign 右键菜单包装层完整占据对应网格轨道，并同步修正整体画布适配计算，保证表头、行标签、设备内容和过道对齐。专项 `tests/gridLayout.test.js` 7/7 通过，`npm run lint`、`npm run build`、`git diff --check` 通过。

## Kiro Task UI-001.32：看板网格整体适配与过道尺寸配置

状态：已完成

范围：
- `src/components/FarmDashboard.vue`
- `src/components/grid/GridMap.vue`
- `src/components/GridAisleSettingsDialog.vue`
- `src/utils/gridLayout.js`
- `tests/gridLayout.test.js`

目标：
- 修复增加行列后网格内容超出看板可视范围的问题，改为按完整画布尺寸统一缩放。
- 保留外层滚动作为超大布局的兜底，不产生网格内部重复横向滚动条。
- 在新增或编辑行列过道时提供 TDesign 尺寸设置，去除过道尺寸写死逻辑。
- 保持行列过道与设备物理坐标解耦，并完善配置规范化和测试。

验收标准：
- 看板容器变化时网格根据原始总宽高重新计算缩放比例，表头、行标签、设备卡片和过道始终对齐。
- 增加行列后优先完整适配当前区域；达到可读下限后仅由看板外层滚动，不出现内容被裁剪或嵌套横向滚动。
- 右键新增或已有过道时，可通过 TDesign 弹窗配置名称和列宽/行高，确认后才保存。
- 过道尺寸经过统一范围校验，行过道使用高度、列过道使用宽度；重复位置和越界位置有明确处理。
- 专项测试、`npm run lint`、`npm run build` 和 `git diff --check` 通过。

提交建议：`fix: 修复看板布局适配并支持过道尺寸配置`

完成记录：新增完整网格画布尺寸计算和统一缩放，纳入行列、过道、间距及编辑控制区，避免增加行列后被父容器裁剪；保留看板外层滚动作为超大布局兜底。新增 TDesign 过道设置弹窗，支持新增和编辑行/列过道名称及列宽/行高，并保留重复位置、越界设备和物理坐标保护。专项 `tests/gridLayout.test.js` 7/7 通过，`npm run lint`、`npm run build`、`git diff --check` 通过。

## Kiro Task UI-001.31：看板布局编辑与行列过道管理

状态：已完成

范围：
- `src/components/FarmDashboard.vue`
- `src/components/grid/GridMap.vue`
- `src/components/GridLayoutSettingsDialog.vue`
- `src/utils/gridLayout.js`
- `src/stores/printer/deviceStore.js`
- `src/stores/printer/gridStore.js`
- `src/stores/printer/index.js`
- `tests/gridLayout.test.js`

目标：
- 将布局设置与解锁布局合并为统一的管理员编辑入口。
- 在编辑态提供行列末端增减控制，保持设备物理坐标兼容。
- 根据看板容器尺寸自适应网格，同时只保留外层滚动区域。
- 支持通过行号、列号右键在指定行列后插入、修改和删除过道。
- 保证布局变更的确认提示、取消编辑、越界设备保护和本地持久化行为。

验收标准：
- 管理员点击“布局设置”即可进入编辑态，再次点击“完成布局”退出；非管理员不可操作。
- 行数、设备列数可以在网格末端增加或删除，最小值和最大值受到限制。
- 增加行列或过道后，行标签、列标题、设备卡片和过道保持对齐；窗口缩放时优先自适应，必要时仅由外层区域滚动。
- 右键行号或列号可弹出 TDesign 操作菜单，并通过确认对话框管理对应方向的过道。
- 行过道和列过道不改变设备的物理 `gridRow/gridCol`；缩小范围可能隐藏设备时必须明确提示。
- 相关单元测试、`npm run lint`、`npm run build` 和 `git diff --check` 通过。

提交建议：`feat: 支持看板布局编辑与行列过道管理`

完成记录：已将布局设置与解锁布局合并，新增行列末端增减控制、行列过道右键菜单、行列视觉/物理坐标映射和容器尺寸自适应；保留设备拖拽、绑定、实时状态和越界设备确认逻辑。专项 `tests/gridLayout.test.js` 6/6 通过，`npm run lint`、`npm run build`、`git diff --check` 通过。完整 `npm test` 的 3 个失败来自既有任务中心和总览页面契约测试，不涉及本 Task 修改文件。

## Kiro Task UI-001.30：支持全屏看板自定义行列与过道布局

状态：已完成
范围：
- `src/utils/gridLayout.js`
- `src/stores/printer/deviceStore.js`
- `src/stores/printer/gridStore.js`
- `src/stores/printer/index.js`
- `src/components/grid/GridMap.vue`
- `src/components/GridLayoutSettingsDialog.vue`
- `src/components/FarmDashboard.vue`
- `src/utils/formatters.js`
- `tests/dashboardOverview.test.js`
- `tests/gridLayout.test.js`

目标：
- 支持管理员自定义全屏看板的行数、实际设备列数和多个过道。
- 使用动态矩阵和动态 CSS Grid 渲染，移除网格视图中的固定行列与固定过道依赖。
- 保持已有 `gridRow/gridCol` 物理坐标兼容，布局配置先保存在当前客户端。
- 在布局调整时提示超出新范围的设备，避免设备位置无提示地消失。

验收标准：
- 默认布局仍为 4 行、12 个设备列、设备第 7 列后设置一个“过道”。
- 管理员可通过 TDesign 设置面板修改行数、列数、过道位置和名称，并恢复默认配置。
- 多个过道、空槽位、设备拖拽、绑定、解绑、状态展示和实时数据映射正常。
- 调整布局不会改变已有设备的后端物理坐标；越界设备会在应用前被明确提示。
- 相关测试、lint、build 和 `git diff --check` 通过。

提交建议：`feat: 支持看板自定义网格布局`

完成记录：新增网格布局配置工具和管理员设置弹窗，支持自定义行数、设备列数、多个过道的位置/名称/宽度；网格矩阵、物理列映射和拖拽目标均改为动态计算，布局配置保存于当前客户端，并对超出新范围的设备进行确认提示。

验证说明：网格与看板专项测试 16/16 通过；`npm run lint` 通过；`npm run build` 通过；`git diff --check` 通过。构建仅保留项目原有的分包体积提示。

## Kiro Task UI-001.29：让总览页面填充可用内容区域

状态：已完成
范围：
- `src/views/Dashboard.vue`
- `tests/dashboardOverview.test.js`

目标：
- 让总览页面根容器参与父级 Flex 高度分配，填满当前内容区域。
- 保持卡片、空态和错误态的现有高度策略，避免通过固定高度制造额外留白。

验收标准：
- 总览页面根节点具有完整宽度并可填充父级剩余高度。
- 设备状态错误态、暂无设备态和正常状态分布不改变数据与交互逻辑。
- 相关测试、lint、build 和 `git diff --check` 通过。

提交建议：`fix: 让总览页面填充可用区域`

完成记录：总览根容器已加入 Flex 高度分配、完整宽度和最小高度，使内容较少时也能填充父级可用区域，同时保留设备状态卡片的紧凑空态布局。

验证说明：看板专项测试 12/12 通过；`npm run lint` 通过；`npm run build` 通过；`git diff --check` 通过。

## Kiro Task UI-001.28：优化总览设备状态卡片空态与错误态

状态：已完成
范围：
- `src/views/Dashboard.vue`
- `tests/dashboardOverview.test.js`

目标：
- 将设备状态接口失败、暂无设备和正常状态分布区分展示。
- 使用 TDesign Alert、Empty 和现有刷新 Loading 反馈，避免错误信息被大面积空白弱化。
- 缩短设备状态卡片空态高度，避免与趋势卡片强制等高。

验收标准：
- 设备接口失败时显示明确的错误提示和“重新加载”操作。
- 设备接口成功但没有设备时显示“暂无设备数据”，不显示误导性的正常状态文案。
- 正常设备数据、REST/WebSocket 状态合并、刷新和既有跳转逻辑不变。
- 相关测试、lint、build 和 `git diff --check` 通过。

提交建议：`fix: 优化总览设备状态空态`

完成记录：设备状态卡片已区分设备接口错误与暂无设备空态，错误态提供 TDesign 重新加载操作；通过网格顶部对齐和紧凑状态占位，避免空状态被趋势卡片高度拉伸。

验证说明：看板专项测试 11/11 通过；`npm run lint` 通过；`npm run build` 通过；`git diff --check` 通过。

## Kiro Task UI-001.27：以美化方案重构总览界面

状态：已完成

范围：
- `src/views/Dashboard.vue`
- `src/components/FarmDashboard.vue`
- `tests/dashboardOverview.test.js`

目标：
- 以 `/前端美化` 分支的总览卡片、趋势图、状态分布、最近任务和设备提醒布局为主。
- 将 Electron 分支的真实 REST、Store、WebSocket、加载错误、空数据和跳转逻辑接回美化界面。
- 保留车间看板的设备控制、布局编辑和滚动能力，并统一使用项目 TDesign 主题变量。

验收标准：
- 总览界面以美化分支的视觉结构为主，不因接入真实数据而退回旧版布局。
- 统计、趋势、最近任务和异常设备均使用现有真实数据链路，刷新和页面跳转行为正常。
- 加载中、部分失败、全部失败、空数据、WebSocket 断开和移动端布局均有可见处理。
- 专项测试、`npm run lint`、`npm run build` 和 `git diff --check` 全部通过。

提交建议：refactor: 以美化方案重构总览界面

完成记录：以 `/前端美化` 的四张统计卡、趋势图、环形状态分布、最近任务和设备提醒布局重构总览展示层；保留 Electron 的真实 REST/Store/WebSocket 数据链路、失败统计、刷新、错误和空数据处理，并将车间看板硬编码颜色统一为项目 TDesign 主题变量。

验证说明：看板专项测试 10/10 通过；相关 `npm test` 已启动但现有 `batchDispatch` 测试进程未在终端超时窗口内退出；`npm run lint` 通过；`npm run build` 通过；`git diff --check` 通过。构建仅保留项目原有动态导入和大 chunk 提示。

## Kiro Task UI-001.26：整合个人中心账户信息

状态：已完成

范围：
- `src/views/Profile.vue`
- `tests/userProfileAuditPage.test.js`

目标：
- 将用户 ID 与账户角色合并到个人中心账户摘要的同一组元信息中。
- 删除重复的账户角色展示和下方独立描述区，减少视觉割裂。
- 保留当前账户、登录状态、个人资料编辑和账户安全功能不变。

验收标准：
- 用户名下方同一行展示角色标签和用户 ID。
- 账户卡片不再重复展示账户角色，也不再保留下方独立描述区。
- 响应式窄屏下元信息可以自然换行，不溢出卡片。
- 专项测试、`npm run lint`、`npm run build` 和 `git diff --check` 全部通过。

提交建议：refactor: 整合个人中心账户信息

完成记录：将角色标签与用户 ID 合并到用户名下方的账户元信息行，移除重复的账户角色和独立描述区，保持登录状态、个人资料编辑和账户安全功能不变。

验证说明：个人中心专项测试 4/4 通过；`npm run lint` 通过；`npm run build` 通过；`git diff --check` 通过。构建仅保留项目原有动态导入和大 chunk 提示。

## Kiro Task UI-001.25：收紧近七日趋势柱状图

状态：已完成

范围：
- `src/components/DashboardDetailsPanel.vue`
- `tests/dashboardOverview.test.js`

目标：
- 缩短近七日任务趋势图的柱状图轨道高度，减少视觉占用。
- 保留趋势数据、柱高比例、数量和日期标签的显示逻辑不变。

验收标准：
- 趋势柱状图轨道高度由 58px 收紧为 46px，图表保持完整显示。
- 数量、柱状图和日期标签仍按底部对齐，不出现溢出或遮挡。
- 专项测试、`npm run lint`、`npm run build` 和 `git diff --check` 全部通过。

提交建议：fix: 收紧趋势柱状图高度

完成记录：将近七日趋势柱状图轨道高度由 58px 调整为 46px，减少图表视觉占用，同时保留数量、日期和柱高比例逻辑不变。

验证说明：看板专项测试 10/10 通过；`npm run lint` 通过；`npm run build` 通过；`git diff --check` 通过。构建仅保留项目原有动态导入和大 chunk 提示。

## Kiro Task UI-001.24：突出看板退出按钮

状态：已完成

范围：

- `src/views/FullscreenDashboard.vue`
- `tests/dashboardOverview.test.js`

目标：

- 将全屏看板右上角的“退出全屏”从低强调文字按钮调整为醒目的 TDesign 主按钮。
- 保留退出全屏、路由返回和 Electron/浏览器全屏清理逻辑不变。

验收标准：

- “退出全屏”使用 TDesign `primary` 填充按钮，视觉上与“刷新”按钮形成清晰层级。
- 点击行为、键盘 Escape 和全屏状态监听不发生变化。
- 专项测试、`npm run lint`、`npm run build` 和 `git diff --check` 全部通过。

提交建议：fix: 突出看板退出按钮

完成记录：将全屏看板的“退出全屏”从低强调文字按钮调整为 TDesign primary 填充按钮，突出退出操作但未改变路由返回、全屏清理、Escape 和状态监听逻辑。

验证说明：看板专项测试 11/11 通过；`npm run lint` 通过；`npm run build` 通过；`git diff --check` 通过。构建仅保留项目原有动态导入和大 chunk 提示。

## Kiro Task UI-001.23：近 7 日趋势时间范围适配

状态：已完成

范围：

- `src/components/DashboardDetailsPanel.vue`
- `tests/dashboardOverview.test.js`

目标：

- 缩小近 7 日趋势卡片时间范围文字的字号和行高。
- 保持日期范围单行显示，避免标题区溢出或挤压趋势图。
- 保留 TDesign Card 结构和趋势数据逻辑不变。

验收标准：

- `09-01 ~ 09-07` 在卡片标题区完整显示且不换行。
- 时间范围文字不会覆盖标题、副标题或超出卡片边界。
- 专项测试、`npm run lint`、`npm run build` 和 `git diff --check` 全部通过。

提交建议：fix: 优化趋势卡片时间范围显示

完成记录：将近 7 日趋势卡片的时间范围改为 11px 字号和 16px 行高，限制最大宽度并保持单行省略，避免日期文字溢出或挤压标题区。

验证说明：看板专项测试 10/10 通过；`npm run lint` 通过；`npm run build` 通过；`git diff --check` 通过。构建仅保留项目原有动态导入和大 chunk 提示。

## Kiro Task UI-001.22：告警条重连按钮右对齐

状态：已完成

范围：

- `src/components/FarmDashboard.vue`
- `tests/dashboardOverview.test.js`

目标：

- 将实时连接告警文字和“重新连接”按钮放在同一行。
- 按钮固定靠告警条最右侧，文字区域支持溢出省略。
- 保留 TDesign Alert 的告警语义、重连 Loading 和现有告警处理逻辑。

验收标准：

- 不再使用 TDesign Alert 的标题行承载实时告警文字，避免 operation 插槽自动换到下一行。
- 实时告警文字位于左侧，重连按钮位于最右侧，窄屏下文字不挤压按钮。
- 专项测试、`npm run lint`、`npm run build` 和 `git diff --check` 全部通过。

提交建议：fix: 调整看板重连按钮位置

完成记录：实时连接告警改为使用 TDesign Alert 默认消息插槽承载文字，并将重连操作保持在同一消息行的最右侧；文字区域支持省略，按钮继续保留 Loading 和重连行为。

验证说明：看板专项测试 9/9 通过；`npm run lint` 通过；`npm run build` 通过；`git diff --check` 通过。构建仅保留项目原有动态导入和大 chunk 提示。

## Kiro Task UI-001.21：全屏看板快照兜底与信息卡片完整展示

状态：已完成

范围：

- `src/stores/printer/gridStore.js`
- `src/stores/printer/deviceStore.js`
- `src/components/DashboardDetailsPanel.vue`
- `tests/dashboardOverview.test.js`

目标：

- WebSocket 断开时，顶部统计和状态分布继续使用 REST 设备快照，不显示错误的全 0。
- REST 设备总数不因缺少网格坐标而被过滤，设备矩阵仍只渲染有效坐标设备。
- 解除 TDesign Card 固定高度裁剪，确保状态内容、活动任务和近 7 日趋势完整展示。
- 保持 TDesign 组件、现有加载/空数据/错误/重试逻辑和设备矩阵交互不变。

验收标准：

- REST 快照包含 49 台设备且 WebSocket 断开时，统计仍能按设备状态计算，不依赖空的实时状态 Map。
- 离线、待机、打印中、暂停和故障等状态统一映射到看板状态枚举。
- 无效网格坐标设备计入统计，但不会污染 `deviceMatrix`。
- 三张卡片不再使用固定高度裁剪，TDesign Header/Body 正常伸展，活动任务和趋势图不被截断。
- 专项测试、`npm run lint`、`npm run build` 和 `git diff --check` 全部通过。

提交建议：feat: 完善看板快照兜底与卡片展示

完成记录：状态统计改为 REST 设备全集与 WebSocket 实时覆盖的合并结果，断线时保留快照；设备列表保留无网格坐标记录，矩阵仅渲染有效坐标；三张 TDesign 信息卡片改为可伸展高度，修复状态内容、活动任务和近 7 日趋势被裁剪的问题。

验证说明：看板专项测试 8/8 通过；`npm run lint` 通过；`npm run build` 通过；`git diff --check` 通过。构建仅保留项目原有动态导入和大 chunk 提示。

状态说明：`[x]` 已完成；`[ ]` 待完成或等待后端接口契约。

## Kiro 三阶段推进情况

- 需求：已根据 `API_HANDOFF.md` 和 `FRONTEND_TODO.md` 固化角色、状态、接口边界和错误处理规则。
- 设计：已建立 View -> Store -> API -> request/mock 分层，完成打印机实时状态和安全打印流程设计。
- 任务：已按阶段完成 P0、P1，并完成当前 P2 前端可独立实施内容；各阶段均已验证并使用中文提交本地分支。

## P0：接口契约与基础能力

- [x] P0.1 环境变量、请求封装、Bearer Token、统一响应和错误处理。
- [x] P0.2 分页、Long 类型 ID、时间、文件大小和进度适配器。
- [x] P0.3 API 模块统一、预签名下载和规划接口隔离。

## P1.1：登录与权限

- [x] 登录、退出、记住我、账号禁用和服务异常提示。
- [x] `requiresAuth` 和 `roles` 路由守卫。
- [x] ADMIN/OPERATOR 菜单和操作权限控制。
- [x] ADMIN 用户分页、新增、启用和禁用。
- [x] ADMIN 打印机配置权限和 OPERATOR 业务操作权限。
- [x] 后端密码规则：6-20 位，必须包含大写字母、小写字母和数字。
- [x] 个人资料查看、邮箱/手机号更新和密码修改。

## P1.2：打印机看板与管理

- [x] 打印机分页、静态看板信息和实时状态展示。
- [x] ADMIN 新增、编辑、删除、局域网扫描、批量添加和网格位置维护。
- [x] 展示扫描和批量添加时每台设备的成功或失败原因。
- [x] 按状态限制暂停、取消、急停和安全启动，并提供确认及加载状态。
- [ ] 打印机详情、状态历史和统计；等待后端规划接口。

## P1.3：文件库

- [x] 文件分页、名称搜索、`materialType` 筛选和当前目录查询。
- [x] G-code/BGCODE 上传、进度展示、100MB 限制、扩展名校验和存储错误处理。
- [x] 当前目录 `parentId` 上传、文件夹创建、目录进入和面包屑返回。
- [x] 单个/批量删除确认，并处理无权限、资源不存在和存在关联任务等情况。
- [x] 文件详情：切片参数、耗材、喷嘴、温度、预估时间、打印次数和成功率。
- [x] 预签名 URL 下载，并处理 URL 过期、文件不存在和 CORS 失败。
- [x] 文件目录和安全预览；文件关联任务仍待页面需求确定。

## P1.4：任务队列与安全打印

- [x] 任务队列/历史 API、优先级和创建时间排序，以及状态/打印机/时间筛选。
- [x] 创建任务时可选打印机；未指定打印机时任务保持 `QUEUED`。
- [x] 仅使用冻结的 8 个状态：`QUEUED`、`ASSIGNED`、`READY`、`PRINTING`、`PAUSED`、`COMPLETED`、`FAILED`、`CANCELLED`。
- [x] 安全派单：`QUEUED -> ASSIGNED`。
- [x] 现场确认和启动：`ASSIGNED -> READY/PRINTING`。
- [x] 按状态限制取消、暂停、急停，并提供任务详情抽屉。
- [x] 重试、重新排队和优先级调整；设备恢复和取消控制。

## P1.5：WebSocket 实时状态与 Mock

- [x] 使用 `/ws/farm-status`，携带当前 Token 并采用指数退避重连。
- [x] 处理 `SNAPSHOT`、`PRINTER_STATUS`、`PRINTER_OFFLINE` 和 `JOB_STATUS` 消息。
- [x] 在组件卸载、退出登录和切换看板时销毁连接及定时器。
- [x] 连接断开时显示“数据可能不是最新”，并避免重复连接。
- [x] Mock 打印机快照、设备状态、离线和任务状态事件流。
- [x] Mock 响应包装、错误码场景、状态重置和开发账号文档。

## P2：体验、测试与生产加固

### P2.1：交互体验

- [ ] 完善加载、空数据、无权限、网络错误、服务维护和离线状态页面。
- [x] 文件上传支持取消、失败重试和重复文件名提示。
- [x] 任务状态变化提供明确操作反馈。
- [x] 刷新后保留打印机、文件和任务详情上下文。
- [x] 支持局域网大屏和窄屏显示。

### P2.2：验证与验收

- [x] 增加分页和数据适配器单元测试（`npm test`，3 项）。
- [~] WebSocket 消息解析、异常重连、主动销毁、离线/失败告警和后端 `SNAPSHOT.data.printers` 解析测试已补充；请求层、路由权限和任务按钮测试仍待补齐。
- [ ] 完成端到端验收：登录 -> 上传文件 -> 创建任务 -> 派单 -> 安全确认 -> 启动 -> 暂停/恢复 -> 完成/失败。
- [x] 当前阶段通过 `npm run lint`。
- [x] 当前阶段通过 `npm run build`。
- [x] 当前阶段通过 `git diff --check`。

### P2.3：生产环境

- [x] 使用独立生产环境变量；禁止提交 `.env`、Token、密码和真实设备凭据。
- [~] 已使用真实运行的 dev 后端完成 JWT 登录、REST 查询和 `/ws/farm-status` 握手/`SNAPSHOT` 请求级联调；CORS、预签名 URL 在实际前端部署地址下的浏览器验证，以及完整端到端流程仍待完成。
- [x] 前端统一处理 API、WebSocket、对象存储和设备网络异常。
- [x] 确认生产构建拒绝 Mock 数据和匿名 WebSocket 连接。

## P2 当前实现说明

- 文件上传已支持 `AbortController` 取消、失败重试、进度反馈和当前目录同名校验。
- Node.js 内置测试已覆盖分页规范化、Long 类型 ID 转换、进度限制和文件大小格式化。
- 生产模式下 `VITE_USE_MOCK=true` 会使 Vite 构建快速失败；没有 Bearer Token 时会跳过实时连接。
- CORS 和对象存储预签名 URL 仍需在实际前端部署地址下做浏览器验证；WebSocket 握手鉴权已通过真实后端请求级验证，完整浏览器端联调仍待完成。

## 当前阻塞项与边界

- 打印机详情/历史/统计、文件目录树/关联任务，以及任务重试/重新排队/优先级接口仍在前端待接入；文件安全预览和缩略图接口已接入。
- 个人资料和修改密码已接入真实后端接口；任务重试、重新排队、优先级和设备恢复/取消已接入；核心登录、用户、打印机分页、文件分页、任务队列和 WebSocket 已完成真实后端请求级联调，设备控制和完整打印链路仍待现场验收。
