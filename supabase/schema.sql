-- ============================================================================
-- TA Coin — Requisition System schema
-- Unified request model with a JSONB `details` column for branch-specific fields.
-- Apply with: supabase db push  (or paste into the SQL editor / MCP apply_migration)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type request_type as enum ('general', 'material');

-- category is the second-level selector under each type:
--   general  -> sick_leave | annual_leave | meeting_room | it_support | other
--   material -> buy | use_stock | grab_ride
create type request_category as enum (
  'sick_leave', 'annual_leave', 'meeting_room', 'it_support', 'general_other',
  'buy', 'use_stock', 'grab_ride'
);

create type request_status as enum (
  'draft',
  'submitted',
  'pending_line_manager',
  'pending_admin',
  'pending_management',
  'approved',
  'rejected',
  'returned_for_correction',
  'completed',
  'returned'                 -- for use_stock items that must be given back
);

create type user_role as enum ('officer', 'line_manager', 'admin', 'management');

create type approval_stage as enum ('line_manager', 'admin', 'management');
create type approval_decision as enum ('pending', 'approved', 'rejected', 'forwarded', 'returned');

-- Return tracking for "Use Existing Material" requests (doc §5.3 "Return Status").
-- 'not_applicable' for non-returnable items / non-use_stock requests.
create type return_status as enum ('not_applicable', 'pending_return', 'returned', 'overdue');

-- ---------------------------------------------------------------------------
-- profiles  (mirrors auth.users; pre-fills the "Requestor" section)
-- ---------------------------------------------------------------------------
create table profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  full_name       text not null,
  email           text not null,
  department      text,
  role            user_role not null default 'officer',
  line_manager_id uuid references profiles (id),
  created_at      timestamptz not null default now()
);

-- Keep profiles in sync when a new auth user is created.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- Lookups
-- ---------------------------------------------------------------------------
create table cost_centers (
  id       uuid primary key default gen_random_uuid(),
  code     text not null unique,
  name     text not null,
  active   boolean not null default true
);

create table stock_items (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  unit          text not null default 'unit',      -- e.g. "unit", "box", "ream"
  quantity      integer not null default 0,        -- current on-hand stock
  returnable    boolean not null default false,    -- if true, use_stock tracks a return
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- requests  (the unified table)
-- ---------------------------------------------------------------------------
create table requests (
  id             uuid primary key default gen_random_uuid(),
  reference      text unique,                       -- human-friendly, e.g. REQ-2026-000123
  requestor_id   uuid not null references profiles (id),
  department     text,                              -- snapshot at submit time
  request_type   request_type not null,
  category       request_category not null,
  title          text,                              -- short summary for lists
  status         request_status not null default 'draft',

  -- Branch-specific fields live here so the dynamic form maps 1:1.
  -- Examples:
  --   sick_leave: { start_date, end_date, reason, medical_cert: {path,name} }
  --   meeting_room: { room, date, start_time, end_time, attendees }
  --   buy:        { item_name, quantity, unit, purpose, expected_date, remark, est_cost }
  --   use_stock:  { stock_item_id, item_name, quantity, purpose, expected_return_date, remark }
  --   grab_ride:  { pickup, dropoff, cost_center_id, purpose, trip_date }
  details        jsonb not null default '{}'::jsonb,

  current_stage  approval_stage,                    -- who the ball is with, null once terminal
  return_status  return_status not null default 'not_applicable', -- doc §5.3, use_stock only
  submitted_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index requests_requestor_idx on requests (requestor_id);
create index requests_status_idx    on requests (status);
create index requests_details_gin   on requests using gin (details);

-- auto-touch updated_at
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger requests_touch_updated_at
  before update on requests
  for each row execute function touch_updated_at();

-- Auto reference number on submit (REQ-<year>-<zero-padded serial>)
create sequence if not exists request_ref_seq;

create or replace function set_request_reference()
returns trigger language plpgsql as $$
begin
  if new.reference is null and new.status <> 'draft' then
    new.reference := 'REQ-' || to_char(now(), 'YYYY') || '-' ||
                     lpad(nextval('request_ref_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

create trigger requests_set_reference
  before insert or update on requests
  for each row execute function set_request_reference();

-- ---------------------------------------------------------------------------
-- request_approvals  (one row per stage in the workflow)
-- ---------------------------------------------------------------------------
create table request_approvals (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references requests (id) on delete cascade,
  stage       approval_stage not null,
  approver_id uuid references profiles (id),
  decision    approval_decision not null default 'pending',
  comment     text,
  decided_at  timestamptz,
  created_at  timestamptz not null default now(),
  unique (request_id, stage)
);

create index request_approvals_request_idx on request_approvals (request_id);

-- ---------------------------------------------------------------------------
-- request_status_history  (audit trail)
-- ---------------------------------------------------------------------------
create table request_status_history (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references requests (id) on delete cascade,
  from_status request_status,
  to_status   request_status not null,
  changed_by  uuid references profiles (id),
  note        text,
  created_at  timestamptz not null default now()
);

create or replace function log_status_change()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into request_status_history (request_id, from_status, to_status, changed_by)
    values (new.id, case when tg_op = 'UPDATE' then old.status end, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger requests_log_status
  after insert or update on requests
  for each row execute function log_status_change();

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table profiles                enable row level security;
alter table requests                enable row level security;
alter table request_approvals       enable row level security;
alter table request_status_history  enable row level security;
alter table stock_items             enable row level security;
alter table cost_centers            enable row level security;

-- helper: current user's role
create or replace function current_role_is(target user_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = target);
$$;

-- profiles: read own + anyone you manage; everyone can read basic directory
create policy "profiles readable by authenticated"
  on profiles for select to authenticated using (true);
create policy "update own profile"
  on profiles for update to authenticated using (id = auth.uid());

-- requests: officer sees own; approvers see requests routed to their stage/role
create policy "requestor reads own requests"
  on requests for select to authenticated
  using (requestor_id = auth.uid());

create policy "approvers read routed requests"
  on requests for select to authenticated
  using (
    current_role_is('management')
    or (current_role_is('admin') and current_stage = 'admin')
    or (current_role_is('line_manager') and current_stage = 'line_manager'
        and requestor_id in (select id from profiles where line_manager_id = auth.uid()))
  );

create policy "requestor inserts own requests"
  on requests for insert to authenticated
  with check (requestor_id = auth.uid());

-- Requestor may edit only while draft/returned; approvers may move it along.
create policy "requestor edits editable requests"
  on requests for update to authenticated
  using (requestor_id = auth.uid() and status in ('draft', 'returned_for_correction'))
  with check (requestor_id = auth.uid());

create policy "approvers update routed requests"
  on requests for update to authenticated
  using (
    current_role_is('management')
    or (current_role_is('admin') and current_stage = 'admin')
    or (current_role_is('line_manager') and current_stage = 'line_manager')
  );

-- approvals + history: visible to anyone who can see the parent request
create policy "read approvals for visible requests"
  on request_approvals for select to authenticated
  using (exists (select 1 from requests r where r.id = request_id));
create policy "approvers write approvals"
  on request_approvals for all to authenticated
  using (current_role_is('line_manager') or current_role_is('admin') or current_role_is('management'))
  with check (current_role_is('line_manager') or current_role_is('admin') or current_role_is('management'));

create policy "read history for visible requests"
  on request_status_history for select to authenticated
  using (exists (select 1 from requests r where r.id = request_id));

-- lookups: readable by all authenticated, writable by admin/management
create policy "read stock items" on stock_items for select to authenticated using (true);
create policy "read cost centers" on cost_centers for select to authenticated using (true);
create policy "admin manages stock"
  on stock_items for all to authenticated
  using (current_role_is('admin') or current_role_is('management'))
  with check (current_role_is('admin') or current_role_is('management'));
create policy "admin manages cost centers"
  on cost_centers for all to authenticated
  using (current_role_is('admin') or current_role_is('management'))
  with check (current_role_is('admin') or current_role_is('management'));

-- ============================================================================
-- Storage bucket for attachments (medical certs, quotes, etc.)
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('request-attachments', 'request-attachments', false)
on conflict (id) do nothing;

-- Users manage files under a folder they own; naming convention: <auth.uid()>/...
-- The frontend FileDropzone uploads to `<folder>/<uuid>.<ext>` where folder
-- starts with the user id — adjust the folder prop to `${user.id}/sick-cert`.
create policy "users upload own attachments"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'request-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users read own attachments"
  on storage.objects for select to authenticated
  using (bucket_id = 'request-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "approvers read all attachments"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'request-attachments'
    and (current_role_is('line_manager') or current_role_is('admin') or current_role_is('management'))
  );

create policy "users delete own attachments"
  on storage.objects for delete to authenticated
  using (bucket_id = 'request-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
