# Testing Guide

本项目没有使用测试框架（jest/vitest），所有测试都是独立的 TypeScript 脚本，用 `npx tsx` 直接运行。

## 测试文件一览

| 文件 | 测试什么 | 怎么运行 |
|---|---|---|
| `test_naming_convention.ts` | 文件命名规范 | `npx tsx tests/test_naming_convention.ts` |
| `test_direct_tools.ts` | 直接调用工具 handler | `npx tsx tests/test_direct_tools.ts` |
| `test_mcp_servers.ts` | MCP 服务器协议 | `npx tsx tests/test_mcp_servers.ts` |

运行全部测试：

```bash
npx tsx tests/test_naming_convention.ts
npx tsx tests/test_direct_tools.ts
npx tsx tests/test_mcp_servers.ts
```

## 测试策略

项目有三层，每层有对应的测试：

### 第一层：命名规范（test_naming_convention.ts）

**目的**：确保文件结构符合 `tool_schema.json` 定义的命名规则。

**检查内容**：
- 每个 server 文件存在，且 `new McpServer({ name: "..." })` 声明的名称匹配 `{verb}-{noun}` 格式
- 每个 tool 文件存在，且 `registerTool({ name: "..." })` 声明的名称匹配 `{verb}_{noun}` 格式
- `.mcp.json` 中注册的服务器路径与实际文件对应

**原理**：用正则从源码中提取声明的名称，和 `tool_schema.json` 的期望值对比。不是运行时测试，是静态检查。

### 第二层：直接工具调用（test_direct_tools.ts）

**目的**：验证每个工具的 handler 函数能正确执行并返回预期结果。

**测试方式**：
1. 导入 `getAllTools()` 获取注册表
2. 对每个工具调用 `tool.handler(args)`
3. 检查返回值

**覆盖的场景**：
- 无参数工具（`get_system_info` 等）— 验证返回非空
- `run_python` — 表达式求值（`math.pi`）、多行代码（列表推导式）、错误处理（`1/0`）
- `run_r` — 基本运算（`1+1`）
- `run_shell` — 正常命令（`Get-Date`）、危险命令拦截（`shutdown`）
- `get_runtime_info` — 缓存机制

**和 LLM 调用的区别**：这里不经过 LLM，直接调用工具函数，排除了 LLM 理解/路由的变量。

### 第三层：MCP 协议测试（test_mcp_servers.ts）

**目的**：验证 MCP 服务器能正确响应 JSON-RPC 协议消息。

**测试方式**：
1. 用 `child_process.spawn` 启动 MCP 服务器进程
2. 通过 stdin 发送 JSON-RPC 消息（initialize → tools/list → tools/call）
3. 从 stdout 读取响应并解析
4. 验证返回的工具列表和调用结果

**覆盖的场景**：
- `initialize` 握手
- `tools/list` 返回正确的工具数量和名称
- `tools/call` 执行工具并返回结果

**为什么不用 MCP 客户端 SDK**：为了测试的独立性。直接用原始 JSON-RPC 消息，不依赖额外的客户端库。

## 测试思路

### 从外到内，逐层验证

```
MCP 协议（最外层）
  ↓ 服务器能启动、能响应协议
直接工具调用（中间层）
  ↓ 工具函数能执行、能返回结果
命名规范（最内层）
  ↓ 文件结构正确、名称匹配
```

先跑命名规范（最快的静态检查），再跑直接调用（需要执行子进程），最后跑 MCP（需要启动服务器进程）。如果内层就挂了，外层不用跑。

### 不测 LLM 调用

LLM 调用（`npx tsx index.ts "问题"`）不放在自动化测试里，因为：
- 需要 API 密钥
- LLM 返回不确定（每次不同）
- 耗时长

LLM 调用手动测试：`npx tsx index.ts --show_process "问题"`。

### 错误场景也要测

`test_direct_tools.ts` 包含错误场景：
- `run_python("1/0")` — 验证 Python 异常被捕获
- `run_shell("shutdown /s")` — 验证危险命令被拦截

这些确保工具不会因为异常输入而崩溃。
