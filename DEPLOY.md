# 백엔드 배포·운영 (Supabase)

구조와 API는 [`BACKEND.md`](BACKEND.md)에 있습니다. 여기서는 **새 프로젝트에 다시 올리는 방법**과 **지금 배포된 상태**를 적습니다.

## 0. 지금 배포된 상태 (2026-11-10)

| 항목 | 값 |
|---|---|
| 프로젝트 | `nomu-service-seoul` · ref `smbxhspzflnvncatdgjs` · **`ap-northeast-2` (서울)**. 처음 쓰던 시드니 프로젝트 `nomu-service`(`htdnyekvbuncuweeqpmn`)는 가입자·데이터 0인 상태에서 2026-11-06 옮긴 뒤 일시정지 |
| 마이그레이션 | `supabase/migrations/20261106000001` ~ `20261111000016` 16개 적용 (16 = AI 상담 실패 시 이용 횟수 되돌리기 `ai_refund`, 10 = 노무법인·관리자 2단계 인증 강제·관리자 접속 기록 1년, 11 = AI 상담 하루 이용 횟수 `ai_usage`·30일 정리, 12 = 카카오톡 알림 연결 `kakao_links`(갱신 토큰 Vault 키로 암호화), 13 = 특일정보 공휴일 `holidays_api`(공개 읽기), 14 = 법령 변경 감지 `law_watch`·`law_watch_runs`·`admin_law_watch()`(관리자·2단계 인증만), 15 = 가게 QR 출퇴근 `clock_qr_keys`(함수만 읽음)·출퇴근 출처 `qr`) |
| 프론트엔드 | GitHub Pages 빌드(`deploy.yml`)와 사람샘각(`AI-Labor-Management/saram-saemgak`의 `.env.production`)에 `VITE_SUPABASE_URL`·`VITE_SUPABASE_ANON_KEY`(공개 값) 포함 → 시작 화면에서 서버 모드 선택 가능 |
| Edge Functions | `api` v34 (AI 근거 자료 = 규칙 48개(출산전후휴가·배우자 출산전후휴가·육아휴직·주요 벌칙 포함)·FAQ 14개; AI 기본 = 무료 Gemini `gemini-3.6-flash` → 실패 시 3.5 Flash-Lite → 빨리 실패했으면 한 번 더, 3.6 Flash가 429(무료 하루 한도 소진)면 10분 동안 Flash-Lite부터, 답을 못 받으면 이용 횟수 되돌림, 실패 원인은 함수 로그 `[gemini]`에 모델·상태만 — 사용자 질문은 2026-11-10부터(가입자가 운영자뿐이라 11-15 예정을 앞당김) / 카카오톡 알림 2026-11-08 시행 / 관리자 `POST admin/law-watch/run`(10분에 한 번) / 점검 `health?check=ai·ai-answer·kakao·datagokr·law`), `public-api` v18 (공휴일 `holidays`·지역 행사 `events`·`events/regions`(한국관광공사 TourAPI)·카카오 콜백), `cron-daily` v16 (기한 알림·카톡 발송·공휴일 매달 1일·법령 변경 감지 7일마다 — 새 조문 12개 포함) — 서울 프로젝트. 함수 비밀 값: `GEMINI_API_KEY`, `KAKAO_REST_KEY`·`KAKAO_CLIENT_SECRET`, `DATA_GO_KR_KEY`(공공데이터포털 일반 인증키 — 앞뒤 공백은 서버가 지움), `LAW_API_OC`(법제처 OPEN API, 등록 도메인 `smbxhspzflnvncatdgjs.supabase.co`를 Referer로 보냄) |
| 함수 코드 기준 커밋 | `api` v34·`public-api` v18·`cron-daily` v16 = PR #39(출산·육아·벌칙 규칙 4개와 FAQ 4개 동기화, 사람샘각 #45) 병합 `05b3d6b` (2026-11-11, 실서버 E2E 102/103 — 실패 1개는 그 순간 Google 무료 AI 두 모델 모두 503 붐빔(AI_BUSY), 바로 뒤 새 주제 AI 질문 7개는 모두 정확히 답함). 그 전: `api` v33 = PR #37(첫 모델 429면 대체 모델부터) 병합 `db95cb2`, `api` v32 = PR #36(AI 재시도·횟수 되돌리기·자료 번호 노출 정리) `b793c7f` (2026-11-11, 실서버 질문 23개 시험: 502 0건, 실패 질문 횟수 되돌림 확인). `public-api` v17·`cron-daily` v15와 그 전 `api` v31 = PR #34(고객용 문구 정리를 계산 엔진에 반영 + 지방소득세 자동 계산) 병합 `37ce260` (2026-11-10, 실서버 E2E 103개 통과). 그 전: `api` v30 = PR #33(AI 상담 11-10부터) `4ed41d8`, `api` v29·`public-api` v16·`cron-daily` v14 = PR #31(자체 도메인) `3708440`. 그 전: `api` v28·`public-api` v15 = PR #30(지역 행사) `38da23b`, `cron-daily` v13 = PR #28(가게 QR 출퇴근) `851fe41`. 그 전: `293fbec`(시행 예정 개정 3건 반영), `ef5988a`(법령 감지 저장 수정), `68e9cd6`(법령 변경 감지). 그 전: `bcf3a42`(공공데이터 키 공백 처리·법제처 진단), `2abf9af`(공휴일 API). 카카오 앱 설정: 동의항목 talk_message '이용 중 동의', Redirect URI에 `…/functions/v1/public-api/kakao/callback` 추가, 웹 도메인 `https://saram.dreamhelixion.com`·`https://ai-labor-management.github.io`. 운영자 계정이 카카오톡 알림 연결 완료(토큰 암호화 저장, 만료 2027-01-06). jsDelivr 고정 URL, 아래 3-B |
| Auth | Site URL `https://ai-labor-management.github.io/saram-saemgak-site/` (사람샘각 최신 공개 체험, GitHub Pages), Redirect URLs: 그 주소 `/**`, `https://ai-labor-service-draft-sj.gold89765.chatgpt.site/**`, `https://ai-labor-management.github.io/ai-labor-service/**`, `http://localhost:5173/**`. **Confirm email 켜 둠** — 메일 발송: Resend SMTP `smtp.resend.com:465`, 아이디 `resend`, 비밀번호 = Resend API 키(대시보드에만), 보내는 사람 `사람샘각 <no-reply@saram.dreamhelixion.com>` — Cloudflare 하위 도메인, DKIM·SPF·DMARC는 사람샘각 `docs/MAIL_SETUP.md` (2026-11-07 네이버 SMTP에서 옮김). 가입 확인 메일 제목·본문 한국어. 카카오 로그인 켜짐("Allow users without an email" 켜짐) |
| 서울 프로젝트 확인 (2026-11-07) | RLS 격리 53개, E2E 91개(2단계 인증·AI 상담 경로 포함), 프론트 실서버 시험(사람샘각 `tests/live`) 12개, 예약 실행 200 — 모두 통과 후 시험 계정 삭제. 함수 462deb2 재배포 뒤 E2E 91개·실서버 12개, 5b412ad(카카오) 재배포 뒤 E2E 98개·예약 실행 200, api v7(Gemini) 뒤 E2E 98개 다시 통과 |
| 예약 실행 | `labor-daily-alerts` `0 0 * * *` (09:00 KST) 활성 |
| 데이터 | 비어 있음 (기본 노무법인 행 1개만). 시험 계정은 모두 지움 |

## 1. 준비물

- Supabase 프로젝트 (운영은 **서울 `ap-northeast-2`** 권장)
- Node 20.19+ (`npm ci`)
- 함수 배포 방법 중 하나: Supabase CLI(권장) 또는 Supabase MCP/대시보드

키·비밀번호를 저장소에 넣지 않습니다. 함수가 쓰는 `SUPABASE_URL`, `SUPABASE_ANON_KEY`/`SUPABASE_PUBLISHABLE_KEYS`, `SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_SECRET_KEYS`는 Supabase가 자동으로 넣어 줍니다. Vault 비밀 값은 마이그레이션이 DB 안에서 만듭니다.

## 2. 데이터베이스

CLI:

```bash
npx supabase link --project-ref <ref>
```

```bash
npx supabase db push
```

MCP/SQL 편집기로 할 때는 `supabase/migrations/`의 파일을 **번호 순서대로** 실행합니다.

그다음 예약 실행이 부를 주소를 넣습니다(프로젝트마다 다름):

```sql
update public.app_settings set value = to_jsonb('https://<ref>.supabase.co'::text) where key = 'project_url';
```

이 프로젝트는 새 표에 Data API 권한을 자동으로 주지 않는 설정이라 마이그레이션 7(`data_api_grants`)이 권한을 명시합니다. 표를 새로 만들 때도 같은 원칙(기본 권한 + RLS)을 따르세요.

## 3. Edge Functions

함수 코드를 바꿨다면 먼저:

```bash
npm run build:functions
```

`supabase/functions/_shared/domain.js`(계산 엔진 묶음)와 `supabase/functions/_dist/*.js`(함수별 묶음)가 다시 만들어집니다. **`src/domain`이나 `src/data`를 바꿔도 다시 실행하고 커밋해야** 서버 계산이 프론트와 같아집니다.

### 3-A. Supabase CLI (권장)

```bash
npx supabase functions deploy api public-api cron-daily
```

`config.toml`의 `verify_jwt` 설정과 각 함수의 `index.ts` → `handler.ts`가 그대로 쓰입니다.

### 3-B. MCP·대시보드 (지금 배포에 쓴 방법)

여러 파일을 올리기 어려운 환경에서는, 커밋에 고정된 묶음 파일을 jsDelivr로 가져오는 작은 진입점만 올립니다. 저장소가 **공개**여야 합니다.

1. `npm run build:functions` → 커밋 → `main`에 push
2. 커밋 SHA(40자)를 확인
3. 함수마다 `index.ts` 하나만 배포 (`<fn>` = `api` / `public-api` / `cron-daily`):

```ts
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handler, setCreateClient } from 'https://cdn.jsdelivr.net/gh/AI-Labor-Management/ai-labor-service@<SHA>/supabase/functions/_dist/<fn>.js';

setCreateClient(createClient);
// api만: AI 노무 상담용 Claude SDK를 넣는다 (묶음에는 SDK가 없다)
//   import Anthropic from 'npm:@anthropic-ai/sdk@1.3.0';  +  import { setAnthropic } from '…/_dist/api.js';  →  setAnthropic(Anthropic);
Deno.serve(handler);
```

4. `verify_jwt`: `api`만 켜고, `public-api`·`cron-daily`는 끕니다.

브랜치 이름(`@main`) 대신 **반드시 SHA**를 씁니다. jsDelivr 캐시 때문에 브랜치 URL은 옛 코드를 줄 수 있고, 배포 기록과 코드가 어긋납니다.

### CORS

`api`·`public-api`는 `https://saram.dreamhelixion.com`(사람샘각 공개 사이트, 2026-11-10~), `https://ai-labor-management.github.io`, `https://ai-labor-service-draft-sj.gold89765.chatgpt.site`(사람샘각), `http://localhost:5173`, `http://localhost:4173`만 허용합니다. 다른 주소를 더하려면 함수 비밀 값 `ALLOWED_ORIGINS`(쉼표 구분)를 넣습니다.

## 4. Auth (공개 사이트에서 가입하려면 꼭 필요)

대시보드 → Authentication → URL Configuration:

- Site URL: `https://saram.dreamhelixion.com` (사람샘각 공개 사이트, 2026-11-10~). 함수의 `SITE_URL` 기본값도 이 주소 — 카카오 알림 버튼·출퇴근 QR 주소
- Redirect URLs: `https://saram.dreamhelixion.com/**`, `https://ai-labor-management.github.io/saram-saemgak-site/**`, `https://ai-labor-service-draft-sj.gold89765.chatgpt.site/**`, `https://ai-labor-management.github.io/ai-labor-service/**`, `http://localhost:5173/**` (지금 설정된 값. 미리보기 4173을 쓰려면 `http://localhost:4173/**` 추가)

설정 전에는 가입 확인 메일의 링크가 기본값(localhost)으로 가요. 또 Supabase 기본 메일 발송은 **조직 팀원 주소에만** 보내고 시간당 몇 통으로 제한돼요. 누구나 가입하게 하려면 Authentication → Emails → SMTP Settings에 발송 서비스를 연결하거나, 시험 기간에만 Sign In / Providers → Email의 "Confirm email"을 끄세요(끄면 아무 주소로나 가입 가능 — 운영 전 다시 켜기).

(`config.toml`과 같은 값입니다. 로컬 `supabase start`에는 자동 적용.) 카카오 로그인은 사람샘각 저장소 `docs/KAKAO_LOGIN_SETUP.md`대로 카카오 앱을 만든 뒤 Providers → Kakao에서 켭니다(Redirect URI `https://<ref>.supabase.co/auth/v1/callback`, "Allow users without an email" 켜기). 노무법인·관리자는 **2단계 인증(TOTP)이 필수**입니다 — 마이그레이션 10 이후 `app.is_firm_member`·`app.is_admin`이 aal2 세션에서만 참이라, 인증 앱을 등록·확인하기 전에는 그 역할의 데이터가 보이지 않습니다. 인증 앱을 잃어버린 사용자는 `delete from auth.mfa_factors where user_id = <id>;`로 등록을 지우면 다음 로그인 때 다시 등록합니다.

역할 부여는 지금 SQL로 합니다:

```sql
-- 노무법인 담당자
insert into public.firm_members (firm_id, user_id) values ('<firm id>', '<auth user id>');
-- 관리자
insert into public.admins (user_id) values ('<auth user id>');
```

## 5. 배포 후 확인

프론트엔드 로컬 개발에서 서버 모드를 쓰려면 `.env.local`(커밋 금지)에:

```
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable key>
```

```bash
curl -s https://<ref>.supabase.co/functions/v1/public-api/health
```

`"ok":true`와 규칙 44개가 나오면 됩니다. 그다음:

1. **RLS 격리**: SQL 편집기에서 `supabase/tests/rls_isolation.sql` 실행 → 오류 메시지가 `RLS_TESTS_PASSED (53 checks)`면 통과. 시험 데이터는 예외로 끝나며 모두 되돌려집니다(`FAIL: …`이면 그 항목이 깨진 것).
2. **E2E (개발 프로젝트에서만)**: `supabase/tests/e2e_setup.sql` 실행 → 나온 `password`로

```bash
SUPABASE_URL=https://<ref>.supabase.co SB_KEY=<publishable key> E2E_PASSWORD=<password> node supabase/tests/e2e_api.mjs
```

   `E2E: 98 passed, 0 failed`가 나오면 통과(노무법인 계정은 시험 안에서 인증 앱을 등록해 aal2로 올리고, 끝나면 등록을 지운다). 같은 계정으로 화면 코드 시험도: `E2E_PASSWORD=<password> npx vitest run tests/live --no-file-parallelism` (11개 통과, `.env.local` 필요). 끝나면 `supabase/tests/e2e_cleanup.sql` 실행.
3. **예약 실행**: `select app.call_cron_daily();` → 잠시 후 `select status_code, content from net._http_response order by id desc limit 1;`이 200이면 통과.

## 6. 운영 스위치

```sql
-- 비회원 상담 실제 접수 (처리방침·보유 기간·제3자 제공 문구 확정 후에만)
update public.app_settings set value = 'true' where key = 'guest_consult_intake';
```

`kakao_enabled`는 카카오톡 알림 비상 스위치(마이그레이션 12에서 `true`) — 실제 발송은 함수 비밀 값 `KAKAO_REST_KEY`·`KAKAO_CLIENT_SECRET`과 사장님 연결이 있을 때만. `ai_enabled`는 쓰지 않습니다(AI는 `ANTHROPIC_API_KEY`). `client_clock_time_allowed`는 운영에서 항상 `false`(서버 시각 사용).
