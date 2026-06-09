from __future__ import annotations

import argparse
import json
import sys
from typing import Optional, Union
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from uuid import uuid4


def request_json(
    url: str,
    method: str = "GET",
    payload: Optional[dict] = None,
    headers: Optional[dict] = None,
) -> tuple[int, Union[dict, list]]:
    data = None
    request_headers = {"Accept": "application/json"}
    if headers:
        request_headers.update(headers)
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        request_headers["Content-Type"] = "application/json"

    request = Request(url, data=data, headers=request_headers, method=method)
    with urlopen(request, timeout=20) as response:
        body = response.read().decode("utf-8")
        return response.status, json.loads(body)


def main() -> int:
    parser = argparse.ArgumentParser(description="Smoke test SeaDays profile/vessel/trip CRUD.")
    parser.add_argument("base_url", help="API base URL, for example http://127.0.0.1:8000")
    default_profile_id = str(uuid4())
    parser.add_argument("--profile-id", default=default_profile_id)
    parser.add_argument("--email", default=f"local-smoke-{default_profile_id[:8]}@example.com")
    args = parser.parse_args()

    base_url = args.base_url.rstrip("/")
    auth_headers = {
        "X-Profile-Id": args.profile_id,
        "X-User-Email": args.email,
    }

    try:
        profile_status, profile = request_json(
            f"{base_url}/v1/profile",
            headers=auth_headers,
        )
        print(f"profile: {profile_status} {profile['id']}")

        vessel_status, vessel = request_json(
            f"{base_url}/v1/vessels",
            method="POST",
            headers=auth_headers,
            payload={
                "name": "Smoke Test",
                "display_name": "Smoke Test",
                "make": "Parker",
                "model": "2520",
                "ownership_type": "owned",
                "length_overall_inches": 300,
                "beam_inches": 114,
                "gross_tons": 6,
                "propulsion_type": "outboard",
                "identifiers": [
                    {
                        "identifier_type": "state_registration",
                        "identifier_value": f"SMOKE-{uuid4().hex[:8]}",
                        "issuing_region": "TX",
                        "is_primary": True,
                    }
                ],
            },
        )
        print(f"vessel create: {vessel_status} {vessel['id']}")

        trip_status, trip = request_json(
            f"{base_url}/v1/trips",
            method="POST",
            headers=auth_headers,
            payload={
                "vessel_id": vessel["id"],
                "trip_date": "2026-06-08",
                "started_at": "2026-06-08T13:00:00Z",
                "ended_at": "2026-06-08T21:00:00Z",
                "time_precision": "exact",
                "service_role": "master",
                "purpose_type": "recreational",
                "water_body_name": "Galveston Bay",
                "water_body_type": "near_coastal",
                "underway_hours": 8,
                "day_count": 1,
                "near_coastal": True,
                "status": "draft",
            },
        )
        print(f"trip create: {trip_status} {trip['id']}")

        trips_status, trips = request_json(
            f"{base_url}/v1/trips",
            headers=auth_headers,
        )
        print(f"trip list: {trips_status} count={len(trips)}")
    except HTTPError as error:
        print(f"HTTP error: {error.code} {error.read().decode('utf-8')}", file=sys.stderr)
        return 1
    except (URLError, TimeoutError) as error:
        print(f"Network error: {error}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
