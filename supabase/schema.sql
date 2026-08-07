create extension if not exists "pgcrypto";

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  content text not null default '',
  image_url text,
  link_url text,
  sender_name text not null check (sender_name in ('정미', '현우')),
  created_at timestamptz not null default now(),
  constraint message_has_content check (length(trim(content)) > 0 or image_url is not null)
);

create table if not exists public.stickers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  image_url text not null,
  storage_path text not null unique,
  created_by text not null check (created_by in ('정미', '현우')),
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;
alter table public.stickers enable row level security;

grant select, insert, delete on table public.messages to anon, authenticated;
grant select, insert, delete on table public.stickers to anon, authenticated;

drop policy if exists "everyone reads messages" on public.messages;
drop policy if exists "two profiles send messages" on public.messages;
drop policy if exists "two profiles clear messages" on public.messages;
drop policy if exists "everyone reads stickers" on public.stickers;
drop policy if exists "two profiles add stickers" on public.stickers;
drop policy if exists "two profiles delete stickers" on public.stickers;
create policy "everyone reads messages" on public.messages for select to anon, authenticated using (true);
create policy "two profiles send messages" on public.messages for insert to anon, authenticated
  with check (sender_name in ('정미', '현우'));
create policy "two profiles clear messages" on public.messages for delete to anon, authenticated using (true);
create policy "everyone reads stickers" on public.stickers for select to anon, authenticated using (true);
create policy "two profiles add stickers" on public.stickers for insert to anon, authenticated
  with check (created_by in ('정미', '현우'));
create policy "two profiles delete stickers" on public.stickers for delete to anon, authenticated using (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-media', 'chat-media', true, 10485760, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = true, file_size_limit = 10485760;

drop policy if exists "public reads chat media" on storage.objects;
drop policy if exists "two profiles upload chat media" on storage.objects;
drop policy if exists "two profiles delete chat media" on storage.objects;
create policy "public reads chat media" on storage.objects for select to anon, authenticated
  using (bucket_id = 'chat-media');
create policy "two profiles upload chat media" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'chat-media');
create policy "two profiles delete chat media" on storage.objects for delete to anon, authenticated
  using (bucket_id = 'chat-media');

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'stickers') then
    alter publication supabase_realtime add table public.stickers;
  end if;
end $$;
