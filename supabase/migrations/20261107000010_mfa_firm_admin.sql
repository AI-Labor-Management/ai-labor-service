-- 노무법인·관리자 2단계 인증 (2026-11-07)
-- 노무법인 담당자와 관리자는 인증 앱(TOTP)으로 2단계 인증을 마친 로그인 세션(JWT aal = 'aal2')에서만
-- 그 역할의 데이터를 볼 수 있다. 역할 판정 헬퍼 두 개(app.is_firm_member, app.is_admin)에 조건을 넣어,
-- 이 헬퍼를 쓰는 RLS 정책(상담 요청·검수 의견·관리자 접근 기록)과 RPC(요청함·보험 맡김·집계)가 모두 따라간다.
-- 2단계 인증 전(aal1): 노무법인 요청함·맡김 목록은 비고, 처리·검수 의견 쓰기와 관리자 집계는 거절된다.
-- 사장님·직원 화면은 바뀌지 않는다.

create or replace function app.mfa_verified() returns boolean
language sql stable set search_path = '' as $$
  select coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2';
$$;
comment on function app.mfa_verified() is '이 요청의 로그인 세션이 2단계 인증(aal2)을 마쳤는지';
grant execute on function app.mfa_verified() to authenticated, service_role;

create or replace function app.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select app.mfa_verified() and exists (select 1 from public.admins a where a.user_id = (select auth.uid()));
$$;

create or replace function app.is_firm_member(f uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.mfa_verified() and exists (select 1 from public.firm_members m where m.firm_id = f and m.user_id = (select auth.uid()));
$$;

-- 보관 기간 정리에 관리자 화면 접근 기록 1년을 더한다 (개인정보 처리방침 2026-11-07 시행)
create or replace function public.run_retention() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_log integer;
  v_guest integer;
  v_admin integer;
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
  for v_e in select id from public.employees where resign_date is not null and resign_date < app.kst_today() - interval '3 years' loop
    delete from public.payroll_lines where employee_id = v_e.id;
    delete from public.statement_deliveries where employee_id = v_e.id;
    delete from public.payroll_edits where employee_id = v_e.id;
    delete from public.employees where id = v_e.id;
    v_emp := v_emp + 1;
  end loop;
  return jsonb_build_object('notificationLog', v_log, 'guestConsults', v_guest, 'adminAccessLog', v_admin, 'employees', v_emp, 'at', now());
end $$;
comment on function public.run_retention() is '보관 기간 정리: 알림 발송 기록 90일, 비회원 연락처 180일, 관리자 접근 기록 1년, 퇴사 3년 후 직원 데이터 (개인정보 처리방침 2026-11-07)';
