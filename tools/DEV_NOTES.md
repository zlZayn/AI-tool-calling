# Development Notes

## Architecture: Server → Tool

A **server** is a single process that exposes **multiple tools** grouped by domain. The LLM sees each tool as an independent capability, but behind the scenes they share the same process lifecycle, dependency graph, and runtime state.

The codebase has two modes with different server/tool mappings:

### MCP Mode

Each server maps 1:1 to the MCP protocol — a server process registers itself as an MCP server, and each tool becomes an MCP tool:

- `.mcp.json` defines two servers: `run-code` and `get-env-info`
- Each `servers/*.py` is a standalone Python process, launched independently by the MCP client
- Each `servers/*.py` imports and registers tools from `tools/*.py`
  - `run_code_server.py` hosts `run_python`, `run_r`, `run_shell`
  - `get_env_info_server.py` hosts `get_cpu_info`, `get_memory_info`, `get_disk_info`, `get_gpu_info`, `get_system_info`, `get_runtime_info`
- Each `tools/*.py` is a single function decorated with `@tool`, auto-discovered by its server

### Tool Calling (Direct)

No MCP layer. `tool_call.py` loads all tools from `tools/` into one registry and exposes them to the LLM in a single API call. All tools sit in a flat namespace — no server grouping.

The LLM sees the same tool definitions regardless of mode — the routing layer differs.

### Why Server-Tool Separation

| Concern | Addressed by |
| --- | --- |
| Process lifecycle per domain | Server — start/stop independently |
| Tool granularity for LLM | Tool — one function, focused scope |
| Shared dependencies | Server — single `requirements.txt` or imports per domain |
| Independent scaling | Server — e.g. `run-code` may need more resources than `get-env-info` |
| Protocol-agnostic tool logic | Tool — same `@tool` decorator works in both modes |

## subprocess + MCP 事件循环（Windows）

MCP 服务器的 `stdio_server()` 用 `anyio` 包装 stdin/stdout，这在 Windows 上会创建 I/O 完成端口（IOCP）。之后**在当前进程内**调用 `subprocess.Popen()`，**只要设置了 stdout/stderr 句柄重定向**（哪怕是 `DEVNULL`），子进程就会永久卡死。

### 影响范围

- `subprocess.run(capture_output=True)` — 最常用
- `subprocess.Popen(stdout=PIPE)` — 管道
- `subprocess.Popen(stdout=DEVNULL)` — 甚至丢弃输出也不行
- `subprocess.Popen(stdout=文件句柄)` — 文件重定向一样卡
- 以上不管是同步调用、放 `asyncio.to_thread`、还是放 `anyio.to_thread.run_sync`，都卡

### 唯一不卡的模式

```python
subprocess.Popen(
    [exe, ...],
    creationflags=subprocess.DETACHED_PROCESS | subprocess.CREATE_NO_WINDOW,
    # 不设 stdout/stderr，让子进程继承父进程的句柄（或没有句柄）
)
```

### 解决方案

让一个独立子进程去做需要 subprocess 的工作，通过临时文件传结果。当前进程（有 MCP 事件循环）用 `Popen(DETACHED_PROCESS, 无管道)` 启动一个纯 Python 子进程。子进程没有 MCP 上下文，里面可以正常使用 `subprocess.run()`，检测结果写入临时 JSON 文件，当前进程再读回来。

### 不受影响的场景

- Tool Calling 模式（没有 `asyncio.run()`，无 IOCP 冲突）
- 非 Windows 平台
- 子进程内部再调 subprocess（子进程没有 MCP 上下文）

## 命名规则

`snake_case` 命名，全部小写。

## 工具编写约定

- 工具函数必须是同步的，返回 `str`
- MCP server 中通过 `asyncio.to_thread()` 调用工具函数
- 检测类工具首次运行后应缓存结果
