-- 특일정보 API(한국천문연구원, 공공데이터포털)에서 받은 공휴일
-- 앱 내장 목록(원문과 대조한 2026·2027년)이 우선이고, 내장 목록에 없는 날(2028년부터 등)에만 쓴다.
-- cron-daily가 매달 1일(또는 다음 해 자료가 없을 때) 올해·내년을 받아 바꾼다. 공개 정보라 누구나 읽을 수 있다.
create table public.holidays_api (
  date date primary key,
  name text not null check (char_length(name) <= 60),
  fetched_at timestamptz not null default now()
);
comment on table public.holidays_api is '특일정보 API 공휴일 — 내장 목록에 없는 해(2028~)를 채운다. cron-daily가 매달 갱신';
alter table public.holidays_api enable row level security;
create policy holidays_api_read on public.holidays_api for select to anon, authenticated using (true);
revoke insert, update, delete on public.holidays_api from anon, authenticated;
grant select, insert, update, delete on public.holidays_api to service_role;
