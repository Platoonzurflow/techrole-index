from app.domain.trends import calculate_all_trends, calculate_trend


def test_trend_compares_adjacent_windows_not_days():
    trend = calculate_trend([100] * 7 + [104] * 7, 7)
    assert trend.change_percent == 4
    assert trend.direction == "up"
    assert calculate_trend([100] * 7 + [97] * 7, 7).direction == "neutral"
    assert calculate_trend([100] * 7 + [96] * 7, 7).direction == "down"


def test_all_required_periods_exist():
    trends = calculate_all_trends([float(index) for index in range(180)])
    assert set(trends) == {"7", "30", "90"}
