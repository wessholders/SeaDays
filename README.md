# SeaDays

SeaDays helps mariners track sea-service time toward USCG credentials, starting with OUPV/6-pack while keeping the data model extensible for future licenses.

## Product Direction

The MVP is manual-first:

- Log sea-service sessions with vessel, date, route, role, waters, and duration.
- Track progress toward credential requirements without locking records to one license type.
- Preserve an audit trail for edits and verification state.
- Prepare data for owner verification and CG-719S form generation.

GPS/geofencing, DocuSign or Dropbox Sign, and automated form compilation should layer onto the same sea-service records after manual logging is solid.

## Stack

- Frontend: Flutter
- Backend: Supabase/PostgreSQL
- Auth: Supabase Auth
- Database security: PostgreSQL row-level security
- Future integrations: device location, push notifications, DocuSign or Dropbox Sign

## Repo Layout

- `app/` - Flutter app source
- `supabase/migrations/` - database migrations
- `docs/` - product and architecture notes
- `GIS/` - local GIS data, intentionally ignored by git

## Local Setup

Flutter is installed at `C:\Users\m3ecewjs\flutter`, but this machine does not allow editing global PATH. Use the full Flutter path:

```powershell
cd app
C:\Users\m3ecewjs\flutter\bin\flutter.bat pub get
C:\Users\m3ecewjs\flutter\bin\flutter.bat test
C:\Users\m3ecewjs\flutter\bin\flutter.bat run -d chrome
```

For Supabase, create a project and apply migrations in `supabase/migrations`.

## Local Backend Mode

This workstation currently has DNS/TLS issues reaching Supabase. Use mock mode in `app/.env` to keep building UI and workflow without network calls:

```env
USE_MOCK_BACKEND=true
```

Set it to `false` on a network that can reach Supabase. The app will then require `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`.
