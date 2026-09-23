/** Disk usage information tool. */

import { registerInfoTool } from "./lib/env_helpers.js";

registerInfoTool({
  name: "get_disk_info",
  description:
    "Return all logical drives disk usage: total, used, free space and usage percentage per drive.",
  category: "disk",
});
