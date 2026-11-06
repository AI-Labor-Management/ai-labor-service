-- 역할별 접근 범위·무결성 트리거 검사 (19_데이터모델 5장)
-- 실행: SQL 편집기(또는 MCP execute_sql)에서 이 파일 전체를 실행한다.
-- 테스트용 사용자·데이터를 만들고 역할을 바꿔 가며 확인한 뒤, 마지막에 일부러 예외를 내서 모두 되돌린다.
--   성공: ERROR  RLS_TESTS_PASSED (N checks)   ← 데이터는 남지 않음
--   실패: ERROR  FAIL: <무엇이 틀렸는지>
do $$
declare
  owner_a uuid := gen_random_uuid();
  owner_b uuid := gen_random_uuid();
  emp_user uuid := gen_random_uuid();
  firm_user uuid := gen_random_uuid();
  admin_user uuid := gen_random_uuid();
  stranger uuid := gen_random_uuid();
  wp_a uuid; wp_b uuid; e_a1 uuid; e_a2 uuid; e_b1 uuid; firm uuid; c_a1 uuid; rec_a1 uuid; pm_a uuid;
  n int; checks int := 0; v jsonb; tok text; failed boolean;
begin
  -- ── 준비 (postgres 권한) ──
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-' || left(u::text, 8) || '@example.test', '{}', '{}', now(), now()
  from unnest(array[owner_a, owner_b, emp_user, firm_user, admin_user, stranger]) as u;

  insert into public.workplaces (owner_id, name, industry, scale, firm_insurance_share_consent) values (owner_a, 'A 가게', 'food', '1-4', true) returning id into wp_a;
  insert into public.workplaces (owner_id, name, industry, scale) values (owner_b, 'B 가게', 'retail', '5-9') returning id into wp_b;
  select id into firm from public.firms order by created_at limit 1;
  update public.workplaces set partner_firm_id = firm where id = wp_a;
  insert into public.firm_members (firm_id, user_id) values (firm, firm_user);
  insert into public.admins (user_id) values (admin_user);

  insert into public.employees (workplace_id, user_id, alias, age_band, hire_date, employment_type, insurance_method, account_status)
    values (wp_a, emp_user, '직원 A1', '18-59', '2026-09-01', 'regular', 'delegated', 'joined') returning id into e_a1;
  insert into public.employees (workplace_id, alias, age_band, hire_date, employment_type, insurance_method)
    values (wp_a, '직원 A2', '18-59', '2026-09-01', 'regular', 'self') returning id into e_a2;
  insert into public.employees (workplace_id, alias, age_band, hire_date, employment_type, insurance_method)
    values (wp_b, '직원 B1', '18-59', '2026-09-01', 'regular', 'self') returning id into e_b1;
  insert into public.work_conditions (workplace_id, employee_id, effective_from, hourly_wage, schedule)
    values (wp_a, e_a1, '2026-09-01', 10320, '[{"start":"10:00","end":"15:00","breakMin":30},null,null,null,null,null,null]') returning id into c_a1;
  insert into public.work_conditions (workplace_id, employee_id, effective_from, hourly_wage) values (wp_a, e_a2, '2026-09-01', 11000);
  insert into public.work_conditions (workplace_id, employee_id, effective_from, hourly_wage) values (wp_b, e_b1, '2026-09-01', 12000);
  insert into public.attendance_records (workplace_id, employee_id, record_no, date, original_clock_in, original_clock_out, source, status)
    values (wp_a, e_a1, 'R-T-1', '2026-11-02', '10:00', '15:00', 'gps-demo', 'confirmed') returning id into rec_a1;
  insert into public.attendance_records (workplace_id, employee_id, record_no, date, original_clock_in, source, status)
    values (wp_a, e_a2, 'R-T-2', '2026-11-02', '10:00', 'owner', 'pending');
  insert into public.payroll_months (workplace_id, month, status, revision) values (wp_a, '2026-10', 'confirmed', 1) returning id into pm_a;
  insert into public.payroll_lines (payroll_id, workplace_id, employee_id, line, gross, deduction_total, net, net_complete)
    values (pm_a, wp_a, e_a1, '{}', 100, 0, 100, true), (pm_a, wp_a, e_a2, '{}', 200, 0, 200, true);
  insert into public.statement_deliveries (payroll_id, workplace_id, employee_id, revision, method) values (pm_a, wp_a, e_a1, 1, 'app'), (pm_a, wp_a, e_a2, 1, 'print');
  insert into public.notifications (workplace_id, recipient, kind, text) values (wp_a, 'owner', 't', '사장님 알림');
  insert into public.notifications (workplace_id, recipient, employee_id, kind, text) values (wp_a, 'employee', e_a1, 't', 'A1 알림'), (wp_a, 'employee', e_a2, 't', 'A2 알림');
  insert into public.consult_requests (workplace_id, firm_id, topic, question, memo, share_items, snapshot, consent_at)
    values (wp_a, firm, '해고·징계', '공유한 질문', '메모', array['memo', 'workplace'], '{"workplace":{"industry":"food","scale":"1-4"}}', now());
  insert into public.consult_requests (workplace_id, firm_id, topic, question, memo, share_items, snapshot, consent_at, revoked_at, status)
    values (wp_a, firm, '기타', '철회한 질문', '', array['memo'], null, now(), now(), 'revoked');

  -- ── 사장님 B: 다른 사업장은 안 보이고 못 바꾼다 ──
  perform set_config('request.jwt.claims', json_build_object('sub', owner_b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.employees where workplace_id = wp_a; if n <> 0 then raise exception 'FAIL: 사장님 B가 A 직원을 봄 (%)', n; end if; checks := checks + 1;
  select count(*) into n from public.work_conditions where workplace_id = wp_a; if n <> 0 then raise exception 'FAIL: 사장님 B가 A 근로조건을 봄'; end if; checks := checks + 1;
  select count(*) into n from public.attendance_records where workplace_id = wp_a; if n <> 0 then raise exception 'FAIL: 사장님 B가 A 출퇴근을 봄'; end if; checks := checks + 1;
  select count(*) into n from public.payroll_lines; if n <> 0 then raise exception 'FAIL: 사장님 B가 A 급여를 봄'; end if; checks := checks + 1;
  select count(*) into n from public.employees; if n <> 1 then raise exception 'FAIL: 사장님 B는 자기 직원 1명만 봐야 함 (%)', n; end if; checks := checks + 1;
  update public.workplaces set name = 'hack' where id = wp_a; get diagnostics n = row_count; if n <> 0 then raise exception 'FAIL: 사장님 B가 A 사업장을 고침'; end if; checks := checks + 1;
  failed := false;
  begin
    insert into public.employees (workplace_id, alias, age_band, hire_date, employment_type, insurance_method) values (wp_a, '침입', '18-59', '2026-11-01', 'regular', 'self');
  exception when others then failed := true;
  end;
  if not failed then raise exception 'FAIL: 사장님 B가 A 사업장에 직원을 넣음'; end if; checks := checks + 1;

  -- ── 사장님 A: 무결성 트리거 ──
  perform set_config('request.jwt.claims', json_build_object('sub', owner_a, 'role', 'authenticated')::text, true);
  select count(*) into n from public.employees; if n <> 2 then raise exception 'FAIL: 사장님 A는 직원 2명을 봐야 함 (%)', n; end if; checks := checks + 1;
  -- 수정 정책이 없는 표는 RLS가 0행으로 막는다
  update public.work_conditions set hourly_wage = 9000 where id = c_a1; get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: 근로조건을 덮어씀'; end if; checks := checks + 1;
  failed := false;
  begin update public.attendance_records set original_clock_in = '09:00' where id = rec_a1; exception when others then failed := true; end;
  if not failed then raise exception 'FAIL: 출퇴근 원래 기록을 덮어씀'; end if; checks := checks + 1;
  update public.payroll_lines set gross = 1 where employee_id = e_a1; get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: 확정 급여 스냅샷을 덮어씀'; end if; checks := checks + 1;
  failed := false;
  begin update public.payroll_months set status = 'draft' where id = pm_a; exception when others then failed := true; end;
  if not failed then raise exception 'FAIL: 클라이언트가 확정 상태를 바꿈'; end if; checks := checks + 1;
  failed := false;
  begin update public.employees set user_id = owner_a where id = e_a2; exception when others then failed := true; end;
  if not failed then raise exception 'FAIL: 사장님이 직원 계정을 직접 연결함'; end if; checks := checks + 1;
  failed := false;
  begin insert into public.shift_overrides (workplace_id, employee_id, date, kind) values (wp_a, e_b1, '2026-11-03', 'absent'); exception when others then failed := true; end;
  if not failed then raise exception 'FAIL: 다른 사업장 직원 행을 끼워 넣음'; end if; checks := checks + 1;
  insert into public.attendance_edits (workplace_id, record_id, before_in, before_out, after_in, after_out, reason, by_user)
    values (wp_a, rec_a1, '10:00', '15:00', '10:00', '15:10', '테스트 수정', owner_a);
  select count(*) into n from public.attendance_edits where record_id = rec_a1; if n <> 1 then raise exception 'FAIL: 수정 이력을 남기지 못함'; end if; checks := checks + 1;
  v := public.create_invite(e_a2); tok := v ->> 'token';
  if tok is null or length(tok) < 30 then raise exception 'FAIL: 초대 토큰이 없음'; end if; checks := checks + 1;
  select count(*) into n from public.invites where token_hash = tok; if n <> 0 then raise exception 'FAIL: 토큰 원문이 저장됨'; end if; checks := checks + 1;

  -- ── 직원(A1 계정): 본인 것만 ──
  perform set_config('request.jwt.claims', json_build_object('sub', emp_user, 'role', 'authenticated')::text, true);
  select count(*) into n from public.employees; if n <> 1 then raise exception 'FAIL: 직원이 다른 직원을 봄 (%)', n; end if; checks := checks + 1;
  select count(*) into n from public.workplaces; if n <> 0 then raise exception 'FAIL: 직원이 사업장 행을 직접 봄'; end if; checks := checks + 1;
  select count(*) into n from public.work_conditions; if n <> 1 then raise exception 'FAIL: 직원이 다른 직원 근로조건을 봄 (%)', n; end if; checks := checks + 1;
  select count(*) into n from public.attendance_records; if n <> 1 then raise exception 'FAIL: 직원이 다른 직원 출퇴근을 봄 (%)', n; end if; checks := checks + 1;
  select count(*) into n from public.payroll_lines; if n <> 1 then raise exception 'FAIL: 직원이 다른 직원 급여를 봄 (%)', n; end if; checks := checks + 1;
  select count(*) into n from public.notifications; if n <> 1 then raise exception 'FAIL: 직원이 남의 알림을 봄 (%)', n; end if; checks := checks + 1;
  select count(*) into n from public.attendance_edits; if n <> 1 then raise exception 'FAIL: 직원이 자기 기록의 수정 이력을 못 봄'; end if; checks := checks + 1;
  select count(*) into n from public.consult_requests; if n <> 0 then raise exception 'FAIL: 직원이 상담 요청을 봄'; end if; checks := checks + 1;
  v := public.employee_context(); if jsonb_array_length(v) <> 1 or v -> 0 ->> 'workplaceName' <> 'A 가게' then raise exception 'FAIL: employee_context %', v; end if; checks := checks + 1;
  update public.employees set alias = 'hack' where id = e_a1; get diagnostics n = row_count; if n <> 0 then raise exception 'FAIL: 직원이 자기 직원 행을 고침'; end if; checks := checks + 1;
  failed := false;
  begin
    insert into public.attendance_records (workplace_id, employee_id, record_no, date, original_clock_in, source, status) values (wp_a, e_a1, 'R-HACK', '2026-11-03', '10:00', 'gps-demo', 'confirmed');
  exception when others then failed := true;
  end;
  if not failed then raise exception 'FAIL: 직원이 출퇴근 확정 기록을 직접 넣음'; end if; checks := checks + 1;
  perform public.mark_statement_viewed((select id from public.statement_deliveries where employee_id = e_a1));
  failed := false;
  begin perform public.mark_statement_viewed((select s.id from public.statement_deliveries s where s.employee_id = e_a2)); exception when others then failed := true; end;
  if not failed then raise exception 'FAIL: 직원이 남의 명세서 수령 확인을 남김'; end if; checks := checks + 1;

  -- ── 노무법인: 고른 항목만, 철회하면 내용 없음 ──
  perform set_config('request.jwt.claims', json_build_object('sub', firm_user, 'role', 'authenticated')::text, true);
  select count(*) into n from public.consult_requests; if n <> 1 then raise exception 'FAIL: 노무법인이 철회된 요청 내용을 봄 (%)', n; end if; checks := checks + 1;
  v := public.firm_consult_inbox();
  if jsonb_array_length(v) <> 2 then raise exception 'FAIL: 요청함 개수 %', jsonb_array_length(v); end if; checks := checks + 1;
  if not exists (select 1 from jsonb_array_elements(v) x where x ->> 'status' = 'revoked' and x ->> 'question' = '(공유 철회됨)' and x -> 'snapshot' = 'null'::jsonb) then raise exception 'FAIL: 철회 요청이 가려지지 않음'; end if; checks := checks + 1;
  select count(*) into n from public.employees; if n <> 0 then raise exception 'FAIL: 노무법인이 직원 표를 봄'; end if; checks := checks + 1;
  select count(*) into n from public.payroll_lines; if n <> 0 then raise exception 'FAIL: 노무법인이 급여를 봄'; end if; checks := checks + 1;
  select count(*) into n from public.guest_consults; if n <> 0 then raise exception 'FAIL: 노무법인이 비회원 표를 직접 봄'; end if; checks := checks + 1;
  v := public.firm_delegated_insurance(); if jsonb_array_length(v) <> 1 or v -> 0 ->> 'alias' <> '직원 A1' then raise exception 'FAIL: 맡김 건 목록 %', v; end if; checks := checks + 1;
  perform public.firm_mark_insurance_done(e_a1, 'acquisition');
  failed := false;
  begin perform public.firm_mark_insurance_done(e_a2, 'acquisition'); exception when others then failed := true; end;
  if not failed then raise exception 'FAIL: 맡기지 않은 직원 보험을 노무법인이 처리함'; end if; checks := checks + 1;

  -- ── 관리자: 집계만 ──
  perform set_config('request.jwt.claims', json_build_object('sub', admin_user, 'role', 'authenticated')::text, true);
  v := public.admin_stats(); if (v ->> 'workplaces')::int < 2 then raise exception 'FAIL: admin_stats %', v; end if; checks := checks + 1;
  select count(*) into n from public.employees; if n <> 0 then raise exception 'FAIL: 관리자가 직원 개인 데이터를 봄'; end if; checks := checks + 1;
  select count(*) into n from public.workplaces; if n <> 0 then raise exception 'FAIL: 관리자가 사업장 행을 봄'; end if; checks := checks + 1;

  -- ── 관계없는 사용자: 초대 수락만 가능, 집계 불가 ──
  perform set_config('request.jwt.claims', json_build_object('sub', stranger, 'role', 'authenticated')::text, true);
  failed := false;
  begin v := public.admin_stats(); exception when others then failed := true; end;
  if not failed then raise exception 'FAIL: 일반 사용자가 관리자 집계를 봄'; end if; checks := checks + 1;
  if public.accept_invite(tok) <> e_a2 then raise exception 'FAIL: 초대 수락'; end if; checks := checks + 1;
  select count(*) into n from public.employees; if n <> 1 then raise exception 'FAIL: 초대 수락 후 본인 직원 행 (%)', n; end if; checks := checks + 1;
  failed := false;
  begin perform public.accept_invite(tok); exception when others then failed := true; end;
  if not failed then raise exception 'FAIL: 초대 링크를 두 번 씀'; end if; checks := checks + 1;

  -- ── 비로그인(anon): 표 접근 불가, 비회원 상담 RPC만 ──
  -- ── 서버(RLS 우회) 권한이어도 트리거가 이력을 지킨다 ──
  execute 'reset role';
  failed := false;
  begin update public.work_conditions set hourly_wage = 9000 where id = c_a1; exception when others then failed := true; end;
  if not failed then raise exception 'FAIL: 서버 권한으로 근로조건을 덮어씀'; end if; checks := checks + 1;
  failed := false;
  begin update public.payroll_lines set gross = 1 where employee_id = e_a1; exception when others then failed := true; end;
  if not failed then raise exception 'FAIL: 서버 권한으로 확정 급여를 덮어씀'; end if; checks := checks + 1;
  failed := false;
  begin delete from public.attendance_records where id = rec_a1; exception when others then failed := true; end;
  if not failed then raise exception 'FAIL: 서버 권한으로 출퇴근 원본을 지움'; end if; checks := checks + 1;

  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
  failed := false;
  begin select count(*) into n from public.employees; exception when others then failed := true; end;
  if not failed then raise exception 'FAIL: 비로그인이 직원 표를 읽음'; end if; checks := checks + 1;
  v := public.submit_guest_consult('테스트', '010-0000-0000', '오후', '기타', '', true, true, '');
  if v ->> 'mode' <> 'demo' then raise exception 'FAIL: 접수 스위치가 꺼져 있으면 저장하지 않아야 함 %', v; end if; checks := checks + 1;
  execute 'reset role';

  raise exception 'RLS_TESTS_PASSED (% checks)', checks;
end $$;
