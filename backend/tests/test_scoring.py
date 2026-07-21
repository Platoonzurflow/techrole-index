import pytest

from app.domain.scoring import DEFAULT_WEIGHTS, SCORING_VERSION, ScoreInputs, calculate_score


def test_score_is_bounded_versioned_and_has_full_breakdown():
    result = calculate_score(
        ScoreInputs(400, 300000, 18, 0.22, 0.7, 0.65, 120),
        demand_peers=[10, 50, 100, 400, 1000],
        salary_peers=[100000, 180000, 250000, 300000, 900000],
        growth_peers=[-30, -5, 0, 18, 200],
    )
    assert 0 <= result.score <= 100
    assert result.version == SCORING_VERSION
    assert set(result.breakdown) == set(DEFAULT_WEIGHTS)
    assert result.data_confidence == "high"


def test_log_demand_and_winsorization_limit_extremes():
    normal = calculate_score(
        ScoreInputs(1000, 300000, 15, 0.2, 0.5, 0.5, 50),
        demand_peers=[10, 100, 1000, 2000],
        salary_peers=[100000, 200000, 300000, 400000],
        growth_peers=[-10, 0, 10, 20],
    )
    extreme = calculate_score(
        ScoreInputs(10**12, 10**12, 10**12, 0.2, 0.5, 0.5, 50),
        demand_peers=[10, 100, 1000, 2000],
        salary_peers=[100000, 200000, 300000, 400000],
        growth_peers=[-10, 0, 10, 20],
    )
    assert extreme.score <= 100
    assert extreme.score - normal.score < 25


def test_weights_must_sum_to_one():
    with pytest.raises(ValueError):
        calculate_score(
            ScoreInputs(1, 1, 1, 0.1, 0.1, 0.1, 1),
            demand_peers=[1],
            salary_peers=[1],
            growth_peers=[1],
            weights={**DEFAULT_WEIGHTS, "demand": 1},
        )
