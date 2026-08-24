# servers/ — 规则层

继承根规则，见 [../AGENTS.md](../AGENTS.md)。

servers/ 特有约束：
- server 名用 kebab-case（`{verb}-{noun}`），文件用 snake_case（`{verb}_{noun}_server.ts`）
- 新增 server 必须同步注册到 [../.mcp.json](../.mcp.json)，否则客户端发现不到
- server 只做协议装配（注册工具、连 transport），业务逻辑放 tools/
- 每个 server 是独立进程，不得互相 import 或共享运行状态