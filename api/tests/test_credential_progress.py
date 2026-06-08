from app.services.credential_progress import ProgressInput, TripCredit, calculate_oupv_progress


def test_oupv_progress_counts_total_and_recent_days() -> None:
    progress = calculate_oupv_progress(
        ProgressInput(
            trips=[
                TripCredit(qualifying_day_count=100, recency_eligible=True),
                TripCredit(qualifying_day_count=275, recency_eligible=False),
            ]
        )
    )

    assert progress.total_days.complete is True
    assert progress.total_days.credited == 375
    assert progress.total_days.remaining == 0
    assert progress.recent_days.complete is True
    assert progress.recent_days.credited == 100


def test_oupv_progress_tracks_remaining_days() -> None:
    progress = calculate_oupv_progress(
        ProgressInput(
            trips=[
                TripCredit(qualifying_day_count=10, near_coastal=True),
                TripCredit(qualifying_day_count=20, inland=True),
            ]
        )
    )

    assert progress.total_days.complete is False
    assert progress.total_days.remaining == 330
    assert progress.recent_days.remaining == 60
    assert progress.near_coastal_days == 10
    assert progress.inland_days == 20

