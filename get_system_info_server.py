"""MCP server — expose system information tools.

Tools:
    get_host_info — basic host machine info (OS, processor, memory)
"""

import asyncio

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

from tools import load_all

server = Server("get-system-info")


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
        if t.name == "get_host_info"
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    tools = load_all()
    if name not in tools:
        return [TextContent(type="text", text=f"Error: unknown tool '{name}'")]
    try:
        result = tools[name](**arguments)
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
