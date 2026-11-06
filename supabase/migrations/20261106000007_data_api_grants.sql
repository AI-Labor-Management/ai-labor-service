-- Data API 권한 — 이 프로젝트는 새 테이블에 anon/authenticated/service_role 권한을 자동으로 주지 않는다.
-- 행 단위 접근은 RLS 정책이 정하고, 여기서는 역할이 표에 접근할 수 있는지만 연다.
--   authenticated: 모든 표에 조회·쓰기 권한 + RLS (정책이 없는 동작은 행이 0개이거나 거부됨)
--   service_role : Edge Function 서버 전용 (RLS 우회 — 함수 안에서 권한 확인 후 사용)
--   anon         : 표 권한 없음 (submit_guest_consult RPC만)
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to service_role;

-- 앞으로 만들 표·함수도 같은 원칙
alter default privileges for role postgres in schema public grant select, insert, update, delete on tables to authenticated, service_role;
alter default privileges for role postgres in schema public revoke execute on functions from public;
