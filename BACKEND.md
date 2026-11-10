# 백엔드 (Supabase) — 구조·API·권한

프론트엔드와 같은 데이터 모델(`src/domain/types.ts`의 `AppState`)과 같은 계산 엔진(`src/domain`)으로 서버를 만들고, 화면을 "서버 모드"로 연결했습니다(12장). 배포·운영 절차는 [`DEPLOY.md`](DEPLOY.md)를 보세요.

> **현재 상태 (2026-11-06)**: 백엔드 배포·시험 완료, **프론트엔드 연결 완료**. 시작 화면에서 "로그인 없이 둘러보기"(기존 로컬 데모, 기본값) 또는 "로그인해서 서버에 저장"을 고릅니다. 시험 운영이라 가상 데이터만 쓰세요. 카카오·AI·법제처·비회원 실제 접수는 꺼져 있습니다. Auth URL은 설정했고 시험 기간이라 Confirm email은 꺼 두었습니다 — 실제 사용자를 받기 전에 SMTP를 연결하고 다시 켜세요([`DEPLOY.md`](DEPLOY.md) 0·4장).

| 항목 | 값 |
|---|---|
| Supabase 프로젝트 | `nomu-service-seoul` (ref `smbxhspzflnvncatdgjs`) |
| 주소 | `https://smbxhspzflnvncatdgjs.supabase.co` |
| 리전 | `ap-northeast-2` (서울). 2026-11-06 시드니 프로젝트(`htdnyekvbuncuweeqpmn`, 일시정지)에서 데이터 없이 옮김 |
| 요금제 | Free |

## 1. 구성

```
브라우저(프론트, 연결 예정)
  ├─ Supabase Auth ── 로그인(JWT)
  ├─ PostgREST(/rest/v1) ── 단순 입력·조회. RLS가 행 단위로 막음
  │     └─ RPC(/rest/v1/rpc/*) ── 직원 셀프서비스·노무법인·초대 등 (SECURITY DEFINER, 함수 안에서 권한 확인)
  └─ Edge Functions(/functions/v1/*)
        ├─ api          로그인 필요. 계산·여러 표·알림이 함께 움직이는 일 (급여 확정, 일정 변경, 출퇴근 …)
        ├─ public-api   로그인 없이. 규칙 조회·자가진단·채용 전 점검(저장 안 함)·비회원 상담(지금은 demo)
        └─ cron-daily   하루 1번 09:00 KST. 기한 알림 + 보관 기간 정리
Postgres
  ├─ public  36개 표 + RLS + 무결성 트리거
  ├─ app     내부 도우미(권한 판정·알림 넣기). PostgREST에 노출 안 됨
  ├─ Vault   guest_phone_key(비회원 전화번호 암호화), cron_secret
  └─ pg_cron → pg_net → cron-daily
```

계산은 **프론트와 같은 코드**입니다. `npm run build:functions`가 `src/domain`·`src/data`를 `supabase/functions/_shared/domain.js`로 묶고, 함수는 `engine.ts`(타입 계약 `engine-api.ts`)로 씁니다. DB 행 ↔ `AppState` 변환은 `_shared/mapping.ts`(`rowsToState`, `stateToInsertPlan`).

## 2. 역할 판정

역할은 별도 열이 아니라 **관계**로 정해집니다. 한 계정이 여러 역할을 가질 수 있습니다(`GET /api/me`가 모두 알려 줌).

| 역할 | 판정 | 도우미 |
|---|---|---|
| 사장님 | `workplaces.owner_id = auth.uid()` (계정당 사업장 1개) | `app.owns_workplace(wp)` |
| 직원 | `employees.user_id = auth.uid()` 이고 `account_status = 'joined'` (초대 링크 수락) | `app.is_my_employee(emp)`, `app.works_at(wp)` |
| 노무법인 | `firm_members(firm_id, user_id)` | `app.is_firm_member(firm)` |
| 관리자 | `admins(user_id)` | `app.is_admin()` |
| 비로그인 | `anon` — 표 권한 없음. `submit_guest_consult` RPC만 | — |

## 3. 표 (public, 36개)

| 묶음 | 표 |
|---|---|
| 계정·조직 | `profiles`(auth 가입 시 자동), `firms`, `firm_members`, `admins`, `admin_access_log` |
| 사업장 | `workplaces`, `busy_days`, `app_settings` |
| 직원 | `employees`(호칭·연령대만 — **실명·주민번호 없음**), `employee_foreign_info`, `invites`(토큰 해시만), `condition_acks` |
| 근로조건·일정 | `work_conditions`(변경 이력, 덮어쓰기 불가), `shift_overrides`, `substitutions`, `leave_requests` |
| 출퇴근 | `attendance_records`(원래 기록 불변), `attendance_edits`(수정 이력) |
| 급여 | `payroll_months`, `payroll_manual`(초안 입력), `payroll_lines`(확정 스냅샷, revision), `payroll_edits`, `statement_deliveries`(열람 = 수령 확인) |
| 4대보험·서류 | `insurance_reports`, `insurance_notices`, `doc_records`, `doc_requests`, `custom_forms` |
| 기한·알림·점검 | `deadline_actions`, `notifications`, `notification_log`(하루 한 번, 채널별), `risk_answers`, `offboarding_progress` |
| 상담 | `consult_requests`(고른 항목 스냅샷, 철회 가능), `guest_consults`(전화번호 암호화, 180일 뒤 삭제), `review_comments` |

### 무결성 규칙 (트리거)

- `work_conditions`, `payroll_lines`, `payroll_edits`, `attendance_edits`: **수정·삭제 불가** (서비스 역할 포함). 바꾸려면 새 행 추가.
- `attendance_records`: 원래 출퇴근 시각(`original_*`)은 한 번 채워지면 바꿀 수 없음. 고칠 때는 `attendance_edits`에 이력.
- `payroll_months`: 클라이언트는 `draft → confirmed` 상태를 직접 못 바꿈(확정은 `/api/owner/payroll/confirm`만).
- `employees.user_id`·`account_status`: 클라이언트가 직접 못 바꿈(초대 수락·앱 나가기 RPC만).
- 여러 표에서 `employee_id`가 같은 사업장 직원인지 확인(`app.check_employee_workplace`).
- 사업장 전체 삭제는 `delete_my_workplace()` 안에서만 `app.allow_purge` 플래그를 켜고 진행.

## 4. RLS 요약 (로그인 사용자 기준)

| 표 | 사장님 | 직원(본인) | 노무법인 | 관리자 |
|---|---|---|---|---|
| workplaces | 조회·추가·수정 | — (RPC `employee_context`로 이름만) | — | — |
| employees | 조회·추가(계정 미연결로만)·수정 | 본인 행 조회 | — | — |
| work_conditions | 조회·추가 | 본인 조회 | — | — |
| attendance_records | 조회·추가(source=owner)·수정 | 본인 조회 | — | — |
| attendance_edits | 조회·추가 | 본인 기록 이력 조회 | — | — |
| payroll_months / lines / statement_deliveries | 조회 (쓰기는 API) | 본인 것 조회 | — | — |
| payroll_edits, notification_log, invites | 조회 | — | — | — |
| shift_overrides, employee_foreign_info | 전부 | 본인 조회 | — | — |
| substitutions | 전부 | 본인 관련 + 같은 사업장 공개 요청 조회 | — | — |
| leave_requests | 조회·추가(사장님 등록분)·수정 | 본인 조회 (신청은 RPC) | — | — |
| condition_acks | 조회·수정 | 본인 조회 (확인은 RPC) | — | — |
| notifications | 사장님 알림 조회·읽음 | 본인 알림 조회·읽음 | — | — |
| busy_days, custom_forms, deadline_actions, doc_*, insurance_*, offboarding_progress, payroll_manual, risk_answers | 전부 | — | — | — |
| consult_requests | 조회 (보내기는 API, 철회는 RPC) | — | 철회 안 된 것만 조회 | — |
| guest_consults | — | — | RPC `firm_guest_consults`만 | — |
| review_comments | — | — | 조회·추가 | 조회 |
| firms / firm_members / admins / admin_access_log | 공개 법인 조회 | 공개 법인 조회 | 소속 조회 | 조회 |

`supabase/tests/rls_isolation.sql`이 위 표의 핵심 49개 항목을 실제 역할로 바꿔 가며 확인합니다(다른 사장님·직원 간 격리, 덮어쓰기 차단, 초대 토큰, 철회 가림 등).

## 5. Edge Function `api` (로그인 필요)

`Authorization: Bearer <access_token>` + `apikey: <publishable key>`. 오류는 `{ "error": "...", "detail"?: ... }`와 상태 코드(400 입력, 401 로그인, 403 권한, 404 없음, 409 충돌).

| 메서드 | 경로 `/functions/v1/api/...` | 내용 |
|---|---|---|
| GET | `health` | 상태 (토큰 불필요) |
| GET | `me` | 내 역할(사장님·직원·노무법인·관리자) |
| POST | `account/delete` | 회원 탈퇴 `{"confirm":"탈퇴"}` — 사장님 사업장 전체 삭제 → 직원 앱 연결 해제(사장님 쪽 기록 유지) → 로그인 계정 삭제. 되돌릴 수 없음 |
| POST | `owner/consult/answer` `{question}` | AI 노무 상담. **기본: 무료 Google Gemini** (`gemini-3.6-flash` → 실패 시 `gemini-3.5-flash-lite`, 비밀 값 `GEMINI_API_KEY`, 처리방침 시행일 2026-11-15부터) — 무료 등급은 웹 검색 근거가 없어 앱의 검증된 규칙 44개·FAQ를 자료로 넘기고 그 번호만 근거로 받는다(`ai-ground.ts`, 근거 없으면 근거 부족). **선택: Claude** (`ANTHROPIC_API_KEY`, 유료, 기본 `claude-haiku-5-5`·공식 사이트 web_search 2회, `ANTHROPIC_MODEL`로 바꿈; 크레딧이 떨어지면 503 `AI_CREDIT_EMPTY`). 둘 다 있으면 Gemini, `AI_PROVIDER=anthropic`이면 Claude. health의 `aiProvider`로 확인. 질문 2~500자·개인정보 패턴 거절(422), 사업장 필요, 키 없으면 503 `AI_NOT_CONFIGURED`, 하루 20회 넘으면 429. 응답 `{status, text, citations, usedToday, dailyLimit}`. 질문·답 저장 안 함 (`api/ai.ts`) |
| POST | `owner/seed-demo` `{replace?, baseDate?}` | 가상 시드(카페 샘터·직원 A·B·C) 넣기. `replace:true`면 기존 데이터 전부 지우고 다시 |
| GET | `owner/state` | 사업장 전체 `AppState` + 화면에 없는 DB id(`ids.workplaceId`, `ids.payrollIdByMonth`) — 서버 모드 화면이 읽음 |
| GET | `owner/home?date=` | 할 일·영역별 수·위험·이번 달 예상·오늘 근무 |
| GET | `owner/checklist?date=` | 서류 체크리스트 |
| GET | `owner/deadlines?date=` / `owner/deadlines.ics` | 기한 목록 / 캘린더 파일 |
| GET | `owner/payroll?month=YYYY-MM` | 급여 초안 또는 확정 스냅샷(최신 revision), 확인 대기 근무 |
| GET | `owner/insurance`, `owner/leave`, `owner/risk`, `owner/foreign` | 4대보험 판정·예상액, 연차, 위험 점검, 외국인 체류 신호 |
| GET | `owner/severance?employeeId=` | 퇴직금 추정 |
| POST | `owner/payroll/confirm` `{month, allowPending?}` | 확정(스냅샷·명세서 교부·직원 알림). 두 번 눌러도 한 번 |
| POST | `owner/payroll/edit` `{month, employeeId, kind: adjust\|incomeTax\|localTax, label?, amount, reason}` | 확정 후 수정 → 새 revision + 수정 이력 + 재교부. 지각 벌금·파손 공제는 거절 |
| POST | `owner/conditions` `{employeeId, effectiveFrom, hourlyWage, schedule[7] \| variable+variableWeeklyHours, reason, …}` | 근로조건 변경(새 이력 행). 최저임금 판정 함께 반환 |
| POST | `owner/schedule/override` `{employeeId, date, kind: change\|extra\|absent\|leave\|sub\|reset, …}` | 하루 일정 변경·결근·연차·대타 지정·되돌리기 |
| POST | `owner/attendance/decide` `{recordId, approval: actual\|planned}` | 확인 대기 기록 확정 |
| POST | `owner/attendance/edit` `{recordId, clockIn, clockOut, reason}` | 수정(원래 기록 보존 + 이력) |
| POST | `owner/attendance/manual` `{employeeId, date, clockIn, clockOut, reason}` | 사장님 직접 기록 |
| POST | `owner/substitution/decide` `{id, approve}` | 직원끼리 대타 승인·거절 |
| POST | `owner/leave/decide` `{id, approve, reason?}` | 연차 승인·조정 요청 |
| POST | `owner/consult` `{topic, question, shareItems[], employeeIds[], consent:true}` | 노무법인에 보내기(고른 항목만 스냅샷). 질문에 전화번호·주민번호 등이 있으면 거절 |
| GET | `employee/me?employeeId=` | 직원 본인 화면 데이터(일정·근로조건·출퇴근·명세서·연차·대타·알림). 다른 직원 정보 없음 |
| GET | `employee/state?employeeId=` | 서버 모드 직원 화면용 `AppState` — 본인 데이터만, 다른 직원은 대타 요청에 보이는 별칭만. 서류·보험·상담은 비움 |
| POST | `employee/clock` `{kind: in\|out, qr?: 코드}` | 출퇴근. **시각은 서버(KST)** — `client_clock_time_allowed`가 켜져야 `time`을 받음. **가게 QR**(2026-11-10부터): 직원이 찍어 온 코드(화면 QR 5분 안·지금 유효한 인쇄 QR)를 서버가 확인하면 `source qr`·`gps inside`로 바로 판정, 없거나 틀리면 `manual`·`outside` → 사장님 확인. 위치(좌표·반경)는 받지 않음 — 예전 `gps` 값은 무시 |
| GET | `owner/clock-qr` | 사장님 · 지금 화면 QR 코드(30초마다 바뀜)·주소, 인쇄용 코드. 비밀 값(`clock_qr_keys.secret`)은 내보내지 않음 |
| POST | `owner/clock-qr/poster` | 사장님 · 인쇄용 QR 새로 발급 (예전 인쇄물 무효) |

## 6. Edge Function `public-api` (로그인 없음)

| 메서드 | 경로 `/functions/v1/public-api/...` | 내용 |
|---|---|---|
| GET | `health` | 상태 + 규칙 파일 정보(44개) |
| GET | `rules?date=` | 규칙 원본, 또는 기준일의 값 |
| GET | `faq`, `checklist-items`, `holidays` | 정적 데이터 |
| GET | `events/regions[?sido=11]` | 지역 행사 — 시도 목록 또는 그 시도의 시군구 목록 (한국관광공사 ldongCode2, 24시간 기억) |
| GET | `events?sido=26&sigungu=500&from=YYYY-MM-DD&days=35` | 지역 행사 — 그 기간에 열리는(진행 중 포함) 축제·행사, 제목·기간·주소만 (6시간 기억, 지역은 저장하지 않음) |
| POST | `diagnosis` | 7문항 자가진단 (저장 안 함) |
| POST | `precheck` `{hourlyWage, schedule[7], scale?, industry?, ageBand?, contractTerm?, isForeign?}` | 채용 전 점검: 주휴·월 예상·4대보험 (저장 안 함) |
| POST | `guest-consult` `{nickname, phone, contactTime, topic?, summary?, consentCollect, consentProvide}` | 비회원 상담. `guest_consult_intake`가 꺼져 있으면 저장하지 않고 `{mode:"demo"}` |

## 7. RPC (`POST /rest/v1/rpc/<이름>`)

| 누가 | RPC |
|---|---|
| 사장님 | `create_invite(p_employee_id)` → 토큰(원문은 이때만, DB에는 해시) · `revoke_consult(p_id)` · `delete_employee_if_unpaid(p_employee_id)` · `delete_my_workplace()` |
| 직원 | `accept_invite(p_token)` · `employee_context()` · `ack_conditions(p_condition_id, p_status, p_memo)` · `set_location_consent(p_employee_id, p_consent, p_version)` · `set_my_lang` · `leave_employee_app` · `respond_attendance_edit(p_edit_id, confirmed\|disputed, p_memo)` · `dispute_attendance` · `request_leave(p_employee_id, p_date, p_hours)` · `request_substitution` · `apply_substitution` · `mark_statement_viewed(p_delivery_id)` · `dispute_statement` |
| 노무법인 | `firm_consult_inbox()`(철회 건은 내용 가림) · `firm_mark_consult_read` · `firm_guest_consults()`(전화번호 복호화) · `firm_delegated_insurance()` · `firm_mark_insurance_done(p_employee_id, p_phase)` |
| 관리자 | `admin_stats()` (개인 데이터 없이 집계만) |
| 비로그인 | `submit_guest_consult(...)` — 동의 2개 필수, 하루 3회(HMAC(번호\|날짜)), 숨은 칸(봇) 차단 |
| 서버 전용 | `next_record_no`, `verify_cron_secret`, `run_retention` (service_role만) |

## 8. 설정·비밀

`public.app_settings` (모든 로그인 사용자가 읽기만 가능, 바꾸기는 SQL로):

| key | 기본 | 뜻 |
|---|---|---|
| `guest_consult_intake` | `false` | 비회원 상담 실제 저장. 처리방침·보유 기간 확정 전에는 끔 |
| `kakao_enabled` | `true` (마이그레이션 12) | 카카오톡 나에게 보내기 비상 스위치. `false`면 키가 있어도 보내지 않는다 |
| `ai_enabled` | `false` | (예전 스위치 — 쓰지 않음. AI 상담은 함수 비밀 값 `ANTHROPIC_API_KEY`가 있으면 켜진다) |
| `client_clock_time_allowed` | `false` | 출퇴근 시각을 기기 값으로 받기(시험용). 운영은 false |
| `project_url` | 프로젝트 주소 | cron이 부를 함수 주소 |

함수 비밀 값 (운영자가 대시보드 Edge Functions → Secrets에 직접 넣음, 저장소에 두지 않음):
- `GEMINI_API_KEY` — AI 노무 상담 기본(무료, Google AI Studio에서 발급). `GEMINI_MODEL`로 모델 변경
- `ANTHROPIC_API_KEY` — AI 노무 상담 선택(유료 Claude). `ANTHROPIC_MODEL`, `AI_PROVIDER=anthropic`
- `KAKAO_REST_KEY`·`KAKAO_CLIENT_SECRET` — 카카오톡 나에게 보내기 (카카오 앱의 REST API 키·카카오 로그인 Client Secret, Supabase 카카오 로그인에 넣은 값과 같다). 켜는 순서는 사람샘각 `docs/KAKAO_ALERTS_SETUP.md`

카카오톡 알림 경로: `GET api/owner/kakao`(상태) · `POST api/owner/kakao/start`(동의 주소, 처리방침 시행일 `KAKAO_POLICY_FROM`(2026-11-08, 운영자 결정으로 바로 시행) 전에는 409) · `POST api/owner/kakao/test`(시험 발송) · `POST api/owner/kakao/disconnect` · `GET public-api/kakao/callback`(카카오 Redirect URI). 갱신 토큰은 `kakao_links`에 Vault 키로 암호화해 두고 서비스 역할만 읽는다. cron-daily가 앱 안 알림과 같은 내용을 하루 한 번 보내고, 만료 한 달 안쪽 토큰은 미리 갱신한다.

Vault: `guest_phone_key`(pgcrypto 대칭 암호화·HMAC 키), `cron_secret`(cron-daily 호출 헤더). 둘 다 DB 안에서 생성되어 저장소·환경변수에 없습니다.

## 9. 예약 실행

`pg_cron` 잡 `labor-daily-alerts` (`0 0 * * *` = 매일 09:00 KST) → `app.call_cron_daily()` → `pg_net`으로 `cron-daily` 호출(`x-cron-secret`).

- 기한 규칙: 30·7·3일 전 + 당일, 매달 반복(급여일)은 3일 전·당일, 기한이 지나면 다음 날 한 번.
- 사업장마다 앱 안 알림 1건(묶음) + `notification_log`(같은 기한·같은 날 한 번). 카카오는 `not-connected`로 기록만 하고 **보내지 않음**.
- 끝에 `run_retention()`: 알림 발송 기록 90일, 비회원 연락처 180일(`purge_after`), 퇴사 3년 지난 직원 데이터(급여 스냅샷·명세서 포함) 삭제.

## 10. 시험

| 시험 | 방법 | 결과 (2026-11-06) |
|---|---|---|
| 단위 (계산·변환·동기화) | `npm test` — `tests/backend/mapping.test.ts`(시드 → DB 행 → 다시 AppState가 할 일·기한·체크리스트·급여·위험에서 같음), `engine-api.test.ts`(타입 계약), `tests/sync.test.ts`(화면 변경 → 서버 요청 계획) | 90개 통과 |
| 화면 코드 ↔ 실서버 | `e2e_setup.sql` → `E2E_PASSWORD=… npx vitest run tests/live` → `e2e_cleanup.sql`. 프론트엔드의 실제 `server.ts`·`sync.ts`로 사장님·직원·노무법인 흐름을 보내고 다시 읽어 확인 | 7개 시나리오 통과 (설정·직원 추가/삭제·일정·서류·기한·위험 점검·출퇴근 확정/수정/직접 기록·급여 입력/확정/수정·대타·상담/철회·초대·직원 확인/위치 동의/출근(서버 시각)/명세서 열람·노무법인 읽음/보험 처리/의견) |
| 타입 | `npm run typecheck`, `cd supabase/functions && npx deno check --config deno.json api/index.ts public-api/index.ts cron-daily/index.ts` | 통과 |
| RLS 격리 | `supabase/tests/rls_isolation.sql`을 SQL 편집기에서 실행 → 마지막에 `RLS_TESTS_PASSED (53 checks)` 예외로 끝나며 **전부 되돌림** | 53개 통과 (aal1 노무법인·관리자 차단 포함) |
| E2E (배포본) | `e2e_setup.sql` → `node supabase/tests/e2e_api.mjs` → `e2e_cleanup.sql` (DEPLOY.md 5장) | 83개 통과 |
| 예약 실행 | `select app.call_cron_daily();` 후 `net._http_response` | 200, 급여일 D-3 알림 1건 생성, 같은 날 두 번째 실행은 중복 건너뜀, 비밀 값 없으면 401 |
| Supabase advisors | 보안·성능 | 남은 항목은 의도된 것: `guest_consults` 정책 없음(RPC로만), SECURITY DEFINER RPC 실행 가능(함수 안 권한 확인), 빈 DB라 미사용 FK 인덱스 |

E2E에서 발견해 고친 것: `respond_attendance_edit`가 잘못된 상태 값에 "사유가 필요해요"로 답하던 문제(마이그레이션 8).

## 11. 알려진 한계

| # | 한계 | 다음 할 일 |
|---|---|---|
| 2 | ~~서울 리전 아님~~ → 2026-11-06 서울 프로젝트로 이전 완료 | — |
| 3 | ~~로그인 수단: 이메일만~~ → 2026-11-07 카카오 로그인 켜짐 (닉네임 필수, 이메일·프로필 사진 선택) | 이메일 제공에 동의하지 않은 카카오 계정은 같은 사람의 이메일 계정과 별개 계정이 된다 — 합치려면 계정 연결 기능 |
| 4 | 위치 판정은 기기가 보낸 inside/outside(가상) | 카카오맵 좌표 + 서버 거리 판정 |
| 5 | 법제처 감지 미구현. 카카오톡 알림·AI 상담은 구현 — 키 입력 대기 (카카오는 2026-11-08부터 연결 가능) | 함수 비밀 값 넣기 |
| 6 | 비회원 실제 접수 꺼짐 | 처리방침(사람샘각 `/privacy`, 2026-11-07 시행)에 항목·180일 보유는 적어 둠. 협약 노무법인이 정해지면 `guest_consult_intake = true` |
| 7 | 상용 소득세 자동 계산 없음 (프론트와 동일) | 간이세액표 확보 |
| 8 | ~~노무법인·관리자 2FA 없음~~ → 2026-11-07 TOTP aal2 강제(마이그레이션 10) | 인증 앱 분실 시 운영자가 `auth.mfa_factors` 행 삭제 |
| 9 | 관리자 지정은 SQL로 (`insert into admins`) | 관리 화면 |
| 10 | ~~공개 사이트 가입: URL 미설정, 기본 메일은 팀 주소에만~~ → URL 설정, 메일은 Resend(`no-reply@saram.dreamhelixion.com`) | 사용자가 늘면 Auth Rate Limits의 시간당 메일 수(30) 조정 |
| 11 | 서버 모드에서 근로조건 이력 수정(입사일 변경 시 첫 조건 이동 등)·JSON 가져오기는 안 됨 | 화면이 "저장하지 않은 변경"으로 알림. 필요하면 새 적용일 조건 추가 |
| 12 | 서버 모드 저장 후 매번 사업장 전체를 다시 읽음 (작은 사업장 기준) | 데이터가 커지면 바뀐 표만 다시 읽기 |

## 12. 프론트엔드 연결 (서버 모드)

| 부분 | 파일 | 하는 일 |
|---|---|---|
| 방식 고르기 | `src/adapters/mode.ts` | `local`(이 브라우저만, 기본) / `server`. 빌드에 `VITE_SUPABASE_URL`·`VITE_SUPABASE_ANON_KEY`가 있을 때만 server를 고를 수 있음. 가입 확인 메일로 돌아오면 자동 server |
| 서버 연결 | `src/adapters/server.ts` | supabase-js 로그인·가입, `api`·`rpc` 호출, 역할별 읽기(`loadForSession`: 사장님 `owner/state`, 직원 `employee/state`, 노무법인 RPC 3개, 관리자 `admin_stats`), 요청 실행(`runOps`) |
| 동기화 | `src/adapters/sync.ts` | 화면은 지금처럼 `update()`만. 바뀌기 전/후 상태를 비교해 요청으로 바꿈 — 사장님: 표 쓰기(RLS) + 급여 확정·수정·직접 출퇴근 기록·상담은 `api`, 직원 삭제·상담 철회는 RPC / 직원: 본인 RPC(근로조건 확인·위치 동의·출퇴근·명세서·연차·대타·언어) / 노무법인: RPC + 검수 의견 |
| 저장소 | `src/state/store.tsx` | 화면에 먼저 반영 → 0.35초 모아 보내기 → 서버 상태 다시 읽기 → 그 사이 변경은 다시 적용. 서버가 거절하면 띠에 사유를 보이고 서버 내용으로 되돌림. 보내기 전 창을 닫으면 경고 |
| 화면 | `Start.tsx`(방식·로그인·역할), `Invite.tsx`(`/invite?token=` 초대 수락), `EmployeeDetail.tsx`(초대 링크 = `create_invite`), `EmployeePages.tsx`(출퇴근 시각 = 서버), `Admin.tsx`(서버 집계), `layouts.tsx`(서버 띠: 계정·역할 전환·저장 상태·로그아웃) | |

새 항목 id는 모두 UUID(`uid()`)라 서버 표에 그대로 들어갑니다. 계정 상태·초대·확정 급여 스냅샷·명세서 교부·기록 번호처럼 서버만 정하는 값은 화면에서 바꿔도 보내지 않고, 다시 읽을 때 서버 값으로 맞춰집니다.
