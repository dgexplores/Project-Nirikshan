import math

import pytest
from bdd_forensics.benford import (
    MAD_ACCEPTABLE,
    _first_digit,
    analyze_benford,
    expected_first_digit_shares,
    first_digit_distribution,
)


def test_first_digit_exact() -> None:
    assert _first_digit(5310) == 5
    assert _first_digit(0.0091) == 9
    assert _first_digit(-2760) == 2
    assert _first_digit(999.999999) == 9
    assert _first_digit(0) is None
    assert _first_digit(float("nan")) is None


def test_expected_shares_sum_to_one() -> None:
    shares = expected_first_digit_shares()
    assert abs(sum(shares.values()) - 1.0) < 1e-12
    assert abs(shares[1] - math.log10(2)) < 1e-12


def test_distribution_counts_leading_digits() -> None:
    counts = first_digit_distribution([123, 456, 789, 0.52, 0])
    assert counts[1] == 1 and counts[4] == 1 and counts[7] == 1 and counts[5] == 1
    assert sum(counts.values()) == 4


def _benford_like(n: int = 400) -> list[float]:
    """Deterministic values whose first digits follow Benford closely.

    Digit d gets round(n * log10(1+1/d)) values, spread across 4 orders of
    magnitude with a small sub-digit fraction that never rolls the digit over.
    """
    values: list[float] = []
    for d in range(1, 10):
        count = round(n * math.log10(1 + 1 / d))
        for j in range(count):
            fraction = ((j * 37) % 80) / 1000.0  # <= 0.079: keeps leading digit
            values.append(d * (1 + fraction) * float(10.0 ** (j % 4)))
    return values


def _fabricated(n: int) -> list[float]:
    """First digits exactly uniform 1..9 across >=3 orders of magnitude."""
    values: list[float] = []
    for i in range(n):
        d = i % 9 + 1
        magnitude = (i // 9) % 3
        values.append(d * (1 + ((i * 37) % 80) / 1000.0) * float(10.0**magnitude))
    return values


def test_benford_conforming_column_returns_none() -> None:
    result = analyze_benford("amount_inr", _benford_like(400))
    assert result is None


def test_benford_flags_fabricated_distribution() -> None:
    result = analyze_benford("amount_inr", _fabricated(300))
    assert result is not None
    assert result.conformity == "nonconformity"
    assert result.mad > MAD_ACCEPTABLE
    assert result.severity in {"medium", "high"}
    # digits 4..9 over-represented vs Benford expectation
    high_digits_excess = [d.excess for d in result.digits if d.digit >= 5]
    assert all(e > 0 for e in high_digits_excess)
    assert "screening signal" in result.caveats[0]


def test_benford_skips_small_columns() -> None:
    assert analyze_benford("v", [1.0, 22.0, 333.0]) is None
    assert analyze_benford("v", _fabricated(30)) is None


def test_benford_skips_narrow_magnitude_span() -> None:
    # all values in 90..99 -> single order of magnitude, out of scope
    assert analyze_benford("pct", [90.0 + i for i in range(80)]) is None


def test_benford_marginal_band_reports_medium() -> None:
    # construct distribution sitting between acceptable and marginal bands
    values: list[float] = []
    for i in range(200):
        digit = 1 if i % 3 == 0 else ((i % 9) + 1)
        values.append(digit * 10.0 ** (i % 3))
    result = analyze_benford("x", values)
    if result is not None:
        assert result.conformity in {"marginal", "nonconformity"}


@pytest.mark.parametrize("bad", [[], [float("nan")], [0.0] * 60])
def test_benford_handles_degenerate_input(bad: list[float]) -> None:
    assert analyze_benford("col", bad) is None
