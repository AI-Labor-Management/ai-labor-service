import type { AppState } from './types';
import { isHHMM, isISODate } from './dates';

/** Shared boundary validation for backups and the development API; never repairs data silently. */
type Check = (value: unknown, path: string) => void;
export class StateValidationError extends Error {}
const fail = (p: string, expected: string): never => {
  throw new StateValidationError(`${p}: ${expected}`);
};
const str: Check = (v, p) => {
  if (typeof v !== 'string' || v.length > 30000) fail(p, '문자열 형식 또는 길이를 확인하세요');
};
const bool: Check = (v, p) => {
  if (typeof v !== 'boolean') fail(p, '참/거짓 값이 필요해요');
};
const num: Check = (v, p) => {
  if (typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) > 1e12) fail(p, '유효한 숫자가 필요해요');
};
const nonneg: Check = (v, p) => {
  num(v, p);
  if ((v as number) < 0) fail(p, '0 이상이어야 해요');
};
const integer: Check = (v, p) => {
  nonneg(v, p);
  if (!Number.isSafeInteger(v)) fail(p, '정수가 필요해요');
};
const date: Check = (v, p) => {
  if (typeof v !== 'string' || !isISODate(v)) fail(p, '올바른 YYYY-MM-DD 날짜가 필요해요');
};
const time: Check = (v, p) => {
  if (typeof v !== 'string' || !isHHMM(v)) fail(p, '올바른 HH:MM 시간이 필요해요');
};
const stamp: Check = (v, p) => {
  if (typeof v !== 'string' || !/^\d{4}-\d\d-\d\dT/.test(v) || !Number.isFinite(Date.parse(v)))
    fail(p, '올바른 저장 시각이 필요해요');
};
const month: Check = (v, p) => {
  if (typeof v !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(v)) fail(p, '올바른 YYYY-MM 월이 필요해요');
};
const one =
  (...values: unknown[]): Check =>
  (v, p) => {
    if (!values.includes(v)) fail(p, '지원하지 않는 값이에요');
  };
const nullable =
  (check: Check): Check =>
  (v, p) => {
    if (v !== null) check(v, p);
  };
const optional =
  (check: Check): Check =>
  (v, p) => {
    if (v !== undefined) check(v, p);
  };
const list =
  (check: Check): Check =>
  (v, p) => {
    if (!Array.isArray(v) || v.length > 20000) fail(p, '목록 형식 또는 항목 수를 확인하세요');
    (v as unknown[]).forEach((item, i) => check(item, `${p}[${i}]`));
  };
const obj =
  (fields: Record<string, Check>): Check =>
  (v, p) => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) fail(p, '객체가 필요해요');
    const record = v as Record<string, unknown>;
    for (const key of Object.keys(record))
      if (!(key in fields) || ['__proto__', 'constructor', 'prototype'].includes(key))
        fail(`${p}.${key}`, '알 수 없는 항목이에요');
    for (const [key, check] of Object.entries(fields)) check(record[key], `${p}.${key}`);
  };
const dict =
  (check: Check): Check =>
  (v, p) => {
    if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).length > 20000)
      fail(p, '객체 형식을 확인하세요');
    for (const [key, value] of Object.entries(v as object)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) fail(p, '지원하지 않는 키예요');
      check(value, `${p}.${key}`);
    }
  };
const scale = one('1-4', '5-9', '10+');
const industry = one('food', 'retail', 'service');
const insuranceMethod = one('self', 'delegated', 'alreadyDone', 'notYet');
const times = obj({ clockIn: nullable(time), clockOut: nullable(time) });
const period = obj({ from: date, to: date });
const ack = obj({
  conditionId: str,
  status: one('confirmed', 'disputed'),
  memo: str,
  at: stamp,
  resolvedAt: nullable(stamp),
});
const workplace = obj({
  name: str,
  industry,
  scale,
  familyOnly: bool,
  payDay: (v, p) => {
    integer(v, p);
    if ((v as number) < 1 || (v as number) > 31) fail(p, '1~31일이어야 해요');
  },
  payMonthBasis: one('previous', 'current'),
  gpsEnabled: bool,
  address: str,
  radiusM: nonneg,
  lateToleranceMin: nonneg,
  defaultInsuranceMethod: nullable(insuranceMethod),
  hourlyLeaveAllowed: bool,
  firmInsuranceShareConsent: bool,
  createdAt: stamp,
});
const employee = obj({
  id: str,
  alias: str,
  ageBand: one('under18', '18-59', '60-64', '65+'),
  birthDate: nullable(date),
  startedBefore65: nullable(bool),
  hireDate: date,
  employmentType: one('regular', 'fixed', 'daily'),
  contractEnd: nullable(date),
  probationEnd: nullable(date),
  foodHandler: bool,
  isForeign: bool,
  foreign: nullable(
    obj({
      visa: one('D-2', 'D-4', 'E-9', 'H-2', 'F-4', 'other'),
      expiry: nullable(date),
      permitted: nullable(bool),
      permitHours: nullable(nonneg),
      otherWorkplaceHours: nonneg,
      nationality: str,
      checkedAt: nullable(date),
    }),
  ),
  school: nullable(str),
  insuranceMethod,
  registeredAt: date,
  onboarding: one('new', 'existing-pending', 'existing-done'),
  resignDate: nullable(date),
  resignType: nullable(one('self', 'contractEnd', 'dismissal', 'other')),
  account: one('none', 'invited', 'joined', 'blocked'),
  invite: nullable(obj({ token: str, expiresAt: date, used: bool })),
  locationConsent: nullable(obj({ at: stamp, revokedAt: nullable(stamp) })),
  conditionAcks: list(ack),
  bonusAnnual: nonneg,
  leaveAllowanceAnnual: nonneg,
  createdAt: stamp,
});
const condition = obj({
  id: str,
  employeeId: str,
  effectiveFrom: date,
  hourlyWage: nonneg,
  schedule: (v, p) => {
    list(nullable(obj({ start: time, end: time, breakMin: nonneg })))(v, p);
    if ((v as unknown[]).length !== 7) fail(p, '월~일 7칸이 필요해요');
  },
  variable: bool,
  variableWeeklyHours: nullable(nonneg),
  weeklyHolidayDay: one(0, 1, 2, 3, 4, 5, 6),
  job: str,
  mealAllowance: nonneg,
  breakWaiverRequested: bool,
  reason: str,
  createdAt: stamp,
});
const payrollLine = obj({
  employeeId: str,
  alias: str,
  period,
  payDate: date,
  hours: obj({
    worked: nonneg,
    night: nonneg,
    overtime: nonneg,
    holidayWithin8: nonneg,
    holidayOver8: nonneg,
    partTimeOver: nonneg,
    paidLeave: nonneg,
    paidPublicHoliday: nonneg,
  }),
  workDays: nonneg,
  wageText: str,
  items: list(
    obj({ code: str, label: str, amount: num, formula: str, basis: list(str), note: optional(str) }),
  ),
  gross: num,
  taxFree: num,
  deductions: list(
    obj({
      code: one('pension', 'health', 'ltc', 'employment', 'incomeTax', 'localTax'),
      label: str,
      amount: nullable(num),
      source: one('notice', 'estimate', 'manual', 'dailyFormula', 'missing', 'excluded'),
      note: str,
    }),
  ),
  deductionTotal: num,
  net: num,
  netComplete: bool,
  warnings: list(obj({ level: one('risk', 'check', 'info'), text: str, basis: optional(list(str)) })),
  pendingDays: list(date),
  weeklyHolidayDetail: list(
    obj({
      weekStart: date,
      weekEnd: date,
      scheduledHours: nonneg,
      avg4w: nonneg,
      perfectAttendance: bool,
      eligible: bool,
      included: bool,
      hours: nonneg,
      amount: num,
      flags: list(str),
    }),
  ),
  ruleRefs: list(obj({ id: str, status: str, verifiedAt: optional(str) })),
});
const stateShape = obj({
  schemaVersion: one(1),
  workplace: nullable(workplace),
  employees: list(employee),
  conditions: list(condition),
  overrides: list(
    obj({
      id: str,
      employeeId: str,
      date,
      kind: one('change', 'extra', 'absent', 'leave', 'subOut', 'subIn'),
      start: nullable(time),
      end: nullable(time),
      breakMin: nonneg,
      memo: str,
      substitutionId: nullable(str),
      createdAt: stamp,
    }),
  ),
  attendance: list(
    obj({
      id: str,
      recordNo: str,
      employeeId: str,
      date,
      original: times,
      source: one('gps-demo', 'manual', 'owner'),
      gps: nullable(one('inside', 'outside', 'denied')),
      status: one('confirmed', 'pending', 'exception'),
      approval: nullable(one('actual', 'planned')),
      reason: str,
      createdAt: stamp,
      confirmedAt: nullable(stamp),
    }),
  ),
  attendanceEdits: list(
    obj({
      id: str,
      recordId: str,
      before: times,
      after: times,
      reason: str,
      by: one('owner'),
      at: stamp,
      employeeResponse: nullable(obj({ status: one('confirmed', 'disputed'), memo: str, at: stamp })),
    }),
  ),
  substitutions: list(
    obj({
      id: str,
      date,
      fromEmployeeId: str,
      toEmployeeId: nullable(str),
      mode: one('owner', 'request'),
      status: one('open', 'applied', 'approved', 'rejected', 'cancelled'),
      memo: str,
      createdAt: stamp,
      decidedAt: nullable(stamp),
    }),
  ),
  leaveRequests: list(
    obj({
      id: str,
      employeeId: str,
      date,
      hours: nullable(nonneg),
      status: one('requested', 'approved', 'adjust', 'cancelled'),
      adjustReason: str,
      requestedAt: stamp,
      decidedAt: nullable(stamp),
      by: one('employee', 'owner'),
    }),
  ),
  payrolls: list(
    obj({
      id: month,
      month,
      status: one('draft', 'confirmed'),
      scaleConfirmed: nullable(scale),
      manual: list(
        obj({
          employeeId: str,
          incomeTax: nullable(nonneg),
          localTax: nullable(nonneg),
          adjustments: list(obj({ label: str, amount: num })),
        }),
      ),
      confirmedAt: nullable(stamp),
      confirmedLines: nullable(list(payrollLine)),
      confirmedWithPending: list(date),
      revision: integer,
    }),
  ),
  payrollEdits: list(
    obj({
      id: str,
      payrollId: month,
      employeeId: str,
      field: str,
      before: str,
      after: str,
      reason: str,
      at: stamp,
    }),
  ),
  statements: list(
    obj({
      id: str,
      payrollId: month,
      employeeId: str,
      revision: integer,
      method: one('app', 'print'),
      deliveredAt: stamp,
      viewedAt: nullable(stamp),
      disputed: nullable(obj({ memo: str, at: stamp })),
    }),
  ),
  insuranceReports: list(
    obj({
      employeeId: str,
      phase: one('acquisition', 'loss'),
      status: one('none', 'reported', 'handedOver', 'firmDone', 'confirmed'),
      date: nullable(date),
      by: nullable(one('owner', 'firm')),
    }),
  ),
  insuranceNotices: list(
    obj({
      id: str,
      employeeId: str,
      fromMonth: month,
      amounts: obj({
        pension: optional(nonneg),
        health: optional(nonneg),
        ltc: optional(nonneg),
        employment: optional(nonneg),
      }),
      enteredAt: stamp,
    }),
  ),
  docRecords: list(
    obj({
      id: str,
      key: str,
      itemId: str,
      employeeId: nullable(str),
      status: one('done', 'na', 'stored'),
      doneAt: nullable(date),
      naReason: str,
      expiry: nullable(date),
      examDate: nullable(date),
      location: str,
      bulk: bool,
      updatedAt: stamp,
    }),
  ),
  docRequests: list(
    obj({
      id: str,
      employeeId: str,
      itemId: nullable(str),
      customName: str,
      status: one('requested', 'received', 'needsFix'),
      requestedAt: date,
      dueDate: date,
      receivedAt: nullable(date),
      fixReason: str,
      expiry: nullable(date),
      location: str,
      history: list(obj({ status: one('requested', 'received', 'needsFix'), at: date, memo: str })),
    }),
  ),
  customForms: list(
    obj({
      id: str,
      name: str,
      url: (v, p) => {
        str(v, p);
        try {
          if (!['https:', 'http:'].includes(new URL(v as string).protocol)) fail(p, '웹 링크가 필요해요');
        } catch {
          fail(p, '올바른 웹 링크가 필요해요');
        }
      },
    }),
  ),
  deadlineActions: list(
    obj({
      key: str,
      action: one('done', 'pastConfirmed', 'renewed', 'ended', 'unknown'),
      at: stamp,
      date,
      note: str,
    }),
  ),
  riskAnswers: list(
    obj({ questionId: str, answer: one('yes', 'no', 'unknown'), answeredAt: date, scaleAtAnswer: scale }),
  ),
  offboarding: list(
    obj({ employeeId: str, steps: dict(bool), startedAt: stamp, completedAt: nullable(stamp) }),
  ),
  consults: list(
    obj({
      id: str,
      topic: str,
      question: str,
      memo: str,
      shareItems: list(one('memo', 'workplace', 'conditions', 'attendance')),
      employeeIds: list(str),
      snapshot: nullable(
        obj({
          workplace: optional(obj({ industry, scale })),
          conditions: optional(list(obj({ alias: str, text: str }))),
          attendance: optional(list(obj({ alias: str, lines: list(str) }))),
        }),
      ),
      consentAt: stamp,
      revokedAt: nullable(stamp),
      status: one('demo-delivered', 'firm-read', 'revoked'),
      createdAt: stamp,
    }),
  ),
  guestConsults: list(
    obj({
      id: str,
      nickname: str,
      phoneMasked: str,
      phoneKey: str,
      contactTime: str,
      topic: str,
      summary: str,
      consents: obj({ collect: stamp, provide: stamp }),
      createdAt: stamp,
      mode: one('demo'),
    }),
  ),
  reviewComments: list(obj({ id: str, target: str, comment: str, at: stamp })),
  notifications: list(
    obj({
      id: str,
      to: str,
      kind: str,
      text: str,
      link: str,
      createdAt: stamp,
      readAt: nullable(stamp),
      channels: obj({ inApp: one('delivered'), kakao: one('not-connected', 'not-sent') }),
    }),
  ),
  busyDays: list(obj({ id: str, date, memo: str })),
  settings: obj({
    baseDateOverride: nullable(date),
    kakaoBannerDismissed: bool,
    employeeLang: dict(one('ko', 'en')),
  }),
  seq: integer,
});

export function validateAppState(raw: unknown): AppState {
  stateShape(raw, '데이터');
  const s = raw as AppState;
  const employees = new Set(s.employees.map((e) => e.id));
  const records = new Set(s.attendance.map((a) => a.id));
  const payrolls = new Set(s.payrolls.map((p) => p.id));
  for (const [key, value] of Object.entries(s)) {
    if (!Array.isArray(value)) continue;
    const ids = new Set<string>();
    for (const row of value as Record<string, unknown>[]) {
      if (typeof row.id === 'string') {
        if (!row.id || ids.has(row.id)) fail(key, '중복되거나 빈 ID가 있어요');
        ids.add(row.id);
      }
      if (typeof row.employeeId === 'string' && !employees.has(row.employeeId))
        fail(key, '존재하지 않는 직원 연결이에요');
    }
  }
  for (const edit of s.attendanceEdits)
    if (!records.has(edit.recordId)) fail('attendanceEdits', '원본 기록이 없어요');
  for (const employee of s.employees) {
    const mine = s.conditions.filter((c) => c.employeeId === employee.id);
    if (!mine.length) fail('conditions', '직원의 최초 근로조건이 없어요');
    if (employee.conditionAcks.some((a) => !mine.some((c) => c.id === a.conditionId)))
      fail('conditionAcks', '근로조건 연결을 확인하세요');
  }
  for (const sub of s.substitutions)
    if (!employees.has(sub.fromEmployeeId) || (sub.toEmployeeId && !employees.has(sub.toEmployeeId)))
      fail('substitutions', '직원 연결을 확인하세요');
  for (const p of s.payrolls) {
    for (const line of [...p.manual, ...(p.confirmedLines ?? [])])
      if (!employees.has(line.employeeId)) fail('payrolls', '직원 연결을 확인하세요');
    if (p.status === 'confirmed' && (!p.confirmedAt || !p.confirmedLines))
      fail('payrolls', '확정 급여의 원본이 없어요');
  }
  for (const d of [...s.statements, ...s.payrollEdits])
    if (!payrolls.has(d.payrollId)) fail('payroll', '급여 연결을 확인하세요');
  if (!s.workplace && s.employees.length) fail('workplace', '직원과 연결된 사업장이 없어요');
  return s;
}
