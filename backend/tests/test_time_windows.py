from datetime import datetime, timedelta, timezone

import pytest

from app.domain.time_windows import utc_calendar_window


def test_utc_calendar_window_uses_complete_days_and_exclusive_end() -> None:
    window = utc_calendar_window(
        datetime(2026, 7, 21, 8, 26, 45, tzinfo=timezone.utc),
        days=180,
    )

    assert window.date_from.isoformat() == "2026-01-23"
    assert window.date_to.isoformat() == "2026-07-21"
    assert window.start_at == datetime(2026, 1, 23, tzinfo=timezone.utc)
    assert window.end_at_exclusive == datetime(2026, 7, 22, tzinfo=timezone.utc)


def test_utc_calendar_window_normalizes_aware_input_to_utc_date() -> None:
    moscow = timezone(timedelta(hours=3))
    window = utc_calendar_window(
        datetime(2026, 7, 21, 0, 30, tzinfo=moscow),
        days=1,
    )

    assert window.date_from.isoformat() == "2026-07-20"
    assert window.date_to.isoformat() == "2026-07-20"
    assert window.start_at == datetime(2026, 7, 20, tzinfo=timezone.utc)
    assert window.end_at_exclusive == datetime(2026, 7, 21, tzinfo=timezone.utc)


@pytest.mark.parametrize(
    ("now", "days"),
    [
        (datetime(2026, 7, 21), 1),
        (datetime(2026, 7, 21, tzinfo=timezone.utc), 0),
    ],
)
def test_utc_calendar_window_rejects_ambiguous_inputs(
    now: datetime,
    days: int,
) -> None:
    with pytest.raises(ValueError):
        utc_calendar_window(now, days=days)
