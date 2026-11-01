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
create table public.seed_players (id bigint generated always as identity primary key, username text not null, school text not null, game text not null, score integer not null);
alter table public.seed_players enable row level security;
revoke all on public.seed_players from anon, authenticated;
insert into public.seed_players (username, school, game, score) values
('도수치료꿈나무','삼육대학교','exam',83),
('도수치료꿈나무','삼육대학교','sgrade',62),
('도수치료꿈나무','삼육대학교','duel',76),
('도수치료꿈나무','삼육대학교','tests',82),
('도수치료꿈나무','삼육대학교','survive',56),
('도수치료꿈나무','삼육대학교','muscle',58),
('pt_jiwoo','가천대학교','rush',72),
('pt_jiwoo','가천대학교','sgrade',49),
('pt_jiwoo','가천대학교','exam',73),
('pt_jiwoo','가천대학교','survive',88),
('pt_jiwoo','가천대학교','tests',52),
('국시한방합격','대구대학교','sgrade',63),
('국시한방합격','대구대학교','exam',53),
('국시한방합격','대구대학교','muscle',80),
('국시한방합격','대구대학교','rush',70),
('국시한방합격','대구대학교','attack',64),
('재활요정','건양대학교','duel',72),
('재활요정','건양대학교','rush',80),
('재활요정','건양대학교','attack',112),
('재활요정','건양대학교','muscle',106),
('hamstring99','동신대학교','sgrade',69),
('hamstring99','동신대학교','duel',102),
('hamstring99','동신대학교','tests',64),
('hamstring99','동신대학교','exam',73),
('물치3년차','경성대학교','rush',88),
('물치3년차','경성대학교','sgrade',88),
('물치3년차','경성대학교','duel',40),
('물치3년차','경성대학교','exam',86),
('물치3년차','경성대학교','muscle',54),
('물치3년차','경성대학교','survive',60),
('척추는소중해','백석대학교','attack',120),
('척추는소중해','백석대학교','tests',62),
('척추는소중해','백석대학교','survive',68),
('척추는소중해','백석대학교','duel',108),
('척추는소중해','백석대학교','exam',44),
('척추는소중해','백석대학교','muscle',60),
('mina_pt','을지대학교','survive',56),
('mina_pt','을지대학교','duel',64),
('mina_pt','을지대학교','rush',66),
('mina_pt','을지대학교','tests',78),
('mina_pt','을지대학교','attack',148),
('mina_pt','을지대학교','sgrade',68),
('오늘도복습','호남대학교','survive',96),
('오늘도복습','호남대학교','attack',80),
('오늘도복습','호남대학교','tests',44),
('오늘도복습','호남대학교','duel',88),
('gait_cycle','대전대학교','muscle',96),
('gait_cycle','대전대학교','exam',83),
('gait_cycle','대전대학교','survive',54),
('gait_cycle','대전대학교','rush',82),
('gait_cycle','대전대학교','duel',106),
('gait_cycle','대전대학교','sgrade',80);

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
