# Stand-Up Todo

This is the practical checklist for turning SeaDays from planning docs into a working free-test product.

## 1. Product Decisions

- Confirm initial credential target: USCG OUPV / Six-Pack.
- Define the first trip logging fields required for MVP.
- Define the minimum vessel fields required for MVP.
- Decide whether free testers need invite codes, manual approval, or open signup.
- Decide what “good enough” export means before official CG-719S generation.

## 2. Accounts And Infrastructure

- [x] Create Supabase project.
- [x] Enable Supabase Auth email/password.
- [ ] Temporarily disable email confirmation for local core-feature testing.
- [ ] Re-enable email confirmation before external testers.
- [ ] Configure custom SMTP for Supabase Auth before production.
- Create Supabase database migration workflow.
- Create Cloudflare R2 bucket for generated exports and uploads.
- Create R2 API token with least-privilege access.
- Create Render account/project.
- Create Render web service for FastAPI API.
- Create Render background worker service placeholder.
- Configure environment variables for local, staging, and production.

## 3. Repository Foundation

- [x] Scaffold app workspace.
- [ ] Add Expo / React Native app with Expo Router.
- [x] Add FastAPI backend service.
- [x] Add shared developer setup instructions.
- [ ] Add formatting and linting.
- [x] Add basic automated test commands.
- [x] Add CI workflow for API tests.
- [x] Add `.env.example` files for app and API.

## 4. Database

- [x] Convert `database/001_initial_schema.sql` into the chosen migration format.
- Apply initial schema to Supabase.
- Add row-level security policies or explicitly document API-only access for MVP.
- Add seed data for local development.
- Add schema verification test.
- Add migration rollback/recovery notes.

## 5. API

- [x] Add FastAPI app skeleton.
- [x] Add health check endpoint.
- [x] Add core API schemas for profiles, vessels, and trips.
- [x] Add Supabase JWT verification.
- Add authenticated profile endpoint.
- [x] Add vessel CRUD endpoints.
- [x] Add trip CRUD endpoints.
- Add credential goal CRUD endpoints.
- [x] Add OUPV progress endpoint.
- [x] Add audit event creation for vessel and trip edits.
- Add sync endpoint for offline client changes.
- Add R2 client wrapper.
- Add basic export summary endpoint.

## 6. Mobile/Web App

- [x] Add auth screens.
- Add app shell navigation.
- Add profile setup screen.
- Add vessel list and vessel form.
- Add trip list and trip form.
- Add offline local SQLite store.
- Add local sync queue.
- Add sync status indicators.
- Add OUPV progress dashboard.
- Add basic export request screen.

## 7. Offline Sync

- Define client-generated UUID strategy.
- Define local table shape matching server entities.
- Implement create/edit while offline.
- Implement sync push.
- Implement sync pull.
- Implement conflict detection.
- Add user-facing conflict state for MVP.
- Add tests around idempotent sync.

## 8. USCG Logic

- Create versioned credential ruleset structure.
- [x] Add initial OUPV planning ruleset.
- [ ] Add trip qualification calculation.
- [x] Add progress calculation tests.
- Map stored fields to future CG-719S fields.
- Record ruleset version on exports.

## 9. Security And Privacy

- Verify every API route enforces user ownership.
- Add auth rate-limit plan.
- Avoid SSN storage in MVP.
- Add audit event coverage for sensitive edits.
- Add R2 object key strategy that avoids leaking personal information.
- Add backup and recovery notes.
- Add privacy policy draft before external testing.
- Add terms of use draft before external testing.

## 10. Free Tester Launch

- [ ] Deploy API to Render staging.
- [ ] Connect staging API to Supabase staging project.
- [ ] Connect staging API to R2 staging bucket.
- Deploy web build.
- Prepare iOS/Android test distribution plan.
- Create tester onboarding flow.
- Add in-app feedback capture.
- Add lightweight analytics for activation and retention.
- Create support process for tester issues.

## 11. Subscription Readiness

- Decide subscription tiers.
- Decide free trial behavior.
- Add entitlement model.
- Add Stripe account.
- Add Stripe webhook endpoint.
- Add subscription status checks in API.
- Gate exports or premium features behind entitlement checks.

## First Build Milestone

The first milestone should be:

1. A user can sign up and sign in.
2. A user can create a vessel, even if they do not own it.
3. A user can log a trip offline.
4. The trip syncs when online.
5. The user sees OUPV progress.
6. Edits to trips and vessels create audit events.

That gives us a real product loop before we spend time on polished submission packages.
