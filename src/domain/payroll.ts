// 월 급여 흐름 (08_F2 4장): 초안 → 바뀐 날 수정 → 규모 확인 → 확인 대기 처리 → 결과 확인 → 확정(스냅샷) → 명세서 교부
import { addMonthsYM, endOfMonth, startOfMonth } from './dates';
import { computePayrollLine } from './wage';
import type { AppState, ISODate, PayrollLine, PayrollMonth, Workplace } from './types';

/** 'YYYY-MM' 근무 기간의 산정 기간과 지급일 */
export function payrollPeriodFor(wp: Pick<Workplace, 'payDay' | 'payMonthBasis'>, month: string): { from: ISODate; to: ISODate; payDate: ISODate } {
  const payMonth = wp.payMonthBasis === 'previous' ? addMonthsYM(month, 1) : month;
  const last = Number(endOfMonth(payMonth).slice(8));
  const payDate = `${payMonth}-${String(Math.min(wp.payDay, last)).padStart(2, '0')}`;
  return { from: startOfMonth(month), to: endOfMonth(month), payDate };
}

export function payrollFor(state: AppState, month: string): PayrollMonth | undefined {
  return state.payrolls.find((p) => p.month === month);
}

/** 확정되지 않았으면 지금 데이터로 계산, 확정됐으면 스냅샷을 그대로 돌려준다 */
export function payrollLines(state: AppState, month: string): { lines: PayrollLine[]; confirmed: boolean; payroll: PayrollMonth | undefined } {
  const p = payrollFor(state, month);
  if (p?.status === 'confirmed' && p.confirmedLines) return { lines: p.confirmedLines, confirmed: true, payroll: p };
  return { lines: draftLines(state, month), confirmed: false, payroll: p };
}

export function draftLines(state: AppState, month: string): PayrollLine[] {
  const wp = state.workplace;
  if (!wp) return [];
  const { from, to, payDate } = payrollPeriodFor(wp, month);
  const p = payrollFor(state, month);
  const scale = p?.scaleConfirmed ?? wp.scale;
  return state.employees
    .filter((e) => e.hireDate <= to && (!e.resignDate || e.resignDate >= from))
    .map((e) => computePayrollLine({ state, employee: e, from, to, payDate, scale, manual: p?.manual.find((m) => m.employeeId === e.id) ?? null }));
}

export function pendingAttendanceIn(state: AppState, month: string) {
  const wp = state.workplace;
  if (!wp) return [];
  const { from, to } = payrollPeriodFor(wp, month);
  return state.attendance.filter((a) => a.date >= from && a.date <= to && a.status !== 'confirmed');
}
