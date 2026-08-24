# AI-tool-calling 架构说明

## 定位
- 最小工具调用框架，Tool Calling + MCP 双模式
- TypeScript 移植自 Python 版 `lib/agent.py`，对外契约与错误文本保持一致

## 两种运行模式
- Tool Calling：`index.ts` → Agent（lib/agent.ts）→ OpenAI SDK `chat.completions`，传 tools 与 tool_choice
- MCP：`servers/*.ts` 各注册一个 `McpServer`，stdio transport，由 `.mcp.json` 声明启动

## 工具注册链
- 每个 `tools/{name}.ts` 在模块加载时调用 `registerTool()`
- `tools/index.ts` 的 barrel imports 触发全部注册
- `tools/lib/registry.ts` 持有全局 Map，`getAllTools()` 供两种模式取用

## 契约
- `Tool`：name / description / parameters（ZodRawShape）/ handler（返回 string）
- handler 必返回字符串；出错抛 `SandboxError(kind)`，上层捕获后回填 `Error: ...`
- parameters 单源：同一 shape 同时喂 MCP SDK 与 `toJsonSchema()`（OpenAI 格式）

## 数据流（Tool Calling）
- 用户提问 → `Agent.chat` → 流式累积 delta（reasoning_content / content / tool_calls 按 index 分片）
- 无 tool_calls → 直接返回 content
- 有 tool_calls → 顺序执行 handler，结果以 tool 消息回填，进入下一轮

## 关键决策
- registry 独立于 index.ts：避免循环依赖
- 显式 barrel import 替代动态发现：可预测、支持 tree-shaking；Python 版用 `pkgutil.iter_modules`
- server 与 tool 分离：进程生命周期按域、工具粒度按函数，`run-code` 与 `get-env-info` 可独立启停
- 环境探测走 PowerShell CIM，15s 超时返回 null，降级 os 模块兜底
- runtime 探测双阶段：env 变量快查 → PATH 扫描分批并发（Promise.allSettled），结果缓存

## 防错清单
- 所有子进程带 timeout，超时 SIGTERM 并抛 `SandboxError.timeout`
- run_shell 危险命令前缀黑名单拦截
- run_python 先 eval 后 exec（临时文件方案），finally 清理
- 工具名不在注册表 → 回填 `unknown tool`，不中断会话

## 文档边界
- 本文档只写"为什么"与契约；文件级索引在根 AGENTS.md 的文档地图