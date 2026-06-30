from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from os import getenv
from pathlib import Path

from dotenv import load_dotenv
from pydantic import SecretStr


@dataclass(frozen=True)
class Settings:
    service_name: str
    version: str
    port: int
    environment: str
    api_secret: SecretStr
    assistant_name: str
    assistant_system_prompt: str
    default_provider: str
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


def _project_root() -> Path:
    return Path(__file__).resolve().parents[4]


def _project_env_path() -> Path:
    return _project_root() / ".env"


def _default_memory_db_path() -> Path:
    return _project_root() / "memory_data" / "antaerus_memory.db"


def _default_memory_topics_dir() -> Path:
    return _project_root() / "memory_data" / "topics"


def _require_supported_provider(provider: str) -> str:
    normalized = provider.strip().lower()
    if normalized not in {"anthropic", "openai", "mistral", "deepseek", "ollama"}:
        raise ValueError(f"Unsupported default provider: {provider}")

    return normalized


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
    memory_db_path = _resolve_project_path(
        getenv("ANTAERUS_BRAIN_MEMORY_DB_PATH", str(_default_memory_db_path())),
        _default_memory_db_path(),
    )
    memory_topics_dir = _resolve_project_path(
        getenv("ANTAERUS_BRAIN_MEMORY_TOPICS_DIR", str(_default_memory_topics_dir())),
        _default_memory_topics_dir(),
    )

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
    )

    if settings.port <= 0:
        raise ValueError(f"ANTAERUS_BRAIN_PORT must be greater than zero, got {settings.port}")

    if settings.llm_timeout_seconds <= 0:
        raise ValueError("ANTAERUS_BRAIN_LLM_TIMEOUT_SECONDS must be greater than zero")

    if settings.memory_default_limit <= 0:
        raise ValueError("ANTAERUS_BRAIN_MEMORY_DEFAULT_LIMIT must be greater than zero")

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

    return settings
