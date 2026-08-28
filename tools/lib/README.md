# tools/lib/ — 工具基础设施手册

- 职责：工具注册、类型契约、错误类型、硬件查询与进程执行的共享底座
- registry.ts：`registerTool` / `getAllTools` / `getTool`，被全部工具文件、[lib/agent.ts](../../lib/agent.ts)、servers/* 依赖
- types.ts：`Tool` 接口 + `toJsonSchema()`（zod → JSON Schema），被 agent.ts 与 servers/* 依赖
- errors.ts：`SandboxError(kind: timeout/not_found/crash/execution_error)`，被 run_* 工具依赖
- env_helpers.ts：`CATEGORIES`/`fmt`（环境信息格式化）、`detectRuntimes`（双阶段探测 + 缓存）、`spawnProcess`/`truncate`，被 get_* 与 run_* 依赖
- 变更影响路由：改共享函数 → 依赖方见上，改动后必跑 [test_direct_tools.ts](../../tests/test_direct_tools.ts) 与 `npx tsc --noEmit`
- 使用约束与工作偏好 → 见 [AGENTS.md](AGENTS.md)
- 回引根索引：[../../AGENTS.md](../../AGENTS.md) · 架构：[../../docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md)