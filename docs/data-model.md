# Data Model

This is the initial logical model. It is intentionally broader than the first screen set so we do not paint ourselves into a corner.

See [Database Schema](database-schema.md) for the first concrete Supabase Postgres shape.

## Users

Supabase Auth owns login identities. SeaDays owns app profiles.

`profiles`

- `id` matching the Supabase Auth user UUID
- `email`
- `display_name`
- `legal_first_name`
- `legal_middle_name`
- `legal_last_name`
- `phone`
- `address`
- `mariner_reference_number`
- `date_of_birth`

Sensitive fields should be optional and added only when needed for export workflows. Avoid SSN storage in the MVP.

## Vessels

`vessels`

- `id`
- `created_by_profile_id`
- `name`
- `display_name`
- `make`
- `model`
- `year`
- `hailing_port`
- `ownership_type`
- `owner_name`
- `owner_contact`
- `length_overall_inches`
- `beam_inches`
- `draft_inches`
- `gross_tons`
- `propulsion_type`
- `route_type`
- `created_at`
- `updated_at`
- `deleted_at`
- `version`

Vessel records are user-entered vessel profiles, not proof of ownership. A user may own the vessel, crew on it, charter it, borrow it, or only know partial historical details. Later verification can attach owner/captain attestations without changing the core trip log.

`vessel_identifiers`

- `id`
- `vessel_id`
- `identifier_type`
- `identifier_value`
- `issuing_country`
- `issuing_region`
- `is_primary`

Registration, state registration, USCG official number, documentation number, and other identifiers are separated from the vessel record because a vessel can have more than one identifier over time. The UI should still make this feel simple by showing a primary registration/official number field first.

## Trips

`trips`

- `id`
- `user_id`
- `vessel_id`
- `trip_date`
- `started_at`
- `ended_at`
- `time_precision`
- `service_role`
- `purpose_type`
- `purpose_notes`
- `location_name`
- `departure_port`
- `arrival_port`
- `water_body_name`
- `water_body_type`
- `distance_nm`
- `distance_offshore_nm`
- `role`
- `underway_hours`
- `day_count`
- `night_hours`
- `near_coastal`
- `inland`
- `captain_name`
- `notes`
- `status`
- `created_at`
- `updated_at`
- `deleted_at`
- `version`

`day_count` should be calculated but overridable with an audit trail, because historical logs may be imperfect.

For MVP, `service_role` should support at least `master`, `mate`, `operator`, `deckhand`, `engine`, and `other`. The first UI can emphasize Master and Mate because that is what the user asked for, but the model should not block CG-719S-compatible served-as values.

Historical trips may not have exact start and end times. `time_precision` should support exact, approximate, date-only, and unknown values. When time precision is not exact, the UI should make that clear and the audit/export logic should preserve the user's stated precision.

Trip purpose should use a preset `purpose_type` plus optional `purpose_notes`. This keeps reporting clean while still letting users describe unusual trips.

## Credential Goals

`credential_goals`

- `id`
- `user_id`
- `credential_type`
- `route`
- `target_tonnage`
- `started_at`
- `status`
- `created_at`
- `updated_at`

`credential_goal_trip_links`

- `credential_goal_id`
- `trip_id`
- `qualifies`
- `qualifying_day_count`
- `calculation_notes`

A trip can support more than one credential goal.

## Audit History

`audit_events`

- `id`
- `user_id`
- `entity_type`
- `entity_id`
- `action`
- `changed_fields`
- `occurred_at`
- `client_id`
- `ip_address`

For MVP, use audit history for trip and vessel edits. Later, make submission packages immutable snapshots with their own audit events.

## Sync

`client_devices`

- `id`
- `user_id`
- `device_name`
- `platform`
- `last_seen_at`

`sync_change_log`

- `id`
- `user_id`
- `device_id`
- `entity_type`
- `entity_id`
- `operation`
- `payload`
- `base_version`
- `created_at`
- `processed_at`

The local client should maintain a compatible queue, but the server-side table gives us observability and idempotency.

## Future Verification

`verification_requests`

- `id`
- `trip_id`
- `requested_by_user_id`
- `verifier_email`
- `verifier_user_id`
- `verification_type`
- `status`
- `created_at`
- `completed_at`

This is intentionally not MVP, but the trip model should allow it later.
