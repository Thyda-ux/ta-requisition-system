# TA Coin — Requisition System

Internal operations tool for submitting and approving company requests. Standalone
app, completely separate from the marketing landing page.

**Stack:** React 19 + Vite + Tailwind CSS · Supabase (Auth, Postgres, Storage).

The centrepiece is a **Unified Request Form** with progressive disclosure — fields
appear as the user drills down through their choices, Stripe/Linear-style.

---

## What it does

```
Requestor (pre-filled from Auth)
        │
        ▼
Request Type   ──►  General Request  ──►  sub-category dropdown ──► dynamic fields
   (grid cards)                            (Sick Leave, Meeting Room, IT…)
        │                                   └─ Sick Leave shows date range + medical
        │                                      certificate upload → Supabase Storage
        │
        └────────►  Material Request ──►  [ Use Stock ] | [ Request Buy ]  (tabs)
                                          └─ "Grab Ride" toggle morphs the form to
                                             Pickup / Drop-off / Cost Center / Purpose
```

---

## Getting started

```bash
npm install
cp .env.example .env.local     # fill in your Supabase URL + anon key
npm run dev
```

### Environment

| Variable                 | Purpose                                             |
| ------------------------ | --------------------------------------------------- |
| `VITE_SUPABASE_URL`      | Project URL from Supabase → Settings → API          |
| `VITE_SUPABASE_ANON_KEY` | Public anon key                                     |
| `VITE_DEV_PREVIEW`       | `true` to preview the UI with a mock signed-in user |

> With `VITE_DEV_PREVIEW=true` the form renders using a fake profile so you can click
> through the whole flow without configuring Auth. Submitting still calls Supabase, so
> turn it off (or keep the placeholder project) once real auth is wired up.

### Database

Apply the schema to your Supabase project:

```bash
# via Supabase CLI
supabase db push
# or paste supabase/schema.sql into the SQL editor, then supabase/seed.sql for demo data
```

---

## Architecture

### Live state management (progressive disclosure)

All disclosure logic lives in a single reducer-style hook,
[`useRequestForm.js`](src/components/RequestForm/useRequestForm.js). It holds four
pieces of state, and components simply render nothing until the value above them exists:

| State         | Set by                    | Drives                                        |
| ------------- | ------------------------- | --------------------------------------------- |
| `requestType` | Type grid cards (step 2)  | Which branch renders (General vs Material)    |
| `action`      | Material tabs             | `use_stock` vs `buy`                          |
| `category`    | Dropdown / tabs / Grab    | **Which field set shows** — the key to it all |
| `details`     | Every field's `onChange`  | The JSONB payload sent to Postgres            |

Switching a type/category **resets `details`** so stale fields never leak between
branches. Field definitions are declarative in
[`formConfig.js`](src/components/RequestForm/formConfig.js) — adding a new sub-category
(or a field) is a data edit there, no new components. The
[`DynamicField`](src/components/RequestForm/DynamicField.jsx) renderer walks that config,
so every branch gets identical styling, validation, and the file-upload widget for free.

The **Grab Ride exception** is modelled as its own `category` (`grab_ride`). Selecting
the toggle in the Material branch swaps `category` from the active tab to `grab_ride`,
and the same renderer paints the ride-logistics fields instead of material fields — one
mechanism, no special-case component.

### Database schema

A **unified `requests` table** with a JSONB `details` column (see
[`supabase/schema.sql`](supabase/schema.sql)). Shared/queryable columns
(`requestor_id`, `request_type`, `category`, `status`, `current_stage`) are typed;
branch-specific fields live in `details`, matching the form 1:1.

| Table                     | Role                                                          |
| ------------------------- | ------------------------------------------------------------ |
| `profiles`                | Mirrors `auth.users`; pre-fills the Requestor section        |
| `requests`                | The unified request (typed columns + `details` JSONB)        |
| `request_approvals`       | One row per workflow stage (line manager → admin → mgmt)     |
| `request_status_history`  | Audit trail of every status change (trigger-populated)       |
| `stock_items`             | Lookup for the **Use Stock** dropdown                        |
| `cost_centers`            | Lookup for the **Grab Ride** cost-center field               |
| storage `request-attachments` | Private bucket for medical certs / quotes                |

**Workflow & statuses** mirror the requirements doc: `draft → submitted →
pending_line_manager → pending_admin → pending_management → approved / rejected /
returned_for_correction / completed / returned`. Reference numbers (`REQ-2026-000123`)
and status-history rows are generated by Postgres triggers.

### Roles, RLS & workflow enforcement

Roles come straight from the doc (§2): `officer`, `line_manager`, `admin`,
`management`, stored on `profiles.role`. **RLS is enabled on every table** and mirrors
the doc's routing:

| Role         | Can read                                             | Doc |
| ------------ | ---------------------------------------------------- | --- |
| Officer      | Only their own requests                              | §2.1 |
| Line Manager | Requests submitted by their **direct reports**       | §2.2 |
| Admin Team   | **Material** requests only, once past the LM         | §2.3 |
| Management   | Everything (final authority)                         | §2.4 |

- **No blanket approver write access.** Officers can only edit their own request
  while it's `draft` / `returned_for_correction`. Every approval decision goes through
  a single `SECURITY DEFINER` function, **`decide_request(request_id, action, comment)`**
  (`action` = `approve | reject | return | forward`). It verifies the caller's role
  matches the stage the request sits at and advances it exactly as §3/§4/§5/§7 prescribe
  — e.g. LM-approve on a *general* request finalizes it, but on a *material* request it
  routes to Admin; Admin/Management approve produces the "approved requisition". Clients
  therefore cannot set an arbitrary status or skip a stage.
- **`mark_item_returned(request_id)`** (admin/management) closes out a returnable
  Use-Material request → `return_status = returned`, `status = completed` (§5.2/§6).
- **Role escalation is blocked**: a `before update` trigger on `profiles` rejects any
  self-service `role` change; only admin/management may reassign roles.
- Pending approval rows are seeded server-side by a trigger on submit, so clients never
  need write access to `request_approvals`.
- **Storage** policies key off a `<user-id>/…` path prefix so people can only read their
  own attachments (approvers can read all).

Client usage of the workflow RPC:

```js
// e.g. a line manager approving from an approvals inbox
const { data, error } = await supabase.rpc('decide_request', {
  p_request: requestId,
  p_action: 'approve',        // 'approve' | 'reject' | 'return' | 'forward'
  p_comment: 'Looks good',
})
```

---

## Project layout

```
src/
  lib/supabaseClient.js            Supabase singleton
  hooks/
    useProfile.js                  signed-in user + profile row
    useLookups.js                  stock items + cost centers
  components/
    ui/                            Card, SegmentedControl, FormField, FileDropzone, Button
    RequestForm/
      formConfig.js                declarative field definitions (single source of truth)
      DynamicField.jsx             config-driven field renderer
      useRequestForm.js            the state machine
      GeneralBranch.jsx            Branch A
      MaterialBranch.jsx           Branch B + Grab morph
      UnifiedRequestForm.jsx       assembles the steps
supabase/
  schema.sql                       tables, triggers, RLS, storage bucket
  seed.sql                         demo stock items + cost centers
```
