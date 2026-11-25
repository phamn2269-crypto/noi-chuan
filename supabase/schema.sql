-- Lược đồ Supabase cho Nói Chuẩn (MVP hiện lưu localStorage; bật đồng bộ bằng cách cài adapter trong src/lib/backend.ts)
-- Nguyên tắc: KHÔNG lưu file ghi âm của trẻ – chỉ lưu điểm. Bảng xếp hạng chỉ biệt danh, chỉ trong lớp.

create table parents (
  id uuid primary key references auth.users on delete cascade,
  name text not null,
  consent_recording boolean not null default false,
  consent_camera boolean not null default false,
  consent_at timestamptz,
  created_at timestamptz default now()
);

create table classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references auth.users on delete cascade,
  name text not null,
  code text unique not null
);

create table children (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references parents on delete cascade,
  name text not null,
  nickname text not null,
  grade smallint check (grade between 1 and 9),
  mode text check (mode in ('kid','teen')) default 'kid',
  mascot text default 'sao',
  voice text check (voice in ('bac','nam')) default 'bac',
  class_id uuid references classes on delete set null,
  created_at timestamptz default now()
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  child_id uuid references children on delete cascade,
  kind text check (kind in ('lesson','game','placement')),
  activity text not null,
  pair_id text,
  correct int not null,
  total int not null,
  duration_sec int not null,
  xp int not null,
  created_at timestamptz default now()
);

create table attempts (
  id bigserial primary key,
  child_id uuid references children on delete cascade,
  item_id text not null,
  pair_id text,
  correct boolean not null,
  heard text,                 -- văn bản nhận dạng được (không lưu âm thanh)
  created_at timestamptz default now()
);

create table progress (
  child_id uuid primary key references children on delete cascade,
  xp int default 0, stars int default 0, streak int default 0, best_streak int default 0,
  last_practice_day date, badges text[] default '{}', pet jsonb default '{}', difficulty jsonb default '{}',
  updated_at timestamptz default now()
);

create table audio_reviews (
  key text primary key,       -- "<giong>/<id>" khớp public/audio/manifest.json
  status text check (status in ('chua_duyet','da_duyet','doc_sai')) default 'chua_duyet',
  note text,
  human_audio_path text,      -- ghi âm người thật (Supabase Storage, bucket "voice")
  reviewed_by uuid references auth.users,
  updated_at timestamptz default now()
);

create table assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references classes on delete cascade,
  pair_id text not null,
  title text not null,
  due date,
  created_at timestamptz default now()
);

-- Bảng xếp hạng tuần: chỉ biệt danh, chỉ trong lớp
create view weekly_leaderboard as
  select c.class_id, c.nickname, sum(s.xp) as xp
  from sessions s join children c on c.id = s.child_id
  where s.created_at > now() - interval '7 days' and c.class_id is not null
  group by c.class_id, c.nickname;

-- RLS: phụ huynh chỉ thấy dữ liệu con mình; xóa phụ huynh → xóa dây chuyền toàn bộ dữ liệu con
alter table parents enable row level security;
alter table children enable row level security;
alter table sessions enable row level security;
alter table attempts enable row level security;
alter table progress enable row level security;
create policy "own parent" on parents for all using (id = auth.uid());
create policy "own children" on children for all using (parent_id = auth.uid());
create policy "own sessions" on sessions for all using (child_id in (select id from children where parent_id = auth.uid()));
create policy "own attempts" on attempts for all using (child_id in (select id from children where parent_id = auth.uid()));
create policy "own progress" on progress for all using (child_id in (select id from children where parent_id = auth.uid()));
