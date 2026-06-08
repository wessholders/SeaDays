from dataclasses import dataclass


@dataclass(frozen=True)
class FeetInches:
    feet: int
    inches: int


def feet_inches_to_total_inches(feet: int, inches: int) -> int:
    if feet < 0:
        raise ValueError("feet must be nonnegative")
    if inches < 0 or inches > 11:
        raise ValueError("inches must be between 0 and 11")
    return feet * 12 + inches


def total_inches_to_feet_inches(total_inches: int) -> FeetInches:
    if total_inches < 0:
        raise ValueError("total_inches must be nonnegative")
    return FeetInches(feet=total_inches // 12, inches=total_inches % 12)

