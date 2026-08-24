# tools/ — 规则层

继承根规则，见 [../AGENTS.md](../AGENTS.md)。

tools/ 特有约束：
- 每个工具一个文件 `tools/{name}.ts`，模块级调用 `registerTool()` 注册
- 新工具必须三处落点：建文件、在 [index.ts](index.ts) 加 barrel import、登记 [tool_schema.json](../tests/tool_schema.json)
- 工具名 snake_case 且动词开头（get_* / run_*），与 [TOOL_GUIDE.md](TOOL_GUIDE.md) 一致
- handler 必返回 string；参数 schema 用 zod
- 工具间不得互相 import 业务逻辑，共享代码下沉到 [lib/](lib/)