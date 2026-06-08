from __future__ import annotations

import argparse
import json
import sys
from typing import Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def request_json(url: str, payload: Optional[dict] = None) -> tuple[int, dict]:
    data = None
    headers = {"Accept": "application/json"}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    request = Request(url, data=data, headers=headers, method="POST" if payload else "GET")
    with urlopen(request, timeout=20) as response:
        body = response.read().decode("utf-8")
        return response.status, json.loads(body)


def main() -> int:
    parser = argparse.ArgumentParser(description="Smoke test a SeaDays API deployment.")
    parser.add_argument("base_url", help="API base URL, for example https://seadays-api-staging.onrender.com")
    args = parser.parse_args()

    base_url = args.base_url.rstrip("/")
    checks = [
        ("health", f"{base_url}/health", None),
        (
            "oupv progress",
            f"{base_url}/v1/progress/oupv",
            {
                "trips": [
                    {
                        "qualifying_day_count": 1,
                        "near_coastal": True,
                        "recency_eligible": True,
                    }
                ]
            },
        ),
    ]

    try:
        for name, url, payload in checks:
            status, body = request_json(url, payload)
            print(f"{name}: {status} {body}")
    except HTTPError as error:
        print(f"HTTP error: {error.code} {error.read().decode('utf-8')}", file=sys.stderr)
        return 1
    except (URLError, TimeoutError) as error:
        print(f"Network error: {error}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
