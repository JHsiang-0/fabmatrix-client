# Ardot + TDesign 前端原型设计

版本：1.0.0 准正式版
对应需求：`.kiro/specs/farm-ardot-tdesign-prototype/requirements.md`

## 设计原则

1. 以当前 Vue 前端的信息架构为基线，以 Ardot 中 `TDesign for web` 为组件来源。
2. 先建立页面结构和布局边界，再放置真实组件，最后补充状态和交互注释。
3. 统一使用 TDesign 的默认间距、颜色、边框、圆角、阴影和状态；如果需要偏离，必须在页面注释中说明原因。
4. 页面优先保证桌面端的可读性、密度和操作效率，避免以移动端卡片堆叠方式处理生产管理页面。

## 原型页面结构

```text
FabMatrix 原型文件
├─ 00 基础应用壳
├─ 01 打印机管理
├─ 02 文件库
├─ 03 任务队列与历史
├─ 04 全屏看板
├─ 05 抽屉/弹窗/异常状态
└─ 99 组件映射与交付说明
```

现有手动画稿可以保留为 `legacy-manual-backup` 页面，但不得作为新原型的唯一交付页面。

## 组件映射

| 业务区域 | TDesign 组件 | 现有代码落点 |
| --- | --- | --- |
| 页面工具栏 | Button、Input、Select、Tag、Space/布局 | `PageHeader.vue`、`QueryToolbar.vue` |
| 打印机状态 | Tag、Badge、Switch、Progress | `StatusTag.vue`、`PrinterManage.vue` |
| 文件夹树 | Tree、Input、Button | `FileFolderTree.vue`、`FileLibrary.vue` |
| 文件信息 | Card、Table、Tag、Pagination | `FileLibrary.vue`、`FileDetailDrawer.vue` |
| 任务列表 | Table、Tag、Progress、Dropdown、Drawer | `JobQueue.vue`、`JobHistory.vue`、`TaskDetailDrawer.vue` |
| 设备扫描 | Drawer、Input、Tag、Checkbox、List/Card、Button | `UnallocatedPrinterDrawer.vue` |
| 打印机详情 | Drawer、Descriptions、Card、Progress、Timeline、Button | `DeviceDetailDrawer.vue` |
| 看板布局 | Card、Statistic、Grid/自定义布局容器、Dialog、Tree/List | `FarmDashboard.vue`、`GridMap.vue`、`BindDeviceDialog.vue` |
| 应用壳 | Layout、Menu、Avatar、Dropdown、Tooltip | `layout/index.vue`、`AppHeader.vue`、`AppSidebar.vue` |

如果 TDesign for web 没有覆盖业务专用容器，容器可以使用 Ardot 基础 Frame，但容器内部的交互控件必须优先使用真实 TDesign 实例。

## 页面布局约束

### 应用壳

- 顶部保留应用标题、实时连接状态、设备看板入口、消息/帮助/设置、用户菜单。
- 左侧导航使用固定宽度，展开态和折叠态各提供一个画板状态。
- 主内容区使用统一页面内边距；页面标题和工具栏对齐到同一内容起始线。

### 打印机管理

- 顶部操作区只显示当前可用动作；批量动作在选中设备后出现。
- 状态筛选与搜索位于同一工具栏，搜索支持回车提交。
- 表格首列选择框和末列操作固定；中间字段允许在窄窗口滚动。
- 不展示没有业务价值的数据库主键 ID；以设备名、机器编号、IP、协议和可读状态为主。

### 文件库

- 左侧文件树与右侧文件内容区保持明确的纵向分割线。
- 文件卡片使用浅边框和 TDesign 默认 hover 反馈，避免自定义厚重阴影。
- 文件名、打印次数和成功率在卡片内有固定信息层级，长文案使用省略号。
- 详情抽屉提供缩略图失败占位和可读的元数据分组。

### 任务中心

- 文件、设备和人员字段使用快照名称，ID 只作为辅助信息或详情内的次要信息。
- `QUEUED`、`ASSIGNED`、`READY`、`PRINTING`、`PAUSED`、`COMPLETED`、`FAILED`、`CANCELLED`、`RECONCILING` 使用统一状态色和文案。
- 任务详情抽屉按资源、执行、时间线和操作分组；核对中任务必须展示人工核对入口。

### 全屏看板

- 标题与应用统一，不保留硬编码的“3F1号车间”等无业务来源文本。
- 顶部统计卡片、网格区域、过道和绑定弹窗分层展示。
- 动态行列和过道编辑使用明确的设置入口，编辑态、预览态和保存后态分别标注。

## 状态设计

每个主要页面至少制作一张“正常态”和一张“异常/空态”画板；涉及异步操作的页面补充 Loading 状态。所有状态画板使用同一组件实例，只改变状态属性或内容，避免复制出多套视觉样式。

## Ardot 操作规范

1. 先在组件面板搜索并拖入 TDesign for web 组件，再在属性面板设置文案、主题、尺寸和状态。
2. 每放置一个组件后立即命名并记录组件类型，避免后续无法判断真实实例与手动画框。
3. 页面结构、组件属性和交互说明分层命名；不把说明文字混入业务 UI。
4. 每完成一个页面，都在 100% 视图和目标桌面尺寸下检查溢出、遮挡、对齐和空白。
5. 不使用无法回溯来源的自制圆角卡片、阴影或按钮样式。

## 交接格式

交付时在 `99 组件映射与交付说明` 页面记录：页面名称、对应路由、关键组件、状态画板、待编码组件和已知限制，并附上原型文件链接和尺寸检查截图。
