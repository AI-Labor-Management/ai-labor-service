// 외부 연동 상태. 실제로 연결된 것이 없으므로 어떤 함수도 외부로 요청을 보내지 않는다.
// 상태 구분: live(실연동) / demo(로컬 데모) / waiting(연결 대기 — 키·계약·정책 필요)
export type IntegrationStatus = 'live' | 'demo' | 'waiting';

export interface Integration {
  id: string;
  name: string;
  status: IntegrationStatus;
  what: string;
  needs: string;
  env: string[];
}

export const INTEGRATIONS: Integration[] = [
  { id: 'auth', name: '로그인 (카카오 기본 · 이메일 보조)', status: 'waiting', what: '데모 역할 전환으로 대체. 실제 인증·사용자별 격리 없음', needs: 'Supabase Auth 프로젝트, 카카오 로그인 앱 키, 노무법인·관리자 2단계 인증', env: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_KAKAO_JS_KEY'] },
  { id: 'storage', name: '서버 저장 (Supabase · RLS)', status: 'demo', what: '브라우저 localStorage에 저장. 새로고침 후 복원, 다른 기기·브라우저와 공유 안 됨', needs: 'Supabase DB 스키마·RLS 정책, 서울 리전 확인', env: ['VITE_STORAGE_ADAPTER', 'VITE_SUPABASE_URL'] },
  { id: 'kakao-msg', name: '카카오톡 "나에게 보내기" 알림', status: 'waiting', what: '앱 안 알림만 실제로 쌓임. 카톡은 보내지 않음', needs: '카카오 메시지 API 동의, 서버 토큰 암호화 저장, 하루 1회 예약 실행', env: ['KAKAO_REST_KEY', 'CRON_SECRET'] },
  { id: 'ics', name: '캘린더 파일(.ics) 내보내기', status: 'live', what: '브라우저에서 파일을 만들어 내려받음 (외부 전송 없음)', needs: '—', env: [] },
  { id: 'gps', name: 'GPS 출퇴근 · 카카오맵', status: 'demo', what: '가상 위치(반경 안/밖 선택)로 기록. 실제 좌표를 읽지 않음', needs: '위치정보 법적 검토(신고·동의), 카카오맵 키·도메인 등록', env: ['VITE_KAKAO_JS_KEY'] },
  { id: 'ai', name: 'AI 상담', status: 'waiting', what: 'FAQ 검색만 동작. AI 답변은 생성하지 않음', needs: 'AI 제공사 결정(서버 위치·학습 활용 확인), 서버 함수, 하루 사용 한도', env: ['LLM_API_KEY'] },
  { id: 'firm', name: '노무법인 상담 접수', status: 'demo', what: '이 브라우저의 노무법인 화면에만 도착 (실제 전송 없음)', needs: '협력 노무법인 협약, 처리방침·보유 기간, 제3자 제공 동의 문구 검토(노무사 확인 C15·C16)', env: [] },
  { id: 'law', name: '법제처 Open API (법령 변경 감지)', status: 'waiting', what: '규칙은 data/rules.json 고정값. 변경 감지 미실행', needs: '법제처 인증키, 조문 해시 비교 작업', env: ['LAW_API_OC'] },
  { id: 'holiday', name: '특일정보 API (공휴일)', status: 'demo', what: '앱 내장 목록 사용 (공식 대조 전)', needs: '공공데이터포털 인증키', env: ['HOLIDAY_API_KEY'] },
  { id: 'tour', name: 'TourAPI (지역 행사) · 학사일정', status: 'waiting', what: '사장님이 직접 추가한 바쁜 날만 표시', needs: 'TourAPI 키, 학기별 학사일정 입력', env: ['TOUR_API_KEY'] },
];

export const STATUS_TEXT: Record<IntegrationStatus, string> = { live: '실제 동작', demo: '로컬 데모', waiting: '연결 대기' };

/** 가상 위치 — 실제 위치를 읽지 않는다 */
export function demoLocate(inside: boolean): { gps: 'inside' | 'outside'; distanceM: number; demo: true } {
  return { gps: inside ? 'inside' : 'outside', distanceM: inside ? 38 : 420, demo: true };
}
