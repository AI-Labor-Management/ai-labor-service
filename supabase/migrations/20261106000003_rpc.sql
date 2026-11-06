-- RPC (PostgREST /rest/v1/rpc/*) — 권한 확인을 함수 안에서 하고 SECURITY DEFINER로 실행한다.
-- 서버 계산이 필요한 일(급여 확정, 출퇴근 판정, 상담 사본 만들기, 기한 계산)은 Edge Function `api`가 맡는다.

-- ───────────────────────── 설정·비밀 ─────────────────────────
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  note text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon;
create policy app_settings_read on public.app_settings for select to authenticated using (true);
comment on table public.app_settings is '기능 스위치. 값 변경은 서버(서비스 역할)·SQL로만';

insert into public.app_settings (key, value, note) values
  ('guest_consult_intake', 'false', '비회원 상담 실제 접수. 처리방침·보유 기간 확정(노무사 확인 C16) 전까지 false → 검증만 하고 저장하지 않음'),
  ('kakao_enabled', 'false', '카카오 나에게 보내기 연결 여부 (연결 대기)'),
  ('ai_enabled', 'false', 'AI 상담 연결 여부 (제공사 미정)')
on conflict (key) do nothing;

-- 기본 협력 노무법인 (이름은 협약 후 표시)
insert into public.firms (name, display_public)
select '협력 노무법인 (협약 후 표시)', false
where not exists (select 1 from public.firms);

-- 비밀 값은 DB 안에서 만들고 밖으로 내보내지 않는다 (저장소·로그에 남지 않음)
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'guest_phone_key') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'guest_phone_key', '비회원 상담 번호 암호화·HMAC 키');
  end if;
  if not exists (select 1 from vault.secrets where name = 'cron_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'cron_secret', 'cron-daily 함수 호출 검증 값');
  end if;
end $$;

create or replace function app.setting_on(p_key text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select s.value = 'true'::jsonb from public.app_settings s where s.key = p_key), false);
$$;

-- ───────────────────────── 내부 공통 ─────────────────────────
create or replace function app.push_notification(p_wp uuid, p_recipient text, p_employee uuid, p_kind text, p_text text, p_link text)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (workplace_id, recipient, employee_id, kind, text, link)
  values (p_wp, p_recipient, p_employee, p_kind, p_text, coalesce(p_link, ''));
$$;
revoke execute on function app.push_notification(uuid, text, uuid, text, text, text) from public, anon, authenticated;

create or replace function app.my_joined_employee(p_employee_id uuid) returns public.employees
language plpgsql stable security definer set search_path = '' as $$
declare v public.employees;
begin
  select * into v from public.employees e
  where e.id = p_employee_id and e.user_id = (select auth.uid()) and e.account_status = 'joined';
  if v.id is null then
    raise exception '본인 직원 정보가 아니에요' using errcode = '42501';
  end if;
  return v;
end $$;
revoke execute on function app.my_joined_employee(uuid) from public, anon;

-- ───────────────────────── 직원 초대 ─────────────────────────
create or replace function public.create_invite(p_employee_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_emp public.employees;
  v_token text;
  v_exp date := app.kst_today() + 7;
begin
  select * into v_emp from public.employees where id = p_employee_id;
  if v_emp.id is null or not app.owns_workplace(v_emp.workplace_id) then
    raise exception '권한이 없어요' using errcode = '42501';
  end if;
  if v_emp.account_status in ('joined', 'blocked') then
    raise exception '이미 가입했거나 로그인이 차단된 직원이에요';
  end if;
  v_token := encode(extensions.gen_random_bytes(18), 'hex');
  delete from public.invites where employee_id = v_emp.id and used_at is null; -- 이전 링크 무효화 (재발급)
  insert into public.invites (workplace_id, employee_id, token_hash, expires_at)
  values (v_emp.workplace_id, v_emp.id, encode(extensions.digest(v_token, 'sha256'), 'hex'), v_exp);
  update public.employees set account_status = 'invited' where id = v_emp.id and account_status = 'none';
  return jsonb_build_object('token', v_token, 'expiresAt', v_exp, 'note', '토큰은 이번 응답에만 보여요. 서버에는 해시만 저장해요');
end $$;

create or replace function public.accept_invite(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_inv public.invites;
  v_emp public.employees;
begin
  if (select auth.uid()) is null then
    raise exception '로그인이 필요해요' using errcode = '42501';
  end if;
  select * into v_inv from public.invites where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex') for update;
  if v_inv.id is null or v_inv.used_at is not null or v_inv.expires_at < app.kst_today() then
    raise exception '초대 링크가 만료됐거나 이미 쓰였어요';
  end if;
  select * into v_emp from public.employees where id = v_inv.employee_id for update;
  if v_emp.user_id is not null or v_emp.account_status = 'blocked' then
    raise exception '이미 연결된 직원이에요';
  end if;
  if exists (select 1 from public.workplaces w where w.id = v_emp.workplace_id and w.owner_id = (select auth.uid())) then
    raise exception '사장님 계정으로는 직원 초대를 받을 수 없어요';
  end if;
  update public.employees set user_id = (select auth.uid()), account_status = 'joined' where id = v_emp.id;
  update public.invites set used_at = now() where id = v_inv.id;
  perform app.push_notification(v_emp.workplace_id, 'owner', null, 'employeeJoined', v_emp.alias || ' 가입 완료 — 근로조건 확인을 기다려요', '/owner/employees/' || v_emp.id);
  return v_emp.id;
end $$;

-- ───────────────────────── 직원 본인 ─────────────────────────
create or replace function public.employee_context() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'employeeId', e.id, 'alias', e.alias, 'workplaceId', w.id, 'workplaceName', w.name, 'scale', w.scale,
    'gpsEnabled', w.gps_enabled, 'radiusM', w.radius_m, 'lateToleranceMin', w.late_tolerance_min,
    'hourlyLeaveAllowed', w.hourly_leave_allowed, 'lang', e.lang,
    'locationConsent', e.location_consent_at is not null and e.location_consent_revoked_at is null
  )), '[]'::jsonb)
  from public.employees e join public.workplaces w on w.id = e.workplace_id
  where e.user_id = (select auth.uid()) and e.account_status = 'joined';
$$;
comment on function public.employee_context() is '직원이 볼 수 있는 사업장 정보(상호·설정)만. 다른 직원·금액 없음';

create or replace function public.ack_conditions(p_condition_id uuid, p_status text, p_memo text default '') returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_c public.work_conditions;
  v_emp public.employees;
begin
  select * into v_c from public.work_conditions where id = p_condition_id;
  if v_c.id is null then
    raise exception '근로조건을 찾을 수 없어요';
  end if;
  v_emp := app.my_joined_employee(v_c.employee_id);
  if p_status not in ('confirmed', 'disputed') then
    raise exception '확인 상태가 올바르지 않아요';
  end if;
  insert into public.condition_acks (workplace_id, employee_id, condition_id, status, memo)
  values (v_emp.workplace_id, v_emp.id, v_c.id, p_status, coalesce(p_memo, ''));
  perform app.push_notification(v_emp.workplace_id, 'owner', null, 'conditionAck',
    case when p_status = 'confirmed' then v_emp.alias || ' 근로조건 확인 완료' else v_emp.alias || ' 근로조건에 "다른 점이 있어요": ' || coalesce(p_memo, '') end,
    '/owner/employees/' || v_emp.id);
end $$;

create or replace function public.set_location_consent(p_employee_id uuid, p_consent boolean, p_version text default 'v1') returns void
language plpgsql security definer set search_path = '' as $$
declare v_emp public.employees;
begin
  v_emp := app.my_joined_employee(p_employee_id);
  if p_consent then
    update public.employees set location_consent_at = now(), location_consent_revoked_at = null, location_consent_version = p_version where id = v_emp.id;
  else
    update public.employees set location_consent_revoked_at = now() where id = v_emp.id;
  end if;
end $$;

create or replace function public.set_my_lang(p_employee_id uuid, p_lang text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_emp public.employees;
begin
  v_emp := app.my_joined_employee(p_employee_id);
  update public.employees set lang = p_lang where id = v_emp.id;
end $$;

create or replace function public.leave_employee_app(p_employee_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_emp public.employees;
begin
  v_emp := app.my_joined_employee(p_employee_id);
  update public.employees set user_id = null, account_status = 'none' where id = v_emp.id;
  perform app.push_notification(v_emp.workplace_id, 'owner', null, 'employeeLeftApp', v_emp.alias || ' 직원 앱 탈퇴 (사장님 기록은 유지)', '/owner/employees/' || v_emp.id);
end $$;

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
  if p_status not in ('confirmed', 'disputed') or (p_status = 'disputed' and char_length(btrim(coalesce(p_memo, ''))) = 0) then
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

create or replace function public.dispute_attendance(p_record_id uuid, p_memo text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_rec public.attendance_records;
  v_emp public.employees;
begin
  select * into v_rec from public.attendance_records where id = p_record_id;
  if v_rec.id is null then
    raise exception '출퇴근 기록을 찾을 수 없어요';
  end if;
  v_emp := app.my_joined_employee(v_rec.employee_id);
  if char_length(btrim(coalesce(p_memo, ''))) = 0 then
    raise exception '한 줄 사유가 필요해요';
  end if;
  update public.attendance_records set status = 'exception', reason = left('직원 이의: ' || p_memo, 200) where id = v_rec.id;
  perform app.push_notification(v_rec.workplace_id, 'owner', null, 'attendanceDispute',
    v_emp.alias || ' ' || to_char(v_rec.date, 'MM.DD') || ' 출퇴근 기록에 "다른 점이 있어요": ' || p_memo,
    '/owner/work?tab=attendance&record=' || v_rec.id);
end $$;

create or replace function public.request_leave(p_employee_id uuid, p_date date, p_hours numeric default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_emp public.employees;
  v_wp public.workplaces;
  v_id uuid;
begin
  v_emp := app.my_joined_employee(p_employee_id);
  select * into v_wp from public.workplaces where id = v_emp.workplace_id;
  if v_wp.scale = '1-4' then
    raise exception '1~4명 사업장은 연차 규정이 적용되지 않아요';
  end if;
  if p_date <= app.kst_today() then
    raise exception '오늘 이후 날짜를 고르세요';
  end if;
  if p_hours is not null and not v_wp.hourly_leave_allowed then
    raise exception '이 사업장은 시간 단위 연차를 쓰지 않아요';
  end if;
  if exists (select 1 from public.leave_requests l where l.employee_id = v_emp.id and l.date = p_date and l.status in ('requested', 'approved')) then
    raise exception '이미 신청한 날이에요';
  end if;
  insert into public.leave_requests (workplace_id, employee_id, date, hours, status, requested_by)
  values (v_emp.workplace_id, v_emp.id, p_date, p_hours, 'requested', 'employee')
  returning id into v_id;
  perform app.push_notification(v_emp.workplace_id, 'owner', null, 'leave',
    v_emp.alias || ' 연차 신청: ' || to_char(p_date, 'MM.DD') || case when p_hours is null then ' 하루' else ' ' || p_hours || '시간' end,
    '/owner/work?tab=leave');
  return v_id;
end $$;

create or replace function public.request_substitution(p_employee_id uuid, p_date date) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_emp public.employees;
  v_id uuid;
  v_other record;
begin
  v_emp := app.my_joined_employee(p_employee_id);
  if p_date <= app.kst_today() then
    raise exception '오늘 이후 근무만 대타를 구할 수 있어요';
  end if;
  if exists (select 1 from public.substitutions s where s.from_employee_id = v_emp.id and s.date = p_date and s.status in ('open', 'applied', 'approved')) then
    raise exception '이미 대타를 요청한 날이에요';
  end if;
  insert into public.substitutions (workplace_id, date, from_employee_id, mode, status)
  values (v_emp.workplace_id, p_date, v_emp.id, 'request', 'open')
  returning id into v_id;
  for v_other in
    select e.id from public.employees e
    where e.workplace_id = v_emp.workplace_id and e.id <> v_emp.id and e.account_status = 'joined' and (e.resign_date is null or e.resign_date >= app.kst_today())
  loop
    perform app.push_notification(v_emp.workplace_id, 'employee', v_other.id, 'subRequest', v_emp.alias || '가 ' || to_char(p_date, 'MM.DD') || ' 대타를 구해요', '/employee');
  end loop;
  return v_id;
end $$;

create or replace function public.apply_substitution(p_substitution_id uuid, p_employee_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_emp public.employees;
  v_sub public.substitutions;
begin
  v_emp := app.my_joined_employee(p_employee_id);
  select * into v_sub from public.substitutions where id = p_substitution_id for update;
  if v_sub.id is null or v_sub.workplace_id <> v_emp.workplace_id or v_sub.mode <> 'request' then
    raise exception '대타 요청을 찾을 수 없어요';
  end if;
  if v_sub.status <> 'open' then
    raise exception '이미 신청이 들어왔거나 마감된 요청이에요';
  end if;
  if v_sub.from_employee_id = v_emp.id then
    raise exception '본인 요청에는 신청할 수 없어요';
  end if;
  update public.substitutions set status = 'applied', to_employee_id = v_emp.id where id = v_sub.id;
  perform app.push_notification(v_emp.workplace_id, 'owner', null, 'sub', v_emp.alias || '가 ' || to_char(v_sub.date, 'MM.DD') || ' 대타를 신청했어요 — 승인 대기', '/owner/work?tab=subs');
end $$;

create or replace function public.mark_statement_viewed(p_delivery_id uuid) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare v_s public.statement_deliveries;
begin
  select * into v_s from public.statement_deliveries where id = p_delivery_id;
  if v_s.id is null then
    raise exception '명세서를 찾을 수 없어요';
  end if;
  perform app.my_joined_employee(v_s.employee_id);
  if v_s.viewed_at is null then
    update public.statement_deliveries set viewed_at = now() where id = v_s.id returning viewed_at into v_s.viewed_at;
  end if;
  return v_s.viewed_at;
end $$;
comment on function public.mark_statement_viewed(uuid) is '직원이 명세서를 연 시각 = 수령 확인. 한 번 남기면 바뀌지 않음';

create or replace function public.dispute_statement(p_delivery_id uuid, p_memo text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_s public.statement_deliveries;
  v_emp public.employees;
  v_month text;
begin
  select * into v_s from public.statement_deliveries where id = p_delivery_id;
  if v_s.id is null then
    raise exception '명세서를 찾을 수 없어요';
  end if;
  v_emp := app.my_joined_employee(v_s.employee_id);
  if char_length(btrim(coalesce(p_memo, ''))) = 0 then
    raise exception '한 줄로 적어 주세요';
  end if;
  update public.statement_deliveries set disputed_memo = left(p_memo, 300), disputed_at = now() where id = v_s.id;
  select month into v_month from public.payroll_months where id = v_s.payroll_id;
  perform app.push_notification(v_s.workplace_id, 'owner', null, 'statementDispute',
    v_emp.alias || ' ' || v_month || '분 명세서 "금액이 이상해요": ' || p_memo, '/owner/payroll?month=' || v_month);
end $$;

-- ───────────────────────── 사장님 ─────────────────────────
create or replace function public.revoke_consult(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_c public.consult_requests;
begin
  select * into v_c from public.consult_requests where id = p_id;
  if v_c.id is null or not app.owns_workplace(v_c.workplace_id) then
    raise exception '권한이 없어요' using errcode = '42501';
  end if;
  update public.consult_requests
  set revoked_at = coalesce(revoked_at, now()), status = 'revoked', snapshot = null, memo = ''
  where id = v_c.id;
end $$;
comment on function public.revoke_consult(uuid) is '공유 철회 — 노무법인에 보낸 사본(메모·조건·출퇴근)을 지운다';

create or replace function public.delete_employee_if_unpaid(p_employee_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_emp public.employees;
begin
  select * into v_emp from public.employees where id = p_employee_id;
  if v_emp.id is null or not app.owns_workplace(v_emp.workplace_id) then
    raise exception '권한이 없어요' using errcode = '42501';
  end if;
  if exists (select 1 from public.payroll_lines l where l.employee_id = v_emp.id) then
    raise exception '확정한 급여가 있는 직원은 지울 수 없어요 (퇴사 처리를 쓰세요)';
  end if;
  perform set_config('app.allow_purge', 'on', true);
  delete from public.statement_deliveries where employee_id = v_emp.id;
  delete from public.employees where id = v_emp.id;
end $$;

create or replace function public.delete_my_workplace() returns void
language plpgsql security definer set search_path = '' as $$
declare v_wp uuid;
begin
  select id into v_wp from public.workplaces where owner_id = (select auth.uid());
  if v_wp is null then
    return;
  end if;
  perform set_config('app.allow_purge', 'on', true);
  delete from public.payroll_lines where workplace_id = v_wp;
  delete from public.payroll_edits where workplace_id = v_wp;
  delete from public.statement_deliveries where workplace_id = v_wp;
  delete from public.workplaces where id = v_wp;
end $$;
comment on function public.delete_my_workplace() is '사장님 데이터 전체 삭제(데모 초기화·탈퇴). 되돌릴 수 없음';

-- ───────────────────────── 노무법인 ─────────────────────────
create or replace function public.firm_consult_inbox() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x order by x ->> 'createdAt' desc), '[]'::jsonb) from (
    select case when c.revoked_at is null then jsonb_build_object(
        'id', c.id, 'kind', 'member', 'topic', c.topic, 'question', c.question,
        'memo', case when 'memo' = any (c.share_items) then c.memo else '' end,
        'shareItems', c.share_items, 'snapshot', c.snapshot, 'consentAt', c.consent_at,
        'status', c.status, 'createdAt', c.created_at)
      else jsonb_build_object('id', c.id, 'kind', 'member', 'topic', c.topic, 'question', '(공유 철회됨)', 'memo', '',
        'shareItems', '[]'::jsonb, 'snapshot', null, 'status', 'revoked', 'revokedAt', c.revoked_at, 'createdAt', c.created_at)
      end as x
    from public.consult_requests c
    where app.is_firm_member(c.firm_id)
  ) t;
$$;

create or replace function public.firm_mark_consult_read(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_c public.consult_requests;
begin
  select * into v_c from public.consult_requests where id = p_id;
  if v_c.id is null or not app.is_firm_member(v_c.firm_id) or v_c.revoked_at is not null then
    raise exception '요청을 찾을 수 없어요' using errcode = '42501';
  end if;
  update public.consult_requests set status = 'firm-read' where id = v_c.id and status = 'delivered';
end $$;

create or replace function public.firm_guest_consults() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_secret text;
  v_out jsonb;
begin
  if not exists (select 1 from public.firm_members m where m.user_id = (select auth.uid())) then
    raise exception '노무법인 계정만 볼 수 있어요' using errcode = '42501';
  end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'guest_phone_key';
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', g.id, 'kind', 'guest', 'nickname', g.nickname,
      'phone', extensions.pgp_sym_decrypt(g.phone_ciphertext, v_secret),
      'phoneMasked', g.phone_masked, 'contactTime', g.contact_time, 'topic', g.topic, 'summary', g.summary,
      'consents', jsonb_build_object('collect', g.consent_collect_at, 'provide', g.consent_provide_at),
      'createdAt', g.created_at, 'purgeAfter', g.purge_after
    ) order by g.created_at desc), '[]'::jsonb)
  into v_out
  from public.guest_consults g
  where app.is_firm_member(g.firm_id);
  return v_out;
end $$;
comment on function public.firm_guest_consults() is '받은 비회원 신청만. 연락을 위해 번호를 복호화해 노무법인에만 보여준다';

create or replace function public.firm_delegated_insurance() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'employeeId', e.id, 'alias', e.alias, 'hireDate', e.hire_date, 'resignDate', e.resign_date,
      'acquisition', coalesce((select r.status from public.insurance_reports r where r.employee_id = e.id and r.phase = 'acquisition'), 'none'),
      'loss', coalesce((select r.status from public.insurance_reports r where r.employee_id = e.id and r.phase = 'loss'), 'none')
    ) order by e.hire_date), '[]'::jsonb)
  from public.employees e join public.workplaces w on w.id = e.workplace_id
  where e.insurance_method = 'delegated' and w.firm_insurance_share_consent and app.is_firm_member(w.partner_firm_id);
$$;
comment on function public.firm_delegated_insurance() is '사장님이 맡김 + 공유 동의한 직원의 별칭·입퇴사일·신고 상태만';

create or replace function public.firm_mark_insurance_done(p_employee_id uuid, p_phase text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_emp public.employees;
  v_wp public.workplaces;
begin
  select * into v_emp from public.employees where id = p_employee_id;
  select * into v_wp from public.workplaces where id = v_emp.workplace_id;
  if v_emp.id is null or v_emp.insurance_method <> 'delegated' or not v_wp.firm_insurance_share_consent or not app.is_firm_member(v_wp.partner_firm_id) then
    raise exception '맡김·공유 동의된 직원이 아니에요' using errcode = '42501';
  end if;
  if p_phase not in ('acquisition', 'loss') then
    raise exception '신고 구분이 올바르지 않아요';
  end if;
  insert into public.insurance_reports (workplace_id, employee_id, phase, status, date, by_role)
  values (v_wp.id, v_emp.id, p_phase, 'firmDone', app.kst_today(), 'firm')
  on conflict (employee_id, phase) do update set status = 'firmDone', date = excluded.date, by_role = 'firm';
  perform app.push_notification(v_wp.id, 'owner', null, 'firmDone',
    '노무법인이 ' || v_emp.alias || ' 4대보험 ' || case when p_phase = 'acquisition' then '취득' else '상실' end || ' 신고를 처리 완료로 표시했어요',
    '/owner/insurance?emp=' || v_emp.id);
end $$;

-- ───────────────────────── 비회원 상담 (anon) ─────────────────────────
create or replace function public.submit_guest_consult(
  p_nickname text, p_phone text, p_contact_time text, p_topic text, p_summary text,
  p_consent_collect boolean, p_consent_provide boolean, p_honeypot text default ''
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_digits text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  v_secret text;
  v_key text;
  v_id uuid;
  v_firm uuid;
begin
  if coalesce(p_honeypot, '') <> '' then
    return jsonb_build_object('accepted', false, 'mode', 'rejected', 'reason', '자동 입력으로 보여 처리하지 않았어요');
  end if;
  if not (coalesce(p_consent_collect, false) and coalesce(p_consent_provide, false)) then
    raise exception '필수 동의 2개가 모두 필요해요';
  end if;
  if char_length(btrim(coalesce(p_nickname, ''))) not between 1 and 30 then
    raise exception '호칭을 적어 주세요 (실명이 아니어도 돼요)';
  end if;
  if v_digits !~ '^01[016789][0-9]{7,8}$' then
    raise exception '휴대폰 번호 형식을 확인해 주세요 (예: 010-1234-5678)';
  end if;
  if char_length(btrim(coalesce(p_contact_time, ''))) not between 1 and 60 then
    raise exception '연락 편한 시간을 적어 주세요';
  end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'guest_phone_key';
  if v_secret is null then
    raise exception '서버 설정이 끝나지 않았어요';
  end if;
  v_key := encode(extensions.hmac(v_digits || '|' || app.kst_today()::text, v_secret, 'sha256'), 'hex');
  if (select count(*) from public.guest_consults g where g.phone_key = v_key) >= 3 then
    raise exception '같은 번호는 하루 3회까지 신청할 수 있어요';
  end if;
  if not app.setting_on('guest_consult_intake') then
    -- 처리방침·보유 기간 확정 전: 검증만 하고 저장하지 않는다
    return jsonb_build_object('accepted', false, 'mode', 'demo', 'reason', '시연 모드 — 실제 접수는 처리방침·보유 기간 확정 후 켜져요. 저장하지 않았어요');
  end if;
  select f.id into v_firm from public.firms f order by f.created_at limit 1;
  insert into public.guest_consults (firm_id, nickname, phone_ciphertext, phone_masked, phone_key, contact_time, topic, summary, consent_collect_at, consent_provide_at)
  values (v_firm, btrim(p_nickname), extensions.pgp_sym_encrypt(v_digits, v_secret),
          substr(v_digits, 1, 3) || '-****-' || right(v_digits, 4), v_key, btrim(p_contact_time),
          left(coalesce(p_topic, '기타'), 30), left(coalesce(p_summary, ''), 300), now(), now())
  returning id into v_id;
  return jsonb_build_object('accepted', true, 'mode', 'stored', 'id', v_id, 'note', '노무법인 요청함에 저장됐어요. 노무사 연결은 무료, 상담 비용과 방식은 노무법인과 직접 정해요');
end $$;

-- ───────────────────────── 관리자 (집계만) ─────────────────────────
create or replace function public.admin_stats() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not app.is_admin() then
    raise exception '관리자만 볼 수 있어요' using errcode = '42501';
  end if;
  insert into public.admin_access_log (admin_id, screen) values ((select auth.uid()), 'admin_stats');
  return jsonb_build_object(
    'workplaces', (select count(*) from public.workplaces),
    'employees', (select count(*) from public.employees),
    'joinedEmployees', (select count(*) from public.employees where account_status = 'joined'),
    'payrollsConfirmed', (select count(*) from public.payroll_months where status = 'confirmed'),
    'consults', (select count(*) from public.consult_requests),
    'guestConsults', (select count(*) from public.guest_consults),
    'notifications7d', (select count(*) from public.notifications where created_at > now() - interval '7 days'),
    'kakaoSent', (select count(*) from public.notification_log where channel = 'kakao' and status = 'delivered'),
    'settings', (select jsonb_object_agg(key, value) from public.app_settings)
  );
end $$;
comment on function public.admin_stats() is '관리자 화면 — 개인 데이터 없이 집계만. 호출은 접근 기록에 남는다';

-- ───────────────────────── 서버 전용 ─────────────────────────
create or replace function public.next_record_no(p_workplace_id uuid, p_date date) returns text
language plpgsql security definer set search_path = '' as $$
declare v_seq integer;
begin
  update public.workplaces set seq = seq + 1 where id = p_workplace_id returning seq into v_seq;
  return 'R-' || to_char(p_date, 'YYYYMMDD') || '-' || lpad(v_seq::text, 4, '0');
end $$;

create or replace function public.verify_cron_secret(p_secret text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select decrypted_secret = p_secret from vault.decrypted_secrets where name = 'cron_secret'), false);
$$;

create or replace function public.run_retention() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_log integer;
  v_guest integer;
  v_emp integer := 0;
  v_e record;
begin
  perform set_config('app.allow_purge', 'on', true);
  delete from public.notification_log where created_at < now() - interval '90 days';
  get diagnostics v_log = row_count;
  delete from public.guest_consults where purge_after < app.kst_today();
  get diagnostics v_guest = row_count;
  for v_e in select id from public.employees where resign_date is not null and resign_date < app.kst_today() - interval '3 years' loop
    delete from public.payroll_lines where employee_id = v_e.id;
    delete from public.statement_deliveries where employee_id = v_e.id;
    delete from public.payroll_edits where employee_id = v_e.id;
    delete from public.employees where id = v_e.id;
    v_emp := v_emp + 1;
  end loop;
  return jsonb_build_object('notificationLog', v_log, 'guestConsults', v_guest, 'employees', v_emp, 'at', now());
end $$;
comment on function public.run_retention() is '보관 기간 정리: 알림 발송 기록 90일, 비회원 연락처 보유 기간, 퇴사 3년 후 직원 데이터 (19_데이터모델 6장)';

-- ───────────────────────── 실행 권한 ─────────────────────────
do $$
declare f text;
begin
  -- 기본으로 열려 있는 실행 권한을 닫고 필요한 역할에만 준다
  for f in
    select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;

grant execute on function public.submit_guest_consult(text, text, text, text, text, boolean, boolean, text) to anon, authenticated;
grant execute on function
  public.create_invite(uuid), public.accept_invite(text), public.employee_context(), public.ack_conditions(uuid, text, text),
  public.set_location_consent(uuid, boolean, text), public.set_my_lang(uuid, text), public.leave_employee_app(uuid),
  public.respond_attendance_edit(uuid, text, text), public.dispute_attendance(uuid, text), public.request_leave(uuid, date, numeric),
  public.request_substitution(uuid, date), public.apply_substitution(uuid, uuid), public.mark_statement_viewed(uuid),
  public.dispute_statement(uuid, text), public.revoke_consult(uuid), public.delete_employee_if_unpaid(uuid),
  public.delete_my_workplace(), public.firm_consult_inbox(), public.firm_mark_consult_read(uuid), public.firm_guest_consults(),
  public.firm_delegated_insurance(), public.firm_mark_insurance_done(uuid, text), public.admin_stats()
to authenticated;
grant execute on function public.next_record_no(uuid, date), public.verify_cron_secret(text), public.run_retention() to service_role;
