# config/ — 配置目录手册

- 职责：Tool Calling 模式的运行配置
- config_example.json：提交的样例模板，schema 为 api_key / base_url / model
- config.json：运行时副本，git-ignored，由用户从样例复制后填入真实密钥
- 敏感说明：config.json 含真实 API 密钥，严禁提交；[.gitignore](../.gitignore) 已排除
- 被谁依赖：仅 [lib/agent.ts](../lib/agent.ts)（`Agent.create()` 按 `../config/config.json` 读取）
- 与 .mcp.json 的关系：MCP 模式不需要本目录（MCP 客户端自管 LLM）；仅 Tool Calling 模式使用
- 与 package.json 的关系：无直接引用
- 极小配置目录且无特有工作规则，只建 README 不建 AGENTS.md
- 回引根索引：[../AGENTS.md](../AGENTS.md) · 架构：[../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)