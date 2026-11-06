// DB 행 ↔ 계산 엔진 상태 변환이 계산 결과를 바꾸지 않는지 확인한다 (가상 시드 → 넣을 행 → DB 기본값 채움 → 상태 → 계산 비교)
import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createSeed } from '../../src/data/seed';
import { computeTodos } from '../../src/domain/todos';
import { computeDeadlines } from '../../src/domain/deadlines';
import { computeChecklist } from '../../src/domain/checklist';
import { draftLines, payrollLines } from '../../src/domain/payroll';
import { evaluateRisk } from '../../src/domain/risk';
import { INSERT_ORDER, WORKPLACE_TABLES, remapKey, rowsToState, stateToInsertPlan, type WorkplaceRows } from '../../supabase/functions/_shared/mapping.ts';
import type { AppState } from '../../src/domain/types';

const BASE = '2026-11-05';
const NOW = '2026-11-05T00:00:00.000Z';

/** DB가 채워 주는 기본값을 흉내 낸다 (스키마 20261106000001 기준) */
const DEFAULTS: Record<string, Record<string, unknown>> = {
  employees: { user_id: null, location_consent_at: null, location_consent_revoked_at: null, location_consent_version: null, created_at: NOW, updated_at: NOW },
  condition_acks: { id: undefined },
  attendance_edits: { id: undefined },
  shift_overrides: { id: undefined },
  payroll_manual: {},
  payroll_lines: { id: undefined, created_at: NOW },
  payroll_edits: { id: undefined },
  statement_deliveries: { id: undefined },
  insurance_reports: { updated_at: NOW },
  insurance_notices: { id: undefined },
  doc_records: { id: undefined, updated_at: NOW },
  doc_requests: { id: undefined },
  custom_forms: { id: undefined },
  risk_answers: {},
  offboarding_progress: {},
  busy_days: { id: undefined },
  notifications: { id: undefined, kakao_status: 'not-connected' },
  leave_requests: { id: undefined },
};

function simulateDb(plan: ReturnType<typeof stateToInsertPlan>): WorkplaceRows {
  const rows: Record<string, unknown[]> = Object.fromEntries(WORKPLACE_TABLES.map((t) => [t, []]));
  for (const t of INSERT_ORDER) {
    const list = (plan.rows as Record<string, Record<string, unknown>[] | undefined>)[t] ?? [];
    rows[t] = list.map((r) => {
      const d = DEFAULTS[t] ?? {};
      const out: Record<string, unknown> = { ...d, ...r };
      if ('id' in d && !out.id) out.id = randomUUID();
      return out;
    });
  }
  const wp = { ...plan.workplace, partner_firm_id: null, created_at: NOW, updated_at: NOW } as unknown as WorkplaceRows['workplace'];
  return { workplace: wp, ...(rows as unknown as Omit<WorkplaceRows, 'workplace'>) };
}

function roundTrip(seed: AppState): AppState {
  const plan = stateToInsertPlan(seed, randomUUID(), () => randomUUID());
  return rowsToState(simulateDb(plan));
}

const aliasOf = (s: AppState, id: string | null) => s.employees.find((e) => e.id === id)?.alias ?? null;

describe('DB 매핑 왕복', () => {
  const seed = createSeed(BASE);
  const back = roundTrip(seed);

  it('직원·근로조건·기록 수가 같다', () => {
    expect(back.employees.map((e) => e.alias)).toEqual(seed.employees.map((e) => e.alias));
    expect(back.conditions).toHaveLength(seed.conditions.length);
    expect(back.overrides).toHaveLength(seed.overrides.length);
    expect(back.attendance).toHaveLength(seed.attendance.length);
    expect(back.attendanceEdits).toHaveLength(seed.attendanceEdits.length);
    expect(back.docRecords).toHaveLength(seed.docRecords.length);
  });

  it('id가 들어간 서류 키도 새 id로 바뀐다', () => {
    const e1 = back.docRecords.find((d) => d.itemId === 'E1')!;
    const [, emp, cond] = e1.key.split(':');
    expect(back.employees.some((e) => e.id === emp)).toBe(true);
    expect(back.conditions.some((c) => c.id === cond)).toBe(true);
    expect(remapKey('E1:emp-a:cond-a1', new Map([['emp-a', 'X'], ['cond-a1', 'Y']]))).toBe('E1:X:Y');
  });

  it('오늘 처리할 일이 같다 (제목·수준)', () => {
    const a = computeTodos(seed, BASE).map((t) => `${t.level}|${t.title}`);
    const b = computeTodos(back, BASE).map((t) => `${t.level}|${t.title}`);
    expect(b).toEqual(a);
  });

  it('기한이 같다 (종류·날짜·상태·직원)', () => {
    const pick = (s: AppState) => computeDeadlines(s, BASE).map((d) => `${d.type}|${d.date}|${d.status}|${aliasOf(s, d.employeeId)}`).sort();
    expect(pick(back)).toEqual(pick(seed));
  });

  it('서류 체크리스트 상태가 같다', () => {
    const pick = (s: AppState) => computeChecklist(s, BASE).map((r) => `${r.item.id}|${r.alias}|${r.status}|${r.level}`).sort();
    expect(pick(back)).toEqual(pick(seed));
  });

  it('급여 초안과 확정 스냅샷이 같다', () => {
    const month = '2026-10';
    const pick = (s: AppState) => draftLines(s, month).map((l) => `${l.alias}|${l.gross}|${l.hours.worked}`);
    expect(pick(back)).toEqual(pick(seed));
    const confirmed = seed.payrolls.find((p) => p.status === 'confirmed')!;
    const a = payrollLines(seed, confirmed.month);
    const b = payrollLines(back, confirmed.month);
    expect(b.confirmed).toBe(true);
    expect(b.lines.map((l) => [l.alias, l.gross])).toEqual(a.lines.map((l) => [l.alias, l.gross]));
    // 확정 줄 안의 직원 id도 새 id로 바뀌어 직원과 이어진다
    expect(b.lines.every((l) => back.employees.some((e) => e.id === l.employeeId))).toBe(true);
  });

  it('위험 점검 결과가 같다', () => {
    const a = evaluateRisk(seed, BASE);
    const b = evaluateRisk(back, BASE);
    expect([b.answered, b.total, b.riskCount, b.checkCount]).toEqual([a.answered, a.total, a.riskCount, a.checkCount]);
  });

  it('시드의 "가입함" 직원은 실제 계정이 없으므로 미가입으로 넣는다', () => {
    const plan = stateToInsertPlan(seed, randomUUID(), () => randomUUID());
    expect(plan.rows.employees!.every((e) => e.account_status === 'none')).toBe(true);
    expect(plan.workplace.address).toBe(seed.workplace!.address);
  });
});
