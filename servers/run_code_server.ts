/**
 * MCP server — code sandbox runtimes: Python, R, Shell.
 *
 * Tools:
 *   run_python — execute Python code in a sandbox
 *   run_r      — execute R code in a sandbox
 *   run_shell  — run PowerShell commands
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getAllTools } from "../tools/index.js";

const SANDBOX_TOOL_NAMES = new Set(["run_python", "run_r", "run_shell"]);

const server = new McpServer({
  name: "run-code",
  version: "1.0.0",
});

// Register each code-execution tool with the MCP server
try {
  for (const [name, tool] of getAllTools()) {
    if (SANDBOX_TOOL_NAMES.has(name)) {
      server.tool(
        name,
        tool.description,
        tool.parameters,
        async (args: Record<string, unknown>) => {
          try {
            const result = await tool.handler(args);
            return { content: [{ type: "text" as const, text: result }] };
          } catch (e) {
            return {
              content: [{ type: "text" as const, text: `Error: ${e}` }],
            };
          }
        }
      );
    }
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
} catch (e) {
  console.error(`[run-code] Failed to start: ${e}`);
  process.exit(1);
}
