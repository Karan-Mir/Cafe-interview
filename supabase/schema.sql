-- قهوه‌سنج — data store
-- Paste into Supabase → SQL Editor → Run. Safe to re-run.

-- ─────────────────────────────────────────────────────────── sessions
-- The whole session document lives in `doc`. A few fields are lifted into
-- columns so the admin table can sort and filter without parsing JSON.
--
-- Why jsonb and not thirty columns: this schema has already changed twice
-- (price denominator, the `who` attribute, two traps instead of one). A rigid
-- table would have needed a migration each time and would have silently
-- dropped anything the app started sending that the table did not know about.
create table if not exists public.sessions (
  session_id      uuid primary key,
  device          text not null,
  interviewer     text,
  started_at      timestamptz,
  finished_at     timestamptz,
  design_version  text not null,
  price_mult      jsonb not null,
  doc             jsonb not null,
  uploaded_at     timestamptz not null default now()
);

create index if not exists sessions_uploaded_idx on public.sessions (uploaded_at desc);
create index if not exists sessions_device_idx   on public.sessions (device);

-- ─────────────────────────────────────────────────────────── security
alter table public.sessions enable row level security;

-- Both collectors sign in. The anon key ships inside the app and a café owner
-- holds the phone for nine minutes, so anon is given NOTHING: no read, no write.
-- Everything below requires an authenticated session.
drop policy if exists "collectors insert" on public.sessions;
create policy "collectors insert"
  on public.sessions for insert to authenticated
  with check (true);

drop policy if exists "collectors read all" on public.sessions;
create policy "collectors read all"
  on public.sessions for select to authenticated
  using (true);

-- Deliberately NO update and NO delete policy.
-- The table is append-only through the API: nobody can quietly alter or drop a
-- café's answers, including us. SPEC 0.5 in database form.

-- ─────────────────────────────────────────────────────────── voice notes
insert into storage.buckets (id, name, public)
values ('voice', 'voice', false)
on conflict (id) do nothing;

drop policy if exists "collectors upload voice" on storage.objects;
create policy "collectors upload voice"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'voice');

drop policy if exists "collectors read voice" on storage.objects;
create policy "collectors read voice"
  on storage.objects for select to authenticated
  using (bucket_id = 'voice');

-- ─────────────────────────────────────────────────────────── admin view
-- What the session list needs, without shipping every document to the table.
-- security_invoker: the view runs as the CALLER, so it inherits the table's RLS
-- instead of the view owner's rights. Without it a view can quietly become a
-- hole straight through row-level security.
create or replace view public.session_summary
with (security_invoker = true) as
select
  session_id,
  device,
  interviewer,
  started_at,
  finished_at,
  design_version,
  uploaded_at,
  doc->'profile'->>'type'                              as cafe_type,
  (doc->'profile'->>'seats')::int                      as seats,
  (doc->'profile'->>'price_ref_toman')::int            as price_ref_toman,
  doc->'profile'->>'price_ref_item'                    as price_ref_item,
  (doc->'quality'->>'completed')::boolean              as completed,
  (doc->'quality'->>'trap_failed')::boolean            as trap_failed,
  (doc->'quality'->>'straightlined')::boolean          as straightlined,
  (doc->'quality'->>'fast_tasks')::int                 as fast_tasks,
  (doc->'quality'->>'median_latency_ms')::int          as median_latency_ms,
  jsonb_array_length(coalesce(doc->'cbc'->'responses', '[]'::jsonb))     as cbc_tasks,
  jsonb_array_length(coalesce(doc->'maxdiff'->'responses', '[]'::jsonb)) as maxdiff_sets,
  doc->'open'->>'text'                                 as open_text,
  doc->'open'->>'audio_ref'                            as audio_ref,
  extract(epoch from (finished_at - started_at))::int  as duration_s
from public.sessions;

-- Applied to project dzkqzrmnnucpqfeydghl on 2026-09-12 as three migrations:
-- create_sessions_table_and_rls, create_session_summary_view,
-- create_voice_bucket_and_policies. Verified: RLS on, 0 update/delete policies,
-- voice bucket private, security advisors clean.
