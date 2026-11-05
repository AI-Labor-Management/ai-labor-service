import type { IconName } from './Icon';
export interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  keywords: string;
  end?: boolean;
  also?: string[];
}
export const OWNER_MENU: NavItem[] = [
  { to: '/owner', label: '한눈에 보기', icon: 'home', keywords: '홈 대시보드 할 일', end: true },
  { to: '/owner/employees', label: '직원 관리', icon: 'people', keywords: '직원 등록 채용 정보' },
  { to: '/owner/work', label: '근무 관리', icon: 'clock', keywords: '근무 일정 출퇴근 대타 연차' },
  { to: '/owner/payroll', label: '급여 관리', icon: 'wallet', keywords: '급여 임금 수당 주휴 명세서' },
  { to: '/owner/insurance', label: '보험·퇴직금', icon: 'shield', keywords: '4대보험 퇴직금 고지서' },
  { to: '/owner/documents', label: '서류 관리', icon: 'file', keywords: '서류 계약서 근로 명부 요청' },
  { to: '/owner/deadlines', label: '일정·기한', icon: 'calendar', keywords: '일정 달력 기한 알림 만료' },
  { to: '/owner/risk', label: '노무 점검', icon: 'check', keywords: '노무 위험 점검 진단' },
  { to: '/owner/consult', label: '상담', icon: 'chat', keywords: '상담 질문 FAQ 전문가 노무사' },
  {
    to: '/owner/settings',
    label: '설정',
    icon: 'settings',
    keywords: '설정 테마 데이터 사업장 기준일',
    also: ['/owner/rules', '/owner/setup'],
  },
];
