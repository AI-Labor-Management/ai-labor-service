-- 채용 지원 접수 시작일을 2026-11-19 → 2026-11-13 으로 앞당김 (운영자 결정 2026-11-13).
-- 개인정보 처리방침 개정(2026-11-12 알림)도 같은 날 시행 — 사람샘각 PR #74 (HIRING_INTAKE_FROM 2026-11-13).
update public.app_settings
   set value = '"2026-11-13"'::jsonb,
       note = '채용 지원 접수 시작일 — 개인정보 처리방침 개정 시행일 (2026-11-12 알림, 예정 11-19에서 운영자 결정으로 2026-11-13 앞당김)',
       updated_at = now()
 where key = 'hiring_intake_from';
