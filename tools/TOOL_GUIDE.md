# Tool Guide

项目架构、工具注册机制、环境查询原理、命名规范、工具编写指南。

## Architecture: Server → Tool

A **server** is a single process that exposes **multiple tools** grouped by domain. The LLM sees each tool as an independent capability, but behind the scenes they share the same process lifecycle and runtime state.

The codebase has two modes with different server/tool mappings:

### MCP Mode

Each server maps 1:1 to the MCP protocol — a server process registers itself as an MCP server, and each tool becomes an MCP tool:

- `.mcp.json` defines two servers: `run-code` and `get-env-info`
- Each `servers/*.ts` is a standalone process, launched independently by the MCP client
- Each `servers/*.ts` imports tools from `tools/index.ts` (barrel file) and registers them via `server.tool()`
  - `run_code_server.ts` hosts `run_python`, `run_r`, `run_shell`
  - `get_env_info_server.ts` hosts `get_cpu_info`, `get_memory_info`, `get_disk_info`, `get_gpu_info`, `get_system_info`, `get_runtime_info`

### Tool Calling (Direct)

No MCP layer. `index.ts` loads all tools from `tools/` into one registry and exposes them to the LLM in a single API call. All tools sit in a flat namespace — no server grouping.

The LLM sees the same tool definitions regardless of mode — the routing layer differs.

### Why Server-Tool Separation

| Concern | Addressed by |
| --- | --- |
| Process lifecycle per domain | Server — start/stop independently |
| Tool granularity for LLM | Tool — one function, focused scope |
| Independent scaling | Server — e.g. `run-code` may need more resources than `get-env-info` |
| Protocol-agnostic tool logic | Tool — same `registerTool()` works in both modes |

## Tool Registry

Tools self-register at module load time:

1. Each `tools/*.ts` file calls `registerTool()` from `tools/lib/registry.ts`
2. `tools/index.ts` imports all tool files (barrel pattern), triggering registration
3. `getAllTools()` returns the full registry Map

This replaces Python's `pkgutil.iter_modules()` auto-discovery with explicit imports — more predictable, enables tree-shaking.

## Environment Helpers

`tools/lib/env_helpers.ts` uses PowerShell CIM cmdlets via `child_process.execFile` for hardware queries:

- Memory: `Get-CimInstance Win32_OperatingSystem` — total, available, usage %
- CPU: `Get-CimInstance Win32_Processor` — model, physical/logical cores, max/current clock, L2/L3 cache, architecture, load %, virtualization
- Disk: `Get-CimInstance Win32_LogicalDisk` — per-drive total, used, free, usage %
- GPU: `Get-CimInstance Win32_VideoController` — name, VRAM, driver, video processor, refresh rate. For NVIDIA GPUs, `nvidia-smi --query-gpu` provides real-time VRAM usage, GPU/memory utilization, temperature, power draw, driver version, and CUDA version
- Runtimes: 150+ executable version checks via `child_process.exec`, batched with `Promise.allSettled`

Node.js `os` module is used for basic info (hostname, arch, uptime).

## Naming Convention

`snake_case` for all identifiers and file names. All lowercase.

- Server files: `{verb}_{noun}_server.ts`
- Tool files: `{verb}_{noun}.ts`
- Server MCP names: `{verb}-{noun}` (kebab-case)

## Tool Authoring Guide

To add a new tool:

1. Create `tools/my_tool.ts`
2. Import `registerTool` from `./lib/registry.js`
3. Call `registerTool()` with name, description, Zod parameters, and async handler
4. Add `import "./my_tool.js";` to `tools/index.ts`

Handler must return a string. Use `SandboxError` from `./lib/errors.js` for structured error handling.
