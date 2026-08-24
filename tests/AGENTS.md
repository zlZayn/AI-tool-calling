# tests/ — 规则层

继承根规则，见 [../AGENTS.md](../AGENTS.md)。

tests/ 特有约束：
- 项目无测试框架，测试是 tsx 直跑脚本，加用例不改 package.json
- 新增/改名工具必须同步 test_naming_convention.ts 的检查对象或 [tool_schema.json](tool_schema.json)，否则命名测试报错
- 命名测试用正则扫描源码：改文件格式/声明写法会破坏它
- 不测 LLM 调用（需密钥、结果不确定、耗时长）
- 测试输出必须保持"最终 exit code 表达通过/失败"，不靠肉眼判断