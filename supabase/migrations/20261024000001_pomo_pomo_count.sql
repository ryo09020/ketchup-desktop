-- Add pomo_count column to pomos table and actual_focus_sec to tasks
alter table public.pomos add column if not exists pomo_count int not null default 1;
alter table public.tasks add column if not exists actual_focus_sec int not null default 0;
alter table public.tasks add column if not exists pomo_count int not null default 0;
