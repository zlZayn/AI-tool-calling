/**
 * MCP server integration test.
 *
 * Spawns each MCP server as a child process, sends JSON-RPC messages
 * over stdin, and validates the responses.
 */

import { spawn, type ChildProcess } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

interface McpResponse {
  jsonrpc: string;
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

function sendMcp(
  proc: ChildProcess,
  method: string,
  params: Record<string, unknown> = {},
  id: number = 1
): Promise<McpResponse> {
  return new Promise((resolve, reject) => {
    const msg = JSON.stringify({ jsonrpc: "2.0", id, method, params });
    let buffer = "";

    const timeout = setTimeout(() => {
      reject(new Error(`Timeout waiting for response to ${method}`));
    }, 30_000);

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString();
      // MCP uses newline-delimited JSON
      const lines = buffer.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed) as McpResponse;
          if (parsed.id === id) {
            clearTimeout(timeout);
            proc.stdout?.off("data", onData);
            resolve(parsed);
            return;
          }
        } catch {
          // not valid JSON yet, keep buffering
        }
      }
    };

    proc.stdout?.on("data", onData);
    proc.stdin?.write(msg + "\n");
  });
}

async function testServer(
  name: string,
  scriptPath: string,
  expectedTools: string[]
): Promise<boolean> {
  console.log(`\n=== Testing MCP server: ${name} ===`);
  let passed = true;

  const proc = spawn("npx", ["tsx", scriptPath], {
    cwd: ROOT,
    stdio: ["pipe", "pipe", "pipe"],
    shell: true,
  });

  // Capture stderr for debugging
  let stderr = "";
  proc.stderr?.on("data", (d: Buffer) => {
    stderr += d.toString();
  });

  try {
    // 1. Initialize
    console.log("  [1] Sending initialize...");
    const initResp = await sendMcp(proc, "initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test-client", version: "1.0.0" },
    });
    if (initResp.error) {
      console.log(`  [FAIL] initialize: ${initResp.error.message}`);
      passed = false;
    } else {
      console.log("  [OK] initialize succeeded");
    }

    // 2. Send initialized notification
    proc.stdin?.write(
      JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n"
    );

    // 3. List tools
    console.log("  [2] Sending tools/list...");
    const listResp = await sendMcp(proc, "tools/list", {}, 2);
    if (listResp.error) {
      console.log(`  [FAIL] tools/list: ${listResp.error.message}`);
      passed = false;
    } else {
      const tools = (listResp.result as { tools: Array<{ name: string }> })?.tools || [];
      const names = tools.map((t) => t.name);
      console.log(`  [OK] tools/list returned ${tools.length} tools: ${names.join(", ")}`);

      // Check expected tools
      for (const expected of expectedTools) {
        if (names.includes(expected)) {
          console.log(`  [OK] ${expected} found`);
        } else {
          console.log(`  [FAIL] ${expected} missing`);
          passed = false;
        }
      }
    }

    // 4. Call one tool (pick the first one)
    if (expectedTools.length > 0) {
      const toolName = expectedTools[0];
      const args: Record<string, unknown> = {};
      if (toolName === "run_python") args.expression = "print(2 + 2)";
      else if (toolName === "run_shell") args.command = "Write-Output hello";

      console.log(`  [3] Calling tool: ${toolName}(${JSON.stringify(args)})...`);
      const callResp = await sendMcp(
        proc,
        "tools/call",
        { name: toolName, arguments: args },
        3
      );
      if (callResp.error) {
        console.log(`  [FAIL] tools/call: ${callResp.error.message}`);
        passed = false;
      } else {
        const content = (callResp.result as { content: Array<{ text: string }> })?.content;
        const text = content?.[0]?.text || "(empty)";
        console.log(`  [OK] tools/call result: ${text.slice(0, 100)}`);
      }
    }
  } catch (e) {
    console.log(`  [FAIL] ${e}`);
    passed = false;
  } finally {
    proc.kill("SIGTERM");
    // Give it a moment to clean up
    await new Promise((r) => setTimeout(r, 500));
    if (stderr) {
      console.log(`  [stderr] ${stderr.slice(0, 200)}`);
    }
  }

  return passed;
}

async function main(): Promise<void> {
  const results: Record<string, boolean> = {};

  results["get-env-info"] = await testServer(
    "get-env-info",
    "servers/get_env_info_server.ts",
    [
      "get_system_info",
      "get_cpu_info",
      "get_memory_info",
      "get_disk_info",
      "get_gpu_info",
      "get_runtime_info",
    ]
  );

  results["run-code"] = await testServer(
    "run-code",
    "servers/run_code_server.ts",
    ["run_python", "run_r", "run_shell"]
  );

  console.log("\n=== Summary ===");
  for (const [name, ok] of Object.entries(results)) {
    console.log(`  ${ok ? "[OK]" : "[FAIL]"} ${name}`);
  }

  const allPassed = Object.values(results).every(Boolean);
  process.exit(allPassed ? 0 : 1);
}

main();
