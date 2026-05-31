"""Host OS information tool."""

from tools import tool
from tools._env_helpers import fmt


@tool(
    name="get_system_info",
    description=(
        "Return host OS information: "
        "name, release, version, hostname, architecture, uptime."
    ),
    parameters={"type": "object", "properties": {}, "required": []},
)
def get_system_info() -> str:
    return fmt("system")
