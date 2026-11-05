// 근무: 근로조건 이력 → 예정 일정 → (변경·대타·연차) → 출퇴근 기록 → 확정 근무.
// 원칙(13_근무): 일정이 기준, 사장님이 확정한 실제 근무만 급여로 넘어간다.
import { addDays, diffDays, listDates, nightOverlapMinutes, spanMinutes, startOfWeek, toMin, weekday } from './dates';
import { holidayOn } from '../data/holidays';
import type {
  AppState,
  AttendanceEdit,
  AttendanceRecord,
  DaySchedule,
  Employee,
  HHMM,
  ISODate,
  ScaleBand,
  ShiftOverride,
  WorkCondition,
} from './types';

export const isUnder5 = (scale: ScaleBand | null | undefined) => scale === '1-4';

/** 기준일에 적용되는 근로조건 (적용 시작일 기준 이력) */
export function conditionAt(conditions: WorkCondition[], employeeId: string, date: ISODate): WorkCondition | null {
  let hit: WorkCondition | null = null;
  for (const c of conditions) {
    if (c.employeeId !== employeeId || c.effectiveFrom > date) continue;
    if (!hit || c.effectiveFrom > hit.effectiveFrom || (c.effectiveFrom === hit.effectiveFrom && c.createdAt > hit.createdAt)) hit = c;
  }
  return hit;
}

export function conditionHistory(conditions: WorkCondition[], employeeId: string): (WorkCondition & { effectiveTo: ISODate | null })[] {
  const list = conditions.filter((c) => c.employeeId === employeeId).sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : a.effectiveFrom > b.effectiveFrom ? 1 : a.createdAt < b.createdAt ? -1 : 1));
  // 같은 적용일에 여러 번 저장했으면 마지막 것이 유효
  const dedup: WorkCondition[] = [];
  for (const c of list) {
    if (dedup.length && dedup[dedup.length - 1].effectiveFrom === c.effectiveFrom) dedup[dedup.length - 1] = c;
    else dedup.push(c);
  }
  return dedup.map((c, i) => ({ ...c, effectiveTo: i < dedup.length - 1 ? addDays(dedup[i + 1].effectiveFrom, -1) : null }));
}

export function netMinutes(s: DaySchedule | { start: HHMM; end: HHMM; breakMin: number }): number {
  const { s: a, e } = spanMinutes(s.start, s.end);
  return Math.max(0, e - a - (s.breakMin || 0));
}

/** 근로조건의 주 소정근로시간 */
export function weeklyHours(c: WorkCondition | null): number {
  if (!c) return 0;
  if (c.variable) return c.variableWeeklyHours ?? 0;
  return c.schedule.reduce((sum, d) => sum + (d ? netMinutes(d) : 0), 0) / 60;
}

export function workDaysPerWeek(c: WorkCondition | null): number {
  if (!c || c.variable) return 0;
  return c.schedule.filter(Boolean).length;
}

/** 1일 소정근로시간 (통상임금 1일분 계산용). 매주 달라요는 주 시간 ÷ 5로 추정. */
export function dailyScheduledHours(c: WorkCondition | null): number {
  if (!c) return 0;
  const days = workDaysPerWeek(c);
  if (!days) return weeklyHours(c) / 5;
  return weeklyHours(c) / days;
}

/** 휴게 법정 최소(분) — 4시간 이상 30분, 8시간 이상 60분 */
export function requiredBreak(workMinutesGross: number, rule: { per4h: number; per8h: number }): number {
  if (workMinutesGross >= 480) return rule.per8h;
  if (workMinutesGross >= 240) return rule.per4h;
  return 0;
}

export function isEmployed(e: Employee, date: ISODate): boolean {
  return date >= e.hireDate && (!e.resignDate || date <= e.resignDate);
}

export interface PlannedShift {
  employeeId: string;
  date: ISODate;
  start: HHMM;
  end: HHMM;
  breakMin: number;
  kind: 'regular' | 'change' | 'extra' | 'subIn';
  overrideId: string | null;
}

export interface DayPlan {
  date: ISODate;
  employeeId: string;
  /** 근로조건상 예정(소정) 근무 — 변경 전 */
  contract: DaySchedule | null;
  shift: PlannedShift | null; // 실제로 예정된 근무
  off: null | 'absent' | 'leave' | 'subOut' | 'publicHoliday';
  overrides: ShiftOverride[];
  isWeeklyHoliday: boolean;
  publicHoliday: string | null;
  variableNeedsInput: boolean;
}

/**
 * 하루의 예정 근무.
 * 5명 이상 사업장은 관공서 공휴일을 유급휴일로 보아 기본 일정을 비운다(사장님이 '변경/추가'로 근무를 넣으면 휴일근로).
 */
export function dayPlan(state: Pick<AppState, 'conditions' | 'overrides' | 'workplace'>, e: Employee, date: ISODate): DayPlan {
  const ovs = state.overrides.filter((o) => o.employeeId === e.id && o.date === date);
  const cond = conditionAt(state.conditions, e.id, date);
  const wd = weekday(date);
  const ph = holidayOn(date);
  const scale = state.workplace?.scale ?? '1-4';
  const base: DayPlan = {
    date,
    employeeId: e.id,
    contract: null,
    shift: null,
    off: null,
    overrides: ovs,
    isWeeklyHoliday: cond ? cond.weeklyHolidayDay === wd : wd === 6,
    publicHoliday: ph ? ph.name : null,
    variableNeedsInput: false,
  };
  if (!isEmployed(e, date) || !cond) return base;
  const contract = cond.variable ? null : cond.schedule[wd] ?? null;
  base.contract = contract;

  const change = ovs.find((o) => o.kind === 'change');
  const extra = ovs.find((o) => o.kind === 'extra');
  const subIn = ovs.find((o) => o.kind === 'subIn');
  const offOv = ovs.find((o) => o.kind === 'absent' || o.kind === 'leave' || o.kind === 'subOut');

  if (offOv) {
    base.off = offOv.kind as DayPlan['off'];
    return base;
  }
  const pick = change ?? subIn ?? extra;
  if (pick && pick.start && pick.end) {
    base.shift = {
      employeeId: e.id,
      date,
      start: pick.start,
      end: pick.end,
      breakMin: pick.breakMin,
      kind: pick.kind === 'subIn' ? 'subIn' : pick.kind === 'extra' ? 'extra' : 'change',
      overrideId: pick.id,
    };
    return base;
  }
  if (cond.variable) {
    base.variableNeedsInput = true;
    return base;
  }
  if (contract) {
    if (ph && !isUnder5(scale)) {
      base.off = 'publicHoliday';
      return base;
    }
    base.shift = { employeeId: e.id, date, ...contract, kind: 'regular', overrideId: null };
  }
  return base;
}

// ---- 출퇴근 기록 ----

export function currentTimes(rec: AttendanceRecord, edits: AttendanceEdit[]): { clockIn: HHMM | null; clockOut: HHMM | null } {
  const mine = edits.filter((x) => x.recordId === rec.id).sort((a, b) => (a.at < b.at ? -1 : 1));
  return mine.length ? mine[mine.length - 1].after : rec.original;
}

export interface WorkedSegment {
  date: ISODate;
  start: HHMM;
  end: HHMM;
  breakMin: number;
  source: 'schedule' | 'attendance' | 'pendingAsSchedule';
  recordNo: string | null;
}

/**
 * 급여에 쓰는 확정 근무.
 * - 확정된 출퇴근 기록이 있으면 그 시간. 예정보다 일찍/늦게 찍힌 시간은 사장님이 'actual'로 승인한 경우만 인정.
 * - 확인 대기·예외 기록은 예정 시간으로 계산하고 pending으로 표시.
 * - 기록이 없으면 예정 일정 = 실제 근무(GPS를 끈 사업장의 기본 동작).
 */
export function workedSegment(state: AppState, e: Employee, date: ISODate): { seg: WorkedSegment | null; pending: boolean; plan: DayPlan } {
  const plan = dayPlan(state, e, date);
  const rec = state.attendance.find((r) => r.employeeId === e.id && r.date === date);
  if (rec) {
    const t = currentTimes(rec, state.attendanceEdits);
    if (rec.status === 'confirmed' && t.clockIn && t.clockOut) {
      let start = t.clockIn;
      let end = t.clockOut;
      const breakMin = plan.shift?.breakMin ?? 0;
      if (plan.shift && rec.approval !== 'actual') {
        // 승인 전에는 일찍 출근/늦게 퇴근한 시간을 더하지 않는다. 지각·조퇴는 일하지 않은 시간만 뺀다.
        // 사장님이 정한 지각 허용 오차(기본 5분) 안이면 예정 시간으로 본다.
        const tol = state.workplace?.lateToleranceMin ?? 5;
        const ps = toMin(plan.shift.start);
        const pe = spanMinutes(plan.shift.start, plan.shift.end).e;
        const ci = toMin(start);
        const co = spanMinutes(plan.shift.start, end).e;
        if (ci < ps || ci - ps <= tol) start = plan.shift.start;
        if (co > pe || pe - co <= tol) end = plan.shift.end;
      }
      return { seg: { date, start, end, breakMin, source: 'attendance', recordNo: rec.recordNo }, pending: false, plan };
    }
    if (plan.shift) {
      return {
        seg: { date, start: plan.shift.start, end: plan.shift.end, breakMin: plan.shift.breakMin, source: 'pendingAsSchedule', recordNo: rec.recordNo },
        pending: true,
        plan,
      };
    }
    return { seg: null, pending: true, plan };
  }
  if (plan.shift) {
    return { seg: { date, start: plan.shift.start, end: plan.shift.end, breakMin: plan.shift.breakMin, source: 'schedule', recordNo: null }, pending: false, plan };
  }
  return { seg: null, pending: false, plan };
}

/** 예정보다 일찍 출근/늦게 퇴근, 퇴근 누락, 반경 밖 → 확인 대기로 분류 */
export function classifyClock(
  plan: DayPlan,
  clockIn: HHMM | null,
  clockOut: HHMM | null,
  toleranceMin: number,
  gps: AttendanceRecord['gps'],
): { status: AttendanceRecord['status']; reason: string } {
  if (gps === 'outside' || gps === 'denied') return { status: 'exception', reason: gps === 'outside' ? '반경 밖 기록' : '위치 확인 거부 — 수동 기록' };
  if (!clockIn) return { status: 'exception', reason: '출근 기록 없음' };
  if (!clockOut) return { status: 'pending', reason: '퇴근 기록 전' };
  if (!plan.shift) return { status: 'pending', reason: '예정에 없는 근무' };
  const ps = toMin(plan.shift.start);
  const pe = spanMinutes(plan.shift.start, plan.shift.end).e;
  const ci = toMin(clockIn);
  const co = spanMinutes(plan.shift.start, clockOut).e;
  if (ci < ps - toleranceMin) return { status: 'pending', reason: '예정보다 일찍 출근' };
  if (co > pe + toleranceMin) return { status: 'pending', reason: '예정보다 늦게 퇴근' };
  const notes: string[] = [];
  if (ci > ps + toleranceMin) notes.push('지각(일하지 않은 시간만 빼고 계산)');
  if (co < pe - toleranceMin) notes.push('조퇴(일하지 않은 시간만 빼고 계산)');
  return { status: 'confirmed', reason: notes.join(', ') };
}

export function weekDates(anyDate: ISODate): ISODate[] {
  const s = startOfWeek(anyDate);
  return listDates(s, addDays(s, 6));
}

export interface ScheduleWarning {
  level: 'risk' | 'check' | 'info';
  text: string;
  basis: string[];
}

/** 주간 일정 경고 (13_근무 1장) */
export function weekWarnings(
  state: AppState,
  e: Employee,
  weekStart: ISODate,
  breakRule: { per4h: number; per8h: number; waiver4hOnRequest: boolean } | null,
  minorRule: { daily: number; weekly: number } | null,
): ScheduleWarning[] {
  const out: ScheduleWarning[] = [];
  const scale = state.workplace?.scale ?? '1-4';
  const dates = listDates(weekStart, addDays(weekStart, 6));
  let total = 0;
  let night = 0;
  let holidayWork = false;
  const cond = conditionAt(state.conditions, e.id, dates[6]);
  for (const d of dates) {
    const p = dayPlan(state, e, d);
    if (p.variableNeedsInput && !p.shift) continue;
    if (!p.shift) continue;
    const gross = spanMinutes(p.shift.start, p.shift.end);
    const grossMin = gross.e - gross.s;
    const net = netMinutes(p.shift);
    total += net;
    night += nightOverlapMinutes(p.shift.start, p.shift.end);
    if (p.isWeeklyHoliday || p.publicHoliday) holidayWork = true;
    if (breakRule) {
      const need = requiredBreak(net + p.shift.breakMin, breakRule);
      if (p.shift.breakMin < need) {
        const waiver = breakRule.waiver4hOnRequest && grossMin === 240 && cond?.breakWaiverRequested;
        if (waiver) out.push({ level: 'info', text: `${d} 4시간 근무 · 휴게 생략 요청 기록 있음`, basis: ['break.minimum'] });
        else out.push({ level: 'risk', text: `${d.slice(5)} 휴게 부족: ${Math.round((net + p.shift.breakMin) / 6) / 10}시간 근무에 휴게 ${p.shift.breakMin}분 (최소 ${need}분)`, basis: ['break.minimum'] });
      }
    }
    if (e.ageBand === 'under18' && minorRule && net / 60 > minorRule.daily) {
      out.push({ level: 'risk', text: `${d.slice(5)} 18세 미만 1일 ${minorRule.daily}시간 초과`, basis: ['minor.limits'] });
    }
  }
  const hours = total / 60;
  const contractHours = weeklyHours(cond);
  if ((contractHours >= 15) !== (hours >= 15) && cond && !cond.variable) {
    out.push({ level: 'check', text: `이번 주 ${hours.toFixed(1)}시간 — 주 15시간 경계를 ${hours >= 15 ? '넘어요' : '내려가요'}. 주휴수당·보험 판정이 바뀔 수 있어요`, basis: ['weeklyHoliday.minWeeklyHours'] });
  }
  if (e.isForeign && e.foreign && (e.foreign.visa === 'D-2' || e.foreign.visa === 'D-4')) {
    const permit = e.foreign.permitHours;
    if (permit == null) out.push({ level: 'check', text: '유학생 허가시간이 입력되지 않았어요 (허가 시간 기준은 원문 미확인)', basis: [] });
    else if (hours + (e.foreign.otherWorkplaceHours || 0) > permit) out.push({ level: 'risk', text: `허가시간 초과: 이번 주 ${hours.toFixed(1)}h + 다른 사업장 ${e.foreign.otherWorkplaceHours}h > 허가 ${permit}h`, basis: [] });
  }
  if (!isUnder5(scale)) {
    if (hours > 40) out.push({ level: 'check', text: `주 40시간 초과 ${(hours - 40).toFixed(1)}시간 — 연장 가산 발생`, basis: ['premium.overtime', 'workHours.limits'] });
    if (hours > 52) out.push({ level: 'risk', text: `주 52시간 초과 — 연장 한도(주 12시간) 초과`, basis: ['workHours.limits'] });
  } else if (hours > 52) {
    out.push({ level: 'info', text: '주 52시간 초과 — 1~4명은 법정 한도 미적용, 권장 확인', basis: ['workHours.limits', 'scope.under5.appliedArticles'] });
  }
  if (e.ageBand === 'under18' && minorRule) {
    if (hours > minorRule.weekly) out.push({ level: 'risk', text: `18세 미만 주 ${minorRule.weekly}시간 초과`, basis: ['minor.limits'] });
    if (night > 0 || holidayWork) out.push({ level: 'risk', text: '18세 미만 야간(22~06시)·휴일 근무 — 본인 동의와 고용노동부장관 인가 필요', basis: ['minor.limits'] });
  }
  return out;
}

/** 4주 중 3주 이상 계약 시간과 다르면 변경 계약서 제안 */
export function contractDriftWeeks(state: AppState, e: Employee, baseDate: ISODate): number {
  let diffWeeks = 0;
  for (let w = 1; w <= 4; w++) {
    const ws = addDays(startOfWeek(baseDate), -7 * w);
    const cond = conditionAt(state.conditions, e.id, addDays(ws, 6));
    if (!cond || cond.variable) continue;
    let actual = 0;
    for (const d of listDates(ws, addDays(ws, 6))) {
      const p = dayPlan(state, e, d);
      if (p.shift) actual += netMinutes(p.shift);
    }
    if (Math.abs(actual / 60 - weeklyHours(cond)) >= 1) diffWeeks++;
  }
  return diffWeeks;
}

export function nextRecordNo(state: AppState, date: ISODate): string {
  return `R-${date.replace(/-/g, '')}-${String(state.seq + 1).padStart(4, '0')}`;
}

export function scheduledDaysCount(state: AppState, e: Employee, from: ISODate, to: ISODate): number {
  return listDates(from, to).filter((d) => !!dayPlan(state, e, d).contract).length;
}

export function serviceDays(e: Employee, until: ISODate): number {
  return diffDays(e.hireDate, until) + 1;
}
