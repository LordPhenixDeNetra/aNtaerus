from __future__ import annotations

import os
import subprocess
from pathlib import Path


def main() -> int:
    repository_root = Path(__file__).resolve().parents[3]
    environment = os.environ.copy()
    python_path = str(repository_root)

    if environment.get("PYTHONPATH"):
        python_path = f"{python_path}{os.pathsep}{environment['PYTHONPATH']}"

    environment["PYTHONPATH"] = python_path

    result = subprocess.run(["lint-imports"], env=environment, check=False)
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
