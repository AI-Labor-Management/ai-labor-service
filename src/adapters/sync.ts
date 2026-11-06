// 서버 모드 동기화 — 화면은 지금처럼 update()로 상태를 바꾸고, 여기서 "바뀌기 전 → 바뀐 후"를 비교해 서버 요청으로 바꾼다.
//  · 사장님: 단순 입력은 표에 직접 쓰기(PostgREST + RLS), 계산·확정이 필요한 일은 Edge Function `api`, 일부는 RPC
//  · 직원·노무법인: 본인 권한 RPC만 (서버가 권한·알림을 처리)
// 서버가 받지 않는 변경(근로조건 이력 수정 등)은 notes로 돌려주고, 저장 후 서버 상태를 다시 읽어 화면을 맞춘다.
// 이 파일의 plan* 함수는 순수 함수라 단위 테스트한다 (tests/sync.test.ts).
import type { AppState, DemoSession, PayrollLine } from '../domain/types';

export type Row = Record<string, unknown>;
export type Op =
  | { t: 'insert'; table: string; rows: Row[] }
  | { t: 'update'; table: string; match: Row; values: Row }
  | { t: 'delete'; table: string; match: Row }
  | { t: 'rpc'; name: string; args: Row }
  | { t: 'api'; path: string; body: Row };

export interface SyncCtx {
  userId: string;
  workplaceId: string | null;
  payrollIdByMonth: Record<string, string>;
  firmId: string | null;
  newId: () => string;
}

export interface SyncPlan {
  ops: Op[];
  /** 서버가 받지 않아 저장하지 않은 변경 — 화면에 알린다 */
  notes: string[];
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

function changed(a: Row, b: Row): Row | null {
  const out: Row = {};
  let any = false;
  for (const k of Object.keys(b)) {
    if (!same(a[k], b[k])) {
      out[k] = b[k] ?? null;
      any = true;
    }
  }
  return any ? out : null;
}

interface Spec<T> {
  table: string;
  items: (s: AppState) => T[];
  key: (x: T) => string;
  match: (x: T) => Row;
  row: (x: T, s: AppState) => Row;
  /** 새 행에만 들어가는 열 (id 등) */
  insertExtra?: (x: T, s: AppState) => Row;
  /** true = 넣기 허용, false = 무시(서버가 따로 만듦), 문자열 = 거절 사유 */
  insert: boolean | ((x: T) => boolean | string);
  /** true = 모든 열, 배열 = 그 열만 (나머지 변경은 무시), 문자열 = 거절 사유 */
  update: true | false | string[] | string;
  delete: boolean | string;
  employeeOf?: (x: T) => string | null;
}

function spec<T>(s: Spec<T>): Spec<T> {
  return s;
}

// ───────────────────────── 사장님 표 정의 ─────────────────────────

const OWNER_SPECS = [
  spec({
    table: 'employees',
    items: (s) => s.employees,
    key: (e) => e.id,
    match: (e) => ({ id: e.id }),
    row: (e) => ({
      alias: e.alias,
      age_band: e.ageBand,
      birth_date: e.birthDate,
      started_before_65: e.startedBefore65,
      hire_date: e.hireDate,
      employment_type: e.employmentType,
      contract_end: e.contractEnd,
      probation_end: e.probationEnd,
      food_handler: e.foodHandler,
      is_foreign: e.isForeign,
      school: e.school,
      insurance_method: e.insuranceMethod,
      registered_at: e.registeredAt,
      onboarding: e.onboarding,
      resign_date: e.resignDate,
      resign_type: e.resignType,
      bonus_annual: e.bonusAnnual,
      leave_allowance_annual: e.leaveAllowanceAnnual,
    }),
    insertExtra: (e, s) => ({ id: e.id, account_status: 'none', lang: s.settings.employeeLang[e.id] ?? 'ko' }),
    insert: true,
    update: true,
    delete: false, // 직원 삭제는 planOwner가 RPC(delete_employee_if_unpaid)로 보낸다
  }),
  spec({
    table: 'employee_foreign_info',
    items: (s) => s.employees.filter((e) => e.isForeign && e.foreign).map((e) => ({ employeeId: e.id, f: e.foreign! })),
    key: (x) => x.employeeId,
    match: (x) => ({ employee_id: x.employeeId }),
    row: ({ f }) => ({ visa: f.visa, expiry: f.expiry, permitted: f.permitted, permit_hours: f.permitHours, other_workplace_hours: f.otherWorkplaceHours, nationality: f.nationality, checked_at: f.checkedAt }),
    insertExtra: (x) => ({ employee_id: x.employeeId }),
    insert: true,
    update: true,
    delete: true,
    employeeOf: (x) => x.employeeId,
  }),
  spec({
    table: 'work_conditions',
    items: (s) => s.conditions,
    key: (c) => c.id,
    match: (c) => ({ id: c.id }),
    row: (c) => ({
      employee_id: c.employeeId,
      effective_from: c.effectiveFrom,
      hourly_wage: c.hourlyWage,
      schedule: c.schedule,
      variable: c.variable,
      variable_weekly_hours: c.variableWeeklyHours,
      weekly_holiday_day: c.weeklyHolidayDay,
      job: c.job,
      meal_allowance: c.mealAllowance,
      break_waiver_requested: c.breakWaiverRequested,
      reason: c.reason,
    }),
    insertExtra: (c) => ({ id: c.id }),
    insert: true,
    update: '근로조건 이력은 고칠 수 없어요 — 바뀐 조건은 새 적용일로 추가하세요',
    delete: '근로조건 이력은 지울 수 없어요',
    employeeOf: (c) => c.employeeId,
  }),
  spec({
    table: 'condition_acks',
    items: (s) => s.employees.flatMap((e) => e.conditionAcks.map((a) => ({ employeeId: e.id, a }))),
    key: (x) => `${x.employeeId}:${x.a.conditionId}:${x.a.at}`,
    match: (x) => ({ employee_id: x.employeeId, condition_id: x.a.conditionId, at: x.a.at }),
    row: ({ a }) => ({ resolved_at: a.resolvedAt }),
    insert: false, // 직원이 RPC로 남긴다
    update: true,
    delete: false,
    employeeOf: (x) => x.employeeId,
  }),
  spec({
    table: 'substitutions',
    items: (s) => s.substitutions,
    key: (x) => x.id,
    match: (x) => ({ id: x.id }),
    row: (x) => ({ date: x.date, from_employee_id: x.fromEmployeeId, to_employee_id: x.toEmployeeId, mode: x.mode, status: x.status, memo: x.memo, decided_at: x.decidedAt }),
    insertExtra: (x) => ({ id: x.id }),
    insert: true,
    update: true,
    delete: true,
    employeeOf: (x) => x.fromEmployeeId,
  }),
  spec({
    table: 'shift_overrides',
    items: (s) => s.overrides,
    key: (o) => o.id,
    match: (o) => ({ id: o.id }),
    row: (o) => ({ employee_id: o.employeeId, date: o.date, kind: o.kind, start_time: o.start, end_time: o.end, break_min: o.breakMin, memo: o.memo, substitution_id: o.substitutionId }),
    insertExtra: (o) => ({ id: o.id }),
    insert: true,
    update: true,
    delete: true,
    employeeOf: (o) => o.employeeId,
  }),
  spec({
    table: 'attendance_records',
    items: (s) => s.attendance,
    key: (a) => a.id,
    match: (a) => ({ id: a.id }),
    row: (a) => ({
      employee_id: a.employeeId,
      record_no: a.recordNo,
      date: a.date,
      original_clock_in: a.original.clockIn,
      original_clock_out: a.original.clockOut,
      source: a.source,
      gps: a.gps,
      status: a.status,
      approval: a.approval,
      reason: a.reason,
      confirmed_at: a.confirmedAt,
    }),
    insert: false, // 사장님 직접 기록은 planOwner에서 API로 (기록 번호를 서버가 발급)
    update: ['status', 'approval', 'reason', 'confirmed_at'],
    delete: '출퇴근 기록은 지울 수 없어요',
    employeeOf: (a) => a.employeeId,
  }),
  spec({
    table: 'attendance_edits',
    items: (s) => s.attendanceEdits,
    key: (x) => x.id,
    match: (x) => ({ id: x.id }),
    row: (x) => ({ record_id: x.recordId, before_in: x.before.clockIn, before_out: x.before.clockOut, after_in: x.after.clockIn, after_out: x.after.clockOut, reason: x.reason }),
    insertExtra: (x) => ({ id: x.id }),
    insert: true,
    update: false,
    delete: false,
  }),
  spec({
    table: 'leave_requests',
    items: (s) => s.leaveRequests,
    key: (l) => l.id,
    match: (l) => ({ id: l.id }),
    row: (l) => ({ employee_id: l.employeeId, date: l.date, hours: l.hours, status: l.status, adjust_reason: l.adjustReason, decided_at: l.decidedAt, requested_by: l.by }),
    insertExtra: (l) => ({ id: l.id }),
    insert: (l) => l.by === 'owner',
    update: ['status', 'adjust_reason', 'decided_at'],
    delete: false,
    employeeOf: (l) => l.employeeId,
  }),
  spec({
    table: 'insurance_reports',
    items: (s) => s.insuranceReports,
    key: (r) => `${r.employeeId}:${r.phase}`,
    match: (r) => ({ employee_id: r.employeeId, phase: r.phase }),
    row: (r) => ({ status: r.status, date: r.date, by_role: r.by }),
    insertExtra: (r) => ({ employee_id: r.employeeId, phase: r.phase }),
    insert: true,
    update: true,
    delete: true,
    employeeOf: (r) => r.employeeId,
  }),
  spec({
    table: 'insurance_notices',
    items: (s) => s.insuranceNotices,
    key: (n) => n.id,
    match: (n) => ({ id: n.id }),
    row: (n) => ({ employee_id: n.employeeId, from_month: n.fromMonth, amounts: n.amounts, entered_at: n.enteredAt }),
    insertExtra: (n) => ({ id: n.id }),
    insert: true,
    update: true,
    delete: true,
    employeeOf: (n) => n.employeeId,
  }),
  spec({
    table: 'doc_records',
    items: (s) => s.docRecords,
    key: (d) => d.id,
    match: (d) => ({ id: d.id }),
    row: (d) => ({ key: d.key, item_id: d.itemId, employee_id: d.employeeId, status: d.status, done_at: d.doneAt, na_reason: d.naReason, expiry: d.expiry, exam_date: d.examDate, location: d.location, bulk: d.bulk }),
    insertExtra: (d) => ({ id: d.id }),
    insert: true,
    update: true,
    delete: true,
    employeeOf: (d) => d.employeeId,
  }),
  spec({
    table: 'doc_requests',
    items: (s) => s.docRequests,
    key: (d) => d.id,
    match: (d) => ({ id: d.id }),
    row: (d) => ({
      employee_id: d.employeeId,
      item_id: d.itemId,
      custom_name: d.customName,
      status: d.status,
      requested_at: d.requestedAt,
      due_date: d.dueDate,
      received_at: d.receivedAt,
      fix_reason: d.fixReason,
      expiry: d.expiry,
      location: d.location,
      history: d.history,
    }),
    insertExtra: (d) => ({ id: d.id }),
    insert: true,
    update: true,
    delete: true,
    employeeOf: (d) => d.employeeId,
  }),
  spec({
    table: 'custom_forms',
    items: (s) => s.customForms,
    key: (c) => c.id,
    match: (c) => ({ id: c.id }),
    row: (c) => ({ name: c.name, url: c.url }),
    insertExtra: (c) => ({ id: c.id }),
    insert: true,
    update: true,
    delete: true,
  }),
  spec({
    table: 'deadline_actions',
    items: (s) => s.deadlineActions,
    key: (a) => a.key,
    match: (a) => ({ key: a.key }),
    row: (a) => ({ action: a.action, at: a.at, date: a.date, note: a.note }),
    insertExtra: (a) => ({ key: a.key }),
    insert: true,
    update: true,
    delete: true,
  }),
  spec({
    table: 'risk_answers',
    items: (s) => s.riskAnswers,
    key: (a) => a.questionId,
    match: (a) => ({ question_id: a.questionId }),
    row: (a) => ({ answer: a.answer, answered_at: a.answeredAt, scale_at_answer: a.scaleAtAnswer }),
    insertExtra: (a) => ({ question_id: a.questionId }),
    insert: true,
    update: true,
    delete: true,
  }),
  spec({
    table: 'offboarding_progress',
    items: (s) => s.offboarding,
    key: (o) => o.employeeId,
    match: (o) => ({ employee_id: o.employeeId }),
    row: (o) => ({ steps: o.steps, started_at: o.startedAt, completed_at: o.completedAt }),
    insertExtra: (o) => ({ employee_id: o.employeeId }),
    insert: true,
    update: true,
    delete: true,
    employeeOf: (o) => o.employeeId,
  }),
  spec({
    table: 'busy_days',
    items: (s) => s.busyDays,
    key: (b) => b.id,
    match: (b) => ({ id: b.id }),
    row: (b) => ({ date: b.date, memo: b.memo }),
    insertExtra: (b) => ({ id: b.id }),
    insert: true,
    update: true,
    delete: true,
  }),
  spec({
    table: 'notifications',
    items: (s) => s.notifications,
    key: (n) => n.id,
    match: (n) => ({ id: n.id }),
    row: (n) => ({ read_at: n.readAt }),
    insertExtra: (n) => ({ id: n.id, recipient: n.to === 'owner' ? 'owner' : 'employee', employee_id: n.to === 'owner' ? null : n.to, kind: n.kind, text: n.text.slice(0, 500), link: n.link }),
    // 명세서 알림은 급여 확정·수정 API가 직접 만든다 (중복 방지)
    insert: (n) => n.kind !== 'statement' && !n.readAt,
    update: true,
    delete: false, // 오래된 알림 정리는 화면에서만
  }),
];

// 지우기는 자식 표부터, 넣기·고치기는 부모 표부터
const DELETE_ORDER = ['notifications', 'shift_overrides', 'substitutions', 'insurance_notices', 'insurance_reports', 'doc_records', 'doc_requests', 'custom_forms', 'deadline_actions', 'risk_answers', 'offboarding_progress', 'busy_days', 'employee_foreign_info'];

function diffSpec<T>(sp: Spec<T>, prev: AppState, next: AppState, deletedEmployees: Set<string>, upserts: Op[], deletes: Op[], notes: string[]) {
  const P = new Map(sp.items(prev).map((x) => [sp.key(x), x]));
  const N = new Map(sp.items(next).map((x) => [sp.key(x), x]));
  for (const [k, x] of P) {
    if (N.has(k)) continue;
    const emp = sp.employeeOf?.(x);
    if (emp && deletedEmployees.has(emp)) continue; // 직원 삭제 RPC가 함께 지운다
    if (sp.delete === true) deletes.push({ t: 'delete', table: sp.table, match: sp.match(x) });
    else if (typeof sp.delete === 'string') notes.push(sp.delete);
  }
  for (const [k, x] of N) {
    const p = P.get(k);
    if (!p) {
      const ok = typeof sp.insert === 'function' ? sp.insert(x) : sp.insert;
      if (ok === true) upserts.push({ t: 'insert', table: sp.table, rows: [{ ...sp.row(x, next), ...(sp.insertExtra?.(x, next) ?? {}) }] });
      else if (typeof ok === 'string') notes.push(ok);
      continue;
    }
    const diff = changed(sp.row(p, prev), sp.row(x, next));
    if (!diff) continue;
    if (sp.update === true) upserts.push({ t: 'update', table: sp.table, match: sp.match(x), values: diff });
    else if (Array.isArray(sp.update)) {
      const allowed = Object.fromEntries(Object.entries(diff).filter(([c]) => (sp.update as string[]).includes(c)));
      if (Object.keys(allowed).length) upserts.push({ t: 'update', table: sp.table, match: sp.match(x), values: allowed });
    } else if (typeof sp.update === 'string') notes.push(sp.update);
  }
}

function workplaceRow(s: AppState): Row {
  const w = s.workplace!;
  return {
    name: w.name,
    industry: w.industry,
    scale: w.scale,
    family_only: w.familyOnly,
    pay_day: w.payDay,
    pay_month_basis: w.payMonthBasis,
    gps_enabled: w.gpsEnabled,
    address: w.gpsEnabled ? w.address : '',
    radius_m: w.radiusM,
    late_tolerance_min: w.lateToleranceMin,
    default_insurance_method: w.defaultInsuranceMethod,
    hourly_leave_allowed: w.hourlyLeaveAllowed,
    firm_insurance_share_consent: w.firmInsuranceShareConsent,
    base_date_override: s.settings.baseDateOverride,
    kakao_banner_dismissed: s.settings.kakaoBannerDismissed,
  };
}

const lineOf = (s: AppState, month: string, emp: string): PayrollLine | undefined => s.payrolls.find((p) => p.month === month)?.confirmedLines?.find((l) => l.employeeId === emp);

/** 사장님 변경 → 서버 요청. ctx.workplaceId·payrollIdByMonth는 새 행을 만들면 채워진다 */
export function planOwner(prev: AppState, next: AppState, ctx: SyncCtx): SyncPlan {
  const ops: Op[] = [];
  const notes: string[] = [];

  // 사업장 전체 삭제 (데이터 초기화)
  if (prev.workplace && !next.workplace) return { ops: [{ t: 'rpc', name: 'delete_my_workplace', args: {} }], notes };
  if (!next.workplace) return { ops, notes };
  if (!ctx.workplaceId) {
    ctx.workplaceId = ctx.newId();
    ops.push({ t: 'insert', table: 'workplaces', rows: [{ id: ctx.workplaceId, owner_id: ctx.userId, ...workplaceRow(next) }] });
  } else if (prev.workplace) {
    const d = changed(workplaceRow(prev), workplaceRow(next));
    if (d) ops.push({ t: 'update', table: 'workplaces', match: { id: ctx.workplaceId }, values: d });
  }

  // 직원 삭제는 RPC (확정 급여가 있으면 서버가 거절)
  const nextEmp = new Set(next.employees.map((e) => e.id));
  const deletedEmployees = new Set(prev.employees.filter((e) => !nextEmp.has(e.id)).map((e) => e.id));
  for (const id of deletedEmployees) ops.push({ t: 'rpc', name: 'delete_employee_if_unpaid', args: { p_employee_id: id } });

  const upserts: Op[] = [];
  const deletes: Op[] = [];
  for (const sp of OWNER_SPECS) diffSpec(sp as Spec<unknown>, prev, next, deletedEmployees, upserts, deletes, notes);
  // 수정 이력은 누가 고쳤는지 서버가 확인한다 (RLS: by_user = 본인)
  for (const op of upserts) if (op.t === 'insert' && op.table === 'attendance_edits') op.rows = op.rows.map((r) => ({ ...r, by_user: ctx.userId }));

  // 사장님 직접 출퇴근 기록: 서버가 기록 번호를 발급한다
  const prevAtt = new Set(prev.attendance.map((a) => a.id));
  const apiAfter: Op[] = [];
  for (const a of next.attendance.filter((x) => !prevAtt.has(x.id))) {
    if (a.source === 'owner' && a.original.clockIn && a.original.clockOut) {
      apiAfter.push({ t: 'api', path: 'owner/attendance/manual', body: { employeeId: a.employeeId, date: a.date, clockIn: a.original.clockIn, clockOut: a.original.clockOut, reason: a.reason || '사장님 직접 기록' } });
    } else notes.push('출퇴근 기록은 직원 앱 또는 사장님 직접 기록(출근·퇴근 시각 모두)으로만 남길 수 있어요');
  }

  // 급여: 초안 행·직접 입력 → 확정 → 확정 후 수정
  const prevPay = new Map(prev.payrolls.map((p) => [p.month, p]));
  const payOps: Op[] = [];
  for (const p of next.payrolls) {
    const old = prevPay.get(p.month);
    let pid = ctx.payrollIdByMonth[p.month];
    if (!pid) {
      pid = ctx.newId();
      ctx.payrollIdByMonth[p.month] = pid;
      upserts.push({ t: 'insert', table: 'payroll_months', rows: [{ id: pid, month: p.month, status: 'draft', scale_confirmed: p.scaleConfirmed, revision: 0 }] });
    } else if (old && old.status === 'draft' && !same(old.scaleConfirmed, p.scaleConfirmed)) {
      upserts.push({ t: 'update', table: 'payroll_months', match: { id: pid }, values: { scale_confirmed: p.scaleConfirmed } });
    }
    const oldManual = new Map((old?.manual ?? []).map((m) => [m.employeeId, m]));
    for (const m of p.manual) {
      const row = { income_tax: m.incomeTax, local_tax: m.localTax, adjustments: m.adjustments };
      const o = oldManual.get(m.employeeId);
      if (!o) upserts.push({ t: 'insert', table: 'payroll_manual', rows: [{ payroll_id: pid, employee_id: m.employeeId, ...row }] });
      else {
        const d = changed({ income_tax: o.incomeTax, local_tax: o.localTax, adjustments: o.adjustments }, row);
        if (d) upserts.push({ t: 'update', table: 'payroll_manual', match: { payroll_id: pid, employee_id: m.employeeId }, values: d });
      }
      oldManual.delete(m.employeeId);
    }
    for (const [emp] of oldManual) if (!deletedEmployees.has(emp)) deletes.push({ t: 'delete', table: 'payroll_manual', match: { payroll_id: pid, employee_id: emp } });

    if (p.status === 'confirmed' && (!old || old.status === 'draft')) {
      payOps.push({ t: 'api', path: 'owner/payroll/confirm', body: { month: p.month, allowPending: true } });
    } else if (p.status === 'confirmed' && old?.status === 'confirmed' && p.revision > old.revision) {
      const oldEdits = new Set(prev.payrollEdits.map((x) => x.id));
      for (const ed of next.payrollEdits.filter((x) => x.payrollId === p.id && !oldEdits.has(x.id))) {
        const before = lineOf(prev, p.month, ed.employeeId);
        const after = lineOf(next, p.month, ed.employeeId);
        if (!after) continue;
        if (ed.field === '조정 항목 추가') {
          const added = after.items.filter((i) => i.code === 'adjust').at(-1);
          const had = before?.items.filter((i) => i.code === 'adjust').length ?? 0;
          if (!added || after.items.filter((i) => i.code === 'adjust').length <= had) continue;
          payOps.push({ t: 'api', path: 'owner/payroll/edit', body: { month: p.month, employeeId: ed.employeeId, kind: 'adjust', label: added.label, amount: added.amount, reason: ed.reason } });
        } else {
          const kind = ed.field === '소득세' ? 'incomeTax' : 'localTax';
          const amount = after.deductions.find((d) => d.code === kind)?.amount;
          if (amount === null || amount === undefined) continue;
          payOps.push({ t: 'api', path: 'owner/payroll/edit', body: { month: p.month, employeeId: ed.employeeId, kind, amount, reason: ed.reason } });
        }
      }
    }
  }

  // 노무법인 상담: 보내기는 API(고른 항목만 서버가 다시 만든다), 철회는 RPC
  const prevConsult = new Map(prev.consults.map((c) => [c.id, c]));
  for (const c of next.consults) {
    const o = prevConsult.get(c.id);
    if (!o) apiAfter.push({ t: 'api', path: 'owner/consult', body: { topic: c.topic, question: c.question, shareItems: c.shareItems, employeeIds: c.employeeIds, consent: true } });
    else if (!o.revokedAt && c.revokedAt) apiAfter.push({ t: 'rpc', name: 'revoke_consult', args: { p_id: c.id } });
  }

  // 순서: 사업장 → 직원 삭제 → 지우기(자식부터) → 넣기·고치기(부모부터) → 급여 확정/수정 → 그 밖의 API
  const order = (op: Op) => DELETE_ORDER.indexOf((op as { table: string }).table);
  deletes.sort((a, b) => order(a) - order(b));
  return { ops: [...ops, ...deletes, ...upserts, ...payOps, ...apiAfter], notes: [...new Set(notes)] };
}

// ───────────────────────── 직원 ─────────────────────────

export function planEmployee(prev: AppState, next: AppState, me: string): SyncPlan {
  const ops: Op[] = [];
  const notes: string[] = [];
  const pe = prev.employees.find((e) => e.id === me);
  const ne = next.employees.find((e) => e.id === me);
  if (!pe || !ne) return { ops, notes };

  if ((prev.settings.employeeLang[me] ?? 'ko') !== (next.settings.employeeLang[me] ?? 'ko')) ops.push({ t: 'rpc', name: 'set_my_lang', args: { p_employee_id: me, p_lang: next.settings.employeeLang[me] ?? 'ko' } });

  const hadAck = new Set(pe.conditionAcks.map((a) => `${a.conditionId}:${a.at}`));
  for (const a of ne.conditionAcks.filter((x) => !hadAck.has(`${x.conditionId}:${x.at}`))) ops.push({ t: 'rpc', name: 'ack_conditions', args: { p_condition_id: a.conditionId, p_status: a.status, p_memo: a.memo } });

  const active = (c: typeof pe.locationConsent) => !!c && !c.revokedAt;
  if (active(pe.locationConsent) !== active(ne.locationConsent)) ops.push({ t: 'rpc', name: 'set_location_consent', args: { p_employee_id: me, p_consent: active(ne.locationConsent) } });

  const prevN = new Map(prev.notifications.map((n) => [n.id, n]));
  for (const n of next.notifications) if (prevN.get(n.id) && !prevN.get(n.id)!.readAt && n.readAt) ops.push({ t: 'update', table: 'notifications', match: { id: n.id }, values: { read_at: n.readAt } });

  const prevSub = new Map(prev.substitutions.map((s) => [s.id, s]));
  for (const s of next.substitutions) {
    const o = prevSub.get(s.id);
    if (!o && s.fromEmployeeId === me && s.mode === 'request') ops.push({ t: 'rpc', name: 'request_substitution', args: { p_employee_id: me, p_date: s.date } });
    else if (o && o.status === 'open' && s.status === 'applied' && s.toEmployeeId === me) ops.push({ t: 'rpc', name: 'apply_substitution', args: { p_substitution_id: s.id, p_employee_id: me } });
  }

  const prevEdit = new Map(prev.attendanceEdits.map((x) => [x.id, x]));
  for (const x of next.attendanceEdits) {
    const o = prevEdit.get(x.id);
    if (o && !o.employeeResponse && x.employeeResponse) ops.push({ t: 'rpc', name: 'respond_attendance_edit', args: { p_edit_id: x.id, p_status: x.employeeResponse.status, p_memo: x.employeeResponse.memo } });
  }

  const prevAtt = new Map(prev.attendance.map((a) => [a.id, a]));
  for (const a of next.attendance.filter((x) => x.employeeId === me)) {
    const o = prevAtt.get(a.id);
    if (!o) {
      // 출근 — 시각은 서버가 정한다 (기기 시각은 받지 않음)
      ops.push({ t: 'api', path: 'employee/clock', body: { employeeId: me, kind: 'in', gps: a.gps === 'outside' ? 'outside' : 'inside' } });
      if (a.original.clockOut) ops.push({ t: 'api', path: 'employee/clock', body: { employeeId: me, kind: 'out', gps: a.gps === 'outside' ? 'outside' : 'inside' } });
    } else if (!o.original.clockOut && a.original.clockOut) {
      ops.push({ t: 'api', path: 'employee/clock', body: { employeeId: me, kind: 'out', gps: a.gps === 'outside' ? 'outside' : 'inside' } });
    } else if (o.status !== 'exception' && a.status === 'exception' && a.reason.startsWith('직원 이의')) {
      ops.push({ t: 'rpc', name: 'dispute_attendance', args: { p_record_id: a.id, p_memo: a.reason.replace(/^직원 이의:\s*/, '') } });
    }
  }

  const prevSt = new Map(prev.statements.map((s) => [s.id, s]));
  for (const s of next.statements) {
    const o = prevSt.get(s.id);
    if (!o) continue;
    if (!o.viewedAt && s.viewedAt) ops.push({ t: 'rpc', name: 'mark_statement_viewed', args: { p_delivery_id: s.id } });
    if (!o.disputed && s.disputed) ops.push({ t: 'rpc', name: 'dispute_statement', args: { p_delivery_id: s.id, p_memo: s.disputed.memo } });
  }

  const prevLeave = new Set(prev.leaveRequests.map((l) => l.id));
  for (const l of next.leaveRequests.filter((x) => !prevLeave.has(x.id) && x.employeeId === me)) ops.push({ t: 'rpc', name: 'request_leave', args: { p_employee_id: me, p_date: l.date, p_hours: l.hours } });

  if (pe.account === 'joined' && ne.account !== 'joined') ops.push({ t: 'rpc', name: 'leave_employee_app', args: { p_employee_id: me } });
  return { ops, notes };
}

// ───────────────────────── 노무법인 ─────────────────────────

export function planFirm(prev: AppState, next: AppState, ctx: SyncCtx): SyncPlan {
  const ops: Op[] = [];
  const notes: string[] = [];
  const prevC = new Map(prev.consults.map((c) => [c.id, c]));
  for (const c of next.consults) if (prevC.get(c.id) && prevC.get(c.id)!.status !== 'firm-read' && c.status === 'firm-read') ops.push({ t: 'rpc', name: 'firm_mark_consult_read', args: { p_id: c.id } });
  const prevR = new Map(prev.insuranceReports.map((r) => [`${r.employeeId}:${r.phase}`, r]));
  for (const r of next.insuranceReports) {
    if (r.status === 'firmDone' && prevR.get(`${r.employeeId}:${r.phase}`)?.status !== 'firmDone') ops.push({ t: 'rpc', name: 'firm_mark_insurance_done', args: { p_employee_id: r.employeeId, p_phase: r.phase } });
  }
  const prevRc = new Set(prev.reviewComments.map((c) => c.id));
  for (const c of next.reviewComments.filter((x) => !prevRc.has(x.id))) {
    if (!ctx.firmId) notes.push('소속 노무법인이 없어 의견을 저장하지 못했어요');
    else ops.push({ t: 'insert', table: 'review_comments', rows: [{ firm_id: ctx.firmId, author_id: ctx.userId, target: c.target, comment: c.comment }] });
  }
  return { ops, notes };
}

export function planFor(session: DemoSession, prev: AppState, next: AppState, ctx: SyncCtx): SyncPlan {
  if (session.role === 'owner') return planOwner(prev, next, ctx);
  if (session.role === 'employee' && session.employeeId) return planEmployee(prev, next, session.employeeId);
  if (session.role === 'firm') return planFirm(prev, next, ctx);
  return { ops: [], notes: [] };
}

/** 사업장 단위 표에는 workplace_id를 붙인다 */
export const WORKPLACE_SCOPED = new Set([
  'employees', 'employee_foreign_info', 'work_conditions', 'substitutions', 'shift_overrides', 'attendance_edits', 'leave_requests', 'payroll_months',
  'payroll_manual', 'insurance_reports', 'insurance_notices', 'doc_records', 'doc_requests', 'custom_forms', 'deadline_actions', 'risk_answers',
  'offboarding_progress', 'busy_days', 'notifications',
]);
