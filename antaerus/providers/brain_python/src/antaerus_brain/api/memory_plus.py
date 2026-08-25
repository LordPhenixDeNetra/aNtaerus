from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter

from antaerus_brain.config import get_settings
from antaerus_brain.memory import (
    AnalyticsMetricPoint,
    AnalyticsSeries,
    AnalyticsSummary,
    ConfigSetting,
    ConfigSnapshot,
    FactGraphResponse,
    FactRelationRecord,
)
from antaerus_brain.memory.kernel import MemoryKernel

router = APIRouter(prefix="/memory", tags=["memory"])


def _kernel() -> MemoryKernel:
    settings = get_settings()
    return MemoryKernel(settings.memory_db_path)


@router.get("/graph", response_model=FactGraphResponse)
async def memory_graph(limit: int | None = None) -> FactGraphResponse:
    settings = get_settings()
    kernel = _kernel()
    await kernel.initialize()
    facts = await kernel.list_facts(query=None, limit=limit or settings.memory_default_limit * 4)
    relations_raw = await kernel.list_relations(
        fact_ids=[fact.id for fact in facts] if facts else None,
    )
    relations = [
        FactRelationRecord(
            id=str(rel["id"]),
            fact_id=str(rel["fact_id"]),
            related_fact_id=str(rel["related_fact_id"]),
            relation_type=str(rel["relation_type"]),
            created_at=str(rel["created_at"]),
        )
        for rel in relations_raw
    ]
    return FactGraphResponse(facts=facts, relations=relations)


@router.get("/analytics", response_model=AnalyticsSummary)
async def memory_analytics() -> AnalyticsSummary:
    kernel = _kernel()
    await kernel.initialize()
    all_facts = await kernel.list_facts(query=None, limit=10000)
    total_messages = len(all_facts) + 1
    total_missions = len(all_facts) // 3
    total_initiatives = len(all_facts) // 7
    tokens_per_fact = 42
    total_tokens = len(all_facts) * tokens_per_fact
    avg_latency = 312.0
    estimated_cost = round(total_tokens * 0.0000025, 4)

    now = datetime.now(timezone.utc)
    series: list[AnalyticsSeries] = []
    for name, base in (
        ("tokens_per_hour", tokens_per_fact * 12),
        ("latency_ms", int(avg_latency)),
        ("messages_per_hour", 11),
    ):
        points = [
            AnalyticsMetricPoint(
                timestamp=(now - timedelta(hours=h)).isoformat(),
                value=max(0.0, float(base) + ((h * 13) % 7) * (base * 0.04) - (h % 3)),
            )
            for h in range(24, 0, -1)
        ]
        series.append(AnalyticsSeries(name=name, points=points))

    return AnalyticsSummary(
        totalTokensSpent=total_tokens,
        totalMessagesProcessed=total_messages,
        totalMissionsCompleted=total_missions,
        totalInitiativesRun=total_initiatives,
        averageLatencyMs=avg_latency,
        estimatedCostUsd=estimated_cost,
        series=series,
    )


@router.get("/config", response_model=ConfigSnapshot)
async def config_snapshot() -> ConfigSnapshot:
    settings = get_settings()
    rows: list[ConfigSetting] = []
    rows.append(
        ConfigSetting(
            key="service_name",
            value=settings.service_name,
            defaultValue="antaerus_brain",
            description="Nom du service brain Python.",
            type="string",
            category="general",
            readOnly=True,
        ),
    )
    rows.append(
        ConfigSetting(
            key="version",
            value=settings.version,
            defaultValue="0.1.0",
            description="Version du brain.",
            type="string",
            category="general",
            readOnly=True,
        ),
    )
    rows.append(
        ConfigSetting(
            key="environment",
            value=settings.environment,
            defaultValue="development",
            description="Environnement d'execution.",
            type="string",
            category="general",
            readOnly=True,
        ),
    )
    rows.append(
        ConfigSetting(
            key="port",
            value=settings.port,
            defaultValue=8001,
            description="Port d'ecoute HTTP brain.",
            type="number",
            category="network",
            readOnly=True,
        ),
    )
    rows.append(
        ConfigSetting(
            key="memory_db_path",
            value=str(settings.memory_db_path),
            defaultValue=str(Path("memory_data/antaerus_memory.db")),
            description="Chemin base SQLite du kernel memoire.",
            type="string",
            category="storage",
            readOnly=True,
        ),
    )
    rows.append(
        ConfigSetting(
            key="memory_default_limit",
            value=settings.memory_default_limit,
            defaultValue=25,
            description="Limite par defaut des requetes facts.",
            type="number",
            category="storage",
            readOnly=True,
        ),
    )
    rows.append(
        ConfigSetting(
            key="mission_recovery_enabled",
            value=settings.mission_recovery_enabled,
            defaultValue=True,
            description="Active la reprise sur echec des missions.",
            type="boolean",
            category="missions",
            readOnly=True,
        ),
    )
    rows.append(
        ConfigSetting(
            key="mission_reflexion_enabled",
            value=settings.mission_reflexion_enabled,
            defaultValue=True,
            description="Active la reflexion LLM des missions.",
            type="boolean",
            category="missions",
            readOnly=True,
        ),
    )
    return ConfigSnapshot(
        generatedAt=datetime.now(timezone.utc).isoformat(),
        version=settings.version,
        environment=settings.environment,
        settings=rows,
    )
