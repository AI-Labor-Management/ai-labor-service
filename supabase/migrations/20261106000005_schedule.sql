-- 예약 실행: 매일 09:00(KST) cron-daily 함수 호출 (기한 알림 + 보관 기간 정리)
-- 함수 주소는 프로젝트마다 달라서 app_settings.project_url에서 읽는다. 값이 없으면 호출하지 않는다.
--   설정: update public.app_settings set value = to_jsonb('https://<project-ref>.supabase.co'::text) where key = 'project_url';

insert into public.app_settings (key, value, note) values
  ('client_clock_time_allowed', 'false', '직원 출퇴근 시각을 기기가 보낸 값으로 받을지 (데모·테스트용). 운영은 false — 서버 시각 사용'),
  ('project_url', 'null', 'cron-daily 함수를 부를 프로젝트 주소 (https://<ref>.supabase.co)')
on conflict (key) do nothing;

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create or replace function app.call_cron_daily() returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_url text;
  v_secret text;
begin
  select s.value #>> '{}' into v_url from public.app_settings s where s.key = 'project_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cron_secret';
  if v_url is null or v_url = '' then
    raise notice 'project_url이 없어 cron-daily를 부르지 않았어요';
    return null;
  end if;
  return net.http_post(
    url := v_url || '/functions/v1/cron-daily',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end $$;
revoke execute on function app.call_cron_daily() from public, anon, authenticated;
comment on function app.call_cron_daily() is 'pg_cron이 매일 부른다. 비밀 값은 Vault에서 읽어 헤더로만 보낸다';

select cron.schedule('labor-daily-alerts', '0 0 * * *', 'select app.call_cron_daily()');
