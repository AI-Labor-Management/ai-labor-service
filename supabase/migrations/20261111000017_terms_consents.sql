-- 이용약관 동의 기록 — 누가, 어느 판(시행일)의 약관에, 언제 동의했는지 남긴다.
--  · 이메일 가입: 가입 화면에서 동의한 판을 가입 정보(raw_user_meta_data.terms_version)로 보내면 계정이 생길 때 기록한다 (서버 시각).
--  · 카카오 가입·기존 계정·약관이 바뀐 뒤: 로그인 후 동의 화면에서 accept_terms(판)를 부른다.
--  · 판 목록(terms_versions)에 있는 판만 받는다 — 화면이 아무 날짜나 보내 앞으로의 재동의를 건너뛰지 못하게.
--  · 탈퇴하면 계정과 함께 지운다 (auth.users on delete cascade). 처리방침 '회원 가입·로그인' 항목.
create table public.terms_versions (
  version text primary key check (version ~ '^\d{4}-\d{2}-\d{2}$'),
  effective_on date not null,
  note text not null default ''
);
comment on table public.terms_versions is '이용약관 판 목록 (version = 시행일 YYYY-MM-DD). 약관을 바꾸면 새 판을 넣는다';
insert into public.terms_versions (version, effective_on, note) values ('2026-11-11', '2026-11-11', '최초 제정');

create table public.terms_consents (
  user_id uuid not null references auth.users (id) on delete cascade,
  terms_version text not null references public.terms_versions (version),
  agreed_at timestamptz not null default now(),
  method text not null check (method in ('signup', 'app')),
  primary key (user_id, terms_version)
);
comment on table public.terms_consents is '이용약관 동의 기록 (계정·약관 판·동의 시각·방법) — 탈퇴 시 함께 삭제';

alter table public.terms_versions enable row level security;
alter table public.terms_consents enable row level security;
revoke all on public.terms_versions from anon, authenticated;
revoke all on public.terms_consents from anon, authenticated;
grant select on public.terms_versions to authenticated;
grant select on public.terms_consents to authenticated;
grant select, insert, update, delete on public.terms_versions, public.terms_consents to service_role;
create policy terms_versions_read on public.terms_versions for select to authenticated using (true);
-- 자기 기록만 읽는다. 쓰기는 아래 함수(서버 시각)로만
create policy terms_consents_self_select on public.terms_consents for select to authenticated using (user_id = (select auth.uid()));

-- 계정이 생길 때: 프로필(기존) + 가입 화면에서 동의한 약관 판 기록
create or replace function app.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_terms text := new.raw_user_meta_data ->> 'terms_version';
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'name', ''), 40))
  on conflict (id) do nothing;
  if v_terms is not null and exists (select 1 from public.terms_versions where version = v_terms) then
    insert into public.terms_consents (user_id, terms_version, agreed_at, method)
    values (new.id, v_terms, now(), 'signup')
    on conflict (user_id, terms_version) do nothing;
  end if;
  return new;
end $$;

-- 로그인한 사람이 지금 약관 판에 동의 (이미 동의했으면 처음 동의 시각을 그대로 돌려준다)
create or replace function public.accept_terms(p_version text) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_at timestamptz;
begin
  if v_uid is null then
    raise exception '로그인이 필요해요' using errcode = '28000';
  end if;
  if not exists (select 1 from public.terms_versions where version = p_version) then
    raise exception '알 수 없는 약관 판이에요. 화면을 새로 고친 뒤 다시 시도해 주세요' using errcode = '22023';
  end if;
  insert into public.terms_consents (user_id, terms_version, agreed_at, method)
  values (v_uid, p_version, now(), 'app')
  on conflict (user_id, terms_version) do nothing;
  select agreed_at into v_at from public.terms_consents where user_id = v_uid and terms_version = p_version;
  return v_at;
end $$;
comment on function public.accept_terms(text) is '로그인한 사람이 약관 판에 동의 — 서버 시각으로 기록, 이미 동의했으면 처음 시각';
revoke all on function public.accept_terms(text) from public, anon;
grant execute on function public.accept_terms(text) to authenticated;
