-- 트리거 함수는 API(/rpc)로 부를 필요가 없다. 트리거로는 계속 동작한다.
revoke execute on function public.profiles_not_seed_name() from public, anon, authenticated;
