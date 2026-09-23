/** CPU information tool. */

import { registerInfoTool } from "./lib/env_helpers.js";

registerInfoTool({
  name: "get_cpu_info",
  description:
    "Return CPU information: processor model, physical/logical cores, max/current clock speed, L2/L3 cache, architecture, load percentage, virtualization status.",
  category: "cpu",
});
