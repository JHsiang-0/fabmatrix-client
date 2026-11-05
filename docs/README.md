# FabMatrix Client 文档索引

## 当前有效基线

- 产品版本：`1.0.0` 准正式版，候选标识 `v1.0.0-rc.1`。
- 当前发布门禁：[`farm-v1-release-readiness`](../.kiro/specs/farm-v1-release-readiness/)。
- 当前部署形态：Windows Local Edition，一个本地服务端、多个 Electron 客户端，默认端口 `28081`。
- 当前接口路径仍为 `/api/v1`；这是兼容性路径，不代表产品版本是 v1。

完整的版本、路线和文档状态说明见：[VERSION_AND_ROADMAP.md](./VERSION_AND_ROADMAP.md)。

## 文档分工

| 文档 | 用途 | 当前地位 |
| --- | --- | --- |
| [`../AGENTS.md`](../AGENTS.md) | 前端协作、验证和安全约束 | 工作规则 |
| [`VERSION_AND_ROADMAP.md`](./VERSION_AND_ROADMAP.md) | 产品版本、历史规格和发布范围的唯一映射 | 当前权威索引 |
| [`CLOUD_MANAGEMENT.md`](./CLOUD_MANAGEMENT.md) | 云端组织、农场、成员、网关和审计管理 | 云端首期界面 |
| [`../API_HANDOFF.md`](../API_HANDOFF.md) | 前后端 HTTP/WebSocket 契约 | 当前接口依据 |
| [`../FRONTEND_UI_SPECIFICATION.md`](../FRONTEND_UI_SPECIFICATION.md) | UI 设计和交互基线 | 当前设计参考 |
| [`../design-qa.md`](../design-qa.md) | UI 视觉验收记录 | 验收证据 |
| [`../FRONTEND_TODO.md`](../FRONTEND_TODO.md) | 前端历史任务与遗留项 | 辅助清单，不替代发布门禁 |

## Kiro 规格

- `farm-v1-release-readiness`：当前 1.0.0 发布整改和门禁。
- `farm-ui-v2`：手动优先、文件库/任务中心等功能基线；目录名是历史开发阶段，不是产品版本。
- `farm-ardot-tdesign-prototype`：使用 Ardot 与 TDesign for web 建立完整前端原型，评审通过后再进入 Vue 编码。
- `farm-v3-batch-dispatch`：后台自动派单及更高风险批量能力的后续规划，1.0.0 不发布。
- 其他 `farm-*`、`printer-*` 规格：按功能拆分的历史设计、联调或验收记录，状态以各自文档为准。

历史文档不直接删除或重命名，避免破坏任务引用和提交历史；新增任务必须先在版本地图中登记归属。
