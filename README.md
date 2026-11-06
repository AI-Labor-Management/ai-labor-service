# 사람샘각

전담 인사 담당자가 없는 소상공인이 직원 정보를 한 번 등록하고 서류·근무·급여·보험·기한을 관리하며, 판단이 어려운 경우 노무 전문가에게 연결하도록 돕는 웹서비스 초안입니다.

[공개 체험](https://ai-labor-service-draft-sj.gold89765.chatgpt.site) · [인수인계](HANDOFF.md) · [기능별 상태](FEATURES.md) · [API 연결](docs/API_HANDOFF.md) · [요구사항 대조](docs/COMPLETION_REVIEW.md)

**공개 사이트는 가상 데이터 체험입니다.** 실제 인증·사용자 격리·외부 전송은 연결 전이며 실제 직원 개인정보를 입력하지 않습니다. 개발용 백엔드를 별도로 실행할 수 있습니다.

## 실행

Node 20.19 이상과 npm이 필요합니다. 의존성은 package-lock.json에 고정했습니다.

```bash
npm ci
npm run dev
```

http://localhost:5173 → ‘가상 가게로 체험하기’. 일반 모드는 이 브라우저에 저장하고 새로고침 시 복원합니다. 테마·메뉴 설정은 업무 데이터와 따로 저장합니다.

전달 ZIP의 화면만 볼 때는 `START-WINDOWS.cmd` 또는 `node preview.mjs`로 http://127.0.0.1:4173 을 엽니다. 이 미리보기는 Node만 있으면 의존성 설치 없이 실행됩니다.

| 명령              | 동작                                  |
| ----------------- | ------------------------------------- |
| npm test          | 10개 파일 97개 테스트                 |
| npm run build     | 타입 검사 + 정적 프로덕션 빌드 → dist |
| npm run typecheck | 타입 검사                             |
| npm run preview   | 빌드 결과 미리보기                    |
| npm run api:build | 개발용 Node API 빌드 → dist-server    |
| npm run api:start | 127.0.0.1:8787 개발 API               |
| npm run dev:api   | 개발 API를 사용하는 화면, 5173        |

서버 저장 체험은 터미널 A에서 api:build → api:start, 터미널 B에서 dev:api를 실행합니다. 저장은 .local-data/development.json, 가상 계정 하나입니다. 실제 로그인 서비스가 아닙니다. 이 모드는 공개 빌드/production 진입점에서 거부합니다.

## 화면과 사용 흐름

1. 홍보·1분 자가진단 → 빈 사업장 설정 또는 가상 카페 체험.
2. 사업장·직원·근로조건 등록 → 홈에서 오늘 처리할 일 확인.
3. 근무/출퇴근·대타·연차, 서류 상태·요청, 급여 초안/확정·명세서, 보험·퇴직금, 기한/ICS 처리.
4. 직원 초대·근로조건 확인·명세서 열람, 선택한 항목의 노무법인 상담 공유/철회.
5. 실제 API 연결은 API_HANDOFF의 서버 provider와 화면 어댑터에서 이어갑니다.

로고/이름에 물방울 반응, 검색의 바깥 클릭·Escape·키보드 이동, 좌우 접이식 메뉴, 다크/라이트 모드, 움직이는 사용 안내와 업무 미리보기를 제공합니다. 동작 줄이기 설정을 따릅니다. 사업장·직원 등록·출력용 이름 입력 중 이탈 확인, 백업 파일 검증·교체 미리보기, 저장 실패/충돌 복구와 화면 오류 복구도 포함합니다.

## 구조

- src/domain: 날짜·F1~F4·급여·보험·퇴직금·기한·역할 범위. 화면과 서버가 같은 함수를 사용합니다.
- src/data/rules.json: 원본 053_rules.json의 44개 규칙. 이번 UX 작업으로 법령을 재검증하거나 값을 바꾸지 않았습니다.
- src/state/store.tsx, adapters: 저장 큐·검증·local/API 어댑터. schemaVersion:1과 기존 저장 키를 유지합니다.
- src/ui, styles: 공통 UI·모달·검색·테마·애니메이션·미저장 입력 보호.
- server: 개발 API, 파일 저장소, 인증/AI/DB 교체 계약.
- supabase/migrations: 아직 DB에 적용하지 않은 검토용 RLS/저장 기반.
- tests: 계산·데이터 경계·저장 충돌·역할 범위·HTTP·공통 UI 회귀.

원본은 Notion ‘AI 인사노무 관리 서비스’의 2차 기획안/07~22 설계와 수집본 AI_Labor_Claude_Compatible.zip입니다. 담당자 역할·일정에 따라 기능 범위를 줄이지 않았습니다. 요구사항 해석과 확인이 필요한 계산 가정은 [DOMAIN_NOTES](docs/DOMAIN_NOTES.md)에 있습니다.

## 이어서 연결할 것

실제 로그인/카카오/MFA·계정별 서버 데이터, AI 제공사/근거 검색, 카카오 메시지/GPS/공공데이터/법제처/실제 노무법인 전달입니다. 세금·공휴일·공식 양식·노무사 확인·보유 기간은 자료와 정책 결정이 남았습니다. 현재 수동 입력/연결 대기/확인 필요 표시를 유지합니다.

환경변수 예시는 .env.example, 자세한 연결·오류 계약은 API_HANDOFF를 따릅니다. 비밀키는 서버에만 보관합니다. .env/개발 데이터/실제 직원 정보/node_modules/dist는 커밋하지 않습니다.

GitHub 검토 브랜치는 codex/ui-design-handoff-20261106입니다. main은 직접 병합하지 않았으며 GitHub와 Sites는 별도 이력입니다. .openai/hosting.json의 기존 Site ID와 public 접근 범위를 유지합니다.
