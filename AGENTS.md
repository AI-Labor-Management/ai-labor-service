# 작업 안내

- 먼저 `README.md`, `HANDOFF.md`, `FEATURES.md`, `docs/UI_GUIDE.md`를 읽는다.
- 이 프로젝트는 Vite/React 기반 독립형 로컬 데모다. 인증·사용자 격리·서버 저장·외부 전송은 아직 연결되지 않았다. 임시 UI를 실제 서비스가 연결된 것으로 표시하지 않는다.
- 업무 계산과 날짜 규칙은 `src/domain`, 원본 법령 수치는 `src/data/rules.json`에 있다. UI 수정으로 계산 규칙을 바꾸지 않는다.
- 새 색상과 공통 모서리 값은 `src/styles/tokens.css`에서 관리한다. 화면은 역할별 접근 범위를 유지한다.
- 기존 데이터 스키마와 저장 키를 유지한다. 테마와 메뉴 선호는 `ai-labor-ui/*` 아래 별도로 저장한다.
- 검증은 `npm test`와 `npm run build`. 화면 변경은 밝은/어두운 모드와 모바일에서도 확인한다.
- 기능 상태가 바뀌면 README·FEATURES·HANDOFF를 실제 동작과 맞춘다.
- GitHub 저장소와 Sites 배포 저장소는 별개다. 변경을 GitHub 검토 브랜치/PR에도 전달해 두고, 배포만으로 GitHub가 갱신됐다고 말하지 않는다.
- Sites에는 `.openai/hosting.json`의 기존 project_id를 사용한다. 기존 비공개 범위를 유지하고 새 Site를 중복 생성하지 않는다.
- `.env`, 토큰, 실제 직원 정보, localStorage 내보내기, node_modules, dist를 커밋하지 않는다.
