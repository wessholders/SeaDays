# Infrastructure

SeaDays will use Supabase, Render, and Cloudflare R2.

## When To Connect Hosted Services

Create staging infrastructure after local vessel/trip CRUD, audit events, and the initial migration are stable. That point has effectively arrived for the backend foundation.

Do hosted setup before:

- Real mobile auth.
- Offline sync against server state.
- External tester distribution.
- Export generation stored in R2.

## Supabase

Use Supabase for:

- Postgres.
- Auth.
- Hosted project environments for staging and production.

Initial setup:

- Create a staging Supabase project.
- Enable email/password auth.
- For local core-feature testing, email confirmation can be temporarily disabled.
- Re-enable email confirmation before external testers.
- Configure custom SMTP before production so signup, confirmation, password reset, and email-change flows are reliable and rate limits are controlled.
- Copy the project URL into `SUPABASE_URL`.
- Set `SUPABASE_JWT_ISSUER` to the project auth issuer.
- Set `SUPABASE_JWT_SECRET` from the Supabase project JWT settings.
- Set `DATABASE_URL` to the Supabase Postgres connection string.
- Run `python -m alembic upgrade head` from `api/`.

Do not put the Supabase service role key in the mobile app.

## Render

Use Render for:

- FastAPI web service.
- Background worker service later.

Initial web service settings:

- Root directory: `api`
- Build command: `python -m pip install -r requirements.txt`
- Start command: `python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT`

Required environment variables:

- `ENVIRONMENT=staging`
- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_JWT_AUDIENCE=authenticated`
- `SUPABASE_JWT_ISSUER`
- `SUPABASE_JWT_SECRET`

## Cloudflare R2

Use R2 for:

- Generated sea service summaries.
- Future CG-719S packages.
- Uploaded supporting documents.
- Future verification evidence.

Initial setup:

- Create a staging bucket.
- Create a least-privilege API token.
- Configure `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET` on Render.

Object keys should not include user emails, names, vessel names, or other personal data.

See [Environment Setup](environment-setup.md) for exact variables and where to find them.
