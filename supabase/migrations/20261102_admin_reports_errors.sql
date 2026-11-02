-- 관리자 화면의 '신고'와 '오류' 목록. 관리자(admins)만 호출할 수 있다.
-- 되돌리기: drop function public.admin_reports(); drop function public.admin_errors(integer);

create or replace function public.admin_reports()
returns table(created_at timestamptz, username text, school text, item_id text, kind text, memo text, app_ver text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select r.created_at, p.username, p.school, r.item_id, r.kind, r.memo, r.app_ver
    from public.reports r left join public.profiles p on p.id = r.user_id
    order by r.created_at desc limit 200;
end $$;

-- 같은 오류끼리 묶어 최근 p_days일만
create or replace function public.admin_errors(p_days integer default 7)
returns table(msg text, src text, screen text, app_ver text, n bigint, users bigint, last_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select e.msg, e.src, e.screen, e.app_ver, count(*), count(distinct coalesce(e.user_id::text, e.ua)), max(e.created_at)
    from public.app_errors e
    where e.created_at > now() - make_interval(days => greatest(1, least(coalesce(p_days, 7), 60)))
    group by e.msg, e.src, e.screen, e.app_ver
    order by max(e.created_at) desc limit 100;
end $$;

revoke execute on function public.admin_reports(), public.admin_errors(integer) from public, anon;
grant execute on function public.admin_reports(), public.admin_errors(integer) to authenticated;
