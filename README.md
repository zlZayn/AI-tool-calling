# AI-tool-calling

[English](README.md) | [简体中文](README_zh.md)

Minimal tool calling framework. Tool Calling + MCP dual-mode.

## Quick Start

```bash
npm install

# MCP mode (no API key needed) — use with Claude Desktop, Claude Code, etc.
# .mcp.json is ready to use out of the box.

# Tool Calling mode (needs API key)
cp config/config_example.json config/config.json
# Edit config/config.json — fill in api_key, base_url, model
npx tsx index.ts "your question"
```

## Usage

```bash
npx tsx index.ts "What files are here"                # answer only
npx tsx index.ts --show_process "what files are here" # show thinking + tool calls
npx tsx index.ts --stream "Fibonacci 30th"            # stream output
npx tsx index.ts --list_tools                         # list tools
```

| Parameter | Description |
| --- | --- |
| `question` | Your question |
| `--show_process` | Show thinking process, tool calls, and results |
| `--stream` | Stream output in real-time (auto-enables `--show_process`) |
| `--force_tool` | Force the LLM to call a tool before answering |
| `--list_tools` | List available tools and exit |

## Config

`config/config.json` is git-ignored. Copy from the example:

```bash
cp config/config_example.json config/config.json
```

| Field | Description | Example |
| --- | --- | --- |
| `api_key` | Your API key | `sk-xxx` |
| `base_url` | API endpoint | `https://api.deepseek.com` |
| `model` | Model name | `deepseek-v4-flash` |

Only needed for Tool Calling mode. MCP mode does not need a config file.

## MCP Mode

Registers tools as MCP servers. No API key needed — MCP clients manage LLM access themselves.

`.mcp.json` is ready to use out of the box. Connect via any MCP-compatible client (Claude Desktop, Claude Code, etc.).

| Server | Tools | Description |
| --- | --- | --- |
| `run-code` | `run_python`, `run_r`, `run_shell` | Execute code in sandboxed runtimes |
| `get-env-info` | `get_system_info`, `get_cpu_info`, `get_memory_info`, `get_disk_info`, `get_gpu_info`, `get_runtime_info` | Fetch host environment info |

## Adding Tools

1. Create `tools/my_tool.ts`
2. Import `registerTool` from `./lib/registry.js` and call it with your tool definition
3. Add `import "./my_tool.js";` to `tools/index.ts`

See [tools/TOOL_GUIDE.md](tools/TOOL_GUIDE.md) for details.

## Build

```bash
npm run build   # compile to dist/
npm run start   # run compiled version
npm run dev     # watch mode with tsx
```

## Project Structure

```text
AI-tool-calling/
├── index.ts                        CLI entry point
├── lib/
│   └── agent.ts                    LLM agent
├── tools/
│   ├── index.ts                    barrel exports
│   ├── get_*_info.ts               environment tools
│   ├── run_*.ts                    code execution tools
│   └── lib/
│       ├── registry.ts             tool registration
│       ├── types.ts                shared types
│       ├── errors.ts               SandboxError class
│       └── env_helpers.ts          hardware queries + runtime detection
├── servers/
│   ├── get_env_info_server.ts      MCP server for env tools
│   └── run_code_server.ts          MCP server for code tools
├── tests/
│   ├── test_naming_convention.ts   file naming checks
│   ├── test_direct_tools.ts        tool handler tests
│   ├── test_mcp_servers.ts         MCP protocol tests
│   ├── TEST_GUIDE.md               testing documentation
│   └── tool_schema.json            naming convention schema
├── config/
│   ├── config.json                 (git-ignored)
│   └── config_example.json
├── AGENTS.md                       维护索引（仪表盘 + 文档地图）
├── docs/
│   └── ARCHITECTURE.md             架构说明
├── .agents/
│   └── notes/                      决策记录
├── package.json
└── tsconfig.json
```

Maintainers: see [AGENTS.md](AGENTS.md) for rules, verification snapshot, and the doc map.
