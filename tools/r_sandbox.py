"""R sandbox — run any R code."""

import subprocess
import tempfile
import os
from tools import tool

MAX_RESULT_LEN = 2000

# Wrapper that captures `result` variable
_WRAPPER = """\
tryCatch({{
    {code}
}}, error = function(e) cat("ERROR:", conditionMessage(e), "\\n", file=stderr()))
"""


def _truncate(s: str) -> str:
    return s if len(s) <= MAX_RESULT_LEN else s[:MAX_RESULT_LEN] + "... (truncated)"


def _clean_r_output(s: str) -> str:
    """Remove dev.off() noise and R prompt artifacts."""
    lines = s.splitlines()
    cleaned = [
        line
        for line in lines
        if not line.strip().startswith("null device")
        and line.strip() != "[1] 1"
        and line.strip() != "1"
    ]
    return "\n".join(cleaned).strip()


@tool(
    name="r",
    description=(
        "Run R code. Use for statistical analysis, data visualization, or any R task. "
        "Full R access — library any installed package (tidyverse, tidymodels, survival, etc.). "
        "For multi-line code, use print() or cat() for output. Timeout: 10 seconds."
    ),
    parameters={
        "type": "object",
        "properties": {
            "expression": {
                "type": "string",
                "description": (
                    "R code. Single expression returns directly. "
                    "Multi-line code: use print() or cat() for output. "
                    "Assignment (x <- ...) does NOT print — wrap with print() to see result.\n"
                    "OUTPUT RULES — result is read by an LLM, not a human:\n"
                    "The LLM already knows the context. It only needs raw data.\n"
                    "RULE: Output ONLY raw data. Everything else is noise.\n"
                    "Forbidden: headers, titles, labels, separators, alignment, "
                    "counts, summaries, markdown, formatting, column headers, "
                    "decorative text, confirmations\n"
                    "For plots: use png()/dev.off() silently, do not print anything.\n"
                    "GOOD: cat(result) / print(coef(model))\n"
                    "BAD:  cat('结果如下：\\n') / print('图片已保存为 xxx')"
                ),
            }
        },
        "required": ["expression"],
    },
)
def r(expression: str) -> str:
    # Multi-line code: skip Rscript -e, use temp file directly
    # Rscript -e crashes on complex multi-line code (especially with non-ASCII chars)
    if "\n" in expression:
        return _run_via_file(expression)

    # Single expression: try Rscript -e first
    try:
        proc = subprocess.run(
            ["Rscript", "-e", expression],
            capture_output=True,
            text=True,
            timeout=10,
            encoding="utf-8",
            errors="replace",
        )
        stdout = _clean_r_output(proc.stdout)
        stderr = proc.stderr.strip()

        if proc.returncode == 0 and stdout:
            if stdout.startswith("[1] "):
                stdout = stdout[4:]
            return _truncate(stdout)
        elif stderr and "ERROR" in stderr:
            pass  # fall through to temp file
        elif stdout:
            return _truncate(stdout)
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass

    return _run_via_file(expression)


def _run_via_file(expression: str) -> str:
    """Run R code via temp file — handles multi-line and complex code."""
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".R", delete=False, encoding="utf-8"
    ) as f:
        f.write(expression)
        tmp_path = f.name

    try:
        proc = subprocess.run(
            ["Rscript", tmp_path],
            capture_output=True,
            text=True,
            timeout=10,
            encoding="utf-8",
            errors="replace",
        )
        stdout = _clean_r_output(proc.stdout)
        stderr = proc.stderr.strip()

        if proc.returncode < 0:
            # Killed by signal (e.g. segfault = -11)
            return f"Error: R process crashed (signal {-proc.returncode})"
        if stderr and "ERROR" in stderr:
            err = stderr.split("Error")[-1].strip().lstrip(": ")
            return f"Error: {err}"
        if stdout:
            return _truncate(stdout)
        return "(no output)"
    except subprocess.TimeoutExpired:
        return "timeout (10s)"
    except FileNotFoundError:
        return "Error: Rscript not found"
    finally:
        os.unlink(tmp_path)
