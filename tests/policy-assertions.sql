set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
insert into public.pink_boards(user_id,data) values (auth.uid(),'{"tabs":[],"background":"#ffffff"}');
insert into storage.objects(bucket_id,name) values ('pink-images','00000000-0000-4000-8000-000000000001/picture.jpg');
do $$ begin
 if (select count(*) from public.pink_boards)<>1 then raise exception 'owner cannot read board'; end if;
 if (select count(*) from storage.objects)<>1 then raise exception 'owner cannot read image'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
do $$ declare n integer; begin
 if (select count(*) from public.pink_boards)<>0 then raise exception 'another user can read board'; end if;
 if (select count(*) from storage.objects)<>0 then raise exception 'another user can read image'; end if;
 update public.pink_boards set revision=99;
 get diagnostics n = row_count;
 if n<>0 then raise exception 'another user can update board'; end if;
 delete from storage.objects;
 get diagnostics n = row_count;
 if n<>0 then raise exception 'another user can delete image'; end if;
 begin
  insert into public.pink_boards(user_id,data) values ('00000000-0000-4000-8000-000000000001','{}');
  raise exception 'another user can impersonate board owner';
 exception when insufficient_privilege then null;
 end;
 begin
  insert into storage.objects(bucket_id,name) values ('pink-images','00000000-0000-4000-8000-000000000001/attack.jpg');
  raise exception 'another user can upload to owner folder';
 exception when insufficient_privilege then null;
 end;
end $$;
set role anon;
select set_config('request.jwt.claim.sub','',false);
do $$ begin
 if (select count(*) from storage.objects)<>0 then raise exception 'anonymous visitor can read images'; end if;
 begin
  perform * from public.pink_boards;
  raise exception 'anonymous visitor can read boards';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
do $$ begin
 if (select public from storage.buckets where id='pink-images')<>false then raise exception 'bucket is public'; end if;
end $$;
select 'PASS: owner access, second-account isolation, anonymous isolation, and private bucket' as result;
