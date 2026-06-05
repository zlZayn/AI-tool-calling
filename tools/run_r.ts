/** R sandbox — run any R code. */

import { writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { z } from "zod";
import { registerTool } from "./lib/registry.js";
import { spawnProcess, truncate } from "./lib/env_helpers.js";
import { SandboxError } from "./lib/errors.js";

const TIMEOUT = 30_000;

function cleanROutput(s: string): string {
  const lines = s.split("\n");
  const cleaned = lines.filter((line) => {
    const trimmed = line.trim();
    return (
      !trimmed.startsWith("null device") &&
      trimmed !== "[1] 1" &&
      trimmed !== "1"
    );
  });
  return cleaned.join("\n").trim();
}

async function runViaFile(expression: string): Promise<string> {
  const tmpPath = join(tmpdir(), `rsandbox_${Date.now()}.R`);
  await writeFile(tmpPath, expression, "utf-8");

  try {
    const result = await spawnProcess("Rscript", [tmpPath], TIMEOUT);
    if (result.timedOut) throw SandboxError.timeout();

    const stdout = cleanROutput(result.stdout);
    const stderr = result.stderr.trim();

    if (result.exitCode !== 0 && !stdout && !stderr) {
      throw SandboxError.notFound("Rscript");
    }
    if (stderr.toLowerCase().includes("not recognized") || stderr.toLowerCase().includes("not found")) {
      throw SandboxError.notFound("Rscript");
    }
    if (result.exitCode < 0) {
      throw SandboxError.crash(-result.exitCode);
    }
    if (stderr && stderr.toUpperCase().includes("ERROR")) {
      const err = stderr.split("Error").pop()?.trim().replace(/^:\s*/, "") || stderr;
      throw SandboxError.executionError(`Error: ${err}`);
    }
    if (stdout) return truncate(stdout);
    return "(no output)";
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
}

async function runR(expression: string): Promise<string> {
  // Multi-line code: skip Rscript -e, use temp file directly
  if (expression.includes("\n")) {
    return runViaFile(expression);
  }

  // Single expression: try Rscript -e first
  try {
    const result = await spawnProcess("Rscript", ["-e", expression], TIMEOUT);
    let stdout = cleanROutput(result.stdout);
    const stderr = result.stderr.trim();

    if (result.exitCode === 0 && stdout) {
      if (stdout.startsWith("[1] ")) stdout = stdout.slice(4);
      return truncate(stdout);
    }
    if (stderr && stderr.toUpperCase().includes("ERROR")) {
      // fall through to temp file
    } else if (stdout) {
      return truncate(stdout);
    }
  } catch {
    // fall through
  }

  return runViaFile(expression);
}

const DESCRIPTION =
  "Run R code. Use for ANY computation, data analysis, or statistical task. " +
  "Full R access — import any library (tidyverse, survival, lme4, caret, etc.). " +
  "For multi-line code, use print() or cat() for output. Timeout: 30 seconds.\n" +
  "PITFALLS:\n" +
  "- Always wrap library() with suppressPackageStartupMessages() to avoid stderr triggering false errors.\n" +
  "  GOOD: suppressPackageStartupMessages(library(tidyverse))\n" +
  "  BAD:  library(tidyverse) // startup messages to stderr → treated as error, stdout lost\n" +
  "- Each call is an isolated R session. Variables do not persist across calls.\n" +
  "- Timeout is 30 seconds. Long-running code will be killed with no partial output.\n" +
  "- Plots are not returned. Use png()/dev.off() to save to file if needed.";

const EXPRESSION_DESC =
  "R code. Single expression returns directly. " +
  "Multi-line code: use print() or cat() for output. " +
  "Assignment (x <- ...) does NOT print — wrap with print() to see result.\n" +
  "Use cat() for raw values, print() for structured objects (data frames, models, etc.).\n" +
  "GOOD: cat(result) / print(coef(model)) / summary(m)\n" +
  "BAD:  cat('结果如下：\\n') / print('图片已保存为 xxx')";

registerTool({
  name: "run_r",
  description: DESCRIPTION,
  parameters: {
    expression: z.string().describe(EXPRESSION_DESC),
  },
  handler: async (args) => {
    try {
      return await runR(args.expression as string);
    } catch (e) {
      if (e instanceof SandboxError) return e.message;
      throw e;
    }
  },
});
