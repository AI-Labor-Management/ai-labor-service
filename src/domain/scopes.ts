// 역할별 접근 범위 (19_데이터모델 5장). 로컬 데모에서는 화면이 이 함수들의 결과만 쓰도록 해 범위를 지킨다.
// 실제 운영에서는 서버(Supabase RLS)가 같은 규칙을 강제해야 한다 — 브라우저 데이터는 누구나 열어볼 수 있다.
import { currentTimes, conditionAt } from './work';
import type { AppState, ConsultRequest, Employee, GuestConsult, ISODate } from './types';

export interface EmployeeView {
  me: Pick<Employee, 'id' | 'alias' | 'hireDate' | 'account' | 'conditionAcks' | 'locationConsent' | 'isForeign'>;
  workplaceName: string;
  scale: string;
  gpsEnabled: boolean;
  condition: ReturnType<typeof conditionAt>;
  overrides: AppState['overrides'];
  attendance: (AppState['attendance'][number] & { current: { clockIn: string | null; clockOut: string | null }; edits: AppState['attendanceEdits'] })[];
  statements: { delivery: AppState['statements'][number]; line: NonNullable<AppState['payrolls'][number]['confirmedLines']>[number]; month: string }[];
  leaveRequests: AppState['leaveRequests'];
  openSubRequests: { id: string; date: string; fromAlias: string; mine: boolean; status: string }[];
  notifications: AppState['notifications'];
}

/** 직원: 본인 데이터만. 다른 직원의 금액·근로조건·기록은 포함하지 않는다. */
export function employeeScope(state: AppState, employeeId: string, base: ISODate): EmployeeView | null {
  const e = state.employees.find((x) => x.id === employeeId);
  if (!e) return null;
  return {
    me: { id: e.id, alias: e.alias, hireDate: e.hireDate, account: e.account, conditionAcks: e.conditionAcks, locationConsent: e.locationConsent, isForeign: e.isForeign },
    workplaceName: state.workplace?.name ?? '',
    scale: state.workplace?.scale ?? '1-4',
    gpsEnabled: !!state.workplace?.gpsEnabled,
    condition: conditionAt(state.conditions, e.id, base),
    overrides: state.overrides.filter((o) => o.employeeId === e.id),
    attendance: state.attendance
      .filter((a) => a.employeeId === e.id)
      .map((a) => ({ ...a, current: currentTimes(a, state.attendanceEdits), edits: state.attendanceEdits.filter((x) => x.recordId === a.id) })),
    statements: state.statements
      .filter((s) => s.employeeId === e.id)
      .flatMap((s) => {
        const p = state.payrolls.find((x) => x.id === s.payrollId);
        const line = p?.confirmedLines?.find((l) => l.employeeId === e.id);
        return p && line ? [{ delivery: s, line, month: p.month }] : [];
      }),
    leaveRequests: state.leaveRequests.filter((l) => l.employeeId === e.id),
    openSubRequests: state.substitutions
      .filter((s) => s.mode === 'request' && (s.status === 'open' || s.fromEmployeeId === e.id || s.toEmployeeId === e.id))
      .map((s) => ({ id: s.id, date: s.date, fromAlias: state.employees.find((x) => x.id === s.fromEmployeeId)?.alias ?? '', mine: s.fromEmployeeId === e.id, status: s.status })),
    notifications: state.notifications.filter((n) => n.to === e.id),
  };
}

export interface FirmView {
  consults: (Omit<ConsultRequest, 'snapshot' | 'memo'> & { snapshot: ConsultRequest['snapshot']; memo: string })[];
  guests: GuestConsult[];
  delegated: { employeeId: string; alias: string; hireDate: ISODate; resignDate: ISODate | null; acquisition: string; loss: string }[];
  insuranceShareConsent: boolean;
}

/** 노무법인: 사장님이 고른 항목만. 철회한 요청은 첨부를 비운다. 급여·서류 상태는 볼 수 없다. */
export function firmScope(state: AppState): FirmView {
  const consent = !!state.workplace?.firmInsuranceShareConsent;
  return {
    consults: state.consults.map((c) =>
      c.revokedAt
        ? { ...c, memo: '', snapshot: null, question: '(공유 철회됨)', employeeIds: [] }
        : { ...c, memo: c.shareItems.includes('memo') ? c.memo : '', snapshot: c.snapshot },
    ),
    guests: state.guestConsults.map((g) => ({ ...g, phoneKey: '' })),
    delegated: consent
      ? state.employees
          .filter((e) => e.insuranceMethod === 'delegated')
          .map((e) => ({
            employeeId: e.id,
            alias: e.alias,
            hireDate: e.hireDate,
            resignDate: e.resignDate,
            acquisition: state.insuranceReports.find((r) => r.employeeId === e.id && r.phase === 'acquisition')?.status ?? 'none',
            loss: state.insuranceReports.find((r) => r.employeeId === e.id && r.phase === 'loss')?.status ?? 'none',
          }))
      : [],
    insuranceShareConsent: consent,
  };
}

/** 관리자: 개인 데이터 없음, 집계만 */
export function adminScope(state: AppState) {
  return {
    workplaces: state.workplace ? 1 : 0,
    employees: state.employees.length,
    payrollsConfirmed: state.payrolls.filter((p) => p.status === 'confirmed').length,
    consults: state.consults.length,
    guestConsults: state.guestConsults.length,
    kakaoSent: 0,
    notificationsInApp: state.notifications.length,
  };
}
