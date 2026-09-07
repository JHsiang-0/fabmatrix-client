# 前端 Kiro 任务清单

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
