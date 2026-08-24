# lib/ — 规则层

继承根规则，见 [../AGENTS.md](../AGENTS.md)。

lib/ 特有约束：
- 本目录是 LLM 会话层，改动必须跑 `npx tsc --noEmit` 确认契约未破坏
- 保持与 OpenAI chat.completions 兼容的消息格式，不自造协议
- 错误一律回填字符串交给上层，不向调用方抛未包装异常