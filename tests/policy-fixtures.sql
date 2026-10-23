-- Test scaffolding for an EMPTY, DISPOSABLE PostgreSQL database only.
-- Models the Supabase auth.uid() and storage schema used by our policies.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create schema storage;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
create function storage.foldername(text) returns text[] language sql immutable as $$
  select string_to_array($1,'/');
$$;
grant usage on schema public,auth,storage to anon,authenticated;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id bigint generated always as identity,bucket_id text,name text);
alter table storage.objects enable row level security;
grant select,insert,delete on storage.objects to authenticated;
grant select on storage.objects to anon;
grant usage on all sequences in schema storage to authenticated;
insert into auth.users values ('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
