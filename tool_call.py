"""CLI interface for tool calling agent.

Usage:
    python tool_call.py "your question"                  # answer only (default)
    python tool_call.py --show_process "your question"   # show thinking + tools
    python tool_call.py --stream "your question"         # real-time streaming
    python tool_call.py --force_tool "your question"     # force tool usage
    python tool_call.py --list_tools                     # list tools
"""

import argparse
import sys

from lib.agent import Agent


def list_tools() -> None:
    agent = Agent()
    for name, tool in agent.tools.items():
        print(f"{name}: {tool.description}")


def ask(
    question: str,
    *,
    show_process: bool,
    stream: bool,
    force_tool: bool,
) -> None:
    agent = Agent()
    try:
        answer = agent.chat(
            question,
            verbose=show_process,
            stream=stream,
            force_tool=force_tool,
        )
        if not show_process:
            print(answer)
    except Exception as e:
        print(f"[error] {e}", file=sys.stderr)
        sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Tool calling agent — ask questions, run code, get answers."
    )
    parser.add_argument("question", nargs="?", help="question to ask")
    parser.add_argument(
        "--show_process",
        action="store_true",
        help="show thinking, tool calls, and answer in real-time",
    )
    parser.add_argument(
        "--stream",
        action="store_true",
        help="stream output chunk by chunk (only effective with --show_process)",
    )
    parser.add_argument(
        "--force_tool",
        action="store_true",
        help="force the LLM to use a tool",
    )
    parser.add_argument(
        "--list_tools",
        action="store_true",
        help="list available tools and exit",
    )

    args = parser.parse_args()

    if args.list_tools:
        list_tools()
        return

    if not args.question:
        parser.error("question is required (unless using --list_tools)")

    ask(
        args.question,
        show_process=args.show_process or args.stream,
        stream=args.stream,
        force_tool=args.force_tool,
    )


if __name__ == "__main__":
    main()
