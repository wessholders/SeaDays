# SeaDays

SeaDays helps recreational boaters and professional mariners log sea service, track progress toward USCG credentials, and prepare submission-ready documentation.

The first product focus is U.S. Coast Guard OUPV / Six-Pack candidates, while keeping the data model flexible enough for later credentials such as Master, sailing endorsements, towing endorsements, schools, charter operators, and crew-managed workflows.

## Initial Product Bet

Logging sea time should be fast, offline-capable, and organized around the way mariners actually think:

- Where did I go?
- What vessel was I on?
- What role did I serve?
- How many qualifying days/hours did this count for?
- What license goals did this trip help?
- Can I confidently submit this later?

## Planned Stack

- **Client:** Expo / React Native with Expo Router for iOS, Android, and web from one codebase.
- **Offline storage:** Local SQLite on device, synced to the API when online.
- **API:** FastAPI service on Render with typed request/response schemas.
- **Database:** Supabase Postgres.
- **Migrations:** Alembic.
- **Auth:** Supabase Auth, with app-level authorization checks in our API.
- **Object storage:** Cloudflare R2 for generated PDFs, uploaded documents, and future evidence attachments.
- **Billing:** Subscription model, added after the free testing loop proves activation and retention.

## Current Planning Docs

- [Product Brief](docs/product-brief.md)
- [Architecture](docs/architecture.md)
- [Data Model](docs/data-model.md)
- [Database Schema](docs/database-schema.md)
- [Roadmap](docs/roadmap.md)
- [Stand-Up Todo](docs/standup-todo.md)
- [Development](docs/development.md)
- [Infrastructure](docs/infrastructure.md)
- [Environment Setup](docs/environment-setup.md)
- [Staging Launch Plan](docs/staging-launch-plan.md)

## Repository Layout

- `api/` - FastAPI backend for domain logic, sync, exports, and authorization.
- `app/` - Expo / React Native client for iOS, Android, and web.
- `database/` - SQL schema and future migrations.
- `docs/` - Product and engineering planning.
