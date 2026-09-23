/** Physical memory information tool. */

import { registerInfoTool } from "./lib/env_helpers.js";

registerInfoTool({
  name: "get_memory_info",
  description:
    "Return physical memory information: total, available, usage percentage.",
  category: "memory",
});
