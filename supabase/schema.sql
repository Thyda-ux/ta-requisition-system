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

-- helpers ------------------------------------------------------------------
-- current user's role (security definer so RLS on profiles doesn't recurse)
create or replace function my_role()
returns user_role language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function current_role_is(target user_role)
returns boolean language sql stable security definer set search_path = public as $$
  select my_role() = target;
$$;

-- is the given request submitted by one of MY direct reports? (doc §2.2)
create or replace function is_my_report(p_requestor uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles where id = p_requestor and line_manager_id = auth.uid()
  );
$$;

-- ---- profiles --------------------------------------------------------------
-- Everyone can read the directory; you may edit your own profile, but you may
-- NOT change your own role (role is assigned by admin/management only, doc §2).
create policy "profiles readable by authenticated"
  on profiles for select to authenticated using (true);

create policy "update own profile"
  on profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "admin manages profiles"
  on profiles for all to authenticated
  using (current_role_is('management') or current_role_is('admin'))
  with check (current_role_is('management') or current_role_is('admin'));

-- Guard: block self role-escalation even through the "update own profile" path.
create or replace function guard_role_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role
     and not (current_role_is('management') or current_role_is('admin')) then
    raise exception 'Only admin or management may change a user role';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_role
  before update on profiles
  for each row execute function guard_role_change();

-- ---- requests: read model (mirrors the doc's routing) ----------------------
-- Officer: only their own requests (doc §2.1)
create policy "requestor reads own requests"
  on requests for select to authenticated
  using (requestor_id = auth.uid());

-- Line Manager: requests from their direct reports (doc §2.2)
create policy "line manager reads reports' requests"
  on requests for select to authenticated
  using (current_role_is('line_manager') and is_my_report(requestor_id));

-- Admin Team: MATERIAL requests only, once past the line manager (doc §2.3)
create policy "admin reads material requests"
  on requests for select to authenticated
  using (
    current_role_is('admin')
    and request_type = 'material'
    and current_stage in ('admin', 'management')
  );

-- Management: everything (doc §2.4, final authority)
create policy "management reads all requests"
  on requests for select to authenticated
  using (current_role_is('management'));

-- ---- requests: write model -------------------------------------------------
-- Officers create their own requests.
create policy "requestor inserts own requests"
  on requests for insert to authenticated
  with check (requestor_id = auth.uid());

-- Officers may edit ONLY while the request is theirs to fix (draft / returned).
create policy "requestor edits editable requests"
  on requests for update to authenticated
  using (requestor_id = auth.uid() and status in ('draft', 'returned_for_correction'))
  with check (requestor_id = auth.uid());

-- NOTE: approvers do NOT get a blanket UPDATE policy. All approval transitions
-- (approve / reject / send back / forward) go through decide_request() below,
-- which enforces role + stage rules. This prevents a client from setting an
-- arbitrary status or skipping a stage.

-- ---- approvals + history (read-only to clients; written by the RPC) --------
create policy "read approvals for visible requests"
  on request_approvals for select to authenticated
  using (exists (select 1 from requests r where r.id = request_id));

create policy "read history for visible requests"
  on request_status_history for select to authenticated
  using (exists (select 1 from requests r where r.id = request_id));

-- ============================================================================
-- Workflow enforcement  (doc §2 roles + §3/§4/§5 flows + §7 approval rules)
--
-- decide_request() is the ONLY way an approval decision is applied. It checks
-- that the caller's role matches the stage the request is currently sitting at,
-- records the decision on request_approvals, and advances the request exactly
-- as the doc prescribes:
--
--   line_manager  approve  -> general: APPROVED (done)     [doc §3.1]
--                            material: -> Admin (pending_admin) [doc §4.2/§5.2]
--                 forward  -> Management (pending_management)   [doc §2.2/§7.1]
--   admin         approve  -> APPROVED (approved requisition)   [doc §4.2/§7.2]
--                 forward  -> Management (pending_management)   [doc §2.3/§7.2]
--   management    approve  -> APPROVED (final)                  [doc §2.4/§7.3]
--   any stage     reject   -> REJECTED
--                 return   -> RETURNED_FOR_CORRECTION (back to officer) [doc §2.2]
-- ============================================================================
create or replace function decide_request(
  p_request uuid,
  p_action  text,               -- 'approve' | 'reject' | 'return' | 'forward'
  p_comment text default null
)
returns requests
language plpgsql
security definer
set search_path = public
as $$
declare
  r        requests;
  v_role   user_role := my_role();
  v_stage  approval_stage;
  v_next_status  request_status;
  v_next_stage   approval_stage;
  v_decision     approval_decision;
begin
  select * into r from requests where id = p_request for update;
  if not found then
    raise exception 'Request not found';
  end if;

  v_stage := r.current_stage;
  if v_stage is null then
    raise exception 'Request % is already finalized (status %)', r.reference, r.status;
  end if;

  -- --- authorization: caller must own the current stage (management may act
  --     on any stage as the final authority, doc §2.4) ------------------------
  if v_role <> 'management' then
    if v_stage = 'line_manager' then
      if not (v_role = 'line_manager' and is_my_report(r.requestor_id)) then
        raise exception 'Only the requestor''s line manager may act at this stage';
      end if;
    elsif v_stage = 'admin' then
      if not (v_role = 'admin' and r.request_type = 'material') then
        raise exception 'Only the Admin Team may act on material requests at this stage';
      end if;
    elsif v_stage = 'management' then
      raise exception 'Only Management may act at the management stage';
    end if;
  end if;

  -- --- resolve the transition -------------------------------------------------
  if p_action = 'reject' then
    v_decision := 'rejected'; v_next_status := 'rejected'; v_next_stage := null;

  elsif p_action = 'return' then
    v_decision := 'returned'; v_next_status := 'returned_for_correction'; v_next_stage := null;

  elsif p_action = 'forward' then
    if v_stage = 'management' then
      raise exception 'Cannot forward beyond Management';
    end if;
    v_decision := 'forwarded'; v_next_status := 'pending_management'; v_next_stage := 'management';

  elsif p_action = 'approve' then
    v_decision := 'approved';
    if v_stage = 'line_manager' then
      if r.request_type = 'material' then
        v_next_status := 'pending_admin';  v_next_stage := 'admin';       -- doc §4.2/§5.2
      else
        v_next_status := 'approved';       v_next_stage := null;          -- doc §3.1 (no admin)
      end if;
    else            -- admin or management approving
      v_next_status := 'approved';         v_next_stage := null;          -- approved requisition
    end if;

  else
    raise exception 'Unknown action: %', p_action;
  end if;

  -- --- record the decision on the current stage -------------------------------
  insert into request_approvals (request_id, stage, approver_id, decision, comment, decided_at)
  values (r.id, v_stage, auth.uid(), v_decision, p_comment, now())
  on conflict (request_id, stage) do update
    set approver_id = excluded.approver_id,
        decision    = excluded.decision,
        comment     = excluded.comment,
        decided_at  = excluded.decided_at;

  -- Make sure a pending management row exists when forwarding.
  if v_next_stage = 'management' then
    insert into request_approvals (request_id, stage)
    values (r.id, 'management')
    on conflict (request_id, stage) do nothing;
  end if;

  -- --- advance the request (status-history trigger logs the change) -----------
  update requests
     set status = v_next_status,
         current_stage = v_next_stage
   where id = r.id
  returning * into r;

  return r;
end;
$$;

grant execute on function decide_request(uuid, text, text) to authenticated;

-- Admin/Management mark a returnable "Use Material" item as returned (doc §5.2/§6).
create or replace function mark_item_returned(p_request uuid)
returns requests
language plpgsql
security definer
set search_path = public
as $$
declare r requests;
begin
  if not (current_role_is('admin') or current_role_is('management')) then
    raise exception 'Only Admin or Management may record a return';
  end if;
  update requests
     set return_status = 'returned',
         status = 'completed'
   where id = p_request and return_status = 'pending_return'
  returning * into r;
  if not found then
    raise exception 'Request is not awaiting a return';
  end if;
  return r;
end;
$$;

grant execute on function mark_item_returned(uuid) to authenticated;

-- When a request is submitted (leaves 'draft'), seed its pending approval rows
-- server-side so clients never need write access to request_approvals.
-- Line Manager for every request; Admin too for material requests (doc §4/§5).
create or replace function seed_request_approvals()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status <> 'draft' and (tg_op = 'INSERT' or old.status = 'draft') then
    insert into request_approvals (request_id, stage)
    values (new.id, 'line_manager')
    on conflict (request_id, stage) do nothing;

    if new.request_type = 'material' then
      insert into request_approvals (request_id, stage)
      values (new.id, 'admin')
      on conflict (request_id, stage) do nothing;
    end if;
  end if;
  return new;
end;
$$;

create trigger requests_seed_approvals
  after insert or update on requests
  for each row execute function seed_request_approvals();

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
