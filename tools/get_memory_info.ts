/** Physical memory information tool. */

import { registerTool } from "./lib/registry.js";
import { fmt } from "./lib/env_helpers.js";

registerTool({
  name: "get_memory_info",
  description:
    "Return physical memory information: total, available, usage percentage.",
  parameters: {},
  handler: async () => fmt("memory"),
});
