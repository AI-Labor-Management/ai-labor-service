# 백엔드 배포·운영 (Supabase)

구조와 API는 [`BACKEND.md`](BACKEND.md)에 있습니다. 여기서는 **새 프로젝트에 다시 올리는 방법**과 **지금 배포된 상태**를 적습니다.

## 0. 지금 배포된 상태 (2026-11-06)

| 항목 | 값 |
|---|---|
| 프로젝트 | `nomu-service-seoul` · ref `smbxhspzflnvncatdgjs` · **`ap-northeast-2` (서울)**. 처음 쓰던 시드니 프로젝트 `nomu-service`(`htdnyekvbuncuweeqpmn`)는 가입자·데이터 0인 상태에서 2026-11-06 옮긴 뒤 일시정지 |
| 마이그레이션 | `supabase/migrations/20261106000001` ~ `…0009` 9개 적용 |
| 프론트엔드 | GitHub Pages 빌드(`deploy.yml`)와 사람샘각(`AI-Labor-Management/saram-saemgak`의 `.env.production`)에 `VITE_SUPABASE_URL`·`VITE_SUPABASE_ANON_KEY`(공개 값) 포함 → 시작 화면에서 서버 모드 선택 가능 |
| Edge Functions | `api` (verify_jwt on), `public-api` (off), `cron-daily` (off, 비밀 헤더 검사) — 서울 프로젝트 v1 |
| 함수 코드 기준 커밋 | 세 함수 모두 `b88498a406f2e78fe6ff4480102c26760b53abd6` (jsDelivr 고정 URL, 아래 3-B. 사람샘각 공개 주소를 CORS 허용 목록에 넣은 커밋) |
| Auth | Site URL `https://ai-labor-service-draft-sj.gold89765.chatgpt.site`, Redirect URLs: 그 주소 `/**`, `https://ai-labor-management.github.io/ai-labor-service/**`, `http://localhost:5173/**`. **Confirm email 꺼 둠 (시험 기간)** — 가입 즉시 로그인, SMTP 연결 후 다시 켜기 |
| 서울 프로젝트 확인 | RLS 격리 49개, E2E 83개, 프론트 실서버 시험(사람샘각 `tests/live`) 9개, 가입 즉시 세션, 예약 실행 200 — 모두 통과 후 시험 계정 삭제 |
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
Deno.serve(handler);
```

4. `verify_jwt`: `api`만 켜고, `public-api`·`cron-daily`는 끕니다.

브랜치 이름(`@main`) 대신 **반드시 SHA**를 씁니다. jsDelivr 캐시 때문에 브랜치 URL은 옛 코드를 줄 수 있고, 배포 기록과 코드가 어긋납니다.

### CORS

`api`·`public-api`는 `https://ai-labor-management.github.io`, `https://ai-labor-service-draft-sj.gold89765.chatgpt.site`(사람샘각), `http://localhost:5173`, `http://localhost:4173`만 허용합니다. 다른 주소를 더하려면 함수 비밀 값 `ALLOWED_ORIGINS`(쉼표 구분)를 넣습니다.

## 4. Auth (공개 사이트에서 가입하려면 꼭 필요)

대시보드 → Authentication → URL Configuration:

- Site URL: `https://ai-labor-service-draft-sj.gold89765.chatgpt.site` (사람샘각 공개 사이트 — 지금 설정된 값)
- Redirect URLs: `https://ai-labor-service-draft-sj.gold89765.chatgpt.site/**`, `https://ai-labor-management.github.io/ai-labor-service/**`, `http://localhost:5173/**` (지금 설정된 값. 미리보기 4173을 쓰려면 `http://localhost:4173/**` 추가)

설정 전에는 가입 확인 메일의 링크가 기본값(localhost)으로 가요. 또 Supabase 기본 메일 발송은 **조직 팀원 주소에만** 보내고 시간당 몇 통으로 제한돼요. 누구나 가입하게 하려면 Authentication → Emails → SMTP Settings에 발송 서비스를 연결하거나, 시험 기간에만 Sign In / Providers → Email의 "Confirm email"을 끄세요(끄면 아무 주소로나 가입 가능 — 운영 전 다시 켜기).

(`config.toml`과 같은 값입니다. 로컬 `supabase start`에는 자동 적용.) 카카오 로그인은 키를 받은 뒤 Providers에서 켭니다. 노무법인·관리자 계정은 MFA를 켜는 것을 권장합니다.

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

1. **RLS 격리**: SQL 편집기에서 `supabase/tests/rls_isolation.sql` 실행 → 오류 메시지가 `RLS_TESTS_PASSED (49 checks)`면 통과. 시험 데이터는 예외로 끝나며 모두 되돌려집니다(`FAIL: …`이면 그 항목이 깨진 것).
2. **E2E (개발 프로젝트에서만)**: `supabase/tests/e2e_setup.sql` 실행 → 나온 `password`로

```bash
SUPABASE_URL=https://<ref>.supabase.co SB_KEY=<publishable key> E2E_PASSWORD=<password> node supabase/tests/e2e_api.mjs
```

   `E2E: 83 passed, 0 failed`가 나오면 통과. 같은 계정으로 화면 코드 시험도: `E2E_PASSWORD=<password> npx vitest run tests/live` (7개 통과, `.env.local` 필요). 끝나면 `supabase/tests/e2e_cleanup.sql` 실행.
3. **예약 실행**: `select app.call_cron_daily();` → 잠시 후 `select status_code, content from net._http_response order by id desc limit 1;`이 200이면 통과.

## 6. 운영 스위치

```sql
-- 비회원 상담 실제 접수 (처리방침·보유 기간·제3자 제공 문구 확정 후에만)
update public.app_settings set value = 'true' where key = 'guest_consult_intake';
```

`kakao_enabled`, `ai_enabled`는 발송·상담 모듈을 만든 뒤에 켭니다. `client_clock_time_allowed`는 운영에서 항상 `false`(서버 시각 사용).
