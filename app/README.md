# SeaDays App

Expo / React Native app target for iOS, Android, and web.

The first app milestone is:

- Supabase Auth sign-in/sign-up.
- Vessel list and vessel form.
- Offline trip logging with local SQLite.
- Sync indicators.
- OUPV progress dashboard.

## Local Setup

```powershell
cd app
npm install
npm run start
```

Use Expo Go or a browser target for early testing. The app currently starts in mock mode and will later connect to Supabase Auth plus the SeaDays API.

## Viewing The Front End

This machine needs Node.js/npm on PATH before Expo can run.

Once Node.js is installed:

```powershell
cd api
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

In a second terminal:

```powershell
cd app
npm install
npm run web
```

Open the URL Expo prints, usually `http://localhost:8081`.

If `app/.env` contains real Supabase values, the app shows sign-in/sign-up and calls the local API. If Supabase values are placeholders, it uses the mock dashboard.
