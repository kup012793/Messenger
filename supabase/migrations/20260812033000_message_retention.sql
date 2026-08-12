create extension if not exists "pgcrypto";

create index if not exists messages_created_at_idx
  on public.messages (created_at);

-- Remove the previous database-only cleanup job, if it exists. Storage-backed
-- cleanup is handled by the cleanup-expired-messages Edge Function instead.
do $$
declare
  existing_job_id bigint;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    select jobid into existing_job_id
    from cron.job
    where jobname = 'delete-messages-older-than-24-hours';

    if existing_job_id is not null then
      perform cron.unschedule(existing_job_id);
    end if;
  end if;
end $$;
