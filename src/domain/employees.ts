import type { AppState, ISODate } from './types';

export function resolveInvite(state: AppState, token: string, base: ISODate) {
  const employee = state.employees.find((e) => e.invite?.token === token);
  if (!employee) return { status: 'missing' as const, employee: null };
  if (employee.account === 'blocked') return { status: 'blocked' as const, employee: null };
  if (employee.invite!.used) return { status: 'used' as const, employee: null };
  if (employee.invite!.expiresAt < base) return { status: 'expired' as const, employee: null };
  return { status: 'valid' as const, employee };
}

/** Registration cancellation only. Confirmed payroll is retained, even if called outside the UI. */
export function removeUnconfirmedEmployee(d: AppState, id: string) {
  if (d.payrolls.some((p) => p.confirmedLines?.some((l) => l.employeeId === id)))
    throw new Error('확정 급여가 있는 직원은 등록 취소할 수 없어요. 퇴사 처리를 이용하세요.');
  const recordIds = new Set(d.attendance.filter((a) => a.employeeId === id).map((a) => a.id));
  const subIds = new Set(
    d.substitutions.filter((s) => s.fromEmployeeId === id || s.toEmployeeId === id).map((s) => s.id),
  );
  d.employees = d.employees.filter((e) => e.id !== id);
  d.conditions = d.conditions.filter((c) => c.employeeId !== id);
  d.overrides = d.overrides.filter(
    (o) => o.employeeId !== id && (!o.substitutionId || !subIds.has(o.substitutionId)),
  );
  d.attendance = d.attendance.filter((a) => a.employeeId !== id);
  d.attendanceEdits = d.attendanceEdits.filter((e) => !recordIds.has(e.recordId));
  d.substitutions = d.substitutions.filter((s) => !subIds.has(s.id));
  d.leaveRequests = d.leaveRequests.filter((r) => r.employeeId !== id);
  d.statements = d.statements.filter((r) => r.employeeId !== id);
  d.payrollEdits = d.payrollEdits.filter((r) => r.employeeId !== id);
  d.payrolls.forEach((p) => {
    p.manual = p.manual.filter((m) => m.employeeId !== id);
  });
  d.insuranceReports = d.insuranceReports.filter((r) => r.employeeId !== id);
  d.insuranceNotices = d.insuranceNotices.filter((r) => r.employeeId !== id);
  d.docRecords = d.docRecords.filter((r) => r.employeeId !== id);
  d.docRequests = d.docRequests.filter((r) => r.employeeId !== id);
  d.offboarding = d.offboarding.filter((r) => r.employeeId !== id);
  d.notifications = d.notifications.filter((n) => n.to !== id && !n.link.includes(encodeURIComponent(id)));
  d.deadlineActions = d.deadlineActions.filter((a) => !a.key.split(':').includes(id));
  delete d.settings.employeeLang[id];
  // Shared snapshots cannot be partially edited safely: revoke the affected attachment set.
  d.consults.forEach((c) => {
    if (c.employeeIds.includes(id)) {
      c.employeeIds = c.employeeIds.filter((x) => x !== id);
      c.snapshot = null;
      c.shareItems = [];
      c.status = 'revoked';
      c.revokedAt = new Date().toISOString();
    }
  });
}
