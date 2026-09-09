create schema if not exists shtab_private;
revoke all on schema shtab_private from public,anon;
grant usage on schema shtab_private to authenticated;
create table shtab_private.members(workspace uuid not null,email text not null,primary key(workspace,email));
alter table shtab_private.members enable row level security;
revoke all on shtab_private.members from public,anon,authenticated;
create function shtab_private.can_access(workspace_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u join shtab_private.members m on lower(u.email)=lower(m.email)
 where u.id=(select auth.uid()) and u.email_confirmed_at is not null and m.workspace=workspace_id
 and (u.banned_until is null or u.banned_until<now()));
$$;
revoke all on function shtab_private.can_access(uuid) from public,anon;
grant execute on function shtab_private.can_access(uuid) to authenticated;
create table public.shtab_workspaces(id uuid primary key,data jsonb not null,version bigint not null default 1,updated_at timestamptz not null default now());
alter table public.shtab_workspaces enable row level security;
revoke all on public.shtab_workspaces from public,anon,authenticated;
grant select on public.shtab_workspaces to authenticated;
grant update(data,version,updated_at) on public.shtab_workspaces to authenticated;
create policy shtab_read on public.shtab_workspaces for select to authenticated using ((select shtab_private.can_access(id)));
create policy shtab_update on public.shtab_workspaces for update to authenticated using ((select shtab_private.can_access(id))) with check ((select shtab_private.can_access(id)));
create function public.shtab_save_workspace(workspace uuid,expected bigint,payload jsonb) returns table(version bigint)
language sql security invoker set search_path='' as $$
 update public.shtab_workspaces set data=payload,version=expected+1,updated_at=now()
 where id=workspace and shtab_workspaces.version=expected returning shtab_workspaces.version;
$$;
revoke all on function public.shtab_save_workspace(uuid,bigint,jsonb) from public,anon;
grant execute on function public.shtab_save_workspace(uuid,bigint,jsonb) to authenticated;
