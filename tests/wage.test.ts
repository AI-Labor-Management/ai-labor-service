import { describe, expect, it } from 'vitest';
import { checkMinimumWage, computePayrollLine, dailyWorkerIncomeTax, monthlyHours, quickWage, weeklyHolidayHours } from '../src/domain/wage';
import { draftLines, payrollLines, payrollPeriodFor } from '../src/domain/payroll';
import { addEmployee, makeState, S, SCHED_18H, SCHED_40H } from './helpers';

const item = (line: ReturnType<typeof computePayrollLine>, code: string) => line.items.find((i) => i.code === code)?.amount ?? 0;

describe('F2 손계산 예제 (08_F2 8장)', () => {
  it('#1·#2 월 209시간 환산 = 고시 월 환산액', () => {
    expect(monthlyHours(40, '2026-06-01')).toBe(209);
    expect(10320 * monthlyHours(40, '2026-06-01')).toBe(2156880);
    expect(10700 * monthlyHours(40, '2027-06-01')).toBe(2236300);
  });
  it('#3·#4·#4-1·#5 주휴 시간', () => {
    expect(weeklyHolidayHours(40, '2026-11-01') * 10320).toBe(82560);
    expect(weeklyHolidayHours(20, '2026-11-01') * 10320).toBe(41280);
    expect(Math.round(weeklyHolidayHours(18, '2026-11-01') * 10320)).toBe(37152);
    expect(Math.round(weeklyHolidayHours(18, '2026-11-01') * 10320) * 4).toBe(148608);
    expect(weeklyHolidayHours(14, '2026-11-01')).toBe(0);
    expect(weeklyHolidayHours(15, '2026-11-01')).toBe(3); // 경계: 15시간이면 적용
  });
  it('#4-2 일용 1일 20만 원 → 소득세 1,350원', () => {
    expect(dailyWorkerIncomeTax(200000, '2026-11-01')).toBe(1350);
    expect(dailyWorkerIncomeTax(150000, '2026-11-01')).toBe(0);
  });
  it('#10 시급 9,000원은 최저임금 미달, #9 연도 전환', () => {
    expect(checkMinimumWage(9000, '2026-06-01').status).toBe('below');
    expect(checkMinimumWage(10320, '2026-12-31').status).toBe('ok');
    expect(checkMinimumWage(10320, '2027-01-01').status).toBe('below');
    expect(checkMinimumWage(10700, '2027-01-01').status).toBe('ok');
  });
});

describe('월 급여 계산', () => {
  it('1~4명, 주 18시간, 2026년 10월 — 기본급·주휴·가산 0', () => {
    const s = makeState('1-4');
    const e = addEmployee(s, { id: 'a', hireDate: '2026-10-01' }, { hourlyWage: 10320, schedule: SCHED_18H });
    const line = computePayrollLine({ state: s, employee: e, from: '2026-10-01', to: '2026-10-31', payDate: '2026-11-10', scale: '1-4' });
    // 10월 월·화·목·금 18일 × 4.5시간 = 81시간 (1~4명은 공휴일도 소정근로일)
    expect(line.hours.worked).toBe(81);
    expect(item(line, 'base')).toBe(81 * 10320);
    // 주휴: 9.28~10.4 주(입사 주, 9시간 → 1.8h) + 3주 × 3.6h. 11.1(일)이 끝인 주는 11월에 귀속
    expect(item(line, 'weeklyHoliday')).toBe(18576 + 37152 * 3);
    expect(item(line, 'premium')).toBe(0);
    expect(line.gross).toBe(835920 + 130032);
  });

  it('5명 이상이면 공휴일(10.5 대체공휴일, 10.9 한글날)이 유급휴일로 빠지고 유급 처리', () => {
    const s = makeState('5-9');
    const e = addEmployee(s, { id: 'a', hireDate: '2026-10-01' }, { hourlyWage: 10320, schedule: SCHED_18H });
    const line = computePayrollLine({ state: s, employee: e, from: '2026-10-01', to: '2026-10-31', payDate: '2026-11-10', scale: '5-9' });
    expect(line.hours.worked).toBe(72);
    expect(item(line, 'publicHoliday')).toBe(9 * 10320);
    expect(item(line, 'weeklyHoliday')).toBe(130032);
  });

  it('#6·#7 야간 2시간: 5명 이상 가산 10,320원, 1~4명 0원(참고값만)', () => {
    for (const scale of ['5-9', '1-4'] as const) {
      const s = makeState(scale);
      // 월요일 16:00~24:00 (휴게 30분 → 7.5시간, 야간 2시간)
      const e = addEmployee(s, { id: 'n', hireDate: '2026-11-02' }, { hourlyWage: 10320, schedule: [S('16:00', '00:00', 30), null, null, null, null, null, null] });
      const line = computePayrollLine({ state: s, employee: e, from: '2026-11-02', to: '2026-11-08', payDate: '2026-12-10', scale });
      if (scale === '5-9') expect(item(line, 'night')).toBe(10320);
      else {
        expect(item(line, 'premium')).toBe(0);
        expect(line.items.find((i) => i.code === 'premium')?.note).toContain('5명 이상이었다면 약 10,320원');
      }
    }
  });

  it('#8 5명 이상 휴일 10시간: 8시간 50% + 2시간 100%', () => {
    const s = makeState('5-9');
    const e = addEmployee(s, { id: 'h', hireDate: '2026-11-02' }, { hourlyWage: 10320, schedule: SCHED_40H });
    s.overrides.push({ id: 'o1', employeeId: e.id, date: '2026-11-08', kind: 'extra', start: '08:00', end: '18:00', breakMin: 0, memo: '', substitutionId: null, createdAt: '' });
    const line = computePayrollLine({ state: s, employee: e, from: '2026-11-02', to: '2026-11-08', payDate: '2026-12-10', scale: '5-9' });
    expect(item(line, 'holiday')).toBe(8 * 10320 * 0.5 + 2 * 10320 * 1);
    expect(line.hours.overtime).toBe(0); // 휴일근로는 연장으로 다시 세지 않음
  });

  it('5명 이상 주 40시간 + 하루 10시간 → 연장 2시간 가산', () => {
    const s = makeState('5-9');
    const sched = SCHED_40H.map((d, i) => (i === 0 ? S('09:00', '20:00', 60) : d));
    const e = addEmployee(s, { id: 'o', hireDate: '2026-11-02' }, { hourlyWage: 10320, schedule: sched });
    const line = computePayrollLine({ state: s, employee: e, from: '2026-11-02', to: '2026-11-08', payDate: '2026-12-10', scale: '5-9' });
    expect(line.hours.overtime).toBe(2);
    expect(item(line, 'overtime')).toBe(2 * 10320 * 0.5);
  });

  it('#11 5명 이상 연차 1일(소정 8시간) 유급 82,560원', () => {
    const s = makeState('5-9');
    const e = addEmployee(s, { id: 'l', hireDate: '2026-01-05' }, { hourlyWage: 10320, schedule: SCHED_40H });
    s.overrides.push({ id: 'lv', employeeId: e.id, date: '2026-11-04', kind: 'leave', start: null, end: null, breakMin: 0, memo: '', substitutionId: null, createdAt: '' });
    const line = computePayrollLine({ state: s, employee: e, from: '2026-11-02', to: '2026-11-08', payDate: '2026-12-10', scale: '5-9' });
    expect(item(line, 'leavePay')).toBe(82560);
    expect(line.hours.worked).toBe(32);
  });

  it('주 14시간이면 주휴 0원, 결근한 주는 주휴 제외', () => {
    const s = makeState('1-4');
    const e14 = addEmployee(s, { id: 'x', hireDate: '2026-10-01' }, { hourlyWage: 10320, schedule: [S('10:00', '17:00', 0), S('10:00', '17:00', 0), null, null, null, null, null] });
    const l14 = computePayrollLine({ state: s, employee: e14, from: '2026-10-01', to: '2026-10-31', payDate: '2026-11-10', scale: '1-4' });
    expect(item(l14, 'weeklyHoliday')).toBe(0);
    const e = addEmployee(s, { id: 'y', hireDate: '2026-09-01' }, { hourlyWage: 10320, schedule: SCHED_18H });
    s.overrides.push({ id: 'ab', employeeId: e.id, date: '2026-10-13', kind: 'absent', start: null, end: null, breakMin: 0, memo: '', substitutionId: null, createdAt: '' });
    const l = computePayrollLine({ state: s, employee: e, from: '2026-10-01', to: '2026-10-31', payDate: '2026-11-10', scale: '1-4' });
    const row = l.weeklyHolidayDetail.find((r) => r.weekEnd === '2026-10-18')!;
    expect(row.eligible).toBe(false);
    expect(row.flags.join()).toContain('결근');
  });

  it('근로조건 변경일 기준으로 시급을 나눠 계산한다', () => {
    const s = makeState('1-4');
    const e = addEmployee(s, { id: 'c', hireDate: '2026-10-01' }, { hourlyWage: 10320, schedule: SCHED_18H });
    s.conditions.push({ ...s.conditions[0], id: 'c-c2', effectiveFrom: '2026-10-15', hourlyWage: 11000, createdAt: '2026-10-10T00:00:00.000Z' });
    const line = computePayrollLine({ state: s, employee: e, from: '2026-10-01', to: '2026-10-31', payDate: '2026-11-10', scale: '1-4' });
    // 10.1~10.14: 8일, 10.15~10.31: 10일
    expect(item(line, 'base')).toBe(8 * 4.5 * 10320 + 10 * 4.5 * 11000);
    expect(line.wageText).toContain('→');
  });

  it('2027년 1월 시급 10,320원이면 최저임금 미달 경고', () => {
    const s = makeState('1-4');
    const e = addEmployee(s, { id: 'm', hireDate: '2026-10-01' }, { hourlyWage: 10320, schedule: SCHED_18H });
    const line = computePayrollLine({ state: s, employee: e, from: '2027-01-01', to: '2027-01-31', payDate: '2027-02-10', scale: '1-4' });
    expect(line.warnings.some((w) => w.level === 'risk' && w.text.includes('최저임금 미달'))).toBe(true);
  });

  it('확정한 급여는 이후 근로조건을 바꿔도 바뀌지 않는다 (스냅샷)', () => {
    const s = makeState('1-4');
    addEmployee(s, { id: 'a', hireDate: '2026-10-01' }, { hourlyWage: 10320, schedule: SCHED_18H });
    const lines = draftLines(s, '2026-10');
    s.payrolls.push({ id: '2026-10', month: '2026-10', status: 'confirmed', scaleConfirmed: '1-4', manual: [], confirmedAt: '2026-11-08T00:00:00Z', confirmedLines: lines, confirmedWithPending: [], revision: 1 });
    const before = payrollLines(s, '2026-10').lines[0].gross;
    // 소급 변경을 넣어도
    s.conditions.push({ ...s.conditions[0], id: 'retro', effectiveFrom: '2026-10-01', hourlyWage: 12000, createdAt: '2026-11-20T00:00:00.000Z' });
    expect(payrollLines(s, '2026-10').lines[0].gross).toBe(before);
    expect(draftLines(s, '2026-10')[0].gross).not.toBe(before);
  });

  it('퇴사하는 주의 주휴는 자동 포함하지 않고 확인 필요(C2)', () => {
    const s = makeState('1-4');
    const e = addEmployee(s, { id: 'r', hireDate: '2026-09-01', resignDate: '2026-10-21' }, { hourlyWage: 10320, schedule: SCHED_18H });
    const line = computePayrollLine({ state: s, employee: e, from: '2026-10-01', to: '2026-10-31', payDate: '2026-11-10', scale: '1-4' });
    const row = line.weeklyHolidayDetail.find((r) => r.weekStart === '2026-10-19')!;
    expect(row.included).toBe(false);
    expect(line.warnings.some((w) => w.text.includes('C2'))).toBe(true);
  });

  it('지급일: 전월분 매달 10일, 말일 보정', () => {
    expect(payrollPeriodFor({ payDay: 10, payMonthBasis: 'previous' }, '2026-10').payDate).toBe('2026-11-10');
    expect(payrollPeriodFor({ payDay: 31, payMonthBasis: 'current' }, '2027-02').payDate).toBe('2027-02-28');
    expect(payrollPeriodFor({ payDay: 10, payMonthBasis: 'previous' }, '2026-12').payDate).toBe('2027-01-10');
  });

  it('빠른 계산(채용 전 점검): 주 18시간 → 주휴 37,152원, 휴게 경고', () => {
    const q = quickWage({ hourlyWage: 10320, schedule: SCHED_18H, scale: '1-4', date: '2026-11-05' });
    expect(q.weeklyHours).toBe(18);
    expect(q.weeklyHolidayPay).toBe(37152);
    expect(q.breakIssues).toHaveLength(0);
    const q2 = quickWage({ hourlyWage: 10320, schedule: [S('10:00', '15:00', 0), null, null, null, null, null, null], scale: '1-4', date: '2026-11-05' });
    expect(q2.breakIssues[0]).toContain('최소 30분');
  });
});
