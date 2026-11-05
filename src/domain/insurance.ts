// F3 4대보험 (10_F3_보험퇴직금). 판정은 "가입 대상 예상 / 제외 예상 / 확인 필요"로만, 금액은 "예상 금액".
import { addDays, diffDays, monthOf, nextMonth15 } from './dates';
import { resolveRule, type Resolved } from './rules';
import { conditionAt, weeklyHours } from './work';
import { monthlyHours, monthlyWageEstimate } from './hours';
import type { AppState, Employee, InsuranceKind, ISODate, PayrollDeduction, Workplace, WorkCondition } from './types';

export type Verdict = 'expected' | 'excluded' | 'check' | 'noRule';

export const VERDICT_LABEL: Record<Verdict, string> = {
  expected: '가입 대상 예상',
  excluded: '제외 예상',
  check: '확인 필요',
  noRule: '기준 없음',
};

export const INSURANCE_LABEL: Record<InsuranceKind, string> = {
  pension: '국민연금',
  health: '건강보험',
  ltc: '장기요양',
  employment: '고용보험',
  industrial: '산재보험',
};

export interface Judgment {
  kind: InsuranceKind;
  verdict: Verdict;
  reasons: string[];
  basis: string[];
}

export interface JudgeInput {
  ageBand: Employee['ageBand'];
  startedBefore65: boolean | null;
  employmentType: Employee['employmentType'];
  hireDate: ISODate;
  contractEnd: ISODate | null;
  isForeign: boolean;
  visa: string | null;
  nationality: string;
  weeklyHours: number;
  variable: boolean;
}

export function judgeInputFor(e: Employee, c: WorkCondition | null): JudgeInput {
  return {
    ageBand: e.ageBand,
    startedBefore65: e.startedBefore65,
    employmentType: e.employmentType,
    hireDate: e.hireDate,
    contractEnd: e.contractEnd,
    isForeign: e.isForeign,
    visa: e.foreign?.visa ?? null,
    nationality: e.foreign?.nationality ?? '',
    weeklyHours: weeklyHours(c),
    variable: !!c?.variable,
  };
}

/** 계약 기간(개월). 기간 없음이면 Infinity */
function contractMonths(j: JudgeInput): number {
  if (j.employmentType === 'regular' || !j.contractEnd) return Infinity;
  return (diffDays(j.hireDate, j.contractEnd) + 1) / 30.4;
}

export function judgeInsurance(j: JudgeInput, date: ISODate): Judgment[] {
  const monthlyH = (j.weeklyHours * 365) / 7 / 12; // 월 소정근로시간(주휴 제외)
  const months = contractMonths(j);
  const daily = j.employmentType === 'daily';
  const variableNote = j.variable ? ['매주 달라요 — 주 평균 예상 시간으로 판정'] : [];
  const out: Judgment[] = [];

  // 산재: 시간 조건 없음
  out.push({ kind: 'industrial', verdict: 'expected', reasons: ['하루만 일해도 적용, 보험료는 전액 사장님 부담'], basis: ['insurance.industrial.rate'] });

  // 고용
  {
    const rule = resolveRule<{ excludeIf: string; except: string[] }>('insurance.employment.eligibility', date);
    const reasons = [...variableNote];
    let verdict: Verdict;
    if (j.isForeign) {
      verdict = 'check';
      reasons.push('외국인 고용보험 적용은 체류자격별 확인 필요 (원문 확인 전)');
    } else if (!rule.ok) {
      if (daily || months >= 3) {
        verdict = 'expected';
        reasons.push(daily ? '일용근로자는 적용' : '3개월 이상 계속 근로는 적용');
      } else {
        verdict = 'noRule';
        reasons.push('2027.1.1부터 "보수가 소득기준 미만이면 제외" — 소득기준 시행령 확정 전이라 이 날짜의 기준이 아직 없어요');
      }
    } else if (daily) {
      verdict = 'expected';
      reasons.push('일용근로자는 적용 (근로내용 확인신고로 갈음)');
    } else if (monthlyH < 60 || j.weeklyHours < 15) {
      if (months >= 3) {
        verdict = 'expected';
        reasons.push('주 15시간 미만이지만 3개월 이상 계속 근로는 적용');
      } else {
        verdict = 'excluded';
        reasons.push(`월 60시간 미만 또는 주 15시간 미만 (주 ${j.weeklyHours.toFixed(1)}시간)`);
      }
    } else {
      verdict = 'expected';
      reasons.push(`주 ${j.weeklyHours.toFixed(1)}시간`);
    }
    if (verdict === 'expected' && j.ageBand === '65+') {
      if (j.startedBefore65 === null) {
        verdict = 'check';
        reasons.push('65세 전부터 일했는지 확인 필요');
      } else if (!j.startedBefore65) reasons.push('65세 이후 새로 고용 — 실업급여 보험료 없음(고용안정 사장님분만)');
    }
    out.push({ kind: 'employment', verdict, reasons, basis: ['insurance.employment.eligibility', 'insurance.employment.age65'] });
  }

  // 건강 (+장기요양)
  {
    const reasons = [...variableNote];
    let verdict: Verdict;
    if (j.isForeign) {
      verdict = 'check';
      reasons.push('외국인 건강보험은 확인 필요');
    } else if (daily) {
      verdict = 'check';
      reasons.push('하루 단위 고용 — 1개월 미만 일용은 제외, 계속 여부 확인 필요');
    } else if (months < 1) {
      verdict = 'excluded';
      reasons.push('1개월 미만 계약');
    } else if (monthlyH < 60 || j.weeklyHours < 15) {
      verdict = 'excluded';
      reasons.push(monthlyH < 60 ? `월 60시간 미만 단시간 (월 약 ${monthlyH.toFixed(0)}시간)` : `주 15시간 미만 — 월 60시간 경계 근처(월 약 ${monthlyH.toFixed(0)}시간)라 실제 계약 기준 확인 권장`);
    } else {
      verdict = 'expected';
      reasons.push(`월 약 ${monthlyH.toFixed(0)}시간`);
    }
    out.push({ kind: 'health', verdict, reasons, basis: ['insurance.health.rate'] });
    out.push({ kind: 'ltc', verdict, reasons: ['건강보험과 함께 부과'], basis: ['insurance.ltc.rate'] });
  }

  // 국민연금
  {
    const reasons = [...variableNote];
    let verdict: Verdict;
    if (j.ageBand === 'under18') {
      verdict = 'check';
      reasons.push('18세 미만 — 확인 필요');
    } else if (j.ageBand === '60-64' || j.ageBand === '65+') {
      verdict = 'excluded';
      reasons.push('사업장가입자 나이 18세 이상 60세 미만');
    } else if (j.isForeign) {
      verdict = 'check';
      reasons.push(j.nationality ? `국적(${j.nationality})별 상호주의 확인 필요` : '국적별 상호주의 — 국적 입력 시 안내, 확인 필요');
    } else if (daily) {
      verdict = 'check';
      reasons.push('일용 — 1개월 이상 계속 + 월 8일 이상 또는 월 60시간 이상이면 포함');
    } else if (months < 1) {
      verdict = 'excluded';
      reasons.push('1개월 미만 계약');
    } else if (monthlyH < 60 || j.weeklyHours < 15) {
      verdict = 'excluded';
      reasons.push(monthlyH < 60 ? '월 60시간 미만 단시간 (예외 있음)' : '주 15시간 미만 — 월 60시간 경계 근처, 실제 계약 기준 확인 권장 (예외 있음)');
    } else {
      verdict = 'expected';
      reasons.push('18세 이상 60세 미만, 월 60시간 이상');
    }
    out.push({ kind: 'pension', verdict, reasons, basis: ['insurance.pension.age', 'insurance.pension.rate'] });
  }
  const order: InsuranceKind[] = ['pension', 'health', 'ltc', 'employment', 'industrial'];
  return order.map((k) => out.find((o) => o.kind === k)!);
}

export interface PremiumRow {
  kind: InsuranceKind;
  verdict: Verdict;
  worker: number | null;
  employer: number | null;
  status: 'verified' | 'announced' | 'partial' | 'missing' | 'excluded';
  note: string;
  basis: string[];
}

const floor10 = (n: number) => Math.floor(n / 10) * 10;

function st(r: Resolved<unknown>): PremiumRow['status'] {
  if (!r.ok) return 'missing';
  return r.status === 'announced' ? 'announced' : r.status === 'partial' ? 'partial' : 'verified';
}

/**
 * 예상 보험료. 기준 보수 = 월 임금 − 비과세(식대 월 20만 원 이하).
 * 끝수: 국민연금 기준소득월액 천 원 미만 버림(확인), 보험료 10원 미만 절사(공단별 적용 확인 전 → "예상").
 */
export function premiums(base: number, date: ISODate, judgments: Judgment[], industry: Workplace['industry'], ageBand: Employee['ageBand'], startedBefore65: boolean | null): PremiumRow[] {
  const rows: PremiumRow[] = [];
  const v = (k: InsuranceKind) => judgments.find((j) => j.kind === k)?.verdict ?? 'check';
  const excludedRow = (kind: InsuranceKind, verdict: Verdict, basis: string[]): PremiumRow => ({ kind, verdict, worker: 0, employer: 0, status: 'excluded', note: verdict === 'excluded' ? '제외 예상' : '', basis });

  // 연금
  {
    const rate = resolveRule<number>('insurance.pension.rate', date);
    const bi = resolveRule<{ min: number; max: number; truncateUnder: number }>('insurance.pension.baseIncome', date);
    const verdict = v('pension');
    if (verdict === 'excluded') rows.push(excludedRow('pension', verdict, ['insurance.pension.rate']));
    else if (!rate.ok || !bi.ok) rows.push({ kind: 'pension', verdict, worker: null, employer: null, status: 'missing', note: !rate.ok ? '요율 기준 없음' : '기준소득월액 하한·상한 기준 없음', basis: ['insurance.pension.rate', 'insurance.pension.baseIncome'] });
    else {
      const b = Math.min(bi.value.max, Math.max(bi.value.min, Math.floor(base / bi.value.truncateUnder) * bi.value.truncateUnder));
      const amt = floor10(b * rate.value);
      rows.push({ kind: 'pension', verdict, worker: amt, employer: amt, status: st(rate), note: `기준소득월액 ${b.toLocaleString('ko-KR')}원 × ${(rate.value * 100).toFixed(2)}%`, basis: ['insurance.pension.rate', 'insurance.pension.baseIncome'] });
    }
  }
  // 건강·장기요양
  {
    const verdict = v('health');
    const hr = resolveRule<number>('insurance.health.rate', date);
    const lr = resolveRule<number>('insurance.ltc.rate', date);
    if (verdict === 'excluded') {
      rows.push(excludedRow('health', verdict, ['insurance.health.rate']));
      rows.push(excludedRow('ltc', verdict, ['insurance.ltc.rate']));
    } else {
      if (!hr.ok) rows.push({ kind: 'health', verdict, worker: null, employer: null, status: 'missing', note: '기준 없음', basis: ['insurance.health.rate'] });
      else {
        const amt = floor10((base * hr.value) / 2);
        rows.push({ kind: 'health', verdict, worker: amt, employer: amt, status: st(hr), note: `${base.toLocaleString('ko-KR')}원 × ${((hr.value / 2) * 100).toFixed(3)}%`, basis: ['insurance.health.rate'] });
      }
      if (!lr.ok) rows.push({ kind: 'ltc', verdict, worker: null, employer: null, status: 'missing', note: '기준 없음', basis: ['insurance.ltc.rate'] });
      else {
        const amt = floor10((base * lr.value) / 2);
        rows.push({ kind: 'ltc', verdict, worker: amt, employer: amt, status: st(lr), note: `소득 × ${((lr.value / 2) * 100).toFixed(4)}%`, basis: ['insurance.ltc.rate'] });
      }
    }
  }
  // 고용
  {
    const verdict = v('employment');
    const ur = resolveRule<number>('insurance.employment.unemploymentRate', date);
    const sr = resolveRule<{ under150: number }>('insurance.employment.stabilityRate', date);
    if (verdict === 'excluded') rows.push(excludedRow('employment', verdict, ['insurance.employment.eligibility']));
    else if (verdict === 'noRule') rows.push({ kind: 'employment', verdict, worker: null, employer: null, status: 'missing', note: '이 날짜의 가입 기준이 아직 없어요', basis: ['insurance.employment.eligibility'] });
    else if (!ur.ok || !sr.ok) rows.push({ kind: 'employment', verdict, worker: null, employer: null, status: 'missing', note: '요율 기준 없음', basis: ['insurance.employment.unemploymentRate'] });
    else {
      const noUnemployment = ageBand === '65+' && startedBefore65 === false;
      const w = noUnemployment ? 0 : floor10((base * ur.value) / 2);
      const er = floor10(base * ((noUnemployment ? 0 : ur.value / 2) + sr.value.under150));
      rows.push({ kind: 'employment', verdict, worker: w, employer: er, status: st(ur), note: noUnemployment ? '65세 이후 신규 고용 — 실업급여분 없음' : `근로자 ${((ur.value / 2) * 100).toFixed(2)}% / 사장님 ${((ur.value / 2 + sr.value.under150) * 100).toFixed(2)}% (150명 미만)`, basis: ['insurance.employment.unemploymentRate', 'insurance.employment.stabilityRate'] });
    }
  }
  // 산재
  {
    const r = resolveRule<{ total: number }>('insurance.industrial.rate', date);
    if (industry === 'service') rows.push({ kind: 'industrial', verdict: 'expected', worker: 0, employer: null, status: 'missing', note: '기타 서비스업 요율은 규칙 파일에 없어요 (음식·숙박·도소매만 확인)', basis: ['insurance.industrial.rate'] });
    else if (!r.ok) rows.push({ kind: 'industrial', verdict: 'expected', worker: 0, employer: null, status: 'missing', note: '이 날짜의 산재요율 고시가 아직 없어요', basis: ['insurance.industrial.rate'] });
    else rows.push({ kind: 'industrial', verdict: 'expected', worker: 0, employer: floor10(base * r.value.total), status: st(r), note: `${(r.value.total * 100).toFixed(2)}% 전액 사장님`, basis: ['insurance.industrial.rate'] });
  }
  return rows;
}

export function premiumTotals(rows: PremiumRow[]): { worker: number | null; employer: number | null; incomplete: boolean } {
  const incomplete = rows.some((r) => r.verdict !== 'excluded' && (r.worker === null || r.employer === null || r.verdict === 'check'));
  if (rows.some((r) => r.worker === null || r.employer === null)) return { worker: null, employer: null, incomplete: true };
  return { worker: rows.reduce((s, r) => s + (r.worker ?? 0), 0), employer: rows.reduce((s, r) => s + (r.employer ?? 0), 0), incomplete };
}

export function insuranceBase(c: WorkCondition | null, date: ISODate): number {
  if (!c) return 0;
  const limit = resolveRule<number>('tax.mealAllowanceNonTaxable', date);
  const meal = c.mealAllowance || 0;
  return monthlyWageEstimate(c, date) - Math.min(meal, limit.ok ? limit.value : 0);
}

export function employeeInsurance(state: AppState, e: Employee, date: ISODate) {
  const c = conditionAt(state.conditions, e.id, date);
  const judgments = judgeInsurance(judgeInputFor(e, c), date);
  const base = insuranceBase(c, date);
  const rows = premiums(base, date, judgments, state.workplace?.industry ?? 'food', e.ageBand, e.startedBefore65);
  return { condition: c, judgments, base, rows, totals: premiumTotals(rows), monthlyHours: c ? monthlyHours(weeklyHours(c), date) : 0 };
}

export function noticeFor(state: AppState, employeeId: string, month: string) {
  return state.insuranceNotices
    .filter((n) => n.employeeId === employeeId && n.fromMonth <= month)
    .sort((a, b) => (a.fromMonth < b.fromMonth ? 1 : a.fromMonth > b.fromMonth ? -1 : a.enteredAt < b.enteredAt ? 1 : -1))[0];
}

/** F2 공제로 넘기는 근로자 부담분. 고지서 금액을 입력했으면 그 값이 우선한다. */
export function employeeMonthlyPremiums(state: AppState, e: Employee, month: string, date: ISODate): PayrollDeduction[] {
  const ins = employeeInsurance(state, e, date);
  const notice = noticeFor(state, e.id, month);
  const kinds: Exclude<InsuranceKind, 'industrial'>[] = ['pension', 'health', 'ltc', 'employment'];
  return kinds.map((k) => {
    const label = INSURANCE_LABEL[k];
    const n = notice?.amounts[k];
    if (n != null) return { code: k, label, amount: n, source: 'notice', note: `고지서 금액 (${notice!.fromMonth}부터 입력값)` };
    const row = ins.rows.find((r) => r.kind === k)!;
    if (row.verdict === 'excluded') return { code: k, label, amount: 0, source: 'excluded', note: '제외 예상' };
    if (row.verdict === 'check' || row.verdict === 'noRule') return { code: k, label, amount: null, source: 'missing', note: `${VERDICT_LABEL[row.verdict]} — 고지서 금액을 입력하면 공제해요` };
    if (row.worker === null) return { code: k, label, amount: null, source: 'missing', note: row.note };
    return { code: k, label, amount: row.worker, source: 'estimate', note: `예상 금액${row.status === 'announced' ? ' · 발표 기준' : ''}` };
  });
}

/** 4대보험 취득·상실 신고 기한: 건강 14일 이내, 연금·고용·산재 다음 달 15일 */
export function reportDeadlines(eventDate: ISODate, date: ISODate) {
  const r = resolveRule<{ health: { days: number } }>('insurance.reportDeadline', date);
  const days = r.ok ? r.value.health.days : 14;
  const health = addDays(eventDate, days);
  const others = nextMonth15(eventDate);
  return { health, others, first: health < others ? health : others, ruleOk: r.ok };
}

/** 상실일 = 퇴사일 다음 날 */
export function lossDate(resignDate: ISODate): ISODate {
  return addDays(resignDate, 1);
}

export function monthKey(date: ISODate) {
  return monthOf(date);
}
