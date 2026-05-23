# AI-tool-calling

[English](README.md) | [简体中文](README_zh.md)

Minimal tool calling framework. LLM + local tools via OpenAI-compatible API.

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

## CLI

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

## Adding Tools

Drop a `.py` in `tools/` with `@tool` — auto-discovered on restart. Tool descriptions guide the LLM's workflow and output format.

## Structure

```text
lib/
  __init__.py         Package init
  agent.py            Agent class
tools/
  __init__.py         Tool registry and auto-discovery
  python_sandbox.py   Python code execution
  r_sandbox.py        R code execution
  shell_sandbox.py    Shell command execution
tool_call.py          CLI interface
config_example.json   API config template
requirements.txt
```
