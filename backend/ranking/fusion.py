from __future__ import annotations

import math


def reciprocal_rank_fusion(result_lists: list[list[dict]], k: int = 60) -> list[dict]:
    fused_by_url: dict[str, dict] = {}

    for result_list in result_lists:
        for rank, result in enumerate(result_list, start=1):
            url = result.get("url")
            if not url:
                continue

            entry = fused_by_url.setdefault(
                url,
                {
                    **result,
                    "rrf_score": 0.0,
                    "sources": [],
                },
            )
            entry["rrf_score"] += 1 / (k + rank)

            source = result.get("source", "search")
            if source not in entry["sources"]:
                entry["sources"].append(source)

    combined_results = []
    for result in fused_by_url.values():
        combined_results.append(
            {
                **result,
                "score": float(result.get("score", 0.0)) + float(result.get("rrf_score", 0.0)),
            }
        )

    return sorted(
        combined_results,
        key=lambda item: (item["score"], math.log1p(item.get("pagerank_score", 0.0))),
        reverse=True,
    )
