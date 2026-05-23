# AI-tool-calling

[English](README.md) | [简体中文](README_zh.md)

极简工具调用框架。通过 OpenAI 兼容 API 让 LLM 调用本地工具。

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

## CLI

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

## 添加工具

在 `tools/` 下新建 `.py`，用 `@tool` 定义即可，重启自动发现。工具描述会引导 LLM 的工作流和输出格式。

## 结构

```text
lib/
  __init__.py         包初始化
  agent.py            Agent 类
tools/
  __init__.py         工具注册与自动发现
  python_sandbox.py   Python 代码执行
  r_sandbox.py        R 代码执行
  shell_sandbox.py    Shell 命令执行
tool_call.py          CLI 接口
config_example.json   API 配置模板
requirements.txt
```
