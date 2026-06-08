import pytest

from app.domain.options import PROPULSION_TYPES, label_for_option, normalize_option


def test_normalize_option_accepts_supported_value() -> None:
    assert normalize_option(" Outboard ", PROPULSION_TYPES, "propulsion_type") == "outboard"


def test_normalize_option_rejects_unsupported_value() -> None:
    with pytest.raises(ValueError):
        normalize_option("rocket", PROPULSION_TYPES, "propulsion_type")


def test_label_for_option_formats_for_display() -> None:
    assert label_for_option("near_coastal") == "Near Coastal"

