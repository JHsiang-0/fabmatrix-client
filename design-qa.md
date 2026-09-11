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
