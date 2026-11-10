// 비회원 1분 자가진단 (21_화면예시_홍보페이지 3장). 답은 저장하지 않는다.
export interface DiagAnswers {
  industry: 'food' | 'retail' | 'service' | null;
  staff: '0' | '1-4' | '5-9' | '10+' | null;
  kinds: ('alba' | 'foreign' | 'minor' | 'none')[];
  contract: 'all' | 'some' | 'none' | 'unknown' | null;
  weeklyHoliday: 'yes' | 'no' | 'unknown' | 'na' | null;
  insurance: 'self' | 'agent' | 'notYet' | 'unknown' | null;
  concern: 'dismiss' | 'allowance' | 'foreign' | 'schedule' | 'none' | null;
}

export const EMPTY_DIAG: DiagAnswers = { industry: null, staff: null, kinds: [], contract: null, weeklyHoliday: null, insurance: null, concern: null };

export interface DiagItem {
  level: 'risk' | 'check' | 'info';
  title: string;
  basis: string;
  join: string;
}

export function diagnosisSteps(a: DiagAnswers): (keyof DiagAnswers)[] {
  const all: (keyof DiagAnswers)[] = ['industry', 'staff', 'kinds', 'contract', 'weeklyHoliday', 'insurance', 'concern'];
  return a.staff === '0' ? all.filter((k) => k !== 'contract' && k !== 'weeklyHoliday' && k !== 'insurance') : all;
}

export function diagnose(a: DiagAnswers): { items: DiagItem[]; showGuestConsult: boolean; topic: string } {
  const items: DiagItem[] = [];
  if (a.staff === '0') {
    items.push({ level: 'info', title: '채용 준비: 근로계약서는 근무 시작 전에 써서 줘야 해요', basis: '근로기준법 제17조', join: '→ 가입하면 채용 전 점검에서 시급·근무시간으로 인건비와 필요한 서류를 미리 계산해요' });
    items.push({ level: 'info', title: '채용 준비: 최저임금(2026년 10,320원)과 주 15시간 이상이면 주휴수당', basis: '최저임금법 제6조 · 근로기준법 제55조', join: '→ 가입하면 조건을 넣는 즉시 최저임금·주휴를 확인해요' });
  }
  if (a.contract === 'some' || a.contract === 'none') items.push({ level: 'risk', title: a.contract === 'none' ? '근로계약서를 쓰지 않았어요' : '근로계약서를 일부 직원만 썼어요', basis: '근로기준법 제17조 (500만 원 이하 벌금)', join: '→ 가입하면 등록한 근무 조건으로 계약서를 채워 출력해요' });
  if (a.contract === 'unknown') items.push({ level: 'check', title: '근로계약서 작성 여부를 확인해 주세요', basis: '근로기준법 제17조', join: '→ 가입하면 직원별 서류 상태를 한 표로 봐요' });
  if (a.weeklyHoliday === 'no') items.push({ level: 'risk', title: '주 15시간 이상 직원에게 주휴수당을 주지 않고 있어요', basis: '근로기준법 제55조 · 제18조③', join: '→ 가입하면 근무 시간으로 주휴수당과 근거를 함께 계산해요' });
  if (a.weeklyHoliday === 'unknown') items.push({ level: 'check', title: '주휴수당 대상인지 확인이 필요해요', basis: '근로기준법 제18조③', join: '→ 가입하면 4주 평균 주 15시간 기준으로 자동 판단해요' });
  if (a.insurance === 'notYet') items.push({ level: 'risk', title: '4대보험을 아직 처리하지 않았어요', basis: '건강보험 14일 이내, 연금·고용·산재 다음 달 15일까지 신고', join: '→ 가입하면 직원별 신고 기한을 날짜로 알려줘요' });
  if (a.insurance === 'unknown') items.push({ level: 'check', title: '4대보험 처리 상태를 확인해 주세요', basis: '국민건강보험법 제8조② 등', join: '→ 가입하면 처리 방식(직접·맡김·이미 처리)을 직원별로 관리해요' });
  if (a.concern === 'dismiss') items.push({ level: 'risk', title: '퇴사·내보내기 고민 — 전문가 확인을 권해요', basis: '근로기준법 제26조(해고 예고), 제27조(5명 이상 서면 통지)', join: '→ 가입하면 퇴사 처리 마법사로 예고·통지 순서를 점검해요. 판단은 고용노동부 고객상담센터(☎ 1350)에 확인해 주세요' });
  if (a.kinds.includes('foreign') || a.concern === 'foreign') items.push({ level: 'check', title: '외국인·유학생 직원은 체류자격과 허가 시간 확인이 필요해요', basis: '출입국관리법 (전문가 확인 권장)', join: '→ 가입하면 체류기간 만료와 허가시간 초과를 미리 알려줘요' });
  if (a.kinds.includes('minor')) items.push({ level: 'check', title: '18세 미만 직원은 친권자 동의서·가족관계증명서와 근로시간 한도가 있어요', basis: '근로기준법 제66조 · 제69조', join: '→ 가입하면 1일 7시간·주 35시간 초과와 야간·휴일 근무를 경고해요' });
  if (a.industry === 'food') items.push({ level: 'check', title: '음식점·카페는 보건증(매 1년)과 사장님 식품위생교육이 필요해요', basis: '식품위생법 제40조 · 제41조', join: '→ 가입하면 보건증 유효기간 30일 전부터 알려줘요' });
  if (a.staff === '5-9') items.push({ level: 'check', title: '5명 이상 사업장은 연장·야간·휴일 가산, 연차, 법령 게시가 적용돼요', basis: '근로기준법 시행령 별표 1', join: '→ 가입하면 규모에 맞는 항목만 보여줘요' });
  if (a.staff === '10+') items.push({ level: 'check', title: '10명 이상 사업장은 취업규칙 작성·신고가 필요해요', basis: '근로기준법 제93조', join: '→ 가입하면 규모별 서류를 자동으로 정리해요' });
  if (a.staff && a.staff !== '0') items.push({ level: 'info', title: '임금명세서는 규모와 관계없이 매번 줘야 해요', basis: '근로기준법 제48조②', join: '→ 가입하면 급여 확정 후 앱으로 교부하고 수령 확인을 남겨요' });
  if (a.staff === '1-4') items.push({ level: 'info', title: '1~4명 사업장은 연장·야간·휴일 가산이 적용되지 않아요 (일한 시간 임금은 지급)', basis: '근로기준법 시행령 별표 1', join: '→ 가입하면 가산이 0원인 이유를 근거와 함께 보여줘요' });
  if (a.kinds.includes('alba')) items.push({ level: 'info', title: '아르바이트도 근로계약서·주휴수당·퇴직금 대상이 될 수 있어요', basis: '근로기준법 제17조 · 퇴직급여법 제4조', join: '→ 가입하면 단시간 근로계약서 양식으로 채워줘요' });
  const order = { risk: 0, check: 1, info: 2 };
  items.sort((x, y) => order[x.level] - order[y.level]);
  const showGuestConsult = items.some((i) => i.level === 'risk') || a.concern === 'dismiss';
  const topic = a.concern === 'dismiss' ? '퇴사·내보내기' : a.concern === 'allowance' ? '수당' : a.concern === 'foreign' ? '외국인' : a.concern === 'schedule' ? '일정·대타' : '기타';
  return { items, showGuestConsult, topic };
}

export const PREFILL_KEY = 'ai-labor-demo/diagnosis-prefill';

