// 계산 엔진(domain.js)의 타입 계약. domain.js는 타입이 없는 묶음이라 Edge Function은 이 인터페이스로 쓴다.
// tests/backend/engine-api.test.ts가 실제 src/domain 함수가 이 계약을 만족하는지 tsc로 검사한다.
import type {
  AppState,
  AttendanceEdit,
  AttendanceRecord,
  Employee,
  HHMM,
  ISODate,
  PayrollLine,
  PayrollMonth,
  ScaleBand,
  WorkCondition,
  Workplace,
} from './domain-types.ts';

export interface DayPlanLite {
  date: ISODate;
  contract: { start: HHMM; end: HHMM; breakMin: number } | null;
  shift: { start: HHMM; end: HHMM; breakMin: number; kind: string } | null;
  off: null | 'absent' | 'leave' | 'subOut' | 'publicHoliday';
  publicHoliday: string | null;
  isWeeklyHoliday: boolean;
  variableNeedsInput: boolean;
}

export interface DeadlineLite {
  key: string;
  type: string;
  title: string;
  employeeId: string | null;
  alias: string | null;
  date: ISODate;
  secondaryDate: ISODate | null;
  secondaryLabel: string;
  status: 'done' | 'overdue' | 'due7' | 'due30' | 'later' | 'onboarding';
  days: number;
  dLabel: string;
  alerts: ISODate[];
  nextAlert: ISODate | null;
  link: string;
}

export interface TodoLite {
  id: string;
  level: 'risk' | 'soon' | 'check';
  area: string;
  title: string;
  badge: string;
  link: string;
  date: ISODate | null;
  employeeId: string | null;
}

export interface FaqLite {
  id: string;
  q: string;
  oneLine: string;
  todo: string[];
  ruleIds: string[];
  basis: string;
  expert: boolean;
}

export interface Engine {
  RULES_FILE: { schema: string; generatedAt: string; basis: string; rules: { id: string; label: string; category: string }[] };
  resolveRule(id: string, date: ISODate): { ok: boolean };
  isISODate(s: unknown): boolean;
  isHHMM(s: unknown): boolean;
  monthOf(iso: ISODate): string;
  addDays(iso: ISODate, n: number): ISODate;
  addMonthsYM(ym: string, n: number): string;
  diffDays(a: ISODate, b: ISODate): number;
  fmtMD(iso: ISODate | null | undefined): string;

  conditionAt(conditions: WorkCondition[], employeeId: string, date: ISODate): WorkCondition | null;
  dayPlan(state: Pick<AppState, 'conditions' | 'overrides' | 'workplace'>, e: Employee, date: ISODate): DayPlanLite;
  currentTimes(rec: AttendanceRecord, edits: AttendanceEdit[]): { clockIn: HHMM | null; clockOut: HHMM | null };
  classifyClock(plan: DayPlanLite, clockIn: HHMM | null, clockOut: HHMM | null, toleranceMin: number, gps: AttendanceRecord['gps']): { status: AttendanceRecord['status']; reason: string };
  weeklyHours(c: WorkCondition | null): number;
  isUnder5(scale: ScaleBand | null | undefined): boolean;

  checkMinimumWage(hourlyWage: number, date: ISODate): { status: 'ok' | 'below' | 'noRule'; required: number | null };
  quickWage(q: { hourlyWage: number; schedule: ({ start: string; end: string; breakMin: number } | null)[]; scale: ScaleBand; date: ISODate }): { weeklyHours: number; monthlyPay: number };
  draftLines(state: AppState, month: string): PayrollLine[];
  payrollLines(state: AppState, month: string): { lines: PayrollLine[]; confirmed: boolean; payroll: PayrollMonth | undefined };
  payrollPeriodFor(wp: Pick<Workplace, 'payDay' | 'payMonthBasis'>, month: string): { from: ISODate; to: ISODate; payDate: ISODate };
  pendingAttendanceIn(state: AppState, month: string): AttendanceRecord[];

  employeeInsurance(state: AppState, e: Employee, date: ISODate): { totals: { worker: number | null; employer: number | null; incomplete: boolean } };
  judgeInsurance(j: {
    ageBand: Employee['ageBand'];
    startedBefore65: boolean | null;
    employmentType: Employee['employmentType'];
    hireDate: ISODate;
    contractEnd: ISODate | null;
    isForeign: boolean;
    visa: string | null;
    nationality: string;
    weeklyHours: number;
    variable: boolean;
  }, date: ISODate): unknown[];
  premiums(base: number, date: ISODate, judgments: never[], industry: Workplace['industry'], ageBand: Employee['ageBand'], startedBefore65: boolean | null): unknown[];
  premiumTotals(rows: never[]): { worker: number | null; employer: number | null; incomplete: boolean };
  estimateSeverance(state: AppState, e: Employee, asOf: ISODate): { monthlyAccrual: number; amount: number; eligible: boolean };
  leaveAccrual(state: AppState, e: Employee, asOf: ISODate): { applicable: boolean };

  computeDeadlines(state: AppState, base: ISODate): DeadlineLite[];
  buildIcs(deadlines: DeadlineLite[], generatedAt?: Date): string;
  computeChecklist(state: AppState, base: ISODate): unknown[];
  computeTodos(state: AppState, base: ISODate): TodoLite[];
  areaCounts(todos: TodoLite[]): Record<string, number>;
  evaluateRisk(state: AppState, base: ISODate): { answered: number; total: number; riskCount: number; checkCount: number };
  foreignSignal(state: AppState, e: Employee, base: ISODate): unknown;

  buildMemo(state: AppState, question: string, faq: FaqLite | null, base: ISODate): string;
  searchFaq(query: string): { faq: FaqLite; score: number }[];
  detectPII(text: string): string[];
  diagnose(a: unknown): { items: unknown[]; showGuestConsult: boolean; topic: string };

  createSeed(base: ISODate): AppState;
  FAQS: FaqLite[];
  CHECKLIST_ITEMS: { id: string; title: string }[];
  HOLIDAYS: { date: ISODate; name: string }[];
  HOLIDAY_SOURCE: { label: string; note: string };
}
