-- 프론트엔드 연결용 보완
-- 1) 사장님 화면이 직접 쓰는 일(일정 변경·대타 지정 등)에서 직원·사장님 앱 안 알림을 남길 수 있게 한다.
--    자기 사업장에만, 읽지 않은 상태로, 카카오는 'not-connected'로만 (보냈다고 표시하지 못함).
--    직원 행이 같은 사업장인지는 check_employee_workplace 트리거가 확인한다.
create policy notifications_insert_owner on public.notifications for insert to authenticated
  with check (app.owns_workplace(workplace_id) and read_at is null and kakao_status = 'not-connected');

-- 2) 화면에서 바로 만든 사업장도 협력 노무법인(기본 1곳)과 연결해 상담·맡김 건이 요청함에 보이게 한다.
create or replace function app.default_partner_firm() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.partner_firm_id is null then
    select f.id into new.partner_firm_id from public.firms f order by f.created_at limit 1;
  end if;
  return new;
end $$;
revoke execute on function app.default_partner_firm() from public, anon, authenticated;
create trigger workplaces_default_firm before insert on public.workplaces for each row execute function app.default_partner_firm();
