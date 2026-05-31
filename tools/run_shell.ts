/** Shell sandbox — run commands via PowerShell. */

import { z } from "zod";
import { registerTool } from "./lib/registry.js";
import { spawnProcess, truncate } from "./lib/env_helpers.js";
import { SandboxError } from "./lib/errors.js";

const TIMEOUT = 10_000;

// Dangerous patterns to block (same as Python version)
const BLOCKED = [
  "Remove-Item -Recurse -Force C:\\",
  "format ",
  "shutdown",
  "Restart-Computer",
  "Stop-Computer",
  "Remove-Item -Recurse -Force $env:",
  "Invoke-Expression", // prevents indirect command injection
  "iex ",
];

async function runShell(command: string): Promise<string> {
  // Basic safety check
  const cmdLower = command.toLowerCase();
  for (const blocked of BLOCKED) {
    if (cmdLower.includes(blocked.toLowerCase())) {
      return `Error: blocked dangerous command pattern: ${blocked}`;
    }
  }

  // Force UTF-8 output encoding for pwsh to handle non-ASCII correctly
  const wrapped = "[Console]::OutputEncoding = [Text.Encoding]::UTF8; " + command;

  try {
    const result = await spawnProcess("pwsh", ["-NoProfile", "-Command", wrapped], TIMEOUT);
    if (result.timedOut) throw SandboxError.timeout();

    const stdout = result.stdout.trim();
    const stderr = result.stderr.trim();

    if (result.exitCode !== 0 && stderr) throw SandboxError.executionError(`Error: ${stderr}`);
    if (stdout) return truncate(stdout);
    if (stderr) return truncate(stderr);
    return "(no output)";
  } catch (e) {
    if (e instanceof SandboxError) throw e;
    throw SandboxError.notFound("PowerShell");
  }
}

const DESCRIPTION =
  "Run shell commands via PowerShell. Use for file operations, system info, " +
  "process management, or any CLI task. Timeout: 10 seconds.\n" +
  "Use PowerShell native syntax (Get-ChildItem, not ls). " +
  "Keep commands simple — max 2 pipe stages. " +
  "No interactive commands (vim, nano, pause). " +
  "No destructive operations on system files.";

const COMMAND_DESC =
  "PowerShell command. Native syntax, simple and focused.\n" +
  "GOOD: Get-ChildItem, Get-Content file.txt, Get-Process\n" +
  "BAD:  ls | grep | awk | sort | head (bash-style)\n" +
  "BAD:  complex pipelines with 3+ stages";

registerTool({
  name: "run_shell",
  description: DESCRIPTION,
  parameters: {
    command: z.string().describe(COMMAND_DESC),
  },
  handler: async (args) => {
    try {
      return await runShell(args.command as string);
    } catch (e) {
      if (e instanceof SandboxError) return e.message;
      throw e;
    }
  },
});
