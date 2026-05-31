/**
 * Direct tool invocation test.
 * Tests each tool by importing the registry and calling handlers directly.
 */

import { getAllTools } from "../tools/index.js";

const tools = getAllTools();
console.log(`=== Tool count: ${tools.size} ===\n`);

// --- No-parameter tools ---
const noParamTools = [
  "get_system_info",
  "get_cpu_info",
  "get_memory_info",
  "get_disk_info",
  "get_gpu_info",
];

for (const name of noParamTools) {
  const tool = tools.get(name);
  if (!tool) { console.log(`[MISSING] ${name}`); continue; }
  console.log(`--- ${name} ---`);
  const result = await tool.handler({});
  console.log(result);
  console.log();
}

// --- run_python ---
console.log("--- run_python (expression) ---");
const py = tools.get("run_python")!;
console.log(await py.handler({ expression: "import math; print(math.pi)" }));
console.log();

console.log("--- run_python (multi-line) ---");
console.log(await py.handler({
  expression: "x = [i**2 for i in range(5)]\nresult = x",
}));
console.log();

// --- run_shell ---
console.log("--- run_shell ---");
const sh = tools.get("run_shell")!;
console.log(await sh.handler({ command: "Get-Date -Format yyyy-MM-dd" }));
console.log();

// --- run_r (skip if R not installed) ---
const rTool = tools.get("run_r")!;
console.log("--- run_r ---");
const rResult = await rTool.handler({ expression: "print(1 + 1)" });
console.log(rResult);
console.log();

// --- get_runtime_info (first 5 lines) ---
console.log("--- get_runtime_info (first 5 lines) ---");
const rt = tools.get("get_runtime_info")!;
const rtResult = await rt.handler({ force_refresh: false });
console.log(rtResult.split("\n").slice(0, 5).join("\n") + "\n...");
console.log();

// --- Error handling ---
console.log("--- run_python (error) ---");
console.log(await py.handler({ expression: "1/0" }));
console.log();

console.log("--- run_shell (blocked) ---");
console.log(await sh.handler({ command: "shutdown /s" }));
console.log();

console.log("=== All direct tool tests done ===");
