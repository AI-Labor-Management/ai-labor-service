// DB 행(snake_case, 정규화) ↔ 계산 엔진 상태(AppState, camelCase) 변환. 런타임 의존성 없음 — Deno·Vitest 둘 다에서 쓴다.
import type { Database, Json } from './database.types.ts';
import type {
  AppState,
  ConsultRequest,
  DaySchedule,
  Employee,
  Industry,
  InsuranceMethod,
  PayMonthBasis,
  ScaleBand,
  PayrollLine,
  PayrollMonth,
  WorkCondition,
} from './domain-types.ts';

type Tables = Database['public']['Tables'];
export type Row<K extends keyof Tables> = Tables[K]['Row'];
export type Insert<K extends keyof Tables> = Tables[K]['Insert'];

/** 한 사업장의 데이터를 한 번에 읽어 온 결과 */
export interface WorkplaceRows {
  workplace: Row<'workplaces'>;
  busy_days: Row<'busy_days'>[];
  employees: Row<'employees'>[];
  employee_foreign_info: Row<'employee_foreign_info'>[];
  work_conditions: Row<'work_conditions'>[];
  condition_acks: Row<'condition_acks'>[];
  invites: Row<'invites'>[];
  shift_overrides: Row<'shift_overrides'>[];
  attendance_records: Row<'attendance_records'>[];
  attendance_edits: Row<'attendance_edits'>[];
  substitutions: Row<'substitutions'>[];
  leave_requests: Row<'leave_requests'>[];
  payroll_months: Row<'payroll_months'>[];
  payroll_manual: Row<'payroll_manual'>[];
  payroll_lines: Row<'payroll_lines'>[];
  payroll_edits: Row<'payroll_edits'>[];
  statement_deliveries: Row<'statement_deliveries'>[];
  insurance_reports: Row<'insurance_reports'>[];
  insurance_notices: Row<'insurance_notices'>[];
  doc_records: Row<'doc_records'>[];
  doc_requests: Row<'doc_requests'>[];
  custom_forms: Row<'custom_forms'>[];
  deadline_actions: Row<'deadline_actions'>[];
  risk_answers: Row<'risk_answers'>[];
  offboarding_progress: Row<'offboarding_progress'>[];
  consult_requests: Row<'consult_requests'>[];
  notifications: Row<'notifications'>[];
}

/** 사업장 단위로 읽는 테이블 목록 (workplaces 제외) */
export const WORKPLACE_TABLES = [
  'busy_days', 'employees', 'employee_foreign_info', 'work_conditions', 'condition_acks', 'invites', 'shift_overrides',
  'attendance_records', 'attendance_edits', 'substitutions', 'leave_requests', 'payroll_months', 'payroll_manual',
  'payroll_lines', 'payroll_edits', 'statement_deliveries', 'insurance_reports', 'insurance_notices', 'doc_records',
  'doc_requests', 'custom_forms', 'deadline_actions', 'risk_answers', 'offboarding_progress', 'consult_requests', 'notifications',
] as const satisfies readonly (keyof WorkplaceRows)[];

const num = (v: number | string | null | undefined): number | null => (v === null || v === undefined ? null : Number(v));
const asSchedule = (v: Json): (DaySchedule | null)[] => (Array.isArray(v) ? (v as unknown as (DaySchedule | null)[]) : [null, null, null, null, null, null, null]);

/** 같은 직원·급여월의 확정 줄 중 가장 최신 revision만 */
function latestLines(lines: Row<'payroll_lines'>[], payrollId: string): PayrollLine[] {
  const byEmp = new Map<string, Row<'payroll_lines'>>();
  for (const l of lines.filter((x) => x.payroll_id === payrollId)) {
    const prev = byEmp.get(l.employee_id);
    if (!prev || l.revision > prev.revision) byEmp.set(l.employee_id, l);
  }
  return [...byEmp.values()].map((l) => l.line as unknown as PayrollLine);
}

export function rowsToState(r: WorkplaceRows): AppState {
  const w = r.workplace;
  const monthOfPayroll = new Map(r.payroll_months.map((p) => [p.id, p.month]));

  const employees: Employee[] = r.employees.map((e) => {
    const f = r.employee_foreign_info.find((x) => x.employee_id === e.id);
    const inv = r.invites.filter((i) => i.employee_id === e.id && !i.used_at).sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
    return {
      id: e.id,
      alias: e.alias,
      ageBand: e.age_band as Employee['ageBand'],
      birthDate: e.birth_date,
      startedBefore65: e.started_before_65,
      hireDate: e.hire_date,
      employmentType: e.employment_type as Employee['employmentType'],
      contractEnd: e.contract_end,
      probationEnd: e.probation_end,
      foodHandler: e.food_handler,
      isForeign: e.is_foreign,
      foreign: f
        ? { visa: f.visa as NonNullable<Employee['foreign']>['visa'], expiry: f.expiry, permitted: f.permitted, permitHours: num(f.permit_hours), otherWorkplaceHours: num(f.other_workplace_hours) ?? 0, nationality: f.nationality, checkedAt: f.checked_at }
        : null,
      school: e.school,
      insuranceMethod: e.insurance_method as Employee['insuranceMethod'],
      registeredAt: e.registered_at,
      onboarding: e.onboarding as Employee['onboarding'],
      resignDate: e.resign_date,
      resignType: e.resign_type as Employee['resignType'],
      account: e.account_status as Employee['account'],
      // 토큰 원문은 저장하지 않으므로 상태만 전달
      invite: inv ? { token: '', expiresAt: inv.expires_at, used: false } : null,
      locationConsent: e.location_consent_at ? { at: e.location_consent_at, revokedAt: e.location_consent_revoked_at } : null,
      conditionAcks: r.condition_acks
        .filter((a) => a.employee_id === e.id)
        .map((a) => ({ conditionId: a.condition_id, status: a.status as 'confirmed' | 'disputed', memo: a.memo, at: a.at, resolvedAt: a.resolved_at })),
      bonusAnnual: e.bonus_annual,
      leaveAllowanceAnnual: e.leave_allowance_annual,
      createdAt: e.created_at,
    };
  });

  const conditions: WorkCondition[] = r.work_conditions.map((c) => ({
    id: c.id,
    employeeId: c.employee_id,
    effectiveFrom: c.effective_from,
    hourlyWage: c.hourly_wage,
    schedule: asSchedule(c.schedule),
    variable: c.variable,
    variableWeeklyHours: num(c.variable_weekly_hours),
    weeklyHolidayDay: c.weekly_holiday_day as WorkCondition['weeklyHolidayDay'],
    job: c.job,
    mealAllowance: c.meal_allowance,
    breakWaiverRequested: c.break_waiver_requested,
    reason: c.reason,
    createdAt: c.created_at,
  }));

  const payrolls: PayrollMonth[] = r.payroll_months.map((p) => ({
    id: p.month, // 계산 엔진은 급여월 문자열을 id로 쓴다
    month: p.month,
    status: p.status as PayrollMonth['status'],
    scaleConfirmed: p.scale_confirmed as PayrollMonth['scaleConfirmed'],
    manual: r.payroll_manual
      .filter((m) => m.payroll_id === p.id)
      .map((m) => ({ employeeId: m.employee_id, incomeTax: m.income_tax, localTax: m.local_tax, adjustments: (m.adjustments as unknown as { label: string; amount: number }[]) ?? [] })),
    confirmedAt: p.confirmed_at,
    confirmedLines: p.status === 'confirmed' ? latestLines(r.payroll_lines, p.id) : null,
    confirmedWithPending: p.confirmed_with_pending ?? [],
    revision: p.revision,
  }));

  // 명세서 교부: 직원·급여월별 최신 revision만
  const latestDelivery = new Map<string, Row<'statement_deliveries'>>();
  for (const s of r.statement_deliveries) {
    const k = `${s.payroll_id}:${s.employee_id}`;
    const prev = latestDelivery.get(k);
    if (!prev || s.revision > prev.revision) latestDelivery.set(k, s);
  }

  return {
    schemaVersion: 1,
    workplace: {
      name: w.name,
      industry: w.industry as Industry,
      scale: w.scale as ScaleBand,
      familyOnly: w.family_only,
      payDay: w.pay_day,
      payMonthBasis: w.pay_month_basis as PayMonthBasis,
      gpsEnabled: w.gps_enabled,
      address: w.address,
      radiusM: w.radius_m,
      lateToleranceMin: w.late_tolerance_min,
      defaultInsuranceMethod: w.default_insurance_method as InsuranceMethod | null,
      hourlyLeaveAllowed: w.hourly_leave_allowed,
      firmInsuranceShareConsent: w.firm_insurance_share_consent,
      createdAt: w.created_at,
    },
    employees,
    conditions,
    overrides: r.shift_overrides.map((o) => ({
      id: o.id,
      employeeId: o.employee_id,
      date: o.date,
      kind: o.kind as AppState['overrides'][number]['kind'],
      start: o.start_time,
      end: o.end_time,
      breakMin: o.break_min,
      memo: o.memo,
      substitutionId: o.substitution_id,
      createdAt: o.created_at,
    })),
    attendance: r.attendance_records.map((a) => ({
      id: a.id,
      recordNo: a.record_no,
      employeeId: a.employee_id,
      date: a.date,
      original: { clockIn: a.original_clock_in, clockOut: a.original_clock_out },
      source: (a.source === 'gps' ? 'gps-demo' : a.source) as AppState['attendance'][number]['source'],
      gps: a.gps as AppState['attendance'][number]['gps'],
      status: a.status as AppState['attendance'][number]['status'],
      approval: a.approval as AppState['attendance'][number]['approval'],
      reason: a.reason,
      createdAt: a.created_at,
      confirmedAt: a.confirmed_at,
    })),
    attendanceEdits: r.attendance_edits.map((x) => ({
      id: x.id,
      recordId: x.record_id,
      before: { clockIn: x.before_in, clockOut: x.before_out },
      after: { clockIn: x.after_in, clockOut: x.after_out },
      reason: x.reason,
      by: 'owner' as const,
      at: x.at,
      employeeResponse: x.employee_response_status
        ? { status: x.employee_response_status as 'confirmed' | 'disputed', memo: x.employee_response_memo, at: x.employee_response_at ?? x.at }
        : null,
    })),
    substitutions: r.substitutions.map((s) => ({
      id: s.id,
      date: s.date,
      fromEmployeeId: s.from_employee_id,
      toEmployeeId: s.to_employee_id,
      mode: s.mode as 'owner' | 'request',
      status: s.status as AppState['substitutions'][number]['status'],
      memo: s.memo,
      createdAt: s.created_at,
      decidedAt: s.decided_at,
    })),
    leaveRequests: r.leave_requests.map((l) => ({
      id: l.id,
      employeeId: l.employee_id,
      date: l.date,
      hours: num(l.hours),
      status: l.status as AppState['leaveRequests'][number]['status'],
      adjustReason: l.adjust_reason,
      requestedAt: l.requested_at,
      decidedAt: l.decided_at,
      by: l.requested_by as 'employee' | 'owner',
    })),
    payrolls,
    payrollEdits: r.payroll_edits.map((x) => ({
      id: x.id,
      payrollId: monthOfPayroll.get(x.payroll_id) ?? x.payroll_id,
      employeeId: x.employee_id,
      field: x.field,
      before: x.before_value,
      after: x.after_value,
      reason: x.reason,
      at: x.at,
    })),
    statements: [...latestDelivery.values()].map((s) => ({
      id: s.id,
      payrollId: monthOfPayroll.get(s.payroll_id) ?? s.payroll_id,
      employeeId: s.employee_id,
      revision: s.revision,
      method: s.method as 'app' | 'print',
      deliveredAt: s.delivered_at,
      viewedAt: s.viewed_at,
      disputed: s.disputed_memo ? { memo: s.disputed_memo, at: s.disputed_at ?? s.delivered_at } : null,
    })),
    insuranceReports: r.insurance_reports.map((x) => ({
      employeeId: x.employee_id,
      phase: x.phase as 'acquisition' | 'loss',
      status: x.status as AppState['insuranceReports'][number]['status'],
      date: x.date,
      by: x.by_role as 'owner' | 'firm' | null,
    })),
    insuranceNotices: r.insurance_notices.map((n) => ({
      id: n.id,
      employeeId: n.employee_id,
      fromMonth: n.from_month,
      amounts: n.amounts as AppState['insuranceNotices'][number]['amounts'],
      enteredAt: n.entered_at,
    })),
    docRecords: r.doc_records.map((d) => ({
      id: d.id,
      key: d.key,
      itemId: d.item_id,
      employeeId: d.employee_id,
      status: d.status as AppState['docRecords'][number]['status'],
      doneAt: d.done_at,
      naReason: d.na_reason,
      expiry: d.expiry,
      examDate: d.exam_date,
      location: d.location,
      bulk: d.bulk,
      updatedAt: d.updated_at,
    })),
    docRequests: r.doc_requests.map((d) => ({
      id: d.id,
      employeeId: d.employee_id,
      itemId: d.item_id,
      customName: d.custom_name,
      status: d.status as AppState['docRequests'][number]['status'],
      requestedAt: d.requested_at,
      dueDate: d.due_date,
      receivedAt: d.received_at,
      fixReason: d.fix_reason,
      expiry: d.expiry,
      location: d.location,
      history: (d.history as unknown as AppState['docRequests'][number]['history']) ?? [],
    })),
    customForms: r.custom_forms.map((c) => ({ id: c.id, name: c.name, url: c.url })),
    deadlineActions: r.deadline_actions.map((a) => ({ key: a.key, action: a.action as AppState['deadlineActions'][number]['action'], at: a.at, date: a.date, note: a.note })),
    riskAnswers: r.risk_answers.map((a) => ({ questionId: a.question_id, answer: a.answer as 'yes' | 'no' | 'unknown', answeredAt: a.answered_at, scaleAtAnswer: a.scale_at_answer as ScaleBand })),
    offboarding: r.offboarding_progress.map((o) => ({ employeeId: o.employee_id, steps: (o.steps as Record<string, boolean>) ?? {}, startedAt: o.started_at, completedAt: o.completed_at })),
    consults: r.consult_requests.map((c) => ({
      id: c.id,
      topic: c.topic,
      question: c.question,
      memo: c.memo,
      shareItems: c.share_items as ConsultRequest['shareItems'],
      employeeIds: c.employee_ids,
      snapshot: c.snapshot as ConsultRequest['snapshot'],
      consentAt: c.consent_at,
      revokedAt: c.revoked_at,
      // DB의 'delivered'(실제 저장)를 프론트엔드 타입의 'demo-delivered' 자리에 맞춘다
      status: (c.status === 'delivered' ? 'demo-delivered' : c.status) as ConsultRequest['status'],
      createdAt: c.created_at,
    })),
    guestConsults: [],
    reviewComments: [],
    notifications: r.notifications.map((n) => ({
      id: n.id,
      to: n.recipient === 'owner' ? 'owner' : (n.employee_id as string),
      kind: n.kind,
      text: n.text,
      link: n.link,
      createdAt: n.created_at,
      readAt: n.read_at,
      channels: { inApp: 'delivered' as const, kakao: (n.kakao_status === 'not-sent' ? 'not-sent' : 'not-connected') as 'not-connected' | 'not-sent' },
    })),
    busyDays: r.busy_days.map((b) => ({ id: b.id, date: b.date, memo: b.memo })),
    settings: {
      baseDateOverride: w.base_date_override,
      kakaoBannerDismissed: w.kakao_banner_dismissed,
      employeeLang: Object.fromEntries(r.employees.map((e) => [e.id, e.lang as 'ko' | 'en'])),
    },
    seq: w.seq,
  };
}

// ───────────────────────── 상태 → 행 (가상 시드 넣기용) ─────────────────────────

export interface InsertPlan {
  workplace: Insert<'workplaces'>;
  rows: { [K in Exclude<(typeof WORKPLACE_TABLES)[number], 'invites' | 'notifications' | 'consult_requests'>]?: Insert<K>[] } & {
    notifications?: Insert<'notifications'>[];
  };
}

/** 시드의 문자열 id('emp-a' 등)를 uuid로 바꾸고, id가 들어간 키('E1:emp-a:cond-a1')도 함께 바꾼다 */
export function remapKey(key: string, ids: Map<string, string>): string {
  return key
    .split(':')
    .map((part) => ids.get(part) ?? part)
    .join(':');
}

export function stateToInsertPlan(s: AppState, ownerId: string, newId: () => string): InsertPlan {
  if (!s.workplace) throw new Error('사업장 정보가 없어요');
  const ids = new Map<string, string>();
  const id = (old: string) => {
    if (!ids.has(old)) ids.set(old, newId());
    return ids.get(old)!;
  };
  const wpId = newId();
  const wp = s.workplace;
  const plan: InsertPlan = {
    workplace: {
      id: wpId,
      owner_id: ownerId,
      name: wp.name,
      industry: wp.industry,
      scale: wp.scale,
      family_only: wp.familyOnly,
      pay_day: wp.payDay,
      pay_month_basis: wp.payMonthBasis,
      gps_enabled: wp.gpsEnabled,
      address: wp.gpsEnabled ? wp.address : '',
      radius_m: wp.radiusM,
      late_tolerance_min: wp.lateToleranceMin,
      default_insurance_method: wp.defaultInsuranceMethod,
      hourly_leave_allowed: wp.hourlyLeaveAllowed,
      firm_insurance_share_consent: wp.firmInsuranceShareConsent,
      base_date_override: s.settings.baseDateOverride,
      kakao_banner_dismissed: s.settings.kakaoBannerDismissed,
      seq: s.seq,
    },
    rows: {},
  };
  // 먼저 모든 직원·조건·대타·기록 id를 발급해 키 치환이 가능하게 한다
  s.employees.forEach((e) => id(e.id));
  s.conditions.forEach((c) => id(c.id));
  s.substitutions.forEach((x) => id(x.id));
  s.attendance.forEach((a) => id(a.id));

  plan.rows.employees = s.employees.map((e) => ({
    id: id(e.id),
    workplace_id: wpId,
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
    // 시드의 "가입함"은 실제 계정이 없으므로 'none'으로 넣는다 (초대 링크로 연결)
    account_status: e.account === 'blocked' ? 'blocked' : 'none',
    bonus_annual: e.bonusAnnual,
    leave_allowance_annual: e.leaveAllowanceAnnual,
    lang: s.settings.employeeLang[e.id] ?? 'ko',
  }));
  plan.rows.employee_foreign_info = s.employees
    .filter((e) => e.isForeign && e.foreign)
    .map((e) => ({
      employee_id: id(e.id),
      workplace_id: wpId,
      visa: e.foreign!.visa,
      expiry: e.foreign!.expiry,
      permitted: e.foreign!.permitted,
      permit_hours: e.foreign!.permitHours,
      other_workplace_hours: e.foreign!.otherWorkplaceHours,
      nationality: e.foreign!.nationality,
      checked_at: e.foreign!.checkedAt,
    }));
  plan.rows.work_conditions = s.conditions.map((c) => ({
    id: id(c.id),
    workplace_id: wpId,
    employee_id: id(c.employeeId),
    effective_from: c.effectiveFrom,
    hourly_wage: c.hourlyWage,
    schedule: c.schedule as unknown as Json,
    variable: c.variable,
    variable_weekly_hours: c.variableWeeklyHours,
    weekly_holiday_day: c.weeklyHolidayDay,
    job: c.job,
    meal_allowance: c.mealAllowance,
    break_waiver_requested: c.breakWaiverRequested,
    reason: c.reason,
    created_at: c.createdAt,
  }));
  plan.rows.condition_acks = s.employees.flatMap((e) =>
    e.conditionAcks.map((a) => ({ workplace_id: wpId, employee_id: id(e.id), condition_id: id(a.conditionId), status: a.status, memo: a.memo, at: a.at, resolved_at: a.resolvedAt })),
  );
  plan.rows.substitutions = s.substitutions.map((x) => ({
    id: id(x.id),
    workplace_id: wpId,
    date: x.date,
    from_employee_id: id(x.fromEmployeeId),
    to_employee_id: x.toEmployeeId ? id(x.toEmployeeId) : null,
    mode: x.mode,
    status: x.status,
    memo: x.memo,
    created_at: x.createdAt,
    decided_at: x.decidedAt,
  }));
  plan.rows.shift_overrides = s.overrides.map((o) => ({
    workplace_id: wpId,
    employee_id: id(o.employeeId),
    date: o.date,
    kind: o.kind,
    start_time: o.start,
    end_time: o.end,
    break_min: o.breakMin,
    memo: o.memo,
    substitution_id: o.substitutionId ? id(o.substitutionId) : null,
    created_at: o.createdAt,
  }));
  plan.rows.attendance_records = s.attendance.map((a) => ({
    id: id(a.id),
    workplace_id: wpId,
    employee_id: id(a.employeeId),
    record_no: a.recordNo,
    date: a.date,
    original_clock_in: a.original.clockIn,
    original_clock_out: a.original.clockOut,
    source: a.source,
    gps: a.gps,
    status: a.status,
    approval: a.approval,
    reason: a.reason,
    created_at: a.createdAt,
    confirmed_at: a.confirmedAt,
  }));
  plan.rows.attendance_edits = s.attendanceEdits.map((x) => ({
    workplace_id: wpId,
    record_id: id(x.recordId),
    before_in: x.before.clockIn,
    before_out: x.before.clockOut,
    after_in: x.after.clockIn,
    after_out: x.after.clockOut,
    reason: x.reason,
    by_user: ownerId,
    at: x.at,
    employee_response_status: x.employeeResponse?.status ?? null,
    employee_response_memo: x.employeeResponse?.memo ?? '',
    employee_response_at: x.employeeResponse?.at ?? null,
  }));
  plan.rows.leave_requests = s.leaveRequests.map((l) => ({
    workplace_id: wpId,
    employee_id: id(l.employeeId),
    date: l.date,
    hours: l.hours,
    status: l.status,
    adjust_reason: l.adjustReason,
    requested_at: l.requestedAt,
    decided_at: l.decidedAt,
    requested_by: l.by,
  }));
  // 급여: 급여월 행 → 확정 줄(직원 id를 줄 JSON 안에서도 바꿈) → 교부 기록
  const payrollIds = new Map<string, string>();
  plan.rows.payroll_months = s.payrolls.map((p) => {
    const pid = newId();
    payrollIds.set(p.id, pid);
    return {
      id: pid,
      workplace_id: wpId,
      month: p.month,
      status: p.status,
      scale_confirmed: p.scaleConfirmed,
      confirmed_at: p.confirmedAt,
      confirmed_with_pending: p.confirmedWithPending,
      revision: p.revision,
    };
  });
  plan.rows.payroll_manual = s.payrolls.flatMap((p) =>
    p.manual.map((m) => ({ payroll_id: payrollIds.get(p.id)!, workplace_id: wpId, employee_id: id(m.employeeId), income_tax: m.incomeTax, local_tax: m.localTax, adjustments: m.adjustments as unknown as Json })),
  );
  plan.rows.payroll_lines = s.payrolls.flatMap((p) =>
    (p.confirmedLines ?? []).map((l) => {
      const line: PayrollLine = { ...l, employeeId: id(l.employeeId) };
      return {
        payroll_id: payrollIds.get(p.id)!,
        workplace_id: wpId,
        employee_id: line.employeeId,
        revision: Math.max(1, p.revision),
        line: line as unknown as Json,
        gross: line.gross,
        deduction_total: line.deductionTotal,
        net: line.net,
        net_complete: line.netComplete,
      };
    }),
  );
  plan.rows.payroll_edits = s.payrollEdits.map((x) => ({
    payroll_id: payrollIds.get(x.payrollId)!,
    workplace_id: wpId,
    employee_id: id(x.employeeId),
    field: x.field,
    before_value: x.before,
    after_value: x.after,
    reason: x.reason,
    at: x.at,
  }));
  plan.rows.statement_deliveries = s.statements
    .filter((x) => payrollIds.has(x.payrollId))
    .map((x) => ({
      payroll_id: payrollIds.get(x.payrollId)!,
      workplace_id: wpId,
      employee_id: id(x.employeeId),
      revision: x.revision,
      method: x.method,
      delivered_at: x.deliveredAt,
      viewed_at: x.viewedAt,
      disputed_memo: x.disputed?.memo ?? null,
      disputed_at: x.disputed?.at ?? null,
    }));
  plan.rows.insurance_reports = s.insuranceReports.map((x) => ({ workplace_id: wpId, employee_id: id(x.employeeId), phase: x.phase, status: x.status, date: x.date, by_role: x.by }));
  plan.rows.insurance_notices = s.insuranceNotices.map((n) => ({ workplace_id: wpId, employee_id: id(n.employeeId), from_month: n.fromMonth, amounts: n.amounts as unknown as Json, entered_at: n.enteredAt }));
  plan.rows.doc_records = s.docRecords.map((d) => ({
    workplace_id: wpId,
    key: remapKey(d.key, ids),
    item_id: d.itemId,
    employee_id: d.employeeId ? id(d.employeeId) : null,
    status: d.status,
    done_at: d.doneAt,
    na_reason: d.naReason,
    expiry: d.expiry,
    exam_date: d.examDate,
    location: d.location,
    bulk: d.bulk,
  }));
  plan.rows.doc_requests = s.docRequests.map((d) => ({
    workplace_id: wpId,
    employee_id: id(d.employeeId),
    item_id: d.itemId,
    custom_name: d.customName,
    status: d.status,
    requested_at: d.requestedAt,
    due_date: d.dueDate,
    received_at: d.receivedAt,
    fix_reason: d.fixReason,
    expiry: d.expiry,
    location: d.location,
    history: d.history as unknown as Json,
  }));
  plan.rows.custom_forms = s.customForms.map((c) => ({ workplace_id: wpId, name: c.name, url: c.url }));
  plan.rows.deadline_actions = s.deadlineActions.map((a) => ({ workplace_id: wpId, key: remapKey(a.key, ids), action: a.action, at: a.at, date: a.date, note: a.note }));
  plan.rows.risk_answers = s.riskAnswers.map((a) => ({ workplace_id: wpId, question_id: a.questionId, answer: a.answer, answered_at: a.answeredAt, scale_at_answer: a.scaleAtAnswer }));
  plan.rows.offboarding_progress = s.offboarding.map((o) => ({ employee_id: id(o.employeeId), workplace_id: wpId, steps: o.steps as unknown as Json, started_at: o.startedAt, completed_at: o.completedAt }));
  plan.rows.busy_days = s.busyDays.map((b) => ({ workplace_id: wpId, date: b.date, memo: b.memo }));
  plan.rows.notifications = s.notifications
    .filter((n) => n.to === 'owner')
    .map((n) => ({ workplace_id: wpId, recipient: 'owner', employee_id: null, kind: n.kind, text: n.text, link: n.link.replace(/emp-[a-z]/g, (m) => ids.get(m) ?? m), created_at: n.createdAt, read_at: n.readAt }));
  return plan;
}

/** 넣는 순서 (외래키 의존 순) */
export const INSERT_ORDER = [
  'employees', 'employee_foreign_info', 'work_conditions', 'condition_acks', 'substitutions', 'shift_overrides', 'attendance_records',
  'attendance_edits', 'leave_requests', 'payroll_months', 'payroll_manual', 'payroll_lines', 'payroll_edits', 'statement_deliveries',
  'insurance_reports', 'insurance_notices', 'doc_records', 'doc_requests', 'custom_forms', 'deadline_actions', 'risk_answers',
  'offboarding_progress', 'busy_days', 'notifications',
] as const;
