/** Host OS information tool. */

import { registerTool } from "./lib/registry.js";
import { fmt } from "./lib/env_helpers.js";

registerTool({
  name: "get_system_info",
  description:
    "Return host OS information: name, release, version, hostname, architecture, uptime.",
  parameters: {},
  handler: async () => fmt("system"),
});
