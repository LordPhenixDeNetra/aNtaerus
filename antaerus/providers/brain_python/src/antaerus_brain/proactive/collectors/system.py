from __future__ import annotations

import os
import platform
import shutil
import subprocess
import sys
from typing import Any

from antaerus_brain.proactive.collectors.base import (
    BaseCollector,
    CollectorAlert,
    CollectorBriefing,
    CollectorResult,
)


class SystemCollector(BaseCollector):
    name = "system"
    description = "Alertes systeme CPU, disque, memoire"

    def __init__(self, settings, config: dict[str, Any] | None = None):
        super().__init__(settings, config)
        self.paths: list[str] = self.config.get("paths") or ["/" if os.name != "nt" else "C:\\"]
        self.disk_warn_percent: float = float(self.config.get("disk_warn_percent", 85.0))
        self.disk_crit_percent: float = float(self.config.get("disk_crit_percent", 95.0))
        self.load_warn_factor: float = float(self.config.get("load_warn_factor", 2.0))
        self.mem_warn_percent: float = float(self.config.get("mem_warn_percent", 85.0))

    async def _run_internal(self) -> CollectorResult:
        alerts: list[CollectorAlert] = []
        metadata: dict[str, Any] = {
            "os": platform.system(),
            "platform": platform.platform(),
            "python": sys.version,
        }
        for path in self.paths:
            usage = None
            try:
                usage = shutil.disk_usage(path)
            except Exception as exc:  # noqa: BLE001
                alerts.append(CollectorAlert(
                    title=f"Chemin {path} indisponible",
                    message=str(exc),
                    severity="warning",
                    source=self.name,
                ))
                continue
            if usage is None or usage.total <= 0:
                continue
            percent = usage.used * 100.0 / usage.total
            metadata[f"disk.{path}"] = {
                "total": usage.total,
                "used": usage.used,
                "free": usage.free,
                "percent": round(percent, 1),
            }
            if percent >= self.disk_crit_percent:
                alerts.append(CollectorAlert(
                    title=f"Disque plein critique {path}",
                    message=f"utilisation {percent:.1f}% (seuil {self.disk_crit_percent:.0f}%)",
                    severity="critical",
                    source=self.name,
                ))
            elif percent >= self.disk_warn_percent:
                alerts.append(CollectorAlert(
                    title=f"Disque presque plein {path}",
                    message=f"utilisation {percent:.1f}% (seuil {self.disk_warn_percent:.0f}%)",
                    severity="warning",
                    source=self.name,
                ))
        cpu = self._sample_cpu()
        if cpu is not None:
            metadata["cpu_percent"] = cpu
            if cpu >= 90:
                alerts.append(CollectorAlert(
                    title="CPU eleve",
                    message=f"CPU moyen ~{cpu:.0f}%",
                    severity="critical",
                    source=self.name,
                ))
            elif cpu >= 75:
                alerts.append(CollectorAlert(
                    title="CPU charge",
                    message=f"CPU moyen ~{cpu:.0f}%",
                    severity="warning",
                    source=self.name,
                ))
        load = self._load_avg()
        if load is not None:
            metadata["load_avg_1m"] = load
            cpus = os.cpu_count() or 1
            if load >= self.load_warn_factor * cpus:
                alerts.append(CollectorAlert(
                    title="Load average eleve",
                    message=f"1m load {load:.2f} pour {cpus} CPU",
                    severity="warning",
                    source=self.name,
                ))
        mem = self._sample_memory()
        if mem is not None:
            metadata["memory"] = mem
            percent_mem = mem.get("percent", 0.0)
            if percent_mem >= self.mem_warn_percent:
                alerts.append(CollectorAlert(
                    title="Memoire haute",
                    message=f"memoire ~{percent_mem:.0f}%",
                    severity="warning",
                    source=self.name,
                ))
        briefing = CollectorBriefing(
            title="Etat systeme",
            summary=f"CPU {cpu or 'N/A'}% ; disque {len(self.paths)} chemins ; load {load}",
            metadata=metadata,
        )
        return CollectorResult(
            collectorName=self.name,
            success=True,
            briefing=briefing,
            alerts=alerts,
        )

    def _sample_cpu(self) -> float | None:
        try:
            if os.name == "nt":
                # Windows: use wmic cpu loadpercentage via subprocess one shot
                result = subprocess.run(
                    ["wmic", "cpu", "get", "loadpercentage", "/value"],
                    capture_output=True,
                    text=True,
                    timeout=5,
                )
                for line in result.stdout.splitlines():
                    if "=" in line:
                        key, _, value = line.partition("=")
                        if key.strip() == "LoadPercentage":
                            try:
                                return float(value.strip())
                            except ValueError:
                                pass
                return None
            # Unix: idle from /proc/stat one-shot
            try:
                with open("/proc/stat", encoding="utf-8") as fh:
                    line = fh.readline()
                parts = line.split()[1:8]
                values = [int(x) for x in parts]
                total = sum(values)
                idle = values[3] + values[4] if len(values) >= 5 else values[3]
                return float(max(0, 100.0 - (idle * 100.0 / total))) if total > 0 else None
            except Exception:  # noqa: BLE001
                return None
        except Exception:  # noqa: BLE001
            return None

    def _load_avg(self) -> float | None:
        try:
            if hasattr(os, "getloadavg"):
                return float(os.getloadavg()[0])
        except Exception:  # noqa: BLE001
            pass
        return None

    def _sample_memory(self) -> dict[str, Any] | None:
        try:
            if os.name == "nt":
                import ctypes

                class MEMORYSTATUSEX(ctypes.Structure):
                    _fields_ = [
                        ("dwLength", ctypes.c_ulong),
                        ("dwMemoryLoad", ctypes.c_ulong),
                        ("ullTotalPhys", ctypes.c_ulonglong),
                        ("ullAvailPhys", ctypes.c_ulonglong),
                        ("ullTotalPageFile", ctypes.c_ulonglong),
                        ("ullAvailPageFile", ctypes.c_ulonglong),
                        ("ullTotalVirtual", ctypes.c_ulonglong),
                        ("ullAvailVirtual", ctypes.c_ulonglong),
                        ("ullAvailExtendedVirtual", ctypes.c_ulonglong),
                    ]

                stat = MEMORYSTATUSEX()
                stat.dwLength = ctypes.sizeof(stat)
                ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(stat))
                total = int(stat.ullTotalPhys)
                avail = int(stat.ullAvailPhys)
                percent = (total - avail) * 100.0 / total if total > 0 else 0
                return {"total": total, "available": avail, "percent": round(percent, 1)}
            with open("/proc/meminfo", encoding="utf-8") as fh:
                info: dict[str, int] = {}
                for line in fh:
                    key, _, value = line.partition(":")
                    key = key.strip()
                    value = value.strip()
                    value_int = int(value.split()[0]) if value else 0
                    info[key] = value_int * 1024
            total = info.get("MemTotal", 0)
            avail = info.get("MemAvailable", 0)
            percent = (total - avail) * 100.0 / total if total > 0 else 0
            return {"total": total, "available": avail, "percent": round(percent, 1)}
        except Exception:  # noqa: BLE001
            return None
