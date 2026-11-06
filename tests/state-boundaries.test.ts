import { describe, expect, it } from 'vitest';
import { createEmptyState, createSeed } from '../src/data/seed';
import { migrate } from '../src/adapters/storage';
import { choiceParam, validMonth } from '../src/domain/navigation';
import { removeUnconfirmedEmployee, resolveInvite } from '../src/domain/employees';
import { validateAppState } from '../src/domain/validateState';
import { SaveQueue } from '../src/adapters/saveQueue';

const base = '2026-11-06';
describe('untrusted saved data', () => {
  it('accepts the complete seed/empty state and rejects incomplete nested objects', () => {
    expect(migrate(JSON.parse(JSON.stringify(createSeed(base))))).toEqual(createSeed(base));
    expect(migrate(createEmptyState())).toEqual(createEmptyState());
    expect(() => migrate({ schemaVersion: 1 })).toThrow();
    const s = createSeed(base);
    (s.employees[0] as unknown as { conditionAcks: unknown }).conditionAcks = {};
    expect(() => migrate(s)).toThrow(/conditionAcks/);
  });
  it('rejects impossible dates, nonfinite amounts, duplicate IDs and orphan records', () => {
    const date = createSeed(base);
    date.employees[0].hireDate = '2026-02-30';
    expect(() => migrate(date)).toThrow();
    const wage = createSeed(base);
    wage.conditions[0].hourlyWage = Infinity;
    expect(() => migrate(wage)).toThrow();
    const ids = createSeed(base);
    ids.employees[1].id = ids.employees[0].id;
    expect(() => migrate(ids)).toThrow(/중복/);
    const orphan = createSeed(base);
    orphan.conditions[0].employeeId = 'not-found';
    expect(() => migrate(orphan)).toThrow(/직원/);
  });
  it('blocks executable links and unexpected fields without changing the old object', () => {
    const s = createSeed(base);
    s.customForms.push({ id: 'bad', name: '서식', url: 'javascript:alert(1)' });
    expect(() => migrate(s)).toThrow(/링크/);
    const payload = JSON.parse(JSON.stringify(createEmptyState()));
    payload.settings.__proto__ = null;
    payload.password = 'do-not-save';
    expect(() => migrate(payload)).toThrow(/알 수 없는/);
  });
});
describe('deep links and registration cancellation', () => {
  it('falls back from malformed query params', () => {
    expect(choiceParam('broken', ['list', 'forms'], 'list')).toBe('list');
    expect(validMonth('2026-99')).toBe(false);
    expect(validMonth('2026-11')).toBe(true);
    expect(validMonth('NaN-00')).toBe(false);
  });
  it('distinguishes missing, expired, used and blocked invites', () => {
    const s = createSeed(base);
    const e = s.employees[0];
    e.account = 'invited';
    e.invite = { token: 'one-time', expiresAt: base, used: false };
    expect(resolveInvite(s, 'one-time', base).employee?.id).toBe(e.id);
    expect(resolveInvite(s, 'missing', base).status).toBe('missing');
    expect(resolveInvite(s, 'one-time', '2026-11-07').status).toBe('expired');
    e.invite.used = true;
    expect(resolveInvite(s, 'one-time', base).status).toBe('used');
    e.account = 'blocked';
    expect(resolveInvite(s, 'one-time', base).status).toBe('blocked');
  });
  it('removes associated records and preserves other staff; confirmed payroll is protected', () => {
    const s = createSeed(base);
    const id = s.employees[0].id;
    s.payrolls = [];
    s.statements = [];
    s.payrollEdits = [];
    s.settings.employeeLang[id] = 'en';
    s.attendance.push({
      id: 'test-att',
      employeeId: id,
      recordNo: 'R-1',
      date: base,
      original: { clockIn: '09:00', clockOut: '15:00' },
      source: 'manual',
      gps: null,
      status: 'confirmed',
      approval: 'actual',
      reason: 'test',
      createdAt: new Date().toISOString(),
      confirmedAt: null,
    });
    s.attendanceEdits.push({
      id: 'test-edit',
      recordId: 'test-att',
      before: { clockIn: '09:00', clockOut: '15:00' },
      after: { clockIn: '09:00', clockOut: '16:00' },
      reason: 'test',
      by: 'owner',
      at: new Date().toISOString(),
      employeeResponse: null,
    });
    removeUnconfirmedEmployee(s, id);
    expect(s.employees).toHaveLength(2);
    expect(s.attendanceEdits).toEqual([]);
    expect(s.settings.employeeLang[id]).toBeUndefined();
    expect(() => validateAppState(s)).not.toThrow();
    const protectedState = createSeed(base);
    const lineId = protectedState.payrolls.flatMap((p) => p.confirmedLines ?? [])[0]?.employeeId;
    expect(lineId).toBeDefined();
    expect(() => removeUnconfirmedEmployee(protectedState, lineId!)).toThrow(/확정 급여/);
  });
});
describe('serialized persistence', () => {
  it('coalesces rapid changes while retaining order', async () => {
    const writes: number[] = [];
    let release!: () => void;
    const queue = new SaveQueue<number>(
      async (n) => {
        writes.push(n);
        if (n === 1)
          await new Promise<void>((r) => {
            release = r;
          });
      },
      () => {},
    );
    queue.enqueue(1);
    queue.enqueue(2);
    queue.enqueue(3);
    expect(writes).toEqual([1]);
    release();
    await queue.flush();
    expect(writes).toEqual([1, 3]);
  });
  it('stops after failure and retries the latest unsaved snapshot', async () => {
    let fail = true;
    const writes: number[] = [];
    const errors: unknown[] = [];
    const queue = new SaveQueue<number>(
      async (n) => {
        writes.push(n);
        if (fail) throw new Error('offline');
      },
      (_, error) => {
        if (error) errors.push(error);
      },
    );
    queue.enqueue(1);
    await queue.flush();
    queue.enqueue(2);
    await queue.flush();
    expect(writes).toEqual([1]);
    expect(errors).toHaveLength(1);
    fail = false;
    queue.retry();
    await queue.flush();
    expect(writes).toEqual([1, 2]);
  });
});
