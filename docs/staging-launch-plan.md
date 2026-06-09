# Staging Launch Plan

This is the sequence to get SeaDays running against real hosted services for internal testing.

## Goal

Get a staging loop where:

1. Supabase hosts auth and Postgres.
2. Render hosts the FastAPI API.
3. The API can run migrations and answer public smoke-test endpoints.
4. The Expo app can later point to the staging API and Supabase auth.

## Phase 1: Supabase Staging

Create a Supabase staging project.

Collect these values for the API environment:

- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_JWT_ISSUER`
- `SUPABASE_JWT_SECRET`

Collect these values for the Expo app environment:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Run the database migration from a trusted local machine.

If the direct database URL points at `db.<project-ref>.supabase.co` and fails locally with DNS or IPv6 connection errors, switch `DATABASE_URL` to the Supabase connection pooler URL. Keep `?sslmode=require` on the end.

```powershell
cd api
$env:DATABASE_URL="<supabase-postgres-url>"
$env:SUPABASE_URL="<supabase-project-url>"
$env:SUPABASE_JWT_ISSUER="https://<project-ref>.supabase.co/auth/v1"
$env:SUPABASE_JWT_SECRET="<supabase-jwt-secret>"
python -m alembic upgrade head
```

## Phase 2: Render Staging API

Use the repo `render.yaml` blueprint or manually create a Render web service.

Manual settings:

- Root directory: `api`
- Build command: `python -m pip install -r requirements.txt`
- Start command: `python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT`

Required Render env vars:

- `ENVIRONMENT=staging`
- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_JWT_AUDIENCE=authenticated`
- `SUPABASE_JWT_ISSUER`
- `SUPABASE_JWT_SECRET`

R2 env vars can be present now or added before export work:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`
- `R2_PUBLIC_BASE_URL`

## Phase 3: R2 Staging

Create a private Cloudflare R2 bucket.

Suggested name:

```text
seadays-staging
```

Create least-privilege R2 credentials for that bucket and add them to Render.

R2 is not required for the first API health/progress test, but it is required before generated PDFs and evidence uploads.

## Phase 4: Smoke Test

After Render deploys, run:

```powershell
python api/scripts/smoke_test.py https://<render-service-url>
```

Expected:

- `/health` returns `{"status":"ok"}`
- `/v1/progress/oupv` returns progress for a one-day mock payload

## Phase 5: App Hookup

Create `app/.env`:

```text
EXPO_PUBLIC_API_BASE_URL=https://<render-service-url>
EXPO_PUBLIC_SUPABASE_URL=<supabase-project-url>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-key>
```

Then install app dependencies and run Expo:

```powershell
cd app
npm install
npm run web
```

## Current Constraint

This workstation does not currently have `npm` on PATH, so Expo install/typecheck/run cannot happen here until Node.js is installed or available in the shell.
