import { describe, expect, it } from 'vitest';
import { classifyClock, dayPlan, workedSegment, netMinutes, conditionHistory } from '../src/domain/work';
import { diagnose, diagnosisSteps, EMPTY_DIAG } from '../src/domain/diagnosis';
import { computePayrollLine } from '../src/domain/wage';
import { addEmployee, makeState, SCHED_18H } from './helpers';
import type { AttendanceRecord } from '../src/domain/types';

const rec = (p: Partial<AttendanceRecord>): AttendanceRecord => ({
  id: 'r', recordNo: 'R-1', employeeId: 'a', date: '2026-11-05', original: { clockIn: '10:00', clockOut: '15:00' }, source: 'gps-demo', gps: 'inside',
  status: 'confirmed', approval: null, reason: '', createdAt: '', confirmedAt: '', ...p,
});

describe('출퇴근 기록 → 확정 근무', () => {
  it('허용 오차(5분) 안의 지각·조기 퇴근은 예정 시간으로, 그 밖은 일하지 않은 시간만 뺀다', () => {
    const s = makeState();
    const e = addEmployee(s, { id: 'a', hireDate: '2026-11-01' }, { hourlyWage: 10320, schedule: SCHED_18H });
    s.attendance = [rec({ original: { clockIn: '10:03', clockOut: '14:58' } })];
    expect(netMinutes(workedSegment(s, e, '2026-11-05').seg!)).toBe(270);
    s.attendance = [rec({ original: { clockIn: '10:20', clockOut: '15:00' } })];
    expect(netMinutes(workedSegment(s, e, '2026-11-05').seg!)).toBe(250);
  });
  it('일찍 출근은 승인 전에는 더하지 않고, "기록 시간대로" 승인하면 더한다', () => {
    const s = makeState();
    const e = addEmployee(s, { id: 'a', hireDate: '2026-11-01' }, { hourlyWage: 10320, schedule: SCHED_18H });
    s.attendance = [rec({ original: { clockIn: '09:40', clockOut: '15:00' }, status: 'pending' })];
    const w1 = workedSegment(s, e, '2026-11-05');
    expect(w1.pending).toBe(true);
    expect(netMinutes(w1.seg!)).toBe(270);
    s.attendance = [rec({ original: { clockIn: '09:40', clockOut: '15:00' }, status: 'confirmed', approval: 'actual' })];
    expect(netMinutes(workedSegment(s, e, '2026-11-05').seg!)).toBe(290);
  });
  it('수정 이력이 있으면 마지막 수정값을 쓰고 원래 기록은 그대로 둔다', () => {
    const s = makeState();
    const e = addEmployee(s, { id: 'a', hireDate: '2026-11-01' }, { hourlyWage: 10320, schedule: SCHED_18H });
    s.attendance = [rec({ original: { clockIn: '10:30', clockOut: '15:00' } })];
    s.attendanceEdits = [{ id: 'e1', recordId: 'r', before: { clockIn: '10:30', clockOut: '15:00' }, after: { clockIn: '10:00', clockOut: '15:00' }, reason: 'CCTV 확인', by: 'owner', at: '2026-11-05T12:00:00Z', employeeResponse: null }];
    expect(netMinutes(workedSegment(s, e, '2026-11-05').seg!)).toBe(270);
    expect(s.attendance[0].original.clockIn).toBe('10:30');
  });
  it('확인 대기 분류: 일찍 출근·늦게 퇴근·반경 밖', () => {
    const s = makeState();
    const e = addEmployee(s, { id: 'a', hireDate: '2026-11-01' }, { hourlyWage: 10320, schedule: SCHED_18H });
    const p = dayPlan(s, e, '2026-11-05');
    expect(classifyClock(p, '09:40', '15:00', 5, 'inside').status).toBe('pending');
    expect(classifyClock(p, '10:00', '15:40', 5, 'inside').status).toBe('pending');
    expect(classifyClock(p, '10:00', '15:00', 5, 'outside').status).toBe('exception');
    expect(classifyClock(p, '10:12', '15:00', 5, 'inside')).toEqual({ status: 'confirmed', reason: '지각(일하지 않은 시간만 빼고 계산)' });
  });
  it('대타로 바뀐 주는 근무일 변경으로 처리하되 "확인 필요"(C3)', () => {
    const s = makeState();
    const e = addEmployee(s, { id: 'a', hireDate: '2026-10-01' }, { hourlyWage: 10320, schedule: SCHED_18H });
    s.overrides.push({ id: 'so', employeeId: 'a', date: '2026-10-13', kind: 'subOut', start: null, end: null, breakMin: 0, memo: '', substitutionId: 's1', createdAt: '' });
    const line = computePayrollLine({ state: s, employee: e, from: '2026-10-01', to: '2026-10-31', payDate: '2026-11-10', scale: '1-4' });
    const row = line.weeklyHolidayDetail.find((r) => r.weekEnd === '2026-10-18')!;
    expect(row.eligible).toBe(true);
    expect(row.flags.join()).toContain('C3');
  });
  it('같은 적용일에 다시 저장하면 마지막 근로조건이 유효', () => {
    const s = makeState();
    addEmployee(s, { id: 'a', hireDate: '2026-10-01' }, { hourlyWage: 10320, schedule: SCHED_18H });
    s.conditions.push({ ...s.conditions[0], id: 'c2', effectiveFrom: '2026-11-01', hourlyWage: 10500, createdAt: '2026-10-20T00:00:00Z' });
    s.conditions.push({ ...s.conditions[0], id: 'c3', effectiveFrom: '2026-11-01', hourlyWage: 10600, createdAt: '2026-10-21T00:00:00Z' });
    const h = conditionHistory(s.conditions, 'a');
    expect(h).toHaveLength(2);
    expect(h[1].hourlyWage).toBe(10600);
    expect(h[0].effectiveTo).toBe('2026-10-31');
  });
});

describe('비회원 자가진단', () => {
  it('직원이 없으면 4~6번을 건너뛰고 채용 준비 항목을 보여준다', () => {
    expect(diagnosisSteps({ ...EMPTY_DIAG, staff: '0' })).toEqual(['industry', 'staff', 'kinds', 'concern']);
    const r = diagnose({ ...EMPTY_DIAG, industry: 'retail', staff: '0', kinds: ['none'], concern: 'none' });
    expect(r.items.every((i) => i.level !== 'risk')).toBe(true);
    expect(r.items[0].title).toContain('채용 준비');
    expect(r.showGuestConsult).toBe(false);
  });
  it('계약서 일부·주휴 안 줌·보험 아직·퇴사 고민은 위험, 비회원 상담 링크가 열린다', () => {
    const r = diagnose({ industry: 'food', staff: '1-4', kinds: ['alba'], contract: 'some', weeklyHoliday: 'no', insurance: 'notYet', concern: 'dismiss' });
    expect(r.items.filter((i) => i.level === 'risk')).toHaveLength(4);
    expect(r.items[0].level).toBe('risk');
    expect(r.showGuestConsult).toBe(true);
    expect(r.topic).toBe('퇴사·내보내기');
  });
});
