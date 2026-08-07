create extension if not exists "pgcrypto";
create table if not exists public.messages (
 id uuid primary key default gen_random_uuid(), content text not null default '',
 image_url text, link_url text, sender_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 constraint message_has_content check (length(trim(content)) > 0 or image_url is not null)
);
alter table public.messages enable row level security;
create policy "signed in users can read messages" on public.messages for select to authenticated using (true);
create policy "users can send as themselves" on public.messages for insert to authenticated with check (auth.uid() = sender_id);
create policy "users can delete own messages" on public.messages for delete to authenticated using (auth.uid() = sender_id);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('chat-images','chat-images',true,10485760,array['image/jpeg','image/png','image/webp','image/gif']) on conflict(id) do nothing;
create policy "public can view chat images" on storage.objects for select using (bucket_id='chat-images');
create policy "users upload to own folder" on storage.objects for insert to authenticated with check (bucket_id='chat-images' and (storage.foldername(name))[1]=auth.uid()::text);
alter publication supabase_realtime add table public.messages;
