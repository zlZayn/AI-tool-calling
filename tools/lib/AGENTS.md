# tools/lib/ — 规则层

继承根规则，见 [../../AGENTS.md](../../AGENTS.md)。

tools/lib/ 特有约束：
- 只放被多个工具共享的基础设施，不放单个工具业务逻辑
- registry.ts 是唯一注册入口，业务代码不得直接改 registry Map
- 改 types.ts 的 Tool 接口是契约变更：必须同步 tools/*.ts、[lib/agent.ts](../../lib/agent.ts)、servers/* 并跑 `npx tsc --noEmit`