-- 성능 어드바이저 반영: 외래키 인덱스 추가, 같은 동작에 겹치는 허용 정책을 하나로 합침 (접근 범위는 그대로)

create index condition_acks_wp_idx on public.condition_acks (workplace_id);
create index insurance_notices_wp_idx on public.insurance_notices (workplace_id);
create index invites_wp_idx on public.invites (workplace_id);
create index payroll_edits_wp_idx on public.payroll_edits (workplace_id);
create index payroll_manual_wp_idx on public.payroll_manual (workplace_id);

-- 조회: 사장님(자기 사업장) 또는 직원(본인 것)
drop policy attendance_owner_select on public.attendance_records;
drop policy attendance_self_select on public.attendance_records;
create policy attendance_select on public.attendance_records for select to authenticated
  using (app.owns_workplace(workplace_id) or app.is_my_employee(employee_id));

drop policy edits_owner_select on public.attendance_edits;
drop policy edits_self_select on public.attendance_edits;
create policy edits_select on public.attendance_edits for select to authenticated
  using (app.owns_workplace(workplace_id) or exists (
    select 1 from public.attendance_records r where r.id = attendance_edits.record_id and app.is_my_employee(r.employee_id)
  ));

drop policy acks_owner_select on public.condition_acks;
drop policy acks_self_select on public.condition_acks;
create policy acks_select on public.condition_acks for select to authenticated
  using (app.owns_workplace(workplace_id) or app.is_my_employee(employee_id));

drop policy consult_owner_select on public.consult_requests;
drop policy consult_firm_select on public.consult_requests;
create policy consult_select on public.consult_requests for select to authenticated
  using (app.owns_workplace(workplace_id) or (revoked_at is null and app.is_firm_member(firm_id)));

drop policy employees_owner_select on public.employees;
drop policy employees_self_select on public.employees;
create policy employees_select on public.employees for select to authenticated
  using (app.owns_workplace(workplace_id) or (user_id = (select auth.uid()) and account_status = 'joined'));

drop policy leave_owner_select on public.leave_requests;
drop policy leave_self_select on public.leave_requests;
create policy leave_select on public.leave_requests for select to authenticated
  using (app.owns_workplace(workplace_id) or app.is_my_employee(employee_id));

drop policy lines_owner_select on public.payroll_lines;
drop policy lines_self_select on public.payroll_lines;
create policy lines_select on public.payroll_lines for select to authenticated
  using (app.owns_workplace(workplace_id) or app.is_my_employee(employee_id));

drop policy payroll_owner_select on public.payroll_months;
drop policy payroll_self_select on public.payroll_months;
create policy payroll_select on public.payroll_months for select to authenticated
  using (app.owns_workplace(workplace_id) or exists (
    select 1 from public.statement_deliveries s where s.payroll_id = payroll_months.id and app.is_my_employee(s.employee_id)
  ));

drop policy statements_owner_select on public.statement_deliveries;
drop policy statements_self_select on public.statement_deliveries;
create policy statements_select on public.statement_deliveries for select to authenticated
  using (app.owns_workplace(workplace_id) or app.is_my_employee(employee_id));

drop policy conditions_owner_select on public.work_conditions;
drop policy conditions_self_select on public.work_conditions;
create policy conditions_select on public.work_conditions for select to authenticated
  using (app.owns_workplace(workplace_id) or app.is_my_employee(employee_id));

drop policy notifications_owner on public.notifications;
drop policy notifications_self on public.notifications;
drop policy notifications_owner_read on public.notifications;
drop policy notifications_self_read on public.notifications;
create policy notifications_select on public.notifications for select to authenticated
  using ((recipient = 'owner' and app.owns_workplace(workplace_id)) or (recipient = 'employee' and app.is_my_employee(employee_id)));
create policy notifications_mark_read on public.notifications for update to authenticated
  using ((recipient = 'owner' and app.owns_workplace(workplace_id)) or (recipient = 'employee' and app.is_my_employee(employee_id)))
  with check ((recipient = 'owner' and app.owns_workplace(workplace_id)) or (recipient = 'employee' and app.is_my_employee(employee_id)));

-- "for all" 사장님 정책을 쓰기 정책으로 나누고 조회는 하나로
drop policy foreign_owner_all on public.employee_foreign_info;
drop policy foreign_self_select on public.employee_foreign_info;
create policy foreign_select on public.employee_foreign_info for select to authenticated
  using (app.owns_workplace(workplace_id) or app.is_my_employee(employee_id));
create policy foreign_owner_insert on public.employee_foreign_info for insert to authenticated with check (app.owns_workplace(workplace_id));
create policy foreign_owner_update on public.employee_foreign_info for update to authenticated using (app.owns_workplace(workplace_id)) with check (app.owns_workplace(workplace_id));
create policy foreign_owner_delete on public.employee_foreign_info for delete to authenticated using (app.owns_workplace(workplace_id));

drop policy overrides_owner_all on public.shift_overrides;
drop policy overrides_self_select on public.shift_overrides;
create policy overrides_select on public.shift_overrides for select to authenticated
  using (app.owns_workplace(workplace_id) or app.is_my_employee(employee_id));
create policy overrides_owner_insert on public.shift_overrides for insert to authenticated with check (app.owns_workplace(workplace_id));
create policy overrides_owner_update on public.shift_overrides for update to authenticated using (app.owns_workplace(workplace_id)) with check (app.owns_workplace(workplace_id));
create policy overrides_owner_delete on public.shift_overrides for delete to authenticated using (app.owns_workplace(workplace_id));

drop policy subs_owner_all on public.substitutions;
drop policy subs_employee_select on public.substitutions;
create policy subs_select on public.substitutions for select to authenticated
  using (
    app.owns_workplace(workplace_id)
    or app.is_my_employee(from_employee_id) or app.is_my_employee(to_employee_id)
    or (mode = 'request' and status = 'open' and app.works_at(workplace_id))
  );
create policy subs_owner_insert on public.substitutions for insert to authenticated with check (app.owns_workplace(workplace_id));
create policy subs_owner_update on public.substitutions for update to authenticated using (app.owns_workplace(workplace_id)) with check (app.owns_workplace(workplace_id));
create policy subs_owner_delete on public.substitutions for delete to authenticated using (app.owns_workplace(workplace_id));
