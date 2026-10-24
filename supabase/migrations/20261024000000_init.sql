-- =============================================================================
-- KetchUp Desktop: initial schema
--
-- 方針:
--   * 認証は Supabase Auth (auth.users)。アプリ側ユーザーは public.profiles。
--   * アプリデータの読み書きは Go API 経由 (postgres ロールで接続 = RLS バイパス)。
--   * クライアント(デスクトップ)が直接読むのは Realtime 購読対象の
--     pomo_sessions / profiles のみ。そのため RLS は「デフォルト拒否」+
--     必要最小限の SELECT ポリシーだけを定義する。
--   * ketch-up (Web版) のスキーマを土台に、Focus To-Do 的なタスク属性・
--     タイムゾーン・一時停止状態・AI/音声関連テーブルを追加。
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Utilities
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: auth.users と 1:1
-- ---------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text,
  display_name text not null default '',
  avatar_url   text,
  -- ketch-up は JST 固定だったが、日付境界をユーザーごとに正しく扱うため保持
  timezone     text not null default 'Asia/Tokyo',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- user_settings: タイマー設定 (端末を跨いで同期したいもの)
--   ※ 音量・BGM・ショートカット等の端末固有設定はクライアント側に保存
-- ---------------------------------------------------------------------------
create table public.user_settings (
  user_id             uuid primary key references public.profiles (id) on delete cascade,
  focus_sec           int  not null default 1500 check (focus_sec between 60 and 7200),
  short_break_sec     int  not null default 300  check (short_break_sec between 60 and 3600),
  long_break_sec      int  not null default 900  check (long_break_sec between 60 and 7200),
  long_break_interval int  not null default 4    check (long_break_interval between 1 and 12),
  auto_start_breaks   boolean not null default true,
  auto_start_focus    boolean not null default false,
  updated_at          timestamptz not null default now()
);
create trigger user_settings_updated_at before update on public.user_settings
  for each row execute function public.set_updated_at();

-- 新規サインアップ時に profile / settings を自動作成
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;

  insert into public.user_settings (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
create table public.tasks (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  title           text not null check (char_length(title) between 1 and 200),
  note            text not null default '',
  status          text not null default 'TODO'
                    check (status in ('TODO', 'IN_PROGRESS', 'COMPLETED')),
  estimated_pomos int  not null default 1 check (estimated_pomos between 0 and 50),
  pomo_count      int  not null default 0,
  actual_focus_sec int not null default 0,
  due_date        date,
  project         text check (project is null or char_length(project) between 1 and 50),
  sort_order      double precision not null default 0,
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index tasks_user_status_idx on public.tasks (user_id, status, due_date);
create trigger tasks_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- pomos: 完了したポモドーロの記録
--   client_id: オフラインキュー再送時の冪等キー
-- ---------------------------------------------------------------------------
create table public.pomos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  task_id      uuid references public.tasks (id) on delete set null,
  client_id    uuid not null,
  started_at   timestamptz not null,
  ended_at     timestamptz not null,
  duration_sec int not null check (duration_sec > 0),
  pomo_count   int not null default 1,
  created_at   timestamptz not null default now(),
  constraint pomos_client_id_key unique (user_id, client_id),
  constraint pomos_time_order check (ended_at >= started_at)
);
create index pomos_user_started_idx on public.pomos (user_id, started_at);
create index pomos_task_idx on public.pomos (task_id);

-- ---------------------------------------------------------------------------
-- pomo_sessions: 「いま何をしているか」(1ユーザー1行, グループ表示用)
--   ketch-up では一時停止を行削除で表現していたため、グループから
--   一時停止中が見えなかった。phase を明示し、行は削除せず IDLE に戻す
--   (Realtime の DELETE イベントには RLS が効かず内容も届かないため)。
-- ---------------------------------------------------------------------------
create table public.pomo_sessions (
  user_id       uuid primary key references public.profiles (id) on delete cascade,
  phase         text not null default 'IDLE'
                  check (phase in ('IDLE', 'FOCUS', 'PAUSED', 'SHORT_BREAK', 'LONG_BREAK')),
  task_id       uuid references public.tasks (id) on delete set null,
  task_title    text,
  phase_ends_at timestamptz,   -- 実行中フェーズの終了予定時刻 (PAUSED/IDLE は null)
  remaining_sec int,           -- PAUSED 時の残り秒数
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- reports: 日報 (1ユーザー1日1件)
-- ---------------------------------------------------------------------------
create table public.reports (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  published_date date not null,
  body           text not null default '',
  self_score     int check (self_score is null or self_score between 1 and 100),
  source         text not null default 'manual' check (source in ('manual', 'voice', 'ai')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint reports_user_date_key unique (user_id, published_date)
);
create trigger reports_updated_at before update on public.reports
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- voice_notes: 音声日報の文字起こし (音声ファイル自体は保存しない)
-- ---------------------------------------------------------------------------
create table public.voice_notes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  report_date  date not null,
  transcript   text not null default '',
  duration_sec int,
  model        text not null default '',
  created_at   timestamptz not null default now()
);
create index voice_notes_user_date_idx on public.voice_notes (user_id, report_date);

-- ---------------------------------------------------------------------------
-- ai_summaries: AI まとめ (期間ごとに最新 1 件)
-- ---------------------------------------------------------------------------
create table public.ai_summaries (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  scope        text not null check (scope in ('daily', 'weekly', 'monthly')),
  period_start date not null,
  period_end   date not null,
  content      text not null,
  model        text not null default '',
  created_at   timestamptz not null default now(),
  constraint ai_summaries_period_key unique (user_id, scope, period_start, period_end),
  constraint ai_summaries_period_order check (period_end >= period_start)
);

-- AI 呼び出し回数 (日次レート制限 / コスト管理)
create table public.ai_usage (
  user_id uuid not null references public.profiles (id) on delete cascade,
  used_on date not null,
  count   int  not null default 0,
  primary key (user_id, used_on)
);

-- ---------------------------------------------------------------------------
-- groups / group_members
-- ---------------------------------------------------------------------------
create table public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 50),
  description text not null default '',
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  invite_code text not null unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger groups_updated_at before update on public.groups
  for each row execute function public.set_updated_at();

create table public.group_members (
  group_id  uuid not null references public.groups (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  role      text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_idx on public.group_members (user_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
--   全テーブル有効化 (= デフォルト拒否)。Go API は RLS をバイパスするロールで接続。
-- ---------------------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.user_settings enable row level security;
alter table public.tasks         enable row level security;
alter table public.pomos         enable row level security;
alter table public.pomo_sessions enable row level security;
alter table public.reports       enable row level security;
alter table public.voice_notes   enable row level security;
alter table public.ai_summaries  enable row level security;
alter table public.ai_usage      enable row level security;
alter table public.groups        enable row level security;
alter table public.group_members enable row level security;

-- 自分と同じグループに属しているか (RLS 内で group_members を再帰参照しないよう security definer)
create or replace function public.shares_group_with(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members a
    join public.group_members b on a.group_id = b.group_id
    where a.user_id = (select auth.uid())
      and b.user_id = target
  );
$$;

create policy "read own or co-member session"
  on public.pomo_sessions for select
  to authenticated
  using (user_id = (select auth.uid()) or public.shares_group_with(user_id));

create policy "read own or co-member profile"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()) or public.shares_group_with(id));

-- ---------------------------------------------------------------------------
-- Realtime: グループのメンバータイマーをリアルタイム配信
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.pomo_sessions;
