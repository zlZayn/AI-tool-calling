"""Installed runtimes & dev tools detection tool."""

from tools import tool
from tools._env_helpers import fmt


@tool(
    name="get_runtime_info",
    description=(
        "Detect installed runtimes and dev tools by scanning PATH: "
        "languages, package managers, databases, cloud CLIs, etc."
    ),
    parameters={"type": "object", "properties": {}, "required": []},
)
def get_runtime_info() -> str:
    return fmt("runtimes")
