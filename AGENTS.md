# AI-tool-calling — 维护索引

## 全局规则
- 双件职责分离：AGENTS.md 只写规则，README.md 只写是什么/怎么改
- 命名：文件/工具 snake_case，MCP server 名 kebab-case（见 [tools/TOOL_GUIDE.md](tools/TOOL_GUIDE.md)）
- 新工具三步：新建 `tools/{name}.ts` → [tools/index.ts](tools/index.ts) 加 barrel import → 登记 [tool_schema.json](tests/tool_schema.json)
- 架构：[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- 文档地图：[tools/README.md](tools/README.md) · [servers/README.md](servers/README.md) · [lib/README.md](lib/README.md) · [tests/README.md](tests/README.md) · [config/README.md](config/README.md) · [.agents/notes/](.agents/notes/)

## 常用命令
- `npm test`（命名测试）· `npx tsx tests/test_direct_tools.ts` · `npx tsx tests/test_mcp_servers.ts`
- `npx tsc --noEmit` · `npm run build` · `npm run dev:mcp:env` · `npm run dev:mcp:code`

## 验证快照（2026-08-28 实测）
- npm test: 24 passed / 0 failed
- test_direct_tools: 9 个工具全过
- test_mcp_servers: 2 个 server 全过
- tsc --noEmit: clean

## 待办
- [ ] 视觉识别工具模块未实施（[预期计划-提交推送别带上我.md](预期计划-提交推送别带上我.md)；其中 `lib/registry.ts`/`lib/types.ts` 路径已过时，实际在 tools/lib/）

## 活跃坑
- 新工具漏加 tools/index.ts barrel import → LLM 与 MCP 两侧都不可见
- test_mcp_servers 用 shell:true spawn，有 DeprecationWarning（不影响结果）
- run_r / run_python 依赖本机解释器，缺失时返回 not_found（属预期，不是崩溃）