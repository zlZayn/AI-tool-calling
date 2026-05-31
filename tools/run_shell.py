"""Shell sandbox — run commands via PowerShell."""

import subprocess
from tools import tool

MAX_RESULT_LEN = 2000

# Dangerous patterns to block
_BLOCKED = [
    "Remove-Item -Recurse -Force C:\\",
    "format ",
    "shutdown",
    "Restart-Computer",
    "Stop-Computer",
    "Remove-Item -Recurse -Force $env:",
    "Invoke-Expression",  # prevents indirect command injection
    "iex ",
]


def _truncate(s: str) -> str:
    return s if len(s) <= MAX_RESULT_LEN else s[:MAX_RESULT_LEN] + "... (truncated)"


@tool(
    name="run_shell",
    description=(
        "Run shell commands via PowerShell. Use for file operations, system info, "
        "process management, or any CLI task. Timeout: 10 seconds.\n"
        "Use PowerShell native syntax (Get-ChildItem, not ls). "
        "Keep commands simple — max 2 pipe stages. "
        "No interactive commands (vim, nano, pause). "
        "No destructive operations on system files."
    ),
    parameters={
        "type": "object",
        "properties": {
            "command": {
                "type": "string",
                "description": (
                    "PowerShell command. Native syntax, simple and focused.\n"
                    "GOOD: Get-ChildItem, Get-Content file.txt, Get-Process\n"
                    "BAD:  ls | grep | awk | sort | head (bash-style)\n"
                    "BAD:  complex pipelines with 3+ stages"
                ),
            }
        },
        "required": ["command"],
    },
)
def run_shell(command: str) -> str:
    # Basic safety check
    cmd_lower = command.lower()
    for blocked in _BLOCKED:
        if blocked.lower() in cmd_lower:
            return f"Error: blocked dangerous command pattern: {blocked}"

    try:
        proc = subprocess.run(
            ["pwsh", "-NoProfile", "-Command", command],
            capture_output=True,
            text=True,
            timeout=10,
            encoding="utf-8",
            errors="replace",
        )
        stdout = proc.stdout.strip()
        stderr = proc.stderr.strip()

        if proc.returncode != 0 and stderr:
            return f"Error: {stderr}"
        if stdout:
            return _truncate(stdout)
        if stderr:
            return _truncate(stderr)
        return "(no output)"
    except subprocess.TimeoutExpired:
        return "timeout (10s)"
    except FileNotFoundError:
        return "Error: PowerShell not found"
