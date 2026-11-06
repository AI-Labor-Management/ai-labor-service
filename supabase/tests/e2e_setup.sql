-- E2E 시험용 임시 계정 4개 만들기 (사장님·직원·노무법인·탈퇴 시험). 가상 이메일(example.test)만 쓴다.
-- 개발 프로젝트에서만 실행하세요. 결과의 password를 E2E_PASSWORD 환경변수로 넘기고, 끝나면 e2e_cleanup.sql로 지웁니다.
-- 직원 계정은 시험 안에서 초대 링크(create_invite → accept_invite)로 연결됩니다.
with pw as (select 'E2e-' || encode(extensions.gen_random_bytes(12), 'hex') as p),
u as (
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current, phone_change, phone_change_token, reauthentication_token)
  select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'e2e-' || r || '@example.test',
    extensions.crypt((select p from pw), extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '', '', ''
  from unnest(array['owner', 'employee', 'firm', 'delete']) r
  returning id, email
),
i as (
  insert into auth.identities (user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
  select id, id::text, jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true), 'email', now(), now(), now() from u
  returning user_id
),
f as (
  insert into public.firm_members (firm_id, user_id)
  select (select id from public.firms order by created_at limit 1), id from u where email = 'e2e-firm@example.test'
  returning user_id
)
select (select p from pw) as password, (select count(*) from u) as users, (select count(*) from i) as identities, (select count(*) from f) as firm_members;
