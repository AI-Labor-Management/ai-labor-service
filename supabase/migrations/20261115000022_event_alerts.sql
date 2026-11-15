-- 마이그레이션 22 — 동네 행사 알림 (2026-11-15, 사람샘각 운영자 요청)
-- 사장님이 '행사 알림 받기'를 켜면 고른 지역(시·도 · 시·군·구 코드와 이름)을 사업장마다 하나 저장한다. 끄면 줄을 지운다.
-- 매일 알림(cron-daily)이 이 지역의 한국관광공사 TourAPI 축제·행사 중 3일 뒤 · 내일 시작하는 것을
-- 앱 안 알림과 카카오톡(연결한 경우)으로 알린다. 지역 코드만 TourAPI에 보내고 사용자 정보는 보내지 않는다.
-- 개인정보 처리방침 변경 시행일 전에는 서버가 켜기를 받지 않는다 (_shared/eventalerts-core.ts EVENT_ALERT_POLICY_FROM — 11-22 예정이었으나 운영자 결정으로 2026-11-15 바로 시행).

create table public.event_alerts (
  workplace_id uuid primary key references public.workplaces (id) on delete cascade,
  sido text not null check (sido ~ '^[0-9]{2}$'),
  sido_name text not null default '' check (char_length(sido_name) <= 20),
  sigungu text check (sigungu is null or sigungu ~ '^[0-9]{3}$'),
  sigungu_name text not null default '' check (char_length(sigungu_name) <= 30),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.event_alerts enable row level security;
revoke all on table public.event_alerts from anon, authenticated;
grant select, insert, update, delete on table public.event_alerts to service_role;

comment on table public.event_alerts is '동네 행사 알림 — 켠 사업장의 지역(시도·시군구). 줄이 있으면 켜짐, 끄면 삭제. 서비스 키로만 다룸';
