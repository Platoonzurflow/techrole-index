from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone


@dataclass(frozen=True)
class UtcCalendarWindow:
    date_from: date
    date_to: date
    start_at: datetime
    end_at_exclusive: datetime


def utc_calendar_window(now: datetime, *, days: int) -> UtcCalendarWindow:
    """Return whole UTC calendar days as a half-open timestamp interval."""
    if days < 1:
        raise ValueError("days must be at least 1")
    if now.tzinfo is None or now.utcoffset() is None:
        raise ValueError("now must be timezone-aware")

    current_utc = now.astimezone(timezone.utc)
    date_to = current_utc.date()
    date_from = date_to - timedelta(days=days - 1)
    start_at = datetime.combine(date_from, time.min, tzinfo=timezone.utc)
    end_at_exclusive = datetime.combine(
        date_to + timedelta(days=1),
        time.min,
        tzinfo=timezone.utc,
    )
    return UtcCalendarWindow(
        date_from=date_from,
        date_to=date_to,
        start_at=start_at,
        end_at_exclusive=end_at_exclusive,
    )
