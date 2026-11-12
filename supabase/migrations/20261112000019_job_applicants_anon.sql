-- 19: 채용 지원 접수 — 사장님 전용 함수를 로그인 안 한 사람(anon)이 부르지 못하게
--  Supabase 기본 설정이 public 스키마 새 함수에 anon 실행 권한을 직접 주므로, 18의 'from public' 회수만으로는 남는다.
--  (anon이 불러도 my_workplace_id()가 없어 '공고를 찾을 수 없어요'로 끝나지만, 권한 자체를 거둔다)
revoke execute on function public.create_job_post(text, jsonb, date), public.close_job_post(uuid), public.owner_job_posts(),
  public.owner_job_applicants(uuid), public.set_job_applicant_status(uuid, text), public.delete_job_applicant(uuid) from anon;
revoke execute on function app.my_workplace_id() from anon;
