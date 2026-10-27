-- New dedicated project only. No posting/profile/response storage.
create schema if not exists muttaji_private;
revoke all on schema muttaji_private from public, anon, authenticated;
grant usage on schema muttaji_private to service_role;

create table muttaji_private.quota_state (
 namespace text primary key check (namespace ~ '^[a-z0-9-]{1,32}$'),
 enabled boolean not null default false,
 reserved_micros bigint not null default 0 check (reserved_micros >= 0),
 model_requests bigint not null default 0 check (model_requests >= 0),
 url_requests bigint not null default 0 check (url_requests >= 0),
 budget_micros bigint not null default 0 check (budget_micros between 0 and 5000000),
 max_model_requests integer not null default 0 check (max_model_requests between 0 and 100),
 max_url_requests integer not null default 100 check (max_url_requests between 0 and 100),
 model_daily_limit integer not null default 3 check (model_daily_limit between 1 and 10),
 url_daily_limit integer not null default 10 check (url_daily_limit between 1 and 30)
);
create table muttaji_private.quota_daily (
 namespace text not null references muttaji_private.quota_state(namespace),
 kind text not null check (kind in ('model','url')),
 day date not null,
 identity_type text not null check (identity_type in ('ip','session')),
 identity_hash text not null check (identity_hash ~ '^[A-Za-z0-9_-]{20,100}$'),
 requests integer not null check (requests >= 0),
 primary key(namespace,kind,day,identity_type,identity_hash)
);
create index quota_daily_cleanup on muttaji_private.quota_daily(day);
alter table muttaji_private.quota_state enable row level security;
alter table muttaji_private.quota_daily enable row level security;
revoke all on all tables in schema muttaji_private from public,anon,authenticated;
grant select,insert,update,delete on all tables in schema muttaji_private to service_role;

create function public.muttaji_reserve_quota(p_namespace text,p_kind text,p_subject text,p_session text)
returns text language plpgsql security invoker set search_path = '' as $$
declare
 state muttaji_private.quota_state%rowtype;
 today date := (current_timestamp at time zone 'UTC')::date;
 charge integer;
 daily_limit integer;
 ip_count integer;
 session_count integer;
begin
 if p_namespace is null or p_namespace !~ '^[a-z0-9-]{1,32}$'
  or p_kind is null or p_kind not in ('model','url')
  or p_subject is null or p_subject !~ '^[A-Za-z0-9_-]{20,100}$'
  or p_session is null or p_session !~ '^[a-f0-9]{48}$' then
  return 'INVALID_REQUEST';
 end if;
 -- Lock the shared namespace row before checking any counters. This serializes
 -- concurrent reservations across servers, even when the daily rows are new.
 select * into state from muttaji_private.quota_state where namespace=p_namespace for update;
 if not found then return 'NOT_INITIALIZED'; end if;
 -- Opportunistic cleanup, including while service is paused. No profile data.
 delete from muttaji_private.quota_daily where namespace=p_namespace and day < today - 1;
 if not state.enabled then return 'NOT_INITIALIZED'; end if;
 charge := case when p_kind='model' then 250000 else 0 end;
 daily_limit := case when p_kind='model' then state.model_daily_limit else state.url_daily_limit end;
 if state.reserved_micros + charge > state.budget_micros then return 'BUDGET_EXHAUSTED'; end if;
 if (p_kind='model' and state.model_requests>=state.max_model_requests)
  or (p_kind='url' and state.url_requests>=state.max_url_requests) then return 'TOTAL_LIMIT_REACHED'; end if;
 select coalesce(sum(requests),0)::integer into ip_count from muttaji_private.quota_daily
  where namespace=p_namespace and kind=p_kind and day=today and identity_type='ip' and identity_hash=p_subject;
 select coalesce(sum(requests),0)::integer into session_count from muttaji_private.quota_daily
  where namespace=p_namespace and kind=p_kind and day=today and identity_type='session' and identity_hash=p_session;
 if ip_count>=daily_limit or session_count>=daily_limit then return 'RATE_LIMITED'; end if;
 update muttaji_private.quota_state set reserved_micros=reserved_micros+charge,
  model_requests=model_requests+case when p_kind='model' then 1 else 0 end,
  url_requests=url_requests+case when p_kind='url' then 1 else 0 end where namespace=p_namespace;
 insert into muttaji_private.quota_daily(namespace,kind,day,identity_type,identity_hash,requests)
 values(p_namespace,p_kind,today,'ip',p_subject,1),(p_namespace,p_kind,today,'session',p_session,1)
 on conflict (namespace,kind,day,identity_type,identity_hash) do update set requests=muttaji_private.quota_daily.requests+1;
 return 'ALLOWED';
end;
$$;
revoke all on function public.muttaji_reserve_quota(text,text,text,text) from public,anon,authenticated;
grant execute on function public.muttaji_reserve_quota(text,text,text,text) to service_role;
insert into muttaji_private.quota_state(namespace) values ('release1');

create policy quota_state_server_only on muttaji_private.quota_state for all to service_role using (true) with check (true);
create policy quota_daily_server_only on muttaji_private.quota_daily for all to service_role using (true) with check (true);
