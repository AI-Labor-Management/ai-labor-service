// @vitest-environment jsdom
// 실서버 연결 시험 — 프론트엔드의 실제 코드(src/adapters/server.ts·sync.ts)로 화면과 같은 변경을 만들어 보내고, 서버에서 다시 읽어 확인한다.
// 기본 `npm test`에서는 건너뛴다. 실행: supabase/tests/e2e_setup.sql → E2E_PASSWORD=<…> npx vitest run tests/live
// (.env.local의 VITE_SUPABASE_URL·VITE_SUPABASE_ANON_KEY 필요, 개발 프로젝트에서만. 끝나면 e2e_cleanup.sql)
import { describe, expect, it } from 'vitest';
import { api, fetchMe, loadForSession, pickSession, rpc, runOps, serverConfigured, signIn, signOut, type Loaded, type Me } from '../../src/adapters/server';
import { planFor, type SyncPlan } from '../../src/adapters/sync';
import { draftLines } from '../../src/domain/payroll';
import { uid } from '../../src/state/store';
import type { AppState, DemoSession } from '../../src/domain/types';

const PW = process.env.E2E_PASSWORD;
const run = serverConfigured && !!PW;
const T = 120_000;

/** store.tsx의 flush와 같은 흐름: 서버 상태 → 변경 → 계획 → 보내기 → 다시 읽기 */
async function sync(me: Me, session: DemoSession, cur: Loaded, mutate: (d: AppState) => void): Promise<{ plan: SyncPlan; next: Loaded }> {
  const target = structuredClone(cur.state);
  mutate(target);
  const ctx = { ...cur.ids, payrollIdByMonth: { ...cur.ids.payrollIdByMonth }, newId: () => crypto.randomUUID() };
  const plan = planFor(session, cur.state, target, ctx);
  await runOps(plan.ops, ctx.workplaceId);
  return { plan, next: await loadForSession(me, session) };
}

const now = () => new Date().toISOString();

describe.skipIf(!run)('실서버: 프론트엔드 동기화', () => {
  const owner: DemoSession = { role: 'owner', employeeId: null };
  let me: Me;
  let s: Loaded;
  let empA = '';
  let token = '';
  let keptConsult = '';

  it(
    '사장님 로그인 → 가상 시드 → 서버 상태 읽기',
    async () => {
      await signIn('e2e-owner@example.test', PW!);
      await api('owner/seed-demo', { replace: true });
      me = await fetchMe();
      expect(pickSession(me, null)).toEqual(owner);
      s = await loadForSession(me, owner);
      expect(s.state.workplace?.name).toContain('카페');
      expect(s.state.employees).toHaveLength(3);
      expect(s.ids.workplaceId).toMatch(/^[0-9a-f-]{36}$/);
      empA = s.state.employees.find((e) => e.alias === '직원 A')!.id;
    },
    T,
  );

  it(
    '설정·직원 추가·일정·서류·기한·위험 점검·바쁜 날이 표에 저장된다',
    async () => {
      const newEmp = uid('emp');
      const day = s.state.employees.find((e) => e.id === empA)!;
      const r = await sync(me, owner, s, (d) => {
        d.workplace!.lateToleranceMin = 7;
        d.employees.push({ ...day, id: newEmp, alias: '직원 D (시험)', conditionAcks: [], account: 'none', invite: null, locationConsent: null, foreign: null, isForeign: false });
        d.conditions.push({ ...d.conditions.find((c) => c.employeeId === empA)!, id: uid('cond'), employeeId: newEmp, reason: '최초 등록', createdAt: now() });
        d.overrides.push({ id: uid('ov'), employeeId: newEmp, date: '2026-11-20', kind: 'extra', start: '10:00', end: '14:00', breakMin: 0, memo: '시험', substitutionId: null, createdAt: now() });
        d.notifications.unshift({ id: uid('n'), to: 'owner', kind: 'test', text: '시험 알림', link: '/owner', createdAt: now(), readAt: null, channels: { inApp: 'delivered', kakao: 'not-connected' } });
        d.busyDays.push({ id: uid('busy'), date: '2026-11-21', memo: '축제' });
        d.docRecords.push({ id: uid('doc'), key: `T1:${newEmp}`, itemId: 'T1', employeeId: newEmp, status: 'done', doneAt: '2026-11-06', naReason: '', expiry: null, examDate: null, location: '', bulk: false, updatedAt: now() } as AppState['docRecords'][number]);
        d.deadlineActions.push({ key: 'test:deadline', action: 'done', at: now(), date: '2026-11-06', note: '시험' } as AppState['deadlineActions'][number]);
        d.riskAnswers = d.riskAnswers.filter((a) => a.questionId !== 'Q1');
        d.riskAnswers.push({ questionId: 'Q1', answer: 'yes', answeredAt: now(), scaleAtAnswer: '1-4' });
      });
      expect(r.plan.notes).toEqual([]);
      const st = r.next.state;
      expect(st.workplace!.lateToleranceMin).toBe(7);
      expect(st.employees.some((e) => e.id === newEmp && e.account === 'none')).toBe(true);
      expect(st.conditions.some((c) => c.employeeId === newEmp)).toBe(true);
      expect(st.overrides.some((o) => o.employeeId === newEmp && o.kind === 'extra')).toBe(true);
      expect(st.notifications.some((n) => n.kind === 'test' && n.to === 'owner')).toBe(true);
      expect(st.busyDays.some((b) => b.memo === '축제')).toBe(true);
      expect(st.docRecords.some((x) => x.key === `T1:${newEmp}`)).toBe(true);
      expect(st.deadlineActions.some((x) => x.key === 'test:deadline')).toBe(true);
      expect(st.riskAnswers.find((x) => x.questionId === 'Q1')?.answer).toBe('yes');
      s = r.next;

      // 근로조건 이력 수정은 서버가 받지 않는다 → 알림만, 값은 그대로
      const c = s.state.conditions.find((x) => x.employeeId === newEmp)!;
      const r2 = await sync(me, owner, s, (d) => {
        d.conditions.find((x) => x.id === c.id)!.hourlyWage = 1;
      });
      expect(r2.plan.notes.join()).toContain('근로조건 이력은 고칠 수 없어요');
      expect(r2.next.state.conditions.find((x) => x.id === c.id)!.hourlyWage).toBe(c.hourlyWage);

      // 직원 삭제(확정 급여 없음) → 딸린 기록도 함께 사라짐
      const r3 = await sync(me, owner, r2.next, (d) => {
        d.employees = d.employees.filter((e) => e.id !== newEmp);
        d.conditions = d.conditions.filter((x) => x.employeeId !== newEmp);
        d.overrides = d.overrides.filter((x) => x.employeeId !== newEmp);
        d.docRecords = d.docRecords.filter((x) => x.employeeId !== newEmp);
      });
      expect(r3.next.state.employees.some((e) => e.id === newEmp)).toBe(false);
      expect(r3.next.state.overrides.some((o) => o.employeeId === newEmp)).toBe(false);
      s = r3.next;
    },
    T,
  );

  it(
    '출퇴근 확정·수정 이력·사장님 직접 기록',
    async () => {
      const pending = s.state.attendance.find((a) => a.status !== 'confirmed' && a.original.clockIn && a.original.clockOut);
      const target = s.state.attendance.find((a) => a.original.clockIn && a.original.clockOut && a.id !== pending?.id)!;
      const empC = s.state.employees.find((e) => e.alias === '직원 C')!.id;
      const r = await sync(me, owner, s, (d) => {
        if (pending) Object.assign(d.attendance.find((a) => a.id === pending.id)!, { status: 'confirmed', approval: 'actual', confirmedAt: now() });
        d.attendanceEdits.push({ id: uid('edit'), recordId: target.id, before: target.original, after: { clockIn: '10:00', clockOut: '15:00' }, reason: '시험 수정', by: 'owner', at: now(), employeeResponse: null });
        d.attendance.push({ id: uid('att'), recordNo: 'R-LOCAL', employeeId: empC, date: '2026-11-02', original: { clockIn: '09:00', clockOut: '13:00' }, source: 'owner', gps: null, status: 'confirmed', approval: 'actual', reason: '기기 고장', createdAt: now(), confirmedAt: now() });
      });
      const st = r.next.state;
      if (pending) expect(st.attendance.find((a) => a.id === pending.id)!.status).toBe('confirmed');
      expect(st.attendanceEdits.some((x) => x.recordId === target.id && x.reason === '시험 수정')).toBe(true);
      expect(st.attendance.find((a) => a.id === target.id)!.original).toEqual(target.original); // 원래 기록은 그대로
      const manual = st.attendance.find((a) => a.employeeId === empC && a.date === '2026-11-02');
      expect(manual?.source).toBe('owner');
      expect(manual?.recordNo).toMatch(/^R-20261102-\d{4}$/); // 서버가 발급
      s = r.next;
    },
    T,
  );

  it(
    '급여: 직접 입력 → 확정 → 확정 후 수정',
    async () => {
      const month = '2026-11';
      const lines = draftLines(s.state, month);
      expect(lines.length).toBeGreaterThan(0);
      const e = lines[0].employeeId;
      let r = await sync(me, owner, s, (d) => {
        d.payrolls.push({ id: month, month, status: 'draft', scaleConfirmed: null, manual: [{ employeeId: e, incomeTax: 1200, localTax: 120, adjustments: [] }], confirmedAt: null, confirmedLines: null, confirmedWithPending: [], revision: 0 });
      });
      expect(r.next.state.payrolls.find((p) => p.month === month)?.manual[0]).toMatchObject({ employeeId: e, incomeTax: 1200 });
      expect(r.next.ids.payrollIdByMonth[month]).toBeTruthy();
      s = r.next;
      const snap = draftLines(s.state, month);
      r = await sync(me, owner, s, (d) => {
        const p = d.payrolls.find((x) => x.month === month)!;
        Object.assign(p, { status: 'confirmed', confirmedAt: now(), confirmedLines: snap, revision: 1, scaleConfirmed: '1-4' });
      });
      const p = r.next.state.payrolls.find((x) => x.month === month)!;
      expect(p.status).toBe('confirmed');
      expect(p.confirmedLines!.reduce((a, l) => a + l.gross, 0)).toBe(snap.reduce((a, l) => a + l.gross, 0)); // 화면 계산 = 서버 확정
      expect(r.next.state.statements.filter((x) => x.payrollId === month)).toHaveLength(snap.length);
      s = r.next;
      const line = p.confirmedLines![0];
      r = await sync(me, owner, s, (d) => {
        const q = d.payrolls.find((x) => x.month === month)!;
        const l = q.confirmedLines!.find((x) => x.employeeId === line.employeeId)!;
        l.items.push({ code: 'adjust', label: '교통비', amount: 15000, formula: '확정 후 수정 · 누락분', basis: [] });
        l.gross += 15000;
        q.revision += 1;
        d.payrollEdits.push({ id: uid('pe'), payrollId: q.id, employeeId: line.employeeId, field: '조정 항목 추가', before: '—', after: '교통비 15,000원', reason: '누락분', at: now() });
      });
      const q = r.next.state.payrolls.find((x) => x.month === month)!;
      expect(q.revision).toBe(2);
      expect(q.confirmedLines!.find((x) => x.employeeId === line.employeeId)!.gross).toBe(line.gross + 15000);
      expect(r.next.state.payrollEdits.some((x) => x.reason === '누락분')).toBe(true);
      s = r.next;
    },
    T,
  );

  it(
    '대타 지정·노무법인 상담 보내기·철회·직원 초대',
    async () => {
      const [a, b] = s.state.employees;
      const sid = uid('sub');
      let r = await sync(me, owner, s, (d) => {
        d.substitutions.push({ id: sid, date: '2026-11-25', fromEmployeeId: a.id, toEmployeeId: b.id, mode: 'owner', status: 'approved', memo: '', createdAt: now(), decidedAt: now() });
        d.overrides.push({ id: uid('ov'), employeeId: a.id, date: '2026-11-25', kind: 'subOut', start: null, end: null, breakMin: 0, memo: '', substitutionId: sid, createdAt: now() });
        d.overrides.push({ id: uid('ov'), employeeId: b.id, date: '2026-11-25', kind: 'subIn', start: '10:00', end: '15:00', breakMin: 30, memo: '', substitutionId: sid, createdAt: now() });
        for (const q of ['연장근로 계산이 맞는지 봐주세요.', '철회할 질문이에요.'])
          d.consults.unshift({ id: uid('cs'), topic: '근로시간', question: q, memo: '', shareItems: ['memo', 'workplace'], employeeIds: [], snapshot: null, consentAt: now(), revokedAt: null, status: 'demo-delivered', createdAt: now() });
      });
      expect(r.plan.notes).toEqual([]);
      expect(r.next.state.overrides.filter((o) => o.substitutionId === sid)).toHaveLength(2);
      expect(r.next.state.consults).toHaveLength(2);
      s = r.next;
      const toRevoke = s.state.consults.find((c) => c.question.startsWith('철회'))!;
      keptConsult = s.state.consults.find((c) => c.id !== toRevoke.id)!.id;
      r = await sync(me, owner, s, (d) => {
        Object.assign(d.consults.find((c) => c.id === toRevoke.id)!, { revokedAt: now(), status: 'revoked', snapshot: null, memo: '' });
      });
      expect(r.next.state.consults.find((c) => c.id === toRevoke.id)!.revokedAt).toBeTruthy();
      s = r.next;
      const inv = await rpc<{ token: string }>('create_invite', { p_employee_id: empA });
      token = inv.token;
      expect(token.length).toBeGreaterThan(30);
      await signOut();
    },
    T,
  );

  it(
    '직원: 초대 수락 → 본인 데이터만 → 근로조건 확인·위치 동의·출근·명세서 열람',
    async () => {
      await signIn('e2e-employee@example.test', PW!);
      const id = await rpc<string>('accept_invite', { p_token: token });
      expect(id).toBe(empA);
      const em = await fetchMe();
      const sess = pickSession(em, null);
      expect(sess).toEqual({ role: 'employee', employeeId: empA });
      let e = await loadForSession(em, sess);
      const mine = e.state.employees.find((x) => x.id === empA)!;
      expect(mine.account).toBe('joined');
      expect(e.state.conditions.every((c) => c.employeeId === empA)).toBe(true);
      expect(e.state.attendance.every((a) => a.employeeId === empA)).toBe(true);
      expect(e.state.payrolls.every((p) => p.confirmedLines!.every((l) => l.employeeId === empA))).toBe(true);
      expect(e.state.docRecords).toEqual([]);
      expect(e.state.consults).toEqual([]);
      const cond = e.state.conditions[0];
      const st = e.state.statements.find((x) => !x.viewedAt);
      const hasToday = e.state.attendance.some((a) => a.date === '2026-11-06');
      const r = await sync(em, sess, e, (d) => {
        const x = d.employees.find((y) => y.id === empA)!;
        x.conditionAcks.push({ conditionId: cond.id, status: 'confirmed', memo: '', at: now(), resolvedAt: null });
        x.locationConsent = { at: now(), revokedAt: null };
        d.settings.employeeLang[empA] = 'en';
        if (st) d.statements.find((y) => y.id === st.id)!.viewedAt = now();
        if (!hasToday) d.attendance.push({ id: uid('att'), recordNo: 'R', employeeId: empA, date: '2026-11-06', original: { clockIn: '03:33', clockOut: null }, source: 'gps-demo', gps: 'inside', status: 'pending', approval: null, reason: '', createdAt: now(), confirmedAt: null });
      });
      expect(r.plan.notes).toEqual([]);
      e = r.next;
      const x = e.state.employees.find((y) => y.id === empA)!;
      expect(x.conditionAcks.some((a) => a.conditionId === cond.id && a.status === 'confirmed')).toBe(true);
      expect(x.locationConsent?.revokedAt ?? null).toBeNull();
      expect(e.state.settings.employeeLang[empA]).toBe('en');
      if (st) expect(e.state.statements.find((y) => y.id === st.id)!.viewedAt).toBeTruthy();
      const today = e.state.attendance.find((a) => a.date === '2026-11-06');
      expect(today).toBeTruthy();
      if (!hasToday) expect(today!.original.clockIn).not.toBe('03:33'); // 기기 시각이 아니라 서버 시각
      await signOut();
    },
    T,
  );

  it(
    '노무법인: 받은 요청(철회 건은 가림)·읽음·맡김 보험 처리·검수 의견',
    async () => {
      await signIn('e2e-firm@example.test', PW!);
      const fm = await fetchMe();
      const sess = pickSession(fm, null);
      expect(sess.role).toBe('firm');
      let f = await loadForSession(fm, sess);
      const kept = f.state.consults.find((c) => c.id === keptConsult)!;
      expect(kept.question).toContain('연장근로');
      const revoked = f.state.consults.find((c) => c.id !== keptConsult && c.status === 'revoked');
      expect(revoked?.question).toBe('(공유 철회됨)');
      const delegated = f.state.employees[0];
      const r = await sync(fm, sess, f, (d) => {
        d.consults.find((c) => c.id === keptConsult)!.status = 'firm-read';
        if (delegated) d.insuranceReports.push({ employeeId: delegated.id, phase: 'acquisition', status: 'firmDone', date: '2026-11-06', by: 'firm' });
        d.reviewComments.unshift({ id: uid('rc'), target: 'R01', comment: '시험 의견', at: now() });
      });
      expect(r.plan.notes).toEqual([]);
      f = r.next;
      expect(f.state.consults.find((c) => c.id === keptConsult)!.status).toBe('firm-read');
      if (delegated) expect(f.state.insuranceReports.find((x) => x.employeeId === delegated.id && x.phase === 'acquisition')?.status).toBe('firmDone');
      expect(f.state.reviewComments.some((c) => c.comment === '시험 의견')).toBe(true);
      await signOut();
    },
    T,
  );
});
