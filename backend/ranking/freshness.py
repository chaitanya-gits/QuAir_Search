from __future__ import annotations

from datetime import UTC, datetime


def apply_freshness_boost(results: list[dict]) -> list[dict]:
    now = datetime.now(UTC)
    boosted_results: list[dict] = []

    for result in results:
        updated_at = result.get("updated_at")
        freshness_bonus = 0.0

        if isinstance(updated_at, datetime):
            age_days = max((now - updated_at).total_seconds() / 86400, 0.0)
            if age_days <= 30:
                freshness_bonus = 0.2
            elif age_days <= 180:
                freshness_bonus = 0.1

        boosted_results.append(
            {
                **result,
                "score": float(result.get("score", 0.0)) + freshness_bonus,
            }
        )

    return boosted_results
