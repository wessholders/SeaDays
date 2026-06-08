create extension if not exists "pgcrypto";

create type public.waters_category as enum (
  'inland',
  'near_coastal',
  'offshore',
  'unknown'
);

create type public.verification_status as enum (
  'draft',
  'self_reported',
  'owner_requested',
  'owner_verified',
  'rejected',
  'exported'
);

create type public.signature_provider as enum (
  'docusign',
  'dropbox_sign',
  'manual'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.license_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table public.license_requirements (
  id uuid primary key default gen_random_uuid(),
  license_type_id uuid not null references public.license_types(id) on delete cascade,
  requirement_key text not null,
  requirement_label text not null,
  required_days integer not null check (required_days >= 0),
  waters public.waters_category,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (license_type_id, requirement_key)
);

create table public.vessels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  official_number text,
  registration_number text,
  vessel_type text,
  gross_tons numeric(8, 2),
  length_feet numeric(8, 2),
  owner_name text,
  owner_email text,
  owner_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sea_service_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  vessel_id uuid not null references public.vessels(id) on delete restrict,
  service_date date not null,
  start_time time,
  end_time time,
  duration_hours numeric(5, 2) not null check (duration_hours > 0 and duration_hours <= 24),
  claimed_days numeric(4, 2) not null default 1 check (claimed_days >= 0 and claimed_days <= 1.5),
  credit_rule text not null default 'manual_small_vessel',
  waters public.waters_category not null default 'unknown',
  role text,
  route_description text,
  notes text,
  verification_status public.verification_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.entry_location_evidence (
  id uuid primary key default gen_random_uuid(),
  sea_service_entry_id uuid not null references public.sea_service_entries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  start_lat double precision,
  start_lng double precision,
  end_lat double precision,
  end_lng double precision,
  inferred_waters public.waters_category,
  confidence numeric(4, 3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.signature_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  vessel_id uuid not null references public.vessels(id) on delete restrict,
  provider public.signature_provider not null,
  provider_envelope_id text,
  owner_name text not null,
  owner_email text not null,
  status text not null default 'draft',
  requested_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.signature_request_entries (
  signature_request_id uuid not null references public.signature_requests(id) on delete cascade,
  sea_service_entry_id uuid not null references public.sea_service_entries(id) on delete cascade,
  primary key (signature_request_id, sea_service_entry_id)
);

create table public.form_exports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  license_type_id uuid references public.license_types(id) on delete set null,
  form_code text not null,
  storage_path text,
  status text not null default 'created',
  created_at timestamptz not null default now()
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger vessels_set_updated_at
before update on public.vessels
for each row execute function public.set_updated_at();

create trigger sea_service_entries_set_updated_at
before update on public.sea_service_entries
for each row execute function public.set_updated_at();

create trigger signature_requests_set_updated_at
before update on public.signature_requests
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.vessels enable row level security;
alter table public.sea_service_entries enable row level security;
alter table public.entry_location_evidence enable row level security;
alter table public.signature_requests enable row level security;
alter table public.signature_request_entries enable row level security;
alter table public.form_exports enable row level security;
alter table public.audit_events enable row level security;

create policy "profiles are owned by user"
on public.profiles for all
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "vessels are owned by user"
on public.vessels for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "sea service entries are owned by user"
on public.sea_service_entries for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "location evidence is owned by user"
on public.entry_location_evidence for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "signature requests are owned by user"
on public.signature_requests for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "signature request entries follow request ownership"
on public.signature_request_entries for all
using (
  exists (
    select 1
    from public.signature_requests sr
    where sr.id = signature_request_id
      and sr.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.signature_requests sr
    where sr.id = signature_request_id
      and sr.user_id = auth.uid()
  )
);

create policy "form exports are owned by user"
on public.form_exports for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "audit events are readable by owner"
on public.audit_events for select
using (auth.uid() = user_id);

insert into public.license_types (code, name, description)
values (
  'oupv_6_pack',
  'OUPV / 6-pack',
  'Operator of Uninspected Passenger Vessels credential.'
)
on conflict (code) do nothing;

insert into public.license_requirements (
  license_type_id,
  requirement_key,
  requirement_label,
  required_days,
  waters,
  metadata
)
select
  lt.id,
  'total_sea_days',
  'Total documented sea-service days',
  360,
  null,
  '{"note":"Confirm current USCG requirements before production release."}'::jsonb
from public.license_types lt
where lt.code = 'oupv_6_pack'
on conflict (license_type_id, requirement_key) do nothing;

insert into public.license_requirements (
  license_type_id,
  requirement_key,
  requirement_label,
  required_days,
  waters,
  metadata
)
select
  lt.id,
  'near_coastal_or_greater_days',
  'Near Coastal, Ocean, or Great Lakes service days',
  90,
  'near_coastal',
  '{"applies_to":"oupv_near_coastal"}'::jsonb
from public.license_types lt
where lt.code = 'oupv_6_pack'
on conflict (license_type_id, requirement_key) do nothing;

insert into public.license_requirements (
  license_type_id,
  requirement_key,
  requirement_label,
  required_days,
  waters,
  metadata
)
select
  lt.id,
  'recency_days',
  'Recent service days',
  90,
  null,
  '{"lookback_years":7}'::jsonb
from public.license_types lt
where lt.code = 'oupv_6_pack'
on conflict (license_type_id, requirement_key) do nothing;
