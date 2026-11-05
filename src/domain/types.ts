// 공통 데이터 모델. 사업장·직원·근로조건 이력을 모든 기능(서류·임금·보험·기한·홈·근무·직원·상담)이 함께 쓴다.
// 원칙 (19_데이터모델): 기한은 저장하지 않고 원래 날짜에서 계산, 근로조건은 이력, 확정 급여·출퇴근 원본은 덮어쓰지 않음,
// 실명·주민등록번호·외국인등록번호·서류 파일 칸은 두지 않는다.

export type ISODate = string; // 'YYYY-MM-DD'
export type ISODateTime = string; // new Date().toISOString()
export type HHMM = string; // '10:00'

export type Industry = 'food' | 'retail' | 'service';
export type ScaleBand = '1-4' | '5-9' | '10+';
export type PayMonthBasis = 'previous' | 'current';
export type AgeBand = 'under18' | '18-59' | '60-64' | '65+';
export type EmploymentType = 'regular' | 'fixed' | 'daily';
export type InsuranceMethod = 'self' | 'delegated' | 'alreadyDone' | 'notYet';
export type Visa = 'D-2' | 'D-4' | 'E-9' | 'H-2' | 'F-4' | 'other';
/** 0 = 월요일 … 6 = 일요일 */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface Workplace {
  name: string; // 상호(선택). 시드는 가상 이름
  industry: Industry;
  scale: ScaleBand;
  familyOnly: boolean; // 동거하는 친족만 사용하는 사업장
  payDay: number; // 1~31 (31 이상이면 말일)
  payMonthBasis: PayMonthBasis;
  gpsEnabled: boolean;
  address: string; // GPS를 켤 때만
  radiusM: number;
  lateToleranceMin: number;
  defaultInsuranceMethod: InsuranceMethod | null;
  hourlyLeaveAllowed: boolean; // 사업장에서 시간 단위 연차를 쓰는 경우
  firmInsuranceShareConsent: boolean; // 맡김 건을 노무법인 화면에 공유하는 동의
  createdAt: ISODateTime;
}

export interface DaySchedule {
  start: HHMM;
  end: HHMM;
  breakMin: number;
}

export interface WorkCondition {
  id: string;
  employeeId: string;
  effectiveFrom: ISODate;
  hourlyWage: number;
  /** 월~일 7칸. null = 근무 없음 */
  schedule: (DaySchedule | null)[];
  variable: boolean; // "매주 달라요"
  variableWeeklyHours: number | null; // 매주 달라요일 때 주 평균 예상 시간
  weeklyHolidayDay: Weekday;
  job: string;
  mealAllowance: number; // 월 고정 식대(선택)
  breakWaiverRequested: boolean; // 2026.12.10부터 4시간 근무 휴게 생략 요청 기록
  reason: string; // 변경 사유
  createdAt: ISODateTime;
}

export interface ForeignInfo {
  visa: Visa;
  expiry: ISODate | null;
  permitted: boolean | null; // 시간제취업 허가 (D-2/D-4)
  permitHours: number | null;
  otherWorkplaceHours: number;
  nationality: string; // 선택
  checkedAt: ISODate | null; // 사장님이 체류·근무처 확인한 날
}

export interface ConditionAck {
  conditionId: string;
  status: 'confirmed' | 'disputed';
  memo: string;
  at: ISODateTime;
  resolvedAt: ISODateTime | null;
}

export type ResignType = 'self' | 'contractEnd' | 'dismissal' | 'other';

export interface Employee {
  id: string;
  alias: string;
  ageBand: AgeBand;
  birthDate: ISODate | null; // 18세 미만만
  startedBefore65: boolean | null; // 65세 이상일 때만
  hireDate: ISODate;
  employmentType: EmploymentType;
  contractEnd: ISODate | null;
  probationEnd: ISODate | null;
  foodHandler: boolean;
  isForeign: boolean;
  foreign: ForeignInfo | null;
  school: string | null; // 학생이면 학교 (선택)
  insuranceMethod: InsuranceMethod;
  registeredAt: ISODate; // 서비스에 등록한 날
  onboarding: 'new' | 'existing-pending' | 'existing-done';
  resignDate: ISODate | null;
  resignType: ResignType | null;
  account: 'none' | 'invited' | 'joined' | 'blocked';
  invite: { token: string; expiresAt: ISODate; used: boolean } | null;
  locationConsent: { at: ISODateTime; revokedAt: ISODateTime | null } | null;
  conditionAcks: ConditionAck[];
  bonusAnnual: number; // 퇴직금 참고 입력 (연간 상여)
  leaveAllowanceAnnual: number; // 퇴직금 참고 입력 (연간 연차수당)
  createdAt: ISODateTime;
}

export type ShiftOverrideKind = 'change' | 'extra' | 'absent' | 'leave' | 'subOut' | 'subIn';

export interface ShiftOverride {
  id: string;
  employeeId: string;
  date: ISODate;
  kind: ShiftOverrideKind;
  start: HHMM | null;
  end: HHMM | null;
  breakMin: number;
  memo: string;
  substitutionId: string | null;
  createdAt: ISODateTime;
}

export type AttendanceStatus = 'confirmed' | 'pending' | 'exception';

export interface AttendanceRecord {
  id: string;
  recordNo: string;
  employeeId: string;
  date: ISODate;
  /** 원래 기록 — 절대 덮어쓰지 않는다 */
  original: { clockIn: HHMM | null; clockOut: HHMM | null };
  source: 'gps-demo' | 'manual' | 'owner';
  gps: 'inside' | 'outside' | 'denied' | null;
  status: AttendanceStatus;
  /** 사장님 판단: 예정보다 일찍/늦게 기록된 시간을 근무로 인정할지 */
  approval: 'actual' | 'planned' | null;
  reason: string;
  createdAt: ISODateTime;
  confirmedAt: ISODateTime | null;
}

export interface AttendanceEdit {
  id: string;
  recordId: string;
  before: { clockIn: HHMM | null; clockOut: HHMM | null };
  after: { clockIn: HHMM | null; clockOut: HHMM | null };
  reason: string;
  by: 'owner';
  at: ISODateTime;
  employeeResponse: { status: 'confirmed' | 'disputed'; memo: string; at: ISODateTime } | null;
}

export interface Substitution {
  id: string;
  date: ISODate;
  fromEmployeeId: string;
  toEmployeeId: string | null;
  mode: 'owner' | 'request';
  status: 'open' | 'applied' | 'approved' | 'rejected' | 'cancelled';
  memo: string;
  createdAt: ISODateTime;
  decidedAt: ISODateTime | null;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  date: ISODate;
  hours: number | null; // null = 하루
  status: 'requested' | 'approved' | 'adjust' | 'cancelled';
  adjustReason: string;
  requestedAt: ISODateTime;
  decidedAt: ISODateTime | null;
  by: 'employee' | 'owner';
}

export interface PayrollItem {
  code: string;
  label: string;
  amount: number;
  formula: string;
  basis: string[]; // rule ids
  note?: string;
}

export interface PayrollDeduction {
  code: 'pension' | 'health' | 'ltc' | 'employment' | 'incomeTax' | 'localTax';
  label: string;
  amount: number | null; // null = 기준 없음/미입력
  source: 'notice' | 'estimate' | 'manual' | 'dailyFormula' | 'missing' | 'excluded';
  note: string;
}

export interface PayrollWarning {
  level: 'risk' | 'check' | 'info';
  text: string;
  basis?: string[];
}

export interface PayrollLine {
  employeeId: string;
  alias: string;
  period: { from: ISODate; to: ISODate };
  payDate: ISODate;
  hours: {
    worked: number;
    night: number;
    overtime: number;
    holidayWithin8: number;
    holidayOver8: number;
    partTimeOver: number;
    paidLeave: number;
    paidPublicHoliday: number;
  };
  workDays: number;
  wageText: string; // "10,320원" or "10,320원 → 10,500원(11.20부터)"
  items: PayrollItem[];
  gross: number;
  taxFree: number;
  deductions: PayrollDeduction[];
  deductionTotal: number;
  net: number;
  netComplete: boolean; // 소득세 등 미확정 항목이 없으면 true
  warnings: PayrollWarning[];
  pendingDays: ISODate[]; // 확인 대기 상태로 계산한 날
  weeklyHolidayDetail: WeeklyHolidayRow[];
  ruleRefs: { id: string; status: string; verifiedAt?: string }[];
}

export interface WeeklyHolidayRow {
  weekStart: ISODate;
  weekEnd: ISODate;
  scheduledHours: number;
  avg4w: number;
  perfectAttendance: boolean;
  eligible: boolean;
  included: boolean;
  hours: number;
  amount: number;
  flags: string[];
}

export interface PayrollManual {
  employeeId: string;
  incomeTax: number | null;
  localTax: number | null;
  adjustments: { label: string; amount: number }[];
}

export interface PayrollMonth {
  id: string; // 'YYYY-MM' (근무 기간의 월)
  month: string;
  status: 'draft' | 'confirmed';
  scaleConfirmed: ScaleBand | null;
  manual: PayrollManual[];
  confirmedAt: ISODateTime | null;
  confirmedLines: PayrollLine[] | null; // 확정 스냅샷 — 이후 조건 변경으로 바뀌지 않음
  confirmedWithPending: ISODate[];
  revision: number;
}

export interface PayrollEdit {
  id: string;
  payrollId: string;
  employeeId: string;
  field: string;
  before: string;
  after: string;
  reason: string;
  at: ISODateTime;
}

export interface StatementDelivery {
  id: string;
  payrollId: string;
  employeeId: string;
  revision: number;
  method: 'app' | 'print';
  deliveredAt: ISODateTime;
  viewedAt: ISODateTime | null;
  disputed: { memo: string; at: ISODateTime } | null;
}

export type InsuranceKind = 'pension' | 'health' | 'ltc' | 'employment' | 'industrial';

export interface InsuranceReport {
  employeeId: string;
  phase: 'acquisition' | 'loss';
  status: 'none' | 'reported' | 'handedOver' | 'firmDone' | 'confirmed';
  date: ISODate | null;
  by: 'owner' | 'firm' | null;
}

export interface InsuranceNotice {
  id: string;
  employeeId: string;
  fromMonth: string; // 'YYYY-MM' 이 달부터 적용
  amounts: Partial<Record<Exclude<InsuranceKind, 'industrial'>, number>>;
  enteredAt: ISODateTime;
}

export type DocStatus = 'done' | 'na' | 'stored';

export interface DocRecord {
  id: string;
  key: string; // itemId[:employeeId[:conditionId]]
  itemId: string;
  employeeId: string | null;
  status: DocStatus;
  doneAt: ISODate | null;
  naReason: string;
  expiry: ISODate | null; // 보건증 등
  examDate: ISODate | null;
  location: string; // 보관 위치 한 줄
  bulk: boolean; // 기존 직원 한 번에 체크로 처리
  updatedAt: ISODateTime;
}

export interface DocRequest {
  id: string;
  employeeId: string;
  itemId: string | null;
  customName: string;
  status: 'requested' | 'received' | 'needsFix';
  requestedAt: ISODate;
  dueDate: ISODate;
  receivedAt: ISODate | null;
  fixReason: string;
  expiry: ISODate | null;
  location: string;
  history: { status: DocRequest['status']; at: ISODate; memo: string }[];
}

export interface CustomForm {
  id: string;
  name: string;
  url: string;
}

export interface DeadlineAction {
  key: string;
  action: 'done' | 'pastConfirmed' | 'renewed' | 'ended' | 'unknown';
  at: ISODateTime;
  date: ISODate; // 처리일
  note: string;
}

export type RiskAnswerValue = 'yes' | 'no' | 'unknown';

export interface RiskAnswer {
  questionId: string;
  answer: RiskAnswerValue;
  answeredAt: ISODate;
  scaleAtAnswer: ScaleBand;
}

export interface OffboardingProgress {
  employeeId: string;
  steps: Record<string, boolean>;
  startedAt: ISODateTime;
  completedAt: ISODateTime | null;
}

export type ShareItem = 'memo' | 'workplace' | 'conditions' | 'attendance';

export interface ConsultRequest {
  id: string;
  topic: string;
  question: string;
  memo: string;
  shareItems: ShareItem[];
  employeeIds: string[];
  /** 공유 시점의 사본 — 사장님이 고른 항목만 담는다. 철회하면 비운다. */
  snapshot: {
    workplace?: { industry: Industry; scale: ScaleBand };
    conditions?: { alias: string; text: string }[];
    attendance?: { alias: string; lines: string[] }[];
  } | null;
  consentAt: ISODateTime;
  revokedAt: ISODateTime | null;
  status: 'demo-delivered' | 'firm-read' | 'revoked';
  createdAt: ISODateTime;
}

export interface GuestConsult {
  id: string;
  nickname: string;
  phoneMasked: string;
  phoneKey: string; // 하루 3회 제한용 비가역 키
  contactTime: string;
  topic: string;
  summary: string;
  consents: { collect: ISODateTime; provide: ISODateTime };
  createdAt: ISODateTime;
  mode: 'demo';
}

export interface ReviewComment {
  id: string;
  target: string; // rule id / faq id / question id
  comment: string;
  at: ISODateTime;
}

export interface AppNotification {
  id: string;
  to: 'owner' | string; // 'owner' or employeeId
  kind: string;
  text: string;
  link: string;
  createdAt: ISODateTime;
  readAt: ISODateTime | null;
  /** 외부 채널 결과. 실제로 보내지 않았으면 'not-sent' */
  channels: { inApp: 'delivered'; kakao: 'not-connected' | 'not-sent' };
}

export interface BusyDay {
  id: string;
  date: ISODate;
  memo: string;
}

export interface Settings {
  baseDateOverride: ISODate | null;
  kakaoBannerDismissed: boolean;
  employeeLang: Record<string, 'ko' | 'en'>;
}

export interface AppState {
  schemaVersion: 1;
  workplace: Workplace | null;
  employees: Employee[];
  conditions: WorkCondition[];
  overrides: ShiftOverride[];
  attendance: AttendanceRecord[];
  attendanceEdits: AttendanceEdit[];
  substitutions: Substitution[];
  leaveRequests: LeaveRequest[];
  payrolls: PayrollMonth[];
  payrollEdits: PayrollEdit[];
  statements: StatementDelivery[];
  insuranceReports: InsuranceReport[];
  insuranceNotices: InsuranceNotice[];
  docRecords: DocRecord[];
  docRequests: DocRequest[];
  customForms: CustomForm[];
  deadlineActions: DeadlineAction[];
  riskAnswers: RiskAnswer[];
  offboarding: OffboardingProgress[];
  consults: ConsultRequest[];
  guestConsults: GuestConsult[];
  reviewComments: ReviewComment[];
  notifications: AppNotification[];
  busyDays: BusyDay[];
  settings: Settings;
  seq: number; // 기록 번호 발급용
}

export type Role = 'owner' | 'employee' | 'firm' | 'admin';
export interface DemoSession {
  role: Role;
  employeeId: string | null;
}
