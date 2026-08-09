from app.domain.trends import calculate_all_trends, calculate_trend


def test_trend_compares_adjacent_windows_not_days():
    trend = calculate_trend([100] * 7 + [104] * 7, 7)
    assert trend.change_percent == 3.85
    assert trend.direction == "up"
    assert calculate_trend([100] * 7 + [97] * 7, 7).direction == "neutral"
    assert calculate_trend([100] * 7 + [96] * 7, 7).direction == "down"


def test_trend_percentage_is_bounded_for_small_and_zero_baselines():
    assert calculate_trend([1] * 7 + [22] * 7, 7).change_percent == 95.45
    assert calculate_trend([0] * 7 + [10] * 7, 7).change_percent == 100
    assert calculate_trend([10] * 7 + [0] * 7, 7).change_percent == -100
    assert calculate_trend([0] * 14, 7).change_percent == 0


def test_all_required_periods_exist():
    trends = calculate_all_trends([float(index) for index in range(180)])
    assert set(trends) == {"7", "30", "90"}
