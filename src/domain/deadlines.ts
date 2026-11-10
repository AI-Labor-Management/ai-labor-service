// F4 기한 (11_F4_기한알림). 기한은 저장하지 않고 원래 날짜에서 계산한다. 저장하는 것은 처리 기록(deadlineActions)뿐.
// 처리 기록의 key에 원래 날짜를 넣어, 원래 날짜가 바뀌면 이전 처리 기록이 자동으로 적용되지 않게 한다(재계산).
import { addDays, addMonths, addYears, dDayLabel, diffDays, fmtMD, monthOf } from './dates';
import { resolveRule } from './rules';
import { conditionAt, isUnder5, weeklyHours } from './work';
import { checkMinimumWage } from './wage';
import { lossDate, reportDeadlines } from './insurance';
import { payrollPeriodFor } from './payroll';
import { leaveAccrual } from './leave';
import type { AppState, DeadlineAction, Employee, ISODate } from './types';

export type DeadlineType =
  | 'probationEnd'
  | 'contractEnd'
  | 'visaExpiry'
  | 'healthCert'
  | 'payday'
  | 'insAcquisition'
  | 'insLoss'
  | 'severanceYear'
  | 'severancePay'
  | 'minWageTransition'
  | 'dailyRoster'
  | 'retentionEnd'
  | 'leavePromotion'
  | 'fixedTerm2y';

export type DeadlineStatus = 'done' | 'overdue' | 'due7' | 'due30' | 'later' | 'onboarding';

export interface Deadline {
  key: string;
  type: DeadlineType;
  title: string;
  employeeId: string | null;
  alias: string | null;
  date: ISODate;
  secondaryDate: ISODate | null;
  secondaryLabel: string;
  origin: string; // 어떤 원래 날짜에서 계산했는지
  recurring: boolean;
  link: string;
  basis: string;
  ruleIds: string[];
  actions: DeadlineAction['action'][];
  handled: DeadlineAction | null;
  status: DeadlineStatus;
  days: number;
  dLabel: string;
  alerts: ISODate[]; // 알림 예정일 (30·7·3·당일, 반복 기한은 3·당일)
  nextAlert: ISODate | null;
}

export const TYPE_LABEL: Record<DeadlineType, string> = {
  probationEnd: '수습 종료',
  contractEnd: '계약 만료',
  visaExpiry: '체류기간 만료',
  healthCert: '보건증 유효기간',
  payday: '급여 지급일',
  insAcquisition: '4대보험 입사 신고',
  insLoss: '4대보험 퇴사 신고',
  severanceYear: '퇴직금 준비',
  severancePay: '퇴직금 지급 기한',
  minWageTransition: '최저임금 전환',
  dailyRoster: '근로자 명부 추가',
  retentionEnd: '서류 보관 종료',
  leavePromotion: '연차 사용 촉진',
  fixedTerm2y: '기간제 2년',
};

interface Raw {
  key: string;
  type: DeadlineType;
  title: string;
  employee: Employee | null;
  date: ISODate;
  secondaryDate?: ISODate | null;
  secondaryLabel?: string;
  origin: string;
  recurring?: boolean;
  link: string;
  basis: string;
  ruleIds?: string[];
  actions?: DeadlineAction['action'][];
  /** 화면에 띄우기 시작하는 날 (예: 보건증은 만료 30일 전부터) */
  showFrom?: ISODate;
  autoDone?: boolean;
}

export function alertDates(date: ISODate, recurring: boolean): ISODate[] {
  const offs = recurring ? [3, 0] : [30, 7, 3, 0];
  return offs.map((o) => addDays(date, -o));
}

export function computeDeadlines(state: AppState, base: ISODate): Deadline[] {
  const wp = state.workplace;
  if (!wp) return [];
  const raws: Raw[] = [];
  const under5 = isUnder5(wp.scale);

  for (const e of state.employees) {
    const resigned = !!e.resignDate && e.resignDate < base;
    const empLink = `/owner/employees/${e.id}`;
    if (!resigned) {
      if (e.probationEnd) raws.push({ key: `probationEnd:${e.id}:${e.probationEnd}`, type: 'probationEnd', title: `${e.alias} 수습 종료`, employee: e, date: e.probationEnd, origin: `수습 종료일 ${e.probationEnd}`, link: empLink, basis: '직원 등록값', ruleIds: ['minimumWage.probation'], actions: ['done'] });
      if (e.employmentType === 'fixed' && e.contractEnd)
        raws.push({ key: `contractEnd:${e.id}:${e.contractEnd}`, type: 'contractEnd', title: `${e.alias} 계약 만료`, employee: e, date: e.contractEnd, origin: `계약 종료일 ${e.contractEnd}`, link: empLink, basis: '직원 등록값 · 기간제법 제17조', actions: ['renewed', 'ended', 'unknown'] });
      if (e.isForeign && e.foreign?.expiry)
        raws.push({ key: `visaExpiry:${e.id}:${e.foreign.expiry}`, type: 'visaExpiry', title: `${e.alias} 체류기간 만료`, employee: e, date: e.foreign.expiry, origin: `체류기간 만료일 ${e.foreign.expiry}`, link: empLink, basis: '외국인 정보 (출입국관리법 · 전문가 확인 권장)', actions: ['done'] });
      const hc = state.docRecords.find((r) => r.key === `E5:${e.id}` && (r.status === 'done' || r.status === 'stored'));
      if (hc?.expiry) {
        raws.push({ key: `healthCert:${e.id}:${hc.expiry}`, type: 'healthCert', title: `${e.alias} 보건증 재검진`, employee: e, date: hc.expiry, origin: `보건증 유효기간 ${hc.expiry}`, link: `/owner/documents?item=E5&emp=${e.id}`, basis: '건강진단규칙 제2조', ruleIds: ['healthCertificate'], actions: ['done'], showFrom: addDays(hc.expiry, -30) });
      }
      // 4대보험 입사 신고
      if (e.insuranceMethod !== 'alreadyDone') {
        const r = reportDeadlines(e.hireDate, e.hireDate);
        const rep = state.insuranceReports.find((x) => x.employeeId === e.id && x.phase === 'acquisition');
        const done = !!rep && rep.status !== 'none';
        raws.push({ key: `insAcquisition:${e.id}:${e.hireDate}`, type: 'insAcquisition', title: `${e.alias} 4대보험 입사 신고`, employee: e, date: r.first, secondaryDate: r.others, secondaryLabel: `건강 ${fmtMD(r.health)} / 연금·고용·산재 ${fmtMD(r.others)}`, origin: `입사일 ${e.hireDate}`, link: `/owner/insurance?emp=${e.id}`, basis: '국민건강보험법 제8조② · 국민연금법 시행규칙 제6조① · 고용보험법 시행령 제7조①', ruleIds: ['insurance.reportDeadline'], actions: ['done'], autoDone: done });
      }
      // 퇴직금 1년 되는 날
      const c = conditionAt(state.conditions, e.id, base);
      if (!(e.isForeign && e.foreign?.visa === 'E-9') && weeklyHours(c) >= 15) {
        const oneYear = addYears(e.hireDate, 1);
        raws.push({ key: `severanceYear:${e.id}:${oneYear}`, type: 'severanceYear', title: `${e.alias} 퇴직금 준비 (1년 되는 날)`, employee: e, date: oneYear, origin: `입사일 ${e.hireDate}`, link: empLink, basis: '퇴직급여법 제4조①', ruleIds: ['severance.basic'], actions: ['done'] });
      }
      // 최저임금 전환: 현재 시급이 다음 해 최저임금보다 낮으면 (12월부터 홈에 임박)
      if (c) {
        const nextJan = `${Number(base.slice(0, 4)) + 1}-01-01`;
        const mw = checkMinimumWage(c.hourlyWage, nextJan);
        const futureCond = conditionAt(state.conditions, e.id, nextJan);
        if (mw.status === 'below' && futureCond && futureCond.hourlyWage < (mw.required ?? 0))
          raws.push({ key: `minWageTransition:${e.id}:${nextJan}`, type: 'minWageTransition', title: `${e.alias} 최저임금 전환 — 시급 ${c.hourlyWage.toLocaleString('ko-KR')}원 < ${mw.required?.toLocaleString('ko-KR')}원`, employee: e, date: nextJan, origin: `${nextJan.slice(0, 4)}년 최저임금 고시`, link: `${empLink}?tab=conditions`, basis: '최저임금법 제6조', ruleIds: ['minimumWage.hourly'], actions: ['done'], showFrom: `${base.slice(0, 4)}-12-01` });
      }
      // 하루 단위 고용 30일
      if (e.employmentType === 'daily') {
        const d30 = addDays(e.hireDate, 29);
        raws.push({ key: `dailyRoster:${e.id}:${d30}`, type: 'dailyRoster', title: `${e.alias} 근로자 명부 작성 (사용기간 30일)`, employee: e, date: d30, origin: `입사일 ${e.hireDate}`, link: `/owner/documents?item=E3&emp=${e.id}`, basis: '근로기준법 시행령 제21조', ruleIds: ['records.rosterException'], actions: ['done'] });
      }
      // 기간제 2년 (5명 이상)
      if (!under5 && e.employmentType === 'fixed') {
        const d2 = addDays(addYears(e.hireDate, 2), -1);
        raws.push({ key: `fixedTerm2y:${e.id}:${d2}`, type: 'fixedTerm2y', title: `${e.alias} 기간제 2년 도달`, employee: e, date: d2, origin: `최초 입사일 ${e.hireDate}`, link: empLink, basis: '기간제법 제4조', ruleIds: ['fixedTerm.maxYears'], actions: ['done'] });
      }
      // 연차 사용 촉진 (5명 이상)
      if (!under5) {
        const la = leaveAccrual(state, e, base);
        if (la.applicable && la.promotion)
          raws.push({ key: `leavePromotion:${e.id}:${la.promotion.notifyFrom}`, type: 'leavePromotion', title: `${e.alias} 연차 사용 촉진 서면 촉구`, employee: e, date: la.promotion.notifyTo, secondaryDate: la.promotion.designateBy, secondaryLabel: `촉구 ${fmtMD(la.promotion.notifyFrom)}~${fmtMD(la.promotion.notifyTo)} · 지정 ${fmtMD(la.promotion.designateBy)}까지`, origin: `연차 기간 ${la.currentYearStart}~${la.currentYearEnd}`, link: '/owner/work?tab=leave', basis: '근로기준법 제61조', ruleIds: ['annualLeave.promotion'], actions: ['done'] });
      }
    }
    if (e.resignDate) {
      const ld = lossDate(e.resignDate);
      const r = reportDeadlines(ld, ld);
      const rep = state.insuranceReports.find((x) => x.employeeId === e.id && x.phase === 'loss');
      raws.push({ key: `insLoss:${e.id}:${e.resignDate}`, type: 'insLoss', title: `${e.alias} 4대보험 퇴사(상실) 신고`, employee: e, date: r.first, secondaryDate: r.others, secondaryLabel: `건강 ${fmtMD(r.health)} / 연금·고용·산재 ${fmtMD(r.others)}`, origin: `퇴사일 ${e.resignDate} (상실일 ${ld})`, link: `/owner/insurance?emp=${e.id}`, basis: '국민건강보험법 제10조② · 징수법 제16조의10', ruleIds: ['insurance.reportDeadline'], actions: ['done'], autoDone: !!rep && rep.status !== 'none' });
      const sev = resolveRule<{ paymentDays: number }>('severance.basic', e.resignDate);
      const payDays = sev.ok ? sev.value.paymentDays : 14;
      raws.push({ key: `severancePay:${e.id}:${e.resignDate}`, type: 'severancePay', title: `${e.alias} 임금·퇴직금 지급 기한 (퇴사 후 ${payDays}일)`, employee: e, date: addDays(e.resignDate, payDays), origin: `퇴사일 ${e.resignDate}`, link: `/owner/offboarding/${e.id}`, basis: '근로기준법 제36조 · 퇴직급여법 제9조①', ruleIds: ['severance.basic'], actions: ['done'] });
      const ret = addYears(e.resignDate, 3);
      raws.push({ key: `retentionEnd:${e.id}:${ret}`, type: 'retentionEnd', title: `${e.alias} 서류 3년 보관 종료`, employee: e, date: ret, origin: `퇴사일 ${e.resignDate}`, link: `/owner/documents?emp=${e.id}`, basis: '근로기준법 제42조 · 시행령 제22조②', ruleIds: ['records.retentionYears'], actions: ['done'] });
    }
  }

  // 급여 지급일 (매달 반복: 3일 전·당일만)
  if (state.employees.some((e) => !e.resignDate || e.resignDate >= base)) {
    const thisMonth = monthOf(base);
    for (const off of [-1, 0, 1]) {
      const ym = monthOf(addMonths(`${thisMonth}-01`, off));
      const workMonth = wp.payMonthBasis === 'previous' ? monthOf(addMonths(`${ym}-01`, -1)) : ym;
      const p = payrollPeriodFor(wp, workMonth);
      const inPeriod = state.employees.filter((e) => e.hireDate <= p.to && (!e.resignDate || e.resignDate >= p.from));
      if (!inPeriod.length) continue;
      // 서비스에 등록하기 전에 지난 지급일은 위험으로 쌓지 않는다 (기존 직원 입구)
      if (p.payDate < inPeriod.map((e) => e.registeredAt).sort()[0]) continue;
      const pr = state.payrolls.find((x) => x.month === workMonth);
      raws.push({ key: `payday:${workMonth}:${p.payDate}`, type: 'payday', title: `${Number(workMonth.slice(5))}월분 급여 확정 · 임금명세서`, employee: null, date: p.payDate, origin: `사업장 설정 — 매달 ${wp.payDay}일, ${wp.payMonthBasis === 'previous' ? '전월분' : '당월분'}`, recurring: true, link: `/owner/payroll?month=${workMonth}`, basis: '근로기준법 제43조 · 제48조', ruleIds: ['wageStatement.electronic'], actions: ['done'], autoDone: pr?.status === 'confirmed' });
    }
  }

  const out: Deadline[] = [];
  for (const r of raws) {
    if (r.showFrom && base < r.showFrom && diffDays(base, r.date) > 30) continue;
    const handled = state.deadlineActions.find((a) => a.key === r.key) ?? null;
    const days = diffDays(base, r.date);
    let status: DeadlineStatus;
    const autoDoneAction: DeadlineAction | null = r.autoDone ? { key: r.key, action: 'done', at: '', date: base, note: '연결된 화면에서 처리됨' } : null;
    const h = handled ?? autoDoneAction;
    if (h && h.action !== 'unknown') status = 'done';
    else if (r.employee && r.employee.onboarding === 'existing-pending' && r.date < r.employee.registeredAt) status = 'onboarding';
    else if (days < 0) status = 'overdue';
    else if (days <= 7) status = 'due7';
    else if (days <= 30) status = 'due30';
    else status = 'later';
    const alerts = alertDates(r.date, !!r.recurring);
    out.push({
      key: r.key,
      type: r.type,
      title: r.title,
      employeeId: r.employee?.id ?? null,
      alias: r.employee?.alias ?? null,
      date: r.date,
      secondaryDate: r.secondaryDate ?? null,
      secondaryLabel: r.secondaryLabel ?? '',
      origin: r.origin,
      recurring: !!r.recurring,
      link: r.link,
      basis: r.basis,
      ruleIds: r.ruleIds ?? [],
      actions: r.actions ?? ['done'],
      handled: h,
      status,
      days,
      dLabel: dDayLabel(days),
      alerts,
      nextAlert: status === 'done' ? null : alerts.find((a) => a >= base) ?? null,
    });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.key < b.key ? -1 : 1));
}

/** 처리하면 알림이 멈춘다 — key는 원래 날짜를 포함 */
export function handleDeadline(actions: DeadlineAction[], key: string, action: DeadlineAction['action'], date: ISODate, note = ''): DeadlineAction[] {
  return [...actions.filter((a) => a.key !== key), { key, action, at: new Date().toISOString(), date, note }];
}

