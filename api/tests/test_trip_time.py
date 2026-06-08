from datetime import datetime, timezone

import pytest

from app.services.trip_time import normalize_time_precision, trip_has_usable_time_range


def test_blank_time_precision_defaults_to_exact() -> None:
    assert normalize_time_precision(None) == "exact"
    assert normalize_time_precision("") == "exact"


def test_invalid_time_precision_is_rejected() -> None:
    with pytest.raises(ValueError):
        normalize_time_precision("kind_of_sort_of")


def test_date_only_trip_does_not_have_usable_time_range() -> None:
    assert (
        trip_has_usable_time_range(
            datetime(2026, 6, 1, 8, tzinfo=timezone.utc),
            datetime(2026, 6, 1, 16, tzinfo=timezone.utc),
            "date_only",
        )
        is False
    )


def test_exact_trip_has_usable_time_range() -> None:
    assert (
        trip_has_usable_time_range(
            datetime(2026, 6, 1, 8, tzinfo=timezone.utc),
            datetime(2026, 6, 1, 16, tzinfo=timezone.utc),
            "exact",
        )
        is True
    )

