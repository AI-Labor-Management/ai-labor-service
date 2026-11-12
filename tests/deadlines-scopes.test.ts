import { describe, expect, it } from 'vitest';
import { computeDeadlines, handleDeadline, alertDates } from '../src/domain/deadlines';
import { buildIcs } from '../src/domain/ics';
import { computeChecklist } from '../src/domain/checklist';
import { computeTodos } from '../src/domain/todos';
import { employeeScope, firmScope, adminScope } from '../src/domain/scopes';
import { createSeed } from '../src/data/seed';
import { migrate } from '../src/adapters/storage';
import { evaluateRisk } from '../src/domain/risk';
import { detectPII, searchFaq } from '../src/domain/consult';
import { addEmployee, makeState, SCHED_18H } from './helpers';

const BASE = '2026-11-05';

describe('F4 기한 — 원래 날짜에서 계산', () => {
  it('4대보험 입사 신고: 한 줄에 두 날짜, 앞 날짜로 D-day', () => {
    const s = makeState();
    addEmployee(s, { id: 'a', hireDate: '2026-11-03' }, { hourlyWage: 10320, schedule: SCHED_18H });
    const d = computeDeadlines(s, BASE).find((x) => x.type === 'insAcquisition')!;
    expect(d.date).toBe('2026-11-17');
    expect(d.secondaryDate).toBe('2026-12-15');
    expect(d.days).toBe(12);
    expect(d.status).toBe('due30');
  });
  it('처리하면 done, 원래 날짜를 바꾸면 처리 기록이 적용되지 않고 다시 계산', () => {
    const s = makeState();
    addEmployee(s, { id: 'a', hireDate: '2026-09-01', probationEnd: '2026-11-08' }, { hourlyWage: 10320, schedule: SCHED_18H });
    const d1 = computeDeadlines(s, BASE).find((x) => x.type === 'probationEnd')!;
    expect(d1.status).toBe('due7');
    s.deadlineActions = handleDeadline(s.deadlineActions, d1.key, 'done', BASE);
    expect(computeDeadlines(s, BASE).find((x) => x.type === 'probationEnd')!.status).toBe('done');
    s.employees[0].probationEnd = '2026-11-30';
    const d2 = computeDeadlines(s, BASE).find((x) => x.type === 'probationEnd')!;
    expect(d2.status).toBe('due30');
    expect(d2.date).toBe('2026-11-30');
  });
  it('기존 직원은 등록 전 지난 기한을 위험으로 쌓지 않고 정리 대상으로 둔다', () => {
    const s = makeState();
    addEmployee(s, { id: 'old', hireDate: '2026-06-01', registeredAt: '2026-11-04', onboarding: 'existing-pending', probationEnd: '2026-08-31' }, { hourlyWage: 10320, schedule: SCHED_18H });
    const ds = computeDeadlines(s, BASE);
    expect(ds.find((x) => x.type === 'probationEnd')!.status).toBe('onboarding');
    expect(ds.find((x) => x.type === 'insAcquisition')!.status).toBe('onboarding');
    expect(ds.some((x) => x.status === 'overdue')).toBe(false);
    const rows = computeChecklist(s, BASE).filter((r) => r.employeeId === 'old' && r.item.id === 'E1');
    expect(rows[0].status).toBe('onboarding');
    expect(rows[0].level).toBeNull();
  });
  it('알림 시점: 30·7·3일 전 + 당일, 반복 기한은 3일 전·당일', () => {
    expect(alertDates('2026-12-01', false)).toEqual(['2026-11-01', '2026-11-24', '2026-11-28', '2026-12-01']);
    expect(alertDates('2026-12-10', true)).toEqual(['2026-12-07', '2026-12-10']);
  });
  it('.ics 파일에 날짜 일정과 알람이 들어간다', () => {
    const s = makeState();
    addEmployee(s, { id: 'a', hireDate: '2026-11-03' }, { hourlyWage: 10320, schedule: SCHED_18H });
    const ics = buildIcs(computeDeadlines(s, BASE), new Date('2026-11-05T00:00:00Z'));
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('DTSTART;VALUE=DATE:20261117');
    expect(ics).toContain('TRIGGER:-P30D');
    expect(ics).toContain('TRIGGER:PT9H');
  });
});

describe('F1 규모·조건별 서류', () => {
  it('1~4명은 취업규칙·법령 게시가 "해당 없음", 5~9명은 법령 게시, 10명 이상은 취업규칙', () => {
    const s = makeState('1-4');
    addEmployee(s, { id: 'a', hireDate: '2026-11-01' }, { hourlyWage: 10320, schedule: SCHED_18H });
    const st = (scale: '1-4' | '5-9' | '10+', id: string) => {
      s.workplace!.scale = scale;
      return computeChecklist(s, BASE).find((r) => r.item.id === id)!.status;
    };
    expect(st('1-4', 'W1')).toBe('na');
    expect(st('1-4', 'W2')).toBe('na');
    expect(st('5-9', 'W2')).toBe('todo');
    expect(st('5-9', 'W1')).toBe('na');
    expect(st('10+', 'W1')).toBe('todo');
  });
  it('18세 미만이면 연소자 서류, 하루 단위 고용은 30일이 되면 근로자 명부', () => {
    const s = makeState();
    addEmployee(s, { id: 'm', hireDate: '2026-11-01', ageBand: 'under18', birthDate: '2009-05-01' }, { hourlyWage: 10320, schedule: SCHED_18H });
    addEmployee(s, { id: 'd', hireDate: '2026-10-20', employmentType: 'daily' }, { hourlyWage: 10320, schedule: SCHED_18H });
    const rows = computeChecklist(s, BASE);
    expect(rows.find((r) => r.key === 'E4:m')!.applies).toBe(true);
    expect(rows.find((r) => r.key === 'E3:d')!.applies).toBe(false);
    expect(computeChecklist(s, '2026-11-18').find((r) => r.key === 'E3:d')!.applies).toBe(true);
  });
  it('근로계약서 미교부 + 입사일 지남 → 위험, 홈 할 일에 나타나고 처리하면 사라진다', () => {
    const s = makeState();
    addEmployee(s, { id: 'a', hireDate: '2026-11-01' }, { hourlyWage: 10320, schedule: SCHED_18H });
    const key = 'E1:a:a-c1';
    expect(computeTodos(s, BASE).find((t) => t.id === `doc:${key}`)?.level).toBe('risk');
    s.docRecords.push({ id: 'r', key, itemId: 'E1', employeeId: 'a', status: 'done', doneAt: BASE, naReason: '', expiry: null, examDate: null, location: '', bulk: false, updatedAt: '' });
    expect(computeTodos(s, BASE).find((t) => t.id === `doc:${key}`)).toBeUndefined();
  });
});

describe('위험 점검 — 1~4명 7·9번은 "법적 의무 아님·권장"', () => {
  it('같은 답이라도 규모에 따라 위험/안내가 갈린다', () => {
    const s = makeState('1-4');
    addEmployee(s, { id: 'a', hireDate: '2026-11-01' }, { hourlyWage: 10320, schedule: SCHED_18H });
    s.riskAnswers = [{ questionId: 'R9', answer: 'no', answeredAt: BASE, scaleAtAnswer: '1-4' }];
    expect(evaluateRisk(s, BASE).rows.find((r) => r.q.id === 'R9')!.result).toBe('info');
    s.workplace!.scale = '5-9';
    s.riskAnswers = [{ questionId: 'R9', answer: 'no', answeredAt: BASE, scaleAtAnswer: '5-9' }];
    expect(evaluateRisk(s, BASE).rows.find((r) => r.q.id === 'R9')!.result).toBe('risk');
  });
  it('규모가 바뀌면 다시 묻는다', () => {
    const s = makeState('5-9');
    addEmployee(s, { id: 'a', hireDate: '2026-11-01' }, { hourlyWage: 10320, schedule: SCHED_18H });
    s.riskAnswers = [{ questionId: 'R4', answer: 'no', answeredAt: BASE, scaleAtAnswer: '1-4' }];
    expect(evaluateRisk(s, BASE).rows.find((r) => r.q.id === 'R4')!.result).toBe('stale');
  });
});

describe('역할별 접근 범위 (데모)', () => {
  const seed = createSeed(BASE);
  it('직원은 본인 데이터만 본다', () => {
    const v = employeeScope(seed, 'emp-a', BASE)!;
    expect(v.attendance.length).toBeGreaterThan(0);
    expect(v.attendance.every((a) => a.employeeId === 'emp-a')).toBe(true);
    expect(v.statements.every((s) => s.delivery.employeeId === 'emp-a')).toBe(true);
    expect(v.statements.every((s) => s.line.employeeId === 'emp-a')).toBe(true);
    expect(v.overrides.every((o) => o.employeeId === 'emp-a')).toBe(true);
    const json = JSON.stringify(v);
    expect(json).not.toContain('emp-b');
    expect(json).not.toContain('emp-c');
  });
  it('노무법인은 고른 항목만, 철회하면 첨부가 사라진다', () => {
    const s = structuredClone(seed);
    s.consults.push({ id: 'c1', topic: '해고·징계', question: '질문', memo: '메모 본문', shareItems: ['workplace'], employeeIds: [], snapshot: { workplace: { industry: 'food', scale: '1-4' } }, consentAt: 'x', revokedAt: null, status: 'demo-delivered', createdAt: 'x' });
    let f = firmScope(s);
    expect(f.consults[0].memo).toBe('');
    expect(f.consults[0].snapshot?.workplace?.scale).toBe('1-4');
    s.consults[0].revokedAt = 'y';
    f = firmScope(s);
    expect(f.consults[0].snapshot).toBeNull();
    expect(JSON.stringify(f)).not.toContain('payroll');
    s.workplace!.firmInsuranceShareConsent = false;
    expect(firmScope(s).delegated).toHaveLength(0);
  });
  it('관리자는 집계만 본다', () => {
    const a = adminScope(seed);
    expect(Object.keys(a)).not.toContain('employees_list');
    expect(JSON.stringify(a)).not.toContain('직원 A');
  });
});

describe('시드·새로고침 복원', () => {
  it('시드는 위험·임박·확인 필요 할 일을 만든다', () => {
    const s = createSeed(BASE);
    const todos = computeTodos(s, BASE);
    expect(todos.some((t) => t.level === 'risk' && t.title.includes('근로계약서'))).toBe(true);
    expect(todos.some((t) => t.level === 'risk' && t.title.includes('4대보험'))).toBe(true);
    expect(todos.some((t) => t.title.includes('체류기간'))).toBe(true);
    expect(todos.some((t) => t.title.includes('한 번에 체크'))).toBe(true);
    // 위험 → 임박 → 확인 순
    const order = todos.map((t) => t.level);
    expect(order.indexOf('check')).toBeGreaterThan(order.lastIndexOf('risk'));
  });
  it('JSON 저장 후 복원해도 같은 계산 결과', () => {
    const s = createSeed(BASE);
    const restored = migrate(JSON.parse(JSON.stringify(s)));
    expect(computeTodos(restored, BASE)).toEqual(computeTodos(s, BASE));
    expect(() => migrate({ schemaVersion: 99 })).toThrow();
  });
});

describe('상담 보호 장치', () => {
  it('주민등록번호·휴대폰 번호 패턴을 막는다', () => {
    expect(detectPII('직원 주민번호 900101-1234567 이에요')).toHaveLength(1);
    expect(detectPII('010-1234-5678로 연락')).toContain('휴대폰 번호');
    expect(detectPII('수습 중 감액 되나요')).toHaveLength(0);
  });
  it('FAQ를 먼저 찾는다', () => {
    expect(searchFaq('수습 기간 월급 감액')[0].faq.id).toBe('FAQ3');
    expect(searchFaq('직원이 육아휴직 신청했어요')[0].faq.id).toBe('FAQ13');
    expect(searchFaq('출산휴가 며칠 줘야 해요')[0].faq.id).toBe('FAQ11');
    expect(searchFaq('남편 배우자 출산 휴가')[0].faq.id).toBe('FAQ12');
    expect(searchFaq('임금명세서 안 주면 과태료')[0].faq.id).toBe('FAQ14');
    expect(searchFaq('월급을 늦게 주면 처벌받나요')[0].faq.id).toBe('FAQ15');
    expect(searchFaq('퇴사한 직원 퇴직금 정산은 언제까지')[0].faq.id).toBe('FAQ15');
    expect(searchFaq('알바 공고에 여성 우대라고 써도 되나요')[0].faq.id).toBe('FAQ16');
    expect(searchFaq('구인 글에 20대만 뽑는다고 적어도 돼요?')[0].faq.id).toBe('FAQ16');
    expect(searchFaq('ㅁㄴㅇㄹ')).toHaveLength(0);
  });
});
