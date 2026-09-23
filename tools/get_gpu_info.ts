/** GPU adapter information tool. */

import { registerInfoTool } from "./lib/env_helpers.js";

registerInfoTool({
  name: "get_gpu_info",
  description: "Return GPU adapter information: name, VRAM, driver, refresh rate. For NVIDIA GPUs, also includes real-time VRAM usage, GPU/memory utilization, temperature, power draw, and CUDA version via nvidia-smi.",
  category: "gpu",
});
