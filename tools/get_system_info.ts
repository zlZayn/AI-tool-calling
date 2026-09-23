/** Host OS information tool. */

import { registerInfoTool } from "./lib/env_helpers.js";

registerInfoTool({
  name: "get_system_info",
  description:
    "Return host OS information: name, release, version, hostname, architecture, uptime.",
  category: "system",
});
