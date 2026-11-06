-- AI 인사노무 관리 서비스 — 핵심 스키마
-- 근거: 19_데이터모델.md 2장(테이블), 4장(일부러 저장하지 않는 것), 6장(보관 기간)
-- 원칙
--   * 직원 실명·주민등록번호·외국인등록번호·연락처·서류 파일 칸은 두지 않는다 (별칭·나이대만).
--   * 기한은 저장하지 않는다 (원래 날짜에서 계산). 저장하는 것은 처리 기록(deadline_actions)과 발송 기록(notification_log)뿐.
--   * 근로조건은 이력(work_conditions, 수정 불가), 확정 급여는 스냅샷(payroll_lines, 수정 불가),
--     출퇴근 원래 기록은 지우거나 덮어쓰지 않는다(attendance_records + attendance_edits).
--   * 법령 수치·서류 목록·FAQ는 DB가 아니라 저장소 규칙 파일(src/data/rules.json 등)에 둔다.
--   * 사장님 1명 = 사업장 1개 (workplaces.owner_id unique).

create extension if not exists pgcrypto with schema extensions;

-- 시간 문자열 'HH:MM'
create domain public.hhmm as text check (value ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

-- ───────────────────────── 계정 ─────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 40),
  created_at timestamptz not null default now()
);
comment on table public.profiles is '로그인 사용자 표시 정보. 역할은 관계로 판단: 사업장 소유=사장님, employees.user_id=직원, firm_members=노무법인, admins=관리자';

create table public.firms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  display_public boolean not null default false,
  created_at timestamptz not null default now()
);
comment on column public.firms.display_public is '협약 후에만 이름을 사장님 화면에 표시';

create table public.firm_members (
  firm_id uuid not null references public.firms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (firm_id, user_id)
);

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ───────────────────────── 사업장 ─────────────────────────
create table public.workplaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users (id) on delete cascade,
  name text not null default '' check (char_length(name) <= 60),
  industry text not null check (industry in ('food', 'retail', 'service')),
  scale text not null check (scale in ('1-4', '5-9', '10+')),
  family_only boolean not null default false,
  pay_day smallint not null default 10 check (pay_day between 1 and 31),
  pay_month_basis text not null default 'previous' check (pay_month_basis in ('previous', 'current')),
  gps_enabled boolean not null default false,
  address text not null default '' check (char_length(address) <= 120),
  radius_m integer not null default 100 check (radius_m between 30 and 1000),
  late_tolerance_min integer not null default 5 check (late_tolerance_min between 0 and 60),
  default_insurance_method text check (default_insurance_method in ('self', 'delegated', 'alreadyDone', 'notYet')),
  hourly_leave_allowed boolean not null default false,
  firm_insurance_share_consent boolean not null default false,
  partner_firm_id uuid references public.firms (id) on delete set null,
  base_date_override date,
  kakao_banner_dismissed boolean not null default false,
  seq integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint address_only_with_gps check (gps_enabled or address = '')
);
comment on column public.workplaces.address is 'GPS를 켤 때만 받는다';
comment on column public.workplaces.seq is '출퇴근 기록 번호 발급용 일련번호';

create table public.busy_days (
  id uuid primary key default gen_random_uuid(),
  workplace_id uuid not null references public.workplaces (id) on delete cascade,
  date date not null,
  memo text not null check (char_length(memo) between 1 and 60)
);
create index busy_days_wp_idx on public.busy_days (workplace_id, date);

-- ───────────────────────── 직원 ─────────────────────────
create table public.employees (
  id uuid primary key default gen_random_uuid(),
  workplace_id uuid not null references public.workplaces (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  alias text not null check (char_length(alias) between 1 and 20 and alias !~ '[0-9]{6}-?[1-8][0-9]{6}'),
  age_band text not null check (age_band in ('under18', '18-59', '60-64', '65+')),
  birth_date date,
  started_before_65 boolean,
  hire_date date not null,
  employment_type text not null check (employment_type in ('regular', 'fixed', 'daily')),
  contract_end date,
  probation_end date,
  food_handler boolean not null default false,
  is_foreign boolean not null default false,
  school text check (school is null or char_length(school) <= 30),
  insurance_method text not null check (insurance_method in ('self', 'delegated', 'alreadyDone', 'notYet')),
  registered_at date not null default current_date,
  onboarding text not null default 'new' check (onboarding in ('new', 'existing-pending', 'existing-done')),
  resign_date date,
  resign_type text check (resign_type in ('self', 'contractEnd', 'dismissal', 'other')),
  account_status text not null default 'none' check (account_status in ('none', 'invited', 'joined', 'blocked')),
  location_consent_at timestamptz,
  location_consent_revoked_at timestamptz,
  location_consent_version text,
  bonus_annual integer not null default 0 check (bonus_annual >= 0),
  leave_allowance_annual integer not null default 0 check (leave_allowance_annual >= 0),
  lang text not null default 'ko' check (lang in ('ko', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint birth_only_for_minor check (birth_date is null or age_band = 'under18'),
  constraint minor_birth_required check (age_band <> 'under18' or birth_date is not null),
  constraint fixed_needs_end check (employment_type <> 'fixed' or contract_end is not null),
  constraint contract_after_hire check (contract_end is null or contract_end >= hire_date),
  constraint probation_after_hire check (probation_end is null or probation_end >= hire_date),
  constraint resign_after_hire check (resign_date is null or resign_date >= hire_date),
  constraint one_account_per_workplace unique (workplace_id, user_id)
);
comment on table public.employees is '직원 — 별칭·나이대만. 실명·주민번호·연락처 칸 없음';
create index employees_wp_idx on public.employees (workplace_id);
create index employees_user_idx on public.employees (user_id);

create table public.employee_foreign_info (
  employee_id uuid primary key references public.employees (id) on delete cascade,
  workplace_id uuid not null references public.workplaces (id) on delete cascade,
  visa text not null check (visa in ('D-2', 'D-4', 'E-9', 'H-2', 'F-4', 'other')),
  expiry date,
  permitted boolean,
  permit_hours numeric(5, 1) check (permit_hours is null or permit_hours > 0),
  other_workplace_hours numeric(5, 1) not null default 0 check (other_workplace_hours >= 0),
  nationality text not null default '' check (char_length(nationality) <= 30),
  checked_at date
);
comment on table public.employee_foreign_info is '체류자격·만료일·허가 여부만. 외국인등록번호·등록증 사진은 받지 않는다';

create table public.work_conditions (
  id uuid primary key default gen_random_uuid(),
  workplace_id uuid not null references public.workplaces (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  effective_from date not null,
  hourly_wage integer not null check (hourly_wage > 0),
  schedule jsonb not null default '[null,null,null,null,null,null,null]'::jsonb
    check (jsonb_typeof(schedule) = 'array' and jsonb_array_length(schedule) = 7),
  variable boolean not null default false,
  variable_weekly_hours numeric(5, 1),
  weekly_holiday_day smallint not null default 6 check (weekly_holiday_day between 0 and 6),
  job text not null default '' check (char_length(job) <= 60),
  meal_allowance integer not null default 0 check (meal_allowance >= 0),
  break_waiver_requested boolean not null default false,
  reason text not null default '' check (char_length(reason) <= 100),
  created_at timestamptz not null default now(),
  constraint variable_needs_hours check (not variable or variable_weekly_hours > 0)
);
comment on table public.work_conditions is '근로조건 이력 — 적용 시작일 기준. 수정하지 않고 새 행을 추가한다';
comment on column public.work_conditions.schedule is '월~일 7칸 [{start,end,breakMin}|null]';
create index work_conditions_emp_idx on public.work_conditions (employee_id, effective_from);

create table public.condition_acks (
  id uuid primary key default gen_random_uuid(),
  workplace_id uuid not null references public.workplaces (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  condition_id uuid not null references public.work_conditions (id) on delete cascade,
  status text not null check (status in ('confirmed', 'disputed')),
  memo text not null default '' check (char_length(memo) <= 200),
  at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint dispute_needs_memo check (status <> 'disputed' or char_length(memo) > 0)
);
create index condition_acks_emp_idx on public.condition_acks (employee_id);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  workplace_id uuid not null references public.workplaces (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  token_hash text not null unique,
  expires_at date not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table public.invites is '초대 링크 — 토큰은 SHA-256 해시만 저장(일회용, 유효기간)';

-- ───────────────────────── 근무 ─────────────────────────
create table public.substitutions (
  id uuid primary key default gen_random_uuid(),
  workplace_id uuid not null references public.workplaces (id) on delete cascade,
  date date not null,
  from_employee_id uuid not null references public.employees (id) on delete cascade,
  to_employee_id uuid references public.employees (id) on delete cascade,
  mode text not null check (mode in ('owner', 'request')),
  status text not null check (status in ('open', 'applied', 'approved', 'rejected', 'cancelled')),
  memo text not null default '',
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index substitutions_wp_idx on public.substitutions (workplace_id, date);

create table public.shift_overrides (
  id uuid primary key default gen_random_uuid(),
  workplace_id uuid not null references public.workplaces (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  date date not null,
  kind text not null check (kind in ('change', 'extra', 'absent', 'leave', 'subOut', 'subIn')),
  start_time public.hhmm,
  end_time public.hhmm,
  break_min integer not null default 0 check (break_min >= 0),
  memo text not null default '' check (char_length(memo) <= 100),
  substitution_id uuid references public.substitutions (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint times_for_working_kinds check ((kind in ('change', 'extra', 'subIn')) = (start_time is not null and end_time is not null))
);
comment on table public.shift_overrides is '일정 변경(시간 변경·추가·결근·연차·대타). 계약상 일정은 work_conditions에서 계산';
create index shift_overrides_emp_idx on public.shift_overrides (employee_id, date);

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  workplace_id uuid not null references public.workplaces (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  record_no text not null,
  date date not null,
  original_clock_in public.hhmm,
  original_clock_out public.hhmm,
  source text not null check (source in ('gps-demo', 'gps', 'manual', 'owner')),
  gps text check (gps in ('inside', 'outside', 'denied')),
  status text not null check (status in ('confirmed', 'pending', 'exception')),
  approval text check (approval in ('actual', 'planned')),
  reason text not null default '' check (char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  constraint record_no_unique unique (workplace_id, record_no),
  constraint one_record_per_day unique (employee_id, date)
);
comment on table public.attendance_records is '출퇴근 원래 기록 — 원래 시각은 덮어쓰지 않음(트리거). 좌표는 저장하지 않고 반경 안/밖 판정만';
create index attendance_wp_idx on public.attendance_records (workplace_id, date);

create table public.attendance_edits (
  id uuid primary key default gen_random_uuid(),
  workplace_id uuid not null references public.workplaces (id) on delete cascade,
  record_id uuid not null references public.attendance_records (id) on delete cascade,
  before_in public.hhmm,
  before_out public.hhmm,
  after_in public.hhmm,
  after_out public.hhmm,
  reason text not null check (char_length(btrim(reason)) between 1 and 200),
  by_user uuid references auth.users (id) on delete set null,
  at timestamptz not null default now(),
  employee_response_status text check (employee_response_status in ('confirmed', 'disputed')),
  employee_response_memo text not null default '',
  employee_response_at timestamptz
);
comment on table public.attendance_edits is '근무 기록 수정 이력 — 사유 필수, 직원 확인/이의';
create index attendance_edits_rec_idx on public.attendance_edits (record_id, at);

create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  workplace_id uuid not null references public.workplaces (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  date date not null,
  hours numeric(4, 1) check (hours is null or hours > 0),
  status text not null check (status in ('requested', 'approved', 'adjust', 'cancelled')),
  adjust_reason text not null default '',
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  requested_by text not null check (requested_by in ('employee', 'owner')),
  constraint adjust_needs_reason check (status <> 'adjust' or char_length(adjust_reason) > 0)
);
create index leave_requests_emp_idx on public.leave_requests (employee_id, date);

-- ───────────────────────── 급여 ─────────────────────────
create table public.payroll_months (
  id uuid primary key default gen_random_uuid(),
  workplace_id uuid not null references public.workplaces (id) on delete cascade,
  month text not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  status text not null default 'draft' check (status in ('draft', 'confirmed')),
  scale_confirmed text check (scale_confirmed in ('1-4', '5-9', '10+')),
  confirmed_at timestamptz,
  confirmed_with_pending date[] not null default '{}',
  revision integer not null default 0,
  constraint one_payroll_per_month unique (workplace_id, month)
);
comment on column public.payroll_months.month is '근무 기간의 월(YYYY-MM)';

create table public.payroll_manual (
  payroll_id uuid not null references public.payroll_months (id) on delete cascade,
  workplace_id uuid not null references public.workplaces (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  income_tax integer check (income_tax is null or income_tax >= 0),
  local_tax integer check (local_tax is null or local_tax >= 0),
  adjustments jsonb not null default '[]'::jsonb check (jsonb_typeof(adjustments) = 'array'),
  primary key (payroll_id, employee_id)
);
comment on table public.payroll_manual is '확정 전 직접 입력(소득세·지방소득세·조정 항목)';

create table public.payroll_lines (
  id uuid primary key default gen_random_uuid(),
  payroll_id uuid not null references public.payroll_months (id) on delete cascade,
  workplace_id uuid not null references public.workplaces (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete restrict,
  revision integer not null default 1,
  line jsonb not null,
  gross integer not null,
  deduction_total integer not null,
  net integer not null,
  net_complete boolean not null,
  created_at timestamptz not null default now(),
  constraint one_line_per_revision unique (payroll_id, employee_id, revision)
);
comment on table public.payroll_lines is '확정 급여 스냅샷 — 이후 근로조건이 바뀌어도 다시 계산하지 않음. 수정은 새 revision 행 + payroll_edits';

create table public.payroll_edits (
  id uuid primary key default gen_random_uuid(),
  payroll_id uuid not null references public.payroll_months (id) on delete cascade,
  workplace_id uuid not null references public.workplaces (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  field text not null,
  before_value text not null,
  after_value text not null,
  reason text not null check (char_length(btrim(reason)) between 1 and 200),
  at timestamptz not null default now()
);

create table public.statement_deliveries (
  id uuid primary key default gen_random_uuid(),
  payroll_id uuid not null references public.payroll_months (id) on delete cascade,
  workplace_id uuid not null references public.workplaces (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete restrict,
  revision integer not null,
  method text not null check (method in ('app', 'print')),
  delivered_at timestamptz not null default now(),
  viewed_at timestamptz,
  disputed_memo text,
  disputed_at timestamptz,
  constraint one_delivery_per_revision unique (payroll_id, employee_id, revision)
);
comment on column public.statement_deliveries.viewed_at is '직원 열람 시각 = 수령 확인(교부 증빙)';

-- ───────────────────────── 보험 ─────────────────────────
create table public.insurance_reports (
  workplace_id uuid not null references public.workplaces (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  phase text not null check (phase in ('acquisition', 'loss')),
  status text not null check (status in ('none', 'reported', 'handedOver', 'firmDone', 'confirmed')),
  date date,
  by_role text check (by_role in ('owner', 'firm')),
  updated_at timestamptz not null default now(),
  primary key (employee_id, phase)
);

create table public.insurance_notices (
  id uuid primary key default gen_random_uuid(),
  workplace_id uuid not null references public.workplaces (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  from_month text not null check (from_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  amounts jsonb not null check (jsonb_typeof(amounts) = 'object'),
  entered_at timestamptz not null default now()
);
comment on table public.insurance_notices is '고지서 금액(근로자 부담분) — 예상 금액보다 우선해 급여 공제에 쓴다';

-- ───────────────────────── 서류 ─────────────────────────
create table public.doc_records (
  id uuid primary key default gen_random_uuid(),
  workplace_id uuid not null references public.workplaces (id) on delete cascade,
  key text not null,
  item_id text not null,
  employee_id uuid references public.employees (id) on delete cascade,
  status text not null check (status in ('done', 'na', 'stored')),
  done_at date,
  na_reason text not null default '',
  expiry date,
  exam_date date,
  location text not null default '' check (char_length(location) <= 60),
  bulk boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint one_record_per_key unique (workplace_id, key),
  constraint na_needs_reason check (status <> 'na' or char_length(na_reason) > 0)
);
comment on table public.doc_records is '서류 상태·날짜·유효기간·보관 위치만. 파일은 받지 않는다';

create table public.doc_requests (
  id uuid primary key default gen_random_uuid(),
  workplace_id uuid not null references public.workplaces (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  item_id text,
  custom_name text not null check (char_length(custom_name) between 1 and 60),
  status text not null check (status in ('requested', 'received', 'needsFix')),
  requested_at date not null,
  due_date date not null,
  received_at date,
  fix_reason text not null default '',
  expiry date,
  location text not null default '',
  history jsonb not null default '[]'::jsonb
);

create table public.custom_forms (
  id uuid primary key default gen_random_uuid(),
  workplace_id uuid not null references public.workplaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  url text not null check (url ~ '^https?://')
);

-- ───────────────────────── 기한·알림 ─────────────────────────
create table public.deadline_actions (
  workplace_id uuid not null references public.workplaces (id) on delete cascade,
  key text not null,
  action text not null check (action in ('done', 'pastConfirmed', 'renewed', 'ended', 'unknown')),
  at timestamptz not null default now(),
  date date not null,
  note text not null default '',
  primary key (workplace_id, key)
);
comment on table public.deadline_actions is '기한 처리 기록. key에 원래 날짜가 들어가 원래 날짜가 바뀌면 자동으로 다시 계산된다';

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  workplace_id uuid not null references public.workplaces (id) on delete cascade,
  recipient text not null check (recipient in ('owner', 'employee')),
  employee_id uuid references public.employees (id) on delete cascade,
  kind text not null,
  text text not null,
  link text not null default '',
  created_at timestamptz not null default now(),
  read_at timestamptz,
  kakao_status text not null default 'not-connected' check (kakao_status in ('not-connected', 'not-sent', 'sent', 'failed')),
  constraint employee_recipient_needs_id check (recipient <> 'employee' or employee_id is not null)
);
create index notifications_wp_idx on public.notifications (workplace_id, created_at desc);

create table public.notification_log (
  id uuid primary key default gen_random_uuid(),
  workplace_id uuid not null references public.workplaces (id) on delete cascade,
  deadline_key text not null,
  channel text not null check (channel in ('inApp', 'kakao')),
  sent_on date not null,
  status text not null check (status in ('delivered', 'not-connected', 'failed')),
  detail text not null default '',
  created_at timestamptz not null default now(),
  constraint one_send_per_day unique (workplace_id, deadline_key, channel, sent_on)
);
comment on table public.notification_log is '알림 발송 기록 — 90일 후 삭제(run_retention)';

-- ───────────────────────── 점검·퇴사 ─────────────────────────
create table public.risk_answers (
  workplace_id uuid not null references public.workplaces (id) on delete cascade,
  question_id text not null,
  answer text not null check (answer in ('yes', 'no', 'unknown')),
  answered_at date not null,
  scale_at_answer text not null check (scale_at_answer in ('1-4', '5-9', '10+')),
  primary key (workplace_id, question_id)
);

create table public.offboarding_progress (
  employee_id uuid primary key references public.employees (id) on delete cascade,
  workplace_id uuid not null references public.workplaces (id) on delete cascade,
  steps jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

-- ───────────────────────── 상담 ─────────────────────────
create table public.consult_requests (
  id uuid primary key default gen_random_uuid(),
  workplace_id uuid not null references public.workplaces (id) on delete cascade,
  firm_id uuid references public.firms (id) on delete set null,
  topic text not null,
  question text not null default '',
  memo text not null default '',
  share_items text[] not null check (share_items <@ array['memo', 'workplace', 'conditions', 'attendance']::text[] and cardinality(share_items) > 0),
  employee_ids uuid[] not null default '{}',
  snapshot jsonb,
  consent_at timestamptz not null,
  revoked_at timestamptz,
  status text not null default 'delivered' check (status in ('delivered', 'firm-read', 'revoked')),
  created_at timestamptz not null default now()
);
comment on table public.consult_requests is '회원 상담 — 사장님이 고른 항목만 사본으로 저장, 철회하면 내용을 지운다';

create table public.guest_consults (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid references public.firms (id) on delete set null,
  nickname text not null check (char_length(nickname) between 1 and 30),
  phone_ciphertext bytea not null,
  phone_masked text not null,
  phone_key text not null,
  contact_time text not null check (char_length(contact_time) between 1 and 60),
  topic text not null,
  summary text not null default '',
  consent_collect_at timestamptz not null,
  consent_provide_at timestamptz not null,
  created_at timestamptz not null default now(),
  purge_after date not null default (current_date + 180)
);
comment on table public.guest_consults is '비회원 상담 신청 — 번호는 암호화 저장, 보유 기간(예시 6개월, 확정 전) 후 파기';
create index guest_consults_key_idx on public.guest_consults (phone_key, created_at);

create table public.review_comments (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  target text not null,
  comment text not null check (char_length(comment) between 1 and 1000),
  at timestamptz not null default now()
);
comment on table public.review_comments is '노무법인 규칙·FAQ 검수 의견 — 값은 바꾸지 못한다';

-- ───────────────────────── 운영 ─────────────────────────
create table public.admin_access_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references auth.users (id) on delete set null,
  screen text not null,
  at timestamptz not null default now()
);

-- 외래키 인덱스 (조회·연쇄 삭제 성능)
create index condition_acks_cond_idx on public.condition_acks (condition_id);
create index invites_emp_idx on public.invites (employee_id);
create index substitutions_from_idx on public.substitutions (from_employee_id);
create index substitutions_to_idx on public.substitutions (to_employee_id);
create index shift_overrides_wp_idx on public.shift_overrides (workplace_id, date);
create index shift_overrides_sub_idx on public.shift_overrides (substitution_id);
create index attendance_emp_idx on public.attendance_records (employee_id);
create index attendance_edits_wp_idx on public.attendance_edits (workplace_id);
create index leave_requests_wp_idx on public.leave_requests (workplace_id);
create index payroll_manual_emp_idx on public.payroll_manual (employee_id);
create index payroll_lines_emp_idx on public.payroll_lines (employee_id);
create index payroll_lines_wp_idx on public.payroll_lines (workplace_id);
create index payroll_edits_payroll_idx on public.payroll_edits (payroll_id);
create index statement_emp_idx on public.statement_deliveries (employee_id);
create index statement_wp_idx on public.statement_deliveries (workplace_id);
create index insurance_reports_wp_idx on public.insurance_reports (workplace_id);
create index insurance_notices_emp_idx on public.insurance_notices (employee_id, from_month);
create index doc_records_emp_idx on public.doc_records (employee_id);
create index doc_requests_wp_idx on public.doc_requests (workplace_id);
create index doc_requests_emp_idx on public.doc_requests (employee_id);
create index custom_forms_wp_idx on public.custom_forms (workplace_id);
create index notifications_emp_idx on public.notifications (employee_id);
create index offboarding_wp_idx on public.offboarding_progress (workplace_id);
create index consult_wp_idx on public.consult_requests (workplace_id);
create index consult_firm_idx on public.consult_requests (firm_id);
create index guest_firm_idx on public.guest_consults (firm_id);
create index review_firm_idx on public.review_comments (firm_id);
create index workplaces_firm_idx on public.workplaces (partner_firm_id);
create index firm_members_user_idx on public.firm_members (user_id);
create index foreign_info_wp_idx on public.employee_foreign_info (workplace_id);
create index work_conditions_wp_idx on public.work_conditions (workplace_id);
create index payroll_edits_emp_idx on public.payroll_edits (employee_id);
create index review_author_idx on public.review_comments (author_id);
create index attendance_edits_by_idx on public.attendance_edits (by_user);
create index admin_log_idx on public.admin_access_log (admin_id);
