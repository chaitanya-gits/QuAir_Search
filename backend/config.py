from __future__ import annotations

import os
from dataclasses import dataclass, field

from dotenv import load_dotenv


load_dotenv()


def _parse_csv_env(value: str, default: list[str]) -> list[str]:
    items = [item.strip() for item in value.split(",") if item.strip()]
    return items or default


def _default_cookie_secure() -> bool:
    redirect_base = os.getenv("OAUTH_REDIRECT_BASE", "http://localhost:3000").strip().lower()
    return redirect_base.startswith("https://")


def _as_bool_env(name: str, default: str = "false") -> bool:
    return os.getenv(name, default).strip().lower() == "true"


@dataclass(slots=True)
class Settings:
    app_name: str = "Quantum SEO"
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = int(os.getenv("PORT", "3000"))
    es_url: str = os.getenv("ES_URL", os.getenv("ELASTICSEARCH_URL", "http://127.0.0.1:9200"))
    database_url: str = os.getenv("DATABASE_URL", "postgresql://quantum:quantum@127.0.0.1:5432/quantum_seo")
    redis_url: str = os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0")
    frontend_dir: str = os.getenv("FRONTEND_DIR", "frontend")
    search_index_name: str = os.getenv("SEARCH_INDEX_NAME", "pages")
    enable_search_index: bool = os.getenv("ENABLE_SEARCH_INDEX", "true").lower() == "true"
    crawl_interval_seconds: int = int(os.getenv("CRAWL_INTERVAL_SECONDS", "60"))
    enable_crawl_scheduler: bool = os.getenv("ENABLE_CRAWL_SCHEDULER", "true").lower() == "true"
    worker_idle_sleep_seconds: float = float(os.getenv("WORKER_IDLE_SLEEP_SECONDS", "10"))
    worker_error_sleep_seconds: float = float(os.getenv("WORKER_ERROR_SLEEP_SECONDS", "30"))
    crawl_user_agent: str = os.getenv("CRAWL_USER_AGENT", "QuantumSEO/2.0")
    crawl_timeout_seconds: float = float(os.getenv("CRAWL_TIMEOUT_SECONDS", "15"))
    crawl_max_response_bytes: int = int(os.getenv("CRAWL_MAX_RESPONSE_BYTES", "2000000"))
    request_timeout_seconds: float = float(os.getenv("REQUEST_TIMEOUT_SECONDS", "10"))
    postgres_min_pool_size: int = int(os.getenv("POSTGRES_MIN_POOL_SIZE", "1"))
    postgres_max_pool_size: int = int(os.getenv("POSTGRES_MAX_POOL_SIZE", "3"))
    trending_limit: int = int(os.getenv("TRENDING_LIMIT", "10"))
    suggestion_limit: int = int(os.getenv("SUGGESTION_LIMIT", "8"))
    search_response_cache_ttl_seconds: float = float(os.getenv("SEARCH_RESPONSE_CACHE_TTL_SECONDS", "30"))
    search_response_cache_max_entries: int = int(os.getenv("SEARCH_RESPONSE_CACHE_MAX_ENTRIES", "256"))
    document_cache_ttl_seconds: float = float(os.getenv("DOCUMENT_CACHE_TTL_SECONDS", "45"))
    pagerank_cache_ttl_seconds: float = float(os.getenv("PAGERANK_CACHE_TTL_SECONDS", "120"))
    document_corpus_limit: int = int(os.getenv("DOCUMENT_CORPUS_LIMIT", "500"))
    search_mode_timeout_seconds: float = float(os.getenv("SEARCH_MODE_TIMEOUT_SECONDS", "4.5"))
    search_web_fallback_timeout_seconds: float = float(os.getenv("SEARCH_WEB_FALLBACK_TIMEOUT_SECONDS", "8.0"))
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
<<<<<<< HEAD
    tesseract_cmd: str = os.getenv("TESSERACT_CMD", "")
=======
>>>>>>> 082393a (Remove nested repo and clean structure)
    tavily_api_key: str = os.getenv("TAVILY_API_KEY", "")
    tavily_api_url: str = os.getenv("TAVILY_API_URL", "https://api.tavily.com/search")
    google_client_id: str = os.getenv("GOOGLE_CLIENT_ID", "")
    google_client_secret: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
    oauth_redirect_base: str = os.getenv("OAUTH_REDIRECT_BASE", "http://localhost:3000")
    jwt_secret: str = os.getenv("JWT_SECRET", "change-me-in-production")
    youtube_api_key: str = os.getenv("YOUTUBE_API_KEY", "")
<<<<<<< HEAD
    cors_allow_origins: list[str] = field(
        default_factory=lambda: _parse_csv_env(
            os.getenv("CORS_ALLOW_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001"),
            ["http://localhost:3000", "http://127.0.0.1:3000"],
        )
    )
    cookie_secure: bool = _as_bool_env("COOKIE_SECURE", str(_default_cookie_secure()).lower())
    cookie_samesite: str = os.getenv("COOKIE_SAMESITE", "lax")
    allow_insecure_default_jwt: bool = _as_bool_env("ALLOW_INSECURE_DEFAULT_JWT", "false")
=======
>>>>>>> 082393a (Remove nested repo and clean structure)


settings = Settings()


def validate_security_settings() -> None:
    if settings.jwt_secret == "change-me-in-production" and not settings.allow_insecure_default_jwt:
        raise RuntimeError(
            "Refusing to start with insecure JWT_SECRET. Set JWT_SECRET to a strong random value "
            "or explicitly set ALLOW_INSECURE_DEFAULT_JWT=true for temporary local-only development."
        )
