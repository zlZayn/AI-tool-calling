"""System info tool — get host machine information."""

import ctypes
import platform
from ctypes import wintypes

from tools import tool


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


def _get_total_memory_gb() -> float:
    """Return total physical memory in GB (Windows)."""
    mem = _MEMORYSTATUSEX()
    mem.dwLength = ctypes.sizeof(_MEMORYSTATUSEX)
    ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(mem))
    return round(mem.ullTotalPhys / (1024**3), 1)


@tool(
    name="get_host_info",
    description=(
        "Return basic information about the host computer: "
        "operating system name, release version, machine architecture, "
        "processor model, and total physical memory in GB."
    ),
    parameters={
        "type": "object",
        "properties": {},
        "required": [],
    },
)
def get_host_info() -> str:
    info = {
        "system": platform.system(),
        "release": platform.release(),
        "machine": platform.machine(),
        "processor": platform.processor(),
        "memory_gb": _get_total_memory_gb(),
    }
    lines = [f"{k}: {v}" for k, v in info.items()]
    return "\n".join(lines)
