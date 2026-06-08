# SeaDays API

FastAPI service for SeaDays domain logic, sync, audit history, exports, and subscription enforcement.

## Local Setup

```powershell
cd api
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest
```

## Responsibilities

- Verify Supabase Auth JWTs.
- Enforce app-level ownership checks.
- Serve profile, vessel, trip, credential goal, and progress endpoints.
- Record audit events for sensitive edits.
- Coordinate offline sync.
- Generate submission/export artifacts and store them in R2.

