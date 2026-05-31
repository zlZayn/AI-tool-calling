"""MCP server — expose environment information tools.

Tools:
    get_system_info   — host OS info
    get_cpu_info      — processor / cores
    get_memory_info   — physical memory
    get_disk_info     — C: drive usage
    get_gpu_info      — GPU adapters
    get_runtime_info  — installed dev tools & runtimes
"""

import asyncio
import os
import sys

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

try:
    from tools import load_all
except ImportError:
    _proj_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    sys.path.insert(0, _proj_root)
    from tools import load_all

_ENV_TOOLS = frozenset(
    [
        "get_system_info",
        "get_cpu_info",
        "get_memory_info",
        "get_disk_info",
        "get_gpu_info",
        "get_runtime_info",
    ]
)

server = Server("get-env-info")


@server.list_tools()
async def list_tools() -> list[Tool]:
    tools = load_all()
    return [
        Tool(
            name=t.name,
            description=t.description,
            inputSchema=t.parameters,
        )
        for t in tools.values()
        if t.name in _ENV_TOOLS
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    """Execute a tool without blocking the event loop.

    Long-running synchronous tools (e.g. ``get_runtime_info`` which scans
    PATH for 150+ executables) are offloaded to a thread so the MCP
    server can keep processing messages.
    """
    tools = load_all()
    if name not in tools:
        return [TextContent(type="text", text=f"Error: unknown tool '{name}'")]
    try:
        result = await asyncio.to_thread(tools[name], **arguments)
        return [TextContent(type="text", text=result)]
    except Exception as e:
        return [TextContent(type="text", text=f"Error: {e}")]


async def main() -> None:
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options(),
        )


if __name__ == "__main__":
    asyncio.run(main())
