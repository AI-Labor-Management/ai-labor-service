-- 내부 헬퍼(app 스키마, PostgREST에 노출 안 됨) · 무결성 트리거 · 행 수준 보안(RLS)
-- 역할별 접근 범위: 19_데이터모델.md 5장
--   직원: 본인 것만 / 사장님: 자기 사업장 전체 / 노무법인: 사장님이 고른 항목만(사본) / 관리자: 집계만(개인 데이터 없음)

create schema if not exists app;
grant usage on schema app to anon, authenticated, service_role;

-- ───────────────────────── 헬퍼 ─────────────────────────
create or replace function app.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins a where a.user_id = (select auth.uid()));
$$;

create or replace function app.owns_workplace(wp uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.workplaces w where w.id = wp and w.owner_id = (select auth.uid()));
$$;

create or replace function app.is_my_employee(emp uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.employees e
    where e.id = emp and e.user_id = (select auth.uid()) and e.account_status = 'joined'
  );
$$;

create or replace function app.works_at(wp uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.employees e
    where e.workplace_id = wp and e.user_id = (select auth.uid()) and e.account_status = 'joined'
  );
$$;

create or replace function app.is_firm_member(f uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.firm_members m where m.firm_id = f and m.user_id = (select auth.uid()));
$$;

-- 연쇄 삭제(퇴사 3년 후 파기, 사업장 삭제)를 허용하는 세션 플래그
create or replace function app.purge_allowed() returns boolean
language sql stable set search_path = '' as $$
  select coalesce(current_setting('app.allow_purge', true), '') = 'on';
$$;

-- 클라이언트(PostgREST anon/authenticated)가 직접 쓰는 중인지. SECURITY DEFINER RPC 안에서는 false.
create or replace function app.is_direct_client() returns boolean
language sql stable set search_path = '' as $$
  select current_user in ('anon', 'authenticated');
$$;

create or replace function app.kst_today() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Seoul')::date;
$$;

grant execute on all functions in schema app to anon, authenticated, service_role;

-- ───────────────────────── 트리거 ─────────────────────────
create or replace function app.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger workplaces_updated before update on public.workplaces for each row execute function app.set_updated_at();
create trigger employees_updated before update on public.employees for each row execute function app.set_updated_at();
create trigger doc_records_updated before update on public.doc_records for each row execute function app.set_updated_at();
create trigger insurance_reports_updated before update on public.insurance_reports for each row execute function app.set_updated_at();

-- 직원이 속한 사업장과 행의 workplace_id가 같은지 (다른 사업장 직원 행을 끼워 넣지 못하게)
create or replace function app.check_employee_workplace() returns trigger
language plpgsql set search_path = '' as $$
declare v_wp uuid;
begin
  if new.employee_id is null then
    return new;
  end if;
  select e.workplace_id into v_wp from public.employees e where e.id = new.employee_id;
  if v_wp is null or v_wp <> new.workplace_id then
    raise exception '직원과 사업장이 맞지 않아요' using errcode = '23514';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'employee_foreign_info', 'work_conditions', 'condition_acks', 'invites', 'shift_overrides', 'attendance_records',
    'leave_requests', 'payroll_manual', 'payroll_lines', 'payroll_edits', 'statement_deliveries', 'insurance_reports',
    'insurance_notices', 'doc_records', 'doc_requests', 'notifications', 'offboarding_progress'
  ] loop
    execute format(
      'create trigger %I before insert or update on public.%I for each row execute function app.check_employee_workplace()',
      t || '_emp_wp', t
    );
  end loop;
end $$;

create or replace function app.check_substitution_workplace() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.employees e where e.id = new.from_employee_id and e.workplace_id = new.workplace_id)
     or (new.to_employee_id is not null and not exists (select 1 from public.employees e where e.id = new.to_employee_id and e.workplace_id = new.workplace_id)) then
    raise exception '대타 직원이 같은 사업장이 아니에요' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger substitutions_emp_wp before insert or update on public.substitutions for each row execute function app.check_substitution_workplace();

create or replace function app.check_edit_workplace() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.attendance_records r where r.id = new.record_id and r.workplace_id = new.workplace_id) then
    raise exception '출퇴근 기록과 사업장이 맞지 않아요' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger attendance_edits_wp before insert on public.attendance_edits for each row execute function app.check_edit_workplace();

create or replace function app.check_payroll_workplace() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.payroll_months p where p.id = new.payroll_id and p.workplace_id = new.workplace_id) then
    raise exception '급여월과 사업장이 맞지 않아요' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger payroll_manual_wp before insert or update on public.payroll_manual for each row execute function app.check_payroll_workplace();
create trigger payroll_lines_wp before insert on public.payroll_lines for each row execute function app.check_payroll_workplace();
create trigger payroll_edits_wp before insert on public.payroll_edits for each row execute function app.check_payroll_workplace();
create trigger statement_wp before insert on public.statement_deliveries for each row execute function app.check_payroll_workplace();

-- 직원: 계정 연결은 초대 수락(RPC)으로만, 사업장 이동 불가
create or replace function app.guard_employees() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.workplace_id <> old.workplace_id then
    raise exception '직원의 사업장은 바꿀 수 없어요';
  end if;
  if app.is_direct_client() then
    if new.user_id is distinct from old.user_id then
      raise exception '직원 계정 연결은 초대 링크로만 할 수 있어요';
    end if;
    if new.account_status is distinct from old.account_status and new.account_status <> 'blocked' then
      raise exception '직원 앱 상태는 초대·가입 흐름으로만 바뀌어요 (사장님은 로그인 차단만 가능)';
    end if;
  end if;
  return new;
end $$;
create trigger employees_guard before update on public.employees for each row execute function app.guard_employees();

-- 근로조건 이력: 수정하지 않고 새 행으로
create or replace function app.guard_work_conditions() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    raise exception '근로조건은 수정하지 않아요. 적용일을 정해 새 조건을 추가하세요 (지난 급여·계약서가 바뀌지 않게)';
  end if;
  if tg_op = 'DELETE' and not app.purge_allowed() and app.is_direct_client() then
    raise exception '근로조건 이력은 지울 수 없어요';
  end if;
  return coalesce(new, old);
end $$;
create trigger work_conditions_guard before update or delete on public.work_conditions for each row execute function app.guard_work_conditions();

-- 출퇴근 원래 기록: 한 번 남긴 시각은 덮어쓰지 않음
create or replace function app.guard_attendance() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if not app.purge_allowed() then
      raise exception '출퇴근 원래 기록은 지울 수 없어요 (수정은 이력으로 남겨요)';
    end if;
    return old;
  end if;
  if new.record_no <> old.record_no or new.employee_id <> old.employee_id or new.date <> old.date or new.workplace_id <> old.workplace_id then
    raise exception '기록 번호·직원·날짜는 바꿀 수 없어요';
  end if;
  if old.original_clock_in is not null and new.original_clock_in is distinct from old.original_clock_in then
    raise exception '원래 출근 기록은 바꿀 수 없어요. 시간 수정은 수정 이력(attendance_edits)으로 남기세요';
  end if;
  if old.original_clock_out is not null and new.original_clock_out is distinct from old.original_clock_out then
    raise exception '원래 퇴근 기록은 바꿀 수 없어요. 시간 수정은 수정 이력(attendance_edits)으로 남기세요';
  end if;
  return new;
end $$;
create trigger attendance_guard before update or delete on public.attendance_records for each row execute function app.guard_attendance();

-- 수정 이력: 직원 응답 칸만 채울 수 있음
create or replace function app.guard_attendance_edits() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if not app.purge_allowed() then
      raise exception '수정 이력은 지울 수 없어요';
    end if;
    return old;
  end if;
  if (new.record_id, new.before_in, new.before_out, new.after_in, new.after_out, new.reason, new.by_user, new.at)
     is distinct from (old.record_id, old.before_in, old.before_out, old.after_in, old.after_out, old.reason, old.by_user, old.at) then
    raise exception '수정 이력은 바꿀 수 없어요. 다시 고치려면 새 수정을 남기세요';
  end if;
  return new;
end $$;
create trigger attendance_edits_guard before update or delete on public.attendance_edits for each row execute function app.guard_attendance_edits();

-- 확정 급여 스냅샷·수정 이력: 덮어쓰지 않음
create or replace function app.guard_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' and app.purge_allowed() then
    return old;
  end if;
  raise exception '% 는 덮어쓰거나 지울 수 없어요 (이력으로 남겨요)', tg_table_name;
end $$;
create trigger payroll_lines_guard before update or delete on public.payroll_lines for each row execute function app.guard_immutable();
create trigger payroll_edits_guard before update or delete on public.payroll_edits for each row execute function app.guard_immutable();

-- 급여월: 확정은 API(서버)로만, 확정 후 직접 수정 불가
create or replace function app.guard_payroll_months() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'confirmed' and not app.purge_allowed() then
      raise exception '확정한 급여는 지울 수 없어요';
    end if;
    return old;
  end if;
  if app.is_direct_client() then
    if tg_op = 'INSERT' and new.status <> 'draft' then
      raise exception '급여 확정은 API(/payroll/confirm)로만 할 수 있어요';
    end if;
    if tg_op = 'UPDATE' and (
      new.status is distinct from old.status or new.revision is distinct from old.revision
      or new.confirmed_at is distinct from old.confirmed_at or new.confirmed_with_pending is distinct from old.confirmed_with_pending
      or (old.status = 'confirmed' and new.scale_confirmed is distinct from old.scale_confirmed)
    ) then
      raise exception '급여 확정·수정은 API로만 할 수 있어요 (확정분은 덮어쓰지 않아요)';
    end if;
  end if;
  return new;
end $$;
create trigger payroll_months_guard before insert or update or delete on public.payroll_months for each row execute function app.guard_payroll_months();

create or replace function app.guard_payroll_manual() returns trigger
language plpgsql set search_path = '' as $$
declare v_status text;
begin
  select p.status into v_status from public.payroll_months p where p.id = coalesce(new.payroll_id, old.payroll_id);
  if v_status = 'confirmed' and not app.purge_allowed() then
    raise exception '확정한 급여의 입력값은 바꿀 수 없어요. 확정 후 수정은 API로 이력을 남기세요';
  end if;
  return coalesce(new, old);
end $$;
create trigger payroll_manual_guard before insert or update or delete on public.payroll_manual for each row execute function app.guard_payroll_manual();

create or replace function app.guard_statements() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if not app.purge_allowed() then
      raise exception '명세서 교부 기록은 지울 수 없어요';
    end if;
    return old;
  end if;
  if (new.payroll_id, new.employee_id, new.revision, new.method, new.delivered_at)
     is distinct from (old.payroll_id, old.employee_id, old.revision, old.method, old.delivered_at) then
    raise exception '교부 기록은 바꿀 수 없어요';
  end if;
  if old.viewed_at is not null and new.viewed_at is distinct from old.viewed_at then
    raise exception '수령 확인 시각은 바꿀 수 없어요';
  end if;
  return new;
end $$;
create trigger statements_guard before update or delete on public.statement_deliveries for each row execute function app.guard_statements();

-- 알림: 클라이언트는 읽음 표시만
create or replace function app.guard_notifications() returns trigger
language plpgsql set search_path = '' as $$
begin
  if app.is_direct_client() and (new.workplace_id, new.recipient, new.employee_id, new.kind, new.text, new.link, new.created_at, new.kakao_status)
     is distinct from (old.workplace_id, old.recipient, old.employee_id, old.kind, old.text, old.link, old.created_at, old.kakao_status) then
    raise exception '알림은 읽음 표시만 바꿀 수 있어요';
  end if;
  return new;
end $$;
create trigger notifications_guard before update on public.notifications for each row execute function app.guard_notifications();

-- 가입 시 프로필 생성
create or replace function app.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'name', ''), 40))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function app.handle_new_user();

-- ───────────────────────── RLS ─────────────────────────
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- 계정
create policy profiles_self_select on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_self_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy firms_visible on public.firms for select to authenticated using (display_public or app.is_firm_member(id) or app.is_admin());
create policy firm_members_self on public.firm_members for select to authenticated using (user_id = (select auth.uid()) or app.is_admin());
create policy admins_self on public.admins for select to authenticated using (user_id = (select auth.uid()));

-- 사업장 (직원은 직접 조회 불가 — employee_context() RPC로 상호·설정만)
create policy workplaces_owner_select on public.workplaces for select to authenticated using (owner_id = (select auth.uid()));
create policy workplaces_owner_insert on public.workplaces for insert to authenticated with check (owner_id = (select auth.uid()));
create policy workplaces_owner_update on public.workplaces for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- 사장님만 쓰는 테이블 (전체 권한)
do $$
declare t text;
begin
  foreach t in array array['busy_days', 'custom_forms', 'deadline_actions', 'doc_records', 'doc_requests', 'risk_answers', 'offboarding_progress', 'insurance_notices', 'insurance_reports', 'payroll_manual'] loop
    execute format(
      'create policy %I on public.%I for all to authenticated using (app.owns_workplace(workplace_id)) with check (app.owns_workplace(workplace_id))',
      t || '_owner_all', t
    );
  end loop;
end $$;

-- 직원
create policy employees_owner_select on public.employees for select to authenticated using (app.owns_workplace(workplace_id));
create policy employees_owner_insert on public.employees for insert to authenticated with check (app.owns_workplace(workplace_id) and user_id is null and account_status = 'none');
create policy employees_owner_update on public.employees for update to authenticated using (app.owns_workplace(workplace_id)) with check (app.owns_workplace(workplace_id));
create policy employees_self_select on public.employees for select to authenticated using (user_id = (select auth.uid()) and account_status = 'joined');

create policy foreign_owner_all on public.employee_foreign_info for all to authenticated using (app.owns_workplace(workplace_id)) with check (app.owns_workplace(workplace_id));
create policy foreign_self_select on public.employee_foreign_info for select to authenticated using (app.is_my_employee(employee_id));

create policy conditions_owner_select on public.work_conditions for select to authenticated using (app.owns_workplace(workplace_id));
create policy conditions_owner_insert on public.work_conditions for insert to authenticated with check (app.owns_workplace(workplace_id));
create policy conditions_self_select on public.work_conditions for select to authenticated using (app.is_my_employee(employee_id));

create policy acks_owner_select on public.condition_acks for select to authenticated using (app.owns_workplace(workplace_id));
create policy acks_owner_update on public.condition_acks for update to authenticated using (app.owns_workplace(workplace_id)) with check (app.owns_workplace(workplace_id));
create policy acks_self_select on public.condition_acks for select to authenticated using (app.is_my_employee(employee_id));

create policy invites_owner_select on public.invites for select to authenticated using (app.owns_workplace(workplace_id));

-- 근무
create policy overrides_owner_all on public.shift_overrides for all to authenticated using (app.owns_workplace(workplace_id)) with check (app.owns_workplace(workplace_id));
create policy overrides_self_select on public.shift_overrides for select to authenticated using (app.is_my_employee(employee_id));

create policy subs_owner_all on public.substitutions for all to authenticated using (app.owns_workplace(workplace_id)) with check (app.owns_workplace(workplace_id));
create policy subs_employee_select on public.substitutions for select to authenticated using (
  app.is_my_employee(from_employee_id) or app.is_my_employee(to_employee_id)
  or (mode = 'request' and status = 'open' and app.works_at(workplace_id))
);

create policy attendance_owner_select on public.attendance_records for select to authenticated using (app.owns_workplace(workplace_id));
create policy attendance_owner_insert on public.attendance_records for insert to authenticated with check (app.owns_workplace(workplace_id) and source = 'owner');
create policy attendance_owner_update on public.attendance_records for update to authenticated using (app.owns_workplace(workplace_id)) with check (app.owns_workplace(workplace_id));
create policy attendance_self_select on public.attendance_records for select to authenticated using (app.is_my_employee(employee_id));

create policy edits_owner_select on public.attendance_edits for select to authenticated using (app.owns_workplace(workplace_id));
create policy edits_owner_insert on public.attendance_edits for insert to authenticated with check (app.owns_workplace(workplace_id) and by_user = (select auth.uid()));
create policy edits_self_select on public.attendance_edits for select to authenticated using (
  exists (select 1 from public.attendance_records r where r.id = attendance_edits.record_id and app.is_my_employee(r.employee_id))
);

create policy leave_owner_select on public.leave_requests for select to authenticated using (app.owns_workplace(workplace_id));
create policy leave_owner_insert on public.leave_requests for insert to authenticated with check (app.owns_workplace(workplace_id) and requested_by = 'owner');
create policy leave_owner_update on public.leave_requests for update to authenticated using (app.owns_workplace(workplace_id)) with check (app.owns_workplace(workplace_id));
create policy leave_self_select on public.leave_requests for select to authenticated using (app.is_my_employee(employee_id));

-- 급여
create policy payroll_owner_select on public.payroll_months for select to authenticated using (app.owns_workplace(workplace_id));
create policy payroll_owner_insert on public.payroll_months for insert to authenticated with check (app.owns_workplace(workplace_id));
create policy payroll_owner_update on public.payroll_months for update to authenticated using (app.owns_workplace(workplace_id)) with check (app.owns_workplace(workplace_id));
create policy payroll_self_select on public.payroll_months for select to authenticated using (
  exists (select 1 from public.statement_deliveries s where s.payroll_id = payroll_months.id and app.is_my_employee(s.employee_id))
);
create policy lines_owner_select on public.payroll_lines for select to authenticated using (app.owns_workplace(workplace_id));
create policy lines_self_select on public.payroll_lines for select to authenticated using (app.is_my_employee(employee_id));
create policy pedits_owner_select on public.payroll_edits for select to authenticated using (app.owns_workplace(workplace_id));
create policy statements_owner_select on public.statement_deliveries for select to authenticated using (app.owns_workplace(workplace_id));
create policy statements_self_select on public.statement_deliveries for select to authenticated using (app.is_my_employee(employee_id));

-- 알림
create policy notifications_owner on public.notifications for select to authenticated using (recipient = 'owner' and app.owns_workplace(workplace_id));
create policy notifications_owner_read on public.notifications for update to authenticated using (recipient = 'owner' and app.owns_workplace(workplace_id)) with check (recipient = 'owner' and app.owns_workplace(workplace_id));
create policy notifications_self on public.notifications for select to authenticated using (recipient = 'employee' and app.is_my_employee(employee_id));
create policy notifications_self_read on public.notifications for update to authenticated using (recipient = 'employee' and app.is_my_employee(employee_id)) with check (recipient = 'employee' and app.is_my_employee(employee_id));
create policy notification_log_owner on public.notification_log for select to authenticated using (app.owns_workplace(workplace_id));

-- 상담 (노무법인은 철회되지 않은 요청의 사본만)
create policy consult_owner_select on public.consult_requests for select to authenticated using (app.owns_workplace(workplace_id));
create policy consult_firm_select on public.consult_requests for select to authenticated using (revoked_at is null and app.is_firm_member(firm_id));
create policy review_firm_select on public.review_comments for select to authenticated using (app.is_firm_member(firm_id) or app.is_admin());
create policy review_firm_insert on public.review_comments for insert to authenticated with check (app.is_firm_member(firm_id) and author_id = (select auth.uid()));

-- 운영
create policy admin_log_select on public.admin_access_log for select to authenticated using (app.is_admin());
-- guest_consults: 정책 없음 → 직접 접근 불가 (submit_guest_consult / firm_guest_consults RPC로만)
