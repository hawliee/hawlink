-- Run once in your Supabase project's SQL Editor. No keys or passwords go here.
begin;
create table if not exists public.pink_boards (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 2097152),
  revision bigint not null default 0 check (revision >= 0)
);
alter table public.pink_boards enable row level security;
revoke all on public.pink_boards from anon;
grant select, insert, update on public.pink_boards to authenticated;

drop policy if exists "Read your own collection" on public.pink_boards;
create policy "Read your own collection" on public.pink_boards
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Create your own collection" on public.pink_boards;
create policy "Create your own collection" on public.pink_boards
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "Update your own collection" on public.pink_boards;
create policy "Update your own collection" on public.pink_boards
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pink-images', 'pink-images', false, 12582912,
  array['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Read your own pink images" on storage.objects;
create policy "Read your own pink images" on storage.objects
  for select to authenticated using (
    bucket_id = 'pink-images' and (storage.foldername(name))[1] = (select auth.uid())::text
  );
drop policy if exists "Upload your own pink images" on storage.objects;
create policy "Upload your own pink images" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'pink-images' and (storage.foldername(name))[1] = (select auth.uid())::text
  );
drop policy if exists "Delete your own pink images" on storage.objects;
create policy "Delete your own pink images" on storage.objects
  for delete to authenticated using (
    bucket_id = 'pink-images' and (storage.foldername(name))[1] = (select auth.uid())::text
  );
commit;
