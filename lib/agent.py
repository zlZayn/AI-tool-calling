"""Agent — LLM with tool calling capability."""

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
    def __init__(self, config: str = "config/config.json"):
        cfg_path = os.path.join(os.path.dirname(__file__), "..", config)
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

    def chat(
        self,
        user_message: str,
        *,
        verbose: bool = False,
        stream: bool = False,
        force_tool: bool = False,
    ) -> str:
        """Send a message and return the answer.

        Args:
            user_message: The user's question or prompt.
            verbose: Print thinking/tool/answer to stdout.
            stream: Print chunks in real-time (only effective when verbose=True).
            force_tool: Force the LLM to use a tool.

        Returns:
            The final answer string.
        """
        self.messages.append({"role": "user", "content": user_message})
        tool_choice = "required" if force_tool else "auto"

        while True:
            api_stream = self.client.chat.completions.create(
                model=self.model,
                messages=self._compact(self.messages),
                tools=self.schemas or None,
                tool_choice=tool_choice,
                stream=True,
            )

            content = ""
            reasoning = ""
            content_started = False
            tool_calls: dict[int, dict] = {}  # index -> {id, name, arguments}
            live = verbose and stream  # print chunks in real-time

            for chunk in api_stream:
                if not chunk.choices:
                    continue
                delta = chunk.choices[0].delta

                # Reasoning (thinking)
                rc = getattr(delta, "reasoning_content", None)
                if rc:
                    if live and not reasoning:
                        print("  [llm-thinking] ", end="", flush=True)
                    reasoning += rc
                    if live:
                        print(rc, end="", flush=True)

                # Content
                if delta.content:
                    content += delta.content
                    if live and not content_started:
                        print("[llm-answer] ", end="", flush=True)
                        content_started = True
                    if live:
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

            # Non-streaming verbose: print accumulated output at once
            if verbose and not stream:
                if reasoning:
                    print(f"  [llm-thinking] {reasoning}")
                if content:
                    print(f"[llm-answer] {content}")

            # Streaming newline after thinking
            if live and reasoning:
                print()

            # No tool calls -> done
            if not tool_calls:
                if live and content:
                    print()
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
                if verbose:
                    print(f"  [tool-call] {fn_name}({fn_args})")
                result = self.tools[fn_name](**json.loads(fn_args))
                if verbose:
                    print(f"  [tool-result] {result}")
                self.messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tc["id"],
                        "name": fn_name,
                        "content": result,
                    }
                )
