"""Validate project files against tool_schema.json naming convention.

Usage:
    python tests/test_naming_convention.py

Checks:
  - Server file exists, `Server("...")` declaration matches {verb}-{noun}
  - Tool file exists, `@tool(name="...")` matches {verb}_{noun}
  - .mcp.json references the correct server files
"""

import json
import os
import re
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ---------------------------------------------------------------------------
# reporting helpers
# ---------------------------------------------------------------------------

_passed = 0
_failed = 0
_errors: list[str] = []


def _ok(msg: str) -> None:
    global _passed
    _passed += 1
    print(f"  [OK] {msg}")


def _fail(msg: str) -> None:
    global _failed
    _failed += 1
    _errors.append(msg)
    print(f"  [FAIL] {msg}")


# ---------------------------------------------------------------------------
# file content checks (grep-based)
# ---------------------------------------------------------------------------


def _file_contains(path: str, pattern: str) -> bool:
    """Check if a file contains the given regex pattern."""
    try:
        with open(path, encoding="utf-8") as f:
            return bool(re.search(pattern, f.read()))
    except FileNotFoundError:
        return False


def _find_declared_server_name(path: str) -> str | None:
    """Extract Server('...') name from a server file."""
    try:
        with open(path, encoding="utf-8") as f:
            m = re.search(r'Server\s*\(\s*["\']([^"\']+)["\']\s*\)', f.read())
            return m.group(1) if m else None
    except FileNotFoundError:
        return None


def _find_declared_tool_name(path: str) -> str | None:
    """Extract first @tool(name='...') from a tool file."""
    try:
        with open(path, encoding="utf-8") as f:
            m = re.search(r'@tool\s*\([^)]*name\s*=\s*["\']([^"\']+)["\']', f.read())
            return m.group(1) if m else None
    except FileNotFoundError:
        return None


def _find_all_tool_names(path: str) -> set[str]:
    """Extract ALL @tool(name='...') from a file."""
    try:
        with open(path, encoding="utf-8") as f:
            return set(
                re.findall(r'@tool\s*\([^)]*name\s*=\s*["\']([^"\']+)["\']', f.read())
            )
    except FileNotFoundError:
        return set()


# ---------------------------------------------------------------------------
# main validation
# ---------------------------------------------------------------------------


def main() -> int:
    global _passed, _failed, _errors

    schema_path = os.path.join(BASE_DIR, "tests", "tool_schema.json")
    if not os.path.exists(schema_path):
        print(f"[ERROR] tool_schema.json not found at {schema_path}")
        return 1

    with open(schema_path, encoding="utf-8") as f:
        schema = json.load(f)

    convention = schema.get("naming_convention", {})
    print("--- Naming convention ---")
    print(
        f"    Server: {convention['server']['name']} -> {convention['server']['file']}"
    )
    print(f"    Tool:   {convention['tool']['name']} -> {convention['tool']['file']}")
    print()

    # ------------------------------------------------------------------
    # Validate each server + its tools
    # ------------------------------------------------------------------
    for server in schema.get("servers", []):
        verb = server["verb"]
        server_noun = server["noun"]
        server_name = f"{verb}-{server_noun}"
        # Convert kebab-case noun to snake_case for filename
        server_file_noun = server_noun.replace("-", "_")
        server_file = f"{verb}_{server_file_noun}_server.py"
        server_path = os.path.join(BASE_DIR, "servers", server_file)

        print(f"[Server] {server_name}")
        desc = server.get("description", "")
        if desc:
            print(f'     "{desc}"')

        # 1. Server file exists
        if not os.path.exists(server_path):
            _fail(f"Server file missing: {server_file}")
            print()
            continue
        _ok(f"File exists: {server_file}")

        # 2. Server file declares correct name
        declared = _find_declared_server_name(server_path)
        if declared is None:
            _fail(f"Could not find Server('...') declaration in {server_file}")
        elif declared != server_name:
            _fail(
                f'Server name mismatch: declared "{declared}", expected "{server_name}"'
            )
        else:
            _ok(f'Server name: "{declared}"')

        # 3. Resolve tool file (shared_file overrides per-tool file)
        shared_file = server.get("shared_file")

        for tool in server.get("tools", []):
            tool_noun = tool["noun"]
            tool_name = f"{verb}_{tool_noun}"
            tdesc = tool.get("description", "")

            if shared_file:
                tool_file = shared_file
            else:
                tool_file = f"{tool_name}.py"
            tool_path = os.path.join(BASE_DIR, "tools", tool_file)

            print(f"     Tool: {tool_name}")
            if tdesc:
                print(f'        "{tdesc}"')

            # Tool file exists
            if not os.path.exists(tool_path):
                _fail(f"  Tool file missing: tools/{tool_file}")
                continue
            _ok(f"  File exists: tools/{tool_file}")

            # @tool(name=...) matches
            declared_tool = _find_declared_tool_name(tool_path)
            if declared_tool is None:
                _fail(f"  Could not find @tool(name=...) in tools/{tool_file}")
            elif not shared_file and declared_tool != tool_name:
                _fail(
                    f'  Tool name mismatch: declared "{declared_tool}", expected "{tool_name}"'
                )
            elif not shared_file:
                _ok(f'  Tool name: "{declared_tool}"')

        # If shared_file, verify ALL expected tool names exist in it
        if shared_file:
            tool_path = os.path.join(BASE_DIR, "tools", shared_file)
            declared_set = _find_all_tool_names(tool_path)
            expected_set = {f"{verb}_{t['noun']}" for t in server.get("tools", [])}
            missing = expected_set - declared_set
            if missing:
                for m in sorted(missing):
                    _fail(f'  @tool(name="{m}") not found in {shared_file}')
            else:
                _ok(f"  All {len(expected_set)} tools found in {shared_file}")

        print()

    # ------------------------------------------------------------------
    # Cross-check .mcp.json
    # ------------------------------------------------------------------
    mcp_path = schema.get("cross_checks", {}).get("mcp_json")
    if mcp_path:
        abs_mcp = os.path.join(BASE_DIR, mcp_path)
        if not os.path.exists(abs_mcp):
            _fail(f"mcp.json not found at {mcp_path}")
        else:
            print(f"[Cross-check] {mcp_path}")
            with open(abs_mcp, encoding="utf-8") as f:
                mcp_data = json.load(f)

            mcp_servers = mcp_data.get("mcpServers", {})
            for server in schema.get("servers", []):
                verb = server["verb"]
                server_noun = server["noun"]
                server_name = f"{verb}-{server_noun}"

                if server_name not in mcp_servers:
                    _fail(f'Server "{server_name}" not registered in .mcp.json')
                    continue

                entry = mcp_servers[server_name]
                server_file_noun = server_noun.replace("-", "_")
                expected_file = f"{verb}_{server_file_noun}_server.py"

                # Check the args list contains the server file path
                args = entry.get("args", [])
                found = any(f"servers/{expected_file}" in arg for arg in args)
                if found:
                    _ok(f'"{server_name}" → servers/{expected_file}')
                else:
                    _fail(
                        f'"{server_name}" args do not reference servers/{expected_file}'
                    )
            print()

    # ------------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------------
    total = _passed + _failed
    print(f"{'=' * 40}")
    print(f"  Total: {total}  |  Passed: {_passed}  |  Failed: {_failed}")
    print(f"{'=' * 40}")
    if _errors:
        print("\nAll failures:")
        for e in _errors:
            print(f"   {e}")

    return 1 if _failed > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
