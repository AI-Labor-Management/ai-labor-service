# AI 인사노무 관리 (가칭) — 로컬 데모 초안

전담 인사 담당자가 없는 소상공인 사업주가 **내 가게 조건에 적용되는 인사·노무 의무를 알고, 서류·임금·보험·기한을 관리하며, 판단이 어려운 경우 전문가에게 연결**되도록 돕는 웹서비스의 실행 가능한 초안입니다.

- 원본 자료: `AI_Labor_Claude_Compatible.zip` (Notion 'AI 인사노무 관리 서비스' 워크스페이스 수집본, 2026-11-05). 원본은 수정하지 않았고 이 폴더는 별도 구현입니다.
- 기준 기획: `BIX_노무서비스_기획안_2차_1104.docx`, `09_기획안_1104회의.md`, 기능별 설계 `07`~`22`.
- 법령 수치: 원본의 `053_rules.json`(44개 규칙)을 **그대로** `src/data/rules.json`으로 복사해 기준일로 읽습니다.
- 다음 작업자(Codex)용 상세 인수인계: [`HANDOFF.md`](HANDOFF.md) · 기능별 상태표: [`FEATURES.md`](FEATURES.md)

**바로 보기:** https://ai-labor-management.github.io/ai-labor-service/ — `/start`에서 "가상 시드로 둘러보기"를 누르면 예시 가게로 모든 화면을 볼 수 있어요. `main`에 push하면 GitHub Actions(`.github/workflows/deploy.yml`)가 테스트 후 다시 배포합니다. 공개 사이트에서도 입력한 내용은 방문자 본인 브라우저에만 저장되고 어디로도 전송되지 않습니다.

> ⚠️ **로컬 데모입니다.** 실제 인증·사용자별 격리·서버 저장이 없고 데이터는 브라우저 `localStorage`에만 저장됩니다. 카카오·AI·법제처·노무법인 접수는 연결되지 않았으며, 실제로 보내지 않은 알림·상담을 "전송 완료"로 표시하지 않습니다. 실제 개인정보를 넣지 마세요.

## 필요 환경

| 항목 | 버전 |
|---|---|
| Node.js | 20.19 이상 (검증: v24.18.0) |
| npm | 10 이상 (검증: 11.16.0) |
| 브라우저 | 최신 Chrome/Edge/Safari (`structuredClone`, `<dialog>`, `crypto.randomUUID` 사용) |

외부 계정·키 없이 실행됩니다. 웹 글꼴(Pretendard)만 jsDelivr CDN에서 받고, 오프라인이면 시스템 글꼴로 대체됩니다.

## 설치·실행

```bash
npm ci
```

```bash
npm run dev
```

브라우저에서 http://localhost:5173 을 엽니다.

| 명령 | 내용 |
|---|---|
| `npm run dev` | 개발 서버 (Vite, 5173 포트) |
| `npm run build` | 타입 검사(`tsc -b`) + 프로덕션 빌드 → `dist/` |
| `npm run preview` | 빌드 결과 미리보기 |
| `npm test` | 단위 테스트 (Vitest, 66개) |
| `npm run typecheck` | 타입 검사만 |

npm 11에서 `esbuild`, `@tailwindcss/oxide`의 install script 경고(`allow-scripts`)가 보일 수 있습니다. 두 패키지의 플랫폼 바이너리는 optionalDependencies로 설치되어 스크립트 실행 없이 동작합니다(Windows x64에서 확인).

## 환경변수

`.env.example`을 참고하세요. **모두 비워 둔 채로 실행됩니다.** 현재 코드는 어떤 키도 외부로 보내지 않습니다.

| 변수 | 용도 | 상태 |
|---|---|---|
| `VITE_STORAGE_ADAPTER` | `local`(기본) / `supabase` | supabase는 미구현 → 경고 후 local로 실행 |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | 인증·DB·RLS | 미구현 |
| `VITE_KAKAO_JS_KEY`, `KAKAO_REST_KEY` | 카카오 로그인·나에게 보내기·카카오맵 | 연결 대기 |
| `LLM_API_KEY` | AI 상담 (서버 함수에서만) | 연결 대기 (제공사 미정) |
| `LAW_API_OC` | 법제처 Open API 법령 변경 감지 | 연결 대기 |
| `HOLIDAY_API_KEY`, `TOUR_API_KEY` | 공휴일·지역 행사 | 연결 대기 (공휴일은 내장 목록) |
| `CRON_SECRET` | 하루 1회 알림 묶음 발송 | 미구현 |

## 가상 시드와 데모 역할

1. `/start` → **가상 시드로 둘러보기**: 카페 샘터(가상) · 음식점·카페 · 1~4명 · 직원 A·B·C. 날짜는 기준일에 맞춰 상대적으로 만들어져 언제 실행해도 위험·임박·확인 필요 항목이 보입니다.
   - 직원 A: 새 직원, 근로계약서 미교부·4대보험 아직 안 함(위험), 수습 중, 12일 뒤 시급 인상 예정(조건 이력), 직원 앱 가입함, GPS 출퇴근 기록·수정 이력·확인 대기 1건
   - 직원 B: 기존 직원(정리 완료), 유학생 D-2, 체류기간 D-4, 보건증 재검진 시기, 4대보험 노무법인에 맡김
   - 직원 C: 방금 등록한 기존 직원(한 번에 체크 전), 매주 달라요, 기간제(계약 만료 임박)
   - 가장 최근 지급일이 지난 달의 급여는 확정·교부되어 있습니다(수령 확인 시연).
2. **빈 사업장으로 시작**: 홍보 페이지 자가진단 답(업종·직원 수·외국인)을 이어받아 사업장 설정부터 시작합니다.
3. 화면 맨 위 검은 띠의 **데모 역할** 선택으로 사장님 / 직원(가입한 직원) / 노무법인 / 관리자 화면을 오갑니다. **실제 인증이 아닙니다.**
   - 직원 화면은 본인 데이터만 보이도록 `src/domain/scopes.ts`의 선택자를 거칩니다(브라우저 데이터 자체는 격리되지 않음).
   - 미가입 직원은 사장님 화면 → 직원 상세 → 직원 앱·초대 → 초대 링크 만들기 → "데모: 직원으로 링크 열기"로 가입 흐름을 볼 수 있습니다.

### 기준일

모든 계산(최저임금·요율·기한·D-day)은 **기준일**로 규칙을 고릅니다. 기본은 브라우저 로컬 날짜이고, 설정 → 기준일에서 고정할 수 있습니다(예: 2027.1.1로 연도 전환 시험).

### 초기화·복원

- 설정 → 데이터: **JSON 내보내기 / 가져오기 / 데이터 초기화 / 가상 시드 복원**
- 브라우저 개발자도구에서 `localStorage`의 `ai-labor-demo/state`, `ai-labor-demo/session`을 지워도 초기화됩니다.
- 저장소를 읽을 수 없으면(사생활 보호 모드 등) 첫 화면에 오류와 [다시 시도]/[저장 데이터 초기화]가 나오고, 저장 실패 시 상단에 [다시 저장] 띠가 나옵니다.

## 구조 (요약)

```
src/
  data/        rules.json(원본 그대로), checklistItems, faq, forms, holidays(내장·미검증), seed
  domain/      화면과 분리된 계산·날짜 로직 (React 의존 없음, 테스트 대상)
    dates.ts rules.ts work.ts hours.ts wage.ts payroll.ts insurance.ts severance.ts leave.ts
    deadlines.ts ics.ts checklist.ts risk.ts foreign.ts todos.ts consult.ts diagnosis.ts scopes.ts types.ts
  adapters/    storage(localStorage 어댑터·스키마 마이그레이션), integrations(연동 상태·가상 위치)
  state/       store.tsx (단일 AppState, update()로만 변경, 저장 실패 처리)
  ui/          공통 부품(kit), 레이아웃·데모 띠, 일정 편집기, 임금명세서
  pages/       public(홍보·시작) owner(사장님 22화면) employee(직원) firm(노무법인) admin(관리자)
tests/         Vitest 단위 테스트 (손계산 예제·경계값·날짜·조건 변경·스냅샷·역할 범위·복원)
```

자세한 데이터 흐름과 결정 이유는 `HANDOFF.md`를 보세요.

## 검증 결과 (2026-11-05)

| 항목 | 결과 |
|---|---|
| `npm run typecheck` | 통과 |
| `npm test` | 5개 파일 66개 테스트 통과 |
| `npm run build` | 통과 (JS 655KB / gzip 197KB, 경고 한도 800KB로 설정) |
| 브라우저 (Claude 앱 내장 Chromium) | 홍보·시작·사장님 27개 경로, 직원 5개, 노무법인, 관리자 화면 렌더 오류 없음. 375px 폭에서 가로 넘침 없음. 시나리오 확인 내용은 `HANDOFF.md` 7장 |
| 미실시 | Safari/Firefox, 실제 휴대폰, 스크린리더, 인쇄 결과물 육안 확인, 장시간 사용·대용량 데이터 |
