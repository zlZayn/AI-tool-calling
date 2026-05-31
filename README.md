# AI-tool-calling

Minimal tool calling framework. CLI + MCP dual-mode.

## Quick Start

```bash
pip install -r requirements.txt
cp config_example.json config.json
python tool_call.py "Create a normal distribution sequence, CSV format"
```

## Configuration

Edit `config.json`:

| Field | Description |
| --- | --- |
| `api_key` | Your API key |
| `base_url` | API endpoint |
| `model` | Model name |

## CLI Mode

```bash
python tool_call.py "what files are here"
python tool_call.py --stream "fibonacci 30th"
```

| Parameter | Description |
| --- | --- |
| `question` | Your question |
| `--show_process` | Show thinking, tool calls, and answer |
| `--stream` | Stream output in real-time (auto-enables `--show_process`) |
| `--force_tool` | Force the LLM to call a tool before answering |
| `--list_tools` | List available tools and exit |

## MCP Mode

Two MCP servers registered in `.mcp.json`:

| Server | Tools | Description |
| --- | --- | --- |
| `run-code` | `run_python`, `run_r`, `run_shell` | Execute code in sandboxed runtimes |
| `get-system-info` | `get_host_info` | Fetch host machine info (OS, processor, memory) |

Connect via any MCP-compatible client (Claude Desktop, Claude Code, etc.).

## Adding Tools

Drop a `.py` in `tools/` with `@tool` decorator — auto-discovered on startup. Tool descriptions guide the LLM's workflow and output format.

## Project Structure

```text
AI-tool-calling/
├── .mcp.json
├── README.md
├── README_zh.md
├── config.json
├── config_example.json
├── get_system_info_server.py
├── lib/
│   ├── __init__.py
│   └── agent.py
├── requirements.txt
├── run_code_server.py
├── tool_call.py
└── tools/
    ├── __init__.py
    ├── run_python.py
    ├── run_r.py
    ├── run_shell.py
    └── get_host_info.py
```
