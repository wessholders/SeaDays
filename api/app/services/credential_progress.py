from dataclasses import asdict, dataclass


OUPV_TOTAL_DAYS_REQUIRED = 360
OUPV_RECENT_DAYS_REQUIRED = 90


@dataclass(frozen=True)
class TripCredit:
    qualifying_day_count: float
    near_coastal: bool = False
    inland: bool = False
    recency_eligible: bool = True

    def __post_init__(self) -> None:
        if self.qualifying_day_count < 0:
            raise ValueError("qualifying_day_count must be nonnegative")


@dataclass(frozen=True)
class ProgressInput:
    trips: list[TripCredit]


@dataclass(frozen=True)
class RequirementProgress:
    required: float
    credited: float
    remaining: float
    complete: bool


@dataclass(frozen=True)
class OupvProgress:
    ruleset_version: str
    total_days: RequirementProgress
    recent_days: RequirementProgress
    near_coastal_days: float
    inland_days: float

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


def _requirement(required: float, credited: float) -> RequirementProgress:
    rounded_credit = round(credited, 2)
    return RequirementProgress(
        required=required,
        credited=rounded_credit,
        remaining=max(round(required - rounded_credit, 2), 0),
        complete=rounded_credit >= required,
    )


def calculate_oupv_progress(progress_input: ProgressInput) -> OupvProgress:
    total_days = sum(trip.qualifying_day_count for trip in progress_input.trips)
    recent_days = sum(
        trip.qualifying_day_count
        for trip in progress_input.trips
        if trip.recency_eligible
    )
    near_coastal_days = sum(
        trip.qualifying_day_count
        for trip in progress_input.trips
        if trip.near_coastal
    )
    inland_days = sum(
        trip.qualifying_day_count
        for trip in progress_input.trips
        if trip.inland
    )

    return OupvProgress(
        ruleset_version="uscg-oupv-planning-v1",
        total_days=_requirement(OUPV_TOTAL_DAYS_REQUIRED, total_days),
        recent_days=_requirement(OUPV_RECENT_DAYS_REQUIRED, recent_days),
        near_coastal_days=round(near_coastal_days, 2),
        inland_days=round(inland_days, 2),
    )
