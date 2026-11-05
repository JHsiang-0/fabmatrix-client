# FabMatrix Client

嘉东三维联动 3D 打印机实时控制系统的 Vue 3 / Electron 客户端。当前产品版本为 `1.0.0` 准正式版，默认连接本地服务端 `28081`。

Client 与 Server 构成独立的厂内生产系统，账号、岗位、文件和任务由所选 Server 管理。Cloud 与 Flutter 手机 App 提供独立远程业务，Server 通过可选模块上报设备数据。当前分工见 [架构决定](../../Java/fabmatrix-cloud/docs/decisions/0011-local-production-and-cloud-reporting.md)。

本地管理员可进入“设置 → 云端连接”，绑定当前 Server、查看组织及农场归属、开启或关闭上报并解绑。操作与升级顺序见 [Server 云端连接说明](../../Java/fabmatrix-server/docs/CLOUD_GATEWAY.md)。

版本、路线和文档入口见 [`docs/README.md`](./docs/README.md)；本文件下方保留了 Vite/Electron 的基础运行说明。

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Compile and Minify for Production

```sh
npm run build
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint:check
```

### 交付前验证门禁

```sh
npm run verify              # 全量测试、lint、浏览器和桌面端构建
npm run test:mock          # Mock HTTP 集成回归
```

`verify` 不连接真实后端或打印机；真实联调前仍需配置后端地址。Windows 桌面端可用以下命令生成目录包进行冒烟检查：

```sh
npm run desktop:build:dir
```

目录包默认输出到 `release/win-unpacked`；若该目录被系统或运行中的 Electron 占用，应先关闭占用进程，或为 electron-builder 指定一个新的输出目录。

## Windows 桌面端

项目使用 Electron 运行前端页面，使用 electron-builder 生成 Windows NSIS 安装包。

首次使用前复制桌面端环境变量示例：

```sh
copy .env.desktop.example .env.desktop
```

根据实际后端地址修改 `.env.desktop`，然后执行：

```sh
npm run desktop:dev       # Electron 桌面开发模式
npm run desktop:build     # 生成 release/ 下的 Windows 安装包
npm run desktop:build:dir # 生成未安装目录，便于快速验收
```

桌面端构建使用 hash 路由，并要求 `VITE_API_BASE_URL` 配置为后端 HTTP 地址；`VITE_WS_URL` 可选，留空时由前端根据 API 地址自动推导 `/ws/farm-status`。安装包只包含前端客户端，不包含后端服务；后端需要单独部署并允许桌面客户端访问。
# Mock 开发模式

复制 `.env.example` 为本地环境文件并设置 `VITE_USE_MOCK=true`，即可在不依赖后端的情况下开发页面。

批量派发属于 V3 预留能力，准正式版默认关闭。需要联调已保留的页面、API 和 Mock 时，显式设置 `VITE_FEATURE_BATCH_DISPATCH=true`；生产构建不要开启该变量，直到后端同步设置 `FARM_BATCH_DISPATCH_ENABLED=true` 并完成 V3 验收。

内置演示账号：

- ADMIN：`admin` / `Admin123`
- OPERATOR：`operator` / `Operator123`

以上账号仅用于本地 Mock，不得用于真实环境。开发者可在浏览器控制台执行 `window.__FARM_RESET_MOCK__()` 重置当前 Mock 数据。

Mock 错误演示可在请求参数中加入 `mockError=401`、`403`、`404`、`409`、`422`、`10001`、`10002`、`5003` 或 `5004`。

## 当前文档与发布入口

- [`docs/README.md`](./docs/README.md)：前端文档索引。
- [`docs/VERSION_AND_ROADMAP.md`](./docs/VERSION_AND_ROADMAP.md)：产品版本与 Kiro 路线地图。
- [`API_HANDOFF.md`](./API_HANDOFF.md)：前后端接口契约；`/api/v1` 是兼容路径，不是产品版本。
- `.kiro/specs/farm-v1-release-readiness/`：当前 1.0.0 发布门禁；V3 批量派发仍是后续路线。
