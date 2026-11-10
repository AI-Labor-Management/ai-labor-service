// F1 서류 항목 (07_F1_서류체크리스트 2장). 근거 수준: 'verified' = 2026-11-04 원문 확인(✅), 'article' = 조문 확인, 'todo' = 원문 확인 전.
export type ItemGroup = 'workplace' | 'employee' | 'monthly' | 'event' | 'foreign';

export interface ChecklistItemDef {
  id: string;
  title: string;
  group: ItemGroup;
  kind: '서류' | '게시·교육';
  condition: string;
  cycle: string;
  basis: string;
  penalty: string;
  evidence: 'verified' | 'article' | 'todo';
  plain: string; // 쉬운 설명
  todo: string[]; // 해야 할 일
  retention: string;
  reissue?: string;
  ruleIds: string[];
  makeable?: 'contract' | 'roster' | null;
}

export const CHECKLIST_ITEMS: ChecklistItemDef[] = [
  {
    id: 'W1', title: '취업규칙 작성·신고', group: 'workplace', kind: '서류', condition: '상시 10명 이상', cycle: '최초, 변경 시',
    basis: '근로기준법 제93조', penalty: '500만 원 이하 과태료 (제116조②2)', evidence: 'article',
    plain: '근무 시간·임금·휴가 등 회사 규칙을 문서로 만들어 고용노동부에 신고해야 해요.', todo: ['표준 취업규칙 양식으로 작성', '관할 고용노동부에 신고'], retention: '변경 시까지', ruleIds: [],
  },
  {
    id: 'W2', title: '법령 주요 내용·취업규칙 게시 또는 비치', group: 'workplace', kind: '게시·교육', condition: '상시 5명 이상', cycle: '상시',
    basis: '근로기준법 제14조', penalty: '500만 원 이하 과태료 (제116조②2)', evidence: 'article',
    plain: '근로기준법 주요 내용을 직원이 볼 수 있는 곳에 붙이거나 비치해요.', todo: ['게시물 준비', '직원이 볼 수 있는 곳에 게시'], retention: '상시', ruleIds: ['scope.under5.appliedArticles'],
  },
  {
    id: 'W3', title: '최저임금 게시 또는 고지', group: 'workplace', kind: '게시·교육', condition: '직원 1명 이상 (동거 친족만 쓰는 사업 제외)', cycle: '매년',
    basis: '최저임금법 제11조, 제3조①', penalty: '100만 원 이하 과태료 (제31조①1)', evidence: 'verified',
    plain: '올해 최저임금을 직원이 볼 수 있게 게시하거나 알려요.', todo: ['올해 최저임금 안내문 게시'], retention: '매년 갱신', ruleIds: ['minimumWage.hourly'],
  },
  {
    id: 'W4', title: '성희롱 예방 교육 실시와 내용 게시', group: 'workplace', kind: '게시·교육', condition: '직원 1명 이상. 상시 10명 미만은 교육자료 게시·배포로 가능', cycle: '연 1회 이상',
    basis: '남녀고용평등법 제13조, 시행령 제3조①④', penalty: '500만 원 이하 과태료 (제39조③1의2·1의3)', evidence: 'verified',
    plain: '1년에 한 번 이상 성희롱 예방 교육을 하고 내용을 게시해요. 사장님도 함께 받아야 하고, 2026년 11월 27일부터는 법인 대표자·상급자도 교육 대상이에요.', todo: ['교육 실시 또는 자료 게시·배포(10명 미만)', '사장님·대표자·상급자 포함', '실시일 기록'], retention: '3년 권장', ruleIds: ['sexualHarassmentEducation'],
  },
  {
    id: 'W5', title: '식품위생교육 (영업자)', group: 'workplace', kind: '게시·교육', condition: '음식점·카페 영업자(사장님). 일반 종업원은 대상 아님', cycle: '매년 3시간',
    basis: '식품위생법 제41조, 시행규칙 제52조①', penalty: '100만 원 이하 과태료 (제101조④1)', evidence: 'verified',
    plain: '사장님 본인이 매년 3시간 위생교육을 받아요. 직원은 대상이 아니에요.', todo: ['위생교육 기관에서 수강', '수료일 기록'], retention: '매년', ruleIds: ['foodHygieneEducation'],
  },
  {
    id: 'E1', title: '근로계약서 작성·교부', group: 'employee', kind: '서류', condition: '모든 직원', cycle: '근무 시작 전, 조건 변경 시',
    basis: '근로기준법 제17조', penalty: '500만 원 이하 벌금 (제114조1호)', evidence: 'article',
    plain: '계약 내용을 적은 서면을 직원에게 줘야 합니다.', todo: ['등록값으로 채운 계약서 만들기', '서명 후 직원에게 교부, 실물은 사업장에 보관'], retention: '근로관계가 끝난 날부터 3년', ruleIds: ['fixedTerm.writtenTerms', 'records.retentionYears'], makeable: 'contract',
    reissue: '사업장 보관본을 복사해 다시 교부하세요.',
  },
  {
    id: 'E3', title: '근로자 명부 작성', group: 'employee', kind: '서류', condition: '사용기간 30일 미만 일용근로자 외', cycle: '입사 시, 변경 시',
    basis: '근로기준법 제41조, 시행령 제20·21조', penalty: '500만 원 이하 과태료 (제116조②2)', evidence: 'verified',
    plain: '직원별 인적사항·고용 정보를 명부로 작성해 보관해요. 이름은 출력할 때만 입력해요.', todo: ['명부 양식 출력', '이름 등은 출력할 때만 입력 (저장하지 않음)'], retention: '퇴직한 날부터 3년', ruleIds: ['records.rosterException'], makeable: 'roster',
  },
  {
    id: 'E4', title: '가족관계증명서·친권자(후견인) 동의서 비치', group: 'employee', kind: '서류', condition: '18세 미만', cycle: '근무 시작 전',
    basis: '근로기준법 제66조', penalty: '500만 원 이하 과태료 (제116조②2)', evidence: 'article',
    plain: '18세 미만 직원은 가족관계증명서와 친권자 동의서를 받아 사업장에 보관해요.', todo: ['직원에게 서류 요청 (문구 복사)', '받으면 [받음] 처리'], retention: '18세가 되는 날부터 3년', ruleIds: ['minor.limits'],
  },
  {
    id: 'E5', title: '건강진단 결과서(보건증)', group: 'employee', kind: '서류', condition: '식품을 조리·판매하는 일에 직접 종사 (완전 포장 식품의 운반·판매만 하면 제외)', cycle: '근무 시작 전, 매 1년',
    basis: '식품위생법 제40조, 시행규칙 제49조, 건강진단규칙 제2조', penalty: '300만 원 이하 과태료 (제101조③1)', evidence: 'verified',
    plain: '음식을 다루는 직원은 근무 전에 보건증이 있어야 하고, 1년마다 다시 받아요.', todo: ['직원에게 보건증 요청', '검진일·유효기간 입력 (파일은 받지 않아요)'], retention: '유효기간 동안', ruleIds: ['healthCertificate'],
    reissue: '보건소에서 재발급받을 수 있어요.',
  },
  {
    id: 'M1', title: '임금대장 작성', group: 'monthly', kind: '서류', condition: '모든 사업장. 상시 4명 이하는 근로일수·근로시간수 생략 가능', cycle: '임금 지급 때마다',
    basis: '근로기준법 제48조①, 시행령 제27조', penalty: '500만 원 이하 과태료 (제116조②2)', evidence: 'article',
    plain: '급여를 줄 때마다 임금대장을 작성해요. 급여를 확정하면 자동으로 만들어져요.', todo: ['급여 화면에서 확정'], retention: '마지막 기재일부터 3년', ruleIds: ['records.retentionYears'],
  },
  {
    id: 'M2', title: '임금명세서 교부', group: 'monthly', kind: '서류', condition: '모든 직원. 규모 예외 없음', cycle: '임금 지급 때마다',
    basis: '근로기준법 제48조②, 시행령 제27조의2', penalty: '500만 원 이하 과태료 (제116조②2)', evidence: 'verified',
    plain: '급여를 줄 때 명세서를 줘야 해요. 앱으로 교부하면 직원이 열어본 시각이 수령 확인으로 남아요.', todo: ['급여 확정 → 앱 교부 또는 출력'], retention: '보관 권장 (3년 보존 목록에는 없음)', ruleIds: ['wageStatement.electronic'],
  },
  {
    id: 'S3', title: '연차 사용 촉진 (서면 촉구·지정 통보)', group: 'event', kind: '서류', condition: '상시 5명 이상', cycle: '연차 기간 끝나기 6개월 전',
    basis: '근로기준법 제61조', penalty: '촉진하지 않으면 미사용 연차 수당 지급 의무', evidence: 'verified',
    plain: '연차를 다 쓰도록 서면으로 촉구하면 남은 연차 수당 의무가 줄어들 수 있어요.', todo: ['기한 화면의 촉진 시점 확인', '서면 촉구'], retention: '3년', ruleIds: ['annualLeave.promotion'],
  },
  {
    id: 'F1', title: '체류자격·근무처 제한 확인', group: 'foreign', kind: '서류', condition: '모든 외국인', cycle: '채용 시, 변경 시',
    basis: '출입국관리법 제18조 (전문가 확인 권장)', penalty: '과태료는 전문가와 확인해 주세요', evidence: 'todo',
    plain: '체류자격으로 이 일을 할 수 있는지 확인해요. 외국인등록증 사본은 받지 않아요.', todo: ['체류자격·만료일 확인', '확인한 날짜만 기록'], retention: '—', ruleIds: [],
  },
  {
    id: 'F2', title: '시간제취업 허가 확인', group: 'foreign', kind: '서류', condition: 'D-2, D-4', cycle: '근무 시작 전',
    basis: '출입국관리법 제20조, 하이코리아 매뉴얼 (전문가 확인 권장)', penalty: '과태료는 전문가와 확인해 주세요', evidence: 'todo',
    plain: '유학·연수 비자는 시간제취업 허가가 있어야 일할 수 있어요.', todo: ['허가 여부·허가 시간 확인', '직원 정보에 입력'], retention: '—', ruleIds: [],
  },
  {
    id: 'F3', title: '고용·퇴직 등 변동 신고', group: 'foreign', kind: '서류', condition: '신고 대상 외국인', cycle: '변동 시',
    basis: '출입국관리법 제19조 (전문가 확인 권장)', penalty: '과태료는 전문가와 확인해 주세요', evidence: 'todo',
    plain: '외국인 직원의 고용·퇴직 변동을 신고해야 할 수 있어요. 대상과 기한은 확인이 필요해요.', todo: ['신고 대상 여부 확인'], retention: '—', ruleIds: [],
  },
  {
    id: 'F4', title: '외국인고용법 표준근로계약서', group: 'foreign', kind: '서류', condition: 'E-9', cycle: '채용 시',
    basis: '외국인고용법 제9조①', penalty: '—', evidence: 'verified',
    plain: 'E-9 직원은 외국인고용법상 표준근로계약서를 써요.', todo: ['서식 확인', '작성·교부'], retention: '3년', ruleIds: [],
  },
];

export const EVENT_GUIDES = [
  { id: 'S1', title: '변경 계약서 작성·교부', when: '시급·근무시간 등 변경', scope: '모든 직원', basis: '근로기준법 제17조' },
  { id: 'S2', title: '법정 서면 합의서 작성·3년 보존', when: '연장 합의 등', scope: '조문별 적용 범위 확인', basis: '근로기준법 시행령 제22조①8' },
  { id: 'S4', title: '해고 예고 / 사유·시기 서면 통지', when: '해고', scope: '예고는 전체(제26조), 서면 통지는 5명 이상(제27조)', basis: '근로기준법 제26·27조' },
  { id: 'S5', title: '사용증명서 발급', when: '퇴직 후 직원 청구', scope: '전체 (즉시, 직원이 요구한 사항만)', basis: '근로기준법 제39조' },
];

export const ITEM_BY_ID = new Map(CHECKLIST_ITEMS.map((i) => [i.id, i]));

