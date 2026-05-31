/** Shared types for the tool registry. */

import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

/** Zod raw shape — the object passed to z.object(). MCP SDK expects this. */
export type ZodRawShape = Record<string, z.ZodTypeAny>;

/** A registered tool — name, description, schema, and handler. */
export interface Tool {
  /** Tool name, e.g. "run_python" */
  name: string;
  /** Human-readable description for the LLM */
  description: string;
  /** Zod raw shape for MCP SDK validation (e.g. { expression: z.string() }) */
  parameters: ZodRawShape;
  /** Async handler that executes the tool and returns a string result */
  handler: (args: Record<string, unknown>) => Promise<string>;
}

/**
 * Convert a Zod raw shape to JSON Schema (for OpenAI API).
 * Wraps the shape in z.object() then converts.
 */
export function toJsonSchema(shape: ZodRawShape): Record<string, unknown> {
  return zodToJsonSchema(z.object(shape)) as Record<string, unknown>;
}
