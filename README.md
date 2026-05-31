# AI-tool-calling

[English](README.md) | [简体中文](README_zh.md)

Minimal tool calling framework. Tool Calling + MCP dual-mode.

| Mode | Config | What it does |
| --- | --- | --- |
| **Tool Calling** | `config/config.json` | Loads tools from `tools/` and feeds them to LLM directly |
| **MCP** | `.mcp.json` | Wraps the same tools as MCP servers for agents |

`config/config.json` is git-ignored; copy from the example and fill in your API key.

---

## Tool Calling

Calls LLM API directly (OpenAI-compatible). Requires API key.

### Config

```bash
# 1. Copy example config
cp config/config_example.json config/config.json

# 2. Edit config/config.json — fill in your API key and endpoint
```

| Field | Description | Example |
| --- | --- | --- |
| `api_key` | Your API key | `sk-xxx` |
| `base_url` | API endpoint | `https://api.deepseek.com` |
| `model` | Model name | `deepseek-v4-flash` |

### Usage

```bash
python tool_call.py "What files are here"            # answer only (default)
python tool_call.py --show_process "what files are here"  # show thinking, tool calls, and result
python tool_call.py --stream "Fibonacci 30th"        # stream output in real-time
python tool_call.py --list_tools                     # list available tools
```

| Parameter | Description |
| --- | --- |
| `question` | Your question |
| `--show_process` | Show thinking process, which tool was called, and its result |
| `--stream` | Stream output in real-time (auto-enables `--show_process`) |
| `--force_tool` | Force the LLM to call a tool before answering |
| `--list_tools` | List available tools and exit |

---

## MCP Mode

Registers tools as MCP servers. No API key needed — MCP clients manage LLM access themselves.

### Setup

No setup needed — `.mcp.json` is ready to use out of the box.

### Registered Servers

| Server | Tools | Description |
| --- | --- | --- |
| `run-code` | `run_python`, `run_r`, `run_shell` | Execute code in sandboxed runtimes |
| `get-env-info` | `get_system_info`, `get_cpu_info`, `get_memory_info`, `get_disk_info`, `get_gpu_info`, `get_runtime_info` | Fetch host info: system, cpu, memory, disk, gpu, runtimes |

Connect via any MCP-compatible client (Claude Desktop, Claude Code, etc.).

## Adding Tools

Drop a `.py` in `tools/` with `@tool` decorator — auto-discovered on startup. Tool descriptions guide the LLM's workflow and output format.

## Project Structure

```text
AI-tool-calling/
├── .gitignore
├── .mcp.json
├── README.md
├── README_zh.md
├── config/
│   ├── config.json
│   └── config_example.json
├── lib/
│   ├── __init__.py
│   └── agent.py
├── requirements.txt
├── servers/
│   ├── get_env_info_server.py
│   └── run_code_server.py
├── tests/
│   ├── test_naming_convention.py
│   └── tool_schema.json
├── tool_call.py
└── tools/
    ├── __init__.py
    ├── DEV_NOTES.md
    ├── _env_helpers.py
    ├── get_cpu_info.py
    ├── get_disk_info.py
    ├── get_gpu_info.py
    ├── get_memory_info.py
    ├── get_runtime_info.py
    ├── get_system_info.py
    ├── run_python.py
    ├── run_r.py
    └── run_shell.py
```
