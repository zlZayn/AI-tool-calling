/**
 * Validate project files against tool_schema.json naming convention.
 *
 * Usage:
 *   npx tsx tests/test_naming_convention.ts
 *
 * Checks:
 *   - Server file exists, new McpServer({ name: "..." }) matches {verb}-{noun}
 *   - Tool file exists, name: "..." in registerTool() matches {verb}_{noun}
 *   - .mcp.json references the correct server files
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_DIR = join(__dirname, "..");

// ---------------------------------------------------------------------------
// reporting helpers
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
const errors: string[] = [];

function ok(msg: string): void {
  passed++;
  console.log(`  [OK] ${msg}`);
}

function fail(msg: string): void {
  failed++;
  errors.push(msg);
  console.log(`  [FAIL] ${msg}`);
}

// ---------------------------------------------------------------------------
// file content checks
// ---------------------------------------------------------------------------

function fileContains(path: string, pattern: RegExp): boolean {
  try {
    return pattern.test(readFileSync(path, "utf-8"));
  } catch {
    return false;
  }
}

function findDeclaredServerName(path: string): string | null {
  try {
    const m = readFileSync(path, "utf-8").match(
      /new\s+McpServer\s*\(\s*\{\s*name:\s*["']([^"']+)["']/
    );
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

function findDeclaredToolName(path: string): string | null {
  try {
    const m = readFileSync(path, "utf-8").match(
      /name:\s*["']([^"']+)["']/
    );
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

function findAllToolNames(path: string): Set<string> {
  try {
    const content = readFileSync(path, "utf-8");
    const matches = content.matchAll(/name:\s*["']([^"']+)["']/g);
    return new Set(Array.from(matches, (m) => m[1]));
  } catch {
    return new Set();
  }
}

// ---------------------------------------------------------------------------
// main validation
// ---------------------------------------------------------------------------

function main(): number {
  const schemaPath = join(BASE_DIR, "tests", "tool_schema.json");
  if (!existsSync(schemaPath)) {
    console.log(`[ERROR] tool_schema.json not found at ${schemaPath}`);
    return 1;
  }

  const schema = JSON.parse(readFileSync(schemaPath, "utf-8"));
  const convention = schema.naming_convention;

  console.log("--- Naming convention ---");
  console.log(
    `    Server: ${convention.server.name} -> ${convention.server.file}`
  );
  console.log(
    `    Tool:   ${convention.tool.name} -> ${convention.tool.file}`
  );
  console.log();

  // ------------------------------------------------------------------
  // Validate each server + its tools
  // ------------------------------------------------------------------
  for (const server of schema.servers) {
    const verb = server.verb;
    const serverNoun = server.noun;
    const serverName = `${verb}-${serverNoun}`;
    const serverFileNoun = serverNoun.replace(/-/g, "_");
    const serverFile = `${verb}_${serverFileNoun}_server.ts`;
    const serverPath = join(BASE_DIR, "servers", serverFile);

    console.log(`[Server] ${serverName}`);
    if (server.description) console.log(`     "${server.description}"`);

    // 1. Server file exists
    if (!existsSync(serverPath)) {
      fail(`Server file missing: servers/${serverFile}`);
      console.log();
      continue;
    }
    ok(`File exists: servers/${serverFile}`);

    // 2. Server file declares correct name
    const declared = findDeclaredServerName(serverPath);
    if (declared === null) {
      fail(`Could not find McpServer({ name: "..." }) in ${serverFile}`);
    } else if (declared !== serverName) {
      fail(
        `Server name mismatch: declared "${declared}", expected "${serverName}"`
      );
    } else {
      ok(`Server name: "${declared}"`);
    }

    // 3. Validate tool files
    for (const tool of server.tools) {
      const toolNoun = tool.noun;
      const toolName = `${verb}_${toolNoun}`;
      const toolFile = `${toolName}.ts`;
      const toolPath = join(BASE_DIR, "tools", toolFile);

      console.log(`     Tool: ${toolName}`);
      if (tool.description) console.log(`        "${tool.description}"`);

      if (!existsSync(toolPath)) {
        fail(`  Tool file missing: tools/${toolFile}`);
        continue;
      }
      ok(`  File exists: tools/${toolFile}`);

      // Check registerTool name
      const declaredTool = findDeclaredToolName(toolPath);
      if (declaredTool === null) {
        fail(`  Could not find name: "..." in tools/${toolFile}`);
      } else if (declaredTool !== toolName) {
        fail(
          `  Tool name mismatch: declared "${declaredTool}", expected "${toolName}"`
        );
      } else {
        ok(`  Tool name: "${declaredTool}"`);
      }
    }

    console.log();
  }

  // ------------------------------------------------------------------
  // Cross-check .mcp.json
  // ------------------------------------------------------------------
  const mcpRelPath = schema.cross_checks?.mcp_json;
  if (mcpRelPath) {
    const absMcp = join(BASE_DIR, mcpRelPath);
    if (!existsSync(absMcp)) {
      fail(`mcp.json not found at ${mcpRelPath}`);
    } else {
      console.log(`[Cross-check] ${mcpRelPath}`);
      const mcpData = JSON.parse(readFileSync(absMcp, "utf-8"));
      const mcpServers = mcpData.mcpServers || {};

      for (const server of schema.servers) {
        const verb = server.verb;
        const serverNoun = server.noun;
        const serverName = `${verb}-${serverNoun}`;

        if (!(serverName in mcpServers)) {
          fail(`Server "${serverName}" not registered in .mcp.json`);
          continue;
        }

        const entry = mcpServers[serverName];
        const serverFileNoun = serverNoun.replace(/-/g, "_");
        const expectedFile = `${verb}_${serverFileNoun}_server.ts`;

        const args: string[] = entry.args || [];
        const found = args.some((a: string) => a.includes(`servers/${expectedFile}`));
        if (found) {
          ok(`"${serverName}" -> servers/${expectedFile}`);
        } else {
          fail(
            `"${serverName}" args do not reference servers/${expectedFile}`
          );
        }
      }
      console.log();
    }
  }

  // ------------------------------------------------------------------
  // Summary
  // ------------------------------------------------------------------
  const total = passed + failed;
  console.log("=".repeat(40));
  console.log(`  Total: ${total}  |  Passed: ${passed}  |  Failed: ${failed}`);
  console.log("=".repeat(40));
  if (errors.length > 0) {
    console.log("\nAll failures:");
    for (const e of errors) {
      console.log(`   ${e}`);
    }
  }

  return failed > 0 ? 1 : 0;
}

process.exit(main());
