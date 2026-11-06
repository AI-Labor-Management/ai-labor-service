-- public-api 함수(서비스 역할)가 비회원 상담 RPC를 부를 수 있게 한다.
-- 20261106000003에서 PUBLIC 실행 권한을 닫으면서 service_role도 막혔던 것을 바로잡음.
grant execute on function public.submit_guest_consult(text, text, text, text, text, boolean, boolean, text) to service_role;
