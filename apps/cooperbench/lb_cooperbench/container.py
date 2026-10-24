"""Puts the Little Brother connector and plugin inside a CooperBench task container."""

from __future__ import annotations

import json
import shlex
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any

from lb_cooperbench.backend import BUNDLE, PLUGIN_SRC

CONTAINER_LB_DIR = "/opt/lb"
CONTAINER_PLUGIN_DIR = f"{CONTAINER_LB_DIR}/plugin"
CONTAINER_MCP_CONFIG = f"{CONTAINER_LB_DIR}/mcp.json"
CONTAINER_LB_HOME = f"{CONTAINER_LB_DIR}/home"
CONTAINER_SESSION_DIR = f"{CONTAINER_LB_DIR}/sessions"


def build_plugin_copy() -> Path:
    """plugin/ minus SessionEnd and .mcp.json.

    `claude -p` exits as soon as its task is done, and SessionEnd would take that agent out of every
    later comparison while its partner is still working. The adapter closes the pair's session once both
    agents finish. The MCP server is passed with --mcp-config instead, since .mcp.json points at
    CLAUDE_PLUGIN_DATA, which a --plugin-dir load doesn't set.
    """
    if not BUNDLE.exists():
        raise FileNotFoundError(f"{BUNDLE} is missing; build it with `npx tsup --config tsup.bundle.config.ts`")
    out = Path(tempfile.mkdtemp(prefix="lb-cooperbench-plugin-")) / "plugin"
    shutil.copytree(PLUGIN_SRC, out)
    (out / ".mcp.json").unlink(missing_ok=True)
    hooks_file = out / "hooks" / "hooks.json"
    hooks = json.loads(hooks_file.read_text())
    hooks["hooks"].pop("SessionEnd", None)
    hooks_file.write_text(json.dumps(hooks, indent=2))
    return out


def _docker(env: Any) -> tuple[str, str]:
    container_id = getattr(env, "container_id", None)
    if not container_id:
        raise RuntimeError("claude_code_lb needs the docker backend (no container_id on this environment)")
    return env.config.executable, container_id


def _exec(env: Any, command: str) -> None:
    result = env.execute({"command": command}, timeout=60)
    if result.get("returncode") not in (0, None):
        raise RuntimeError(f"container command failed: {command}\n{(result.get('output') or '')[:500]}")


def install(env: Any, plugin_dir: Path, lb_config_json: str) -> None:
    """Copies lb, the plugin and the joined profiles in. Node arrives later, from Claude Code's setup."""
    docker, cid = _docker(env)
    _exec(env, f"mkdir -p {CONTAINER_LB_HOME} {CONTAINER_SESSION_DIR}")
    subprocess.run([docker, "cp", str(BUNDLE), f"{cid}:/usr/local/bin/lb"], check=True, capture_output=True)
    subprocess.run([docker, "cp", str(plugin_dir), f"{cid}:{CONTAINER_LB_DIR}/"], check=True, capture_output=True)
    _exec(env, "chmod +x /usr/local/bin/lb")
    mcp = {"mcpServers": {"lb": {"command": "lb", "args": ["mcp"]}}}
    _write(env, CONTAINER_MCP_CONFIG, json.dumps(mcp))
    _write(env, f"{CONTAINER_LB_HOME}/config.json", lb_config_json)


def _write(env: Any, path: str, content: str) -> None:
    _exec(env, f"printf %s {shlex.quote(content)} > {shlex.quote(path)}")


def agent_env(session_code: str, agent_id: str) -> dict[str, str]:
    return {
        "LB_HOME": CONTAINER_LB_HOME,
        "LB_PROFILE": agent_id,
        "LB_SESSION": session_code,
        "LB_SESSION_DIR": CONTAINER_SESSION_DIR,
    }


def claude_flags() -> str:
    return f"--plugin-dir {CONTAINER_PLUGIN_DIR} --mcp-config {CONTAINER_MCP_CONFIG} "
