# 작업 안내

- 먼저 `README.md`, `HANDOFF.md`, `FEATURES.md`, `docs/UI_GUIDE.md`를 읽는다.
- 2026-11-06 개발용 Node API가 추가됐다. `docs/API_HANDOFF.md`를 읽고, 공개 local 체험과 개발 API/실제 provider 연결을 구분한다. API 변경 후 `npm run api:build`도 실행한다.
- 구조/백업 검증은 `validateState.ts`, 저장 순서·실패는 `saveQueue.ts`, 이탈 보호는 `UnsavedChanges.tsx`를 유지한다. 개발 데이터 `.local-data`와 `dist-server`는 커밋하지 않는다.
- 이 프로젝트는 Vite/React 기반 독립형 체험 앱이다. 기본 공개 모드는 브라우저 저장이며, 선택적인 개발용 Node API가 있다. 실제 인증·사용자 격리·운영 DB·외부 provider는 연결 전이다. 임시 UI를 실제 서비스가 연결된 것으로 표시하지 않는다.
- 업무 계산과 날짜 규칙은 `src/domain`, 원본 법령 수치는 `src/data/rules.json`에 있다. UI 수정으로 계산 규칙을 바꾸지 않는다.
- 새 색상과 공통 모서리 값은 `src/styles/tokens.css`에서 관리한다. 화면은 역할별 접근 범위를 유지한다.
- 기존 데이터 스키마와 저장 키를 유지한다. 테마와 메뉴 선호는 `ai-labor-ui/*` 아래 별도로 저장한다.
- 검증은 `npm test`와 `npm run build`. 화면 변경은 밝은/어두운 모드와 모바일에서도 확인한다.
- 기능 상태가 바뀌면 README·FEATURES·HANDOFF를 실제 동작과 맞춘다.
- GitHub 저장소와 Sites 배포 저장소는 별개다. 변경을 GitHub 검토 브랜치/PR에도 전달해 두고, 배포만으로 GitHub가 갱신됐다고 말하지 않는다.
- 서비스명은 사용자가 지정한 '사람샘각'이다. `src/ui/brand.ts`, `docs/BRAND.md`를 기준으로 삼는다.
- Sites에는 `.openai/hosting.json`의 기존 project_id를 사용한다. 2026-11-06 사용자 요청으로 공개(public)로 전환했다. 현재 공개 범위를 유지하고 새 Site를 중복 생성하지 않는다.
- 공통 모달은 `useDialog.ts`를 사용한다. 바깥 클릭·Escape·포커스 복귀·배경 스크롤 잠금을 유지하고 `tests/dialog.test.ts`를 통과시킨다.
- `.env`, 토큰, 실제 직원 정보, localStorage 내보내기, node_modules, dist를 커밋하지 않는다.
