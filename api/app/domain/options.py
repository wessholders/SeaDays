from dataclasses import dataclass


OWNERSHIP_TYPES = {
    "owned",
    "family_or_friend",
    "chartered",
    "employer",
    "school",
    "crew",
    "unknown",
}

PROPULSION_TYPES = {
    "outboard",
    "inboard",
    "sterndrive",
    "sail",
    "auxiliary_sail",
    "jet",
    "pod",
    "other",
}

VESSEL_IDENTIFIER_TYPES = {
    "state_registration",
    "uscg_official_number",
    "documentation_number",
    "hull_identification_number",
    "other",
}

SERVICE_ROLES = {
    "master",
    "mate",
    "operator",
    "deckhand",
    "engine",
    "other",
}

PURPOSE_TYPES = {
    "recreational",
    "delivery",
    "charter",
    "training",
    "racing",
    "maintenance",
    "commercial",
    "other",
}

WATER_BODY_TYPES = {
    "inland",
    "near_coastal",
    "offshore",
    "ocean",
    "great_lakes",
    "shoreward_boundary_line",
    "seaward_boundary_line",
    "unknown",
}


@dataclass(frozen=True)
class DomainOption:
    value: str
    label: str


def normalize_option(value: str, allowed_values: set[str], field_name: str) -> str:
    normalized = value.strip().lower()
    if normalized not in allowed_values:
        raise ValueError(f"unsupported {field_name}")
    return normalized


def label_for_option(value: str) -> str:
    return value.replace("_", " ").title()

