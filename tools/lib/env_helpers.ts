/**
 * Shared helpers for get_*_info tools — hardware queries + runtime detection.
 *
 * Python version uses ctypes (kernel32 calls) and winreg (registry reads).
 * TypeScript version uses child_process.exec with PowerShell CIM cmdlets
 * and Node.js os module for basic system info.
 */

import { exec, execFile, spawn } from "child_process";
import { promisify } from "util";
import * as os from "os";

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// PowerShell helpers
// ---------------------------------------------------------------------------

/** Run a PowerShell command and return parsed JSON. Returns null on failure. */
async function psJson<T>(command: string): Promise<T | null> {
  try {
    const { stdout } = await execFileAsync(
      "powershell",
      ["-NoProfile", "-Command", command],
      { timeout: 15_000, encoding: "utf-8" }
    );
    return JSON.parse(stdout.trim()) as T;
  } catch {
    return null;
  }
}

/** Run a PowerShell command and return raw stdout string. */
async function psRaw(command: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(
      "powershell",
      ["-NoProfile", "-Command", command],
      { timeout: 15_000, encoding: "utf-8" }
    );
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Memory
// ---------------------------------------------------------------------------

interface MemoryInfo {
  TotalVisibleMemorySize: string;
  FreePhysicalMemory: string;
}

async function getMemoryStatus(): Promise<{ totalGb: number; availableGb: number; usagePct: number }> {
  const info = await psJson<MemoryInfo>(
    "Get-CimInstance Win32_OperatingSystem | Select-Object TotalVisibleMemorySize,FreePhysicalMemory | ConvertTo-Json"
  );
  if (info) {
    const totalKb = parseInt(info.TotalVisibleMemorySize, 10);
    const freeKb = parseInt(info.FreePhysicalMemory, 10);
    const totalGb = Math.round((totalKb / 1024 / 1024) * 10) / 10;
    const availableGb = Math.round((freeKb / 1024 / 1024) * 10) / 10;
    const usagePct = Math.round(((totalKb - freeKb) / totalKb) * 100);
    return { totalGb, availableGb, usagePct };
  }
  // Fallback: os module (less precise)
  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  const totalGb = Math.round((totalBytes / 1024 ** 3) * 10) / 10;
  const availableGb = Math.round((freeBytes / 1024 ** 3) * 10) / 10;
  const usagePct = Math.round(((totalBytes - freeBytes) / totalBytes) * 100);
  return { totalGb, availableGb, usagePct };
}

// ---------------------------------------------------------------------------
// Uptime
// ---------------------------------------------------------------------------

function getUptimeDays(): number {
  return Math.round((os.uptime() / 86400) * 100) / 100;
}

// ---------------------------------------------------------------------------
// CPU
// ---------------------------------------------------------------------------

interface CpuCimEntry {
  Name: string;
  NumberOfCores: number;
  NumberOfLogicalProcessors: number;
  MaxClockSpeed: number;
  CurrentClockSpeed: number;
  L2CacheSize: number;
  L3CacheSize: number;
  Architecture: number;
  LoadPercentage: number;
  VirtualizationFirmwareEnabled: boolean;
}

/** Map Win32_Processor Architecture value to human-readable string. */
function cpuArchitectureName(code: number): string {
  const map: Record<number, string> = {
    0: "x86",
    1: "MIPS",
    2: "Alpha",
    3: "PowerPC",
    5: "ARM",
    6: "ia64",
    9: "x64",
    12: "ARM64",
  };
  return map[code] ?? `Unknown(${code})`;
}

export interface CpuInfo {
  processor: string;
  physical_cores: number;
  logical_cores: number;
  max_clock_mhz: number;
  current_clock_mhz: number;
  l2_cache_kb: number;
  l3_cache_kb: number;
  architecture: string;
  load_pct: number;
  virtualization: boolean;
}

async function getCpuInfo(): Promise<CpuInfo> {
  const info = await psJson<CpuCimEntry>(
    "Get-CimInstance Win32_Processor | Select-Object Name,NumberOfCores,NumberOfLogicalProcessors,MaxClockSpeed,CurrentClockSpeed,L2CacheSize,L3CacheSize,Architecture,LoadPercentage,VirtualizationFirmwareEnabled | ConvertTo-Json"
  );
  if (info) {
    return {
      processor: info.Name.trim(),
      physical_cores: info.NumberOfCores,
      logical_cores: info.NumberOfLogicalProcessors,
      max_clock_mhz: info.MaxClockSpeed,
      current_clock_mhz: info.CurrentClockSpeed,
      l2_cache_kb: info.L2CacheSize,
      l3_cache_kb: info.L3CacheSize,
      architecture: cpuArchitectureName(info.Architecture),
      load_pct: info.LoadPercentage,
      virtualization: info.VirtualizationFirmwareEnabled,
    };
  }
  // Fallback: os module
  const cpus = os.cpus();
  return {
    processor: cpus[0]?.model || "unknown",
    physical_cores: 0,
    logical_cores: cpus.length,
    max_clock_mhz: cpus[0]?.speed || 0,
    current_clock_mhz: cpus[0]?.speed || 0,
    l2_cache_kb: 0,
    l3_cache_kb: 0,
    architecture: os.arch(),
    load_pct: 0,
    virtualization: false,
  };
}

// ---------------------------------------------------------------------------
// Disk
// ---------------------------------------------------------------------------

interface DiskInfoEntry {
  DeviceID: string;
  Size: string;
  FreeSpace: string;
}

type DiskMap = Record<string, Record<string, number>>;

async function getDiskInfo(): Promise<DiskMap> {
  const raw = await psJson<DiskInfoEntry | DiskInfoEntry[]>(
    "Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID,Size,FreeSpace | ConvertTo-Json"
  );
  if (!raw) return {};
  const entries = Array.isArray(raw) ? raw : [raw];
  const result: DiskMap = {};
  for (const entry of entries) {
    const totalBytes = parseInt(entry.Size, 10);
    const freeBytes = parseInt(entry.FreeSpace, 10);
    if (!totalBytes) continue; // skip removable drives with no media
    const total_gb = Math.round((totalBytes / 1024 ** 3) * 10) / 10;
    const free_gb = Math.round((freeBytes / 1024 ** 3) * 10) / 10;
    const used_gb = Math.round((total_gb - free_gb) * 10) / 10;
    const usage_pct = Math.round((used_gb / total_gb) * 100 * 10) / 10;
    result[entry.DeviceID] = { total_gb, used_gb, free_gb, usage_pct };
  }
  return result;
}

// ---------------------------------------------------------------------------
// GPU
// ---------------------------------------------------------------------------

interface GpuCimEntry {
  Name: string;
  AdapterRAM: string;
  DriverVersion: string;
  VideoProcessor: string;
  CurrentRefreshRate: string;
}

interface NvidiaGpuDetail {
  name: string;
  vram_total_mb: number;
  vram_used_mb: number;
  vram_free_mb: number;
  gpu_util_pct: number;
  mem_util_pct: number;
  temperature_c: number;
  power_draw_w: number | null;
  power_limit_w: number | null;
  driver_version: string;
  cuda_version: string;
}

export interface GpuInfo {
  name: string;
  vram_mb: number | null;
  driver_version: string | null;
  video_processor: string | null;
  refresh_rate: string | null;
  nvidia: NvidiaGpuDetail | null;
}

/** Parse nvidia-smi CSV output into structured detail. */
function parseNvidiaSmi(stdout: string): NvidiaGpuDetail | null {
  // Expected CSV header:
  // name,memory.total,memory.used,memory.free,utilization.gpu,utilization.memory,temperature.gpu,power.draw,power.limit,driver_version,pci.bus_id
  const lines = stdout.trim().split("\n").filter(Boolean);
  if (lines.length < 2) return null;

  // Find the header line (nvidia-smi may print a warning before the CSV)
  const headerIdx = lines.findIndex((l) => l.includes("memory.total"));
  if (headerIdx < 0 || headerIdx + 1 >= lines.length) return null;

  const headers = lines[headerIdx].split(",").map((h) => h.trim());
  const values = lines[headerIdx + 1].split(",").map((v) => v.trim());

  const get = (key: string): string => {
    const idx = headers.indexOf(key);
    return idx >= 0 ? values[idx] || "" : "";
  };

  const parseMb = (s: string): number => {
    const m = s.match(/(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
  };

  const parsePct = (s: string): number => {
    const m = s.match(/(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
  };

  const parseW = (s: string): number | null => {
    if (/n\/a|\[N\/A\]/i.test(s)) return null;
    const m = s.match(/([\d.]+)/);
    return m ? parseFloat(m[1]) : null;
  };

  const parseTemp = (s: string): number => {
    const m = s.match(/(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
  };

  return {
    name: get("name"),
    vram_total_mb: parseMb(get("memory.total")),
    vram_used_mb: parseMb(get("memory.used")),
    vram_free_mb: parseMb(get("memory.free")),
    gpu_util_pct: parsePct(get("utilization.gpu")),
    mem_util_pct: parsePct(get("utilization.memory")),
    temperature_c: parseTemp(get("temperature.gpu")),
    power_draw_w: parseW(get("power.draw")),
    power_limit_w: parseW(get("power.limit")),
    driver_version: get("driver_version"),
    cuda_version: "", // filled from nvidia-smi -q or separate call
  };
}

/** Try to get CUDA version from nvidia-smi. */
async function getNvidiaCudaVersion(): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      "nvidia-smi",
      ["--query-gpu=driver_version", "--format=csv,noheader"],
      { timeout: 10_000, encoding: "utf-8" }
    );
    // CUDA version is in the top banner of `nvidia-smi` (no args)
    const { stdout: full } = await execFileAsync("nvidia-smi", [], {
      timeout: 10_000,
      encoding: "utf-8",
    });
    const cudaMatch = full.match(/CUDA Version:\s*([\d.]+)/);
    return cudaMatch ? cudaMatch[1] : "";
  } catch {
    return "";
  }
}

/** Query nvidia-smi for the first NVIDIA GPU. Returns null if not available. */
async function getNvidiaDetail(): Promise<NvidiaGpuDetail | null> {
  const fields = [
    "name",
    "memory.total",
    "memory.used",
    "memory.free",
    "utilization.gpu",
    "utilization.memory",
    "temperature.gpu",
    "power.draw",
    "power.limit",
    "driver_version",
    "pci.bus_id",
  ];
  try {
    const { stdout } = await execFileAsync(
      "nvidia-smi",
      [`--query-gpu=${fields.join(",")}`, "--format=csv,noheader,nounits"],
      { timeout: 10_000, encoding: "utf-8" }
    );
    // Build a fake CSV with headers for the parser
    const fakeCsv = `${fields.join(",")}\n${stdout.trim()}`;
    const detail = parseNvidiaSmi(fakeCsv);
    if (detail) {
      detail.cuda_version = await getNvidiaCudaVersion();
    }
    return detail;
  } catch {
    return null;
  }
}

async function getGpuInfo(): Promise<GpuInfo[]> {
  // Basic info from CIM
  const raw = await psJson<GpuCimEntry | GpuCimEntry[]>(
    "Get-CimInstance Win32_VideoController | Select-Object Name,AdapterRAM,DriverVersion,VideoProcessor,CurrentRefreshRate | ConvertTo-Json"
  );
  if (!raw) return [];
  const cimEntries = Array.isArray(raw) ? raw : [raw];

  // NVIDIA detail (shared across all NVIDIA adapters)
  const nvidia = await getNvidiaDetail();

  return cimEntries.map((e) => {
    const vramBytes = parseInt(e.AdapterRAM, 10);
    const isNvidia = /nvidia/i.test(e.Name);
    return {
      name: e.Name,
      vram_mb: vramBytes > 0 ? Math.round(vramBytes / 1024 / 1024) : null,
      driver_version: e.DriverVersion || null,
      video_processor: e.VideoProcessor || null,
      refresh_rate: e.CurrentRefreshRate || null,
      nvidia: isNvidia ? nvidia : null,
    };
  });
}

// ---------------------------------------------------------------------------
// Runtimes / toolchain detection
// ---------------------------------------------------------------------------

function parseFirstLine(output: string): string {
  for (const line of output.split("\n")) {
    const trimmed = line.trim();
    if (trimmed) return trimmed;
  }
  return "";
}

function looksLikeError(text: string): boolean {
  const lowered = text.toLowerCase();
  const hints = [
    "could not be loaded",
    "could not load",
    "is not recognized",
    "is not internal",
    "not found",
    "access is denied",
    "cannot find",
    "no such file",
    "error:",
    "fatal error",
    "failed to",
  ];
  return hints.some((h) => lowered.includes(h));
}

/** Strip ANSI escape codes from a string. */
function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "");
}

/** Parse version from tools that output "tool version X.Y.Z ..." (e.g. FFmpeg). */
function parseVersionWord(output: string): string {
  const match = output.match(/version\s+(\S+)/i);
  return match ? `version ${match[1]}` : parseFirstLine(output);
}

interface RuntimeCheck {
  label: string;
  executable: string;
  args: string[];
  parser: (output: string) => string;
}

const RUNTIME_CHECKS: RuntimeCheck[] = [
  // ---- Languages / Runtimes ----
  { label: "Python", executable: "python", args: ["--version"], parser: parseFirstLine },
  { label: "R", executable: "R", args: ["--version"], parser: parseFirstLine },
  { label: "Node.js", executable: "node", args: ["--version"], parser: parseFirstLine },
  { label: "Deno", executable: "deno", args: ["--version"], parser: parseFirstLine },
  { label: "Bun", executable: "bun", args: ["--version"], parser: parseFirstLine },
  { label: "Rust", executable: "rustc", args: ["--version"], parser: parseFirstLine },
  { label: "Go", executable: "go", args: ["version"], parser: parseFirstLine },
  { label: "gopls", executable: "gopls", args: ["version"], parser: parseFirstLine },
  { label: "Java (JRE)", executable: "java", args: ["-version"], parser: parseFirstLine },
  { label: "Java (JDK)", executable: "javac", args: ["-version"], parser: parseFirstLine },
  { label: "Julia", executable: "julia", args: ["--version"], parser: parseFirstLine },
  { label: "Ruby", executable: "ruby", args: ["--version"], parser: parseFirstLine },
  { label: "PHP", executable: "php", args: ["--version"], parser: parseFirstLine },
  { label: "Perl", executable: "perl", args: ["--version"], parser: parseFirstLine },
  { label: "Lua", executable: "lua", args: ["-v"], parser: parseFirstLine },
  { label: "Zig", executable: "zig", args: ["version"], parser: parseFirstLine },
  { label: "Kotlin", executable: "kotlin", args: ["-version"], parser: parseFirstLine },
  { label: "Kotlin (kapt)", executable: "kotlinc", args: ["-version"], parser: parseFirstLine },
  { label: "Dart", executable: "dart", args: ["--version"], parser: parseFirstLine },
  { label: "Scala", executable: "scala", args: ["-version"], parser: parseFirstLine },
  { label: "Erlang", executable: "erl", args: ["-version"], parser: parseFirstLine },
  { label: "Elixir", executable: "elixir", args: ["--version"], parser: parseFirstLine },
  { label: "Haskell (GHC)", executable: "ghc", args: ["--version"], parser: parseFirstLine },
  { label: "Crystal", executable: "crystal", args: ["--version"], parser: parseFirstLine },
  { label: "OCaml", executable: "ocaml", args: ["--version"], parser: parseFirstLine },
  { label: "Nim", executable: "nim", args: ["--version"], parser: parseFirstLine },
  { label: "Swift", executable: "swift", args: ["--version"], parser: parseFirstLine },
  { label: "Racket", executable: "racket", args: ["--version"], parser: parseFirstLine },
  { label: "Clojure (clj)", executable: "clj", args: ["--version"], parser: parseFirstLine },
  { label: "Groovy", executable: "groovy", args: ["--version"], parser: parseFirstLine },
  { label: "COBOL (GnuCOBOL)", executable: "cobc", args: ["--version"], parser: parseFirstLine },
  { label: "Fortran", executable: "gfortran", args: ["--version"], parser: parseFirstLine },
  { label: "Octave", executable: "octave", args: ["--version"], parser: parseFirstLine },
  { label: "MatLab", executable: "matlab", args: ["-batch", "disp(version)"], parser: parseFirstLine }, // matlab -batch is slow & may hang; presence-only is fine
  // ---- Package managers ----
  { label: "npm", executable: "npm", args: ["--version"], parser: parseFirstLine },
  { label: "Yarn", executable: "yarn", args: ["--version"], parser: parseFirstLine },
  { label: "pnpm", executable: "pnpm", args: ["--version"], parser: parseFirstLine },
  { label: "pip", executable: "pip", args: ["--version"], parser: parseFirstLine },
  { label: "pip3", executable: "pip3", args: ["--version"], parser: parseFirstLine },
  { label: "Conda", executable: "conda", args: ["--version"], parser: parseFirstLine },
  { label: "Chocolatey", executable: "choco", args: ["--version"], parser: parseFirstLine },
  { label: "Scoop", executable: "scoop", args: ["--version"], parser: parseFirstLine }, // version is a git hash on line 2, first line is just a label
  { label: "Homebrew", executable: "brew", args: ["--version"], parser: parseFirstLine },
  { label: "Cargo", executable: "cargo", args: ["--version"], parser: parseFirstLine },
  { label: "vcpkg", executable: "vcpkg", args: ["--version"], parser: parseFirstLine },
  { label: "NuGet", executable: "nuget", args: ["help"], parser: parseFirstLine },
  // ---- .NET ecosystem ----
  { label: ".NET SDK", executable: "dotnet", args: ["--version"], parser: parseFirstLine },
  { label: "MSBuild", executable: "msbuild", args: ["-version"], parser: parseFirstLine },
  { label: "PowerShell (.NET)", executable: "pwsh", args: ["--version"], parser: parseFirstLine },
  // ---- Build systems / Compilers ----
  { label: "GCC", executable: "gcc", args: ["--version"], parser: parseFirstLine },
  { label: "G++", executable: "g++", args: ["--version"], parser: parseFirstLine },
  { label: "Clang", executable: "clang", args: ["--version"], parser: parseFirstLine },
  { label: "CMake", executable: "cmake", args: ["--version"], parser: parseFirstLine },
  { label: "Make", executable: "make", args: ["--version"], parser: parseFirstLine },
  { label: "Ninja", executable: "ninja", args: ["--version"], parser: parseFirstLine },
  { label: "Meson", executable: "meson", args: ["--version"], parser: parseFirstLine },
  { label: "Gradle", executable: "gradle", args: ["--version"], parser: parseFirstLine },
  { label: "Maven", executable: "mvn", args: ["--version"], parser: parseFirstLine },
  { label: "Ant", executable: "ant", args: ["-version"], parser: parseFirstLine },
  { label: "Bazel", executable: "bazel", args: ["version"], parser: parseFirstLine },
  { label: "Scons", executable: "scons", args: ["--version"], parser: parseFirstLine },
  { label: "Buck2", executable: "buck2", args: ["--version"], parser: parseFirstLine },
  { label: "NMake", executable: "nmake", args: ["/?"], parser: parseFirstLine },
  // ---- Version control ----
  { label: "Git", executable: "git", args: ["--version"], parser: parseFirstLine },
  { label: "SVN", executable: "svn", args: ["--version"], parser: parseFirstLine },
  { label: "Mercurial", executable: "hg", args: ["--version"], parser: parseFirstLine },
  // ---- Databases ----
  { label: "MySQL", executable: "mysql", args: ["--version"], parser: parseFirstLine },
  { label: "PostgreSQL", executable: "psql", args: ["--version"], parser: parseFirstLine },
  { label: "SQLite", executable: "sqlite3", args: ["--version"], parser: parseFirstLine },
  { label: "Redis", executable: "redis-cli", args: ["--version"], parser: parseFirstLine },
  { label: "MongoDB", executable: "mongosh", args: ["--version"], parser: parseFirstLine },
  { label: "MongoDB (legacy)", executable: "mongo", args: ["--version"], parser: parseFirstLine },
  { label: "SQL Server (sqlcmd)", executable: "sqlcmd", args: ["-?"], parser: parseFirstLine },
  { label: "DuckDB", executable: "duckdb", args: ["--version"], parser: parseFirstLine },
  { label: "Cassandra (cqlsh)", executable: "cqlsh", args: ["--version"], parser: parseFirstLine },
  { label: "InfluxDB", executable: "influx", args: ["version"], parser: parseFirstLine },
  // ---- Cloud / IaC / DevOps ----
  { label: "Docker", executable: "docker", args: ["--version"], parser: parseFirstLine },
  { label: "Docker Compose", executable: "docker-compose", args: ["--version"], parser: parseFirstLine },
  { label: "Kubernetes (kubectl)", executable: "kubectl", args: ["version", "--client"], parser: parseFirstLine },
  { label: "Helm", executable: "helm", args: ["version", "--short"], parser: parseFirstLine },
  { label: "Terraform", executable: "terraform", args: ["--version"], parser: parseFirstLine },
  { label: "OpenTofu", executable: "tofu", args: ["--version"], parser: parseFirstLine },
  { label: "Pulumi", executable: "pulumi", args: ["version"], parser: parseFirstLine },
  { label: "Ansible", executable: "ansible", args: ["--version"], parser: parseFirstLine },
  { label: "Vagrant", executable: "vagrant", args: ["--version"], parser: parseFirstLine },
  { label: "Minikube", executable: "minikube", args: ["version"], parser: parseFirstLine },
  { label: "AWS CLI", executable: "aws", args: ["--version"], parser: parseFirstLine },
  { label: "Azure CLI", executable: "az", args: ["version"], parser: parseFirstLine },
  { label: "Google Cloud SDK", executable: "gcloud", args: ["--version"], parser: parseFirstLine },
  { label: "Cloudflare (wrangler)", executable: "wrangler", args: ["--version"], parser: parseFirstLine },
  { label: "Firebase CLI", executable: "firebase", args: ["--version"], parser: parseFirstLine },
  { label: "Heroku CLI", executable: "heroku", args: ["--version"], parser: parseFirstLine },
  { label: "Vault", executable: "vault", args: ["--version"], parser: parseFirstLine },
  { label: "Consul", executable: "consul", args: ["--version"], parser: parseFirstLine },
  { label: "Nomad", executable: "nomad", args: ["--version"], parser: parseFirstLine },
  { label: "Packer", executable: "packer", args: ["--version"], parser: parseFirstLine },
  { label: "Serverless", executable: "serverless", args: ["--version"], parser: parseFirstLine },
  { label: "CDK (AWS CDK)", executable: "cdk", args: ["--version"], parser: parseFirstLine },
  { label: "Fly CLI", executable: "flyctl", args: ["--version"], parser: parseFirstLine },
  { label: "Railway CLI", executable: "railway", args: ["--version"], parser: parseFirstLine },
  { label: "Netlify CLI", executable: "netlify", args: ["--version"], parser: parseFirstLine },
  { label: "Vercel CLI", executable: "vercel", args: ["--version"], parser: parseFirstLine },
  { label: "Argo CD CLI", executable: "argocd", args: ["--version"], parser: parseFirstLine },
  // ---- Shells / Terminals ----
  { label: "PowerShell 5+", executable: "powershell", args: ["-NoProfile", "-Command", "[Console]::OutputEncoding=[Text.Encoding]::UTF8;$PSVersionTable.PSVersion.ToString()"], parser: parseFirstLine },
  { label: "PowerShell 7+", executable: "pwsh", args: ["-NoProfile", "-Command", "$PSVersionTable.PSVersion.ToString()"], parser: parseFirstLine },
  { label: "Bash", executable: "bash", args: ["--version"], parser: parseFirstLine },
  { label: "Zsh", executable: "zsh", args: ["--version"], parser: parseFirstLine },
  { label: "Fish", executable: "fish", args: ["--version"], parser: parseFirstLine },
  { label: "Nushell", executable: "nu", args: ["--version"], parser: parseFirstLine },
  { label: "Yori", executable: "yori", args: ["--version"], parser: parseFirstLine },
  { label: "Warp", executable: "warp", args: ["--version"], parser: parseFirstLine },
  // ---- CLI utilities ----
  { label: "curl", executable: "curl", args: ["--version"], parser: parseFirstLine },
  { label: "wget", executable: "wget", args: ["--version"], parser: parseFirstLine },
  { label: "jq", executable: "jq", args: ["--version"], parser: parseFirstLine },
  { label: "yq", executable: "yq", args: ["--version"], parser: parseFirstLine },
  { label: "ripgrep (rg)", executable: "rg", args: ["--version"], parser: parseFirstLine },
  { label: "fd", executable: "fd", args: ["--version"], parser: parseFirstLine },
  { label: "bat", executable: "bat", args: ["--version"], parser: parseFirstLine },
  { label: "eza", executable: "eza", args: ["--version"], parser: parseFirstLine },
  { label: "delta", executable: "delta", args: ["--version"], parser: parseFirstLine },
  { label: "tig", executable: "tig", args: ["--version"], parser: parseFirstLine },
  { label: "OpenSSL", executable: "openssl", args: ["version"], parser: parseFirstLine },
  { label: "ssh", executable: "ssh", args: ["-V"], parser: parseFirstLine },
  { label: "rsync", executable: "rsync", args: ["--version"], parser: parseFirstLine },
  { label: "tmux", executable: "tmux", args: ["--version"], parser: parseFirstLine },
  { label: "screen", executable: "screen", args: ["--version"], parser: parseFirstLine },
  { label: "htop", executable: "htop", args: ["--version"], parser: parseFirstLine },
  { label: "btop", executable: "btop", args: ["--version"], parser: parseFirstLine },
  { label: "ncdu", executable: "ncdu", args: ["--version"], parser: parseFirstLine },
  { label: "duf", executable: "duf", args: ["--version"], parser: parseFirstLine },
  { label: "procs", executable: "procs", args: ["--version"], parser: parseFirstLine },
  { label: "hyperfine", executable: "hyperfine", args: ["--version"], parser: parseFirstLine },
  { label: "just", executable: "just", args: ["--version"], parser: parseFirstLine },
  { label: "fzf", executable: "fzf", args: ["--version"], parser: parseFirstLine },
  { label: "zoxide", executable: "zoxide", args: ["--version"], parser: parseFirstLine },
  { label: "starship", executable: "starship", args: ["--version"], parser: parseFirstLine },
  { label: "lazygit", executable: "lazygit", args: ["--version"], parser: parseFirstLine },
  { label: "lazydocker", executable: "lazydocker", args: ["--version"], parser: parseFirstLine },
  { label: "doggo (DNS)", executable: "doggo", args: ["--version"], parser: parseFirstLine },
  { label: "httpie", executable: "http", args: ["--version"], parser: parseFirstLine },
  { label: "xh", executable: "xh", args: ["--version"], parser: parseFirstLine },
  // ---- Document / Publishing ----
  { label: "Pandoc", executable: "pandoc", args: ["--version"], parser: parseFirstLine },
  { label: "Quarto", executable: "quarto", args: ["--version"], parser: parseFirstLine },
  { label: "TeX Live (tex)", executable: "tex", args: ["--version"], parser: parseFirstLine },
  { label: "wkhtmltopdf", executable: "wkhtmltopdf", args: ["--version"], parser: parseFirstLine },
  { label: "Prince XML", executable: "prince", args: ["--version"], parser: parseFirstLine },
  // ---- AI / LLM tools ----
  { label: "Ollama", executable: "ollama", args: ["--version"], parser: parseFirstLine }, // needs running daemon for version; presence-only is fine
  { label: "LM Studio (lms)", executable: "lms", args: ["--version"], parser: parseFirstLine },
  // ---- Compression ----
  { label: "Bandizip", executable: "bz", args: ["--version"], parser: parseFirstLine },
  // ---- Media / Graphics ----
  { label: "FFmpeg", executable: "ffmpeg", args: ["-version"], parser: parseVersionWord },
  { label: "FFprobe", executable: "ffprobe", args: ["-version"], parser: parseVersionWord },
  { label: "ImageMagick", executable: "magick", args: ["--version"], parser: parseFirstLine },
  { label: "Graphviz (dot)", executable: "dot", args: ["-V"], parser: parseFirstLine },
  { label: "ExifTool", executable: "exiftool", args: ["-ver"], parser: parseFirstLine },
  { label: "SoX", executable: "sox", args: ["--version"], parser: parseFirstLine },
  { label: "yt-dlp", executable: "yt-dlp", args: ["--version"], parser: parseFirstLine },
  { label: "7-Zip", executable: "7z", args: ["--help"], parser: parseFirstLine },
  { label: "Inkscape", executable: "inkscape", args: ["--version"], parser: parseFirstLine },
  { label: "Blender", executable: "blender", args: ["--version"], parser: parseFirstLine },
  // ---- Editors / IDEs (CLI launchers) ----
  { label: "VS Code", executable: "code", args: ["--version"], parser: parseFirstLine },
  { label: "Vim", executable: "vim", args: ["--version"], parser: parseFirstLine },
  { label: "Neovim", executable: "nvim", args: ["--version"], parser: parseFirstLine },
  { label: "Emacs", executable: "emacs", args: ["--version"], parser: parseFirstLine },
  { label: "Sublime Text", executable: "subl", args: ["--version"], parser: parseFirstLine },
  { label: "JetBrains Toolbox", executable: "jetbrains-toolbox", args: ["--version"], parser: parseFirstLine },
  { label: "Positron", executable: "positron", args: ["--version"], parser: parseFirstLine },
  // ---- Reverse engineering / Security ----
  { label: "GDB", executable: "gdb", args: ["--version"], parser: parseFirstLine },
  { label: "LLDB", executable: "lldb", args: ["--version"], parser: parseFirstLine },
  { label: "Objdump", executable: "objdump", args: ["--version"], parser: parseFirstLine },
  { label: "Strace", executable: "strace", args: ["--version"], parser: parseFirstLine },
  { label: "Radare2", executable: "r2", args: ["--version"], parser: parseFirstLine },
  { label: "Ghidra (server)", executable: "ghidraserver", args: ["--version"], parser: parseFirstLine },
  { label: "Nmap", executable: "nmap", args: ["--version"], parser: parseFirstLine },
  { label: "Wireshark (tshark)", executable: "tshark", args: ["--version"], parser: parseFirstLine },
  { label: "Metasploit (msfconsole)", executable: "msfconsole", args: ["--version"], parser: parseFirstLine },
  { label: "SQLMap", executable: "sqlmap", args: ["--version"], parser: parseFirstLine },
  { label: "Hashcat", executable: "hashcat", args: ["--version"], parser: parseFirstLine },
  { label: "John (JtR)", executable: "john", args: ["--version"], parser: parseFirstLine },
  { label: "Aircrack-ng", executable: "aircrack-ng", args: ["--version"], parser: parseFirstLine },
  { label: "YARA", executable: "yara", args: ["--version"], parser: parseFirstLine },
  { label: "Binwalk", executable: "binwalk", args: ["--version"], parser: parseFirstLine },
  { label: "Apktool", executable: "apktool", args: ["--version"], parser: parseFirstLine },
  { label: "Jadx", executable: "jadx", args: ["--version"], parser: parseFirstLine },
  { label: "Wireshark (dumpcap)", executable: "dumpcap", args: ["--version"], parser: parseFirstLine },
];

// ---------------------------------------------------------------------------
// Environment variable fast-check (zero process spawning)
// ---------------------------------------------------------------------------

interface EnvCheck {
  label: string;
  /** Env vars that must ALL be present to consider this tool detected. */
  requiredVars: string[];
  /** Extract version string from env vars. Return null if only presence is known. */
  parseVersion?: (env: Record<string, string>) => string | null;
}

const ENV_CHECKS: EnvCheck[] = [
  {
    label: "npm",
    requiredVars: ["npm_config_npm_version"],
    parseVersion: (env) => env.npm_config_npm_version || null,
  },
  {
    label: "Node.js",
    requiredVars: ["npm_config_user_agent"],
    parseVersion: (env) => {
      const m = env.npm_config_user_agent?.match(/node\/v(\S+)/);
      return m ? `v${m[1]}` : null;
    },
  },
  {
    label: "Go",
    requiredVars: ["GOPATH"],
  },
  {
    label: "Android SDK",
    requiredVars: ["ANDROID_SDK_HOME"],
  },
  {
    label: "Java (JDK)",
    requiredVars: ["JAVA_HOME"],
  },
  {
    label: "R",
    requiredVars: ["R_HOME"],
  },
  {
    label: "Python",
    requiredVars: ["PYTHONHOME"],
  },
  {
    label: ".NET SDK",
    requiredVars: ["DOTNET_ROOT"], // presence-only: dotnet --version fails when no SDK installed
  },
  {
    label: "Flutter",
    requiredVars: ["FLUTTER_ROOT"],
  },
  {
    label: "Android NDK",
    requiredVars: ["ANDROID_NDK_HOME"],
  },
];

/** Scan environment variables for known tools. Returns detected labels and any versions found. */
function detectFromEnv(): { found: Record<string, string>; detected: Set<string> } {
  const found: Record<string, string> = {};
  const detected = new Set<string>();

  for (const check of ENV_CHECKS) {
    const env: Record<string, string> = {};
    let allPresent = true;
    for (const v of check.requiredVars) {
      const val = process.env[v];
      if (!val) { allPresent = false; break; }
      env[v] = val;
    }
    if (!allPresent) continue;

    detected.add(check.label);
    if (check.parseVersion) {
      const version = check.parseVersion(env);
      if (version) found[check.label] = version;
    }
  }

  return { found, detected };
}

/** Check if an executable exists on PATH using `where` (Windows) or `which`.
 *  Returns the full path if found, null otherwise.
 *  On Windows, prefers .exe > .cmd/.bat > extensionless (bash scripts). */
async function whichExe(exe: string): Promise<string | null> {
  try {
    const cmd = process.platform === "win32" ? `where ${exe}` : `which ${exe}`;
    const { stdout } = await execAsync(cmd, { timeout: 5_000, encoding: "utf-8" });
    const lines = stdout.trim().split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return null;

    if (process.platform === "win32") {
      const exeFile = lines.find((l) => /\.exe$/i.test(l));
      if (exeFile) return exeFile;
      const cmdFile = lines.find((l) => /\.(cmd|bat)$/i.test(l));
      if (cmdFile) return cmdFile;
    }

    return lines[0] || null;
  } catch {
    return null;
  }
}

/** Run an executable with args and return parsed version string.
 *  Uses execFile for .exe (avoids cmd.exe PATH quirks) and cmd /c for .cmd/.bat.
 *  Some tools (e.g. bz --version) print version info but exit non-zero;
 *  we catch that and still try to extract from stdout/stderr. */
async function queryVersion(exePath: string, args: string[], timeout = 15_000): Promise<string | null> {
  const isCmd = /\.(cmd|bat)$/i.test(exePath);
  const run = isCmd
    ? () => execAsync(`"${exePath}" ${args.join(" ")}`, { timeout, encoding: "utf-8" })
    : () => execFileAsync(exePath, args, { timeout, encoding: "utf-8" });

  try {
    const { stdout, stderr } = await run();
    const raw = stripAnsi((stdout || stderr || "").trim());
    return raw || null;
  } catch (err: any) {
    // Non-zero exit code — still try to extract version from output
    const stdout = err?.stdout || "";
    const stderr = err?.stderr || "";
    const raw = stripAnsi((stdout || stderr || "").trim());
    return raw || null;
  }
}

async function detectRuntimesDirect(): Promise<Record<string, string>> {
  // Phase 1: environment variable fast-check (zero process spawning)
  const { found } = detectFromEnv();

  // Phase 2: PATH scanning — skip tools already resolved with version from env.
  const pathChecks = RUNTIME_CHECKS.filter(
    (c) => !found[c.label] // not yet resolved with version
  );

  const batchSize = 20;
  for (let i = 0; i < pathChecks.length; i += batchSize) {
    const batch = pathChecks.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (check) => {
        const exePath = await whichExe(check.executable);
        if (!exePath) return { label: check.label, version: null };

        const raw = await queryVersion(exePath, check.args);
        if (!raw) return { label: check.label, version: "(detected, no version info)" };

        const version = check.parser(raw);
        if (version && !looksLikeError(version)) {
          return { label: check.label, version };
        }
        return { label: check.label, version: "(detected, no version info)" };
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled" && result.value.version) {
        found[result.value.label] = result.value.version;
      }
    }
  }

  return found;
}

let runtimeCache: Record<string, string> | null = null;

export async function detectRuntimes(forceRefresh = false): Promise<Record<string, string>> {
  if (runtimeCache && !forceRefresh) return runtimeCache;
  runtimeCache = await detectRuntimesDirect();
  return runtimeCache;
}

// ---------------------------------------------------------------------------
// Category definitions + formatter
// ---------------------------------------------------------------------------

type CategoryValue = string | number | boolean | string[] | Record<string, string | number | boolean> | Record<string, Record<string, string | number | boolean>>;

interface Category {
  label: string;
  getData: () => Promise<Record<string, CategoryValue>> | Record<string, CategoryValue>;
}

export const CATEGORIES: Record<string, Category> = {
  system: {
    label: "System",
    getData: () => ({
      system: os.platform(),
      release: os.release(),
      version: os.version(),
      hostname: os.hostname(),
      machine: os.arch(),
      uptime_days: getUptimeDays(),
    }),
  },
  cpu: {
    label: "CPU",
    getData: async () => {
      const info = await getCpuInfo();
      return {
        processor: info.processor,
        physical_cores: info.physical_cores,
        logical_cores: info.logical_cores,
        max_clock_mhz: info.max_clock_mhz,
        current_clock_mhz: info.current_clock_mhz,
        l2_cache_kb: info.l2_cache_kb,
        l3_cache_kb: info.l3_cache_kb,
        architecture: info.architecture,
        load_pct: info.load_pct,
        virtualization: info.virtualization,
      };
    },
  },
  memory: {
    label: "Memory",
    getData: async () => {
      const m = await getMemoryStatus();
      return { total_gb: m.totalGb, available_gb: m.availableGb, usage_pct: m.usagePct };
    },
  },
  disk: {
    label: "Disk",
    getData: () => getDiskInfo(),
  },
  gpu: {
    label: "GPU",
    getData: async () => {
      const gpus = await getGpuInfo();
      const result: Record<string, CategoryValue> = {};
      for (let i = 0; i < gpus.length; i++) {
        const g = gpus[i];
        const prefix = gpus.length > 1 ? `gpu${i}` : "gpu";
        const entry: Record<string, string | number> = { name: g.name };
        if (g.vram_mb != null) entry.vram_mb = g.vram_mb;
        if (g.driver_version) entry.driver_version = g.driver_version;
        if (g.video_processor) entry.video_processor = g.video_processor;
        if (g.refresh_rate) entry.refresh_rate_hz = g.refresh_rate;
        if (g.nvidia) {
          entry.nvidia_vram_total_mb = g.nvidia.vram_total_mb;
          entry.nvidia_vram_used_mb = g.nvidia.vram_used_mb;
          entry.nvidia_vram_free_mb = g.nvidia.vram_free_mb;
          entry.nvidia_gpu_util_pct = g.nvidia.gpu_util_pct;
          entry.nvidia_mem_util_pct = g.nvidia.mem_util_pct;
          entry.nvidia_temperature_c = g.nvidia.temperature_c;
          if (g.nvidia.power_draw_w != null) entry.nvidia_power_draw_w = g.nvidia.power_draw_w;
          if (g.nvidia.power_limit_w != null) entry.nvidia_power_limit_w = g.nvidia.power_limit_w;
          entry.nvidia_driver_version = g.nvidia.driver_version;
          if (g.nvidia.cuda_version) entry.nvidia_cuda_version = g.nvidia.cuda_version;
        }
        result[prefix] = entry;
      }
      return result;
    },
  },
  runtimes: {
    label: "Runtimes & Toolchains",
    getData: () => detectRuntimes(),
  },
};

export async function fmt(catName: string): Promise<string> {
  const cat = CATEGORIES[catName];
  if (!cat) return `(unknown category: ${catName})`;

  const data = await cat.getData();

  const lines: string[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (Array.isArray(v)) {
      lines.push(`${k}: ${v.length > 0 ? v.join(", ") : "(none)"}`);
    } else if (typeof v === "object" && v !== null) {
      lines.push(`${k}:`);
      for (const [k2, v2] of Object.entries(v)) {
        if (typeof v2 === "object" && v2 !== null) {
          lines.push(`  ${k2}:`);
          for (const [k3, v3] of Object.entries(v2)) {
            lines.push(`    ${k3}: ${v3}`);
          }
        } else {
          lines.push(`  ${k2}: ${v2}`);
        }
      }
    } else {
      lines.push(`${k}: ${v}`);
    }
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Shared spawn helper for code-execution tools
// ---------------------------------------------------------------------------

export interface SpawnResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

/** Spawn a process with timeout and capture stdout/stderr. */
export function spawnProcess(
  command: string,
  args: string[],
  timeoutMs: number = 10_000
): Promise<SpawnResult> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      timeout: timeoutMs,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGTERM");
    }, timeoutMs);

    proc.stdout.on("data", (data: Buffer) => {
      stdout += data.toString("utf-8");
    });

    proc.stderr.on("data", (data: Buffer) => {
      stderr += data.toString("utf-8");
    });

    proc.on("close", (code: number | null) => {
      clearTimeout(timer);
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 1,
        timedOut,
      });
    });

    proc.on("error", () => {
      clearTimeout(timer);
      resolve({
        stdout,
        stderr,
        exitCode: 1,
        timedOut,
      });
    });
  });
}

/** Truncate a string to MAX_RESULT_LEN characters. */
export function truncate(s: string, maxLen: number = 5000): string {
  return s.length <= maxLen ? s : s.slice(0, maxLen) + "... (truncated)";
}
