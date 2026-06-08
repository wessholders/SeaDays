# Architecture

## Recommended App Shape

Use a shared Expo / React Native app for iOS, Android, and web. This gives us a single product surface during free testing while still keeping a credible path to App Store and Play Store distribution.

Use a separate API backend rather than relying entirely on a hosted backend-as-a-service. The domain will eventually need regulatory logic, exports, audit history, billing entitlements, and possible organization workflows. Owning the backend keeps those boundaries clean.

Render, Supabase, and Cloudflare R2 are a good fit for the first serious version:

- **Render:** Hosts the FastAPI API and background workers.
- **Supabase:** Provides managed Postgres and authentication.
- **Cloudflare R2:** Stores generated PDFs, uploaded documents, and future evidence attachments without tying the app to one compute provider.

## Major Components

- **Mobile/web client:** Expo Router app with shared screens and platform-specific polish where needed.
- **Local data store:** SQLite for offline trip drafts, vessels, and sync queue records.
- **Sync engine:** Push local changes when online, pull server changes, resolve conflicts by entity version and field-level edit timestamps where needed.
- **API service:** FastAPI on Render with typed schemas, auth middleware, and explicit tenant/user ownership checks.
- **Primary database:** Supabase Postgres.
- **Auth provider:** Supabase Auth. App tables reference the Supabase auth user UUID through our `profiles` table.
- **Object storage:** Cloudflare R2 for generated PDFs, uploaded vessel documents, signatures, and future evidence attachments.
- **Background workers:** Form generation, export package assembly, billing webhooks, and eventually verification reminders.

## Security Baseline

- Let Supabase Auth own password storage and session issuance.
- Verify Supabase JWTs in the API and enforce app-level ownership checks.
- Enforce ownership checks in every API route.
- Keep audit events append-only.
- Never store SSNs unless we absolutely need to. If later required for form filling, encrypt field-level values and minimize retention.
- Separate generated submission packages from raw user-uploaded evidence.
- Rate-limit auth and export endpoints.
- Treat mobile clients as untrusted.

## Offline Strategy

The client should be useful with no signal:

- Create and edit trips locally.
- Create vessels locally.
- Queue changes for sync.
- Show credential progress from the latest local dataset.
- Mark records as pending sync, synced, or conflicted.

The first sync implementation can be pragmatic:

- Each mutable row has `id`, `created_at`, `updated_at`, `deleted_at`, and `version`.
- Client writes produce local change records.
- API accepts idempotent upserts with client-generated UUIDs.
- Conflicts initially surface to the user when the same entity changed on multiple devices.

## Regulatory Logic

Credential requirements and form mappings should live in versioned configuration, not scattered conditionals.

Examples:

- Credential goal type: OUPV.
- Requirement effective date.
- Required total days.
- Recency windows.
- Near coastal/inland distinctions.
- Mapping from trip/vessel fields to CG-719S fields.

Before each submission export, the system should use the latest supported ruleset and show the user which version was used.

## Testing Strategy

Start with focused automated tests around:

- Sea day calculation.
- Trip validation.
- Edit history creation.
- Sync idempotency.
- API ownership checks.
- Export data mapping.

Add end-to-end mobile/web smoke tests once the first screens exist.

## Near-Term Build Order

1. Create the Expo app and FastAPI service skeleton.
2. Configure Supabase Auth and Postgres migrations.
3. Implement API auth middleware that validates Supabase JWTs.
4. Implement user profile and vessels.
5. Implement trip logging with local-first storage.
6. Implement OUPV progress calculation.
7. Implement audit history for trip edits.
8. Implement basic export summary stored in R2.
