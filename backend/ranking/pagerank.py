from __future__ import annotations

from collections.abc import Iterable
import math


def compute_pagerank_scores(
    edges: Iterable[tuple[str, str]],
    *,
    nodes: Iterable[str] = (),
    damping: float = 0.85,
    max_iterations: int = 50,
    tolerance: float = 1e-8,
) -> dict[str, float]:
    graph_nodes = {node for node in nodes if node}
    outgoing_links: dict[str, set[str]] = {}

    for source_url, target_url in edges:
        if not source_url or not target_url:
            continue

        graph_nodes.add(source_url)
        graph_nodes.add(target_url)
        outgoing_links.setdefault(source_url, set()).add(target_url)

    if not graph_nodes:
        return {}

    node_count = len(graph_nodes)
    initial_score = 1.0 / node_count
    scores = {node: initial_score for node in graph_nodes}

    for _ in range(max_iterations):
        dangling_score = sum(
            score for node, score in scores.items() if not outgoing_links.get(node)
        )
        base_score = (1.0 - damping) / node_count
        next_scores = {
            node: base_score + damping * dangling_score / node_count
            for node in graph_nodes
        }

        for source_url, target_urls in outgoing_links.items():
            if source_url not in scores or not target_urls:
                continue

            share = damping * scores[source_url] / len(target_urls)
            for target_url in target_urls:
                next_scores[target_url] += share

        delta = sum(abs(next_scores[node] - scores[node]) for node in graph_nodes)
        scores = next_scores

        if delta < tolerance:
            break

    return {node: score * node_count for node, score in scores.items()}


def apply_pagerank_boost(
    results: list[dict],
    pagerank_scores: dict[str, float],
    weight: float = 0.15,
) -> list[dict]:
    boosted_results: list[dict] = []

    for result in results:
        pagerank_score = float(pagerank_scores.get(result["url"], 0.0))
        boosted_results.append(
            {
                **result,
                "pagerank_score": pagerank_score,
                "score": float(result.get("score", 0.0)) + weight * math.log1p(pagerank_score),
            }
        )

    return boosted_results
