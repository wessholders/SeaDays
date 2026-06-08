import pytest

from app.services.measurements import (
    feet_inches_to_total_inches,
    total_inches_to_feet_inches,
)


def test_feet_inches_round_trip() -> None:
    total = feet_inches_to_total_inches(27, 6)
    display = total_inches_to_feet_inches(total)

    assert total == 330
    assert display.feet == 27
    assert display.inches == 6


def test_inches_must_be_normalized_for_entry() -> None:
    with pytest.raises(ValueError):
        feet_inches_to_total_inches(10, 12)

