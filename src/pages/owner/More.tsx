import { Link } from 'react-router';
import { PageHeader } from '../../ui/kit';

const ITEMS = [
  ['/owner/documents', '서류', '체크리스트 · 요청 현황 · 서식 자료실'],
  ['/owner/deadlines', '일정·기한', '목록 · 달력 · 캘린더 내보내기'],
  ['/owner/insurance', '4대보험·퇴직금', '판정 · 부담액 · 신고 기록'],
  ['/owner/risk', '노무 위험 점검', '운영 습관 10문항'],
  ['/owner/consult', '상담', 'FAQ · 노무 전문가 연결'],
  ['/owner/precheck', '채용 전 점검', '저장하지 않는 빠른 계산'],
  ['/owner/settings', '설정', '사업장 · 기준일 · 연동 상태 · 데이터'],
  ['/owner/rules', '규칙·근거', 'rules.json 값과 확인 상태'],
];

export default function More() {
  return (
    <div>
      <PageHeader title="더보기" />
      <ul className="grid gap-2 sm:grid-cols-2">
        {ITEMS.map(([to, t, d]) => (
          <li key={to}>
            <Link to={to} className="block rounded-2xl border border-line bg-white p-4 hover:border-brand/50">
              <p className="font-bold">{t}</p>
              <p className="text-sm text-muted">{d}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
