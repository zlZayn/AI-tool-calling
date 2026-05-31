/** Python sandbox — run any Python code. */

import { writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { z } from "zod";
import { registerTool } from "./lib/registry.js";
import { spawnProcess, truncate } from "./lib/env_helpers.js";
import { SandboxError } from "./lib/errors.js";

const TIMEOUT = 10_000;

// Wrapper that captures `result` variable (same as Python version)
const WRAPPER = `import sys
_result = None
try:
    exec(compile({code_repr}, '<sandbox>', 'exec'))
    _locals = locals()
    if 'result' in _locals:
        print('RESULT:', _locals['result'])
except Exception as e:
    print('ERROR:', e, file=sys.stderr)
`;

async function runPython(expression: string): Promise<string> {
  // Try eval first — handles bare expressions like `1+1`
  try {
    const code = `print(eval(${JSON.stringify(expression)}))`;
    const result = await spawnProcess("python", ["-c", code], TIMEOUT);
    if (result.exitCode === 0) {
      let stdout = result.stdout.trim();
      // Strip trailing "None" from eval(print(...)) pattern
      if (stdout.endsWith("\nNone")) stdout = stdout.slice(0, -5).trim();
      else if (stdout === "None") stdout = "";
      if (stdout) return truncate(stdout);
    }
  } catch {
    // fall through to exec
  }

  // Fallback: exec wrapper (for statements, multi-line, etc.)
  const tmpPath = join(tmpdir(), `sandbox_${Date.now()}.py`);
  const wrapperCode = WRAPPER.replace("{code_repr}", JSON.stringify(expression));
  await writeFile(tmpPath, wrapperCode, "utf-8");

  try {
    const result = await spawnProcess("python", [tmpPath], TIMEOUT);
    if (result.timedOut) throw SandboxError.timeout();

    const stdout = result.stdout.trim();
    const stderr = result.stderr.trim();

    if (result.exitCode !== 0 && !stdout && !stderr) {
      throw SandboxError.notFound("python");
    }
    if (stderr.toLowerCase().includes("not recognized") || stderr.toLowerCase().includes("not found")) {
      throw SandboxError.notFound("python");
    }

    if (stdout.includes("RESULT:")) {
      return truncate(stdout.split("RESULT:")[1].trim());
    }
    if (stderr) throw SandboxError.executionError(stderr.replace("ERROR: ", ""));
    if (stdout) return truncate(stdout);
    return "(no output)";
  } finally {
    await unlink(tmpPath).catch(() => { });
  }
}

const DESCRIPTION =
  "Run Python code. Use for ANY computation, data processing, algorithm, or task. " +
  "Full Python access — import any installed package (numpy, pandas, requests, etc.). " +
  "For multi-line code, assign final answer to `result`. Timeout: 10 seconds.";

const EXPRESSION_DESC =
  "Python code. Single expression returns directly. " +
  "Multi-line code: use print() for output. " +
  "You can import any installed package. If import fails, the user will install it.\n" +
  "OUTPUT RULES — result is read by an LLM, not a human:\n" +
  "The LLM already knows the context. It only needs raw data.\n" +
  "RULE: Output ONLY raw data. Everything else is noise.\n" +
  "Forbidden: headers, titles, labels, separators (---, ===), " +
  "alignment (f'{x:<30}'), counts, summaries, markdown, formatting, " +
  "table borders, column headers, decorative text, confirmations\n" +
  "If asked for ONE answer, output ONE value.\n" +
  "GOOD: print(f'{name}: {size}') or print(result)\n" +
  "BAD:  print(f\"{'name':<30}\") / print('---') / print('共 X 个')";

registerTool({
  name: "run_python",
  description: DESCRIPTION,
  parameters: {
    expression: z.string().describe(EXPRESSION_DESC),
  },
  handler: async (args) => {
    try {
      return await runPython(args.expression as string);
    } catch (e) {
      if (e instanceof SandboxError) return e.message;
      throw e;
    }
  },
});
