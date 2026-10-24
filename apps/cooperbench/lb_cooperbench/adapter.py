"""`claude_code_lb`: CooperBench's Claude Code adapter with the Little Brother plugin loaded.

Everything else (prompt, coop messaging, tools, budget, patch harvest) is the stock `claude_code`
adapter, so a run with `-a claude_code` is the matched baseline.

The stock runner builds its container and claude command through two module-level helpers. Both are
wrapped here; the wrappers only act when the calling thread is inside ClaudeCodeLbRunner.run, because
CooperBench runs a pair's agents as threads in one process.
"""

from __future__ import annotations

import logging
import os
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from cooperbench.agents import AgentResult
from cooperbench.agents.claude_code import adapter as stock
from cooperbench.agents.registry import register

from lb_cooperbench import container
from lb_cooperbench.backend import Backend

logger = logging.getLogger(__name__)


@dataclass
class _Ctx:
    session_code: str
    agent_id: str
    lb_config: str


_local = threading.local()
_state_lock = threading.Lock()
_backend: Backend | None = None
_plugin_dir: Path | None = None


def _ctx() -> _Ctx | None:
    return getattr(_local, "ctx", None)


def _shared() -> tuple[Backend, Path]:
    global _backend, _plugin_dir
    with _state_lock:
        if _backend is None or _plugin_dir is None:
            _backend = Backend()
            _plugin_dir = container.build_plugin_copy()
        return _backend, _plugin_dir


_stock_build_environment = stock._build_environment
_stock_build_claude_command = stock._build_claude_command


def _build_environment(image: str, **kwargs: Any) -> Any:
    env = _stock_build_environment(image, **kwargs)
    ctx = _ctx()
    if ctx is not None:
        _, plugin_dir = _shared()
        container.install(env, plugin_dir, ctx.lb_config)
    return env


def _build_claude_command(*args: Any, **kwargs: Any) -> str:
    ctx = _ctx()
    if ctx is not None:
        kwargs["extra_flags"] = container.claude_flags() + (kwargs.get("extra_flags") or "")
        kwargs["coop_env"] = {**(kwargs.get("coop_env") or {}), **container.agent_env(ctx.session_code, ctx.agent_id)}
    return _stock_build_claude_command(*args, **kwargs)


stock._build_environment = _build_environment
stock._build_claude_command = _build_claude_command


@register("claude_code_lb")
class ClaudeCodeLbRunner(stock.ClaudeCodeRunner):
    def run(self, task: str, image: str, **kwargs: Any) -> AgentResult:
        config = kwargs.get("config") or {}
        agent_id = kwargs.get("agent_id", "agent")
        agents = kwargs.get("agents") or [agent_id]
        log_dir = kwargs.get("log_dir")
        run_id = config.get("run_id") or f"solo-{log_dir or agent_id}"
        if (config.get("backend") or "docker") != "docker":
            raise ValueError("claude_code_lb supports --backend docker only")

        backend, _ = _shared()
        name = "/".join(Path(log_dir).parts[-3:]) if log_dir else run_id
        code = backend.open_pair(run_id, agents, name)
        if log_dir:
            Path(log_dir).mkdir(parents=True, exist_ok=True)
            (Path(log_dir) / "lb_session.txt").write_text(code + "\n")
        _local.ctx = _Ctx(session_code=code, agent_id=agent_id, lb_config=backend.config_for_container())
        try:
            return super().run(task, image, **kwargs)
        finally:
            _local.ctx = None
            try:
                settle = float(os.environ.get("LB_SETTLE_SECONDS", "20"))
                backend.finish_agent(run_id, agent_id, log_dir, settle)
            except Exception:
                logger.warning("Little Brother snapshot/close failed for %s", run_id, exc_info=True)
