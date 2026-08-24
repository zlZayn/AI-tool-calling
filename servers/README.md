# servers/ — MCP 服务器手册

- 职责：把 tools/ 注册表按域装配为 McpServer，stdio transport
- run_code_server.ts：托管 run_python / run_r / run_shell，被 .mcp.json 的 `run-code` 启动
- get_env_info_server.ts：托管 6 个 get_*_info 工具，带只读 hint，被 .mcp.json 的 `get-env-info` 启动
- 被谁依赖：仅 .mcp.json；内部无交叉引用
- 变更影响路由：改 server 名/工具集合 → 同步 [tool_schema.json](../tests/tool_schema.json) 与 .mcp.json，跑 [test_naming_convention.ts](../tests/test_naming_convention.ts) 与 [test_mcp_servers.ts](../tests/test_mcp_servers.ts)
- 使用约束与工作偏好 → 见 [AGENTS.md](AGENTS.md)