/**
 * Installed runtimes & dev tools detection tool.
 *
 * Results are cached after the first call since installed tooling rarely
 * changes mid-session. Pass force_refresh=true to re-scan.
 */

import { z } from "zod";
import { registerTool } from "./lib/registry.js";
import { fmt } from "./lib/env_helpers.js";

let cache: string | null = null;

registerTool({
  name: "get_runtime_info",
  description:
    "Detect installed runtimes and dev tools by scanning PATH: " +
    "languages, package managers, databases, cloud CLIs, etc. " +
    "Results are cached after the first call for speed; pass " +
    "force_refresh=true to re-scan.",
  parameters: {
    force_refresh: z
      .boolean()
      .default(false)
      .describe("Re-scan instead of using cached results"),
  },
  handler: async (args) => {
    const forceRefresh = (args.force_refresh as boolean) ?? false;
    if (cache === null || forceRefresh) {
      cache = await fmt("runtimes");
    }
    return cache;
  },
});
