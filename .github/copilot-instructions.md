# Copilot / AI Agent 使用说明（为本仓库定制）

以下说明面向来此仓库协助开发的 AI 编码代理（或 Copilot 风格助手）。目标是让代理在最少提问下直接产出符合本项目约定的改动。

1. 项目总体
- 技术栈：Vue 3 + Vite + Pinia（持久化插件）+ Element Plus。入口：`src/main.js`。
- 路由：单页面应用，根路由使用布局组件 `src/layout/index.vue`，子页面放在 `src/components` / `src/views`。

2. 状态与鉴权
- 全局状态使用 Pinia，用户态位于 `src/stores/user.js`，store 配置了 `persist: true`，token 会被持久化到 localStorage。
- 路由守卫在 `src/router/index.js`：基于 `useUserStore().token` 判断是否允许访问非登录页；遇到未登录或访问登录页的特殊处理请遵循该文件逻辑。

3. HTTP 层与错误约定（关键）
- 所有后端请求请通过 `src/utils/request.js` 导出的 axios 实例 `request` 发起（不要直接使用 axios），因为它实现了：
  - 自动带 `Authorization: Bearer <token>`（来自 `useUserStore().token`）
  - 统一响应拦截：后端返回对象结构为 { code, data, message }；当 `code !== 200` 时会触发 Element Plus 的 `ElMessage.error` 并拒绝 Promise；当 `code === 200` 时返回整个 `res` 对象（因此调用方通常读取 `res.data`）。
  - 401 会触发 `userStore.logout()` 并跳转到 `/login`。
- 示例：参见 `src/api/file.js`、`src/api/job.js`、`src/api/printer.js`、`src/api/user.js`，请使用相同的 `request({ url, method, params/data, headers })` 约定。

3.a 参考后端 API 文档（认证相关）
- 查看附带的 `API_DOCUMENT.md`（仓库外或同步附件），认证接口如下：
  - `POST /api/v1/auth/login`：请求体 `{ username, password }`，响应 `data` 中包含 `token, expiresIn, userId, username, role, email, phone`。
  - `POST /api/v1/auth/register`：请求体 `{ username, password, confirmPassword, email, phone }`。
- 后端统一响应格式为 `{ code, message, data }`，认证错误返回 `code = 401`。
- 实作提示：注册页面需要收集并校验 `confirmPassword`、`email`、`phone`，并按文档校验规则（用户名 3-20 位，密码长度 6-20 位，手机号为中国大陆格式）。


9. 快速文件参考（示例）
- 请求封装： [src/utils/request.js](src/utils/request.js#L1-L200)
- API 层示例： [src/api/file.js](src/api/file.js#L1-L200)
- 状态管理（用户）： [src/stores/user.js](src/stores/user.js#L1-L200)
- 路由守卫： [src/router/index.js](src/router/index.js#L1-L200)

如果本说明有不清楚或遗漏的地方，请指出需要补充的场景（例如：CI、后端代理配置、特定接口返回样例等），我会迭代更新。 
