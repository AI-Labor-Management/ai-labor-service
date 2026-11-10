// 퇴직금 (10_F3 5장). 퇴직금 = 1일 평균임금 × 30일 × (재직일수 ÷ 365). 평균임금이 통상임금보다 낮으면 통상임금.
import { addDays, addMonths, addYears, diffDays } from './dates';
import { resolveRule } from './rules';
import { conditionAt, dailyScheduledHours, weeklyHours } from './work';
import { computePayrollLine, won } from './wage';
import type { AppState, Employee, ISODate } from './types';

export interface SeveranceCalcInput {
  serviceDays: number;
  wage3m: number; // 퇴직 전 3개월 임금 총액
  days3m: number; // 그 기간 달력 일수
  ordinaryDaily: number; // 1일 통상임금
  bonusAnnual?: number;
  leaveAllowanceAnnual?: number;
}

export interface SeveranceCalc {
  eligible: boolean;
  reason: string;
  averageDaily: number;
  ordinaryDaily: number;
  used: 'average' | 'ordinary';
  usedDaily: number;
  amount: number;
  extraAdded: number;
}

/** 순수 계산 — 손계산 예제 검증용 */
export function severanceAmount(i: SeveranceCalcInput, minServiceDays = 365): SeveranceCalc {
  const extra = ((i.bonusAnnual ?? 0) + (i.leaveAllowanceAnnual ?? 0)) * (3 / 12);
  const avg = i.days3m > 0 ? (i.wage3m + extra) / i.days3m : 0;
  const used = avg < i.ordinaryDaily ? 'ordinary' : 'average';
  const usedDaily = used === 'ordinary' ? i.ordinaryDaily : avg;
  if (i.serviceDays < minServiceDays) {
    return { eligible: false, reason: `계속근로 1년 미만 (재직 ${i.serviceDays}일)`, averageDaily: Math.floor(avg), ordinaryDaily: i.ordinaryDaily, used, usedDaily, amount: 0, extraAdded: won(extra) };
  }
  return {
    eligible: true,
    reason: '',
    averageDaily: Math.floor(avg),
    ordinaryDaily: i.ordinaryDaily,
    used,
    usedDaily,
    amount: won((Math.floor(usedDaily) * 30 * i.serviceDays) / 365),
    extraAdded: won(extra),
  };
}

export interface SeveranceEstimate extends SeveranceCalc {
  applicable: 'yes' | 'no' | 'check' | 'e9';
  notes: string[];
  serviceDays: number;
  oneYearDate: ISODate;
  paymentDue: ISODate | null;
  periodFrom: ISODate;
  periodTo: ISODate;
  wage3m: number;
  days3m: number;
  monthlyAccrual: number;
  weeklyHours: number;
}

/**
 * 재직 중이면 "지금 퇴사하면" 기준(마지막 근무일 = 기준일), 퇴사했으면 퇴사일 기준.
 * 3개월 임금은 근무 기록·일정으로 다시 계산(확정 급여가 없을 때 등록 조건으로 예상).
 */
export function estimateSeverance(state: AppState, e: Employee, asOf: ISODate): SeveranceEstimate {
  const last = e.resignDate ?? asOf;
  const serviceDays = diffDays(e.hireDate, last) + 1;
  const c = conditionAt(state.conditions, e.id, last);
  const wh = weeklyHours(c);
  const notes: string[] = [];
  const rule = resolveRule<{ minWeeklyHours: number; paymentDays: number }>('severance.basic', last);
  const minWeekly = rule.ok ? rule.value.minWeeklyHours : 15;
  const payDays = rule.ok ? rule.value.paymentDays : 14;
  const periodTo = last;
  const periodFrom = addMonths(addDays(last, 1), -3);
  const days3m = diffDays(periodFrom, periodTo) + 1;
  const line = computePayrollLine({ state, employee: e, from: periodFrom, to: periodTo, payDate: periodTo, scale: state.workplace?.scale ?? '1-4', grossOnly: true });
  const wage3m = line.gross;
  const ordinaryDaily = won((c?.hourlyWage ?? 0) * dailyScheduledHours(c));
  const calc = severanceAmount({ serviceDays, wage3m, days3m, ordinaryDaily, bonusAnnual: e.bonusAnnual, leaveAllowanceAnnual: e.leaveAllowanceAnnual });
  let applicable: SeveranceEstimate['applicable'] = calc.eligible ? 'yes' : 'no';
  if (e.isForeign && e.foreign?.visa === 'E-9') {
    applicable = 'e9';
    notes.push('E-9: 출국만기보험에 가입하면 퇴직금 제도를 설정한 것으로 보고, 지급은 출국 후 14일 이내예요 (외국인고용법 제13조)');
  }
  if (wh < minWeekly) {
    applicable = 'no';
    notes.push(`4주 평균 주 ${minWeekly}시간 미만은 퇴직금 대상이 아니에요`);
  }
  if (c?.variable) {
    applicable = applicable === 'no' ? 'no' : 'check';
    notes.push('매주 달라요 — 주 15시간 판정 확인 필요');
  }
  if (e.employmentType === 'daily') {
    applicable = applicable === 'no' ? 'no' : 'check';
    notes.push('하루 단위·짧은 계약의 반복 — 계속근로 확인 필요');
  }
  if (e.probationEnd && e.probationEnd >= periodFrom) notes.push('평균임금 기간에 수습이 있어요 — 제외 기간 여부는 전문가 확인 필요');
  if (e.bonusAnnual || e.leaveAllowanceAnnual) notes.push('상여·연차수당 3/12 가산은 법령에 없는 실무 기준이에요 (전문가 확인 권장)');
  if (calc.used === 'ordinary') notes.push('평균임금이 통상임금보다 낮아 통상임금으로 계산했어요 (근로기준법 제2조②)');
  notes.push('1~4명 사업장도 퇴직금은 적용돼요. 퇴직소득세는 계산하지 않아요');
  const monthlyAccrual = won(line.gross / 3 / 12);
  return {
    ...calc,
    applicable,
    notes,
    serviceDays,
    oneYearDate: addYears(e.hireDate, 1),
    paymentDue: e.resignDate ? addDays(e.resignDate, payDays) : null,
    periodFrom,
    periodTo,
    wage3m,
    days3m,
    monthlyAccrual,
    weeklyHours: wh,
  };
}

