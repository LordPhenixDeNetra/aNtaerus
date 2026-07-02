from __future__ import annotations

from pydantic import BaseModel, Field

from antaerus_brain.memory import FactInput
from antaerus_brain.memory.kernel import MemoryKernel
from antaerus_brain.tools.base import BaseTool


class MemoryToolInput(BaseModel):
    subject: str = Field(min_length=1)
    predicate: str = Field(min_length=1)
    object: str = Field(min_length=1)
    category: str | None = None
    confidence: float = 0.7
    source_event_id: str | None = None
    fact_id: str | None = None


class MemoryTool(BaseTool):
    name = "memory_tool"
    description = "Ecrit une note ou un fait structuré dans le kernel mémoire"
    risk_level = "medium"
    category = "memory"
    autonomy_level = 1
    input_model = MemoryToolInput
    operations = ("remember",)

    async def _run(self, payload: MemoryToolInput):
        kernel = MemoryKernel(self.settings.memory_db_path)
        await kernel.initialize()
        fact = await kernel.upsert_fact(
            FactInput(
                subject=payload.subject,
                predicate=payload.predicate,
                object=payload.object,
                category=payload.category or self.config.get("default_category", "notes"),
                confidence=payload.confidence,
                source_event_id=payload.source_event_id,
                fact_id=payload.fact_id,
            )
        )
        return self.success({"fact": fact.model_dump()})
