from __future__ import annotations

from importlib.util import find_spec
from pathlib import Path

from pydantic import BaseModel, Field

from antaerus_brain.tools.base import BaseTool, ToolAvailability


class VisionToolInput(BaseModel):
    image_path: str | None = None
    screen: bool = False
    confidence: float | None = Field(default=None, ge=0, le=1)


class VisionTool(BaseTool):
    name = "vision"
    description = "Detection locale minimale par image si le modele et ultralytics sont disponibles"
    risk_level = "medium"
    category = "vision"
    autonomy_level = 2
    input_model = VisionToolInput
    operations = ("detect",)

    def _availability(self) -> ToolAvailability:
        if find_spec("ultralytics") is None:
            return ToolAvailability(
                enabled=True,
                available=False,
                reason="ultralytics not installed",
            )
        if self.settings.vision_model_path is None:
            return ToolAvailability(
                enabled=True,
                available=False,
                reason="vision model not configured",
            )
        if not self.settings.vision_model_path.exists():
            return ToolAvailability(
                enabled=True,
                available=False,
                reason="vision model path not found",
            )
        return ToolAvailability(enabled=True, available=True)

    async def _run(self, payload: VisionToolInput):
        if payload.screen and not self.settings.vision_enable_screen_capture:
            return self.denied("screen capture is disabled")

        image_path = self._resolve_image_path(payload)
        if image_path is None:
            return self.error_result("image_path is required when screen capture is disabled")
        if not image_path.exists():
            return self.error_result(f"image not found: {image_path}")

        from ultralytics import YOLO  # type: ignore[import-not-found]

        model = YOLO(str(self.settings.vision_model_path))
        results = model(
            str(image_path),
            conf=payload.confidence or self.config.get("default_confidence", 0.25),
        )
        detections: list[dict[str, object]] = []
        for result in results:
            names = getattr(result, "names", {})
            boxes = getattr(result, "boxes", None)
            if boxes is None:
                continue
            for box in boxes:
                class_id = int(box.cls[0])
                detections.append(
                    {
                        "label": names.get(class_id, str(class_id)),
                        "confidence": float(box.conf[0]),
                    }
                )

        return self.success({"image": str(image_path), "detections": detections})

    def _resolve_image_path(self, payload: VisionToolInput) -> Path | None:
        if payload.screen:
            try:
                from PIL import ImageGrab
            except ImportError:
                return None
            screenshot = ImageGrab.grab()
            target = self.settings.tools_sandbox_root / "vision_capture.png"
            screenshot.save(target)
            return target

        if payload.image_path:
            return Path(payload.image_path)
        return self.settings.vision_default_image_path
