/** CPU information tool. */

import { registerTool } from "./lib/registry.js";
import { fmt } from "./lib/env_helpers.js";

registerTool({
  name: "get_cpu_info",
  description:
    "Return CPU information: processor model, physical/logical cores, max/current clock speed, L2/L3 cache, architecture, load percentage, virtualization status.",
  parameters: {},
  handler: async () => fmt("cpu"),
});
