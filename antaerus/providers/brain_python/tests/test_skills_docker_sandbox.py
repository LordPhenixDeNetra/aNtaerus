import asyncio
import shutil

import pytest

from antaerus_brain.skills.docker_sandbox import run_python_code


def _run(coro):
    return asyncio.new_event_loop().run_until_complete(coro)


def _docker_available() -> bool:
    return bool(shutil.which("docker"))


ECHO_JSON = '''
import json
import sys
def main(args):
    return {"ok": True, "args": args}
if __name__ == "__main__":
    payload = {}
    if len(sys.argv) > 1:
        try:
            payload = json.loads(sys.argv[1])
        except Exception:
            payload = {"raw": sys.argv[1:]}
    print(json.dumps(main(payload)))
'''


@pytest.mark.skipif(not _docker_available(), reason="docker executable not found")
def test_docker_sandbox_echoes_json():
    result = _run(run_python_code(
        ECHO_JSON,
        args_json='{"hello":"world"}',
        timeout_s=60,
    ))
    assert result.exit_code == 0, result.stderr or result.stdout
    assert '"hello"' in result.stdout or "world" in result.stdout
    assert result.sandbox_kind == "docker"


def test_fallback_local_runs_python():
    result = _run(run_python_code(
        "print('hello-local')",
        force_local_fallback=True,
        timeout_s=10,
    ))
    assert result.exit_code == 0, (
        f"stderr={result.stderr} stdout={result.stdout} err={result.error}"
    )
    assert "hello-local" in result.stdout
    assert "local" in result.sandbox_kind


def test_fallback_timeout_signals_exit_code():
    loop_code = '''
import time
while True:
    time.sleep(0.1)
'''
    result = _run(run_python_code(
        loop_code,
        force_local_fallback=True,
        timeout_s=2,
    ))
    non_zero_or_err = result.exit_code != 0 or result.error is not None
    assert non_zero_or_err, (
        f"attendu timeout ou err, got exit={result.exit_code} "
        f"err={result.error} stdout={result.stdout[:100]}"
    )
    timed_out_or_killed = (
        result.exit_code == 124
        or (result.error and "timeout" in result.error.lower())
        or (result.stderr and "timeout" in result.stderr.lower())
        or result.duration_ms >= 1_500
    )
    assert timed_out_or_killed, (
        f"timeout non detecte exit={result.exit_code} dur={result.duration_ms} "
        f"err={result.error} stderr={result.stderr[:100]}"
    )
