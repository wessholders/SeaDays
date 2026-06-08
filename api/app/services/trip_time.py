from datetime import datetime
from typing import Optional


TIME_PRECISION_EXACT = "exact"
TIME_PRECISION_APPROXIMATE = "approximate"
TIME_PRECISION_DATE_ONLY = "date_only"
TIME_PRECISION_UNKNOWN = "unknown"

TIME_PRECISIONS = {
    TIME_PRECISION_EXACT,
    TIME_PRECISION_APPROXIMATE,
    TIME_PRECISION_DATE_ONLY,
    TIME_PRECISION_UNKNOWN,
}


def normalize_time_precision(value: Optional[str]) -> str:
    if value is None or value.strip() == "":
        return TIME_PRECISION_EXACT
    normalized = value.strip().lower()
    if normalized not in TIME_PRECISIONS:
        raise ValueError("unsupported time precision")
    return normalized


def trip_has_usable_time_range(
    started_at: Optional[datetime],
    ended_at: Optional[datetime],
    time_precision: str,
) -> bool:
    precision = normalize_time_precision(time_precision)
    if precision in {TIME_PRECISION_DATE_ONLY, TIME_PRECISION_UNKNOWN}:
        return False
    return started_at is not None and ended_at is not None and ended_at >= started_at
