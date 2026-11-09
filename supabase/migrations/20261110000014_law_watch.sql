-- 법령 변경 감지 — rules.json이 계산에 쓰는 조문을 법제처 국가법령정보 OPEN API 원문과 대조한 결과
-- 판정: supabase/functions/_shared/lawwatch-core.ts · 실행: _shared/lawapi.ts runLawWatch (cron-daily 7일마다, 관리자 수동)
-- 법령 원문은 공개 정보이고 개인 데이터는 없다. 그래도 운영 정보라 관리자만(2단계 인증) admin_law_watch()로 본다.
create table public.law_watch (
  key text primary key check (char_length(key) <= 120),              -- '근로기준법#제56조' (조문 없이 법령만: '근로기준법 시행령#')
  law text not null,                                                 -- rules.json 이름 (줄임말)
  article text,
  law_full text not null,                                            -- 국가법령정보센터 정식 이름
  rule_ids text[] not null default '{}',                             -- 이 조문을 쓰는 규칙
  status text not null check (status in ('ok', 'changed', 'amended', 'upcoming', 'missing', 'error')),
  detail text not null default '',
  verified_no text,                                                  -- rules.json에 적은 검증 당시 공포번호
  current_no text,                                                   -- 지금 시행 중인 판의 공포번호
  current_effective date,
  text_hash text,                                                    -- 지금 조문 본문 해시
  baseline_hash text,                                                -- 검증한 판의 조문 본문 해시 (처음 본 날 기록)
  baseline_no text,
  upcoming jsonb not null default '[]',                              -- 공포됐지만 시행 전인 개정이 이 조문을 바꾸는 경우 [{effective,no,promulgated,kind,known,text}]
  article_text text check (char_length(article_text) <= 4000),       -- 지금 조문 본문 (화면 비교용)
  url text not null,
  checked_at timestamptz not null default now(),
  status_since timestamptz not null default now()
);
comment on table public.law_watch is '법령 변경 감지 — 계산에 쓰는 조문과 법제처 원문 대조 결과. 값은 자동으로 바꾸지 않는다';

create table public.law_watch_runs (
  id bigint generated always as identity primary key,
  ran_at timestamptz not null default now(),
  trigger text not null check (trigger in ('cron', 'manual')),
  checked integer not null default 0,
  flagged integer not null default 0,
  errors integer not null default 0,
  calls integer not null default 0,
  ms integer,
  notified integer not null default 0,
  newly text[] not null default '{}'
);
create index law_watch_runs_ran_at on public.law_watch_runs (ran_at desc);
comment on table public.law_watch_runs is '법령 변경 감지 실행 기록 (1년 보관)';

alter table public.law_watch enable row level security;
alter table public.law_watch_runs enable row level security;
revoke all on public.law_watch, public.law_watch_runs from anon, authenticated;
grant select, insert, update, delete on public.law_watch, public.law_watch_runs to service_role;

-- 관리자 화면 — 감지 결과와 최근 실행 기록. 호출은 접근 기록에 남는다
create or replace function public.admin_law_watch() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not app.is_admin() then
    raise exception '관리자만 볼 수 있어요' using errcode = '42501';
  end if;
  insert into public.admin_access_log (admin_id, screen) values ((select auth.uid()), 'law_watch');
  return jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(to_jsonb(w) - 'baseline_hash' - 'text_hash' order by
        case w.status when 'changed' then 0 when 'missing' then 1 when 'amended' then 2 when 'upcoming' then 3 when 'error' then 4 else 5 end, w.key)
      from public.law_watch w), '[]'::jsonb),
    'runs', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.ran_at desc)
      from (select * from public.law_watch_runs order by ran_at desc limit 5) r), '[]'::jsonb)
  );
end $$;
comment on function public.admin_law_watch() is '관리자 화면 — 법령 변경 감지 결과(공개 법령 원문, 개인 데이터 없음). 호출은 접근 기록에 남는다';
revoke all on function public.admin_law_watch() from public, anon;
grant execute on function public.admin_law_watch() to authenticated;
