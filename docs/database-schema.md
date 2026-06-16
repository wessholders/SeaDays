# Database Schema

This is the first concrete Supabase Postgres schema target. It is designed for:

- Supabase Auth user IDs.
- Offline clients that create UUIDs before syncing.
- Multiple credential goals per user.
- One trip contributing to multiple goals.
- Edit history for sensitive records.
- Later verification, exports, organizations, and billing.

## Extensions

Enable these in Supabase:

```sql
create extension if not exists pgcrypto;
create extension if not exists citext;
```

## Core Tables

### `profiles`

One row per authenticated user. `id` should match the Supabase Auth user UUID.

```sql
create table profiles (
  id uuid primary key,
  email citext not null unique,
  display_name text,
  legal_first_name text,
  legal_middle_name text,
  legal_last_name text,
  phone text,
  address_line_1 text,
  address_line_2 text,
  city text,
  region text,
  postal_code text,
  country text default 'US',
  mariner_reference_number text,
  date_of_birth date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
```

### `vessels`

User-entered vessel profiles. A user may log sea service on vessels they own, crew on, charter, borrow, or only remember partially from historical records.

The app should collect length, beam, and draft as feet/inches in the UI. Store them as total inches in the database so validation and calculations stay simple, then convert back to feet/inches for CG-719S exports.

```sql
create table vessels (
  id uuid primary key default gen_random_uuid(),
  created_by_profile_id uuid not null references profiles(id),
  name text not null,
  display_name text,
  make text,
  model text,
  model_year integer,
  hailing_port text,
  ownership_type text not null default 'unknown',
  owner_name text,
  owner_contact text,
  owner_email text,
  owner_phone text,
  length_overall_inches integer,
  beam_inches integer,
  draft_inches integer,
  gross_tons numeric(7,2),
  propulsion_type text not null default 'outboard',
  route_type text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,
  constraint vessels_nonnegative_measurements check (
    (length_overall_inches is null or length_overall_inches >= 0) and
    (beam_inches is null or beam_inches >= 0) and
    (draft_inches is null or draft_inches >= 0) and
    (gross_tons is null or gross_tons >= 0)
  )
);
```

Initial `ownership_type` values:

- `owned`
- `family_or_friend`
- `chartered`
- `employer`
- `school`
- `crew`
- `unknown`

Initial `propulsion_type` values:

- `outboard`
- `inboard`
- `sterndrive`
- `sail`
- `auxiliary_sail`
- `jet`
- `pod`
- `other`

### `vessel_identifiers`

A vessel can have multiple registration or documentation identifiers. This avoids painting ourselves into a corner with a single `registration_number` column.

```sql
create table vessel_identifiers (
  id uuid primary key default gen_random_uuid(),
  vessel_id uuid not null references vessels(id) on delete cascade,
  identifier_type text not null,
  identifier_value text not null,
  issuing_country text default 'US',
  issuing_region text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
```

Initial `identifier_type` values:

- `state_registration`
- `uscg_official_number`
- `documentation_number`
- `hull_identification_number`
- `other`

### `credential_goals`

A user may pursue OUPV and other credentials at the same time.

```sql
create table credential_goals (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id),
  credential_type text not null,
  route text,
  target_tonnage numeric(7,2),
  status text not null default 'active',
  started_at date not null default current_date,
  completed_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1
);
```

Initial `credential_type`: `oupv`.

### `trips`

The central sea service record.

```sql
create table trips (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id),
  vessel_id uuid references vessels(id),
  trip_date date not null,
  started_at timestamptz,
  ended_at timestamptz,
  time_precision text not null default 'exact',
  service_role text not null,
  purpose_type text,
  purpose_notes text,
  location_name text,
  departure_port text,
  arrival_port text,
  water_body_name text,
  water_body_type text not null default 'unknown',
  distance_nm numeric(8,2),
  distance_offshore_nm numeric(8,2),
  underway_hours numeric(6,2),
  day_count numeric(5,2) not null default 0,
  night_hours numeric(6,2) not null default 0,
  near_coastal boolean not null default false,
  inland boolean not null default false,
  ocean boolean not null default false,
  great_lakes boolean not null default false,
  captain_name text,
  self_attested boolean not null default true,
  notes text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,
  constraint trips_time_order check (
    started_at is null or ended_at is null or ended_at >= started_at
  ),
  constraint trips_nonnegative_counts check (
    day_count >= 0 and night_hours >= 0 and
    (underway_hours is null or underway_hours >= 0) and
    (distance_nm is null or distance_nm >= 0) and
    (distance_offshore_nm is null or distance_offshore_nm >= 0)
  )
);
```

Initial `service_role` values:

- `master`
- `mate`
- `operator`
- `deckhand`
- `engine`
- `other`

Initial `time_precision` values:

- `exact`
- `approximate`
- `date_only`
- `unknown`

Initial `purpose_type` values:

- `recreational`
- `delivery`
- `charter`
- `training`
- `racing`
- `maintenance`
- `commercial`
- `other`

Use `purpose_notes` for optional free-text detail.

Initial `water_body_type` values:

- `inland`
- `near_coastal`
- `offshore`
- `ocean`
- `great_lakes`
- `shoreward_boundary_line`
- `seaward_boundary_line`
- `unknown`

### `credential_goal_trip_links`

Stores how much a trip contributes to each goal. This gives us explainable calculations and lets one trip count differently for different credentials.

```sql
create table credential_goal_trip_links (
  credential_goal_id uuid not null references credential_goals(id) on delete cascade,
  trip_id uuid not null references trips(id) on delete cascade,
  qualifies boolean not null default true,
  qualifying_day_count numeric(5,2) not null default 0,
  calculation_version text not null default 'manual-v1',
  calculation_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (credential_goal_id, trip_id)
);
```

## Audit And Sync

### `audit_events`

Append-only history for meaningful changes. Start with trips and vessels.

```sql
create table audit_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  changed_fields jsonb not null default '{}'::jsonb,
  client_id uuid,
  ip_address inet,
  user_agent text,
  occurred_at timestamptz not null default now()
);
```

### `client_devices`

```sql
create table client_devices (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id),
  device_name text,
  platform text,
  app_version text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);
```

### `sync_change_log`

Server-side observability for synced client writes. The client will also maintain a local outbox.

```sql
create table sync_change_log (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id),
  device_id uuid references client_devices(id),
  entity_type text not null,
  entity_id uuid not null,
  operation text not null,
  payload jsonb not null,
  base_version integer,
  result_version integer,
  conflict boolean not null default false,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
```

## Exports And Files

### `stored_objects`

Metadata for objects stored in Cloudflare R2.

```sql
create table stored_objects (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id),
  bucket text not null,
  object_key text not null,
  content_type text,
  byte_size bigint,
  sha256 text,
  purpose text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (bucket, object_key)
);
```

### `submission_exports`

Immutable-ish package records for generated summaries and future USCG forms.

```sql
create table submission_exports (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id),
  credential_goal_id uuid references credential_goals(id),
  export_type text not null,
  ruleset_version text not null,
  status text not null default 'pending',
  stored_object_id uuid references stored_objects(id),
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
```

## Future Tables

Do not build these in the MVP unless needed, but keep the schema direction in mind:

- `verification_requests`
- `organizations`
- `organization_memberships`
- `billing_customers`
- `subscriptions`
- `trip_attachments`
- `signature_requests`

## Indexes

```sql
create index idx_vessels_created_by on vessels(created_by_profile_id) where deleted_at is null;
create index idx_vessel_identifiers_vessel on vessel_identifiers(vessel_id) where deleted_at is null;
create index idx_vessel_identifiers_value on vessel_identifiers(identifier_value) where deleted_at is null;
create index idx_goals_profile on credential_goals(profile_id) where deleted_at is null;
create index idx_trips_profile_started on trips(profile_id, started_at desc) where deleted_at is null;
create index idx_trips_profile_date on trips(profile_id, trip_date desc) where deleted_at is null;
create index idx_trips_vessel on trips(vessel_id) where deleted_at is null;
create index idx_audit_entity on audit_events(entity_type, entity_id, occurred_at desc);
create index idx_sync_profile_created on sync_change_log(profile_id, created_at desc);
create index idx_exports_profile_created on submission_exports(profile_id, created_at desc);
```

## Row Level Security Position

For the MVP, the application API should be the primary database writer. Supabase Row Level Security should still be enabled for defense in depth if clients ever read or write directly.

Basic policy shape:

- A user can access rows where `profile_id = auth.uid()`.
- A user can access vessels where `created_by_profile_id = auth.uid()`.
- Audit events are insert-only from trusted API paths.
- Submission exports are read-only to the owning user after creation.
