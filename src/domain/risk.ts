// 노무 위험 점검 (12_홈_위험점검 3장). 등록 데이터로 알 수 없는 실제 운영 습관만 묻는다.
import { addMonths } from './dates';
import { conditionAt, isUnder5, weeklyHours } from './work';
import type { AppState, ISODate, RiskAnswer, RiskAnswerValue } from './types';

export interface RiskQuestion {
  id: string;
  no: number;
  text: string;
  dangerAnswer: RiskAnswerValue;
  risk: string;
  action: string;
  actionLink: string;
  expert: boolean;
  basis: string;
  under5Info?: string; // 1~4명이면 위험으로 세지 않고 안내만
  visible: (s: AppState, base: ISODate) => boolean;
}

const activeEmps = (s: AppState, base: ISODate) => s.employees.filter((e) => !e.resignDate || e.resignDate >= base);

export const RISK_QUESTIONS: RiskQuestion[] = [
  { id: 'R1', no: 1, text: '휴게시간을 근무 중에 실제로 쉬게 하시나요?', dangerAnswer: 'no', risk: '쉰 시간도 근무로 계산돼 임금 차액을 청구받을 수 있어요', action: '근무 일정에 휴게시간 반영 (2026.12.10부터 4시간 근무는 직원이 요청하면 생략 가능 — 요청 기록 남기기)', actionLink: '/owner/work', expert: false, basis: '근로기준법 제54조', visible: (s, b) => activeEmps(s, b).length > 0 },
  { id: 'R2', no: 2, text: '주 15시간 이상 직원에게 주휴수당을 주시나요?', dangerAnswer: 'no', risk: '퇴사 후 밀린 주휴수당을 한꺼번에 청구받을 수 있어요', action: '급여 화면에서 주휴수당 계산', actionLink: '/owner/payroll', expert: false, basis: '근로기준법 제55조', visible: (s, b) => activeEmps(s, b).some((e) => weeklyHours(conditionAt(s.conditions, e.id, b)) >= 15) },
  { id: 'R3', no: 3, text: '수습 기간에 최저임금보다 적게 주시나요?', dangerAnswer: 'yes', risk: '감액 조건이 맞지 않으면 차액이 체불이 돼요', action: '노무 전문가와 확인', actionLink: '/owner/consult?topic=수습 감액', expert: true, basis: '최저임금법 제5조', visible: (s, b) => activeEmps(s, b).some((e) => !!e.probationEnd && e.probationEnd >= b) },
  { id: 'R4', no: 4, text: '지각 벌금이나 파손 비용을 월급에서 빼시나요?', dangerAnswer: 'yes', risk: '뺀 금액이 체불로 인정될 수 있어요', action: '노무 전문가와 확인', actionLink: '/owner/consult?topic=임금 공제', expert: true, basis: '근로기준법 제20조, 제43조', visible: () => true },
  { id: 'R5', no: 5, text: '월급을 정해진 날에 한 번에 다 주시나요?', dangerAnswer: 'no', risk: '체불 진정 대상이 될 수 있어요', action: '급여일 알림 확인 (기한 화면)', actionLink: '/owner/deadlines', expert: false, basis: '근로기준법 제43조', visible: () => true },
  { id: 'R6', no: 6, text: '계약서와 다른 요일·시간으로 자주 일을 시키시나요?', dangerAnswer: 'yes', risk: '분쟁 때 계약서가 불리한 증거가 돼요', action: '변경 계약서 만들기', actionLink: '/owner/documents?item=E1', expert: false, basis: '근로기준법 제17조', visible: () => true },
  { id: 'R7', no: 7, text: '연장근무를 직원과 미리 합의하시나요?', dangerAnswer: 'no', risk: '한도(주 12시간)를 넘기면 처벌 대상이에요', action: '근무 일정에서 주간 시간 확인', actionLink: '/owner/work', expert: false, basis: '근로기준법 제53조 (1~4명은 시행령 별표 1에 제53조 없음)', under5Info: '1~4명 사업장은 법적 의무가 아니에요. 권장 사항으로 안내해요.', visible: () => true },
  { id: 'R8', no: 8, text: '직원을 내보낼 때 30일 전에 알리시나요?', dangerAnswer: 'no', risk: '30일분 통상임금(예고수당) 청구, 5명 이상은 서면 통지·부당해고 다툼', action: '노무 전문가와 확인', actionLink: '/owner/consult?topic=해고 예고', expert: true, basis: '근로기준법 제26조(1~4명 포함), 제27조(5명 이상)', visible: () => true },
  { id: 'R9', no: 9, text: '괴롭힘 신고가 들어오면 처리 방법을 정해 두셨나요?', dangerAnswer: 'no', risk: '신고 후 조치를 안 하면 사장님 책임(과태료)', action: '노무 전문가와 확인', actionLink: '/owner/consult?topic=직장 내 괴롭힘', expert: true, basis: '근로기준법 제76조의2·3 (1~4명은 별표 1 제6장에 제76조만 있음, 팀원 의견은 적용 — 11.26 직전 재확인)', under5Info: '1~4명 사업장은 법적 의무가 아니에요(시행령 별표 1). 정부가 적용 확대를 추진 중이라 권장으로 안내해요.', visible: () => true },
  { id: 'R10', no: 10, text: '퇴사자 임금·퇴직금을 14일 안에 정산하시나요?', dangerAnswer: 'no', risk: '지연 시 체불 진정 대상이에요', action: '퇴사 처리 화면', actionLink: '/owner/employees', expert: false, basis: '근로기준법 제36조', visible: () => true },
  { id: 'R11', no: 11, text: '18세 미만 직원에게 밤 10시 이후나 휴일에 일을 시키시나요?', dangerAnswer: 'yes', risk: '본인 동의와 고용노동부장관 인가가 필요해요', action: '근무 일정 확인 · 전문가 확인', actionLink: '/owner/work', expert: true, basis: '근로기준법 제70조②', visible: (s, b) => activeEmps(s, b).some((e) => e.ageBand === 'under18') },
];

export type RiskResult = 'risk' | 'check' | 'ok' | 'info' | 'unanswered' | 'stale';

export interface RiskRow {
  q: RiskQuestion;
  answer: RiskAnswer | null;
  result: RiskResult;
  text: string;
}

export function evaluateRisk(state: AppState, base: ISODate): { rows: RiskRow[]; answered: number; total: number; riskCount: number; checkCount: number } {
  const scale = state.workplace?.scale ?? '1-4';
  const under5 = isUnder5(scale);
  const rows: RiskRow[] = [];
  for (const q of RISK_QUESTIONS) {
    if (!q.visible(state, base)) continue;
    const a = state.riskAnswers.find((x) => x.questionId === q.id) ?? null;
    let result: RiskResult = 'unanswered';
    let text = '';
    if (a) {
      const stale = addMonths(a.answeredAt, 6) <= base || a.scaleAtAnswer !== scale;
      if (stale) {
        result = 'stale';
        text = a.scaleAtAnswer !== scale ? '규모 구간이 바뀌어 다시 확인해요' : '6개월이 지나 다시 확인해요';
      } else if (a.answer === 'unknown') {
        result = 'check';
        text = '잘 모르겠어요 — 확인 필요';
      } else if (a.answer === q.dangerAnswer) {
        if (under5 && q.under5Info) {
          result = 'info';
          text = q.under5Info;
        } else {
          result = 'risk';
          text = q.risk;
        }
      } else {
        result = 'ok';
        text = '';
      }
    }
    rows.push({ q, answer: a, result, text });
  }
  const answered = rows.filter((r) => r.answer && r.result !== 'stale').length;
  return { rows, answered, total: rows.length, riskCount: rows.filter((r) => r.result === 'risk').length, checkCount: rows.filter((r) => r.result === 'check').length };
}
