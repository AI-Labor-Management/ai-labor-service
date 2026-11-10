-- 가게 QR 출퇴근 (2026-11-10, 운영자 결정: GPS 대신 QR)
-- 위치(좌표·반경)를 받지 않는다. 직원이 가게의 QR을 찍어 출퇴근 화면을 열면 서버가 코드를 확인해 '가게에서 확인'으로 남긴다.
--  · secret: 화면 QR(30초마다 바뀜) HMAC 비밀 값 · poster_token: 인쇄용 고정 코드(사장님이 새로 발급하면 예전 것 무효)
-- 직원이 비밀 값을 알면 가게 밖에서 코드를 만들 수 있으므로 함수(service_role)만 읽는다. 사장님은 api owner/clock-qr로 지금 코드만 받는다.
create table public.clock_qr_keys (
  workplace_id uuid primary key references public.workplaces (id) on delete cascade,
  secret text not null check (char_length(secret) between 32 and 128),
  poster_token text not null check (poster_token ~ '^P[2-9A-HJ-NP-Z]{11}$'),
  poster_issued_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
comment on table public.clock_qr_keys is '가게 QR 출퇴근 비밀 값·인쇄용 코드 — 함수만 읽는다';
alter table public.clock_qr_keys enable row level security;
revoke all on public.clock_qr_keys from anon, authenticated;
grant select, insert, update, delete on public.clock_qr_keys to service_role;

-- 출퇴근 기록 출처에 'qr'(가게 QR 확인)을 더한다. gps 칸은 '현장 확인' 결과(inside = 가게에서 확인, outside = 확인 안 됨)로 같이 쓴다
alter table public.attendance_records drop constraint attendance_records_source_check;
alter table public.attendance_records add constraint attendance_records_source_check check (source in ('gps-demo', 'gps', 'manual', 'owner', 'qr'));
