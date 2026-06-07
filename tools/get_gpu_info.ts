/** GPU adapter information tool. */

import { registerTool } from "./lib/registry.js";
import { fmt } from "./lib/env_helpers.js";

registerTool({
  name: "get_gpu_info",
  description: "Return GPU adapter information: name, VRAM, driver, refresh rate. For NVIDIA GPUs, also includes real-time VRAM usage, GPU/memory utilization, temperature, power draw, and CUDA version via nvidia-smi.",
  parameters: {},
  handler: async () => fmt("gpu"),
});
