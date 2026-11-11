-- AI 노무 상담: 답을 받지 못한 질문(제공사 오류·시간 초과)은 하루 이용 횟수에서 되돌린다
-- 질문을 보내기 전에 ai_take로 한 번을 잡고(동시 요청에도 한도를 지키려고), 실패하면 이 함수로 한 번을 돌려준다.
create or replace function app.ai_refund(p_user uuid) returns integer
language sql security definer set search_path = '' as $$
  update public.ai_usage set count = count - 1
  where user_id = p_user and day = app.kst_today() and count > 0
  returning count;
$$;
revoke all on function app.ai_refund(uuid) from public, anon, authenticated;
grant execute on function app.ai_refund(uuid) to service_role;

create or replace function public.ai_refund(p_user uuid) returns integer
language sql security definer set search_path = '' as $$
  select app.ai_refund(p_user);
$$;
revoke all on function public.ai_refund(uuid) from public, anon, authenticated;
grant execute on function public.ai_refund(uuid) to service_role;
