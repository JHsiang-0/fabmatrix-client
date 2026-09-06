# UI-004 文件库工作台运行基线与契约冻结

执行日期：2026-09-06
任务：UI-004 文件库工作台信息架构重写
基线提交：`af8418a`（`feat/ui-003-electron`）
本阶段性质：只读基线记录，不修改业务代码

## 1. 基线范围

已核对以下内容：

- `AGENTS.md`
- `.kiro/specs/farm-ui-remediation/requirements.md`
- `.kiro/specs/farm-ui-remediation/design.md`
- `.kiro/specs/farm-ui-remediation/tasks.md`
- `API_HANDOFF.md` 的文件接口、字段安全边界和错误语义
- `src/views/FileLibrary.vue`
- `src/api/printFile.js`
- `src/utils/dataAdapters.js`
- `src/components/TdTable.vue`、`src/components/TdTableColumn.vue`
- `src/components/file/*`
- `tests/fileLibrary.test.js`
- `vite.config.js`、`electron/main.cjs`、`playwright.config.js` 及相关 Electron 测试

## 2. 运行实例与 Bundle

| 项目 | 实际结果 | 基线结论 |
| --- | --- | --- |
| 后端 `http://127.0.0.1:8080/actuator/health` | HTTP 200，`status=UP` | 可用于契约检查 |
| 后端 `http://127.0.0.1:8080/v3/api-docs` | HTTP 200，OpenAPI 3.1.0，FabMatrix Server API v2.0 | 可用于运行时路径和 DTO 核对 |
| API 代理默认目标 | `http://localhost:8080` | 由 Vite `/api` 代理提供，未新增前端地址 |
| WebSocket 默认目标 | `ws://localhost:8080` | 本基线不修改实时连接逻辑 |
| 浏览器开发端口 | 普通模式 5173；桌面模式 5176；Playwright Electron Mock 隔离使用 5177 | 端口含义已冻结 |
| Electron 内容尺寸 | 最小 `800×560`，最大 `1200×760`；已有测试另覆盖 `1920×1032` 构建产物场景 | UI-004 后续按 UI-003 已验证尺寸回归 |
| 当前源码 Bundle | Git 提交 `af8418a` | 后续截图必须标明实际源码/运行实例，不能把过期页面当作当前证据 |

此前浏览器现场曾存在登录态过期和旧端口页面重新导航失败的情况。因此本阶段不把无法确认源码版本的旧页面截图作为验收证据，也不伪造登录态或业务数据。UI-004.5 需要在可复现的浏览器和 Electron 实例中重新生成文件库截图。

## 3. 运行时 OpenAPI 文件接口

运行时 `/v3/api-docs` 实际包含以下文件路径：

```text
GET    /api/v1/print-files/tree
POST   /api/v1/print-files/page
POST   /api/v1/print-files/folder/create
POST   /api/v1/print-files/upload
POST   /api/v1/print-files/batch-upload
GET    /api/v1/print-files/{id}/preview
GET    /api/v1/print-files/{id}/thumbnail
GET    /api/v1/print-files/{id}/jobs
GET    /api/v1/print-files/{id}/download
DELETE /api/v1/print-files/{id}
DELETE /api/v1/print-files/batch
GET    /api/v1/print-files/folder/content
GET    /api/v1/print-files/storage
```

运行时查询 DTO `PrintFileQueryDTO` 的字段为：

```text
pageNum       integer，最小值 1，必填
pageSize      integer，范围 1-100，必填
fileName      string，文件名模糊查询
materialType  string，材质精确筛选
userId        integer，管理员可选的上传用户筛选
parentId      integer，省略或 null 表示根目录
```

运行时 OpenAPI 的业务响应大多仍引用泛型 `#/components/schemas/Result`，没有提供足够的嵌套成功/失败字段结构。前端不得从这个泛型声明推导不存在的 UI 字段，继续以 `API_HANDOFF.md` 和现有 `dataAdapters` 的安全映射为准。

## 4. API_HANDOFF 约束冻结

| 用户流程 | 正式请求约束 | 前端安全边界 |
| --- | --- | --- |
| 目录 | `GET /tree` 返回完整 `FileNodeVO[]` | 目录和文件都有节点；页面目录导航只能使用 `folder=true` 的节点，文件节点不得成为第二份主列表 |
| 分页 | `POST /page` JSON 使用 `pageNum`、`pageSize`、`fileName`、`materialType`、可选 `userId`/`parentId` | 不发送旧 `keyword` 或自造筛选字段；`parentId` 是当前目录唯一上下文 |
| 新建文件夹 | `POST /folder/create`，`folderName` 必填，`parentId` 可选 | 不把路径、显示标签或客户端生成 ID 当作后端字段 |
| 单文件上传 | `POST /upload`，Multipart `file`，`parentId` 可选 | 当前目录通过正式 `parentId` 传递 |
| 批量上传 | `POST /batch-upload`，重复 Multipart `files`，最多 100 个，逐项返回结果 | 保留逐项成功/失败，不能把部分失败显示为整批成功 |
| 预览/缩略图/任务 | `GET /{id}/preview`、`/{id}/thumbnail`、`/{id}/jobs` | 只展示安全预览字段和短期缩略图；不展示 `safeName`、`rustfsKey`、`fileUrl` |
| 下载 | `GET /{id}/download` 获取短期 URL，再按现有下载适配器处理 | 不把对象存储内部地址直接映射为页面字段 |
| 删除 | `DELETE /{id}` 或 `DELETE /batch`，目录 422、任务冲突 409、存储失败 503；批量逐项返回 | 删除失败项保留并可重试，不能以刷新列表伪造成功 |

`folder` 是当前 JSON 目录布尔字段，不能改用旧的 `isFolder`。文件树节点字段以 `id`、`parentId`、`folder`、`name`、`fileSize`、`materialType`、`createdAt`、`children` 为边界。

## 5. 当前前端调用链与问题证据

当前调用链为：

```text
FileLibrary.vue
  └─ src/api/printFile.js
      └─ src/utils/request.js
          └─ /api/v1/print-files/*
```

已确认的源码事实：

1. `loadFileTree()` 将完整树节点直接映射为 `t-tree` 数据；`normalizeTreeNode()` 保留文件和文件夹两类节点，并递归保留 `children`。
2. `fetchData()` 另外按 `parentId` 请求分页列表，当前根目录和子目录的主数据区由 `/page` 返回。
3. 当前树节点点击文件会直接打开详情，点击文件夹会改变 `currentParentId` 并重新请求分页列表。因此完整树中的文件和主列表中的文件在信息架构上重复出现。
4. 当前页面同时维护自定义 Grid 卡片和 `TdTable` 列表两套渲染器；它们共用部分状态，但操作、字段密度和滚动样式分别实现，存在视觉和交互分叉风险。
5. Page Header 的 action 插槽外层是自定义 `file-library-toolbar__actions`，视图切换内部才使用 `t-space`，新建文件夹、上传和刷新没有统一的 `Space` 间距，因此现场可见按钮粘连。
6. 当前表格通过项目兼容层 `TdTable` 承接列插槽；后续要优先评估原生 TDesign Table 的 `rowKey`、`loading`、`height/maxHeight`、固定操作列和空状态能力，不能为了视觉重写而复制请求逻辑。

## 6. 现有测试与基线限制

`tests/fileLibrary.test.js` 当前覆盖：

- 完整文件树接口和目录导航入口
- 正式 `parentId`、`fileName` 和无伪造材料/统计值
- 上传/删除结果态和错误分支
- 文件详情安全字段及缩略图不可用状态
- 默认列表视图、显式详情入口和滚动容器约束
- TDesign Drawer、Descriptions 和关闭同步

这些测试是源码契约测试，不能替代真实浏览器/Electron 的布局、点击、键盘和滚轮验收。当前基线未宣称真实 RustFS、生产 CORS、物理打印机、安装包签名、Windows DPI 或系统主题已验证。

UI-004 后续截图和操作记录必须至少覆盖根目录、含文件夹目录、空目录、筛选无结果、接口失败、详情 Drawer、上传入口和删除冲突；不得记录 Token、密码、预签名 URL 或真实敏感凭据。

## 7. UI-004.0 退出结论

- [x] 已冻结实际后端地址、OpenAPI 路径和运行时 DTO。
- [x] 已冻结 `API_HANDOFF.md` 的字段、安全边界和错误语义。
- [x] 已确认完整文件树只能作为目录上下文，不能作为主文件列表的第二份展示。
- [x] 已定位当前左右重复展示、工具栏按钮粘连和双渲染器分叉的源码原因。
- [x] 已记录当前 Bundle、Electron 尺寸和浏览器/Electron 现场复现限制。
- [ ] 真实浏览器/Electron 文件库截图和滚轮记录，转入 UI-004.5。

本阶段不修改业务代码；后续从 UI-004.1 开始重组目录导航和页面信息架构。
