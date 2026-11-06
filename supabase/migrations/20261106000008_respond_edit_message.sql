-- respond_attendance_edit: 잘못된 상태 값과 사유 누락을 다른 메시지로 알려 준다 (E2E 시험에서 발견)
create or replace function public.respond_attendance_edit(p_edit_id uuid, p_status text, p_memo text default '') returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_edit public.attendance_edits;
  v_rec public.attendance_records;
  v_emp public.employees;
begin
  select * into v_edit from public.attendance_edits where id = p_edit_id;
  select * into v_rec from public.attendance_records where id = v_edit.record_id;
  if v_rec.id is null then
    raise exception '수정 기록을 찾을 수 없어요';
  end if;
  v_emp := app.my_joined_employee(v_rec.employee_id);
  if v_edit.employee_response_status is not null then
    raise exception '이미 응답했어요';
  end if;
  if p_status is null or p_status not in ('confirmed', 'disputed') then
    raise exception 'p_status는 confirmed(확인했어요) 또는 disputed(다른 점이 있어요)여야 해요';
  end if;
  if p_status = 'disputed' and char_length(btrim(coalesce(p_memo, ''))) = 0 then
    raise exception '"다른 점이 있어요"는 한 줄 사유가 필요해요';
  end if;
  update public.attendance_edits
  set employee_response_status = p_status, employee_response_memo = coalesce(p_memo, ''), employee_response_at = now()
  where id = v_edit.id;
  if p_status = 'disputed' then
    perform app.push_notification(v_rec.workplace_id, 'owner', null, 'attendanceDispute',
      v_emp.alias || ' ' || to_char(v_rec.date, 'MM.DD') || ' 출퇴근 수정에 "다른 점이 있어요": ' || p_memo,
      '/owner/work?tab=attendance&record=' || v_rec.id);
  end if;
end $$;
