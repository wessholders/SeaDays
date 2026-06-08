create extension if not exists pgcrypto;
create extension if not exists citext;

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

create table client_devices (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id),
  device_name text,
  platform text,
  app_version text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

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
