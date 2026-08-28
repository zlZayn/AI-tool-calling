# tests/ — 测试手册

- 职责：三层测试：命名规范（静态）→ 直接工具调用 → MCP 协议
- test_naming_convention.ts：对照 [tool_schema.json](tool_schema.json) 校验文件/名称/`.mcp.json`，`npm test` 即此
- test_direct_tools.ts：直接调每个工具 handler，覆盖正常、错误（1/0、危险命令拦截）、缓存场景
- test_mcp_servers.ts：spawn 服务器进程走 JSON-RPC（initialize → tools/list → tools/call）
- tool_schema.json：命名规范与工具注册表，是命名测试的唯一数据源
- 深度说明 → 见 [TEST_GUIDE.md](TEST_GUIDE.md)
- 变更影响路由：改工具/服务器名或 .mcp.json → 跑命名测试 + MCP 测试；改 handler 行为 → 跑直接调用测试
- 使用约束与工作偏好 → 见 [AGENTS.md](AGENTS.md)
- 回引根索引：[../AGENTS.md](../AGENTS.md) · 架构：[../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)