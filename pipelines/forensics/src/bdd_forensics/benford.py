"""Benford's Law engine - first-digit distribution forensics.

Naturally occurring count/amount populations follow log10(1+1/d). A column
whose first digits deviate strongly is flagged as a *screening signal* for
fabrication, duplication or unit manipulation. Deviation is scored with the
Nigrini MAD bands and every finding carries applicability caveats:

- needs enough values (default >= 50)
- values must span at least 2 orders of magnitude
- meaningless for IDs, phone numbers, dates, percentages bounded near 100

Deterministic: pure arithmetic, no randomness.
"""

from __future__ import annotations

import math

from bdd_contracts.benford import BenfordConformity, BenfordFinding, DigitDeviation

BENFORD_VERSION = "0.1.0"

MIN_VALUES = 50
MIN_MAGNITUDE_SPAN = 2.0

# Nigrini (2012) MAD conformity bands for first-digit analysis
MAD_CLOSE = 0.006
MAD_ACCEPTABLE = 0.012
MAD_MARGINAL = 0.015


def expected_first_digit_shares() -> dict[int, float]:
    return {d: math.log10(1 + 1 / d) for d in range(1, 10)}


def _first_digit(value: float) -> int | None:
    """Leading significant digit via base-10 magnitude (exact, no strings)."""
    v = abs(float(value))
    if v == 0 or not math.isfinite(v):
        return None
    magnitude = math.floor(math.log10(v))
    digit = int(v / 10**magnitude)  # truncation == floor for positives
    if digit < 1:  # defensive: float error at a power-of-ten boundary
        magnitude -= 1
        digit = int(v / 10**magnitude)
    return min(digit, 9)


def first_digit_distribution(values: list[float]) -> dict[int, int]:
    counts: dict[int, int] = {d: 0 for d in range(1, 10)}
    for v in values:
        d = _first_digit(v)
        if d is not None and 1 <= d <= 9:
            counts[d] += 1
    return counts


def _conformity(mad: float) -> BenfordConformity:
    if mad < MAD_CLOSE:
        return "close"
    if mad < MAD_ACCEPTABLE:
        return "acceptable"
    if mad < MAD_MARGINAL:
        return "marginal"
    return "nonconformity"


def analyze_benford(column: str, values: list[float], *, min_values: int = MIN_VALUES) -> BenfordFinding | None:
    """Return a BenfordFinding when the column is in scope AND deviates beyond
    'close' conformity. Returns None when conforming, too small, or out of scope."""
    cleaned = [float(v) for v in values if v is not None and math.isfinite(float(v)) and float(v) != 0]
    if len(cleaned) < min_values:
        return None

    magnitudes = [math.log10(abs(v)) for v in cleaned]
    if max(magnitudes) - min(magnitudes) < MIN_MAGNITUDE_SPAN:
        return None

    counts = first_digit_distribution(cleaned)
    total = sum(counts.values())
    if total == 0:
        return None

    expected = expected_first_digit_shares()
    deviations: list[DigitDeviation] = []
    mad_sum = 0.0
    for d in range(1, 10):
        observed = counts[d] / total
        exp = expected[d]
        mad_sum += abs(observed - exp)
        deviations.append(
            DigitDeviation(
                digit=d,
                observed_share=round(observed, 4),
                expected_share=round(exp, 4),
                excess=round(observed - exp, 4),
            )
        )
    mad = round(mad_sum / 9, 5)
    conformity = _conformity(mad)

    if conformity in ("close", "acceptable"):
        # Nigrini's own terminology treats "acceptable" as normal, non-
        # suspicious conformity, not a signal worth a reviewer's time.
        return None

    worst = sorted(deviations, key=lambda x: abs(x.excess), reverse=True)[:3]
    caveats = [
        f"screening signal only: MAD {mad} ({conformity} conformity)",
        "top deviating digits: "
        + ", ".join(f"{w.digit} (+{w.excess:+.2%})" for w in worst),
        "not applicable to IDs/phones/dates; verify column semantics before acting",
    ]
    severity = "high" if conformity == "nonconformity" else "medium"

    return BenfordFinding(
        finding_id=f"benford-{column}-{total}",
        column=column,
        n_values=total,
        mad=mad,
        conformity=conformity,
        digits=deviations,
        caveats=caveats,
        severity=severity,
        confidence="moderate",
    )
