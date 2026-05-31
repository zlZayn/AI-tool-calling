/**
 * MCP server — expose environment information tools.
 *
 * Tools:
 *   get_system_info   — host OS info
 *   get_cpu_info      — processor / cores
 *   get_memory_info   — physical memory
 *   get_disk_info     — C: drive usage
 *   get_gpu_info      — GPU adapters
 *   get_runtime_info  — installed dev tools & runtimes
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getAllTools } from "../tools/index.js";

const ENV_TOOL_NAMES = new Set([
  "get_system_info",
  "get_cpu_info",
  "get_memory_info",
  "get_disk_info",
  "get_gpu_info",
  "get_runtime_info",
]);

const server = new McpServer({
  name: "get-env-info",
  version: "1.0.0",
});

// Register each environment tool with the MCP server
try {
  for (const [name, tool] of getAllTools()) {
    if (ENV_TOOL_NAMES.has(name)) {
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
  console.error(`[get-env-info] Failed to start: ${e}`);
  process.exit(1);
}
