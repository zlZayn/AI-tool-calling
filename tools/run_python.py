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
    name="run_python",
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
                    "The LLM already knows the context. It only needs raw data.\n"
                    "RULE: Output ONLY raw data. Everything else is noise.\n"
                    "Forbidden: headers, titles, labels, separators (---, ===), "
                    "alignment (f'{x:<30}'), counts, summaries, markdown, formatting, "
                    "table borders, column headers, decorative text, confirmations\n"
                    "If asked for ONE answer, output ONE value.\n"
                    "GOOD: print(f'{name}: {size}') or print(result)\n"
                    "BAD:  print(f\"{'name':<30}\") / print('---') / print('共 X 个')"
                ),
            }
        },
        "required": ["expression"],
    },
)
def run_python(expression: str) -> str:
    # Try eval first — handles bare expressions like `1+1`
    try:
        code = f"print(eval({expression!r}))"
        proc = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            timeout=10,
            encoding="utf-8",
            errors="replace",
        )
        if proc.returncode == 0:
            stdout = proc.stdout.strip()
            # Strip trailing "None" from eval(print(...)) pattern
            if stdout.endswith("\nNone"):
                stdout = stdout[:-5].strip()
            elif stdout == "None":
                stdout = ""
            if stdout:
                return _truncate(stdout)
    except (SyntaxError, subprocess.TimeoutExpired):
        pass

    # Fallback: exec wrapper (for statements, multi-line, etc.)
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
            encoding="utf-8",
            errors="replace",
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
