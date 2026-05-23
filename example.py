"""Tool Calling: Let AI call local functions"""

import json
import os
import sys
from openai import OpenAI

# Force fresh import (clears IPython/Python module cache)
for mod in list(sys.modules):
    if mod.startswith("tools"):
        del sys.modules[mod]

from tools import Tool, load_all  # noqa: E402

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


class Agent:
    def __init__(self, config: str = "config.json"):
        cfg_path = os.path.join(os.path.dirname(__file__), config)
        with open(cfg_path) as f:
            cfg = json.load(f)
        self.client = OpenAI(api_key=cfg["api_key"], base_url=cfg["base_url"])
        self.model = cfg["model"]
        self.tools: dict[str, Tool] = load_all()
        self.schemas = [t.schema for t in self.tools.values()]
        self.messages: list[dict] = []

    @staticmethod
    def _compact(messages: list[dict]) -> list[dict]:
        """Strip verbose assistant text, keep tool calls and results."""
        out = []
        for msg in messages:
            if msg.get("role") == "assistant" and msg.get("tool_calls"):
                out.append({**msg, "content": ""})
            else:
                out.append(msg)
        return out

    def chat(self, user_message: str) -> str:
        self.messages.append({"role": "user", "content": user_message})

        while True:
            stream = self.client.chat.completions.create(
                model=self.model,
                messages=self._compact(self.messages),
                tools=self.schemas or None,
                tool_choice="auto",
                stream=True,
            )

            content = ""
            reasoning = ""
            content_started = False
            tool_calls: dict[int, dict] = {}  # index -> {id, name, arguments}

            for chunk in stream:
                if not chunk.choices:
                    continue
                delta = chunk.choices[0].delta

                # Reasoning (thinking)
                rc = getattr(delta, "reasoning_content", None)
                if rc:
                    if not reasoning:
                        print("  [llm-thinking] ", end="", flush=True)
                    reasoning += rc
                    print(rc, end="", flush=True)

                # Content
                if delta.content:
                    content += delta.content
                    if not content_started:
                        print("[llm-answer] ", end="", flush=True)
                        content_started = True
                    print(delta.content, end="", flush=True)

                # Tool calls (accumulate chunks)
                if delta.tool_calls:
                    for tc_delta in delta.tool_calls:
                        idx = tc_delta.index
                        if idx not in tool_calls:
                            tool_calls[idx] = {"id": "", "name": "", "arguments": ""}
                        if tc_delta.id:
                            tool_calls[idx]["id"] = tc_delta.id
                        if tc_delta.function:
                            if tc_delta.function.name:
                                tool_calls[idx]["name"] = tc_delta.function.name
                            if tc_delta.function.arguments:
                                tool_calls[idx]["arguments"] += (
                                    tc_delta.function.arguments
                                )

            if reasoning:
                print()  # newline after thinking

            # No tool calls → done
            if not tool_calls:
                if content:
                    print()  # newline after content
                self.messages.append({"role": "assistant", "content": content})
                return content

            # Execute tool calls
            tc_list = [tool_calls[i] for i in sorted(tool_calls)]
            msg_dict = {
                "role": "assistant",
                "content": content,
                "tool_calls": [
                    {
                        "id": tc["id"],
                        "type": "function",
                        "function": {
                            "name": tc["name"],
                            "arguments": tc["arguments"],
                        },
                    }
                    for tc in tc_list
                ],
            }
            self.messages.append(msg_dict)
            for tc in tc_list:
                fn_name = tc["name"]
                fn_args = tc["arguments"]
                print(f"  [tool-calling] {fn_name}({fn_args})")
                result = self.tools[fn_name](**json.loads(fn_args))
                print(f"  [tool-result] {result}")
                self.messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tc["id"],
                        "name": fn_name,
                        "content": result,
                    }
                )


# ── Run ───────────────────────────────────────────────────

if __name__ == "__main__":
    agent = Agent()

    questions = [
        # Data processing with collections
        "统计这段英文里每个单词出现的次数，按频率从高到低排列：'the quick brown fox jumps over the lazy dog the fox'",
        # File system
        "当前目录下有哪些文件？列出文件名和大小。",
        # JSON processing
        '解析这个 JSON，找出所有价格大于 50 的商品名：[{"name":"apple","price":30},{"name":"banana","price":60},{"name":"cherry","price":80}]',
        # Algorithm with recursion
        "用递归算斐波那契数列第 30 项。",
    ]
    for q in questions:
        agent.messages.clear()
        print(f"\n[question] {q}")
        try:
            agent.chat(q)
        except Exception as e:
            print(f"[error] {e}")
