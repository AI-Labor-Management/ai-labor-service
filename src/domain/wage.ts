// F2 임금 계산 (08_F2_임금계산). 모든 금액·비율은 rules.json에서 근무일 기준으로 읽는다.
import {
  addDays,
  diffDays,
  fmtMD,
  listDates,
  maxDate,
  minDate,
  monthOf,
  nightOverlapMinutes,
  startOfWeek,
} from './dates';
import { resolveRule, ruleValue } from './rules';
import { conditionAt, dayPlan, isUnder5, netMinutes, weeklyHours, workedSegment } from './work';
import { employeeMonthlyPremiums } from './insurance';
import { won, weeklyHolidayHours, monthlyHours } from './hours';
import type {
  AppState,
  Employee,
  ISODate,
  PayrollDeduction,
  PayrollItem,
  PayrollLine,
  PayrollManual,
  PayrollWarning,
  ScaleBand,
  WeeklyHolidayRow,
} from './types';

export { won, weeklyHolidayHours, monthlyHours, monthlyWageEstimate } from './hours';

export interface MinWageCheck {
  status: 'ok' | 'below' | 'noRule';
  required: number | null;
  wage: number;
  ruleStatus?: string;
}

export function checkMinimumWage(hourlyWage: number, date: ISODate): MinWageCheck {
  const r = resolveRule<number>('minimumWage.hourly', date);
  if (!r.ok) return { status: 'noRule', required: null, wage: hourlyWage };
  return { status: hourlyWage >= r.value ? 'ok' : 'below', required: r.value, wage: hourlyWage, ruleStatus: r.status };
}

/** 일용근로자 원천징수: (1일 지급액 − 15만 원) × 6% − 산출세액의 55% */
export function dailyWorkerIncomeTax(dailyPay: number, date: ISODate): number {
  const r = ruleValue<{ deductionPerDay: number; rate: number; taxCredit: number }>('tax.dailyWorker', date);
  // 부동소수 오차를 없애려고 원 단위로 끊어 계산: 산출세액(원 미만 절사) − 세액공제(원 미만 절사)
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const calc = Math.floor(round2(Math.max(0, dailyPay - r.deductionPerDay) * r.rate));
  return calc - Math.floor(round2(calc * r.taxCredit));
}

/** 지방소득세(특별징수) = 소득세 × 10%, 10원 미만 절사 (지방세법 제103조의13) */
export function localIncomeTax(incomeTax: number): number {
  // × 0.1 ÷ 10 대신 ÷ 100 — 부동소수 오차 없이 10원 미만을 버린다
  return Math.floor(Math.max(0, incomeTax) / 100) * 10;
}
export const LOCAL_TAX_NOTE = '소득세의 10%예요 (지방세법 제103조의13)';

/** 퇴사하는 주 주휴 플래그 — 경고 판정에 쓰는 고정 문구 */
export const RESIGN_WEEK_FLAG = '퇴사하는 주 — 자동 포함하지 않음, 확인 필요';

export interface DayCalc {
  date: ISODate;
  wage: number;
  netMin: number;
  nightMin: number;
  holiday: boolean;
  pending: boolean;
  paidOffMin: number; // 연차·공휴일 유급
  paidOffKind: 'leave' | 'publicHoliday' | null;
  contractMin: number;
  basePay: number;
}

function dayCalc(state: AppState, e: Employee, d: ISODate, scale: ScaleBand): DayCalc | null {
  const cond = conditionAt(state.conditions, e.id, d);
  if (!cond) return null;
  const { seg, pending, plan } = workedSegment(state, e, d);
  const wage = cond.hourlyWage;
  const contractMin = plan.contract ? netMinutes(plan.contract) : 0;
  let netMin = 0;
  let nightMin = 0;
  if (seg) {
    netMin = netMinutes(seg);
    nightMin = Math.min(netMin, nightOverlapMinutes(seg.start, seg.end));
  }
  let paidOffMin = 0;
  let paidOffKind: DayCalc['paidOffKind'] = null;
  if (!isUnder5(scale) && (plan.off === 'leave' || plan.off === 'publicHoliday') && contractMin > 0) {
    paidOffMin = contractMin;
    paidOffKind = plan.off;
  }
  const holiday = plan.isWeeklyHoliday || (!isUnder5(scale) && !!plan.publicHoliday);
  return { date: d, wage, netMin, nightMin, holiday, pending, paidOffMin, paidOffKind, contractMin, basePay: (netMin / 60) * wage };
}

export interface PremiumBreakdown {
  overtimeMin: number;
  overtimePay: number;
  nightMin: number;
  nightPay: number;
  holidayWithin8Min: number;
  holidayOver8Min: number;
  holidayPay: number;
  partTimeOverMin: number;
  partTimeOverPay: number;
}

/** 가산 계산(5명 이상 기준). 1~4명이면 화면에서 0원으로 두고 "5명 이상이면?" 참고값으로만 쓴다. */
export function premiumsFor(days: DayCalc[], weekDays: Map<ISODate, DayCalc[]>, contractWeekly: (weekEnd: ISODate) => number, inPeriod: (d: ISODate) => boolean, date: ISODate): PremiumBreakdown {
  const otRate = ruleValue<number>('premium.overtime', date);
  const nightRate = ruleValue<{ rate: number }>('premium.night', date).rate;
  const hol = ruleValue<{ within8h: number; over8h: number }>('premium.holiday', date);
  const ptRate = ruleValue<{ premium: number }>('fixedTerm.partTimeOvertime', date).premium;
  const out: PremiumBreakdown = { overtimeMin: 0, overtimePay: 0, nightMin: 0, nightPay: 0, holidayWithin8Min: 0, holidayOver8Min: 0, holidayPay: 0, partTimeOverMin: 0, partTimeOverPay: 0 };
  for (const d of days) {
    if (!inPeriod(d.date)) continue;
    out.nightMin += d.nightMin;
    out.nightPay += (d.nightMin / 60) * d.wage * nightRate;
    if (d.holiday && d.netMin > 0) {
      const w8 = Math.min(d.netMin, 480);
      const o8 = Math.max(0, d.netMin - 480);
      out.holidayWithin8Min += w8;
      out.holidayOver8Min += o8;
      out.holidayPay += (w8 / 60) * d.wage * hol.within8h + (o8 / 60) * d.wage * hol.over8h;
    }
  }
  // 주 단위: 연장(1일 8시간·주 40시간 초과, 휴일근로 제외), 단시간 초과(소정 초과분). 주는 일요일이 속한 기간에 귀속.
  for (const [weekEnd, wdays] of weekDays) {
    const work = wdays.filter((d) => !d.holiday);
    let dailyOT = 0;
    let regular = 0;
    let ptOver = 0;
    for (const d of work) {
      const ot = Math.max(0, d.netMin - 480);
      if (inPeriod(d.date)) dailyOT += ot;
      regular += Math.min(d.netMin, 480);
      ptOver += Math.max(0, Math.min(d.netMin, 480) - d.contractMin);
    }
    const weeklyOT = inPeriod(weekEnd) ? Math.max(0, regular - 2400) : 0;
    const wageAtEnd = wdays[wdays.length - 1]?.wage ?? 0;
    const dayWage = (dd: ISODate) => wdays.find((x) => x.date === dd)?.wage ?? wageAtEnd;
    for (const d of work) {
      if (!inPeriod(d.date)) continue;
      const ot = Math.max(0, d.netMin - 480);
      out.overtimePay += (ot / 60) * dayWage(d.date) * otRate;
    }
    out.overtimeMin += dailyOT + weeklyOT;
    out.overtimePay += (weeklyOT / 60) * wageAtEnd * otRate;
    const cw = contractWeekly(weekEnd);
    if (cw > 0 && cw < 40 && inPeriod(weekEnd)) {
      const pt = Math.max(0, ptOver - weeklyOT);
      out.partTimeOverMin += pt;
      out.partTimeOverPay += (pt / 60) * wageAtEnd * ptRate;
    }
  }
  return out;
}

export function payDateFor(month: string, payDay: number, basis: 'previous' | 'current'): ISODate {
  const target = basis === 'previous' ? monthOf(addDays(`${month}-28`, 7)) : month;
  const [y, m] = target.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${target}-${String(Math.min(payDay, last)).padStart(2, '0')}`;
}

export interface PayrollInput {
  state: AppState;
  employee: Employee;
  from: ISODate;
  to: ISODate;
  payDate: ISODate;
  scale: ScaleBand;
  manual?: PayrollManual | null;
  /** 퇴직금 평균임금 계산처럼 공제 없이 지급액만 필요할 때 */
  grossOnly?: boolean;
}

export function computePayrollLine(input: PayrollInput): PayrollLine {
  const { state, employee: e, scale } = input;
  const from = maxDate(input.from, e.hireDate);
  const to = e.resignDate ? minDate(input.to, e.resignDate) : input.to;
  const refDate = input.to;
  const under5 = isUnder5(scale);
  const warnings: PayrollWarning[] = [];
  const items: PayrollItem[] = [];
  const inPeriod = (d: ISODate) => d >= from && d <= to;

  // 근무일 계산 — 주 단위 연장 판단을 위해 기간 앞뒤 주까지 포함
  const calcStart = startOfWeek(from);
  const calcEnd = addDays(startOfWeek(to), 6);
  const allDays: DayCalc[] = [];
  if (from <= to) {
    for (const d of listDates(calcStart, calcEnd)) {
      const c = dayCalc(state, e, d, scale);
      if (c) allDays.push(c);
    }
  }
  const days = allDays.filter((d) => inPeriod(d.date));
  const weekMap = new Map<ISODate, DayCalc[]>();
  for (const d of allDays) {
    const we = addDays(startOfWeek(d.date), 6);
    if (!weekMap.has(we)) weekMap.set(we, []);
    weekMap.get(we)!.push(d);
  }

  // 기본급
  const workedMin = days.reduce((s, d) => s + d.netMin, 0);
  const basePay = days.reduce((s, d) => s + d.basePay, 0);
  const wages = Array.from(new Set(days.filter((d) => d.netMin > 0 || d.paidOffMin > 0).map((d) => d.wage)));
  const wageText = wages.length <= 1 ? `${(wages[0] ?? conditionAt(state.conditions, e.id, to)?.hourlyWage ?? 0).toLocaleString('ko-KR')}원` : wages.map((w) => `${w.toLocaleString('ko-KR')}원`).join(' → ');
  items.push({
    code: 'base',
    label: '기본급',
    amount: won(basePay),
    formula: `확정 근무 ${(workedMin / 60).toFixed(1).replace(/\.0$/, '')}시간 × ${wageText}`,
    basis: ['minimumWage.hourly'],
  });

  // 최저임금 (근무일 기준)
  const belowDays = days.filter((d) => d.netMin > 0 && checkMinimumWage(d.wage, d.date).status === 'below');
  if (belowDays.length) {
    const req = checkMinimumWage(belowDays[0].wage, belowDays[0].date).required;
    warnings.push({ level: 'risk', text: `최저임금 미달 ${belowDays.length}일 — 시급 ${belowDays[0].wage.toLocaleString('ko-KR')}원 < ${req?.toLocaleString('ko-KR')}원 (${fmtMD(belowDays[0].date)}부터)`, basis: ['minimumWage.hourly'] });
  }
  const noRuleDays = days.filter((d) => d.netMin > 0 && checkMinimumWage(d.wage, d.date).status === 'noRule');
  if (noRuleDays.length) warnings.push({ level: 'check', text: `${fmtMD(noRuleDays[0].date)} 등 ${noRuleDays.length}일은 최저임금 기준이 아직 발표되지 않았어요`, basis: ['minimumWage.hourly'] });

  // 주휴수당
  const whRows: WeeklyHolidayRow[] = [];
  let whPay = 0;
  const cond = (d: ISODate) => conditionAt(state.conditions, e.id, d);
  for (const [weekEnd, wdays] of weekMap) {
    if (!inPeriod(weekEnd) && !(e.resignDate && weekEnd > to && inPeriod(e.resignDate))) continue;
    const weekStart = addDays(weekEnd, -6);
    const c = cond(minDate(weekEnd, to));
    if (!c) continue;
    const flags: string[] = [];
    const employedDays = wdays.filter((d) => d.date >= e.hireDate && (!e.resignDate || d.date <= e.resignDate));
    let sched: number;
    if (c.variable) {
      sched = employedDays.reduce((s, d) => s + d.netMin, 0) / 60;
      flags.push('매주 달라요 — 실제 근무로 계산, 확인 필요');
    } else {
      sched = employedDays.reduce((s, d) => s + d.contractMin, 0) / 60;
    }
    if (weekStart < e.hireDate) flags.push('입사한 주 — 근무한 날 기준 비례, 확인 필요');
    // 4주 평균 (계약상 주 소정근로시간 기준, 매주 달라요는 실제 근무)
    const hist: number[] = [c.variable ? sched : weeklyHours(c)];
    for (let k = 1; k <= 3; k++) {
      const ws = addDays(weekStart, -7 * k);
      if (addDays(ws, 6) < e.hireDate) break;
      const ck = cond(addDays(ws, 6));
      hist.push(ck ? (ck.variable ? ck.variableWeeklyHours ?? 0 : weeklyHours(ck)) : 0);
    }
    const avg4w = hist.reduce((a, b) => a + b, 0) / hist.length;
    const plans = employedDays.map((d) => dayPlan(state, e, d.date));
    const absent = plans.some((p) => p.off === 'absent');
    const subs = plans.some((p) => p.overrides.some((o) => o.kind === 'subIn' || o.kind === 'subOut'));
    if (subs) flags.push('대타로 바뀐 날 포함 — 근무일 변경으로 처리, 확인 필요');
    const minH = ruleValue<number>('weeklyHoliday.minWeeklyHours', weekEnd);
    const eligible = avg4w >= minH && !absent && sched > 0;
    const hours = eligible ? (Math.min(sched, 40) / 40) * 8 : 0;
    const wageW = c.hourlyWage;
    let included = eligible;
    if (e.resignDate && e.resignDate >= weekStart && e.resignDate < weekEnd) {
      flags.push(RESIGN_WEEK_FLAG);
      included = false;
    }
    if (absent) flags.push('결근 있음 — 개근 요건 미충족');
    if (avg4w < minH) flags.push(`4주 평균 ${avg4w.toFixed(1)}시간 < ${minH}시간`);
    const amount = won(hours * wageW);
    if (included) whPay += amount;
    whRows.push({ weekStart, weekEnd, scheduledHours: Math.round(sched * 100) / 100, avg4w: Math.round(avg4w * 100) / 100, perfectAttendance: !absent, eligible, included, hours: Math.round(hours * 100) / 100, amount, flags });
  }
  whRows.sort((a, b) => (a.weekEnd < b.weekEnd ? -1 : 1));
  items.push({
    code: 'weeklyHoliday',
    label: '주휴수당',
    amount: won(whPay),
    formula: whRows.filter((r) => r.included).length
      ? whRows.filter((r) => r.included).map((r) => `주 ${r.scheduledHours}시간→${r.hours}시간`).join(' + ')
      : '대상 주 없음',
    basis: ['weeklyHoliday.minWeeklyHours', 'weeklyHoliday.paidHours'],
  });
  if (whRows.some((r) => r.flags.includes(RESIGN_WEEK_FLAG))) warnings.push({ level: 'check', text: '퇴사하는 주의 주휴수당은 자동으로 넣지 않았어요. 지급 여부는 전문가와 확인해 주세요', basis: ['weeklyHoliday.paidHours'] });

  // 가산
  const contractWeekly = (we: ISODate) => {
    const c = cond(we);
    return c && !c.variable ? weeklyHours(c) : 0;
  };
  const prem = premiumsFor(allDays, weekMap, contractWeekly, inPeriod, refDate);
  const premTotal = prem.overtimePay + prem.nightPay + prem.holidayPay + prem.partTimeOverPay;
  if (under5) {
    items.push({
      code: 'premium',
      label: '연장·야간·휴일 가산',
      amount: 0,
      formula: '1~4명 사업장은 가산 미적용',
      basis: ['scope.under5.appliedArticles'],
      note: `상시 4명 이하 사업장은 연장·야간·휴일 가산분이 적용되지 않아요. 일한 시간의 임금은 그대로 드려야 해요.${premTotal > 0 ? ` (5명 이상이었다면 약 ${won(premTotal).toLocaleString('ko-KR')}원)` : ''}`,
    });
  } else {
    if (prem.overtimeMin) items.push({ code: 'overtime', label: '연장 가산', amount: won(prem.overtimePay), formula: `${(prem.overtimeMin / 60).toFixed(1)}시간 × 시급 × 50%`, basis: ['premium.overtime'] });
    if (prem.nightMin) items.push({ code: 'night', label: '야간 가산', amount: won(prem.nightPay), formula: `${(prem.nightMin / 60).toFixed(1)}시간(22~06시) × 시급 × 50%`, basis: ['premium.night'] });
    if (prem.holidayWithin8Min || prem.holidayOver8Min) items.push({ code: 'holiday', label: '휴일 가산', amount: won(prem.holidayPay), formula: `8시간 이내 ${(prem.holidayWithin8Min / 60).toFixed(1)}시간 × 50% + 초과 ${(prem.holidayOver8Min / 60).toFixed(1)}시간 × 100%`, basis: ['premium.holiday'] });
    if (prem.partTimeOverMin) items.push({ code: 'partTimeOver', label: '단시간 초과근로 가산', amount: won(prem.partTimeOverPay), formula: `소정근로시간 초과 ${(prem.partTimeOverMin / 60).toFixed(1)}시간 × 시급 × 50% (근사)`, basis: ['fixedTerm.partTimeOvertime'] });
    if (!prem.overtimeMin && !prem.nightMin && !prem.holidayWithin8Min && !prem.holidayOver8Min && !prem.partTimeOverMin)
      items.push({ code: 'premium', label: '연장·야간·휴일 가산', amount: 0, formula: '해당 근무 없음', basis: ['premium.overtime', 'premium.night', 'premium.holiday'] });
  }

  // 공휴일 유급·연차 사용일 유급 (5명 이상)
  const phMin = days.filter((d) => d.paidOffKind === 'publicHoliday').reduce((s, d) => s + d.paidOffMin, 0);
  const lvMin = days.filter((d) => d.paidOffKind === 'leave').reduce((s, d) => s + d.paidOffMin, 0);
  const phPay = days.filter((d) => d.paidOffKind === 'publicHoliday').reduce((s, d) => s + (d.paidOffMin / 60) * d.wage, 0);
  const lvPay = days.filter((d) => d.paidOffKind === 'leave').reduce((s, d) => s + (d.paidOffMin / 60) * d.wage, 0);
  if (phMin) items.push({ code: 'publicHoliday', label: '공휴일 유급', amount: won(phPay), formula: `${(phMin / 60).toFixed(1)}시간 × 시급`, basis: ['holidays.legal'] });
  if (lvMin) items.push({ code: 'leavePay', label: '연차 사용일 유급', amount: won(lvPay), formula: `${(lvMin / 60).toFixed(1)}시간 × 시급`, basis: ['annualLeave.accrual'] });
  if (under5 && days.some((d) => dayPlan(state, e, d.date).off === 'leave')) warnings.push({ level: 'info', text: '1~4명 사업장은 연차 규정 미적용 — 연차로 표시한 날은 무급으로 계산했어요', basis: ['scope.under5.appliedArticles'] });

  // 식대 (월 고정, 근무 기간 비례)
  const lastCond = cond(to);
  let taxFree = 0;
  if (lastCond?.mealAllowance) {
    const periodDays = diffDays(input.from, input.to) + 1;
    const employedDays = Math.max(0, diffDays(from, to) + 1);
    const meal = won((lastCond.mealAllowance * employedDays) / periodDays);
    const limit = ruleValue<number>('tax.mealAllowanceNonTaxable', refDate);
    taxFree = Math.min(meal, limit);
    items.push({ code: 'meal', label: '식대', amount: meal, formula: employedDays < periodDays ? `월 ${lastCond.mealAllowance.toLocaleString('ko-KR')}원 × ${employedDays}/${periodDays}일` : `월 고정`, basis: ['tax.mealAllowanceNonTaxable'], note: `월 ${limit.toLocaleString('ko-KR')}원까지 비과세` });
  }

  // 수동 조정
  for (const adj of input.manual?.adjustments ?? []) {
    items.push({ code: 'adjust', label: adj.label || '조정', amount: won(adj.amount), formula: '사장님 직접 입력', basis: [] });
  }

  const gross = items.reduce((s, i) => s + i.amount, 0);

  // 수습·연소자·대기 등 자동으로 판단하지 않는 것
  if (e.probationEnd && e.probationEnd >= from) warnings.push({ level: 'check', text: '수습 중 — 감액하지 않고 계산했어요. 감액 가능 여부는 전문가와 확인해 주세요', basis: ['minimumWage.probation'] });
  const pendingDays = days.filter((d) => d.pending).map((d) => d.date);
  if (pendingDays.length) warnings.push({ level: 'check', text: `확인 대기 근무 ${pendingDays.length}일 — 확인하기 전까지는 예정 시간으로 계산해요`, basis: [] });
  if (lastCond?.variable) warnings.push({ level: 'check', text: '매주 달라요 — 입력한 실제 근무로 계산했어요', basis: [] });
  if (e.ageBand === 'under18') warnings.push({ level: 'info', text: '18세 미만 — 근무 화면의 시간 한도·야간·휴일 경고를 확인하세요', basis: ['minor.limits'] });

  // 공제
  const deductions: PayrollDeduction[] = [];
  if (!input.grossOnly) {
    const month = monthOf(to);
    const prem3 = employeeMonthlyPremiums(state, e, month, to);
    for (const p of prem3) deductions.push(p);
    if (e.employmentType === 'daily') {
      const perDay = new Map<ISODate, number>();
      for (const d of days) perDay.set(d.date, (perDay.get(d.date) ?? 0) + d.basePay);
      let tax = 0;
      for (const [dd, pay] of perDay) tax += dailyWorkerIncomeTax(won(pay), dd);
      deductions.push({ code: 'incomeTax', label: '소득세 (일용)', amount: tax, source: 'dailyFormula', note: '(1일 지급액 − 15만 원) × 6% − 산출세액의 55%' });
    } else {
      const mt = input.manual?.incomeTax;
      deductions.push(
        mt != null
          ? { code: 'incomeTax', label: '소득세', amount: mt, source: 'manual', note: '사장님 직접 입력' }
          : { code: 'incomeTax', label: '소득세', amount: null, source: 'missing', note: '직접 입력해 주세요 (세무 전문가 확인 권장)' },
      );
    }
    // 지방소득세: 사장님이 직접 넣은 값이 우선, 없으면 소득세의 10% (10원 미만 절사)
    const lt = input.manual?.localTax;
    const it = deductions.find((d) => d.code === 'incomeTax')?.amount ?? null;
    deductions.push(
      lt != null
        ? { code: 'localTax', label: '지방소득세', amount: lt, source: 'manual', note: '사장님 직접 입력' }
        : it != null
          ? { code: 'localTax', label: '지방소득세', amount: localIncomeTax(it), source: 'estimate', note: LOCAL_TAX_NOTE }
          : { code: 'localTax', label: '지방소득세', amount: null, source: 'missing', note: '소득세를 입력하면 자동으로 계산해요' },
    );
  }
  const deductionTotal = deductions.reduce((s, d) => s + (d.amount ?? 0), 0);
  const netComplete = deductions.every((d) => d.amount !== null);

  const ruleIds = Array.from(new Set(items.flatMap((i) => i.basis).concat(['minimumWage.hourly'])));
  const ruleRefs = ruleIds.map((id) => {
    const r = resolveRule(id, refDate);
    return { id, status: r.ok ? r.status : r.reason, verifiedAt: r.ok ? r.verifiedAt : undefined };
  });

  return {
    employeeId: e.id,
    alias: e.alias,
    period: { from: input.from, to: input.to },
    payDate: input.payDate,
    hours: {
      worked: workedMin / 60,
      night: prem.nightMin / 60,
      overtime: prem.overtimeMin / 60,
      holidayWithin8: prem.holidayWithin8Min / 60,
      holidayOver8: prem.holidayOver8Min / 60,
      partTimeOver: prem.partTimeOverMin / 60,
      paidLeave: lvMin / 60,
      paidPublicHoliday: phMin / 60,
    },
    workDays: days.filter((d) => d.netMin > 0).length,
    wageText,
    items,
    gross,
    taxFree,
    deductions,
    deductionTotal,
    net: gross - deductionTotal,
    netComplete,
    warnings,
    pendingDays,
    weeklyHolidayDetail: whRows,
    ruleRefs,
  };
}

// ---- 빠른 계산 (채용 전 점검 S02, 저장하지 않음) ----

export interface QuickInput {
  hourlyWage: number;
  schedule: ({ start: string; end: string; breakMin: number } | null)[];
  scale: ScaleBand;
  date: ISODate;
}

export interface QuickResult {
  weeklyHours: number;
  minWage: MinWageCheck;
  weeklyHolidayHours: number;
  weeklyHolidayPay: number;
  monthlyHours: number;
  monthlyPay: number;
  weeklyPremiumIf5: number;
  weeklyPremium: number;
  nightHoursWeekly: number;
  breakIssues: string[];
}

export function quickWage(q: QuickInput): QuickResult {
  const wh = q.schedule.reduce((s, d) => s + (d ? netMinutes(d) : 0), 0) / 60;
  const whh = weeklyHolidayHours(wh, q.date);
  const night = q.schedule.reduce((s, d) => s + (d ? Math.min(netMinutes(d), nightOverlapMinutes(d.start, d.end)) : 0), 0) / 60;
  const daily = q.schedule.reduce((s, d) => s + (d ? Math.max(0, netMinutes(d) - 480) : 0), 0) / 60;
  const regular = q.schedule.reduce((s, d) => s + (d ? Math.min(netMinutes(d), 480) : 0), 0) / 60;
  const weeklyOT = Math.max(0, regular - 40);
  const otRate = ruleValue<number>('premium.overtime', q.date);
  const nightRate = ruleValue<{ rate: number }>('premium.night', q.date).rate;
  const premIf5 = (daily + weeklyOT) * q.hourlyWage * otRate + night * q.hourlyWage * nightRate;
  const breakRule = resolveRule<{ per4h: number; per8h: number }>('break.minimum', q.date);
  const breakIssues: string[] = [];
  if (breakRule.ok) {
    q.schedule.forEach((d, i) => {
      if (!d) return;
      const gross = netMinutes({ ...d, breakMin: 0 });
      const need = gross >= 480 ? breakRule.value.per8h : gross >= 240 ? breakRule.value.per4h : 0;
      if (d.breakMin < need) breakIssues.push(`${['월', '화', '수', '목', '금', '토', '일'][i]}요일 휴게 ${d.breakMin}분 < 최소 ${need}분`);
    });
  }
  const mh = monthlyHours(wh, q.date);
  const prem = isUnder5(q.scale) ? 0 : premIf5;
  return {
    weeklyHours: wh,
    minWage: checkMinimumWage(q.hourlyWage, q.date),
    weeklyHolidayHours: whh,
    weeklyHolidayPay: won(whh * q.hourlyWage),
    monthlyHours: mh,
    monthlyPay: won(mh * q.hourlyWage + (prem * 365) / 7 / 12),
    weeklyPremiumIf5: won(premIf5),
    weeklyPremium: won(prem),
    nightHoursWeekly: night,
    breakIssues,
  };
}

