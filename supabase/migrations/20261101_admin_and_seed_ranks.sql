-- 관리자(dbeld) 화면 + 게임 순위 채움 기록
-- 되돌리기: drop function public.admin_overview(); drop function public.is_admin(); drop table public.admins;
--          drop trigger profiles_not_seed_name on public.profiles; drop function public.profiles_not_seed_name(); drop table public.seed_players;
--          그리고 leaderboard / my_ranks 를 이전 정의로 되돌린다(이 파일 아래쪽 주석 참고).

-- ===== 관리자 =====
create table public.admins (user_id uuid primary key references auth.users(id) on delete cascade, created_at timestamptz not null default now());
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;
insert into public.admins (user_id) select id from public.profiles where username = 'dbeld';

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;

create or replace function public.admin_overview()
returns table(username text, school text, joined_at timestamptz, synced_at timestamptz, last_study text, xp integer, study_days integer, keywords integer, game_plays integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select p.username, p.school, p.created_at, g.updated_at,
           (select max(k) from jsonb_object_keys(coalesce(g.state->'days', '{}'::jsonb)) k),
           coalesce((g.state->>'xp')::numeric, 0)::integer,
           (select count(*) from jsonb_object_keys(coalesce(g.state->'days', '{}'::jsonb)))::integer,
           (select count(*) from jsonb_object_keys(coalesce(g.state->'items', '{}'::jsonb)))::integer,
           (select count(*) from public.game_scores s where s.user_id = p.id)::integer
    from public.profiles p left join public.progress g on g.user_id = p.id
    order by p.created_at desc;
end $$;

revoke execute on function public.is_admin(), public.admin_overview() from public, anon;
grant execute on function public.is_admin(), public.admin_overview() to authenticated;

-- ===== 게임 순위 채움 기록(실제 계정 아님) =====
-- 점수는 각 게임의 실제 점수 규칙(정답·오답·연속·빠른 정답·하트·러시 시간 보너스)으로 판을 흉내 내 만든 값이다.
-- 60초 OX·둘 중 하나는 10 단위, 하트 서바이벌은 하트 3개를 다 써야 끝나서 끝자리 5, 근육·특수검사는 짝수.
create table public.seed_players (id bigint generated always as identity primary key, username text not null, school text not null, game text not null, score integer not null);
alter table public.seed_players enable row level security;
revoke all on public.seed_players from anon, authenticated;
insert into public.seed_players (username, school, game, score) values
('도수치료꿈나무','삼육대학교','exam',78),
('도수치료꿈나무','삼육대학교','sgrade',81),
('도수치료꿈나무','삼육대학교','duel',110),
('도수치료꿈나무','삼육대학교','tests',104),
('도수치료꿈나무','삼육대학교','survive',45),
('도수치료꿈나무','삼육대학교','muscle',68),
('pt_jiwoo','가천대학교','rush',75),
('pt_jiwoo','가천대학교','sgrade',87),
('pt_jiwoo','가천대학교','exam',59),
('pt_jiwoo','가천대학교','survive',55),
('pt_jiwoo','가천대학교','tests',66),
('국시한방합격','대구대학교','sgrade',53),
('국시한방합격','대구대학교','exam',61),
('국시한방합격','대구대학교','muscle',110),
('국시한방합격','대구대학교','rush',109),
('국시한방합격','대구대학교','attack',140),
('재활요정','건양대학교','duel',70),
('재활요정','건양대학교','rush',75),
('재활요정','건양대학교','attack',150),
('재활요정','건양대학교','muscle',62),
('hamstring99','동신대학교','sgrade',85),
('hamstring99','동신대학교','duel',100),
('hamstring99','동신대학교','tests',88),
('hamstring99','동신대학교','exam',74),
('물치3년차','경성대학교','rush',70),
('물치3년차','경성대학교','sgrade',49),
('물치3년차','경성대학교','duel',90),
('물치3년차','경성대학교','exam',63),
('물치3년차','경성대학교','muscle',66),
('물치3년차','경성대학교','survive',65),
('척추는소중해','백석대학교','attack',70),
('척추는소중해','백석대학교','tests',60),
('척추는소중해','백석대학교','survive',95),
('척추는소중해','백석대학교','duel',90),
('척추는소중해','백석대학교','exam',76),
('척추는소중해','백석대학교','muscle',64),
('mina_pt','을지대학교','survive',75),
('mina_pt','을지대학교','duel',70),
('mina_pt','을지대학교','rush',62),
('mina_pt','을지대학교','tests',42),
('mina_pt','을지대학교','attack',100),
('mina_pt','을지대학교','sgrade',53),
('오늘도복습','호남대학교','survive',65),
('오늘도복습','호남대학교','attack',110),
('오늘도복습','호남대학교','tests',106),
('오늘도복습','호남대학교','duel',110),
('gait_cycle','대전대학교','muscle',104),
('gait_cycle','대전대학교','exam',63),
('gait_cycle','대전대학교','survive',125),
('gait_cycle','대전대학교','rush',120),
('gait_cycle','대전대학교','duel',110),
('gait_cycle','대전대학교','sgrade',68);

-- 채움 기록과 같은 아이디로는 가입하지 못하게
create or replace function public.profiles_not_seed_name() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.seed_players sp where lower(sp.username) = lower(new.username)) then
    raise exception 'duplicate key value violates unique constraint "profiles_username_key"' using errcode = '23505';
  end if;
  return new;
end $$;
create trigger profiles_not_seed_name before insert or update of username on public.profiles for each row execute function public.profiles_not_seed_name();

-- 실제 참가자가 10명 이상인 게임에서는 채움 기록을 빼고 순위를 매긴다
create or replace function public.leaderboard(p_game text, p_days integer default null, p_school text default null)
returns table(rank bigint, rn bigint, username text, school text, score integer, is_me boolean, players bigint)
language sql stable security definer set search_path = '' as $$
  with best as (
    select s.user_id, max(s.score) as score from public.game_scores s
    where s.game = p_game and (p_days is null or s.created_at > now() - make_interval(days => p_days))
    group by s.user_id
  ), real_n as (
    select count(distinct s.user_id) as n from public.game_scores s where s.game = p_game
  ), allp as (
    select b.user_id, p.username, p.school, b.score from best b join public.profiles p on p.id = b.user_id
    union all
    select null::uuid, sp.username, sp.school, sp.score from public.seed_players sp
    where sp.game = p_game and (select n from real_n) < 10
  ), ranked as (
    select rank() over (order by a.score desc) as rank,
           row_number() over (order by a.score desc, a.username) as rn,
           a.username, a.school, a.score, coalesce(a.user_id = auth.uid(), false) as is_me, count(*) over () as players
    from allp a
    where p_school is null or a.school = p_school
  ), me as (select r.rn from ranked r where r.is_me limit 1)
  select r.rank, r.rn, r.username, r.school, r.score, r.is_me, r.players from ranked r
  where r.rn <= 10 or r.is_me or exists (select 1 from me where abs(r.rn - me.rn) <= 1)
  order by r.rn;
$$;

create or replace function public.my_ranks(p_days integer default null)
returns table(game text, best integer, rank bigint, players bigint)
language sql stable security definer set search_path = '' as $$
  with best as (
    select s.game, s.user_id, max(s.score) as score from public.game_scores s
    where p_days is null or s.created_at > now() - make_interval(days => p_days)
    group by s.game, s.user_id
  ), real_n as (
    select s.game, count(distinct s.user_id) as n from public.game_scores s group by s.game
  ), allp as (
    select b.game, b.user_id, b.score from best b
    union all
    select sp.game, null::uuid, sp.score from public.seed_players sp
    where coalesce((select r.n from real_n r where r.game = sp.game), 0) < 10
  ), ranked as (
    select a.game, a.user_id, a.score, rank() over (partition by a.game order by a.score desc) as rank, count(*) over (partition by a.game) as players
    from allp a
  )
  select r.game, r.score, r.rank, r.players from ranked r where r.user_id = auth.uid();
$$;

/* 이전 정의(되돌릴 때):
leaderboard: best(위와 같음) → ranked: from best b join public.profiles p on p.id = b.user_id where p_school is null or p.school = p_school, is_me = (b.user_id = auth.uid())
my_ranks: best(위와 같음) → ranked: from best b (채움 기록 없이)
*/
