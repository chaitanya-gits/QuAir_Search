"""Helpers to avoid leaking credentials in logs or API responses."""

from __future__ import annotations

import re
from urllib.parse import urlparse, urlunparse


def redact_url(url: str) -> str:
    """Mask userinfo (username/password) in database/cache URLs for safe logging."""
    if not url or not url.strip():
        return ""
    try:
        parsed = urlparse(url)
        if not parsed.scheme or not parsed.netloc:
            return "<invalid-url>"
        host = parsed.hostname or ""
        port = f":{parsed.port}" if parsed.port else ""
        userinfo = "***@" if parsed.username or parsed.password else ""
        new_netloc = f"{userinfo}{host}{port}"
        return urlunparse(
            (parsed.scheme, new_netloc, parsed.path or "", parsed.params, parsed.query, parsed.fragment)
        )
    except Exception:
        return "<redacted-url>"


def safe_exception_summary(exc: BaseException) -> str:
    """Short message for logs without echoing connection strings from driver errors."""
    name = type(exc).__name__
    msg = str(exc).strip()
    if not msg:
        return name
    # Driver errors sometimes embed DSN fragments; keep only first line, strip long blobs.
    line = msg.splitlines()[0][:200]
    line = re.sub(r"postgresql://[^\s]+", "postgresql://<redacted>", line, flags=re.I)
    line = re.sub(r"redis://[^\s]+", "redis://<redacted>", line, flags=re.I)
    line = re.sub(r"(password|secret|token|key)=[^\s&]+", r"\1=<redacted>", line, flags=re.I)
    return f"{name}: {line}"
