# Roadmap

## Phase 0: Foundation

- Choose and document stack.
- Scaffold web/mobile app and API service.
- Add local development setup.
- Add database migrations.
- Add CI checks.

## Phase 1: Logging MVP

- Sign up, sign in, sign out.
- User profile.
- Vessel profiles.
- Offline trip creation and editing.
- Trip list, trip detail, and quick-add flow.
- Basic OUPV progress dashboard.
- Edit history for trips and vessels.

## Phase 2: Free Testing

- Invite-only tester onboarding.
- Feedback capture.
- Basic analytics for activation and retention.
- CSV/PDF sea service summary export.
- Manual admin support tools.

## Phase 3: Submission Prep

- CG-719S mapping.
- Submission package checklist.
- Form data review screen.
- Generated PDF package storage.
- Immutable export snapshots.

## Phase 4: Subscription

- Stripe billing.
- Trial and subscription entitlements.
- Paid exports.
- Account management.

## Phase 5: Trust and Expansion

- Cross-user trip verification.
- Owner/captain signatures.
- Evidence attachments.
- School and charter company accounts.
- Additional USCG credentials and endorsements.

## Immediate Next Step

Scaffold the app and API so the first working slice can be: create vessel, log trip offline, sync trip, and see OUPV progress.

See [Stand-Up Todo](standup-todo.md) for the implementation checklist.

## Infrastructure Timing

Create Supabase and Render staging after the local API has vessel and trip CRUD, audit events, and the initial migration stabilized. Do this before implementing real mobile auth, offline sync, and tester distribution, because those features need hosted Supabase Auth/Postgres behavior.
