from antaerus.kernel.settings import FoundationSettings
from antaerus_brain.config import get_settings


def test_kernel_secretstr_masks_repr_and_json() -> None:
    settings = FoundationSettings()

    assert "development-secret" not in repr(settings)
    assert "development-secret" not in settings.model_dump_json()
    assert "***" in settings.model_dump_json()


def test_brain_secretstr_masks_repr_and_string() -> None:
    settings = get_settings()

    assert "development-secret" not in repr(settings)
    assert str(settings.api_secret) == "**********"
    assert settings.api_secret.get_secret_value() == "development-secret"
