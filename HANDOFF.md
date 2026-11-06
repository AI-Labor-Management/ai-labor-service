# 사람샘각 인수인계

2026-11-06 · 대상: UI/UX 검토 및 실제 로그인·AI·외부 API 연결 담당자.

## 바로 시작

```bash
npm ci
npm test
npm run build
npm run dev
```

http://localhost:5173 → 가상 가게로 체험. Node 20.19 이상, 이 PC 검증은 Node 24/Windows/Chromium. 현재 자동 테스트 **10개 파일 97개 통과**, 타입 검사·프론트 빌드·서버 빌드를 확인한다.

개발용 서버까지 볼 때는 터미널 A에서 `npm run api:build` → `npm run api:start`, 터미널 B에서 `npm run dev:api`. 서버 계약·실행·연결 순서는 [API_HANDOFF](docs/API_HANDOFF.md)에 있다.

## 이번에 완료한 것

- 로고와 ‘사람샘각’ 전체 hover/키보드 focus에서 물방울·물결이 한 번 자연스럽게 재생된다. 동작 줄이기에서는 정지한다. 샘물 SVG 원본/단색/파비콘을 함께 제공한다.
- 검색·모달의 바깥 클릭/Escape/포커스 복귀, 메뉴 좌우/접기/모바일 서랍, 테마·사용 안내와 기존 화면 전환을 유지한다.
- 직원 초대 링크를 실제 로컬 가입 흐름으로 연결했다. 만료·사용·재발급·다른 브라우저 안내와 근로조건 ID별 재확인, 미래 적용일 구분을 추가했다.
- 잘못된 월·tab·문서 경로, 음수/잘못된 시간 입력, 중복 출퇴근, 퇴사 입력 재마운트, 등록 취소의 고아 데이터 문제를 보완했다.
- 백업 전체 구조·날짜·수치·참조 검증, 가져오기 전 미리보기/확인, 저장 큐·실패 후 최신 데이터 유지·다른 창 충돌 보호·미저장 백업을 추가했다.
- 사업장·직원 등록·출력용 이름 입력 중에는 메뉴 이동/뒤로 가기 전에 계속 작성/나가기 선택을 제공하고 새로고침 이탈도 보호한다.
- 공통 입력 오류의 스크린리더 연결, 라디오 선택 방향키/포커스, 화면 오류 복구, 경로별 코드 분할을 추가했다.
- 기본 개발 API: 상태 조회/저장·revision·입력 검증·역할별 projection·MFA 경계·F1~F4 계산 재사용, 인증/AI provider 계약. 실제 제공사가 없으면 연결 대기로 실패한다.
- 로그인/AI 화면에는 로딩·취소·실패·재시도·근거 부족·한도 분기를 준비했다. 실제 계정·AI API는 연결하지 않았다.

## 현재 동작의 범위

| 실행                  | 데이터                               | 인증/외부 전송                       |
| --------------------- | ------------------------------------ | ------------------------------------ |
| 공개 Sites · 일반 dev | 이 브라우저 localStorage             | 데모 역할, 실제 외부 전송 없음       |
| dev:api + 로컬 API    | 이 PC의 .local-data/development.json | loopback 가상 세션, 실제 로그인 아님 |
| Supabase/실제 AI      | 연결 전                              | 팀원이 실제 제공사·계정·정책을 연결  |

현재 로그인 폼의 인증 응답 이후 계정/사업장 Store 연결은 담당자가 붙일 지점이다. DemoSession이나 전체 AppState를 운영 인증/직원 데이터 응답으로 사용하면 안 된다. Supabase SQL은 **검토용이며 실제 DB에 적용/실행 검증하지 않았다**.

## 팀원이 이어서 할 일

1. [API_HANDOFF](docs/API_HANDOFF.md)의 VerifyIdentity/AuthProvider/StateRepository/AnswerQuestion 연결. Supabase 서울 프로젝트·로그인/카카오·MFA·세션·사용자별 데이터 범위와 실제 계정 Store 연결.
2. SQL 검토/개발 DB 적용, 다른 계정 간 RLS와 직원·법인 쓰기 명령 검증. 급여/출퇴근 원본·수정 이력 불변을 DB 트랜잭션으로 강제.
3. AI 제공사/근거 검색/보존 정책·실제 이용 한도, 외부 카카오·GPS·공휴일·TourAPI·법제처·노무법인 연결.
4. C1~C17 노무사 확인·공식 양식 대조·상용 간이세액표/지방소득세·학사일정 데이터·보유 기간 정책 결정.
5. 실제 휴대폰/Safari/스크린리더와 출력물 최종 검수 후 운영 전환.

현재 개발 API의 파일 저장·메모리 한도·가상 초대는 운영 백엔드 전체를 대체하지 않는다. API 계약과 실패/권한 경계가 검토 가능한 기반이다.

## 자료와 구조

- 요구사항 대조: [COMPLETION_REVIEW](docs/COMPLETION_REVIEW.md), 기능별 현황: [FEATURES](FEATURES.md).
- UI 기준: [UI_GUIDE](docs/UI_GUIDE.md), 브랜드: [BRAND](docs/BRAND.md), 이전 UX 기록: [UX_REVIEW](docs/UX_REVIEW.md).
- 원문 해석·계산 가정: [DOMAIN_NOTES](docs/DOMAIN_NOTES.md). src/domain과 data/rules.json(원본 44개)은 수치 변경 없이 보존한다.
- src/state/store.tsx → StorageAdapter → local 또는 개발 API. 기존 ai-labor-demo/state/session, schemaVersion:1 유지. 화면 선호는 ai-labor-ui/\*.
- server/contracts.ts가 실제 제공사 연결 경계다. server/index.ts는 개발 전용. Supabase service_role/LLM 키는 서버에만 둔다.
- .local-data, .env, 토큰, 실제 직원 정보, node_modules, dist, dist-server는 Git에 넣지 않는다.

## GitHub와 공개 배포

- 검토 브랜치: https://github.com/AI-Labor-Management/ai-labor-service/tree/codex/ui-design-handoff-20261106
- 공개 체험: https://ai-labor-service-draft-sj.gold89765.chatgpt.site
- GitHub main은 자동 병합하지 않았다. GitHub와 Sites 소스 저장소는 별개이며 자동 배포 CI는 아직 없다.
- 기존 Sites ID·public 접근 범위를 유지한다. 배포 manifest는 .openai/hosting.json이다.
- 전달 ZIP은 source + 검증된 정적 dist + 실행 안내를 담으며 node_modules/개발 데이터/비밀키를 포함하지 않는다. 팀원은 위 명령으로 설치·검증한다.

배포 완료 여부와 다운로드 위치는 이번 작업의 최종 답변에 기록한다.
