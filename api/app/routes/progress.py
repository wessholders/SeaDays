from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.credential_progress import ProgressInput, TripCredit, calculate_oupv_progress

router = APIRouter(prefix="/progress", tags=["progress"])


class TripCreditRequest(BaseModel):
    qualifying_day_count: float = Field(ge=0)
    near_coastal: bool = False
    inland: bool = False
    recency_eligible: bool = True


class OupvProgressRequest(BaseModel):
    trips: list[TripCreditRequest]


@router.post("/oupv")
def preview_oupv_progress(payload: OupvProgressRequest) -> dict[str, object]:
    progress = calculate_oupv_progress(
        ProgressInput(
            trips=[
                TripCredit(
                    qualifying_day_count=trip.qualifying_day_count,
                    near_coastal=trip.near_coastal,
                    inland=trip.inland,
                    recency_eligible=trip.recency_eligible,
                )
                for trip in payload.trips
            ]
        )
    )
    return progress.to_dict()
