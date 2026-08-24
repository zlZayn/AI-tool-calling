# tools/ — 工具手册

- 职责：定义全部工具与注册机制
- index.ts：barrel 导出 registry 函数 + 触发所有工具注册的 import 列表
- get_system_info.ts / get_cpu_info.ts / get_memory_info.ts / get_disk_info.ts / get_gpu_info.ts / get_runtime_info.ts：环境域，被 get_env_info_server.ts 托管
- run_python.ts / run_r.ts / run_shell.ts：执行域，被 run_code_server.ts 托管
- lib/registry.ts：注册表 Map 与 registerTool/getAllTools/getTool，被全部工具与 [lib/agent.ts](../lib/agent.ts) 依赖
- lib/types.ts：Tool 接口与 toJsonSchema()，被 agent.ts 与 server 依赖
- lib/errors.ts：SandboxError，被 run_* 工具依赖
- lib/env_helpers.ts：硬件查询（CIM）与 runtime 探测、spawnProcess/truncate/fmt/CATEGORIES，被 get_* 与 run_* 依赖
- 编写指南与命名规范 → 见 [TOOL_GUIDE.md](TOOL_GUIDE.md)
- 变更影响路由：改工具名 → tool_schema.json + 两个测试；改参数 schema → MCP 与 OpenAI 两侧契约同变
- 使用约束与工作偏好 → 见 [AGENTS.md](AGENTS.md)