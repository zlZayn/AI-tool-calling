/**
 * Tool registry — register, discover, and retrieve tools.
 *
 * This file is separate from index.ts to avoid circular dependencies.
 * Tool files import registerTool from here (not from index.ts).
 * index.ts re-exports everything and adds the barrel imports.
 */

import type { Tool, ZodRawShape } from "./types.js";

const registry = new Map<string, Tool>();

/** Register a tool. Called at module-load time by each tool file.
 *  唯一类型桥接点：泛型 Tool<S> 与存储用的宽 Tool 之间是函数参数逆变，
 *  TS 不接受隐式收窄；handler 的入参在调用前已由 MCP SDK 按 parameters 校验，
 *  故此处安全。 */
export function registerTool<S extends ZodRawShape>(tool: Tool<S>): void {
  registry.set(tool.name, tool as Tool);
}

/** Get all registered tools. */
export function getAllTools(): Map<string, Tool> {
  return new Map(registry);
}

/** Get a single tool by name. */
export function getTool(name: string): Tool | undefined {
  return registry.get(name);
}
