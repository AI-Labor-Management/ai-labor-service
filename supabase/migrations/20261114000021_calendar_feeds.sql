-- 21: 구글 캘린더 연결 (구독 주소) — 2026-11-14, 운영자 결정
--  · 사장님이 '일정·기한'에서 연결하면 사업장마다 추측할 수 없는 토큰(32바이트, base64url 43자)이 하나 생긴다
--  · 캘린더 앱(구글·아이폰·아웃룩)이 public-api/calendar/<토큰>.ics 를 주기적으로 읽어 가 기한이 자동으로 바뀐다
--  · 다시 만들면 예전 주소는 끊긴다. 사업장을 지우면 함께 지워진다
--  · 표는 직접 읽고 쓸 수 없다 (정책 없음 · 권한 거둠). Edge Function이 서비스 키로만 다룬다 (사장님 확인은 owner_id)
create table public.calendar_feeds (
  workplace_id uuid primary key references public.workplaces (id) on delete cascade,
  token text not null unique check (token ~ '^[A-Za-z0-9_-]{43}$'),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  last_fetched_at timestamptz
);

alter table public.calendar_feeds enable row level security;
revoke all on table public.calendar_feeds from anon, authenticated;
grant select, insert, update, delete on table public.calendar_feeds to service_role;

comment on table public.calendar_feeds is '구글 캘린더 연결 구독 주소 토큰 (사업장마다 하나). 서비스 키로만 다룸';
