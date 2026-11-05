import { createEmptyState } from '../src/data/seed';
import type { AppState, DaySchedule, Employee, ScaleBand, WorkCondition } from '../src/domain/types';

export const S = (start: string, end: string, breakMin = 0): DaySchedule => ({ start, end, breakMin });

export function makeState(scale: ScaleBand = '1-4', industry: 'food' | 'retail' | 'service' = 'food'): AppState {
  const s = createEmptyState();
  s.workplace = {
    name: '테스트 가게', industry, scale, familyOnly: false, payDay: 10, payMonthBasis: 'previous', gpsEnabled: false, address: '', radiusM: 100, lateToleranceMin: 5,
    defaultInsuranceMethod: 'self', hourlyLeaveAllowed: false, firmInsuranceShareConsent: false, createdAt: '2026-01-01T00:00:00.000Z',
  };
  return s;
}

export function addEmployee(s: AppState, p: Partial<Employee> & { id: string; hireDate: string }, c: Partial<WorkCondition> & { hourlyWage: number }): Employee {
  const e: Employee = {
    alias: p.id, ageBand: '18-59', birthDate: null, startedBefore65: null, employmentType: 'regular', contractEnd: null, probationEnd: null, foodHandler: true, isForeign: false, foreign: null,
    school: null, insuranceMethod: 'self', registeredAt: p.hireDate, onboarding: 'new', resignDate: null, resignType: null, account: 'none', invite: null, locationConsent: null, conditionAcks: [],
    bonusAnnual: 0, leaveAllowanceAnnual: 0, createdAt: '2026-01-01T00:00:00.000Z', ...p,
  };
  s.employees.push(e);
  s.conditions.push({
    id: `${p.id}-c1`, employeeId: p.id, effectiveFrom: p.hireDate, schedule: [null, null, null, null, null, null, null], variable: false, variableWeeklyHours: null, weeklyHolidayDay: 6, job: '', mealAllowance: 0,
    breakWaiverRequested: false, reason: '', createdAt: '2026-01-01T00:00:00.000Z', ...c,
  });
  return e;
}

/** 월·화·목·금 10~15시, 휴게 30분 = 주 18시간 (시안 직원 A) */
export const SCHED_18H = [S('10:00', '15:00', 30), S('10:00', '15:00', 30), null, S('10:00', '15:00', 30), S('10:00', '15:00', 30), null, null];
/** 월~금 9~18시, 휴게 60분 = 주 40시간 */
export const SCHED_40H = [S('09:00', '18:00', 60), S('09:00', '18:00', 60), S('09:00', '18:00', 60), S('09:00', '18:00', 60), S('09:00', '18:00', 60), null, null];
