"""Installed runtimes & dev tools detection tool.

Results are cached after the first call since installed tooling rarely
changes mid-session.  Use get_runtime_info(force_refresh=True) to
re-scan.
"""

from tools import tool
from tools._env_helpers import fmt

_CACHE: str | None = None


@tool(
    name="get_runtime_info",
    description=(
        "Detect installed runtimes and dev tools by scanning PATH: "
        "languages, package managers, databases, cloud CLIs, etc.  "
        "Results are cached after the first call for speed; pass "
        "force_refresh=True to re-scan."
    ),
    parameters={
        "type": "object",
        "properties": {
            "force_refresh": {
                "type": "boolean",
                "description": "Re-scan instead of using cached results",
                "default": False,
            }
        },
        "required": [],
    },
)
def get_runtime_info(force_refresh: bool = False) -> str:
    global _CACHE
    if _CACHE is None or force_refresh:
        _CACHE = fmt("runtimes")
    return _CACHE
