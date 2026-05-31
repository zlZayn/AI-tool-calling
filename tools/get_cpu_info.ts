/** CPU information tool. */

import { registerTool } from "./lib/registry.js";
import { fmt } from "./lib/env_helpers.js";

registerTool({
  name: "get_cpu_info",
  description:
    "Return CPU information: processor model, physical cores, logical cores.",
  parameters: {},
  handler: async () => fmt("cpu"),
});
