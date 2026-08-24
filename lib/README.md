# lib/ — LLM 会话手册

- 职责：Agent 会话循环（提问 → 工具调用 → 回答）
- agent.ts：`Agent` 类，`create()` 工厂读 config/config.json 并注册全部工具，`chat()` 流式对话 + 工具回环
- 关键导出：`Agent`
- 被谁依赖：仅 [index.ts](../index.ts)（CLI 入口）
- 变更影响路由：改 chat 参数/返回 → 同步 [index.ts](../index.ts) 的 CLI 用法与 [README.md](../README.md) 参数表
- 使用约束与工作偏好 → 见 [AGENTS.md](AGENTS.md)