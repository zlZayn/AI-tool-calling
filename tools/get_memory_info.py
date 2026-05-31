"""Physical memory information tool."""

from tools import tool
from tools._env_helpers import fmt


@tool(
    name="get_memory_info",
    description=(
        "Return physical memory information: total, available, usage percentage."
    ),
    parameters={"type": "object", "properties": {}, "required": []},
)
def get_memory_info() -> str:
    return fmt("memory")
