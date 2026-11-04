# Client 完整设备模型

## 入口与数据来源

打印机管理和看板共用 `DeviceDetailDrawer`。设备概览中的“完整设备状态”通过本地 HTTP 接口 `GET /api/v1/printers/{id}/model` 读取 Server 持久化的统一设备模型，当前支持 modelVersion 2。列表、看板和 WebSocket 继续使用轻量状态摘要。

Server 负责 Klipper、RRF 采集和字段映射。Client 展示工具与加热器关联、多路温度与目标、风扇、坐标、归零、传感器、能力、当前执行和上次执行结果。未提供的字段显示未知、不支持或不可用。测量值的提示包含质量、来源和采样时间。

详情顶部的状态、通信和进度优先使用完整模型。内部任务编号、安全确认和控制动作仍由现有本地业务接口处理。

## 新鲜度与生命周期

- 概览可见时每次请求完成后间隔 5 秒刷新，失败后间隔 30 秒重试，也可手动刷新。
- 关闭抽屉、切换设备、切换历史页、隐藏窗口或退出账号时取消请求并清空上下文。忽略取消信号的旧响应也不会覆盖新设备或新会话。
- 采用 Server 时间校准设备数据年龄，每秒重新判断。监控关闭、非在线、采样超过 30 秒及异常未来时间均不能作为当前状态。
- 每个测量还需质量为 GOOD 且时间有效。0 和 false 保留，缺失值不补成 0。计数超过 JavaScript 安全整数范围时显示无效数据。
- 离线时隐藏当前测量和进度，最近执行标记为历史快照，上次执行结果独立显示。刷新失败后清除前次模型并展示重试入口。
- 未采样展示空状态，旧 Server 没有此接口时展示请求错误。需同时更新 Server 和 Client。

## 维护与验证

API 封装位于 `src/api/printer.js`，显示适配位于 `src/utils/printerModel.js`，轮询隔离位于 `src/utils/printerModelLoader.js`，界面位于 `src/components/device/PrinterModelPanel.vue`。

`npm run test:printer-model` 覆盖模型契约、质量与新鲜度、历史结果、摘要转换、请求竞态及 Mock 权限。浏览器专项场景通过打印机管理真实打开详情，验证多通道、离线、错误、桌面和紧凑窗口展示。提交前执行 `npm run lint:check`、`npm test`、`npm run build`，发布执行 `npm run release:gate`。
