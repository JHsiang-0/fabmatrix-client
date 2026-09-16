# Ardot 原型交付与编码交接

版本：1.0.0 准正式版  
规格：`farm-ardot-tdesign-prototype`  
Ardot 文件：[FabMatrix TDesign 原型](https://ardot.tencent.com/file/726447477749198?node_id=5%3A9268)

## 当前画板

| 画板 | 对应路由/范围 | 原型内容 |
| --- | --- | --- |
| `00 应用壳与导航` | 全局 Layout、Header、Sidebar | 应用标题、导航区域、主内容区、连接状态、设备看板入口 |
| `01 打印机管理` | `/printers` | 状态筛选、搜索、表格区域、操作按钮、Tag、Switch、详情承载区 |
| `02 文件库` | `/files` | Tree、Input、Upload、Card、Drawer，覆盖文件树、搜索、上传、详情抽屉 |
| `03 任务中心：队列与历史` | `/tasks/queue`、`/tasks/history` | Tabs、表格承载区、状态 Tag、详情 Drawer |
| `04 全屏看板` | `/dashboard/fullscreen` | 深色全屏背景、统计 Card、状态 Tag、绑定/详情 Drawer |
| `05 抽屉、弹窗与状态` | 通用反馈和详情交互 | Drawer、Input、Tag、Button、Card 的状态组合 |
| `TDesign 真实组件版` | 组件核对页 | TDesign for web 实例与组件属性映射，保留用于编码前核对 |

原有 `Page 1` 及早期手动画板未删除，作为历史视觉备份。

## 已核对的真实组件

已在 Ardot 组件库 `TDesign for web` 中插入并通过属性面板核对的实例包括：

- Button、Input、Card、Tabs、Tree、Upload、Drawer、Switch、Tag。
- Table 当前使用的是组件库提供的 `table`/表格子组件实例；完整业务表格仍需在 Vue 中按 TDesign Table API 组合列、固定列和滚动容器。

Select、Dialog、Progress、Pagination 以及更完整的 Table 行/列子组件尚未在本轮逐项完成属性核对，编码时不得将当前占位实例误认为业务完成。

## 设计交接规则

- 使用 TDesign Vue Next 官方组件，沿用项目现有 `src/utils/tdesign.js`、`message.js` 和统一请求/状态适配。
- 页面采用桌面端信息架构：页面标题 → 工具栏/筛选 → 主内容区 → 抽屉或反馈层；不要把组件库样例直接当成业务布局。
- 业务字段优先显示文件名、打印机名称、机器编号、用户名、状态和时间；数据库 ID 只作为辅助信息或详情字段。
- 状态必须同时提供正常、加载、空、错误、离线/不可用和操作冲突反馈；关键操作保留确认路径。
- 文件库保留 Tree + 内容区 + 详情 Drawer；任务中心保留队列/历史分层；看板保留网格编辑、动态行列/过道和设备绑定反馈。
- 组件间距、边框、圆角、颜色和状态命名以 TDesign 默认 token 为准，不在页面内重新创造卡片、按钮和弹窗视觉体系。

## 已完成与待评审

已完成：页面分组、应用壳骨架、核心业务页面骨架、TDesign 实例放置、组件来源核对、页面—路由—组件交接记录，以及 1440×900 画布检查。

待完成：800×560 响应式检查、长文本/多设备结果压力检查、所有异常态逐项截图、产品评审和评审后的 Vue 编码拆分。本原型任务不代表 Vue 代码已经修改，也不代表业务功能已完成。
