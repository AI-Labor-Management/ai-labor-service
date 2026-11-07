-- AI 노무 상담(Claude) 하루 이용 한도
-- 질문·답 내용은 저장하지 않는다. 사용자별 날짜(KST)별 횟수만 세고 30일 뒤 지운다.
create table public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  count integer not null default 0 check (count >= 0),
  primary key (user_id, day)
);
comment on table public.ai_usage is 'AI 상담 하루 이용 횟수 (질문 내용 없음) — 30일 보관';
alter table public.ai_usage enable row level security;
-- 정책 없음: 브라우저(anon·authenticated)는 읽거나 쓰지 못하고, Edge Function(서비스 역할)만 쓴다
revoke all on public.ai_usage from anon, authenticated;
grant select, insert, update, delete on public.ai_usage to service_role;

-- 한도 안이면 1을 더하고 새 횟수를, 한도를 넘으면 -1을 돌려준다 (동시에 와도 한 줄 잠금으로 원자적)
create or replace function app.ai_take(p_user uuid, p_limit integer) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  insert into public.ai_usage (user_id, day, count) values (p_user, app.kst_today(), 1)
  on conflict (user_id, day) do update set count = public.ai_usage.count + 1
    where public.ai_usage.count < p_limit
  returning count into v_count;
  return coalesce(v_count, -1);
end $$;
revoke all on function app.ai_take(uuid, integer) from public, anon, authenticated;
grant execute on function app.ai_take(uuid, integer) to service_role;

-- 서비스 역할이 RPC로 부를 수 있게 public 쪽 얇은 래퍼
create or replace function public.ai_take(p_user uuid, p_limit integer) returns integer
language sql security definer set search_path = '' as $$
  select app.ai_take(p_user, p_limit);
$$;
revoke all on function public.ai_take(uuid, integer) from public, anon, authenticated;
grant execute on function public.ai_take(uuid, integer) to service_role;

-- 보관 기간 정리에 AI 이용 횟수 30일을 더한다
create or replace function public.run_retention() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_log integer;
  v_guest integer;
  v_admin integer;
  v_ai integer;
  v_emp integer := 0;
  v_e record;
begin
  perform set_config('app.allow_purge', 'on', true);
  delete from public.notification_log where created_at < now() - interval '90 days';
  get diagnostics v_log = row_count;
  delete from public.guest_consults where purge_after < app.kst_today();
  get diagnostics v_guest = row_count;
  delete from public.admin_access_log where at < now() - interval '1 year';
  get diagnostics v_admin = row_count;
  delete from public.ai_usage where day < app.kst_today() - 30;
  get diagnostics v_ai = row_count;
  for v_e in select id from public.employees where resign_date is not null and resign_date < app.kst_today() - interval '3 years' loop
    delete from public.payroll_lines where employee_id = v_e.id;
    delete from public.statement_deliveries where employee_id = v_e.id;
    delete from public.payroll_edits where employee_id = v_e.id;
    delete from public.employees where id = v_e.id;
    v_emp := v_emp + 1;
  end loop;
  return jsonb_build_object('notificationLog', v_log, 'guestConsults', v_guest, 'adminAccessLog', v_admin, 'aiUsage', v_ai, 'employees', v_emp, 'at', now());
end $$;
comment on function public.run_retention() is '보관 기간 정리: 알림 발송 기록 90일, 비회원 연락처 180일, 관리자 접근 기록 1년, AI 이용 횟수 30일, 퇴사 3년 후 직원 데이터 (개인정보 처리방침)';
