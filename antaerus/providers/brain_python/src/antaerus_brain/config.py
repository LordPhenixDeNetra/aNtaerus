from __future__ import annotations

from dataclasses import dataclass, field
from functools import lru_cache
from os import getenv
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv
from pydantic import SecretStr

ProviderName = Literal["anthropic", "openai", "mistral", "deepseek", "ollama"]


@dataclass(frozen=True)
class Settings:
    service_name: str
    version: str
    port: int
    environment: str
    api_secret: SecretStr
    assistant_name: str
    assistant_system_prompt: str
    default_provider: ProviderName
    anthropic_api_key: SecretStr
    openai_api_key: SecretStr
    mistral_api_key: SecretStr
    deepseek_api_key: SecretStr
    anthropic_model: str
    openai_model: str
    mistral_model: str
    deepseek_model: str
    ollama_base_url: str
    ollama_model: str
    llm_timeout_seconds: float
    memory_db_path: Path
    memory_topics_dir: Path
    memory_default_limit: int
    tools_config_path: Path = field(
        default_factory=lambda: Path(__file__).resolve().parents[4] / "config" / "tools.yaml"
    )
    tools_sandbox_root: Path = field(default_factory=lambda: Path(__file__).resolve().parents[4])
    tool_request_timeout_seconds: float = 15.0
    engine_base_url: str = "http://localhost:7000"
    browser_user_agent: str = "aNtaerus/0.1 (+https://localhost)"
    browser_timeout_seconds: float = 12.0
    weather_timeout_seconds: float = 10.0
    google_client_id: str = ""
    google_client_secret: SecretStr = field(default_factory=lambda: SecretStr(""))
    google_refresh_token: SecretStr = field(default_factory=lambda: SecretStr(""))
    google_redirect_uri: str = "http://localhost/oauth/google/callback"
    gmail_sender_email: str = ""
    vision_model_path: Path | None = None
    vision_default_image_path: Path | None = None
    vision_enable_screen_capture: bool = False
    mission_max_steps: int = 20
    mission_llm_timeout_seconds: float = 30.0
    mission_recovery_enabled: bool = True
    mission_reflexion_enabled: bool = True
    proactive_enabled: bool = True
    proactive_max_initiative_budget: int = 50000
    curator_cron_hour: int = 2
    curator_autonomy_level: int = 3
    skills_db_path: Path = field(
        default_factory=lambda: Path(__file__).resolve().parents[4] / "memory_data" / "antaerus_skills.db"
    )
    skills_root: Path = field(
        default_factory=lambda: Path(__file__).resolve().parents[4] / "skills_data"
    )


def _project_root() -> Path:
    return Path(__file__).resolve().parents[4]


def _project_env_path() -> Path:
    return _project_root() / ".env"


def _default_memory_db_path() -> Path:
    return _project_root() / "memory_data" / "antaerus_memory.db"


def _default_memory_topics_dir() -> Path:
    return _project_root() / "memory_data" / "topics"


def _default_tools_config_path() -> Path:
    return _project_root() / "config" / "tools.yaml"


def _parse_bool(raw_value: str, *, default: bool) -> bool:
    normalized = raw_value.strip().lower()
    if not normalized:
        return default
    return normalized in {"1", "true", "yes", "on"}


def _require_supported_provider(provider: str) -> ProviderName:
    normalized = provider.strip().lower()
    if normalized not in {"anthropic", "openai", "mistral", "deepseek", "ollama"}:
        raise ValueError(f"Unsupported default provider: {provider}")

    return normalized  # type: ignore[return-value]


def _resolve_project_path(raw_value: str, fallback: Path) -> Path:
    if not raw_value.strip():
        return fallback

    candidate = Path(raw_value)
    if candidate.is_absolute():
        return candidate

    return _project_root() / candidate


def _load_project_env() -> None:
    load_dotenv(_project_env_path(), override=False)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    _load_project_env()

    port = int(getenv("ANTAERUS_BRAIN_PORT", "8000"))
    llm_timeout_seconds = float(getenv("ANTAERUS_BRAIN_LLM_TIMEOUT_SECONDS", "30"))
    memory_default_limit = int(getenv("ANTAERUS_BRAIN_MEMORY_DEFAULT_LIMIT", "25"))
    tool_request_timeout_seconds = float(
        getenv("ANTAERUS_BRAIN_TOOL_REQUEST_TIMEOUT_SECONDS", "15")
    )
    memory_db_path = _resolve_project_path(
        getenv("ANTAERUS_BRAIN_MEMORY_DB_PATH", str(_default_memory_db_path())),
        _default_memory_db_path(),
    )
    memory_topics_dir = _resolve_project_path(
        getenv("ANTAERUS_BRAIN_MEMORY_TOPICS_DIR", str(_default_memory_topics_dir())),
        _default_memory_topics_dir(),
    )
    tools_config_path = _resolve_project_path(
        getenv("ANTAERUS_BRAIN_TOOLS_CONFIG_PATH", str(_default_tools_config_path())),
        _default_tools_config_path(),
    )
    tools_sandbox_root = _resolve_project_path(
        getenv("ANTAERUS_BRAIN_TOOLS_SANDBOX_ROOT", str(_project_root())),
        _project_root(),
    )
    browser_timeout_seconds = float(getenv("ANTAERUS_BRAIN_BROWSER_TIMEOUT_SECONDS", "12"))
    weather_timeout_seconds = float(getenv("ANTAERUS_BRAIN_WEATHER_TIMEOUT_SECONDS", "10"))
    mission_max_steps = int(getenv("ANTAERUS_BRAIN_MISSION_MAX_STEPS", "20"))
    mission_llm_timeout_seconds = float(getenv("ANTAERUS_BRAIN_MISSION_LLM_TIMEOUT_SECONDS", "30"))
    mission_recovery_enabled = _parse_bool(
        getenv("ANTAERUS_BRAIN_MISSION_RECOVERY_ENABLED", ""),
        default=True,
    )
    mission_reflexion_enabled = _parse_bool(
        getenv("ANTAERUS_BRAIN_MISSION_REFLEXION_ENABLED", ""),
        default=True,
    )
    proactive_enabled = _parse_bool(
        getenv("ANTAERUS_BRAIN_PROACTIVE_ENABLED", ""),
        default=True,
    )
    proactive_max_initiative_budget = int(
        getenv("ANTAERUS_BRAIN_PROACTIVE_MAX_BUDGET", "50000")
    )
    curator_cron_hour = int(getenv("ANTAERUS_BRAIN_CURATOR_CRON_HOUR", "2"))
    curator_autonomy_level = int(getenv("ANTAERUS_BRAIN_CURATOR_AUTONOMY_LEVEL", "3"))
    skills_db_path = _resolve_project_path(
        getenv("ANTAERUS_BRAIN_SKILLS_DB_PATH", ""),
        _project_root() / "memory_data" / "antaerus_skills.db",
    )
    skills_root = _resolve_project_path(
        getenv("ANTAERUS_BRAIN_SKILLS_ROOT", ""),
        _project_root() / "skills_data",
    )
    vision_model_raw = getenv("ANTAERUS_BRAIN_VISION_MODEL_PATH", "").strip()
    vision_image_raw = getenv("ANTAERUS_BRAIN_VISION_DEFAULT_IMAGE_PATH", "").strip()

    settings = Settings(
        service_name="brain_python",
        version=getenv("ANTAERUS_BRAIN_VERSION", "0.1.0"),
        port=port,
        environment=getenv("ANTAERUS_ENV", "development"),
        api_secret=SecretStr(getenv("ANTAERUS_BRAIN_API_SECRET", "development-secret")),
        assistant_name=getenv("ANTAERUS_BRAIN_ASSISTANT_NAME", "aNtaerus"),
        assistant_system_prompt=getenv("ANTAERUS_BRAIN_ASSISTANT_SYSTEM_PROMPT", ""),
        default_provider=_require_supported_provider(
            getenv("ANTAERUS_BRAIN_DEFAULT_PROVIDER", "ollama")
        ),
        anthropic_api_key=SecretStr(getenv("ANTAERUS_ANTHROPIC_API_KEY", "")),
        openai_api_key=SecretStr(getenv("ANTAERUS_OPENAI_API_KEY", "")),
        mistral_api_key=SecretStr(getenv("ANTAERUS_MISTRAL_API_KEY", "")),
        deepseek_api_key=SecretStr(getenv("ANTAERUS_DEEPSEEK_API_KEY", "")),
        anthropic_model=getenv(
            "ANTAERUS_BRAIN_ANTHROPIC_MODEL",
            "anthropic/claude-3-5-sonnet-latest",
        ),
        openai_model=getenv("ANTAERUS_BRAIN_OPENAI_MODEL", "openai/gpt-4o-mini"),
        mistral_model=getenv(
            "ANTAERUS_BRAIN_MISTRAL_MODEL",
            "mistral/mistral-large-latest",
        ),
        deepseek_model=getenv("ANTAERUS_BRAIN_DEEPSEEK_MODEL", "deepseek/deepseek-chat"),
        ollama_base_url=getenv("ANTAERUS_BRAIN_OLLAMA_BASE_URL", "http://localhost:11434"),
        ollama_model=getenv("ANTAERUS_BRAIN_OLLAMA_MODEL", "llama3.1:8b"),
        llm_timeout_seconds=llm_timeout_seconds,
        memory_db_path=memory_db_path,
        memory_topics_dir=memory_topics_dir,
        memory_default_limit=memory_default_limit,
        tools_config_path=tools_config_path,
        tools_sandbox_root=tools_sandbox_root,
        tool_request_timeout_seconds=tool_request_timeout_seconds,
        engine_base_url=getenv("ANTAERUS_BRAIN_ENGINE_BASE_URL", "http://localhost:7000"),
        browser_user_agent=getenv(
            "ANTAERUS_BRAIN_BROWSER_USER_AGENT",
            "aNtaerus/0.1 (+https://localhost)",
        ),
        browser_timeout_seconds=browser_timeout_seconds,
        weather_timeout_seconds=weather_timeout_seconds,
        google_client_id=getenv("ANTAERUS_GOOGLE_CLIENT_ID", ""),
        google_client_secret=SecretStr(getenv("ANTAERUS_GOOGLE_CLIENT_SECRET", "")),
        google_refresh_token=SecretStr(getenv("ANTAERUS_GOOGLE_REFRESH_TOKEN", "")),
        google_redirect_uri=getenv(
            "ANTAERUS_GOOGLE_REDIRECT_URI",
            "http://localhost/oauth/google/callback",
        ),
        gmail_sender_email=getenv("ANTAERUS_GMAIL_SENDER_EMAIL", ""),
        vision_model_path=(
            _resolve_project_path(vision_model_raw, _project_root()) if vision_model_raw else None
        ),
        vision_default_image_path=(
            _resolve_project_path(vision_image_raw, _project_root()) if vision_image_raw else None
        ),
        vision_enable_screen_capture=_parse_bool(
            getenv("ANTAERUS_BRAIN_VISION_ENABLE_SCREEN_CAPTURE", ""),
            default=False,
        ),
        mission_max_steps=mission_max_steps,
        mission_llm_timeout_seconds=mission_llm_timeout_seconds,
        mission_recovery_enabled=mission_recovery_enabled,
        mission_reflexion_enabled=mission_reflexion_enabled,
        proactive_enabled=proactive_enabled,
        proactive_max_initiative_budget=proactive_max_initiative_budget,
        curator_cron_hour=curator_cron_hour,
        curator_autonomy_level=curator_autonomy_level,
        skills_db_path=skills_db_path,
        skills_root=skills_root,
    )

    if settings.port <= 0:
        raise ValueError(f"ANTAERUS_BRAIN_PORT must be greater than zero, got {settings.port}")

    if settings.llm_timeout_seconds <= 0:
        raise ValueError("ANTAERUS_BRAIN_LLM_TIMEOUT_SECONDS must be greater than zero")

    if settings.memory_default_limit <= 0:
        raise ValueError("ANTAERUS_BRAIN_MEMORY_DEFAULT_LIMIT must be greater than zero")

    if settings.tool_request_timeout_seconds <= 0:
        raise ValueError("ANTAERUS_BRAIN_TOOL_REQUEST_TIMEOUT_SECONDS must be greater than zero")

    if settings.engine_base_url.strip() == "":
        raise ValueError("ANTAERUS_BRAIN_ENGINE_BASE_URL must not be empty")

    if settings.browser_timeout_seconds <= 0:
        raise ValueError("ANTAERUS_BRAIN_BROWSER_TIMEOUT_SECONDS must be greater than zero")

    if settings.weather_timeout_seconds <= 0:
        raise ValueError("ANTAERUS_BRAIN_WEATHER_TIMEOUT_SECONDS must be greater than zero")

    if settings.mission_max_steps <= 0:
        raise ValueError("ANTAERUS_BRAIN_MISSION_MAX_STEPS must be greater than zero")

    if settings.mission_llm_timeout_seconds <= 0:
        raise ValueError("ANTAERUS_BRAIN_MISSION_LLM_TIMEOUT_SECONDS must be greater than zero")

    if (
        settings.default_provider == "anthropic"
        and not settings.anthropic_api_key.get_secret_value()
    ):
        raise ValueError("ANTAERUS_ANTHROPIC_API_KEY must not be empty when provider is anthropic")

    if settings.default_provider == "openai" and not settings.openai_api_key.get_secret_value():
        raise ValueError("ANTAERUS_OPENAI_API_KEY must not be empty when provider is openai")

    if settings.default_provider == "mistral" and not settings.mistral_api_key.get_secret_value():
        raise ValueError("ANTAERUS_MISTRAL_API_KEY must not be empty when provider is mistral")

    if settings.default_provider == "deepseek" and not settings.deepseek_api_key.get_secret_value():
        raise ValueError("ANTAERUS_DEEPSEEK_API_KEY must not be empty when provider is deepseek")

    if settings.default_provider == "ollama" and settings.ollama_base_url.strip() == "":
        raise ValueError("ANTAERUS_BRAIN_OLLAMA_BASE_URL must not be empty when provider is ollama")

    if settings.proactive_max_initiative_budget < 0:
        raise ValueError("ANTAERUS_BRAIN_PROACTIVE_MAX_BUDGET must be >= 0")
    if not 0 <= settings.curator_cron_hour <= 23:
        raise ValueError("ANTAERUS_BRAIN_CURATOR_CRON_HOUR must be between 0 and 23")
    if not 0 <= settings.curator_autonomy_level <= 5:
        raise ValueError("ANTAERUS_BRAIN_CURATOR_AUTONOMY_LEVEL must be between 0 and 5")

    return settings
