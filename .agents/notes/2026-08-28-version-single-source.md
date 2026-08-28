# 决策：McpServer version 单一来源（2026-08-28）

已实施：已实施

## 问题
- 两个 server 的 `McpServer({ version })` 硬编码 1.0.0
- 与 package.json 的 2.0.0 不一致，客户端看到的 server 版本失真

## 决策
- version 从根 package.json 读取：`createRequire(import.meta.url)("../package.json")`
- 路径按源码相对解析（servers 仅经 tsx 从源码启动，.mcp.json / dev 脚本 / 测试）
- 落实于 commit b95fd78

## 替代方案
- 硬编码 2.0.0：本次一致但下次升版要同步改三处，二次漂移必然复现
- ESM JSON import（`with { type: "json" }`）：tsc 可编译，但运行时要求 Node ≥ 20.10，兼容面窄
- 向上 walk 查找 package.json：对 dist/servers 无执行入口的项目属过度工程

## 影响
- 升版只改 package.json 一处，测试可验证（test_mcp_servers 启动 server 即触发读取）
- 与既有 lib/agent.ts 的 config 相对路径解析模式一致