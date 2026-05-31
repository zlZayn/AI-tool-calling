/** GPU adapter information tool. */

import { registerTool } from "./lib/registry.js";
import { fmt } from "./lib/env_helpers.js";

registerTool({
  name: "get_gpu_info",
  description: "Return GPU adapter information: detected graphics cards.",
  parameters: {},
  handler: async () => fmt("gpu"),
});
