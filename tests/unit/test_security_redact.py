from __future__ import annotations

import unittest

from backend.security_redact import redact_url, safe_exception_summary


class SecurityRedactTests(unittest.TestCase):
    def test_redact_url_masks_postgres_password(self) -> None:
        raw = "postgresql://appuser:supersecret@db.example.com:5432/mydb?sslmode=require"
        out = redact_url(raw)
        self.assertNotIn("supersecret", out)
        self.assertIn("***@", out)
        self.assertIn("db.example.com", out)

    def test_redact_url_masks_redis(self) -> None:
        raw = "redis://:abc123@127.0.0.1:6379/0"
        out = redact_url(raw)
        self.assertNotIn("abc123", out)

    def test_safe_exception_summary_strips_dsn_like_fragments(self) -> None:
        class FakeExc(Exception):
            pass

        msg = "connect failed postgresql://u:p@host/db and token=secretvalue"
        exc = FakeExc(msg)
        s = safe_exception_summary(exc)
        self.assertNotIn("p@host", s)
        self.assertIn("postgresql://<redacted>", s.lower())


if __name__ == "__main__":
    unittest.main()
