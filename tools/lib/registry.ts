/**
 * Tool registry — register, discover, and retrieve tools.
 *
 * This file is separate from index.ts to avoid circular dependencies.
 * Tool files import registerTool from here (not from index.ts).
 * index.ts re-exports everything and adds the barrel imports.
 */

import type { Tool } from "./types.js";

const registry = new Map<string, Tool>();

/** Register a tool. Called at module-load time by each tool file. */
export function registerTool(tool: Tool): void {
  registry.set(tool.name, tool);
}

/** Get all registered tools. */
export function getAllTools(): Map<string, Tool> {
  return new Map(registry);
}

/** Get a single tool by name. */
export function getTool(name: string): Tool | undefined {
  return registry.get(name);
}
