// 서버 모드 동기화: 화면의 상태 변경이 올바른 서버 요청(표 쓰기·API·RPC)으로 바뀌는지, 서버가 받지 않는 변경은 알리는지
import { describe, expect, it } from 'vitest';
import { createSeed } from '../src/data/seed';
import { draftLines } from '../src/domain/payroll';
import { planEmployee, planFirm, planOwner, type Op, type SyncCtx } from '../src/adapters/sync';
import type { AppState } from '../src/domain/types';

const BASE = '2026-11-05';
let n = 0;
const ctx = (over: Partial<SyncCtx> = {}): SyncCtx => ({ userId: 'user-1', workplaceId: 'wp-1', payrollIdByMonth: {}, firmId: 'firm-1', newId: () => `new-${++n}`, ...over });
const clone = (s: AppState) => structuredClone(s);
const tables = (ops: Op[]) => ops.map((o) => (o.t === 'rpc' ? `rpc:${o.name}` : o.t === 'api' ? `api:${o.path}` : `${o.t}:${o.table}`));

describe('사장님 변경 → 서버 요청', () => {
  const seed = createSeed(BASE);
  for (const p of seed.payrolls) seed.payrolls.find((x) => x.month === p.month);
  const ids = Object.fromEntries(seed.payrolls.map((p) => [p.month, `pay-${p.month}`]));

  it('바뀐 것이 없으면 요청이 없다', () => {
    expect(planOwner(seed, clone(seed), ctx({ payrollIdByMonth: ids })).ops).toEqual([]);
  });

  it('새 사업장은 사업장 행부터 만들고 이후 행에 그 id를 쓴다', () => {
    const empty = { ...clone(seed), workplace: null, employees: [], conditions: [], overrides: [], attendance: [], attendanceEdits: [], substitutions: [], leaveRequests: [], payrolls: [], payrollEdits: [], statements: [], insuranceReports: [], insuranceNotices: [], docRecords: [], docRequests: [], deadlineActions: [], riskAnswers: [], offboarding: [], consults: [], notifications: [], busyDays: [] };
    const next = clone(empty);
    next.workplace = seed.workplace;
    next.busyDays.push({ id: 'b1', date: BASE, memo: '축제' });
    const c = ctx({ workplaceId: null });
    const plan = planOwner(empty, next, c);
    expect(tables(plan.ops)).toEqual(['insert:workplaces', 'insert:busy_days']);
    const wp = plan.ops[0] as Extract<Op, { t: 'insert' }>;
    expect(wp.rows[0]).toMatchObject({ id: c.workplaceId, owner_id: 'user-1', name: seed.workplace!.name, pay_day: seed.workplace!.payDay });
  });

  it('직원·근로조건 추가는 부모 → 자식 순서로 넣는다', () => {
    const next = clone(seed);
    next.employees.push({ ...seed.employees[0], id: 'emp-new', alias: '직원 D', conditionAcks: [], account: 'invited' });
    next.conditions.push({ ...seed.conditions[0], id: 'cond-new', employeeId: 'emp-new' });
    const plan = planOwner(seed, next, ctx({ payrollIdByMonth: ids }));
    expect(tables(plan.ops)).toEqual(['insert:employees', 'insert:work_conditions']);
    const emp = (plan.ops[0] as Extract<Op, { t: 'insert' }>).rows[0];
    expect(emp).toMatchObject({ id: 'emp-new', alias: '직원 D', account_status: 'none' }); // 계정 상태는 서버만 바꾼다
  });

  it('근로조건 이력 수정·출퇴근 원본 수정은 보내지 않고 알린다', () => {
    const next = clone(seed);
    next.conditions[0].hourlyWage = 9000;
    const rec = next.attendance.find((a) => a.original.clockIn)!;
    rec.original.clockIn = '06:00';
    const plan = planOwner(seed, next, ctx({ payrollIdByMonth: ids }));
    expect(plan.ops).toEqual([]);
    expect(plan.notes.join()).toContain('근로조건 이력은 고칠 수 없어요');
  });

  it('출퇴근 확정은 상태 열만, 수정 이력은 본인 by_user로', () => {
    const next = clone(seed);
    const rec = next.attendance.find((a) => a.status !== 'confirmed')!;
    rec.status = 'confirmed';
    rec.approval = 'actual';
    next.attendanceEdits.push({ id: 'ed-1', recordId: rec.id, before: rec.original, after: { clockIn: '10:00', clockOut: '15:00' }, reason: '시험', by: 'owner', at: '2026-11-05T01:00:00Z', employeeResponse: null });
    const plan = planOwner(seed, next, ctx({ payrollIdByMonth: ids }));
    const upd = plan.ops.find((o) => o.t === 'update' && o.table === 'attendance_records') as Extract<Op, { t: 'update' }>;
    expect(upd.values).toEqual({ status: 'confirmed', approval: 'actual' });
    const ins = plan.ops.find((o) => o.t === 'insert' && o.table === 'attendance_edits') as Extract<Op, { t: 'insert' }>;
    expect(ins.rows[0]).toMatchObject({ id: 'ed-1', record_id: rec.id, by_user: 'user-1', after_in: '10:00' });
  });

  it('사장님 직접 출퇴근 기록은 API로 (기록 번호는 서버가 발급)', () => {
    const next = clone(seed);
    next.attendance.push({ id: 'att-x', recordNo: 'R-LOCAL', employeeId: 'emp-b', date: '2026-11-01', original: { clockIn: '09:00', clockOut: '13:00' }, source: 'owner', gps: null, status: 'confirmed', approval: 'actual', reason: '기기 고장', createdAt: '', confirmedAt: '' });
    const plan = planOwner(seed, next, ctx({ payrollIdByMonth: ids }));
    expect(plan.ops).toEqual([{ t: 'api', path: 'owner/attendance/manual', body: { employeeId: 'emp-b', date: '2026-11-01', clockIn: '09:00', clockOut: '13:00', reason: '기기 고장' } }]);
  });

  it('직원 삭제는 RPC 하나로 (딸린 행을 따로 지우지 않음)', () => {
    const next = clone(seed);
    const id = 'emp-c';
    next.employees = next.employees.filter((e) => e.id !== id);
    next.conditions = next.conditions.filter((c) => c.employeeId !== id);
    next.overrides = next.overrides.filter((o) => o.employeeId !== id);
    next.docRecords = next.docRecords.filter((d) => d.employeeId !== id);
    const plan = planOwner(seed, next, ctx({ payrollIdByMonth: ids }));
    expect(tables(plan.ops)).toEqual(['rpc:delete_employee_if_unpaid']);
    expect(plan.notes).toEqual([]);
  });

  it('급여: 새 초안월 → 직접 입력 → 확정 API 순서', () => {
    const month = '2026-11';
    const next = clone(seed);
    next.payrolls.push({ id: month, month, status: 'confirmed', scaleConfirmed: '1-4', manual: [{ employeeId: 'emp-a', incomeTax: 1000, localTax: 100, adjustments: [] }], confirmedAt: '', confirmedLines: draftLines(seed, month), confirmedWithPending: [], revision: 1 });
    const c = ctx({ payrollIdByMonth: ids });
    const plan = planOwner(seed, next, c);
    expect(tables(plan.ops)).toEqual(['insert:payroll_months', 'insert:payroll_manual', 'api:owner/payroll/confirm']);
    expect((plan.ops[1] as Extract<Op, { t: 'insert' }>).rows[0]).toMatchObject({ payroll_id: c.payrollIdByMonth[month], employee_id: 'emp-a', income_tax: 1000 });
    expect(plan.ops[2]).toEqual({ t: 'api', path: 'owner/payroll/confirm', body: { month, allowPending: true } });
  });

  it('확정 후 수정은 수정 이력에서 금액·사유를 꺼내 API로', () => {
    const p = seed.payrolls.find((x) => x.status === 'confirmed')!;
    const next = clone(seed);
    const np = next.payrolls.find((x) => x.month === p.month)!;
    const line = np.confirmedLines![0];
    line.items.push({ code: 'adjust', label: '교통비', amount: 15000, formula: '', basis: [] });
    np.revision += 1;
    next.payrollEdits.push({ id: 'pe-1', payrollId: p.id, employeeId: line.employeeId, field: '조정 항목 추가', before: '—', after: '교통비 15,000원', reason: '누락분', at: '' });
    next.statements.push({ id: 'st-x', payrollId: p.id, employeeId: line.employeeId, revision: np.revision, method: 'print', deliveredAt: '', viewedAt: null, disputed: null });
    next.notifications.unshift({ id: 'n-x', to: line.employeeId, kind: 'statement', text: '수정', link: '/employee/pay', createdAt: '', readAt: null, channels: { inApp: 'delivered', kakao: 'not-connected' } });
    const plan = planOwner(seed, next, ctx({ payrollIdByMonth: ids }));
    expect(plan.ops).toEqual([{ t: 'api', path: 'owner/payroll/edit', body: { month: p.month, employeeId: line.employeeId, kind: 'adjust', label: '교통비', amount: 15000, reason: '누락분' } }]);
  });

  it('일정 변경: 지우기 먼저, 새 일정·알림은 그다음', () => {
    const next = clone(seed);
    const o = next.overrides[0];
    next.overrides = next.overrides.filter((x) => x.id !== o.id);
    next.overrides.push({ ...o, id: 'ov-new', kind: 'absent', start: null, end: null });
    next.notifications.unshift({ id: 'n-new', to: o.employeeId, kind: 'schedule', text: '일정이 바뀌었어요', link: '/employee/schedule', createdAt: '', readAt: null, channels: { inApp: 'delivered', kakao: 'not-connected' } });
    const plan = planOwner(seed, next, ctx({ payrollIdByMonth: ids }));
    expect(tables(plan.ops)).toEqual(['delete:shift_overrides', 'insert:shift_overrides', 'insert:notifications']);
    expect((plan.ops[2] as Extract<Op, { t: 'insert' }>).rows[0]).toMatchObject({ recipient: 'employee', employee_id: o.employeeId, kind: 'schedule' });
  });

  it('상담 보내기는 API, 철회는 RPC', () => {
    const next = clone(seed);
    next.consults.unshift({ id: 'cs-1', topic: '근로시간', question: '질문', memo: '', shareItems: ['memo'], employeeIds: [], snapshot: null, consentAt: '', revokedAt: null, status: 'demo-delivered', createdAt: '' });
    let plan = planOwner(seed, next, ctx({ payrollIdByMonth: ids }));
    expect(plan.ops).toEqual([{ t: 'api', path: 'owner/consult', body: { topic: '근로시간', question: '질문', shareItems: ['memo'], employeeIds: [], consent: true } }]);
    const after = clone(next);
    after.consults[0].revokedAt = 'x';
    plan = planOwner(next, after, ctx({ payrollIdByMonth: ids }));
    expect(plan.ops).toEqual([{ t: 'rpc', name: 'revoke_consult', args: { p_id: 'cs-1' } }]);
  });

  it('데이터 초기화는 사업장 삭제 RPC 하나', () => {
    const next = clone(seed);
    next.workplace = null;
    expect(planOwner(seed, next, ctx()).ops).toEqual([{ t: 'rpc', name: 'delete_my_workplace', args: {} }]);
  });
});

describe('직원 변경 → 본인 권한 RPC', () => {
  const seed = createSeed(BASE);
  const me = 'emp-a';
  it('출근·명세서 열람·연차 신청·언어', () => {
    const next = clone(seed);
    next.attendance.push({ id: 'att-new', recordNo: 'R', employeeId: me, date: '2026-11-06', original: { clockIn: '09:58', clockOut: null }, source: 'gps-demo', gps: 'inside', status: 'pending', approval: null, reason: '', createdAt: '', confirmedAt: null });
    const st = next.statements.find((s) => s.employeeId === me && !s.viewedAt);
    if (st) st.viewedAt = 'now';
    next.leaveRequests.push({ id: 'lv-1', employeeId: me, date: '2026-11-20', hours: null, status: 'requested', adjustReason: '', requestedAt: '', decidedAt: null, by: 'employee' });
    next.settings.employeeLang[me] = 'en';
    const plan = planEmployee(seed, next, me);
    expect(tables(plan.ops)).toEqual(['rpc:set_my_lang', 'api:employee/clock', ...(st ? ['rpc:mark_statement_viewed'] : []), 'rpc:request_leave']);
    const clock = plan.ops.find((o) => o.t === 'api') as Extract<Op, { t: 'api' }>;
    expect(clock.body).toEqual({ employeeId: me, kind: 'in', gps: 'inside' }); // 기기 시각은 보내지 않는다
  });

  it('근로조건 확인·위치 동의 철회·직원 앱 나가기', () => {
    const next = clone(seed);
    const e = next.employees.find((x) => x.id === me)!;
    e.conditionAcks.push({ conditionId: 'cond-a2', status: 'disputed', memo: '시급이 달라요', at: 'now', resolvedAt: null });
    e.locationConsent = { ...e.locationConsent!, revokedAt: 'now' };
    e.account = 'none';
    const plan = planEmployee(seed, next, me);
    expect(plan.ops).toEqual([
      { t: 'rpc', name: 'ack_conditions', args: { p_condition_id: 'cond-a2', p_status: 'disputed', p_memo: '시급이 달라요' } },
      { t: 'rpc', name: 'set_location_consent', args: { p_employee_id: me, p_consent: false } },
      { t: 'rpc', name: 'leave_employee_app', args: { p_employee_id: me } },
    ]);
  });
});

describe('노무법인 변경 → RPC', () => {
  it('읽음·보험 처리 완료·검수 의견', () => {
    const s = createSeed(BASE);
    s.consults = [{ id: 'c1', topic: 't', question: 'q', memo: '', shareItems: ['memo'], employeeIds: [], snapshot: null, consentAt: '', revokedAt: null, status: 'demo-delivered', createdAt: '' }];
    const next = clone(s);
    next.consults[0].status = 'firm-read';
    next.insuranceReports.push({ employeeId: 'emp-b', phase: 'loss', status: 'firmDone', date: BASE, by: 'firm' });
    next.reviewComments.unshift({ id: 'rc', target: 'R01', comment: '확인 필요', at: '' });
    const plan = planFirm(s, next, ctx());
    expect(tables(plan.ops)).toEqual(['rpc:firm_mark_consult_read', 'rpc:firm_mark_insurance_done', 'insert:review_comments']);
    expect((plan.ops[2] as Extract<Op, { t: 'insert' }>).rows[0]).toEqual({ firm_id: 'firm-1', author_id: 'user-1', target: 'R01', comment: '확인 필요' });
  });
});
