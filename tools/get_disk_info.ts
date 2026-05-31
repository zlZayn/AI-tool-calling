/** Disk usage information tool. */

import { registerTool } from "./lib/registry.js";
import { fmt } from "./lib/env_helpers.js";

registerTool({
  name: "get_disk_info",
  description:
    "Return C: drive disk usage: total, used, free space and usage percentage.",
  parameters: {},
  handler: async () => fmt("disk"),
});
