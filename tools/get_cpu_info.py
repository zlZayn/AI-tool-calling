"""CPU information tool."""

from tools import tool
from tools._env_helpers import fmt


@tool(
    name="get_cpu_info",
    description=(
        "Return CPU information: processor model, physical cores, logical cores."
    ),
    parameters={"type": "object", "properties": {}, "required": []},
)
def get_cpu_info() -> str:
    return fmt("cpu")
