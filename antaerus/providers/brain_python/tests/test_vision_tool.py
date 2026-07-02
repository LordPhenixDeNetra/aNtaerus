from __future__ import annotations

import asyncio
import sys
import types

from antaerus_brain.config import get_settings
from antaerus_brain.tools.vision import VisionTool


class _FakeBox:
    def __init__(self) -> None:
        self.cls = [0]
        self.conf = [0.91]


class _FakeResult:
    names = {0: "person"}
    boxes = [_FakeBox()]


class _FakeYOLO:
    def __init__(self, model_path: str) -> None:
        self.model_path = model_path

    def __call__(self, image_path: str, conf: float = 0.25):
        return [_FakeResult()]


def test_vision_tool_detects_objects_from_image(monkeypatch, tmp_path) -> None:
    image_path = tmp_path / "image.png"
    model_path = tmp_path / "model.pt"
    image_path.write_bytes(b"fake-image")
    model_path.write_bytes(b"fake-model")

    monkeypatch.setenv("ANTAERUS_BRAIN_VISION_MODEL_PATH", str(model_path))
    monkeypatch.setattr("antaerus_brain.tools.vision.find_spec", lambda name: object())
    monkeypatch.setitem(sys.modules, "ultralytics", types.SimpleNamespace(YOLO=_FakeYOLO))
    get_settings.cache_clear()

    tool = VisionTool(get_settings(), {"enabled": True, "default_confidence": 0.25})
    result = asyncio.run(tool.execute({"image_path": str(image_path)}))

    assert result.ok is True
    assert result.result["detections"][0]["label"] == "person"
