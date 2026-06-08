# SeaDays Architecture

## Engineering Position

Build the first release around trusted manual sea-service logging. GPS evidence, geofencing, signatures, and form generation are verification layers over the same core records, not separate products.

## MVP Scope

1. User signs in.
2. User creates vessels and owner contacts.
3. User records manual sea-service sessions.
4. App calculates sea days and progress toward OUPV/6-pack.
5. User can see records that are incomplete, unverified, or ready for owner signature.

## Core Concepts

- `license_types`: Credentials such as OUPV, Master, or future endorsements.
- `license_requirements`: Structured rules attached to license types.
- `vessels`: Boats a mariner served on.
- `sea_service_entries`: The source-of-truth log record.
- `entry_location_evidence`: Optional GPS/geofence evidence for an entry.
- `signature_requests`: Owner verification workflow state.
- `form_exports`: Generated form/package metadata.
- `audit_events`: Immutable trail for sensitive changes.

## Server-Side Read Models

The app should read dashboard state from database views instead of recalculating official progress in Flutter:

- `sea_service_entry_credits`: per-entry credited days, completion warnings, and owner-signature readiness.
- `oupv_progress`: total, recent, and near-coastal progress for the current mariner.
- `owner_signature_batches`: vessel-grouped entries ready to send for owner attestation.

Flutter can still show local optimistic calculations during data entry, but exports and eligibility messaging should come from these views.

## OUPV Rules Baseline

The initial OUPV target should use configurable requirements seeded from current NMC checklist structure:

- 360 total days of service.
- Near Coastal: 90 days on Ocean, Near Coastal, or Great Lakes waters.
- Recency: 90 days in the past 7 years.

Do not hard-code these rules only in the Flutter client. Keep them in Postgres so requirements can evolve by credential and checklist revision.

## Verification Model

Each sea-service entry has a `verification_status`:

- `draft`: User is still editing.
- `self_reported`: Manual record submitted by the mariner.
- `owner_requested`: Signature request sent.
- `owner_verified`: Owner signed or attested.
- `rejected`: Owner or reviewer rejected.
- `exported`: Used in an export package.

This lets us launch fast with manual logging while preserving a path to defensible records.

## GPS Strategy

GPS should be optional at first. When added, capture evidence rather than letting GPS own the entry:

- start coordinate
- end coordinate
- sampled track or summarized bounding box
- inferred waters classification
- confidence score
- user override reason

That keeps battery, permissions, and poor reception from blocking logging.

## Security Notes

- Every user-owned table must use row-level security.
- Never trust client-calculated sea-day totals for official exports.
- Store generated forms in private Supabase Storage buckets.
- Keep signature provider webhook handlers server-side.
- Treat owner email, vessel documents, and generated forms as sensitive PII.
