"""Shared helpers for get_*_info tools — hardware queries + runtime detection."""

import ctypes
import os
import platform
import sys
from ctypes import wintypes


# ---------------------------------------------------------------------------
# Memory
# ---------------------------------------------------------------------------


class _MEMORYSTATUSEX(ctypes.Structure):
    _fields_ = [
        ("dwLength", wintypes.DWORD),
        ("dwMemoryLoad", wintypes.DWORD),
        ("ullTotalPhys", ctypes.c_ulonglong),
        ("ullAvailPhys", ctypes.c_ulonglong),
        ("ullTotalPageFile", ctypes.c_ulonglong),
        ("ullAvailPageFile", ctypes.c_ulonglong),
        ("ullTotalVirtual", ctypes.c_ulonglong),
        ("ullAvailVirtual", ctypes.c_ulonglong),
        ("ullAvailExtendedVirtual", ctypes.c_ulonglong),
    ]


def _get_memory_status() -> _MEMORYSTATUSEX:
    mem = _MEMORYSTATUSEX()
    mem.dwLength = ctypes.sizeof(_MEMORYSTATUSEX)
    ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(mem))
    return mem


# ---------------------------------------------------------------------------
# Uptime
# ---------------------------------------------------------------------------


def _get_uptime_days() -> float:
    lib = ctypes.windll.kernel32
    return round(lib.GetTickCount64() / 86400000, 2)


# ---------------------------------------------------------------------------
# CPU
# ---------------------------------------------------------------------------


def _get_cpu_count() -> tuple[int, int]:
    logical = os.cpu_count() or 0
    physical = 0
    try:
        import winreg

        key = winreg.OpenKey(
            winreg.HKEY_LOCAL_MACHINE,
            r"HARDWARE\DESCRIPTION\System\CentralProcessor",
        )
        i = 0
        while True:
            try:
                winreg.EnumKey(key, i)
                physical += 1
                i += 1
            except OSError:
                break
        winreg.CloseKey(key)
    except Exception:
        physical = logical
    return physical, logical


# ---------------------------------------------------------------------------
# Disk
# ---------------------------------------------------------------------------


def _get_disk_info(path: str = "C:\\") -> dict:
    try:
        free_bytes = ctypes.c_ulonglong(0)
        total_bytes = ctypes.c_ulonglong(0)
        ctypes.windll.kernel32.GetDiskFreeSpaceExW(
            ctypes.c_wchar_p(path),
            None,
            ctypes.byref(total_bytes),
            ctypes.byref(free_bytes),
        )
        total_gb = round(total_bytes.value / (1024**3), 1)
        free_gb = round(free_bytes.value / (1024**3), 1)
        used_gb = round(total_gb - free_gb, 1)
        usage_pct = round((used_gb / total_gb) * 100, 1) if total_gb else 0
        return {
            "total_gb": total_gb,
            "used_gb": used_gb,
            "free_gb": free_gb,
            "usage_pct": usage_pct,
        }
    except Exception:
        return {"error": "unable to query disk info"}


# ---------------------------------------------------------------------------
# GPU
# ---------------------------------------------------------------------------


def _get_gpu_info() -> list[str]:
    try:
        import winreg

        adapters = []
        key = winreg.OpenKey(
            winreg.HKEY_LOCAL_MACHINE,
            r"SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}",
        )
        i = 0
        while True:
            try:
                sub_key_name = winreg.EnumKey(key, i)
                sub_key = winreg.OpenKey(key, sub_key_name)
                try:
                    name, _ = winreg.QueryValueEx(sub_key, "DriverDesc")
                    adapters.append(name)
                except FileNotFoundError:
                    pass
                winreg.CloseKey(sub_key)
                i += 1
            except OSError:
                break
        winreg.CloseKey(key)
        return adapters
    except Exception:
        return []


# ---------------------------------------------------------------------------
# Runtimes / toolchain detection
# ---------------------------------------------------------------------------


def _parse_first_line(output: str) -> str:
    for line in output.splitlines():
        line = line.strip()
        if line:
            return line
    return ""


def _looks_like_error(text: str) -> bool:
    lowered = text.lower()
    hints = [
        "could not be loaded",
        "could not load",
        "is not recognized",
        "is not internal",
        "not found",
        "access is denied",
        "cannot find",
        "no such file",
        "error",
        "failed to",
    ]
    return any(h in lowered for h in hints)


_RUNTIME_CHECKS = [
    # ---- Languages / Runtimes ----
    ("Python", "python", ("--version",), _parse_first_line),
    ("R", "R", ("--version",), _parse_first_line),
    ("Node.js", "node", ("--version",), _parse_first_line),
    ("Deno", "deno", ("--version",), _parse_first_line),
    ("Bun", "bun", ("--version",), _parse_first_line),
    ("Rust", "rustc", ("--version",), _parse_first_line),
    ("Go", "go", ("version",), _parse_first_line),
    ("Java (JRE)", "java", ("-version",), _parse_first_line),
    ("Java (JDK)", "javac", ("-version",), _parse_first_line),
    ("Julia", "julia", ("--version",), _parse_first_line),
    ("Ruby", "ruby", ("--version",), _parse_first_line),
    ("PHP", "php", ("--version",), _parse_first_line),
    ("Perl", "perl", ("--version",), _parse_first_line),
    ("Lua", "lua", ("-v",), _parse_first_line),
    ("Zig", "zig", ("version",), _parse_first_line),
    ("Kotlin", "kotlin", ("-version",), _parse_first_line),
    ("Kotlin (kapt)", "kotlinc", ("-version",), _parse_first_line),
    ("Dart", "dart", ("--version",), _parse_first_line),
    ("Scala", "scala", ("-version",), _parse_first_line),
    ("Erlang", "erl", ("-version",), _parse_first_line),
    ("Elixir", "elixir", ("--version",), _parse_first_line),
    ("Haskell (GHC)", "ghc", ("--version",), _parse_first_line),
    ("Crystal", "crystal", ("--version",), _parse_first_line),
    ("OCaml", "ocaml", ("--version",), _parse_first_line),
    ("Nim", "nim", ("--version",), _parse_first_line),
    ("Swift", "swift", ("--version",), _parse_first_line),
    ("Racket", "racket", ("--version",), _parse_first_line),
    ("Clojure (clj)", "clj", ("--version",), _parse_first_line),
    ("Groovy", "groovy", ("--version",), _parse_first_line),
    ("COBOL (GnuCOBOL)", "cobc", ("--version",), _parse_first_line),
    ("Fortran", "gfortran", ("--version",), _parse_first_line),
    ("Octave", "octave", ("--version",), _parse_first_line),
    # ---- Package managers ----
    ("npm", "npm", ("--version",), _parse_first_line),
    ("Yarn", "yarn", ("--version",), _parse_first_line),
    ("pnpm", "pnpm", ("--version",), _parse_first_line),
    ("pip", "pip", ("--version",), _parse_first_line),
    ("pip3", "pip3", ("--version",), _parse_first_line),
    ("Conda", "conda", ("--version",), _parse_first_line),
    ("Chocolatey", "choco", ("--version",), _parse_first_line),
    ("Scoop", "scoop", ("--version",), _parse_first_line),
    ("Homebrew", "brew", ("--version",), _parse_first_line),
    ("Cargo", "cargo", ("--version",), _parse_first_line),
    ("vcpkg", "vcpkg", ("--version",), _parse_first_line),
    ("NuGet", "nuget", ("help",), _parse_first_line),
    # ---- .NET ecosystem ----
    (".NET SDK", "dotnet", ("--version",), _parse_first_line),
    ("MSBuild", "msbuild", ("-version",), _parse_first_line),
    ("PowerShell (.NET)", "pwsh", ("--version",), _parse_first_line),
    # ---- Build systems / Compilers ----
    ("GCC", "gcc", ("--version",), _parse_first_line),
    ("G++", "g++", ("--version",), _parse_first_line),
    ("Clang", "clang", ("--version",), _parse_first_line),
    ("CMake", "cmake", ("--version",), _parse_first_line),
    ("Make", "make", ("--version",), _parse_first_line),
    ("Ninja", "ninja", ("--version",), _parse_first_line),
    ("Meson", "meson", ("--version",), _parse_first_line),
    ("Gradle", "gradle", ("--version",), _parse_first_line),
    ("Maven", "mvn", ("--version",), _parse_first_line),
    ("Ant", "ant", ("-version",), _parse_first_line),
    ("Bazel", "bazel", ("version",), _parse_first_line),
    ("Scons", "scons", ("--version",), _parse_first_line),
    ("Buck2", "buck2", ("--version",), _parse_first_line),
    ("NMake", "nmake", ("/?",), _parse_first_line),
    # ---- Version control ----
    ("Git", "git", ("--version",), _parse_first_line),
    ("SVN", "svn", ("--version",), _parse_first_line),
    ("Mercurial", "hg", ("--version",), _parse_first_line),
    # ---- Databases ----
    ("MySQL", "mysql", ("--version",), _parse_first_line),
    ("PostgreSQL", "psql", ("--version",), _parse_first_line),
    ("SQLite", "sqlite3", ("--version",), _parse_first_line),
    ("Redis", "redis-cli", ("--version",), _parse_first_line),
    ("MongoDB", "mongosh", ("--version",), _parse_first_line),
    ("MongoDB (legacy)", "mongo", ("--version",), _parse_first_line),
    ("SQL Server (sqlcmd)", "sqlcmd", ("-?",), _parse_first_line),
    ("DuckDB", "duckdb", ("--version",), _parse_first_line),
    ("Cassandra (cqlsh)", "cqlsh", ("--version",), _parse_first_line),
    ("InfluxDB", "influx", ("version",), _parse_first_line),
    # ---- Cloud / IaC / DevOps ----
    ("Docker", "docker", ("--version",), _parse_first_line),
    ("Docker Compose", "docker-compose", ("--version",), _parse_first_line),
    ("Kubernetes (kubectl)", "kubectl", ("version", "--client"), _parse_first_line),
    ("Helm", "helm", ("version", "--short"), _parse_first_line),
    ("Terraform", "terraform", ("--version",), _parse_first_line),
    ("OpenTofu", "tofu", ("--version",), _parse_first_line),
    ("Pulumi", "pulumi", ("version",), _parse_first_line),
    ("Ansible", "ansible", ("--version",), _parse_first_line),
    ("Vagrant", "vagrant", ("--version",), _parse_first_line),
    ("Minikube", "minikube", ("version",), _parse_first_line),
    ("AWS CLI", "aws", ("--version",), _parse_first_line),
    ("Azure CLI", "az", ("version",), _parse_first_line),
    ("Google Cloud SDK", "gcloud", ("--version",), _parse_first_line),
    ("Cloudflare (wrangler)", "wrangler", "--version", _parse_first_line),
    ("Firebase CLI", "firebase", ("--version",), _parse_first_line),
    ("Heroku CLI", "heroku", ("--version",), _parse_first_line),
    ("Vault", "vault", ("--version",), _parse_first_line),
    ("Consul", "consul", ("--version",), _parse_first_line),
    ("Nomad", "nomad", ("--version",), _parse_first_line),
    ("Packer", "packer", ("--version",), _parse_first_line),
    ("Serverless", "serverless", ("--version",), _parse_first_line),
    ("CDK (AWS CDK)", "cdk", ("--version",), _parse_first_line),
    ("Fly CLI", "flyctl", ("--version",), _parse_first_line),
    ("Railway CLI", "railway", ("--version",), _parse_first_line),
    ("Netlify CLI", "netlify", ("--version",), _parse_first_line),
    ("Vercel CLI", "vercel", ("--version",), _parse_first_line),
    ("Argo CD CLI", "argocd", ("--version",), _parse_first_line),
    # ---- Shells / Terminals ----
    (
        "PowerShell 5+",
        "powershell",
        ("-Command", "$PSVersionTable.PSVersion.ToString()"),
        _parse_first_line,
    ),
    (
        "PowerShell 7+",
        "pwsh",
        ("-NoProfile", "-Command", "$PSVersionTable.PSVersion.ToString()"),
        _parse_first_line,
    ),
    ("Bash", "bash", ("--version",), _parse_first_line),
    ("Zsh", "zsh", ("--version",), _parse_first_line),
    ("Fish", "fish", ("--version",), _parse_first_line),
    ("Nushell", "nu", ("--version",), _parse_first_line),
    ("Yori", "yori", ("--version",), _parse_first_line),
    # ---- CLI utilities ----
    ("curl", "curl", ("--version",), _parse_first_line),
    ("wget", "wget", ("--version",), _parse_first_line),
    ("jq", "jq", ("--version",), _parse_first_line),
    ("yq", "yq", ("--version",), _parse_first_line),
    ("ripgrep (rg)", "rg", ("--version",), _parse_first_line),
    ("fd", "fd", ("--version",), _parse_first_line),
    ("bat", "bat", ("--version",), _parse_first_line),
    ("eza", "eza", ("--version",), _parse_first_line),
    ("delta", "delta", ("--version",), _parse_first_line),
    ("tig", "tig", ("--version",), _parse_first_line),
    ("OpenSSL", "openssl", ("version",), _parse_first_line),
    ("ssh", "ssh", ("-V",), _parse_first_line),
    ("rsync", "rsync", ("--version",), _parse_first_line),
    ("tmux", "tmux", ("--version",), _parse_first_line),
    ("screen", "screen", ("--version",), _parse_first_line),
    ("htop", "htop", ("--version",), _parse_first_line),
    ("btop", "btop", ("--version",), _parse_first_line),
    ("ncdu", "ncdu", ("--version",), _parse_first_line),
    ("duf", "duf", ("--version",), _parse_first_line),
    ("procs", "procs", ("--version",), _parse_first_line),
    ("hyperfine", "hyperfine", ("--version",), _parse_first_line),
    ("just", "just", ("--version",), _parse_first_line),
    ("fzf", "fzf", ("--version",), _parse_first_line),
    ("zoxide", "zoxide", ("--version",), _parse_first_line),
    ("starship", "starship", ("--version",), _parse_first_line),
    ("lazygit", "lazygit", ("--version",), _parse_first_line),
    ("lazydocker", "lazydocker", ("--version",), _parse_first_line),
    ("doggo (DNS)", "doggo", ("--version",), _parse_first_line),
    ("httpie", "http", ("--version",), _parse_first_line),
    ("xh", "xh", ("--version",), _parse_first_line),
    # ---- Media / Graphics ----
    ("FFmpeg", "ffmpeg", ("--version",), _parse_first_line),
    ("FFprobe", "ffprobe", ("--version",), _parse_first_line),
    ("ImageMagick", "magick", ("--version",), _parse_first_line),
    ("Graphviz (dot)", "dot", ("-V",), _parse_first_line),
    ("ExifTool", "exiftool", ("-ver",), _parse_first_line),
    ("SoX", "sox", ("--version",), _parse_first_line),
    ("yt-dlp", "yt-dlp", ("--version",), _parse_first_line),
    ("7-Zip", "7z", ("--help",), _parse_first_line),
    ("Inkscape", "inkscape", ("--version",), _parse_first_line),
    ("Blender", "blender", ("--version",), _parse_first_line),
    # ---- Editors / IDEs (CLI launchers) ----
    ("VS Code", "code", ("--version",), _parse_first_line),
    ("Vim", "vim", ("--version",), _parse_first_line),
    ("Neovim", "nvim", ("--version",), _parse_first_line),
    ("Emacs", "emacs", ("--version",), _parse_first_line),
    ("Sublime Text", "subl", ("--version",), _parse_first_line),
    ("JetBrains Toolbox", "jetbrains-toolbox", "--version", _parse_first_line),
    # ---- Reverse engineering / Security ----
    ("GDB", "gdb", ("--version",), _parse_first_line),
    ("LLDB", "lldb", ("--version",), _parse_first_line),
    ("Objdump", "objdump", ("--version",), _parse_first_line),
    ("Strace", "strace", ("--version",), _parse_first_line),
    ("Radare2", "r2", ("--version",), _parse_first_line),
    ("Ghidra (server)", "ghidraserver", ("--version",), _parse_first_line),
    ("Nmap", "nmap", ("--version",), _parse_first_line),
    ("Wireshark (tshark)", "tshark", ("--version",), _parse_first_line),
    ("Metasploit (msfconsole)", "msfconsole", "--version", _parse_first_line),
    ("SQLMap", "sqlmap", ("--version",), _parse_first_line),
    ("Hashcat", "hashcat", ("--version",), _parse_first_line),
    ("John (JtR)", "john", ("--version",), _parse_first_line),
    ("Aircrack-ng", "aircrack-ng", ("--version",), _parse_first_line),
    ("YARA", "yara", ("--version",), _parse_first_line),
    ("Binwalk", "binwalk", ("--version",), _parse_first_line),
    ("Apktool", "apktool", ("--version",), _parse_first_line),
    ("Jadx", "jadx", ("--version",), _parse_first_line),
    ("Wireshark (dumpcap)", "dumpcap", ("--version",), _parse_first_line),
]


def _detect_runtimes_direct() -> dict[str, str]:
    """Original detection: direct subprocess calls.

    Works in CLI mode and direct Python calls, but HANGS when called from
    within the MCP server's anyio event loop on Windows (because setting
    ``STARTF_USESTDHANDLES`` on the child process conflicts with the IOCP-
    based ProactorEventLoop).
    """
    import shutil
    import subprocess

    found: dict[str, str] = {}
    for label, exe, args, parser in _RUNTIME_CHECKS:
        path = shutil.which(exe)
        if not path:
            continue
        try:
            result = subprocess.run(
                [exe, *args],
                capture_output=True,
                text=True,
                timeout=15,
                errors="replace",
                creationflags=subprocess.CREATE_NO_WINDOW,
            )
            raw = result.stdout or result.stderr or ""
            version = parser(raw) if parser else raw.strip()
            if version and not _looks_like_error(version):
                found[label] = version
            else:
                found[label] = "(detected, no version info)"
        except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
            found[label] = "(detected, failed to query)"
    return found


def _detect_runtimes() -> dict[str, str]:
    """Detect installed runtimes.  Uses a helper subprocess on Windows
    to work around a conflict between ``STARTF_USESTDHANDLES`` and the
    MCP server's ``ProactorEventLoop`` (the child hangs when std handles
    are explicitly set while an IOCP-based event loop is running).

    On other platforms the detection runs directly (no additional overhead).
    """
    if sys.platform != "win32":
        return _detect_runtimes_direct()

    # Windows + MCP workaround: launch a plain subprocess (no handle
    # redirection at all) that runs the actual detection and writes
    # results to a temp JSON file.
    import json
    import tempfile
    import subprocess

    proj_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    # Two temp files: one for the helper script, one for its output
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".py", delete=False, encoding="utf-8"
    ) as f:
        helper_path = f.name
        out_path = f.name + ".json"

    try:
        with open(helper_path, "w", encoding="utf-8") as f:
            f.write(
                f"import json, sys\n"
                f"sys.path.insert(0, {proj_root!r})\n"
                f"from tools._env_helpers import _detect_runtimes_direct\n"
                f"result = _detect_runtimes_direct()\n"
                f"with open({out_path!r}, 'w') as f2:\n"
                f"    json.dump(result, f2)\n"
            )

        proc = subprocess.Popen(
            [sys.executable, helper_path],
            creationflags=(subprocess.DETACHED_PROCESS | subprocess.CREATE_NO_WINDOW),
        )
        proc.wait(timeout=120)

        if os.path.exists(out_path):
            with open(out_path, encoding="utf-8") as f:
                return json.load(f)

        # Fallback: try direct (may hang on MCP Windows, but worth a shot)
        return _detect_runtimes_direct()
    except Exception:
        return _detect_runtimes_direct()
    finally:
        for p in (helper_path, out_path):
            try:
                os.unlink(p)
            except OSError:
                pass


# ---------------------------------------------------------------------------
# Category definitions + formatter
# ---------------------------------------------------------------------------

CATEGORIES = {
    "system": {
        "label": "System",
        "items": [
            ("system", platform.system()),
            ("release", platform.release()),
            ("version", platform.version()),
            ("hostname", platform.node()),
            ("machine", platform.machine()),
            ("uptime_days", lambda: _get_uptime_days()),
        ],
    },
    "cpu": {
        "label": "CPU",
        "items": [
            ("processor", platform.processor()),
            ("physical_cores", lambda: _get_cpu_count()[0]),
            ("logical_cores", lambda: _get_cpu_count()[1]),
        ],
    },
    "memory": {
        "label": "Memory",
        "items": [
            (
                "total_gb",
                lambda: round(_get_memory_status().ullTotalPhys / (1024**3), 1),
            ),
            (
                "available_gb",
                lambda: round(_get_memory_status().ullAvailPhys / (1024**3), 1),
            ),
            ("usage_pct", lambda: _get_memory_status().dwMemoryLoad),
        ],
    },
    "disk": {
        "label": "Disk (C:\\)",
        "items": [
            ("total_gb", lambda: _get_disk_info()["total_gb"]),
            ("used_gb", lambda: _get_disk_info()["used_gb"]),
            ("free_gb", lambda: _get_disk_info()["free_gb"]),
            ("usage_pct", lambda: _get_disk_info()["usage_pct"]),
        ],
    },
    "gpu": {
        "label": "GPU",
        "items": [
            ("adapters", lambda: _get_gpu_info()),
        ],
    },
    "runtimes": {
        "label": "Runtimes & Toolchains",
        "items": [
            ("detected", lambda: _detect_runtimes()),
        ],
    },
}


def _resolve_value(v):
    return v() if callable(v) else v


def fmt(cat_name: str) -> str:
    """Format a single category as key: value lines (no headers, no decoration)."""
    cat = CATEGORIES[cat_name]
    lines: list[str] = []
    for key, raw in cat["items"]:
        val = _resolve_value(raw)
        if isinstance(val, list):
            val_str = ", ".join(str(x) for x in val) if val else "(none)"
        elif isinstance(val, dict):
            lines.extend(f"  {k}: {v}" for k, v in val.items())
            continue
        elif isinstance(val, float):
            val_str = str(val)
        else:
            val_str = str(val)
        lines.append(f"{key}: {val_str}")
    return "\n".join(lines)
