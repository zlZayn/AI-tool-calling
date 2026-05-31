# AI-tool-calling

极简工具调用框架。CLI + MCP 双模式运行。

## 快速开始

```bash
pip install -r requirements.txt
cp config_example.json config.json
python tool_call.py "创建一个正态分布序列，CSV 格式"
```

## 配置

编辑 `config.json`：

| 字段 | 说明 |
| --- | --- |
| `api_key` | API 密钥 |
| `base_url` | API 地址 |
| `model` | 模型名称 |

## CLI 模式

```bash
python tool_call.py "当前目录有哪些文件"
python tool_call.py --stream "斐波那契第30项"
```

| 参数 | 说明 |
| --- | --- |
| `question` | 你的问题 |
| `--show_process` | 显示思考过程、工具调用和回答 |
| `--stream` | 流式实时输出（自动启用 `--show_process`） |
| `--force_tool` | 强制 LLM 调用工具后再回答 |
| `--list_tools` | 列出可用工具并退出 |

## MCP 模式

注册了两个 MCP server（配置在 `.mcp.json`）：

| Server | 工具 | 说明 |
| --- | --- | --- |
| `run-code` | `run_python`, `run_r`, `run_shell` | 沙箱执行代码 |
| `get-system-info` | `get_host_info` | 获取主机信息（系统、处理器、内存等） |

可在任意 MCP 兼容客户端中使用（Claude Desktop、Claude Code 等）。

## 添加工具

在 `tools/` 下新建 `.py`，用 `@tool` 装饰器定义即可，启动时自动发现。工具描述会引导 LLM 的工作流和输出格式。

## 项目结构

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
