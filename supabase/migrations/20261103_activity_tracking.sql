-- 감독자(관리자) 화면용 접속·활동 기록
-- 1) 마지막 접속 시각, 2) 날짜별 앱 이용 시간(앱이 켜져 있는 동안 1분마다 보내는 신호), 3) 학습·복습·게임·시험 활동 기록
-- 이용자는 자기 기록을 쓰기만 하고 읽을 수 없다. 읽기는 관리자 함수(admin_*)로만.
-- 되돌리기: drop function public.admin_user(text); drop function public.admin_stats(integer); drop function public.touch(integer);
--          drop table public.activity; drop table public.usage_daily; alter table public.profiles drop column last_seen_at;
--          그리고 admin_overview를 20261101 파일의 정의로 되돌린다.

alter table public.profiles add column if not exists last_seen_at timestamptz;

create table if not exists public.usage_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  secs integer not null default 0,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.usage_daily enable row level security;
revoke all on public.usage_daily from anon, authenticated;

create table if not exists public.activity (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  at timestamptz not null default now(),
  kind text not null check (kind in ('login', 'lesson', 'review', 'game', 'exam')),
  ref text not null default '' check (char_length(ref) <= 60),
  secs integer not null default 0 check (secs between 0 and 14400),
  n integer not null default 0 check (n between 0 and 500),
  ok integer not null default 0 check (ok between 0 and 500)
);
create index if not exists activity_user_at on public.activity (user_id, at desc);
create index if not exists activity_at on public.activity (at desc);
alter table public.activity enable row level security;
revoke all on public.activity from anon, authenticated;
grant insert (kind, ref, secs, n, ok) on public.activity to authenticated;
create policy activity_insert_own on public.activity for insert to authenticated with check ((select auth.uid()) = user_id);

-- 한 사람이 하루에 남길 수 있는 활동은 300건까지(초과분은 조용히 버림)
create or replace function public.activity_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.activity a where a.user_id = new.user_id and a.at > now() - interval '1 day') >= 300 then return null; end if;
  return new;
end $$;
revoke execute on function public.activity_limit() from public, anon, authenticated;
create trigger activity_limit before insert on public.activity for each row execute function public.activity_limit();

-- 앱이 켜져 있는 동안 1분마다 부른다: 마지막 접속 시각과 오늘(한국 시간) 이용 시간을 올린다
create or replace function public.touch(p_secs integer default 0)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); d date := (now() at time zone 'Asia/Seoul')::date; s integer := least(greatest(coalesce(p_secs, 0), 0), 120);
begin
  if uid is null then return; end if;
  update public.profiles set last_seen_at = now() where id = uid;
  insert into public.usage_daily as u (user_id, day, secs) values (uid, d, s)
  on conflict (user_id, day) do update set secs = u.secs + excluded.secs, last_at = now();
end $$;
revoke execute on function public.touch(integer) from public, anon;
grant execute on function public.touch(integer) to authenticated;

-- 가입자 목록에 마지막 접속과 누적 이용 시간을 더한다(반환 형식이 바뀌어 다시 만든다)
drop function if exists public.admin_overview();
create function public.admin_overview()
returns table(username text, school text, joined_at timestamptz, synced_at timestamptz, last_study text, xp integer, study_days integer, keywords integer, game_plays integer,
              last_seen_at timestamptz, online boolean, total_secs integer, week_secs integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select p.username, p.school, p.created_at, g.updated_at,
           (select max(k) from jsonb_object_keys(coalesce(g.state->'days', '{}'::jsonb)) k),
           coalesce((g.state->>'xp')::numeric, 0)::integer,
           (select count(*) from jsonb_object_keys(coalesce(g.state->'days', '{}'::jsonb)))::integer,
           (select count(*) from jsonb_object_keys(coalesce(g.state->'items', '{}'::jsonb)))::integer,
           (select count(*) from public.game_scores s where s.user_id = p.id)::integer,
           p.last_seen_at, coalesce(p.last_seen_at > now() - interval '3 minutes', false),
           (select coalesce(sum(u.secs), 0) from public.usage_daily u where u.user_id = p.id)::integer,
           (select coalesce(sum(u.secs), 0) from public.usage_daily u where u.user_id = p.id and u.day > (now() at time zone 'Asia/Seoul')::date - 7)::integer
    from public.profiles p left join public.progress g on g.user_id = p.id
    order by p.created_at desc;
end $$;
revoke execute on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;

-- 전체 통계: 지금 접속 중, 날짜별 이용자·시간, 활동 종류별, 시간대별
create or replace function public.admin_stats(p_days integer default 7)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare n integer := greatest(1, least(coalesce(p_days, 7), 60)); since date := (now() at time zone 'Asia/Seoul')::date - (greatest(1, least(coalesce(p_days, 7), 60)) - 1);
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'online', (select coalesce(jsonb_agg(p.username order by p.last_seen_at desc), '[]'::jsonb) from public.profiles p where p.last_seen_at > now() - interval '3 minutes'),
    'today', (select count(*) from public.usage_daily u where u.day = (now() at time zone 'Asia/Seoul')::date),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('day', d.day::date, 'users', coalesce(x.users, 0), 'secs', coalesce(x.secs, 0)) order by d.day), '[]'::jsonb)
              from generate_series(since, (now() at time zone 'Asia/Seoul')::date, interval '1 day') d(day)
              left join (select u.day, count(*) users, sum(u.secs) secs from public.usage_daily u where u.day >= since group by u.day) x on x.day = d.day::date),
    'kinds', (select coalesce(jsonb_agg(jsonb_build_object('kind', k.kind, 'n', k.cnt, 'users', k.users, 'secs', k.secs) order by k.cnt desc), '[]'::jsonb)
              from (select a.kind, count(*) cnt, count(distinct a.user_id) users, sum(a.secs) secs from public.activity a where (a.at at time zone 'Asia/Seoul')::date >= since group by a.kind) k),
    'refs', (select coalesce(jsonb_agg(jsonb_build_object('kind', r.kind, 'ref', r.ref, 'n', r.cnt) order by r.cnt desc), '[]'::jsonb)
             from (select a.kind, a.ref, count(*) cnt from public.activity a where (a.at at time zone 'Asia/Seoul')::date >= since and a.kind in ('game', 'exam') group by a.kind, a.ref order by count(*) desc limit 12) r),
    'hours', (select coalesce(jsonb_agg(jsonb_build_object('h', h.h, 'n', coalesce(x.cnt, 0)) order by h.h), '[]'::jsonb)
              from generate_series(0, 23) h(h)
              left join (select extract(hour from a.at at time zone 'Asia/Seoul')::int hh, count(*) cnt from public.activity a where (a.at at time zone 'Asia/Seoul')::date >= since group by 1) x on x.hh = h.h),
    'total_secs', (select coalesce(sum(u.secs), 0) from public.usage_daily u where u.day >= since),
    'days', n
  );
end $$;
revoke execute on function public.admin_stats(integer) from public, anon;
grant execute on function public.admin_stats(integer) to authenticated;

-- 한 사람의 자세한 기록
create or replace function public.admin_user(p_username text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare uid uuid; r jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select p.id into uid from public.profiles p where p.username = p_username;
  if uid is null then return null; end if;
  select jsonb_build_object(
    'username', p.username, 'school', p.school, 'joined_at', p.created_at, 'last_seen_at', p.last_seen_at,
    'online', coalesce(p.last_seen_at > now() - interval '3 minutes', false),
    'last_sign_in_at', (select a.last_sign_in_at from auth.users a where a.id = uid),
    'xp', coalesce((g.state->>'xp')::numeric, 0)::integer,
    'keywords', (select count(*) from jsonb_object_keys(coalesce(g.state->'items', '{}'::jsonb))),
    'concepts', (select count(*) from jsonb_object_keys(coalesce(g.state->'skills', '{}'::jsonb))),
    'reviews', coalesce((g.state->>'reviews')::numeric, 0)::integer,
    'exams', coalesce(g.state->'exams', '[]'::jsonb),
    'days', coalesce(g.state->'days', '{}'::jsonb),
    'usage', (select coalesce(jsonb_agg(jsonb_build_object('day', u.day, 'secs', u.secs, 'first_at', u.first_at, 'last_at', u.last_at) order by u.day desc), '[]'::jsonb)
              from (select * from public.usage_daily u where u.user_id = uid order by u.day desc limit 30) u),
    'total_secs', (select coalesce(sum(u.secs), 0) from public.usage_daily u where u.user_id = uid),
    'kinds', (select coalesce(jsonb_agg(jsonb_build_object('kind', k.kind, 'n', k.cnt, 'secs', k.secs) order by k.cnt desc), '[]'::jsonb)
              from (select a.kind, count(*) cnt, sum(a.secs) secs from public.activity a where a.user_id = uid group by a.kind) k),
    'recent', (select coalesce(jsonb_agg(jsonb_build_object('at', a.at, 'kind', a.kind, 'ref', a.ref, 'secs', a.secs, 'n', a.n, 'ok', a.ok) order by a.at desc), '[]'::jsonb)
               from (select * from public.activity a where a.user_id = uid order by a.at desc limit 40) a),
    'games', (select count(*) from public.game_scores s where s.user_id = uid)
  ) into r
  from public.profiles p left join public.progress g on g.user_id = p.id where p.id = uid;
  return r;
end $$;
revoke execute on function public.admin_user(text) from public, anon;
grant execute on function public.admin_user(text) to authenticated;
