-- =====================================================================
-- Side by Side — Supabase schema
-- Run this whole file once in the Supabase SQL Editor (Dashboard → SQL).
-- Then run seed.sql to load the starter workouts and dinner options.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Profiles (one per auth user, created automatically on sign-up)
-- ---------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users on delete cascade,
  display_name  text not null,
  created_at    timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), split_part(new.email, '@', 1))
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Pairs: the two people who share a schedule
-- ---------------------------------------------------------------------
create table public.pairs (
  id           uuid primary key default gen_random_uuid(),
  invite_code  text not null unique default upper(substr(md5(random()::text), 1, 6)),
  created_at   timestamptz not null default now()
);

create table public.pair_members (
  pair_id  uuid not null references public.pairs on delete cascade,
  user_id  uuid not null unique references public.profiles on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (pair_id, user_id)
);

-- The current user's pair (used by row-level security and column defaults)
create or replace function public.my_pair_id()
returns uuid language sql stable security definer set search_path = public as $$
  select pair_id from public.pair_members where user_id = auth.uid()
$$;

-- Start a new pair; returns the invite code to share with your partner
create or replace function public.create_pair()
returns text language plpgsql security definer set search_path = public as $$
declare p public.pairs;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if exists (select 1 from public.pair_members where user_id = auth.uid()) then
    raise exception 'You are already paired';
  end if;
  insert into public.pairs default values returning * into p;
  insert into public.pair_members (pair_id, user_id) values (p.id, auth.uid());
  return p.invite_code;
end $$;

-- Join your partner's pair with their invite code (max two people)
create or replace function public.join_pair(code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if exists (select 1 from public.pair_members where user_id = auth.uid()) then
    raise exception 'You are already paired';
  end if;
  select id into pid from public.pairs where invite_code = upper(trim(code)) for update;
  if pid is null then raise exception 'Invite code not found'; end if;
  if (select count(*) from public.pair_members where pair_id = pid) >= 2 then
    raise exception 'That pair already has two people';
  end if;
  insert into public.pair_members (pair_id, user_id) values (pid, auth.uid());
  return pid;
end $$;

-- ---------------------------------------------------------------------
-- Libraries: pre-written workouts and dinner options.
-- pair_id NULL = built-in (seeded); otherwise a custom item your pair added.
-- ---------------------------------------------------------------------
create table public.workouts (
  id            uuid primary key default gen_random_uuid(),
  pair_id       uuid references public.pairs on delete cascade default public.my_pair_id(),
  name          text not null,
  category      text not null check (category in ('strength','cardio','hiit','yoga','mobility')),
  duration_min  int  not null check (duration_min > 0),
  difficulty    text not null check (difficulty in ('easy','medium','hard')),
  description   text,
  exercises     jsonb not null default '[]'::jsonb,   -- [{ "name": "...", "detail": "3 x 12" }]
  created_at    timestamptz not null default now()
);

create table public.foods (
  id           uuid primary key default gen_random_uuid(),
  pair_id      uuid references public.pairs on delete cascade default public.my_pair_id(),
  name         text not null,
  category     text not null check (category in ('cook','takeout','restaurant')),
  cuisine      text,
  prep_min     int check (prep_min is null or prep_min > 0),
  description  text,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Schedules
-- schedule_blocks: each person's own busy / free time
-- shared_events:  time the two of you spend together (workout, dinner, hangout)
-- ---------------------------------------------------------------------
create table public.schedule_blocks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles on delete cascade default auth.uid(),
  pair_id    uuid not null references public.pairs on delete cascade default public.my_pair_id(),
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  status     text not null check (status in ('busy','free')),
  label      text,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.shared_events (
  id          uuid primary key default gen_random_uuid(),
  pair_id     uuid not null references public.pairs on delete cascade default public.my_pair_id(),
  created_by  uuid references public.profiles on delete set null default auth.uid(),
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  kind        text not null check (kind in ('workout','dinner','hangout')),
  title       text,
  workout_id  uuid references public.workouts on delete set null,
  food_id     uuid references public.foods on delete set null,
  notes       text,
  created_at  timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index on public.schedule_blocks (pair_id, starts_at);
create index on public.shared_events   (pair_id, starts_at);

-- ---------------------------------------------------------------------
-- Row-level security: you only ever see your own pair's data
-- ---------------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.pairs           enable row level security;
alter table public.pair_members    enable row level security;
alter table public.workouts        enable row level security;
alter table public.foods           enable row level security;
alter table public.schedule_blocks enable row level security;
alter table public.shared_events   enable row level security;

create policy "see self and partner" on public.profiles for select to authenticated
  using (id = auth.uid() or id in (select user_id from public.pair_members where pair_id = public.my_pair_id()));
create policy "edit own profile" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "see own pair" on public.pairs for select to authenticated
  using (id = public.my_pair_id());
create policy "see pair members" on public.pair_members for select to authenticated
  using (pair_id = public.my_pair_id());

create policy "read workouts" on public.workouts for select to authenticated
  using (pair_id is null or pair_id = public.my_pair_id());
create policy "add custom workouts" on public.workouts for insert to authenticated
  with check (pair_id = public.my_pair_id());
create policy "delete custom workouts" on public.workouts for delete to authenticated
  using (pair_id = public.my_pair_id());

create policy "read foods" on public.foods for select to authenticated
  using (pair_id is null or pair_id = public.my_pair_id());
create policy "add custom foods" on public.foods for insert to authenticated
  with check (pair_id = public.my_pair_id());
create policy "delete custom foods" on public.foods for delete to authenticated
  using (pair_id = public.my_pair_id());

create policy "see pair schedules" on public.schedule_blocks for select to authenticated
  using (pair_id = public.my_pair_id());
create policy "add own blocks" on public.schedule_blocks for insert to authenticated
  with check (user_id = auth.uid() and pair_id = public.my_pair_id());
create policy "edit own blocks" on public.schedule_blocks for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and pair_id = public.my_pair_id());
create policy "delete own blocks" on public.schedule_blocks for delete to authenticated
  using (user_id = auth.uid());

-- Either partner can create, edit or cancel time together
create policy "see shared events" on public.shared_events for select to authenticated
  using (pair_id = public.my_pair_id());
create policy "add shared events" on public.shared_events for insert to authenticated
  with check (pair_id = public.my_pair_id());
create policy "edit shared events" on public.shared_events for update to authenticated
  using (pair_id = public.my_pair_id()) with check (pair_id = public.my_pair_id());
create policy "delete shared events" on public.shared_events for delete to authenticated
  using (pair_id = public.my_pair_id());

-- ---------------------------------------------------------------------
-- Realtime: changes made by your partner show up instantly
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.schedule_blocks, public.shared_events;
