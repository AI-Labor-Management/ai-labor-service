// 연차 (13_근무 4장). 5명 이상만. 1년 미만 매달 개근 1일(최대 11일), 1년 80% 이상 15일, 3년차부터 2년마다 +1일(최대 25일).
import { addDays, addMonths, addYears, diffDays } from './dates';
import { resolveRule } from './rules';
import { conditionAt, dayPlan, isUnder5, weeklyHours } from './work';
import type { AppState, Employee, ISODate } from './types';

export interface LeaveAccrual {
  applicable: boolean;
  reason: string;
  firstYearDays: number;
  annualDays: number;
  totalDays: number;
  usedDays: number;
  remainingDays: number;
  partTime: boolean;
  totalHours: number | null; // 단시간이면 시간 단위
  usedHours: number | null;
  remainingHours: number | null;
  currentYearStart: ISODate;
  currentYearEnd: ISODate;
  promotion: { notifyFrom: ISODate; notifyTo: ISODate; designateBy: ISODate } | null;
}

/** 근속 연수에 따른 연간 연차 (출근율 80% 이상 가정) */
export function annualDaysForYear(completedYears: number, rule: { base: number; plusEvery2Years: number; max: number }): number {
  if (completedYears < 1) return 0;
  return Math.min(rule.max, rule.base + Math.floor((completedYears - 1) / 2) * rule.plusEvery2Years);
}

/** 1년 미만 월 단위 발생: 개근한 달마다 1일, 최대 11일 */
export function firstYearMonthly(hireDate: ISODate, asOf: ISODate, absentMonths: number): number {
  let months = 0;
  for (let k = 1; k <= 11; k++) {
    if (addMonths(hireDate, k) <= asOf) months++;
  }
  return Math.max(0, months - absentMonths);
}

export function leaveAccrual(state: AppState, e: Employee, asOf: ISODate): LeaveAccrual {
  const empty = (reason: string): LeaveAccrual => ({ applicable: false, reason, firstYearDays: 0, annualDays: 0, totalDays: 0, usedDays: 0, remainingDays: 0, partTime: false, totalHours: null, usedHours: null, remainingHours: null, currentYearStart: e.hireDate, currentYearEnd: e.hireDate, promotion: null });
  if (isUnder5(state.workplace?.scale)) return empty('1~4명 사업장은 연차 규정이 적용되지 않아요 (근로기준법 시행령 별표 1)');
  const c = conditionAt(state.conditions, e.id, asOf);
  const wh = weeklyHours(c);
  const minW = resolveRule<number>('weeklyHoliday.minWeeklyHours', asOf);
  if (wh < (minW.ok ? minW.value : 15)) return empty('주 15시간 미만은 연차가 없어요');
  const rule = resolveRule<{ firstYearPerMonth: number; base: number; plusEvery2Years: number; max: number }>('annualLeave.accrual', asOf);
  if (!rule.ok) return empty('연차 규칙이 이 날짜에 없어요');
  const years = Math.floor(diffDays(e.hireDate, asOf) / 365.25);
  let yearStart = e.hireDate;
  for (let y = 1; y <= years; y++) yearStart = addYears(e.hireDate, y);
  const yearEnd = addYears(yearStart, 1);
  // 개근하지 못한 달 (결근 기록 기준)
  const absences = state.overrides.filter((o) => o.employeeId === e.id && o.kind === 'absent');
  let absentMonths = 0;
  for (let k = 0; k < 11; k++) {
    const ms = addMonths(e.hireDate, k);
    const me = addMonths(e.hireDate, k + 1);
    if (absences.some((a) => a.date >= ms && a.date < me)) absentMonths++;
  }
  const firstYearDays = firstYearMonthly(e.hireDate, asOf, absentMonths);
  const annualDays = annualDaysForYear(years, rule.value);
  // 1년 미만 연차와 1년차 15일은 사용 기간이 달라 단순 합산하면 과대 표시될 수 있어 현재 연차 기간 기준으로 보여준다
  const totalDays = years >= 1 ? annualDays : firstYearDays;
  const used = state.leaveRequests.filter((l) => l.employeeId === e.id && l.status === 'approved' && l.date >= yearStart && l.date < yearEnd);
  const usedOverrides = state.overrides.filter((o) => o.employeeId === e.id && o.kind === 'leave' && o.date >= yearStart && o.date < yearEnd && !used.some((u) => u.date === o.date));
  const dailyHours = c && !c.variable ? wh / Math.max(1, c.schedule.filter(Boolean).length) : 8;
  const usedHoursTotal = used.reduce((s, l) => s + (l.hours ?? dailyHours), 0) + usedOverrides.length * dailyHours;
  const partTime = wh < 40;
  let totalHours: number | null = null;
  if (partTime) {
    totalHours = Math.ceil(totalDays * (wh / 40) * 8);
  }
  const usedDays = Math.round((usedHoursTotal / dailyHours) * 10) / 10;
  let promotion: LeaveAccrual['promotion'] = null;
  const promo = resolveRule<{ overOneYear: { notifyMonthsBefore: number; notifyWindowDays: number; designateMonthsBefore: number } }>('annualLeave.promotion', asOf);
  if (years >= 1 && promo.ok) {
    const p = promo.value.overOneYear;
    const notifyFrom = addMonths(yearEnd, -p.notifyMonthsBefore);
    promotion = { notifyFrom, notifyTo: addDays(notifyFrom, p.notifyWindowDays - 1), designateBy: addMonths(yearEnd, -p.designateMonthsBefore) };
  }
  return {
    applicable: true,
    reason: '',
    firstYearDays,
    annualDays,
    totalDays,
    usedDays,
    remainingDays: Math.max(0, Math.round((totalDays - usedDays) * 10) / 10),
    partTime,
    totalHours,
    usedHours: partTime ? Math.round(usedHoursTotal * 10) / 10 : null,
    remainingHours: partTime && totalHours != null ? Math.max(0, Math.round((totalHours - usedHoursTotal) * 10) / 10) : null,
    currentYearStart: yearStart,
    currentYearEnd: addDays(yearEnd, -1),
    promotion,
  };
}

export function isScheduledDay(state: AppState, e: Employee, date: ISODate): boolean {
  return !!dayPlan(state, e, date).contract;
}
