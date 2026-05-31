"""Disk usage information tool."""

from tools import tool
from tools._env_helpers import fmt


@tool(
    name="get_disk_info",
    description=(
        "Return C: drive disk usage: total, used, free space and usage percentage."
    ),
    parameters={"type": "object", "properties": {}, "required": []},
)
def get_disk_info() -> str:
    return fmt("disk")
