"""GPU adapter information tool."""

from tools import tool
from tools._env_helpers import fmt


@tool(
    name="get_gpu_info",
    description="Return GPU adapter information: detected graphics cards.",
    parameters={"type": "object", "properties": {}, "required": []},
)
def get_gpu_info() -> str:
    return fmt("gpu")
