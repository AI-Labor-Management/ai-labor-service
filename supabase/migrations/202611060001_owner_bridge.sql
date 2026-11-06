-- Review foundation, NOT applied by this task. Apply to a fresh Supabase development project first.
-- Owner snapshot bridge preserves AppState v1. Employee/firm/admin reads use server projections.
-- All writes go through a verified server; service_role must NEVER be exposed to the browser.
begin;
create table public.saram_workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  display_name text not null default '',
  created_at timestamptz not null default now()
);
create table public.saram_memberships (
  workspace_id uuid not null references public.saram_workspaces(id),
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('employee','firm','admin')),
  employee_id text,
  created_at timestamptz not null default now(),
  primary key (workspace_id,user_id),
  check ((role = 'employee' and employee_id is not null) or (role <> 'employee' and employee_id is null))
);
create table public.saram_states (
  workspace_id uuid primary key references public.saram_workspaces(id),
  revision bigint not null check (revision > 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and payload->>'schemaVersion' = '1'),
  updated_at timestamptz not null default now()
);
create table public.saram_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.saram_workspaces(id),
  employee_id text not null,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);
create table public.saram_consult_shares (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.saram_workspaces(id),
  firm_user_id uuid not null references auth.users(id),
  share_items text[] not null,
  snapshot jsonb,
  consent_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (share_items <@ array['memo','workplace','conditions','attendance']::text[]),
  check (revoked_at is null or snapshot is null)
);
create index saram_workspace_owner on public.saram_workspaces(owner_id);
create index saram_member_user on public.saram_memberships(user_id);
create index saram_share_firm on public.saram_consult_shares(firm_user_id) where revoked_at is null;

alter table public.saram_workspaces enable row level security;
alter table public.saram_memberships enable row level security;
alter table public.saram_states enable row level security;
alter table public.saram_invites enable row level security;
alter table public.saram_consult_shares enable row level security;

revoke all on public.saram_workspaces, public.saram_memberships, public.saram_states, public.saram_invites, public.saram_consult_shares from anon, authenticated;
grant select on public.saram_workspaces, public.saram_memberships, public.saram_states, public.saram_invites, public.saram_consult_shares to authenticated;
grant all on public.saram_workspaces, public.saram_memberships, public.saram_states, public.saram_invites, public.saram_consult_shares to service_role;

create policy saram_owner_workspace on public.saram_workspaces for select to authenticated
  using (owner_id = (select auth.uid()));
create policy saram_own_membership on public.saram_memberships for select to authenticated
  using (user_id = (select auth.uid()) or exists (select 1 from public.saram_workspaces w where w.id = workspace_id and w.owner_id = (select auth.uid())));
create policy saram_owner_state on public.saram_states for select to authenticated
  using (exists (select 1 from public.saram_workspaces w where w.id = workspace_id and w.owner_id = (select auth.uid())));
create policy saram_owner_invite on public.saram_invites for select to authenticated
  using (exists (select 1 from public.saram_workspaces w where w.id = workspace_id and w.owner_id = (select auth.uid())));
create policy saram_owner_share on public.saram_consult_shares for select to authenticated
  using (exists (select 1 from public.saram_workspaces w where w.id = workspace_id and w.owner_id = (select auth.uid())));
create policy saram_firm_share on public.saram_consult_shares for select to authenticated
  using (firm_user_id = (select auth.uid()) and revoked_at is null and (select auth.jwt()->>'aal') = 'aal2');

-- Server validates the complete payload with validateAppState before calling this service-only RPC.
-- Workspace row lock serializes the initial write and later compare-and-swap operations.
create function public.saram_save_state(p_workspace uuid, p_actor uuid, p_expected_revision bigint, p_payload jsonb)
returns table(revision bigint, updated_at timestamptz)
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_revision bigint; v_now timestamptz := now();
begin
  perform 1 from public.saram_workspaces w where w.id = p_workspace and w.owner_id = p_actor for update;
  if not found then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select s.revision into v_revision from public.saram_states s where s.workspace_id = p_workspace;
  if p_expected_revision is null or coalesce(v_revision,0) <> p_expected_revision then
    raise exception 'REVISION_CONFLICT' using errcode = '40001';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or p_payload->>'schemaVersion' is distinct from '1' or octet_length(p_payload::text) > 5242880 then
    raise exception 'INVALID_STATE' using errcode = '22023';
  end if;
  v_revision := coalesce(v_revision,0) + 1;
  insert into public.saram_states(workspace_id,revision,payload,updated_at) values (p_workspace,v_revision,p_payload,v_now)
    on conflict (workspace_id) do update set revision = excluded.revision, payload = excluded.payload, updated_at = excluded.updated_at;
  return query select v_revision,v_now;
end;
$$;
revoke all on function public.saram_save_state(uuid,uuid,bigint,jsonb) from public, anon, authenticated;
grant execute on function public.saram_save_state(uuid,uuid,bigint,jsonb) to service_role;
commit;
