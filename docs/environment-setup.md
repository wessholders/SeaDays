# Environment Setup

This is the directed setup checklist for SeaDays staging. Do not paste secrets into chat or commit them to the repo. Put them directly into local `.env` files or provider environment-variable dashboards.

## Environments

Start with two environments:

- `local`: developer machine.
- `staging`: hosted test environment for free testers and internal validation.

Add `production` only after staging auth, migrations, sync, and tester workflows are stable.

## Supabase Staging

Create one Supabase project for staging.

Needed values:

- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_JWT_ISSUER`
- `SUPABASE_JWT_SECRET`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Where to find them:

- `SUPABASE_URL`: Supabase project URL.
- `EXPO_PUBLIC_SUPABASE_URL`: same as `SUPABASE_URL`.
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: Supabase anon public key.
- `SUPABASE_JWT_SECRET`: Supabase project JWT secret.
- `SUPABASE_JWT_ISSUER`: usually `https://<project-ref>.supabase.co/auth/v1`.
- `DATABASE_URL`: Supabase Postgres connection string.

Important:

- The anon key can be used by the mobile/web app.
- The JWT secret must only exist on the API server and local backend `.env`.
- The database password/connection string must only exist on the API server and local backend `.env`.
- Do not use the Supabase service role key in the mobile app.

## Render Staging API

Create one Render web service for the API.

Recommended settings:

- Root directory: `api`
- Build command: `python -m pip install -r requirements.txt`
- Start command: `python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT`

Render environment variables:

```text
ENVIRONMENT=staging
DATABASE_URL=<supabase-postgres-connection-string>
SUPABASE_URL=<supabase-project-url>
SUPABASE_JWT_AUDIENCE=authenticated
SUPABASE_JWT_ISSUER=https://<project-ref>.supabase.co/auth/v1
SUPABASE_JWT_SECRET=<supabase-jwt-secret>
R2_ACCOUNT_ID=<cloudflare-account-id>
R2_ACCESS_KEY_ID=<r2-access-key-id>
R2_SECRET_ACCESS_KEY=<r2-secret-access-key>
R2_BUCKET=<staging-r2-bucket-name>
R2_PUBLIC_BASE_URL=
```

Leave `R2_PUBLIC_BASE_URL` blank unless we intentionally configure public asset delivery. Generated documents should default to private access.

## Cloudflare R2 Staging

Create one private staging bucket.

Suggested bucket name:

```text
seadays-staging
```

Needed values:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`

Create an R2 API token with the narrowest practical permissions for the staging bucket.

Object-key rule:

- Do not include names, emails, vessel names, registration numbers, or other personal data in object keys.
- Prefer UUID-based keys such as `exports/<profile-id>/<export-id>.pdf`.

## Local API `.env`

Create `api/.env` from `api/.env.example`.

```text
ENVIRONMENT=local
API_HOST=127.0.0.1
API_PORT=8000
DATABASE_URL=<local-or-supabase-staging-db-url>
SUPABASE_URL=<supabase-project-url>
SUPABASE_JWT_AUDIENCE=authenticated
SUPABASE_JWT_ISSUER=https://<project-ref>.supabase.co/auth/v1
SUPABASE_JWT_SECRET=<supabase-jwt-secret>
R2_ACCOUNT_ID=<cloudflare-account-id>
R2_ACCESS_KEY_ID=<r2-access-key-id>
R2_SECRET_ACCESS_KEY=<r2-secret-access-key>
R2_BUCKET=seadays-staging
R2_PUBLIC_BASE_URL=
```

For purely local endpoint testing, the API currently allows temporary local dev auth headers when `ENVIRONMENT=local`. Staging and production should use Supabase Bearer tokens only.

## Local App `.env`

Create `app/.env` from `app/.env.example`.

```text
EXPO_PUBLIC_API_BASE_URL=<render-staging-api-url-or-local-api-url>
EXPO_PUBLIC_SUPABASE_URL=<supabase-project-url>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-key>
```

Only variables prefixed with `EXPO_PUBLIC_` belong in the Expo app. Treat everything in the app as visible to users.

## Migration Step

After `DATABASE_URL` is set for the API environment:

```powershell
cd api
.\.venv\Scripts\python.exe -m alembic upgrade head
```

For Render, run migrations manually at first from a trusted local machine against the staging Supabase database. Later, we can add a controlled migration job.

## Secret Handling

- Do not commit `.env` files.
- Do not send secrets through chat.
- Rotate any secret that is accidentally exposed.
- Use separate staging and production projects/secrets.
- Keep API/server secrets out of Expo.

