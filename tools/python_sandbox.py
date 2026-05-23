"""Python sandbox — run any Python code."""

import subprocess
import sys
import tempfile
import os
from tools import tool

MAX_RESULT_LEN = 2000

# Wrapper that captures `result` variable
_WRAPPER = """\
import sys
_result = None
try:
    exec(compile({code!r}, '<sandbox>', 'exec'))
    _locals = locals()
    if 'result' in _locals:
        print('RESULT:', _locals['result'])
except Exception as e:
    print('ERROR:', e, file=sys.stderr)
"""


def _truncate(s: str) -> str:
    return s if len(s) <= MAX_RESULT_LEN else s[:MAX_RESULT_LEN] + "... (truncated)"


@tool(
    name="python",
    description=(
        "Run Python code. Use for ANY computation, data processing, algorithm, or task. "
        "Full Python access — import any installed package (numpy, pandas, requests, etc.). "
        "For multi-line code, assign final answer to `result`. Timeout: 10 seconds."
    ),
    parameters={
        "type": "object",
        "properties": {
            "expression": {
                "type": "string",
                "description": (
                    "Python code. Single expression returns directly. "
                    "Multi-line code: use print() for output. "
                    "You can import any installed package. If import fails, the user will install it.\n"
                    "OUTPUT RULES — result is read by an LLM, not a human:\n"
                    "- Use print() for all output, one value per line or key: value\n"
                    "- NEVER add headers, titles, labels, explanations, or decorative text\n"
                    "- Raw data only, no markdown, no table formatting\n"
                    "- If user asks for ONE answer, output ONE value, not multiple options\n"
                    "BAD:  print('文件列表：') then print(...)\n"
                    "BAD:  print(f'如果从第0项，F(30)={a}，如果从第1项，F(29)={b}')\n"
                    "GOOD: print(f'{a}') or print(f'{k}: {v}')"
                ),
            }
        },
        "required": ["expression"],
    },
)
def python(expression: str) -> str:
    # Try eval first (single expression)
    try:
        code = f"print(eval({expression!r}))"
        proc = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if proc.returncode == 0 and proc.stdout.strip():
            return _truncate(proc.stdout.strip())
    except (SyntaxError, subprocess.TimeoutExpired):
        pass

    # Multi-line code
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".py", delete=False, encoding="utf-8"
    ) as f:
        f.write(_WRAPPER.format(code=expression))
        tmp_path = f.name

    try:
        proc = subprocess.run(
            [sys.executable, tmp_path],
            capture_output=True,
            text=True,
            timeout=10,
        )
        stdout = proc.stdout.strip()
        stderr = proc.stderr.strip()

        if "RESULT:" in stdout:
            return _truncate(stdout.split("RESULT:", 1)[1].strip())
        elif stderr:
            return stderr.replace("ERROR: ", "")
        elif stdout:
            return _truncate(stdout)
        else:
            return "(no output)"
    except subprocess.TimeoutExpired:
        return "timeout (10s)"
    finally:
        os.unlink(tmp_path)
