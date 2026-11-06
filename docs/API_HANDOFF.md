# API 연결 인수인계

2026-11-06. 공개 Sites는 브라우저 저장 체험이며, 아래 API는 이 PC에서 실행하는 **개발용 기반**이다. 실제 로그인·AI·Supabase 프로젝트는 연결하지 않았다. HTTP 테스트에서 확인한 권한 범위를 실제 운영 인증 완료로 해석하지 않는다.

## 실행

Node 20.19 이상, npm. 설치는 `npm ci` 한 번이다. 터미널 A:

```bash
npm run api:build
npm run api:start
```

터미널 B:

```bash
npm run dev:api
```

http://127.0.0.1:5173 에서 가상 가게로 체험한다. Vite가 `/api`를 127.0.0.1:8787로 전달한다. 개발 서버 포트는 고정이다. 일반 `npm run dev`와 공개 빌드는 기존 localStorage 모드다. 개발용 API 모드는 공개 빌드에서 거부한다. `NODE_ENV=production`으로 개발 진입점을 실행해도 거부한다.

가상 상태는 `.local-data/development.json`에 저장된다. Git·전달 ZIP에서 제외한다. `SARAM_DATA_DIR`, `SARAM_API_PORT`는 서버 전용 선택 설정이다. API 포트를 바꾸면 Vite proxy도 맞춘다. 테스트는 임시 디렉터리와 임의 포트를 사용한다.

## 코드의 경계

| 담당        | 파일                                                     | 교체할 부분                                                                                                                                          |
| ----------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 서버 진입점 | `server/index.ts`                                        | 개발용 세션을 운영에 복사하지 않는다. 검증된 인증/DB를 넣은 운영 진입점을 별도로 만든다.                                                             |
| 인증        | `server/contracts.ts` → `VerifyIdentity`, `AuthProvider` | Supabase JWT 서명·만료·issuer·audience 검증, DB 회원 관계로 workspace/role/employee 결정. 요청 body의 역할은 신뢰하지 않는다.                        |
| 서버 저장   | `StateRepository`, `server/repository.ts`                | 파일 저장을 DB 트랜잭션으로 교체. expectedRevision 충돌은 409 유지.                                                                                  |
| 화면 저장   | `src/adapters/apiStorage.ts`, `storage.ts`               | 현재 API 어댑터는 개발 전용이다. 운영 어댑터는 dev/session 없이 실제 세션을 사용하며 잘못된 설정은 실패로 표시한다.                                  |
| 로그인 화면 | `pages/public/Start.tsx`, `adapters/api.ts`              | 로딩·취소·실패·이메일 확인 상태를 제공한다. 인증 응답 후 실제 계정/사업장 Store 연결 및 이동 처리를 붙인다. DemoSession을 실제 인증으로 쓰지 않는다. |
| AI          | `AnswerQuestion`, `ui/AiQuestion.tsx`                    | 제공사 연결, 근거 검색, 서버 비밀키. 응답 형식은 아래 계약을 따른다.                                                                                 |
| 핵심 계산   | `src/domain/*`                                           | 화면과 API가 같은 함수를 호출한다. API에서 다시 계산식을 작성하지 않는다.                                                                            |

`VITE_AUTH_ENABLED`, `VITE_AI_ENABLED`는 기본 false다. **키를 넣는 변수가 아니다.** 같은 출처의 실제 API와 계정 Store 연결이 준비된 환경에서만 true로 설정한다. 비밀번호·질문은 로그/DB/localStorage에 남기지 않는다. `AuthProvider`는 response를 받아 서버 쿠키를 설정할 수 있다. 개발용 상태·계정과 실제 계정의 자동 합치기는 구현하지 않았다.

## HTTP 계약

응답은 `{ data, requestId }` 또는 `{ error: { code, message, retryAfter? }, requestId }`다. 모든 응답은 no-store다. 변경 요청은 JSON과 `X-Saram-Client: web`을 요구한다. 기본 허용 Host·Origin은 localhost 개발 주소이며 wildcard CORS를 열지 않는다. 운영 진입점은 `allowedHosts`, `allowedOrigins`를 실제 주소로 명시해야 한다.

| 경로 `/api/v1`                             | 메서드 | 권한/내용                                                                                  |
| ------------------------------------------ | ------ | ------------------------------------------------------------------------------------------ |
| `/health`, `/rules`                        | GET    | 상태·공개 규칙. 규칙의 최신 법령 검증을 대신하지 않는다.                                   |
| `/dev/session`                             | POST   | loopback 개발 전용. 8시간 HttpOnly/SameSite=Strict 가상 사장님 쿠키. 로그인 아님.          |
| `/auth`                                    | POST   | `{ action: login 또는 signup, email, password }`. 제공사가 없으면 503.                     |
| `/me`                                      | GET    | 검증된 서버 Identity.                                                                      |
| `/state`                                   | GET    | 사장님만 `{ revision, state, updatedAt }`. 다른 역할은 403.                                |
| `/state`                                   | PUT    | 사장님만 `{ expectedRevision, state }`. 전체 중첩 구조·참조를 검증한 뒤 저장.              |
| `/view`                                    | GET    | 직원: 본인 기록/교부 명세서, 노무법인: 동의된 항목, 관리자: 집계. 법인·관리자는 aal2 필요. |
| `/owner/summary?date=YYYY-MM-DD`           | GET    | 사장님 할 일/F1/F4.                                                                        |
| `/owner/payroll?month=YYYY-MM`             | GET    | 화면과 같은 F2 계산/확정 스냅샷.                                                           |
| `/owner/insurance?employeeId=...&date=...` | GET    | 같은 F3 예상 판정.                                                                         |
| `/consult/answer`                          | POST   | 사장님, `{ question }`. 개인정보 패턴 차단·전문가 분기 후 AI provider 호출.                |

AI 응답:

```json
{
  "status": "answer",
  "text": "근거를 바탕으로 한 안내",
  "citations": [{ "title": "출처 이름", "url": "https://공식-출처/조문", "checkedAt": "2026-11-06" }]
}
```

status는 `answer`, `insufficient_evidence`, `expert_required`. answer에 근거가 없으면 근거 부족으로 바꾼다. 제공사에는 질문과 업종·규모만 전달한다. 직원/금액/연락처는 전달하지 않는다. 서버 대기 25초, 화면 대기 30초, 취소·화면 이탈 시 AbortSignal을 전달한다. 화면은 이전 질문의 늦은 답을 무시한다. 질문과 답은 메모리에서만 표시한다.

오류: 401 재연결, 403 권한/MFA, 409 다른 창 저장 충돌, 413 5MB 초과, 422 입력·참조 오류, 429 이용 한도, 503 제공사 미설정, 504 AI 시간 초과. 저장 큐는 실패 후 멈추고 최신 미저장 상태를 남긴다. 충돌은 자동 덮어쓰지 않는다. 상단 ‘현재 내용 백업’ 후 새로고침/검토로 복구한다.

## Supabase 기반

`supabase/migrations/202611060001_owner_bridge.sql`은 **아직 적용·실행 검증하지 않은 검토용 기반**이다. 사업장/회원 관계/사장님 상태/초대 해시/상담 공유와 RLS, 서버 전용 revision RPC를 담았다. 서버의 전체 상태 검증을 거친 쓰기만 허용하도록 브라우저 직접 쓰기 권한을 주지 않는다.

이 SQL은 사장님 상태를 옮기는 초기 연결용이다. 원문 19번의 전체 관계형 모델을 대체하지 않는다. 운영에서는 근로조건 이력·출퇴근 원본/수정·확정 급여/교부·상담 철회를 명령 단위 트랜잭션으로 분리하고 원본 불변을 DB에서도 강제한다. 직원 화면에 전체 AppState를 내려주면 안 된다. `/view`의 범위가 기준이며 역할별 쓰기 명령은 서버에서 본인/공유 범위를 검증해야 한다.

초대는 서버의 암호학적 난수 발급 → SHA-256 해시만 저장 → 만료/단회 사용/직원 연결을 같은 트랜잭션으로 구현한다. 현재 로컬 초대는 UUID 난수지만 원문 토큰을 로컬에 저장하므로 다른 기기 초대·운영용 보안 토큰 구현으로 간주하지 않는다.

## 운영 연결 담당자가 완료할 항목

- Supabase 서울 리전, 카카오/이메일 로그인, 로그아웃·세션 만료·탈퇴·비밀번호 재설정, 법인/관리자 MFA 등록/확인, 실제 계정 Store와 화면 역할 연결.
- SQL 검토 후 개발 DB 적용, 서로 다른 사장님·직원·법인 계정으로 RLS 읽기/쓰기 검증. service_role은 서버에만 둔다.
- DB 저장·감사 이력·불변 원본·백업 복구, 다중 서버 revision/트랜잭션 검증. 현재 파일 저장은 단일 프로세스 개발용이며 암호화/운영 백업 시스템은 없다.
- AI 제공사 정책/근거 검색/실제 일일 한도 결정. 현재 20회·UTC 일자·프로세스 메모리 제한은 개발용 예시다. 운영 한도와 예약 발송은 DB에서 원자적으로 기록한다.
- 카카오 메시지·GPS·공휴일/TourAPI·법령 변경 감지·실제 노무법인 전달. 비회원 연락처는 보유 기간·동의 문구 확정 후 서버 암호화 저장과 파기를 붙인다.

## 확인한 근거

- 프로젝트 요구사항: [Notion 2차 기획안 첨부 페이지](https://www.notion.so/40eaed7cd3a68087ab99d641b32a4187), 수집본 `19_데이터모델`, `17_직원화면`.
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [MFA](https://supabase.com/docs/guides/auth/auth-mfa).
- [Node HTTP](https://nodejs.org/api/http.html), [Node fs](https://nodejs.org/docs/latest-v24.x/api/fs.html). 파일 저장 순서와 동시성은 별도 테스트로 검증한다.
