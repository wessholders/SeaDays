create or replace function public.creditable_days_for_entry(
  duration_hours numeric,
  claimed_days numeric,
  credit_rule text
)
returns numeric
language sql
immutable
as $$
  select case
    when credit_rule = 'manual_small_vessel' and duration_hours >= 4 then least(coalesce(claimed_days, 1), 1)
    when credit_rule = 'manual_small_vessel' then 0
    else least(coalesce(claimed_days, 0), 1.5)
  end;
$$;

create index if not exists sea_service_entries_user_date_idx
on public.sea_service_entries (user_id, service_date desc);

create index if not exists sea_service_entries_user_status_idx
on public.sea_service_entries (user_id, verification_status);

create index if not exists sea_service_entries_vessel_idx
on public.sea_service_entries (vessel_id);

create index if not exists vessels_user_idx
on public.vessels (user_id);

create or replace view public.sea_service_entry_credits as
select
  sse.id,
  sse.user_id,
  sse.vessel_id,
  v.name as vessel_name,
  sse.service_date,
  sse.duration_hours,
  sse.claimed_days,
  public.creditable_days_for_entry(
    sse.duration_hours,
    sse.claimed_days,
    sse.credit_rule
  ) as credited_days,
  sse.waters,
  sse.role,
  sse.route_description,
  sse.verification_status,
  case
    when v.owner_name is not null
      and v.owner_email is not null
      and sse.verification_status in ('self_reported', 'rejected')
      then true
    else false
  end as ready_for_owner_signature,
  array_remove(array[
    case when v.owner_name is null then 'missing_owner_name' end,
    case when v.owner_email is null then 'missing_owner_email' end,
    case when sse.role is null or length(trim(sse.role)) = 0 then 'missing_role' end,
    case when sse.waters = 'unknown' then 'unknown_waters' end,
    case when sse.route_description is null or length(trim(sse.route_description)) = 0 then 'missing_route' end
  ], null) as completion_warnings
from public.sea_service_entries sse
join public.vessels v on v.id = sse.vessel_id;

create or replace view public.oupv_progress as
select
  user_id,
  coalesce(sum(credited_days), 0) as total_days,
  coalesce(sum(credited_days) filter (
    where service_date >= current_date - interval '7 years'
  ), 0) as recent_days,
  coalesce(sum(credited_days) filter (
    where waters in ('near_coastal', 'offshore')
  ), 0) as near_coastal_or_greater_days,
  greatest(360 - coalesce(sum(credited_days), 0), 0) as total_days_remaining,
  greatest(90 - coalesce(sum(credited_days) filter (
    where service_date >= current_date - interval '7 years'
  ), 0), 0) as recent_days_remaining,
  greatest(90 - coalesce(sum(credited_days) filter (
    where waters in ('near_coastal', 'offshore')
  ), 0), 0) as near_coastal_or_greater_days_remaining,
  count(*) filter (where cardinality(completion_warnings) > 0) as incomplete_entry_count,
  count(*) filter (where ready_for_owner_signature) as ready_for_signature_count
from public.sea_service_entry_credits
where verification_status in (
  'self_reported',
  'owner_requested',
  'owner_verified',
  'exported'
)
group by user_id;

create or replace view public.owner_signature_batches as
select
  user_id,
  vessel_id,
  vessel_name,
  count(*) as entry_count,
  sum(credited_days) as credited_days,
  min(service_date) as first_service_date,
  max(service_date) as last_service_date
from public.sea_service_entry_credits
where ready_for_owner_signature
group by user_id, vessel_id, vessel_name;

alter view public.sea_service_entry_credits set (security_invoker = true);
alter view public.oupv_progress set (security_invoker = true);
alter view public.owner_signature_batches set (security_invoker = true);

grant execute on function public.creditable_days_for_entry(numeric, numeric, text) to authenticated;
grant select on public.sea_service_entry_credits to authenticated;
grant select on public.oupv_progress to authenticated;
grant select on public.owner_signature_batches to authenticated;
