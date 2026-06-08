# Development

## Repository Layout

- `api/`: FastAPI backend.
- `app/`: Expo / React Native client.
- `database/`: SQL migrations and database notes.
- `docs/`: Product, architecture, and planning documents.

## Backend

```powershell
cd api
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

## Database Migrations

Run migrations from the `api` directory after setting `DATABASE_URL`:

```powershell
cd api
.\.venv\Scripts\python.exe -m alembic upgrade head
```

For Supabase, use the pooled or direct Postgres connection string provided by the project dashboard. Do not commit the connection string.

## App

The app will use Expo. Once scaffolded with dependencies:

```powershell
cd app
npm install
npm run start
```

## Environment

Copy the example files before running services:

- `api/.env.example` to `api/.env`
- `app/.env.example` to `app/.env`

Do not commit real secrets.
