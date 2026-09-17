# SYNC-001.10 文件网格卡片视觉验收

**Source visual truth**

- 用户在 2026-09-11 当前对话中提供的文件库截图（内嵌截图，未写入仓库）。
- 原始截图约 1919 × 1029 px，桌面端、浅色主题、文件库网格视图。

**Implementation evidence**

- 本地 Mock：`/files`，提交 `f26e36d39f9b81a04e405fdde134b33e43f78d82`。
- Chrome 浏览器会话截图：当前验收会话 `1772011049`（截图未写入仓库）。
- 实现截图约 1920 × 913 px，CSS viewport 为桌面端 1× 密度；按文件卡片区域进行聚焦比较，忽略来源与 Mock 数据量差异。
- 状态：ADMIN 登录、文件库、网格视图、两张 Mock 文件卡片。

**Full-view comparison evidence**

- 文件树、工具栏、结果区域与分页保持原有信息架构，没有因修复改变页面比例或业务入口。
- 网格卡片改为按内容计算行高，页面中两张卡片底部统计及“打印/删除”操作完整可见。

**Focused region comparison evidence**

- 两张 `.file-card` 的 `clientHeight` 与 `scrollHeight` 均为 `252px`，不存在内部溢出或裁切。
- 卡片运行时类名包含 `t-card--bordered t-card--shadow-hover`；静止状态 `box-shadow: none`，悬停阴影由 TDesign `.t-card--shadow-hover:hover { box-shadow: var(--td-shadow-1); }` 提供。
- `.file-card` 不再定义自有 `box-shadow` 或阴影 `transition`；卡片操作区支持窄宽度换行。

**Required fidelity surfaces**

- 字体与排版：沿用现有 TDesign 字体层级，文件名、指标和按钮未改变字号或字重，长文本省略规则保留。
- 间距与布局：卡片改为自动高度，网格使用 `max-content` 行高和顶部对齐；卡片间距、圆角、边框及区域留白保持现状。
- 颜色与设计变量：浅边框继续使用项目语义边框变量；阴影恢复为 TDesign `--td-shadow-1`。
- 图片质量：缩略图和无图占位逻辑未修改，未新增或替换图片资产。
- 文案与内容：文件名、指标、统计和操作文案未修改。

**Findings**

- 无 P0/P1/P2 问题。
- P3：Mock 页面仅有两张卡片，真实 30 项数据的多页密度由 CSS 回归断言和滚动容器约束覆盖，仍建议在真实数据环境进行一次人工悬停抽查。

**Comparison history**

- 初始问题：卡片被网格拉伸与 `height: 100%` 循环约束压缩，`overflow: hidden` 裁切内容和阴影。
- 修复：使用内容行高、自动卡片高度、移除卡片裁切和自定义阴影过渡，并允许操作区换行。
- 修复后证据：卡片 `clientHeight === scrollHeight`，按钮完整可见，运行时使用 TDesign `t-card--shadow-hover`。

**Primary interactions and console**

- 已测试从列表视图切换到网格视图，卡片和操作按钮正常渲染。
- 页面控制台未观察到本次修复相关错误。

**Implementation checklist**

- [x] 卡片内容完整显示。
- [x] 保留浅边框。
- [x] 使用 TDesign 默认 hover-shadow。
- [x] 不修改文件库业务行为。
- [x] 文件库测试、全量测试、lint 和 build 通过。

final result: passed

---

# 任务队列表格视觉验收

**Source visual truth**

- 用户在 2026-09-17 当前对话中提供的生产调度队列截图（内嵌截图，未写入仓库）。
- 原始截图约 1667 × 927 px；目标以用户确认的“打印机管理页同款单卡片、紧凑双行表格、填充操作按钮和底部汇总”方案为准。

**Implementation evidence**

- 本地 Mock：`/tasks/queue`。
- Chrome 浏览器会话截图：当前验收会话 `1772011580`（截图未写入仓库）。
- CSS viewport：1920 × 855 px，`devicePixelRatio = 1`，浅色主题。
- 状态：ADMIN 登录；分别检查待派发任务和活动任务。

**Full-view comparison evidence**

- Tabs、表格和 Footer 已收敛到一个 TDesign Card，移除了原截图中的多层嵌套边框。
- 表格在宽屏下完整铺满卡片；调整前内部表格为 1326px、容器为 1638px，修复后两者均为 1638px。
- 任务 ID 已合并到任务信息第二行，主列保持文件、设备和人员可读信息优先。

**Focused region comparison evidence**

- 待派发任务操作区为“详情 / 分配设备 / 更多”单行填充按钮；排队状态使用稳定时钟语义。
- 活动任务操作区根据状态展示“暂停打印”或“恢复打印”，按钮位置和尺寸稳定。
- 已验证 Tabs 切换和“更多”下拉菜单；菜单正常显示“取消任务”。

**Required fidelity surfaces**

- 字体与排版：沿用项目 TDesign 字体和 14px/12px 双行信息层级，表头为次级色中等字重。
- 间距与布局：表头 48px、数据行 58px；信息列自动扩展，操作列固定右侧；Footer 与打印机管理页一致。
- 颜色与设计变量：全部使用现有品牌色、语义状态色和项目表面/边框变量，无新视觉体系。
- 图片质量：本界面没有新增图片资产，图标均来自 `tdesign-icons-vue-next`。
- 文案与内容：保留任务业务字段；“分配机器”调整为更统一的“分配设备”，技术 ID 降级为次要信息。

**Findings**

- 无 P0/P1/P2 问题。
- P3：真实生产数据中的极长文件名和十条以上活动任务仍建议在安装版中做一次人工滚动抽查。

**Comparison history**

- 第一轮发现：固定列宽总和小于宽屏工作区，操作列右侧存在约 312px 无意义空白。
- 修复：主要信息列改为最小宽度，并为内部表格增加 `min-width: 100%`。
- 修复后证据：内部表格宽度由 1326px 增至 1638px，与容器宽度一致，窄屏仍由 `max-content` 和滚动容器兜底。

**Primary interactions and console**

- 已测试登录、待派发/活动 Tabs 切换和“更多”下拉菜单。
- 控制台只有测试期间直接重新导航触发的一次预期未登录错误；重新登录后的页面操作未出现本次修改相关运行时错误。

**Implementation checklist**

- [x] 单卡片工作区与统一 Tabs。
- [x] 任务 ID 合并到任务信息。
- [x] 双行信息密度和统一对齐。
- [x] TDesign 填充操作按钮。
- [x] Footer 汇总及活动任务分页。
- [x] 宽屏铺满与窄屏滚动约束。

final result: passed
