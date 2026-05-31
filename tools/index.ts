/**
 * Tool registry barrel file.
 *
 * Re-exports registry functions and triggers all tool registrations
 * via the imports below. This replaces Python's pkgutil.iter_modules().
 */

export { registerTool, getAllTools, getTool } from "./lib/registry.js";
export type { Tool } from "./lib/types.js";

// Barrel imports — each import triggers registerTool() at module level.
import "./get_system_info.js";
import "./get_cpu_info.js";
import "./get_memory_info.js";
import "./get_disk_info.js";
import "./get_gpu_info.js";
import "./get_runtime_info.js";
import "./run_python.js";
import "./run_r.js";
import "./run_shell.js";
