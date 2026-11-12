-- 18: 채용 지원 접수 (2026-11-12, 운영자 결정)
--  · 사장님이 채용 화면에서 '지원 링크'를 만들면 공고 1건(job_posts)과 추측할 수 없는 토큰이 생긴다
--  · 지원자는 로그인 없이 /apply?t=토큰 에서 4가지만 남긴다: 부를 이름 · 연락처 · 가능한 요일·시간 · 한 줄 소개
--  · 연락처는 Vault 키로 암호화(pgp_sym), 같은 공고에 같은 연락처는 한 번만 (HMAC 키)
--  · 개인정보처리자는 사장님, 사람샘각은 대신 보관(처리 위탁). 처리방침 개정 시행일(2026-11-19) 전에는 접수하지 않는다
--  · 채용 마감(사장님이 마감하거나 마감일이 지남) 30일 뒤 공고와 지원자를 함께 지운다 (pg_cron 매일)
--  · 표는 직접 읽고 쓸 수 없고, 아래 함수로만 다룬다 (사장님 확인은 owner_id = auth.uid())

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'applicant_contact_key') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'applicant_contact_key', '채용 지원자 연락처 암호화·HMAC 키');
  end if;
end $$;

insert into public.app_settings (key, value, note) values
  ('hiring_intake_from', '"2026-11-19"'::jsonb, '채용 지원 접수 시작일 — 개인정보 처리방침 개정 시행일 (2026-11-12 공개 + 7일)')
on conflict (key) do nothing;

create table public.job_posts (
  id uuid primary key default gen_random_uuid(),
  workplace_id uuid not null references public.workplaces (id) on delete cascade,
  token text not null unique,
  shop_name text not null default '' check (char_length(shop_name) <= 60),
  job text not null default '' check (char_length(job) <= 40),
  summary jsonb not null default '{}'::jsonb,
  closes_on date not null,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);
create index job_posts_workplace on public.job_posts (workplace_id, created_at desc);

create table public.job_applicants (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.job_posts (id) on delete cascade,
  workplace_id uuid not null references public.workplaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 20),
  contact_ciphertext bytea not null,
  contact_masked text not null,
  contact_key text not null,
  availability jsonb not null,
  intro text not null default '' check (char_length(intro) <= 100),
  consent_at timestamptz not null,
  status text not null default 'new' check (status in ('new', 'contacted', 'hired', 'declined')),
  created_at timestamptz not null default now(),
  unique (post_id, contact_key)
);
create index job_applicants_post on public.job_applicants (post_id, created_at);

alter table public.job_posts enable row level security;
alter table public.job_applicants enable row level security;
-- 직접 접근 없음: 정책을 두지 않고 권한도 거둔다 (함수만 security definer로 다룬다)
revoke all on table public.job_posts, public.job_applicants from anon, authenticated;
grant all on table public.job_posts, public.job_applicants to service_role;

/** 공고 시작일 (처리방침 개정 시행일) */
create or replace function app.hiring_intake_from() returns date
language sql stable security definer set search_path = '' as $$
  select coalesce((select (s.value #>> '{}')::date from public.app_settings s where s.key = 'hiring_intake_from'), date '2026-11-19');
$$;

create or replace function app.my_workplace_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select w.id from public.workplaces w where w.owner_id = (select auth.uid());
$$;

/** 지원 링크 만들기 — 공고 요약(시급·근무 요일·시간 등)은 지원 페이지에 그대로 보인다. 마감일은 오늘부터 90일 안 */
create or replace function public.create_job_post(p_job text, p_summary jsonb, p_closes_on date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_wp uuid := app.my_workplace_id();
  v_name text;
  v_token text;
  v_id uuid;
begin
  if v_wp is null then raise exception '사업장을 먼저 만들어 주세요'; end if;
  if p_closes_on is null or p_closes_on < app.kst_today() or p_closes_on > app.kst_today() + 90 then
    raise exception '마감일은 오늘부터 90일 안으로 골라 주세요';
  end if;
  if jsonb_typeof(coalesce(p_summary, '{}'::jsonb)) <> 'object' or octet_length(coalesce(p_summary, '{}'::jsonb)::text) > 4000 then
    raise exception '공고 내용이 너무 길어요';
  end if;
  if (select count(*) from public.job_posts j where j.workplace_id = v_wp and j.closed_at is null and j.closes_on >= app.kst_today()) >= 5 then
    raise exception '열려 있는 지원 링크는 5개까지예요. 다 뽑은 공고는 마감해 주세요';
  end if;
  select w.name into v_name from public.workplaces w where w.id = v_wp;
  v_token := encode(extensions.gen_random_bytes(12), 'hex');
  insert into public.job_posts (workplace_id, token, shop_name, job, summary, closes_on)
  values (v_wp, v_token, left(coalesce(v_name, ''), 60), left(btrim(coalesce(p_job, '')), 40), coalesce(p_summary, '{}'::jsonb), p_closes_on)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'token', v_token, 'closesOn', p_closes_on, 'intakeFrom', app.hiring_intake_from());
end $$;

/** 채용 마감 — 이날부터 30일 뒤 공고와 지원자를 지운다 */
create or replace function public.close_job_post(p_post uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.job_posts j set closed_at = coalesce(j.closed_at, now())
   where j.id = p_post and j.workplace_id = app.my_workplace_id();
  if not found then raise exception '공고를 찾을 수 없어요'; end if;
end $$;

/** 내 공고 목록 (지원자 수·삭제 예정일 포함) */
create or replace function public.owner_job_posts() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', j.id, 'token', j.token, 'job', j.job, 'summary', j.summary, 'closesOn', j.closes_on,
      'closedAt', j.closed_at, 'createdAt', j.created_at,
      'open', j.closed_at is null and j.closes_on >= app.kst_today(),
      'purgeOn', coalesce((j.closed_at at time zone 'Asia/Seoul')::date, j.closes_on) + 30,
      'applicants', (select count(*) from public.job_applicants a where a.post_id = j.id)
    ) order by j.created_at desc), '[]'::jsonb)
  from public.job_posts j where j.workplace_id = app.my_workplace_id();
$$;

/** 공고의 지원자 (연락처를 풀어서 사장님에게만) */
create or replace function public.owner_job_applicants(p_post uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_secret text;
begin
  if not exists (select 1 from public.job_posts j where j.id = p_post and j.workplace_id = app.my_workplace_id()) then
    raise exception '공고를 찾을 수 없어요';
  end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'applicant_contact_key';
  return coalesce((
    select jsonb_agg(jsonb_build_object(
        'id', a.id, 'name', a.name, 'contact', extensions.pgp_sym_decrypt(a.contact_ciphertext, v_secret),
        'availability', a.availability, 'intro', a.intro, 'status', a.status, 'createdAt', a.created_at
      ) order by a.created_at)
    from public.job_applicants a where a.post_id = p_post), '[]'::jsonb);
end $$;

create or replace function public.set_job_applicant_status(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('new', 'contacted', 'hired', 'declined') then raise exception '상태 값을 확인해 주세요'; end if;
  update public.job_applicants a set status = p_status where a.id = p_id and a.workplace_id = app.my_workplace_id();
  if not found then raise exception '지원자를 찾을 수 없어요'; end if;
end $$;

create or replace function public.delete_job_applicant(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.job_applicants a where a.id = p_id and a.workplace_id = app.my_workplace_id();
  if not found then raise exception '지원자를 찾을 수 없어요'; end if;
end $$;

/** 지원 페이지가 보여 줄 공고 요약 (로그인 없이). 연락처·지원자 정보는 없다 */
create or replace function public.job_post_public(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce((select jsonb_build_object(
      'found', true, 'shopName', j.shop_name, 'job', j.job, 'summary', j.summary, 'closesOn', j.closes_on,
      'open', j.closed_at is null and j.closes_on >= app.kst_today(),
      'intakeFrom', app.hiring_intake_from(), 'intakeOpen', app.kst_today() >= app.hiring_intake_from())
    from public.job_posts j where j.token = p_token), jsonb_build_object('found', false));
$$;

/** 지원하기 (로그인 없이). 시행일 전·마감 뒤에는 받지 않는다. 같은 공고에 같은 연락처는 한 번만, 공고당 200명까지 */
create or replace function public.submit_job_application(
  p_token text, p_name text, p_contact text, p_availability jsonb, p_intro text, p_consent boolean, p_honeypot text default ''
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_post public.job_posts;
  v_contact text := btrim(coalesce(p_contact, ''));
  v_norm text;
  v_secret text;
  v_key text;
  v_day jsonb;
  v_masked text;
begin
  if coalesce(p_honeypot, '') <> '' then
    return jsonb_build_object('accepted', false, 'reason', '자동 입력으로 보여 처리하지 않았어요');
  end if;
  select * into v_post from public.job_posts j where j.token = p_token;
  if v_post.id is null then raise exception '지원 링크를 찾을 수 없어요. 사장님께 링크를 다시 받아 주세요'; end if;
  if app.kst_today() < app.hiring_intake_from() then
    raise exception '%부터 지원을 받아요', to_char(app.hiring_intake_from(), 'FMMM"월" FMDD"일"');
  end if;
  if v_post.closed_at is not null or v_post.closes_on < app.kst_today() then raise exception '마감된 공고예요'; end if;
  if not coalesce(p_consent, false) then raise exception '개인정보 수집·이용에 동의해야 지원할 수 있어요'; end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 20 then raise exception '부를 이름을 1~20자로 적어 주세요 (별칭도 돼요)'; end if;
  if char_length(coalesce(p_intro, '')) > 100 then raise exception '한 줄 소개는 100자까지예요'; end if;
  -- 연락처: 휴대폰 번호(숫자만 남김) 또는 이메일
  if v_contact ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(v_contact) <= 80 then
    v_norm := lower(v_contact);
    v_masked := left(v_norm, 2) || '***@' || split_part(v_norm, '@', 2);
  else
    v_norm := regexp_replace(v_contact, '[^0-9]', '', 'g');
    if v_norm !~ '^01[016789][0-9]{7,8}$' then raise exception '연락처는 휴대폰 번호(예: 010-1234-5678)나 이메일로 적어 주세요'; end if;
    v_masked := substr(v_norm, 1, 3) || '-****-' || right(v_norm, 4);
  end if;
  -- 가능한 요일·시간: 월~일 7칸, 칸마다 null 또는 {start:'HH:MM', end:'HH:MM'}
  if p_availability is null or jsonb_typeof(p_availability) <> 'array' or jsonb_array_length(p_availability) <> 7 then raise exception '가능한 요일·시간을 확인해 주세요'; end if;
  for v_day in select value from jsonb_array_elements(p_availability) loop
    if jsonb_typeof(v_day) = 'null' then continue; end if;
    if jsonb_typeof(v_day) <> 'object' or coalesce(v_day ->> 'start', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or coalesce(v_day ->> 'end', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
      raise exception '가능한 시간 형식을 확인해 주세요 (예: 10:00)';
    end if;
  end loop;
  if not exists (select 1 from jsonb_array_elements(p_availability) e where jsonb_typeof(e.value) = 'object') then
    raise exception '가능한 요일을 하나 이상 골라 주세요';
  end if;
  if (select count(*) from public.job_applicants a where a.post_id = v_post.id) >= 200 then raise exception '이 공고는 지원자가 많아 더 받지 않아요'; end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'applicant_contact_key';
  if v_secret is null then raise exception '서버 설정이 끝나지 않았어요'; end if;
  v_key := encode(extensions.hmac(v_post.id::text || '|' || v_norm, v_secret, 'sha256'), 'hex');
  if exists (select 1 from public.job_applicants a where a.post_id = v_post.id and a.contact_key = v_key) then
    raise exception '이미 이 연락처로 지원했어요';
  end if;
  insert into public.job_applicants (post_id, workplace_id, name, contact_ciphertext, contact_masked, contact_key, availability, intro, consent_at)
  values (v_post.id, v_post.workplace_id, btrim(p_name), extensions.pgp_sym_encrypt(v_norm, v_secret), v_masked, v_key,
          (select jsonb_agg(case when jsonb_typeof(e.value) = 'object' then jsonb_build_object('start', e.value ->> 'start', 'end', e.value ->> 'end') else 'null'::jsonb end order by e.ordinality)
             from jsonb_array_elements(p_availability) with ordinality e),
          left(btrim(coalesce(p_intro, '')), 100), now());
  return jsonb_build_object('accepted', true);
end $$;

/** 채용 마감 30일 뒤 공고·지원자 삭제 (pg_cron 매일 00:30 UTC = 09:30 KST) */
create or replace function app.purge_job_posts() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  delete from public.job_posts j
   where coalesce((j.closed_at at time zone 'Asia/Seoul')::date, j.closes_on) + 30 < app.kst_today();
  get diagnostics n = row_count;
  return n;
end $$;
select cron.schedule('job-posts-purge', '30 0 * * *', 'select app.purge_job_posts()');

revoke all on function app.hiring_intake_from(), app.my_workplace_id(), app.purge_job_posts() from public, anon, authenticated;
grant execute on function app.hiring_intake_from(), app.my_workplace_id() to authenticated, anon;
revoke all on function public.create_job_post(text, jsonb, date), public.close_job_post(uuid), public.owner_job_posts(),
  public.owner_job_applicants(uuid), public.set_job_applicant_status(uuid, text), public.delete_job_applicant(uuid),
  public.job_post_public(text), public.submit_job_application(text, text, text, jsonb, text, boolean, text) from public;
grant execute on function public.create_job_post(text, jsonb, date), public.close_job_post(uuid), public.owner_job_posts(),
  public.owner_job_applicants(uuid), public.set_job_applicant_status(uuid, text), public.delete_job_applicant(uuid) to authenticated;
grant execute on function public.job_post_public(text), public.submit_job_application(text, text, text, jsonb, text, boolean, text) to anon, authenticated;
