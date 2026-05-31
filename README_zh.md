# AI-tool-calling

[English](README.md) | [简体中文](README_zh.md)

极简工具调用框架。Tool Calling + MCP 双模式运行。

| 模式 | 配置 | 作用 |
| --- | --- | --- |
| **Tool Calling** | `config/config.json` | 加载 `tools/` 下的工具，直接喂给 LLM |
| **MCP** | `.mcp.json` | 把同样工具包装成 MCP Server，给 agent 用 |

`config/config.json` 被 `.gitignore` 忽略，需从 `config/config_example.json` 复制后填写 API 密钥。

---

## Tool Calling

直接调 LLM API（兼容 OpenAI 格式）。需要 API 密钥。

### 配置

```bash
# 1. 复制示例配置文件
cp config/config_example.json config/config.json

# 2. 编辑 config/config.json — 填入你的 API 密钥和地址
```

| 字段 | 说明 | 示例 |
| --- | --- | --- |
| `api_key` | API 密钥 | `sk-xxx` |
| `base_url` | API 地址 | `https://api.deepseek.com` |
| `model` | 模型名称 | `deepseek-v4-flash` |

### 使用

```bash
python tool_call.py "当前目录有哪些文件"              # 只看最终答案（默认）
python tool_call.py --show_process "你的问题"         # 显示思考 + 调用了什么工具 + 返回了什么
python tool_call.py --stream "斐波那契第30项"        # 流式实时输出
python tool_call.py --list_tools                     # 列出所有工具
```

| 参数 | 说明 |
| --- | --- |
| `question` | 你的问题 |
| `--show_process` | 显示思考过程、调用了哪个工具、以及返回结果 |
| `--stream` | 流式实时输出（自动启用 `--show_process`） |
| `--force_tool` | 强制 LLM 调用工具后再回答 |
| `--list_tools` | 列出可用工具并退出 |

---

## MCP 模式

把工具注册为 MCP 服务器。不需要 API 密钥——MCP 客户端自己管理 LLM。

### 配置步骤

无需额外配置——`.mcp.json` 开箱即用。

### 注册的服务器

| Server | 工具 | 说明 |
| --- | --- | --- |
| `run-code` | `run_python`, `run_r`, `run_shell` | 沙箱执行代码 |
| `get-env-info` | `get_system_info`, `get_cpu_info`, `get_memory_info`, `get_disk_info`, `get_gpu_info`, `get_runtime_info` | 获取主机环境信息（系统、CPU、内存、磁盘、GPU、运行时） |

可在任意 MCP 兼容客户端中使用（Claude Desktop、Claude Code 等）。

## 添加工具

在 `tools/` 下新建 `.py`，用 `@tool` 装饰器定义即可，启动时自动发现。工具描述会引导 LLM 的工作流和输出格式。

## 项目结构

```text
AI-tool-calling/
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
