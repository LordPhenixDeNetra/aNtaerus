from __future__ import annotations

import asyncio
import shutil
import sys
import time
from dataclasses import dataclass


class SandboxUnavailableError(RuntimeError):
    pass


@dataclass
class SandboxRunResult:
    exit_code: int
    stdout: str
    stderr: str
    duration_ms: int
    sandbox_kind: str
    fuel_used: int | None = None
    error: str | None = None


_DOCKER_BIN: str | None = None
_PYTHON_BIN: str | None = None


def _find_docker() -> str | None:
    global _DOCKER_BIN
    if _DOCKER_BIN is not None:
        return _DOCKER_BIN or None
    found = shutil.which("docker")
    if found:
        _DOCKER_BIN = found
    else:
        _DOCKER_BIN = ""
    return found


def _find_python() -> str:
    global _PYTHON_BIN
    if _PYTHON_BIN is not None:
        return _PYTHON_BIN
    found: str | None = (
        sys.executable
        or shutil.which("python3")
        or shutil.which("python")
    )
    if found is None:
        raise RuntimeError("Python executable introuvable sur ce systeme")
    _PYTHON_BIN = found
    return found


async def run_python_code(
    code: str,
    *,
    args_json: str = "{}",
    timeout_s: int = 30,
    memory_mb: int = 256,
    network: bool = False,
    pids_limit: int = 64,
    tmpfs_size_mb: int = 64,
    force_local_fallback: bool = False,
) -> SandboxRunResult:
    start = time.perf_counter()
    docker = None if force_local_fallback else _find_docker()
    if docker:
        try:
            return await _run_via_docker(
                code,
                docker_bin=docker,
                args_json=args_json,
                timeout_s=timeout_s,
                memory_mb=memory_mb,
                network=network,
                pids_limit=pids_limit,
                tmpfs_size_mb=tmpfs_size_mb,
                start=start,
            )
        except (FileNotFoundError, PermissionError, OSError):
            pass
    return await _run_via_local_python(
        code,
        args_json=args_json,
        timeout_s=timeout_s,
        start=start,
        network=network,
    )


async def _run_via_docker(
    code: str,
    *,
    docker_bin: str,
    args_json: str,
    timeout_s: int,
    memory_mb: int,
    network: bool,
    pids_limit: int,
    tmpfs_size_mb: int,
    start: float,
) -> SandboxRunResult:
    args = [
        docker_bin,
        "run",
        "--rm",
        "--network" if network else "--network",
        "bridge" if network else "none",
        "--read-only",
        "--tmpfs",
        f"/tmp:rw,noexec,nosuid,size={tmpfs_size_mb}m",
        "--cap-drop=ALL",
        f"--memory={memory_mb}m",
        f"--pids-limit={pids_limit}",
        "python:3.11-slim",
        "python",
        "-c",
        code,
        args_json,
    ]
    proc = await asyncio.create_subprocess_exec(
        *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout_bytes, stderr_bytes = await asyncio.wait_for(
            proc.communicate(),
            timeout=float(timeout_s),
        )
        exit_code = int(proc.returncode or 0)
    except asyncio.TimeoutError:
        try:
            proc.kill()
        except (ProcessLookupError, OSError):
            pass
        try:
            await proc.wait()
        except (ProcessLookupError, OSError):
            pass
        duration_ms = int((time.perf_counter() - start) * 1000)
        return SandboxRunResult(
            exit_code=124,
            stdout="",
            stderr=f"sandbox timeout apres {timeout_s}s",
            duration_ms=duration_ms,
            sandbox_kind="docker",
            error=f"timeout apres {timeout_s}s",
        )
    duration_ms = int((time.perf_counter() - start) * 1000)
    return SandboxRunResult(
        exit_code=exit_code,
        stdout=_safe_decode(stdout_bytes),
        stderr=_safe_decode(stderr_bytes),
        duration_ms=duration_ms,
        sandbox_kind="docker",
    )


async def _run_via_local_python(
    code: str,
    *,
    args_json: str,
    timeout_s: int,
    start: float,
    network: bool,
) -> SandboxRunResult:
    python_bin = _find_python()
    isolation_flags = ["-I", "-S"]
    network_flag: list[str] = []
    if not network:
        network_flag = []
    proc = await asyncio.create_subprocess_exec(
        python_bin,
        *isolation_flags,
        *network_flag,
        "-c",
        code,
        args_json,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout_bytes, stderr_bytes = await asyncio.wait_for(
            proc.communicate(),
            timeout=float(timeout_s),
        )
        exit_code = int(proc.returncode or 0)
    except asyncio.TimeoutError:
        try:
            proc.kill()
        except (ProcessLookupError, OSError):
            pass
        try:
            await proc.wait()
        except (ProcessLookupError, OSError):
            pass
        duration_ms = int((time.perf_counter() - start) * 1000)
        return SandboxRunResult(
            exit_code=124,
            stdout="",
            stderr=f"fallback local timeout apres {timeout_s}s",
            duration_ms=duration_ms,
            sandbox_kind="local-fallback",
            error=f"timeout apres {timeout_s}s",
        )
    duration_ms = int((time.perf_counter() - start) * 1000)
    return SandboxRunResult(
        exit_code=exit_code,
        stdout=_safe_decode(stdout_bytes),
        stderr=_safe_decode(stderr_bytes),
        duration_ms=duration_ms,
        sandbox_kind="local-fallback",
    )


def _safe_decode(raw: bytes | None) -> str:
    if not raw:
        return ""
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        return raw.decode("utf-8", errors="replace")
