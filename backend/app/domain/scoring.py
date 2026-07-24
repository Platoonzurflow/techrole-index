import math
from dataclasses import dataclass

DEFAULT_WEIGHTS = {
    "demand": 0.28,
    "salary": 0.24,
    "demand_growth": 0.16,
    "junior_access": 0.12,
    "remote_share": 0.10,
    "data_quality": 0.10,
}
SCORING_VERSION = "v1.1.0"


@dataclass(frozen=True)
class ScoreInputs:
    vacancy_count: float
    salary_median: float
    demand_growth_percent: float
    junior_share: float
    remote_share: float
    salary_coverage: float
    sample_size: int


@dataclass(frozen=True)
class ScoreResult:
    score: float
    version: str
    breakdown: dict[str, float]
    data_confidence: str


def clamp(value: float, lower: float = 0.0, upper: float = 1.0) -> float:
    return min(upper, max(lower, value))


def percentile_rank(value: float, peers: list[float]) -> float:
    if not peers:
        return 0.5
    wins = sum(1 for peer in peers if peer < value)
    ties = sum(1 for peer in peers if peer == value)
    return clamp((wins + 0.5 * ties) / len(peers))


def winsorized(value: float, peers: list[float], lower: float = 0.05, upper: float = 0.95) -> float:
    if not peers:
        return value
    ordered = sorted(peers)
    low = ordered[int((len(ordered) - 1) * lower)]
    high = ordered[int((len(ordered) - 1) * upper)]
    return min(high, max(low, value))


def calculate_score(
    inputs: ScoreInputs,
    *,
    demand_peers: list[float],
    salary_peers: list[float],
    growth_peers: list[float],
    weights: dict[str, float] | None = None,
    version: str = SCORING_VERSION,
) -> ScoreResult:
    used_weights = weights or DEFAULT_WEIGHTS
    if abs(sum(used_weights.values()) - 1.0) > 1e-6:
        raise ValueError("Scoring weights must sum to 1")
    log_demand = math.log1p(max(0.0, inputs.vacancy_count))
    log_peers = [math.log1p(max(0.0, item)) for item in demand_peers]
    components = {
        "demand": percentile_rank(log_demand, log_peers),
        "salary": percentile_rank(
            winsorized(inputs.salary_median, salary_peers),
            [winsorized(item, salary_peers) for item in salary_peers],
        ),
        "demand_growth": percentile_rank(
            winsorized(inputs.demand_growth_percent, growth_peers),
            [winsorized(item, growth_peers) for item in growth_peers],
        ),
        "junior_access": clamp(inputs.junior_share / 0.35),
        "remote_share": clamp(inputs.remote_share),
        "data_quality": clamp(
            inputs.salary_coverage * 0.7 + min(inputs.sample_size / 100, 1) * 0.3
        ),
    }
    score = sum(components[key] * used_weights[key] for key in used_weights) * 100
    confidence = (
        "high"
        if inputs.sample_size >= 100 and inputs.salary_coverage >= 0.6
        else ("medium" if inputs.sample_size >= 20 and inputs.salary_coverage >= 0.35 else "low")
    )
    return ScoreResult(
        score=round(clamp(score, 0, 100), 1),
        version=version,
        breakdown={key: round(value * 100, 1) for key, value in components.items()},
        data_confidence=confidence,
    )
