/** Shared types for the tool registry. */

import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

/** Zod raw shape — the object passed to z.object(). MCP SDK expects this. */
export type ZodRawShape = Record<string, z.ZodTypeAny>;

/** A registered tool — name, description, schema, and handler.
 *  泛型 S 让 handler 的入参从 parameters 的 zod schema 推导（如 { expression: string }），
 *  改 schema 忘改 handler 会当场编译报错。 */
export interface Tool<S extends ZodRawShape = ZodRawShape> {
  /** Tool name, e.g. "run_python" */
  readonly name: string;
  /** Human-readable description for the LLM */
  readonly description: string;
  /** Zod raw shape for MCP SDK validation (e.g. { expression: z.string() }) */
  readonly parameters: S;
  /** Async handler that executes the tool and returns a string result
   *  （入参由 MCP SDK 按 parameters 校验后传入；详见 registry 的类型桥接） */
  readonly handler: (args: z.infer<z.ZodObject<S>>) => Promise<string>;
}

/**
 * Convert a Zod raw shape to JSON Schema (for OpenAI API).
 * Wraps the shape in z.object() then converts.
 */
export function toJsonSchema(shape: ZodRawShape): Record<string, unknown> {
  return zodToJsonSchema(z.object(shape)) as Record<string, unknown>;
}
