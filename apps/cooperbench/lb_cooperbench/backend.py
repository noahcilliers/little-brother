"""Host-side Little Brother plumbing: profiles, one session per CooperBench pair, readback.

Talks to the local Convex deployment the same way apps/evals does: `lb join --invite` for agent
profiles, and `npx convex run evals:*` for the internal session functions.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import tempfile
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path

LB_REPO = Path(os.environ.get("LB_REPO", Path(__file__).resolve().parents[3]))
BACKEND_DIR = LB_REPO / "packages" / "backend"
BUNDLE = LB_REPO / "apps" / "connector" / "dist" / "lb.mjs"
PLUGIN_SRC = LB_REPO / "plugin"


def _site_url() -> str:
    if os.environ.get("LB_SITE_URL"):
        return os.environ["LB_SITE_URL"].rstrip("/")
    env_file = BACKEND_DIR / ".env.local"
    if env_file.exists():
        m = re.search(r"^CONVEX_SITE_URL=(\S+)", env_file.read_text(), re.M)
        if m:
            return m.group(1).rstrip("/")
    return "http://127.0.0.1:3211"


def _convex_run(fn: str, args: dict) -> object:
    env = {**os.environ, "CONVEX_AGENT_MODE": os.environ.get("CONVEX_AGENT_MODE", "anonymous")}
    r = subprocess.run(
        ["npx", "convex", "run", fn, json.dumps(args)],
        cwd=BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
        timeout=120,
    )
    if r.returncode != 0:
        raise RuntimeError(f"convex run {fn} failed: {(r.stdout + r.stderr)[-600:]}")
    start = re.search(r"^[\[{]|^null", r.stdout, re.M)
    return json.loads(r.stdout[start.start() :]) if start else None


def session_code(run_id: str) -> str:
    # Codes are capped at 40 chars; a longer one is dropped and hooks fail open silently.
    return f"cb-{hashlib.sha1(run_id.encode()).hexdigest()[:12]}"


@dataclass
class _Pair:
    code: str
    agents: list[str]
    finished: set[str] = field(default_factory=set)


class Backend:
    """One per process. CooperBench runs both agents of a pair as threads in this process."""

    def __init__(self) -> None:
        self.site_url = _site_url()
        self.home = Path(tempfile.mkdtemp(prefix="lb-cooperbench-home-"))
        self._lock = threading.Lock()
        self._joined: set[str] = set()
        self._pairs: dict[str, _Pair] = {}

    def _join(self, handle: str) -> None:
        if handle in self._joined:
            return
        invite = os.environ.get("LB_INVITE_CODE", "calhacks")
        r = subprocess.run(
            ["node", str(BUNDLE), "join", "--url", self.site_url, "--invite", invite, "--as", handle],
            env={**os.environ, "LB_HOME": str(self.home)},
            capture_output=True,
            text=True,
            timeout=60,
        )
        if r.returncode != 0:
            raise RuntimeError(f"lb join {handle} failed: {(r.stdout + r.stderr)[-400:]}")
        self._joined.add(handle)

    def open_pair(self, run_id: str, agents: list[str], name: str) -> str:
        """Joins every agent's profile and opens the pair's session once; returns its code."""
        with self._lock:
            for a in agents:
                self._join(a)
            pair = self._pairs.get(run_id)
            if pair is None:
                pair = _Pair(code=session_code(run_id), agents=list(agents))
                _convex_run("evals:openRun", {"code": pair.code, "name": name[:80]})
                self._pairs[run_id] = pair
            return pair.code

    def config_for_container(self) -> str:
        """The joined profiles, pointed at the host's backend from inside a container."""
        cfg = json.loads((self.home / "config.json").read_text())
        for key in ("siteUrl", "convexUrl"):
            cfg[key] = re.sub(r"//(localhost|127\.0\.0\.1)", "//host.docker.internal", cfg.get(key, ""))
        return json.dumps(cfg, indent=2)

    def finish_agent(self, run_id: str, agent_id: str, log_dir: str | None, settle_s: float) -> None:
        """When the pair's last agent exits: let classification settle, save the snapshot, close."""
        with self._lock:
            pair = self._pairs.get(run_id)
            if pair is None:
                return
            pair.finished.add(agent_id)
            if pair.finished != set(pair.agents):
                return
        time.sleep(settle_s)
        snap = _convex_run("evals:snapshot", {"code": pair.code})
        if log_dir:
            Path(log_dir).mkdir(parents=True, exist_ok=True)
            (Path(log_dir) / "lb_snapshot.json").write_text(json.dumps(snap, indent=2))
        _convex_run("evals:closeRun", {"code": pair.code})
