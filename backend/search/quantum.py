from __future__ import annotations

import math
from dataclasses import dataclass


QUANTUM_SIGNAL_WEIGHTS = {
    "semantic": 0.40,
    "rrf": 0.35,
    "pagerank": 0.15,
    "bm25": 0.10,
}

DEFAULT_BOOST_WEIGHT = 0.22
DEFAULT_ITERATIONS = 2


@dataclass(slots=True)
class QuantumMetrics:
    algorithm: str
    corpus_size: int
    candidate_count: int
    classical_steps: int
    simulated_quantum_steps: int
    estimated_speedup: float
    success_probability: float
    amplified_candidates: int

    def as_dict(self) -> dict[str, float | int | str]:
        return {
            "algorithm": self.algorithm,
            "corpus_size": self.corpus_size,
            "candidate_count": self.candidate_count,
            "classical_steps": self.classical_steps,
            "simulated_quantum_steps": self.simulated_quantum_steps,
            "estimated_speedup": self.estimated_speedup,
            "success_probability": self.success_probability,
            "amplified_candidates": self.amplified_candidates,
        }


def simulate_grover_search(
    *,
    corpus_size: int,
    candidate_count: int,
    amplified_candidates: int | None = None,
) -> dict[str, float | int | str]:
    """Return realistic Grover-like metrics for the given candidate selection."""

    safe_corpus_size = max(1, int(corpus_size))
    safe_candidate_count = max(1, int(candidate_count))
    safe_candidate_count = min(safe_candidate_count, safe_corpus_size)

    classical_steps = safe_corpus_size
    optimal_iterations = max(
        1,
        round((math.pi / 4.0) * math.sqrt(safe_corpus_size / safe_candidate_count)),
    )
    speedup = classical_steps / optimal_iterations

    angle = math.asin(min(1.0, math.sqrt(safe_candidate_count / safe_corpus_size)))
    probability = math.sin((2 * optimal_iterations + 1) * angle) ** 2
    probability = max(0.0, min(0.999, probability))

    metrics = QuantumMetrics(
        algorithm="grover-amplification",
        corpus_size=safe_corpus_size,
        candidate_count=safe_candidate_count,
        classical_steps=classical_steps,
        simulated_quantum_steps=optimal_iterations,
        estimated_speedup=round(speedup, 2),
        success_probability=round(probability, 3),
        amplified_candidates=max(0, int(amplified_candidates or 0)),
    )
    return metrics.as_dict()


def _composite_signal(result: dict) -> float:
    """Blend the available ranking signals into a single non-negative score."""

    semantic = float(result.get("semantic_score", 0.0) or 0.0)
    rrf = float(result.get("rrf_score", 0.0) or 0.0)
    pagerank = float(result.get("pagerank_score", 0.0) or 0.0)
    bm25 = float(result.get("bm25_score", 0.0) or 0.0)

    weighted = (
        QUANTUM_SIGNAL_WEIGHTS["semantic"] * max(0.0, semantic)
        + QUANTUM_SIGNAL_WEIGHTS["rrf"] * max(0.0, rrf)
        + QUANTUM_SIGNAL_WEIGHTS["pagerank"] * math.log1p(max(0.0, pagerank))
        + QUANTUM_SIGNAL_WEIGHTS["bm25"] * max(0.0, bm25)
    )
    return weighted


def apply_quantum_boost(
    results: list[dict],
    *,
    boost_weight: float = DEFAULT_BOOST_WEIGHT,
    iterations: int = DEFAULT_ITERATIONS,
) -> list[dict]:
    """Apply Grover-inspired amplitude amplification to the fused ranking.

    We build a composite signal per candidate, promote above-mean items via an
    oracle sign flip, then apply the "inversion about the mean" diffusion step.
    After ``iterations`` rounds the amplified probabilities are re-injected
    into ``score`` as a quantum boost, preserving input order for ties.
    """

    count = len(results)
    if count == 0:
        return results
    if count == 1:
        single = dict(results[0])
        single["quantum_score"] = 1.0
        single["score"] = float(single.get("score", 0.0)) + boost_weight
        return [single]

    signals = [_composite_signal(result) for result in results]
    max_signal = max(signals)
    if max_signal <= 0.0:
        boosted: list[dict] = []
        uniform = boost_weight / count
        for result in results:
            boosted.append({**result, "quantum_score": uniform, "score": float(result.get("score", 0.0)) + uniform})
        return boosted

    normalized = [signal / max_signal for signal in signals]
    mean_signal = sum(normalized) / count

    amplitude = 1.0 / math.sqrt(count)
    amplitudes = [amplitude] * count

    safe_iterations = max(1, int(iterations))
    for _ in range(safe_iterations):
        amplitudes = [
            (-value if normalized[index] >= mean_signal else value)
            for index, value in enumerate(amplitudes)
        ]
        mean_amp = sum(amplitudes) / count
        amplitudes = [2.0 * mean_amp - value for value in amplitudes]

    probabilities = [value * value for value in amplitudes]
    total_probability = sum(probabilities) or 1.0
    probabilities = [probability / total_probability for probability in probabilities]

    boosted_results: list[dict] = []
    for index, result in enumerate(results):
        quantum_score = probabilities[index] * count
        boosted_results.append(
            {
                **result,
                "quantum_score": round(quantum_score, 6),
                "score": float(result.get("score", 0.0)) + boost_weight * quantum_score,
            }
        )
    return boosted_results


def count_amplified_candidates(results: list[dict]) -> int:
    """Number of results whose composite signal is above the mean."""

    if not results:
        return 0
    signals = [_composite_signal(result) for result in results]
    if not any(signals):
        return 0
    mean_signal = sum(signals) / len(signals)
    return sum(1 for signal in signals if signal >= mean_signal and signal > 0.0)
