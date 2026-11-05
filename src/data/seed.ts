// 가상 시드 데이터 — 실제 사업장·인물과 무관. "카페 샘터"는 시연용 가상 가게 이름이며 노무법인 샘터와 관계가 없다.
// 기준일(base)에 맞춰 날짜를 상대적으로 만들어, 언제 실행해도 시연 흐름(위험·임박·확인 필요)이 보이게 한다.
import { addDays, addMonths, listDates, weekday, fromParts } from '../domain/dates';
import { payrollPeriodFor, draftLines } from '../domain/payroll';
import type { AppState, DaySchedule, Employee, ISODate, ShiftOverride, WorkCondition } from '../domain/types';

export const SCHEMA_VERSION = 1 as const;

export function createEmptyState(): AppState {
  return {
    schemaVersion: SCHEMA_VERSION,
    workplace: null,
    employees: [],
    conditions: [],
    overrides: [],
    attendance: [],
    attendanceEdits: [],
    substitutions: [],
    leaveRequests: [],
    payrolls: [],
    payrollEdits: [],
    statements: [],
    insuranceReports: [],
    insuranceNotices: [],
    docRecords: [],
    docRequests: [],
    customForms: [],
    deadlineActions: [],
    riskAnswers: [],
    offboarding: [],
    consults: [],
    guestConsults: [],
    reviewComments: [],
    notifications: [],
    busyDays: [],
    settings: { baseDateOverride: null, kakaoBannerDismissed: false, employeeLang: {} },
    seq: 0,
  };
}

const ts = (d: ISODate, hm = '09:00') => new Date(`${d}T${hm}:00+09:00`).toISOString();
const S = (start: string, end: string, breakMin: number): DaySchedule => ({ start, end, breakMin });

function emp(p: Partial<Employee> & Pick<Employee, 'id' | 'alias' | 'hireDate'>): Employee {
  return {
    ageBand: '18-59',
    birthDate: null,
    startedBefore65: null,
    employmentType: 'regular',
    contractEnd: null,
    probationEnd: null,
    foodHandler: true,
    isForeign: false,
    foreign: null,
    school: null,
    insuranceMethod: 'self',
    registeredAt: p.hireDate,
    onboarding: 'new',
    resignDate: null,
    resignType: null,
    account: 'none',
    invite: null,
    locationConsent: null,
    conditionAcks: [],
    bonusAnnual: 0,
    leaveAllowanceAnnual: 0,
    createdAt: ts(p.hireDate),
    ...p,
  };
}

function cond(p: Partial<WorkCondition> & Pick<WorkCondition, 'id' | 'employeeId' | 'effectiveFrom' | 'hourlyWage'>): WorkCondition {
  return {
    schedule: [null, null, null, null, null, null, null],
    variable: false,
    variableWeeklyHours: null,
    weeklyHolidayDay: 6,
    job: '홀 서빙·음료 제조',
    mealAllowance: 0,
    breakWaiverRequested: false,
    reason: '최초 등록',
    createdAt: ts(p.effectiveFrom),
    ...p,
  };
}

export function createSeed(base: ISODate): AppState {
  const s = createEmptyState();
  const created = ts(addDays(base, -75));
  s.workplace = {
    name: '카페 샘터 (가상)',
    industry: 'food',
    scale: '1-4',
    familyOnly: false,
    payDay: 10,
    payMonthBasis: 'previous',
    gpsEnabled: true,
    address: '부산 남구 (가상 주소)',
    radiusM: 100,
    lateToleranceMin: 5,
    defaultInsuranceMethod: 'self',
    hourlyLeaveAllowed: false,
    firmInsuranceShareConsent: true,
    createdAt: created,
  };

  // 직원 A — 새로 등록한 직원. 근로계약서 미교부·4대보험 아직 안 함(위험 시연), 시급 변경 예정(조건 이력 시연)
  const aHire = addDays(base, -70);
  const A = emp({ id: 'emp-a', alias: '직원 A', hireDate: aHire, registeredAt: addDays(aHire, -2), probationEnd: addDays(addMonths(aHire, 3), -1), insuranceMethod: 'notYet', account: 'joined', locationConsent: { at: ts(aHire, '10:00'), revokedAt: null } });
  const aSched = [S('10:00', '15:00', 30), S('10:00', '15:00', 30), null, S('10:00', '15:00', 30), S('10:00', '15:00', 30), null, null];
  const A1 = cond({ id: 'cond-a1', employeeId: A.id, effectiveFrom: aHire, hourlyWage: 10320, schedule: aSched });
  const A2 = cond({ id: 'cond-a2', employeeId: A.id, effectiveFrom: addDays(base, 12), hourlyWage: 10500, schedule: aSched, reason: '시급 인상 (예정)', createdAt: ts(addDays(base, -3)) });
  A.conditionAcks = [{ conditionId: A1.id, status: 'confirmed', memo: '', at: ts(aHire, '18:00'), resolvedAt: null }];

  // 직원 B — 기존 직원(정리 완료), 유학생 D-2, 체류기간 만료 임박, 보건증 재검진 시기, 4대보험 노무법인에 맡김
  const bHire = addDays(base, -200);
  const B = emp({
    id: 'emp-b', alias: '직원 B', hireDate: bHire, registeredAt: addDays(base, -30), onboarding: 'existing-done', isForeign: true, school: '경성대 (예시)',
    foreign: { visa: 'D-2', expiry: addDays(base, 4), permitted: true, permitHours: null, otherWorkplaceHours: 0, nationality: '', checkedAt: null },
    insuranceMethod: 'delegated',
  });
  const B1 = cond({ id: 'cond-b1', employeeId: B.id, effectiveFrom: bHire, hourlyWage: 10320, schedule: [null, S('18:00', '22:00', 30), S('18:00', '22:00', 30), null, S('18:00', '22:00', 30), S('12:00', '18:00', 30), null], job: '주방 보조·마감' });

  // 직원 C — 방금 등록한 기존 직원(한 번에 체크 전), 매주 달라요, 기간제(계약 만료 임박)
  const cHire = addDays(base, -45);
  const C = emp({ id: 'emp-c', alias: '직원 C', hireDate: cHire, registeredAt: addDays(base, -1), onboarding: 'existing-pending', employmentType: 'fixed', contractEnd: addDays(base, 25), school: '부경대 (예시)' });
  const C1 = cond({ id: 'cond-c1', employeeId: C.id, effectiveFrom: cHire, hourlyWage: 10320, variable: true, variableWeeklyHours: 11, weeklyHolidayDay: 2, job: '주말 홀 서빙' });

  s.employees = [A, B, C];
  s.conditions = [A1, A2, B1, C1];

  // C의 주말 근무(매주 입력)
  const ovs: ShiftOverride[] = [];
  for (const d of listDates(cHire, addDays(base, 13))) {
    const wd = weekday(d);
    if (wd === 5 || wd === 6) ovs.push({ id: `ov-c-${d}`, employeeId: C.id, date: d, kind: 'extra', start: wd === 5 ? '10:00' : '11:00', end: wd === 5 ? '16:00' : '17:00', breakMin: 30, memo: '주말 근무', substitutionId: null, createdAt: ts(addDays(d, -3)) });
  }
  s.overrides = ovs;

  // A의 GPS 출퇴근 기록 (가상 위치)
  let seq = 0;
  const recent = listDates(addDays(base, -16), addDays(base, -1)).filter((d) => [0, 1, 3, 4].includes(weekday(d)));
  recent.forEach((d, i) => {
    seq++;
    const last = i === recent.length - 1;
    const editTarget = i === recent.length - 3;
    const clockIn = editTarget ? '10:12' : i % 3 === 0 ? '09:58' : '10:01';
    const clockOut = last ? '15:40' : '15:02';
    s.attendance.push({
      id: `att-${d}`,
      recordNo: `R-${d.replace(/-/g, '')}-${String(seq).padStart(4, '0')}`,
      employeeId: A.id,
      date: d,
      original: { clockIn, clockOut },
      source: 'gps-demo',
      gps: 'inside',
      status: last ? 'pending' : 'confirmed',
      approval: null,
      reason: last ? '예정보다 늦게 퇴근' : editTarget ? '지각(일하지 않은 시간만 빼고 계산)' : '',
      createdAt: ts(d, clockIn),
      confirmedAt: last ? null : ts(d, '20:00'),
    });
    if (editTarget) {
      s.attendanceEdits.push({ id: `edit-${d}`, recordId: `att-${d}`, before: { clockIn, clockOut }, after: { clockIn: '10:00', clockOut }, reason: '출근 버튼을 늦게 누름 — 사장님이 10시 출근 확인', by: 'owner', at: ts(d, '21:00'), employeeResponse: null });
    }
  });
  s.seq = seq;

  // 서류 기록
  s.docRecords.push(
    { id: 'doc-w3', key: 'W3', itemId: 'W3', employeeId: null, status: 'done', doneAt: addDays(base, -100), naReason: '', expiry: null, examDate: null, location: '카운터 옆 게시판', bulk: false, updatedAt: created },
    { id: 'doc-w5', key: 'W5', itemId: 'W5', employeeId: null, status: 'done', doneAt: addDays(base, -200), naReason: '', expiry: null, examDate: null, location: '수료증 — 사무 파일', bulk: false, updatedAt: created },
    { id: 'doc-e1-b', key: `E1:${B.id}:${B1.id}`, itemId: 'E1', employeeId: B.id, status: 'stored', doneAt: bHire, naReason: '', expiry: null, examDate: null, location: '카운터 서랍 파란 파일', bulk: true, updatedAt: created },
    { id: 'doc-e3-b', key: `E3:${B.id}`, itemId: 'E3', employeeId: B.id, status: 'done', doneAt: bHire, naReason: '', expiry: null, examDate: null, location: '카운터 서랍 파란 파일', bulk: true, updatedAt: created },
    { id: 'doc-e5-b', key: `E5:${B.id}`, itemId: 'E5', employeeId: B.id, status: 'done', doneAt: addDays(base, -340), naReason: '', expiry: addDays(base, 25), examDate: addDays(base, -340), location: '카운터 서랍 파란 파일', bulk: true, updatedAt: created },
    { id: 'doc-e3-a', key: `E3:${A.id}`, itemId: 'E3', employeeId: A.id, status: 'done', doneAt: aHire, naReason: '', expiry: null, examDate: null, location: '카운터 서랍 파란 파일', bulk: false, updatedAt: created },
    { id: 'doc-e5-a', key: `E5:${A.id}`, itemId: 'E5', employeeId: A.id, status: 'done', doneAt: addDays(aHire, -5), naReason: '', expiry: addDays(addMonths(addDays(aHire, -5), 12), 0), examDate: addDays(aHire, -5), location: '카운터 서랍 파란 파일', bulk: false, updatedAt: created },
  );
  s.docRequests.push({ id: 'req-1', employeeId: B.id, itemId: 'E5', customName: '보건증 (재검진)', status: 'requested', requestedAt: addDays(base, -1), dueDate: addDays(base, 6), receivedAt: null, fixReason: '', expiry: null, location: '', history: [{ status: 'requested', at: addDays(base, -1), memo: '문구 복사 후 사장님이 직접 전송' }] });

  s.insuranceReports.push({ employeeId: B.id, phase: 'acquisition', status: 'handedOver', date: addDays(base, -28), by: 'owner' });

  // 위험 점검 일부 답변
  const ans = (questionId: string, answer: 'yes' | 'no' | 'unknown') => ({ questionId, answer, answeredAt: addDays(base, -20), scaleAtAnswer: '1-4' as const });
  s.riskAnswers = [ans('R1', 'yes'), ans('R2', 'yes'), ans('R4', 'no'), ans('R5', 'yes'), ans('R6', 'yes'), ans('R8', 'unknown')];

  s.busyDays = [{ id: 'busy-1', date: addDays(base, 8), memo: '지역 축제 (예시 — 사장님 입력)' }];

  s.guestConsults = [
    { id: 'guest-1', nickname: '분식집 사장님', phoneMasked: '010-****-1234', phoneKey: '', contactTime: '평일 오후 2~5시', topic: '퇴사·내보내기', summary: '1~4명 · 음식점 · 위험 2건 (계약서 일부만, 퇴사·내보내기 고민)', consents: { collect: ts(addDays(base, -2), '14:00'), provide: ts(addDays(base, -2), '14:00') }, createdAt: ts(addDays(base, -2), '14:01'), mode: 'demo' },
  ];

  s.notifications = [
    { id: 'n-1', to: 'owner', kind: 'employeeJoined', text: '직원 A 가입·근로조건 확인 완료', link: `/owner/employees/${A.id}`, createdAt: ts(aHire, '18:00'), readAt: ts(aHire, '19:00'), channels: { inApp: 'delivered', kakao: 'not-connected' } },
  ];

  // 가장 최근에 지급일이 지난 달의 급여를 확정해 둔다 (명세서 수령 확인 시연)
  const thisYM = base.slice(0, 7);
  for (const off of [-1, -2, -3]) {
    const ym = addMonths(`${thisYM}-01`, off).slice(0, 7);
    const per = payrollPeriodFor(s.workplace, ym);
    if (per.payDate <= base) {
      const lines = draftLines(s, ym);
      const id = ym;
      s.payrolls.push({ id, month: ym, status: 'confirmed', scaleConfirmed: '1-4', manual: [], confirmedAt: ts(addDays(per.payDate, -2), '20:00'), confirmedLines: lines, confirmedWithPending: [], revision: 1 });
      for (const l of lines) {
        const e = s.employees.find((x) => x.id === l.employeeId)!;
        s.statements.push({ id: `st-${ym}-${e.id}`, payrollId: id, employeeId: e.id, revision: 1, method: e.account === 'joined' ? 'app' : 'print', deliveredAt: ts(addDays(per.payDate, -2), '20:05'), viewedAt: e.account === 'joined' ? ts(addDays(per.payDate, -1), '08:30') : null, disputed: null });
      }
      break;
    }
  }
  return s;
}

export const SEED_NOTE = '가상 시드: 카페 샘터(가상) · 1~4명 · 음식점·카페 · 직원 A·B·C (실명·연락처 없음)';
export { fromParts };
