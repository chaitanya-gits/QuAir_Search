"""Real Grover's algorithm circuit using Qiskit + AerSimulator.

When ``settings.enable_real_quantum`` is *True* and the corpus is small enough
(≤ 16 items → 4 qubits), a genuine quantum circuit is built, simulated, and
measured.  Otherwise the existing math-based :func:`simulate_grover_search`
from ``quantum.py`` is used as a transparent fallback.

All Qiskit imports are guarded so the module works even when only the base
``requirements.txt`` is installed (no ``requirements-quantum.txt``).
"""
from __future__ import annotations

import logging
import math

from backend.config import settings
from backend.search.quantum import simulate_grover_search

logger = logging.getLogger(__name__)

# Maximum corpus size for which we run a real Qiskit circuit.
# 2^4 = 16 states keeps the statevector simulator well within memory.
_MAX_REAL_CORPUS = 16


def _build_oracle(qc, n_qubits: int, marked_count: int):
    """Mark the first *marked_count* basis states by flipping their phase.

    For simplicity the oracle marks computational-basis states |0⟩ … |m-1⟩.
    This is sufficient because Grover's algorithm is agnostic to *which*
    states are marked — only their *count* affects the dynamics.
    """
    from qiskit.circuit.library import ZGate  # type: ignore

    for state_idx in range(marked_count):
        # Flip bits that are 0 in the binary representation so the
        # multi-controlled-Z targets exactly |state_idx⟩.
        bits = format(state_idx, f"0{n_qubits}b")
        for bit_pos, bit_val in enumerate(bits):
            if bit_val == "0":
                qc.x(bit_pos)

        # Multi-controlled Z (phase flip on the target state)
        if n_qubits == 1:
            qc.z(0)
        else:
            qc.append(
                ZGate().control(n_qubits - 1),
                list(range(n_qubits)),
            )

        # Undo the X flips
        for bit_pos, bit_val in enumerate(bits):
            if bit_val == "0":
                qc.x(bit_pos)


def _build_diffuser(qc, n_qubits: int):
    """Standard Grover diffusion operator (inversion about the mean)."""
    from qiskit.circuit.library import ZGate  # type: ignore

    qc.h(range(n_qubits))
    qc.x(range(n_qubits))

    if n_qubits == 1:
        qc.z(0)
    else:
        qc.append(
            ZGate().control(n_qubits - 1),
            list(range(n_qubits)),
        )

    qc.x(range(n_qubits))
    qc.h(range(n_qubits))


def _run_qiskit_circuit(corpus_size: int, marked_count: int, shots: int = 1024) -> dict:
    """Build and simulate a Grover circuit, returning QuantumMetrics-shaped dict."""
    from qiskit import QuantumCircuit  # type: ignore
    from qiskit_aer import AerSimulator  # type: ignore

    n_qubits = math.ceil(math.log2(max(corpus_size, 2)))
    safe_marked = max(1, min(marked_count, corpus_size))

    optimal_iterations = max(
        1,
        round((math.pi / 4.0) * math.sqrt(corpus_size / safe_marked)),
    )

    qc = QuantumCircuit(n_qubits, n_qubits)

    # Uniform superposition
    qc.h(range(n_qubits))

    # Grover iterations
    for _ in range(optimal_iterations):
        _build_oracle(qc, n_qubits, safe_marked)
        _build_diffuser(qc, n_qubits)

    qc.measure(range(n_qubits), range(n_qubits))

    # Simulate
    simulator = AerSimulator()
    job = simulator.run(qc, shots=shots)
    result = job.result()
    counts = result.get_counts(qc)

    # Compute measured success probability (how often a marked state was hit)
    marked_states = {format(i, f"0{n_qubits}b") for i in range(safe_marked)}
    success_shots = sum(counts.get(state, 0) for state in marked_states)
    success_probability = success_shots / shots

    classical_steps = corpus_size
    speedup = classical_steps / optimal_iterations if optimal_iterations else 1.0

    return {
        "algorithm": "grover-qiskit",
        "corpus_size": corpus_size,
        "candidate_count": safe_marked,
        "classical_steps": classical_steps,
        "simulated_quantum_steps": optimal_iterations,
        "estimated_speedup": round(speedup, 2),
        "success_probability": round(min(success_probability, 0.999), 3),
        "amplified_candidates": safe_marked,
        "qiskit_shots": shots,
        "n_qubits": n_qubits,
    }


def run_grover_search(
    *,
    corpus_size: int,
    marked_count: int,
    amplified_candidates: int | None = None,
) -> dict[str, float | int | str]:
    """Run Grover's search — real Qiskit circuit when possible, math-sim otherwise.

    Decision tree:
    1. ``settings.enable_real_quantum`` is False → math sim (production default)
    2. corpus_size > 16 → math sim (too many qubits for local statevector)
    3. Qiskit not installed → math sim
    4. Otherwise → real circuit via AerSimulator
    """
    safe_corpus = max(1, int(corpus_size))
    safe_marked = max(1, min(int(marked_count), safe_corpus))

    # Gate 1: feature flag
    if not settings.enable_real_quantum:
        return simulate_grover_search(
            corpus_size=safe_corpus,
            candidate_count=safe_marked,
            amplified_candidates=amplified_candidates,
        )

    # Gate 2: corpus too large for real circuit
    if safe_corpus > _MAX_REAL_CORPUS:
        logger.debug(
            "Corpus size %d exceeds %d-state limit — using math simulation.",
            safe_corpus,
            _MAX_REAL_CORPUS,
        )
        return simulate_grover_search(
            corpus_size=safe_corpus,
            candidate_count=safe_marked,
            amplified_candidates=amplified_candidates,
        )

    # Gate 3 + 4: attempt real circuit
    try:
        result = _run_qiskit_circuit(safe_corpus, safe_marked)
        # Carry over amplified_candidates from the caller
        result["amplified_candidates"] = max(0, int(amplified_candidates or 0))
        logger.info(
            "Qiskit Grover circuit completed: %d qubits, %d iterations, p=%.3f",
            result.get("n_qubits", 0),
            result.get("simulated_quantum_steps", 0),
            result.get("success_probability", 0),
        )
        return result
    except ImportError:
        logger.warning("Qiskit not installed — falling back to math simulation.")
    except Exception:
        logger.exception("Qiskit circuit failed — falling back to math simulation.")

    return simulate_grover_search(
        corpus_size=safe_corpus,
        candidate_count=safe_marked,
        amplified_candidates=amplified_candidates,
    )
