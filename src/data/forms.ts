// 서식 자료실 (15_서류요청_자료실 2장). 공식 원본은 서버에 두지 않고 링크만 건다.
// 세부 서식 링크·개정일은 아직 확보하지 못해 제공 기관 홈페이지로만 연결하고 "마지막 확인일: 확인 전"으로 표시한다.
export interface FormDef {
  id: string;
  group: '채용할 때' | '매달' | '바뀔 때' | '퇴사할 때';
  name: string;
  provider: string;
  url: string | null;
  revised: string | null;
  lastChecked: string | null;
  make: null | 'contract' | 'roster' | 'statement' | 'ledger';
  note?: string;
}

const MOEL = 'https://www.moel.go.kr';

export const FORMS: FormDef[] = [
  { id: 'c-std', group: '채용할 때', name: '표준근로계약서 (기간 없음)', provider: '고용노동부', url: MOEL, revised: null, lastChecked: null, make: 'contract' },
  { id: 'c-fixed', group: '채용할 때', name: '표준근로계약서 (기간 있음)', provider: '고용노동부', url: MOEL, revised: null, lastChecked: null, make: 'contract' },
  { id: 'c-part', group: '채용할 때', name: '단시간근로자 표준근로계약서', provider: '고용노동부', url: MOEL, revised: null, lastChecked: null, make: 'contract' },
  { id: 'c-minor', group: '채용할 때', name: '연소근로자 표준근로계약서', provider: '고용노동부', url: MOEL, revised: null, lastChecked: null, make: 'contract' },
  { id: 'c-e9', group: '채용할 때', name: '외국인근로자 표준근로계약서 (E-9)', provider: '고용노동부', url: null, revised: null, lastChecked: null, make: null },
  { id: 'roster', group: '채용할 때', name: '근로자 명부', provider: '근로기준법 시행규칙 별지', url: 'https://www.law.go.kr', revised: null, lastChecked: null, make: 'roster' },
  { id: 'consent', group: '채용할 때', name: '친권자(후견인) 동의서', provider: '고용노동부', url: MOEL, revised: null, lastChecked: null, make: null },
  { id: 'ledger', group: '매달', name: '임금대장', provider: '근로기준법 시행규칙 별지', url: 'https://www.law.go.kr', revised: null, lastChecked: null, make: 'ledger' },
  { id: 'stmt', group: '매달', name: '임금명세서', provider: '고용노동부', url: MOEL, revised: null, lastChecked: null, make: 'statement' },
  { id: 'c-change', group: '바뀔 때', name: '변경 근로계약서', provider: '고용노동부 표준근로계약서 활용', url: MOEL, revised: null, lastChecked: null, make: 'contract' },
  { id: 'leave-promo', group: '바뀔 때', name: '연차 사용 촉진 통보 (5명 이상)', provider: '근로기준법 제61조', url: 'https://www.law.go.kr', revised: null, lastChecked: null, make: null },
  { id: 'resign', group: '퇴사할 때', name: '사직서', provider: '사업장 자체 양식', url: null, revised: null, lastChecked: null, make: null, note: '법정 서식이 없어요 — 사업장 양식을 링크로 등록해 주세요' },
  { id: 'dismiss', group: '퇴사할 때', name: '해고 예고 통지서', provider: '근로기준법 제26·27조', url: 'https://www.law.go.kr', revised: null, lastChecked: null, make: null, note: '작성 전 노무 전문가 확인을 권해요' },
  { id: 'cert', group: '퇴사할 때', name: '사용증명서', provider: '근로기준법 제39조', url: 'https://www.law.go.kr', revised: null, lastChecked: null, make: null },
];

