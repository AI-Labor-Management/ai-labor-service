// Edge Function `api` — 로그인한 사장님·직원용 서버 API
// 계산은 프론트엔드와 같은 계산 엔진(src/domain 묶음)으로 하고, 권한은 여기서 확인한 뒤 서비스 역할로 읽고 쓴다.
// 단순 입력(서류 상태·위험 점검 답·기한 처리·바쁜 날 등)은 PostgREST + RLS로 직접 쓰고,
// 계산·여러 테이블·알림이 함께 움직이는 일만 이 API를 거친다.
import { engine as E } from '../_shared/engine.ts';
import type { AppState, DaySchedule, Employee, PayrollLine } from '../_shared/domain-types.ts';
import { stateToInsertPlan, INSERT_ORDER } from '../_shared/mapping.ts';
import { type Db, kstNowHHMM, kstToday, loadWorkplace, must, ownerWorkplace, pushNotification, requireUser, serviceClient, userClient } from '../_shared/db.ts';
import { bad, conflict, corsHeaders, forbidden, handleError, HttpError, int, json, notFound, oneOf, readJson, str, subPath, text, uuid } from '../_shared/http.ts';

import { AI_DAILY_LIMIT, aiConfigured, aiProvider, askClaude } from './ai.ts';
import { askGemini, checkGemini, GEMINI_POLICY_FROM } from './gemini.ts';
import { buildCorpus } from './ai-ground.ts';
import * as K from '../_shared/kakao.ts';
import { checkDataGoKr, ensureHolidays } from '../_shared/datagokr.ts';
import { checkLawApi, lastLawWatchAt, lawApiConfigured, runLawWatch } from '../_shared/lawapi.ts';
import { ownerClockQr, reissuePoster, verifyClockQr } from '../_shared/clockqr.ts';

type Body = Record<string, unknown>;
type User = { id: string; email: string | null; token: string };

const iso = (v: unknown, name: string) => {
  if (!E.isISODate(v)) throw bad(`${name}은(는) YYYY-MM-DD 형식이어야 해요`);
  return v as string;
};
const hhmm = (v: unknown, name: string) => {
  if (!E.isHHMM(v)) throw bad(`${name}은(는) HH:MM 형식이어야 해요`);
  return v as string;
};
const ym = (v: unknown) => {
  if (typeof v !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(v)) throw bad('month는 YYYY-MM 형식이어야 해요');
  return v;
};
const fmtMD = (d: string) => E.fmtMD(d);

function schedule(v: unknown): (DaySchedule | null)[] {
  if (!Array.isArray(v) || v.length !== 7) throw bad('schedule은 월~일 7칸 배열이어야 해요');
  return v.map((d, i) => {
    if (d === null) return null;
    const o = d as Record<string, unknown>;
    const breakMin = int(o.breakMin ?? 0, `schedule[${i}].breakMin`, 0, 600);
    return { start: hhmm(o.start, `schedule[${i}].start`), end: hhmm(o.end, `schedule[${i}].end`), breakMin };
  });
}

// ───────────────────────── 컨텍스트 ─────────────────────────
async function ownerCtx(db: Db, user: User) {
  const wp = await ownerWorkplace(db, user.id);
  if (!wp) throw notFound('사업장이 없어요. 먼저 사업장을 만들거나 POST /owner/seed-demo로 가상 시드를 넣으세요');
  const today = kstToday();
  const { rows, state } = await loadWorkplace(db, wp.id, today);
  return { wp, rows, state, base: wp.base_date_override ?? today, today };
}

function empOf(state: AppState, id: string): Employee {
  const e = state.employees.find((x) => x.id === id);
  if (!e) throw notFound('직원을 찾을 수 없어요');
  return e;
}

async function notifyEmployee(db: Db, wpId: string, e: Employee, kind: string, textMsg: string, link = '/employee') {
  if (e.account !== 'joined') return;
  await pushNotification(db, { workplace_id: wpId, recipient: 'employee', employee_id: e.id, kind, text: textMsg, link });
}

// ───────────────────────── 공통 ─────────────────────────
async function me(db: Db, user: User) {
  const [wp, emps, firms, adm] = await Promise.all([
    ownerWorkplace(db, user.id),
    must(db.from('employees').select('id, alias, workplace_id, account_status').eq('user_id', user.id).eq('account_status', 'joined')),
    must(db.from('firm_members').select('firm_id').eq('user_id', user.id)),
    must(db.from('admins').select('user_id').eq('user_id', user.id)),
  ]);
  return {
    userId: user.id,
    roles: {
      owner: wp ? { workplaceId: wp.id, name: wp.name, scale: wp.scale } : null,
      employee: emps.map((e) => ({ employeeId: e.id, alias: e.alias, workplaceId: e.workplace_id })),
      firm: firms.map((f) => f.firm_id),
      admin: adm.length > 0,
    },
  };
}

// ───────────────────────── 계정 ─────────────────────────
/**
 * 회원 탈퇴 (POST account/delete, body {"confirm": "탈퇴"}). 되돌릴 수 없다.
 *  1) 사장님이면 사업장 데이터 전체 삭제 (delete_my_workplace — 확정 급여·명세서 포함)
 *  2) 직원으로 연결된 사업장은 연결만 끊는다 (leave_employee_app — 사장님 쪽 근무·급여 기록은 법정 보관을 위해 유지)
 *  3) 로그인 계정 삭제. 노무법인·관리자 소속은 계정과 함께 지워지고, 남은 작성 기록의 작성자 칸은 비워진다
 */
async function deleteAccount(db: Db, user: User, body: Body) {
  if (body.confirm !== '탈퇴') throw bad('확인 문구가 필요해요 ({"confirm": "탈퇴"})');
  const asUser = userClient(user.token);
  const { error: wpError } = await asUser.rpc('delete_my_workplace');
  if (wpError) throw wpError;
  const links = await must(db.from('employees').select('id').eq('user_id', user.id).eq('account_status', 'joined'));
  for (const link of links) {
    const { error } = await asUser.rpc('leave_employee_app', { p_employee_id: link.id });
    if (error) throw error;
  }
  const { error } = await db.auth.admin.deleteUser(user.id);
  if (error) throw error;
  return { deleted: true, workplaceDeleted: true, employeeLinksRemoved: links.length };
}

// ───────────────────────── 사장님 ─────────────────────────
async function seedDemo(db: Db, user: User, body: Body) {
  const existing = await ownerWorkplace(db, user.id);
  if (existing && body.replace !== true) throw conflict('이미 사업장이 있어요. 지우고 다시 넣으려면 {"replace": true}를 보내세요 (모든 데이터가 지워져요)');
  if (existing) {
    const { error } = await userClient(user.token).rpc('delete_my_workplace');
    if (error) throw error;
  }
  const base = body.baseDate ? iso(body.baseDate, 'baseDate') : kstToday();
  const seed = E.createSeed(base);
  const plan = stateToInsertPlan(seed, user.id, () => crypto.randomUUID());
  plan.workplace.partner_firm_id = (await must(db.from('firms').select('id').order('created_at').limit(1)))[0]?.id ?? null;
  await must(db.from('workplaces').insert(plan.workplace));
  try {
    for (const t of INSERT_ORDER) {
      const rows = plan.rows[t as keyof typeof plan.rows] as unknown[] | undefined;
      if (rows?.length) await must(db.from(t).insert(rows as never));
    }
  } catch (e) {
    await userClient(user.token).rpc('delete_my_workplace');
    throw e;
  }
  return { workplaceId: plan.workplace.id, baseDate: base, employees: plan.rows.employees?.length ?? 0, note: '가상 시드: 카페 샘터(가상), 직원 A·B·C. 직원 계정은 초대 링크(create_invite)로 연결하세요' };
}

async function home(state: AppState, base: string) {
  const todos = E.computeTodos(state, base);
  const month = E.monthOf(base);
  const active = state.employees.filter((e) => !e.resignDate || e.resignDate >= base);
  const lines = E.draftLines(state, month);
  let employer: number | null = 0;
  for (const e of active) {
    const t = E.employeeInsurance(state, e, base).totals.employer;
    employer = t === null || employer === null ? null : employer + t;
  }
  const deadlines = E.computeDeadlines(state, base);
  return {
    base,
    todos,
    areaCounts: E.areaCounts(todos),
    risk: E.evaluateRisk(state, base),
    month: {
      month,
      grossEstimate: lines.reduce((s, l) => s + l.gross, 0),
      employerInsurance: employer,
      employerInsuranceNote: employer === null ? '일부 금액은 기준 없음' : '예상 금액',
      severanceAccrual: active.reduce((s, e) => s + E.estimateSeverance(state, e, base).monthlyAccrual, 0),
      nextPayday: deadlines.find((d) => d.type === 'payday' && d.date >= base) ?? null,
    },
    today: active.map((e) => ({ employeeId: e.id, alias: e.alias, plan: E.dayPlan(state, e, base), record: state.attendance.find((a) => a.employeeId === e.id && a.date === base) ?? null })),
  };
}

async function confirmPayroll(db: Db, ctx: Awaited<ReturnType<typeof ownerCtx>>, body: Body) {
  const month = ym(body.month);
  const { state, wp } = ctx;
  const cur = E.payrollLines(state, month);
  if (cur.confirmed) throw conflict('이미 확정한 급여예요. 바꾸려면 /owner/payroll/edit로 수정 이력을 남기세요');
  const pending = E.pendingAttendanceIn(state, month);
  if (pending.length && body.allowPending !== true) {
    throw conflict('확인 대기 근무가 남아 있어요. 그대로 확정하려면 {"allowPending": true}를 보내세요 (그 날은 예정 시간으로 계산)');
  }
  const snap = E.draftLines(state, month);
  if (!snap.length) throw bad('이 기간에 근무한 직원이 없어요');
  let pm = (await must(db.from('payroll_months').select('*').eq('workplace_id', wp.id).eq('month', month)))[0];
  if (!pm) pm = await must(db.from('payroll_months').insert({ workplace_id: wp.id, month, status: 'draft', scale_confirmed: wp.scale }).select('*').single());
  // 상태가 draft일 때만 확정 — 두 번 눌러도 한 번만 된다
  const updated = await must(
    db.from('payroll_months')
      .update({ status: 'confirmed', confirmed_at: new Date().toISOString(), confirmed_with_pending: pending.map((a) => a.date), revision: 1, scale_confirmed: pm.scale_confirmed ?? wp.scale })
      .eq('id', pm.id).eq('status', 'draft').select('id'),
  );
  if (!updated.length) throw conflict('이미 확정한 급여예요');
  await must(db.from('payroll_lines').insert(snap.map((l) => ({ payroll_id: pm.id, workplace_id: wp.id, employee_id: l.employeeId, revision: 1, line: l as never, gross: l.gross, deduction_total: l.deductionTotal, net: l.net, net_complete: l.netComplete }))));
  const deliveries = snap.map((l) => {
    const e = empOf(state, l.employeeId);
    return { payroll_id: pm.id, workplace_id: wp.id, employee_id: e.id, revision: 1, method: e.account === 'joined' ? 'app' : 'print' };
  });
  await must(db.from('statement_deliveries').insert(deliveries));
  for (const l of snap) await notifyEmployee(db, wp.id, empOf(state, l.employeeId), 'statement', `${month.replace('-', '년 ')}월분 임금명세서가 도착했어요`, '/employee/pay');
  return { month, payrollId: pm.id, confirmed: true, lines: snap.length, gross: snap.reduce((s, l) => s + l.gross, 0), confirmedWithPending: pending.map((a) => a.date), statements: deliveries.map((d) => ({ employeeId: d.employee_id, method: d.method })) };
}

async function editPayroll(db: Db, ctx: Awaited<ReturnType<typeof ownerCtx>>, body: Body) {
  const month = ym(body.month);
  const employeeId = uuid(body.employeeId, 'employeeId');
  const kind = oneOf(body.kind, 'kind', ['adjust', 'incomeTax', 'localTax'] as const);
  const amount = int(body.amount, 'amount', -100_000_000, 100_000_000);
  const reason = str(body.reason, '수정 사유', 200);
  if (/벌금|파손|지각비/.test(String(body.label ?? '') + reason) && amount < 0) throw bad('지각 벌금·파손 비용은 공제할 수 없어요 (근로기준법 제20조·제43조)');
  const { state, wp } = ctx;
  const p = state.payrolls.find((x) => x.month === month);
  if (!p || p.status !== 'confirmed') throw bad('확정한 급여만 수정 이력으로 고칠 수 있어요 (초안은 payroll_manual에 입력)');
  const old = p.confirmedLines?.find((l) => l.employeeId === employeeId);
  if (!old) throw notFound('이 급여월에 해당 직원의 줄이 없어요');
  const line: PayrollLine = structuredClone(old);
  let before = '';
  let after = '';
  if (kind === 'adjust') {
    const label = str(body.label, '항목 이름', 40);
    line.items.push({ code: 'adjust', label, amount, formula: `확정 후 수정 · ${reason}`, basis: [] });
    before = '—';
    after = `${label} ${amount.toLocaleString('ko-KR')}원`;
  } else {
    if (amount < 0) throw bad('세금은 0 이상이어야 해요');
    const d = line.deductions.find((x) => x.code === kind);
    if (!d) throw bad('공제 항목을 찾을 수 없어요');
    before = d.amount === null ? '미정' : String(d.amount);
    d.amount = amount;
    d.source = 'manual';
    d.note = '확정 후 사장님 입력';
    after = String(amount);
  }
  line.gross = line.items.reduce((s, i) => s + i.amount, 0);
  line.deductionTotal = line.deductions.reduce((s, d) => s + (d.amount ?? 0), 0);
  line.net = line.gross - line.deductionTotal;
  line.netComplete = line.deductions.every((d) => d.amount !== null);
  const pm = (await must(db.from('payroll_months').select('*').eq('workplace_id', wp.id).eq('month', month).single()));
  const revision = pm.revision + 1;
  await must(db.from('payroll_months').update({ revision }).eq('id', pm.id).eq('revision', pm.revision).select('id'));
  await must(db.from('payroll_lines').insert({ payroll_id: pm.id, workplace_id: wp.id, employee_id: employeeId, revision, line: line as never, gross: line.gross, deduction_total: line.deductionTotal, net: line.net, net_complete: line.netComplete }));
  await must(db.from('payroll_edits').insert({ payroll_id: pm.id, workplace_id: wp.id, employee_id: employeeId, field: kind === 'adjust' ? '조정 항목 추가' : kind === 'incomeTax' ? '소득세' : '지방소득세', before_value: before, after_value: after, reason }));
  const e = empOf(state, employeeId);
  await must(db.from('statement_deliveries').insert({ payroll_id: pm.id, workplace_id: wp.id, employee_id: employeeId, revision, method: e.account === 'joined' ? 'app' : 'print' }));
  await notifyEmployee(db, wp.id, e, 'statement', `${month}분 임금명세서가 수정됐어요 · 사유: ${reason}`, '/employee/pay');
  return { month, employeeId, revision, line };
}

async function addCondition(db: Db, ctx: Awaited<ReturnType<typeof ownerCtx>>, body: Body) {
  const { state, wp } = ctx;
  const e = empOf(state, uuid(body.employeeId, 'employeeId'));
  const effectiveFrom = iso(body.effectiveFrom, 'effectiveFrom');
  if (effectiveFrom < e.hireDate) throw bad('입사일보다 이른 적용일은 고를 수 없어요');
  const hourlyWage = int(body.hourlyWage, 'hourlyWage', 1, 1_000_000);
  const variable = body.variable === true;
  const sched = variable ? [null, null, null, null, null, null, null] : schedule(body.schedule);
  if (!variable && !sched.some(Boolean)) throw bad('근무 요일을 하나 이상 넣거나 variable=true로 보내세요');
  const variableWeeklyHours = variable ? Number(body.variableWeeklyHours) : null;
  if (variable && !(variableWeeklyHours! > 0)) throw bad('매주 달라요는 variableWeeklyHours(주 평균 예상 시간)가 필요해요');
  const reason = str(body.reason, '변경 사유', 100);
  const row = await must(db.from('work_conditions').insert({
    workplace_id: wp.id,
    employee_id: e.id,
    effective_from: effectiveFrom,
    hourly_wage: hourlyWage,
    schedule: sched as never,
    variable,
    variable_weekly_hours: variableWeeklyHours,
    weekly_holiday_day: int(body.weeklyHolidayDay ?? 6, 'weeklyHolidayDay', 0, 6),
    job: str(body.job, '하는 일', 60, false),
    meal_allowance: int(body.mealAllowance ?? 0, 'mealAllowance', 0, 10_000_000),
    break_waiver_requested: body.breakWaiverRequested === true,
    reason,
  }).select('*').single());
  await notifyEmployee(db, wp.id, e, 'conditionRecheck', `근로조건이 ${effectiveFrom.replaceAll('-', '.')}부터 바뀌어요. 확인해 주세요.`, '/employee/join');
  const touchesConfirmed = state.payrolls.some((p) => p.status === 'confirmed' && p.confirmedLines?.some((l) => l.employeeId === e.id && l.period.to >= effectiveFrom));
  return {
    condition: row,
    minimumWage: E.checkMinimumWage(hourlyWage, effectiveFrom),
    notes: [
      '변경 계약서(E1) 할 일이 서류 체크리스트에 생겨요',
      ...(touchesConfirmed ? ['적용일이 이미 확정한 급여 기간에 걸쳐요. 확정분은 바뀌지 않아요 (필요하면 /owner/payroll/edit)'] : []),
    ],
  };
}

async function scheduleOverride(db: Db, ctx: Awaited<ReturnType<typeof ownerCtx>>, body: Body) {
  const { state, wp } = ctx;
  const e = empOf(state, uuid(body.employeeId, 'employeeId'));
  const date = iso(body.date, 'date');
  if (date < e.hireDate || (e.resignDate && date > e.resignDate)) throw bad('재직 기간이 아닌 날이에요');
  const kind = oneOf(body.kind, 'kind', ['change', 'extra', 'absent', 'leave', 'sub', 'reset'] as const);
  const memo = str(body.memo, 'memo', 100, false);
  const plan = E.dayPlan(state, e, date);
  if (kind === 'leave' && E.isUnder5(wp.scale as never)) throw bad('1~4명 사업장은 연차 규정이 적용되지 않아요');
  if ((kind === 'absent' || kind === 'sub') && !plan.shift) throw bad('그날 예정 근무가 없어요');
  await must(db.from('shift_overrides').delete().eq('employee_id', e.id).eq('date', date).neq('kind', 'subIn'));
  const base = { workplace_id: wp.id, employee_id: e.id, date, memo };
  if (kind === 'change' || kind === 'extra') {
    await must(db.from('shift_overrides').insert({ ...base, kind, start_time: hhmm(body.start, 'start'), end_time: hhmm(body.end, 'end'), break_min: int(body.breakMin ?? 0, 'breakMin', 0, 600) }));
  } else if (kind === 'absent' || kind === 'leave') {
    await must(db.from('shift_overrides').insert({ ...base, kind }));
  } else if (kind === 'sub') {
    const to = empOf(state, uuid(body.substituteEmployeeId, 'substituteEmployeeId'));
    if (to.id === e.id) throw bad('같은 직원으로는 대타를 지정할 수 없어요');
    const sub = await must(db.from('substitutions').insert({ workplace_id: wp.id, date, from_employee_id: e.id, to_employee_id: to.id, mode: 'owner', status: 'approved', memo, decided_at: new Date().toISOString() }).select('id').single());
    await must(db.from('shift_overrides').insert([
      { ...base, kind: 'subOut', substitution_id: sub.id },
      { ...base, employee_id: to.id, kind: 'subIn', start_time: plan.shift!.start, end_time: plan.shift!.end, break_min: plan.shift!.breakMin, substitution_id: sub.id },
    ]));
    await notifyEmployee(db, wp.id, to, 'schedule', `${fmtMD(date)} ${plan.shift!.start}–${plan.shift!.end} 대타 근무가 잡혔어요`, '/employee/schedule');
  }
  await notifyEmployee(db, wp.id, e, 'schedule', `${fmtMD(date)} 일정이 바뀌었어요`, '/employee/schedule');
  const after = await loadWorkplace(db, wp.id, ctx.today);
  return { date, employeeId: e.id, plan: E.dayPlan(after.state, empOf(after.state, e.id), date) };
}

async function attendanceDecide(db: Db, ctx: Awaited<ReturnType<typeof ownerCtx>>, body: Body) {
  const { state, wp } = ctx;
  const rec = state.attendance.find((a) => a.id === uuid(body.recordId, 'recordId'));
  if (!rec) throw notFound('출퇴근 기록을 찾을 수 없어요');
  const approval = oneOf(body.approval, 'approval', ['actual', 'planned'] as const);
  if (approval === 'actual' && (!rec.original.clockIn || !rec.original.clockOut)) throw bad('출근·퇴근 시간이 모두 있어야 해요 — /owner/attendance/edit로 입력하세요');
  await must(db.from('attendance_records').update({ status: 'confirmed', approval, confirmed_at: new Date().toISOString() }).eq('id', rec.id));
  await notifyEmployee(db, wp.id, empOf(state, rec.employeeId), 'attendance', `${fmtMD(rec.date)} 출퇴근 기록을 사장님이 ${approval === 'actual' ? '기록 시간대로' : '예정 시간으로'} 확정했어요`, '/employee/schedule');
  return { recordId: rec.id, status: 'confirmed', approval };
}

async function attendanceEdit(db: Db, user: User, ctx: Awaited<ReturnType<typeof ownerCtx>>, body: Body) {
  const { state, wp } = ctx;
  const rec = state.attendance.find((a) => a.id === uuid(body.recordId, 'recordId'));
  if (!rec) throw notFound('출퇴근 기록을 찾을 수 없어요');
  const clockIn = hhmm(body.clockIn, 'clockIn');
  const clockOut = hhmm(body.clockOut, 'clockOut');
  const reason = str(body.reason, '수정 사유', 200);
  const before = E.currentTimes(rec, state.attendanceEdits);
  await must(db.from('attendance_edits').insert({ workplace_id: wp.id, record_id: rec.id, before_in: before.clockIn, before_out: before.clockOut, after_in: clockIn, after_out: clockOut, reason, by_user: user.id }));
  await must(db.from('attendance_records').update({ status: 'confirmed', approval: 'actual', confirmed_at: new Date().toISOString() }).eq('id', rec.id));
  await notifyEmployee(db, wp.id, empOf(state, rec.employeeId), 'attendanceEdit', `${fmtMD(rec.date)} 출퇴근 기록이 사장님에 의해 수정됐어요 · 사유: ${reason}`, '/employee/schedule');
  return { recordId: rec.id, before, after: { clockIn, clockOut }, original: rec.original };
}

async function attendanceManual(db: Db, ctx: Awaited<ReturnType<typeof ownerCtx>>, body: Body) {
  const { state, wp } = ctx;
  const e = empOf(state, uuid(body.employeeId, 'employeeId'));
  const date = iso(body.date, 'date');
  const clockIn = hhmm(body.clockIn, 'clockIn');
  const clockOut = hhmm(body.clockOut, 'clockOut');
  const reason = str(body.reason, '사유', 200);
  if (state.attendance.some((a) => a.employeeId === e.id && a.date === date)) throw conflict('그날 기록이 이미 있어요 — /owner/attendance/edit로 수정하세요');
  const { data: recordNo, error } = await db.rpc('next_record_no', { p_workplace_id: wp.id, p_date: date });
  if (error) throw error;
  const rec = await must(db.from('attendance_records').insert({ workplace_id: wp.id, employee_id: e.id, record_no: recordNo as string, date, original_clock_in: clockIn, original_clock_out: clockOut, source: 'owner', status: 'confirmed', approval: 'actual', reason, confirmed_at: new Date().toISOString() }).select('*').single());
  await notifyEmployee(db, wp.id, e, 'attendance', `${fmtMD(date)} 출퇴근 기록을 사장님이 직접 남겼어요`, '/employee/schedule');
  return rec;
}

async function substitutionDecide(db: Db, ctx: Awaited<ReturnType<typeof ownerCtx>>, body: Body) {
  const { state, wp } = ctx;
  const s = state.substitutions.find((x) => x.id === uuid(body.id, 'id'));
  if (!s) throw notFound('대타 요청을 찾을 수 없어요');
  if (s.status !== 'applied') throw conflict('승인 대기 상태가 아니에요');
  const approve = body.approve === true;
  const from = empOf(state, s.fromEmployeeId);
  const plan = E.dayPlan(state, from, s.date);
  if (approve && !plan.shift) throw bad('그날 원래 직원의 예정 근무가 없어요');
  const done = await must(db.from('substitutions').update({ status: approve ? 'approved' : 'rejected', decided_at: new Date().toISOString() }).eq('id', s.id).eq('status', 'applied').select('id'));
  if (!done.length) throw conflict('이미 처리했어요');
  if (approve && s.toEmployeeId) {
    await must(db.from('shift_overrides').delete().eq('employee_id', from.id).eq('date', s.date).neq('kind', 'subIn'));
    await must(db.from('shift_overrides').insert([
      { workplace_id: wp.id, employee_id: from.id, date: s.date, kind: 'subOut', memo: '대타 승인', substitution_id: s.id },
      { workplace_id: wp.id, employee_id: s.toEmployeeId, date: s.date, kind: 'subIn', start_time: plan.shift!.start, end_time: plan.shift!.end, break_min: plan.shift!.breakMin, memo: '대타 승인', substitution_id: s.id },
    ]));
  }
  for (const id of [s.fromEmployeeId, s.toEmployeeId]) {
    const e = id ? state.employees.find((x) => x.id === id) : undefined;
    if (e) await notifyEmployee(db, wp.id, e, 'sub', `${fmtMD(s.date)} 대타 ${approve ? '승인' : '거절'}됐어요`, '/employee/schedule');
  }
  return { id: s.id, status: approve ? 'approved' : 'rejected' };
}

async function leaveDecide(db: Db, ctx: Awaited<ReturnType<typeof ownerCtx>>, body: Body) {
  const { state, wp } = ctx;
  const l = state.leaveRequests.find((x) => x.id === uuid(body.id, 'id'));
  if (!l) throw notFound('연차 신청을 찾을 수 없어요');
  if (l.status !== 'requested') throw conflict('이미 처리한 신청이에요');
  const approve = body.approve === true;
  const reason = approve ? '' : str(body.reason, '조정 사유', 200);
  await must(db.from('leave_requests').update({ status: approve ? 'approved' : 'adjust', adjust_reason: reason, decided_at: new Date().toISOString() }).eq('id', l.id).eq('status', 'requested'));
  if (approve && !l.hours) {
    await must(db.from('shift_overrides').delete().eq('employee_id', l.employeeId).eq('date', l.date).neq('kind', 'subIn'));
    await must(db.from('shift_overrides').insert({ workplace_id: wp.id, employee_id: l.employeeId, date: l.date, kind: 'leave', memo: '연차 승인' }));
  }
  await notifyEmployee(db, wp.id, empOf(state, l.employeeId), 'leave', `${fmtMD(l.date)} 연차 ${approve ? '승인' : `조정 요청: ${reason}`}`, '/employee/leave');
  return {
    id: l.id,
    status: approve ? 'approved' : 'adjust',
    note: approve ? null : '시기 변경은 사업 운영에 막대한 지장이 있을 때만 가능해요 (근로기준법 제60조⑤ 단서, 2027.6.10부터 ⑥)',
  };
}

async function sendConsult(db: Db, ctx: Awaited<ReturnType<typeof ownerCtx>>, body: Body) {
  const { state, wp, base } = ctx;
  if (body.consent !== true) throw bad('노무법인 제공 동의(consent: true)가 필요해요');
  const topic = str(body.topic, '상담 주제', 40);
  const question = str(body.question, '질문', 1000, false);
  const shareItems = Array.isArray(body.shareItems) ? (body.shareItems as unknown[]).map((x) => oneOf(x, 'shareItems', ['memo', 'workplace', 'conditions', 'attendance'] as const)) : [];
  if (!shareItems.length) throw bad('보낼 항목을 하나 이상 고르세요');
  const employeeIds = Array.isArray(body.employeeIds) ? (body.employeeIds as unknown[]).map((x) => empOf(state, uuid(x, 'employeeIds')).id) : [];
  if ((shareItems.includes('conditions') || shareItems.includes('attendance')) && !employeeIds.length) throw bad('근로조건·출퇴근을 보내려면 직원을 고르세요');
  const pii = E.detectPII(question);
  if (pii.length) throw bad(`질문에 ${pii.join(', ')}가 들어 있어 보낼 수 없어요`);
  const memo = shareItems.includes('memo') ? E.buildMemo(state, question, E.searchFaq(question)[0]?.faq ?? null, base) : '';
  const since = E.addDays(base, -28);
  const snapshot = {
    workplace: shareItems.includes('workplace') ? { industry: wp.industry, scale: wp.scale } : undefined,
    conditions: shareItems.includes('conditions')
      ? employeeIds.map((id) => {
          const e = empOf(state, id);
          const c = E.conditionAt(state.conditions, id, base);
          return { alias: e.alias, text: c ? `시급 ${c.hourlyWage.toLocaleString('ko-KR')}원 · 주 ${E.weeklyHours(c).toFixed(1)}시간 · 입사 ${e.hireDate}${c.variable ? ' · 매주 달라요' : ''}` : '근로조건 없음' };
        })
      : undefined,
    attendance: shareItems.includes('attendance')
      ? employeeIds.map((id) => ({
          alias: empOf(state, id).alias,
          lines: state.attendance
            .filter((a) => a.employeeId === id && a.date >= since)
            .map((a) => {
              const t = E.currentTimes(a, state.attendanceEdits);
              return `${a.recordNo} ${a.date} ${t.clockIn ?? '—'}~${t.clockOut ?? '—'} ${a.status === 'confirmed' ? '확정' : '확인 대기'}${state.attendanceEdits.some((x) => x.recordId === a.id) ? ' (수정 이력 있음)' : ''}`;
            }),
        }))
      : undefined,
  };
  const firmId = wp.partner_firm_id ?? (await must(db.from('firms').select('id').order('created_at').limit(1)))[0]?.id ?? null;
  const row = await must(db.from('consult_requests').insert({ workplace_id: wp.id, firm_id: firmId, topic, question, memo, share_items: shareItems, employee_ids: employeeIds, snapshot: snapshot as never, consent_at: new Date().toISOString() }).select('id, status, created_at').single());
  return { ...row, sharedItems: shareItems, note: '협력 노무법인 요청함에 저장됐어요. 언제든 revoke_consult로 철회할 수 있어요' };
}

const INDUSTRY_KO: Record<string, string> = { food: '음식점·카페', retail: '소매', service: '기타 서비스업' };
const SCALE_KO: Record<string, string> = { '1-4': '1~4명', '5-9': '5~9명', '10+': '10명 이상' };

/** 무료 Gemini에 넘길 근거 자료 — 오늘 시행 중인 규칙 값과 FAQ (하루에 한 번 만든다) */
let corpusCache: { day: string; docs: ReturnType<typeof buildCorpus> } | null = null;
function aiCorpus(today: string) {
  if (corpusCache?.day !== today) {
    corpusCache = {
      day: today,
      docs: buildCorpus(E.RULES_FILE.rules as never, (id) => E.resolveRule(id, today) as never, E.FAQS as never),
    };
  }
  return corpusCache.docs;
}

/** 운영 점검용 고정 시험 질문 (개인정보 없음, 사용자 입력을 받지 않는다). 성공한 결과는 무료 이용량을 아끼려고 10분 재사용한다 */
const SELF_TEST_QUESTION = '주 15시간 일하는 아르바이트생에게 주휴수당을 줘야 하나요?';
let selfTestCache: { at: number; result: unknown } | null = null;
async function aiSelfTestAnswer(today: string) {
  if (selfTestCache && Date.now() - selfTestCache.at < 600_000) return selfTestCache.result;
  const started = Date.now();
  try {
    const a = await askGemini(SELF_TEST_QUESTION, { industry: '음식점·카페', scale: '1~4명' }, today, aiCorpus(today));
    const result = { ok: true, ms: Date.now() - started, question: SELF_TEST_QUESTION, status: a.status, text: a.text, citations: a.citations };
    selfTestCache = { at: Date.now(), result };
    return result;
  } catch (e) {
    return { ok: false, ms: Date.now() - started, question: SELF_TEST_QUESTION, error: e instanceof HttpError ? e.message : String(e), code: e instanceof HttpError ? e.detail : undefined };
  }
}

/** AI 노무 상담 — 질문 확인(길이·개인정보) → 하루 한도 → 무료 Gemini(근거: 앱 규칙·FAQ) 또는 Claude(웹 검색). 질문·답은 저장하지 않는다 */
async function consultAnswer(db: Db, user: User, body: Body) {
  const question = typeof body.question === 'string' ? body.question.trim() : '';
  if (question.length < 2 || question.length > 500) throw new HttpError(422, '질문은 2~500자로 적어 주세요', { code: 'INVALID_QUESTION' });
  const pii = E.detectPII(question);
  if (pii.length) throw new HttpError(422, `개인정보로 보이는 내용(${pii.join(', ')})을 지우고 다시 물어 주세요`, { code: 'PII_DETECTED' });
  const wp = await ownerWorkplace(db, user.id);
  if (!wp) throw notFound('사업장이 없어요. 먼저 사업장을 만들어 주세요');
  const today = kstToday();
  const provider = aiProvider(today);
  if (!provider) throw new HttpError(503, 'AI 상담이 아직 연결되지 않았어요. 자주 묻는 질문이나 노무 전문가 상담을 이용해 주세요.', { code: 'AI_NOT_CONFIGURED' });
  const { data: used, error } = await db.rpc('ai_take', { p_user: user.id, p_limit: AI_DAILY_LIMIT });
  if (error) throw error;
  if ((used as number) < 0) throw new HttpError(429, `오늘 AI 상담 ${AI_DAILY_LIMIT}회를 모두 썼어요. 내일 다시 이용하거나 노무 전문가 상담을 이용해 주세요.`, { code: 'AI_DAILY_LIMIT' });
  const ctx = { industry: INDUSTRY_KO[wp.industry] ?? '기타', scale: SCALE_KO[wp.scale] ?? wp.scale };
  const answer =
    provider === 'gemini'
      ? await askGemini(question, ctx, today, aiCorpus(today))
      : await askClaude(question, ctx, today);
  return { ...answer, usedToday: used as number, dailyLimit: AI_DAILY_LIMIT };
}

/** 카카오톡 나에게 보내기 — 상태·연결 시작·끊기·시험 발송 (사장님만) */
async function kakaoRoutes(req: Request, db: Db, user: User, path: string, body: Body): Promise<Response | null> {
  const m = req.method;
  if (m === 'GET' && path === 'kakao') return json(req, await K.linkStatus(db, user.id));
  if (m === 'POST' && path === 'kakao/disconnect') {
    await must(db.from('kakao_links').delete().eq('user_id', user.id).select('user_id'));
    return json(req, { connected: false });
  }
  if (m !== 'POST' || (path !== 'kakao/start' && path !== 'kakao/test')) return null;
  if (!(await ownerWorkplace(db, user.id))) throw notFound('사업장이 없어요. 먼저 사업장을 만들어 주세요');
  if (!K.kakaoConfigured()) throw new HttpError(503, '카카오톡 알림이 아직 연결되지 않았어요. 지금은 앱 안 알림과 캘린더 파일을 이용해 주세요.', { code: 'KAKAO_NOT_CONFIGURED' });
  if (kstToday() < K.KAKAO_POLICY_FROM)
    throw new HttpError(409, `카카오톡 알림은 개인정보 처리방침 변경 시행일(${K.KAKAO_POLICY_FROM})부터 연결할 수 있어요`, { code: 'KAKAO_POLICY_PENDING' });
  if (path === 'kakao/start') return json(req, { url: await K.authorizeUrl(user.id, K.safeReturn(body.returnTo)) });
  try {
    await K.sendMemo(db, user.id, '[사람샘각] 카카오톡 알림 연결을 확인했어요. 처리할 노무 일이 있는 날 아침 9시에 이렇게 알려 드려요.');
    await K.recordResult(db, user.id, kstToday(), null);
    return json(req, { sent: true });
  } catch (e) {
    if (!(e instanceof K.KakaoError)) throw e;
    await K.recordResult(db, user.id, kstToday(), e);
    throw new HttpError(502, e.code === 'TOKEN_EXPIRED' ? '카카오 연결이 만료됐어요. 다시 연결해 주세요' : '카카오톡으로 보내지 못했어요. 잠시 뒤 다시 시도해 주세요', { code: `KAKAO_${e.code}` });
  }
}

async function ownerRoutes(req: Request, db: Db, user: User, path: string, body: Body, url: URL): Promise<Response> {
  const m = req.method;
  if (m === 'POST' && path === 'seed-demo') return json(req, await seedDemo(db, user, body), 201);
  if (m === 'POST' && path === 'consult/answer') return json(req, await consultAnswer(db, user, body));
  if (path === 'kakao' || path.startsWith('kakao/')) {
    const r = await kakaoRoutes(req, db, user, path, body);
    if (r) return r;
    throw notFound(`없는 경로예요: owner/${path}`);
  }
  const ctx = await ownerCtx(db, user);
  const { state, base, wp } = ctx;
  const date = url.searchParams.get('date') ? iso(url.searchParams.get('date'), 'date') : base;
  if (m === 'GET') {
    switch (path) {
      case 'state':
        // 프론트엔드 동기화용: 상태 + 화면 상태에 없는 DB id (급여월 id)
        return json(req, {
          base,
          state,
          ids: { userId: user.id, workplaceId: wp.id, payrollIdByMonth: Object.fromEntries(ctx.rows.payroll_months.map((p) => [p.month, p.id])) },
        });
      case 'home':
        return json(req, await home(state, date));
      case 'checklist':
        return json(req, { base: date, rows: E.computeChecklist(state, date) });
      case 'deadlines':
        return json(req, { base: date, deadlines: E.computeDeadlines(state, date) });
      case 'deadlines.ics': {
        const items = E.computeDeadlines(state, date).filter((d) => d.status !== 'done');
        return text(req, E.buildIcs(items), 'text/calendar; charset=utf-8', { 'Content-Disposition': `attachment; filename="labor-deadlines-${date}.ics"` });
      }
      case 'payroll': {
        const month = url.searchParams.get('month') ? ym(url.searchParams.get('month')) : E.monthOf(E.addDays(`${E.monthOf(base)}-01`, -1));
        const r = E.payrollLines(state, month);
        return json(req, { month, period: E.payrollPeriodFor(state.workplace!, month), confirmed: r.confirmed, revision: r.payroll?.revision ?? 0, scale: r.payroll?.scaleConfirmed ?? wp.scale, pending: E.pendingAttendanceIn(state, month), lines: r.lines });
      }
      case 'insurance':
        return json(req, { base: date, employees: state.employees.filter((e) => !e.resignDate || e.resignDate >= E.addDays(date, -60)).map((e) => ({ employeeId: e.id, alias: e.alias, method: e.insuranceMethod, ...E.employeeInsurance(state, e, date) })) });
      case 'severance': {
        const e = empOf(state, uuid(url.searchParams.get('employeeId'), 'employeeId'));
        return json(req, { employeeId: e.id, ...E.estimateSeverance(state, e, date) });
      }
      case 'leave':
        return json(req, { base: date, employees: state.employees.map((e) => ({ employeeId: e.id, alias: e.alias, ...E.leaveAccrual(state, e, date) })) });
      case 'risk':
        return json(req, { base: date, ...E.evaluateRisk(state, date) });
      case 'foreign':
        return json(req, { base: date, employees: state.employees.filter((e) => e.isForeign).map((e) => ({ employeeId: e.id, alias: e.alias, signal: E.foreignSignal(state, e, date) })) });
      case 'clock-qr':
        // 가게 QR 출퇴근 — 지금 화면 QR 코드(30초마다 바뀜)와 인쇄용 코드
        return json(req, await ownerClockQr(db, wp.id));
    }
  }
  if (m === 'POST') {
    switch (path) {
      case 'clock-qr/poster':
        // 인쇄용 QR 새로 발급 — 예전 인쇄물은 그때부터 통하지 않는다
        return json(req, await reissuePoster(db, wp.id));
      case 'payroll/confirm':
        return json(req, await confirmPayroll(db, ctx, body));
      case 'payroll/edit':
        return json(req, await editPayroll(db, ctx, body));
      case 'conditions':
        return json(req, await addCondition(db, ctx, body), 201);
      case 'schedule/override':
        return json(req, await scheduleOverride(db, ctx, body));
      case 'attendance/decide':
        return json(req, await attendanceDecide(db, ctx, body));
      case 'attendance/edit':
        return json(req, await attendanceEdit(db, user, ctx, body));
      case 'attendance/manual':
        return json(req, await attendanceManual(db, ctx, body), 201);
      case 'substitution/decide':
        return json(req, await substitutionDecide(db, ctx, body));
      case 'leave/decide':
        return json(req, await leaveDecide(db, ctx, body));
      case 'consult':
        return json(req, await sendConsult(db, ctx, body), 201);
    }
  }
  throw notFound(`없는 경로예요: ${m} /owner/${path}`);
}

// ───────────────────────── 관리자 ─────────────────────────
// 관리자 확인은 DB 함수(app.is_admin = admins 등록 + 2단계 인증 aal2)에 맡긴다 — 사용자 토큰으로 admin_law_watch를 불러 본다.
async function adminRoutes(req: Request, db: Db, user: User, path: string): Promise<Response> {
  if (req.method === 'POST' && path === 'law-watch/run') {
    const { error } = await userClient(user.token).rpc('admin_law_watch');
    if (error) throw forbidden('관리자(2단계 인증)만 실행할 수 있어요');
    if (!lawApiConfigured()) throw bad('법제처 인증키(LAW_API_OC)가 없어요');
    // 법제처 API를 아끼려고 10분에 한 번까지
    if (Date.now() - (await lastLawWatchAt(db)) < 10 * 60_000) throw conflict('10분 안에 이미 감지했어요. 잠시 뒤에 다시 실행해 주세요.');
    return json(req, await runLawWatch(db, 'manual'));
  }
  throw notFound();
}

// ───────────────────────── 직원 ─────────────────────────
async function employeeCtx(db: Db, user: User, employeeId: string | null) {
  let q = db.from('employees').select('id, workplace_id').eq('user_id', user.id).eq('account_status', 'joined');
  if (employeeId) q = q.eq('id', uuid(employeeId, 'employeeId'));
  const mine = await must(q);
  if (!mine.length) throw forbidden('가입한 직원 계정이 아니에요 (초대 링크로 accept_invite를 먼저 하세요)');
  const { wp } = { wp: await must(db.from('workplaces').select('*').eq('id', mine[0].workplace_id).single()) };
  const today = kstToday();
  const { state } = await loadWorkplace(db, wp.id, today);
  const e = empOf(state, mine[0].id);
  return { wp, state, e, base: wp.base_date_override ?? today, today };
}

/** 직원 본인 데이터만 — 다른 직원의 근로조건·금액·기록은 넣지 않는다 */
function employeeView(state: AppState, e: Employee, base: string) {
  const own = <T extends { employeeId: string }>(xs: T[]) => xs.filter((x) => x.employeeId === e.id);
  const week = Array.from({ length: 7 }, (_, i) => E.addDays(base, i - ((new Date(`${base}T00:00:00Z`).getUTCDay() + 6) % 7)));
  return {
    base,
    employee: { id: e.id, alias: e.alias, hireDate: e.hireDate, lang: state.settings.employeeLang[e.id] ?? 'ko', locationConsent: e.locationConsent },
    workplace: { name: state.workplace!.name, scale: state.workplace!.scale, gpsEnabled: state.workplace!.gpsEnabled, hourlyLeaveAllowed: state.workplace!.hourlyLeaveAllowed },
    condition: E.conditionAt(state.conditions, e.id, base),
    conditionHistory: state.conditions.filter((c) => c.employeeId === e.id),
    conditionAcks: e.conditionAcks,
    today: E.dayPlan(state, e, base),
    week: week.map((d) => E.dayPlan(state, e, d)),
    upcoming: Array.from({ length: 28 }, (_, i) => E.dayPlan(state, e, E.addDays(base, i))).filter((p) => p.shift || p.off),
    attendance: own(state.attendance).map((a) => ({ ...a, current: E.currentTimes(a, state.attendanceEdits), edits: state.attendanceEdits.filter((x) => x.recordId === a.id) })),
    statements: own(state.statements).flatMap((s) => {
      const p = state.payrolls.find((x) => x.id === s.payrollId);
      const line = p?.confirmedLines?.find((l) => l.employeeId === e.id);
      return p && line ? [{ delivery: s, month: p.month, line }] : [];
    }),
    leave: { accrual: E.leaveAccrual(state, e, base), requests: own(state.leaveRequests) },
    substitutions: state.substitutions
      .filter((s) => s.mode === 'request' && (s.status === 'open' || s.fromEmployeeId === e.id || s.toEmployeeId === e.id))
      .map((s) => ({ id: s.id, date: s.date, fromAlias: state.employees.find((x) => x.id === s.fromEmployeeId)?.alias ?? '', mine: s.fromEmployeeId === e.id, status: s.status })),
    notifications: state.notifications.filter((n) => n.to === e.id),
  };
}

/**
 * 직원 화면용 AppState — 프론트엔드의 employeeScope가 그대로 동작하도록 같은 모양으로 주되, 본인 데이터만 넣는다.
 * 다른 직원은 대타 요청에 보이는 별칭만(근로조건·금액·기록 없음). 서류·보험·위험 점검·상담은 비운다.
 */
function employeeState(state: AppState, e: Employee): AppState {
  const own = <T extends { employeeId: string }>(xs: T[]) => xs.filter((x) => x.employeeId === e.id);
  const subs = state.substitutions.filter(
    (s) => s.fromEmployeeId === e.id || s.toEmployeeId === e.id || (s.mode === 'request' && s.status === 'open'),
  );
  const others = new Set(subs.flatMap((s) => [s.fromEmployeeId, s.toEmployeeId]).filter((id): id is string => !!id && id !== e.id));
  const stub = (x: Employee): Employee => ({
    id: x.id, alias: x.alias, ageBand: '18-59', birthDate: null, startedBefore65: null, hireDate: x.hireDate, employmentType: 'regular',
    contractEnd: null, probationEnd: null, foodHandler: false, isForeign: false, foreign: null, school: null, insuranceMethod: 'self',
    registeredAt: x.registeredAt, onboarding: 'existing-done', resignDate: x.resignDate, resignType: null, account: 'none', invite: null,
    locationConsent: null, conditionAcks: [], bonusAnnual: 0, leaveAllowanceAnnual: 0, createdAt: x.createdAt,
  });
  const myRecords = new Set(own(state.attendance).map((a) => a.id));
  const payrolls = state.payrolls
    .map((p) => ({ ...p, manual: [], confirmedLines: p.confirmedLines?.filter((l) => l.employeeId === e.id) ?? null }))
    .filter((p) => p.confirmedLines?.length);
  return {
    schemaVersion: 1,
    workplace: state.workplace,
    employees: [{ ...e, invite: null }, ...state.employees.filter((x) => others.has(x.id)).map(stub)],
    conditions: own(state.conditions),
    overrides: own(state.overrides),
    attendance: own(state.attendance),
    attendanceEdits: state.attendanceEdits.filter((x) => myRecords.has(x.recordId)),
    substitutions: subs,
    leaveRequests: own(state.leaveRequests),
    payrolls,
    payrollEdits: own(state.payrollEdits),
    statements: own(state.statements),
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
    notifications: state.notifications.filter((n) => n.to === e.id),
    busyDays: [],
    settings: { baseDateOverride: state.settings.baseDateOverride, kakaoBannerDismissed: true, employeeLang: { [e.id]: state.settings.employeeLang[e.id] ?? 'ko' } },
    seq: 0,
  };
}

async function clock(db: Db, ctx: Awaited<ReturnType<typeof employeeCtx>>, body: Body) {
  const { wp, state, e, base } = ctx;
  const kind = oneOf(body.kind, 'kind', ['in', 'out'] as const);
  // 가게 QR(화면 QR 5분 안 또는 지금 유효한 인쇄 QR)을 찍고 왔으면 '가게에서 확인', 없거나 틀리면 사장님 확인으로 넘긴다.
  // 위치(좌표·반경)는 받지 않는다 — 예전 가상 위치(gps 값)를 보내도 쓰지 않는다 (2026-11-10 QR 출퇴근으로 바꿈)
  const qr = await verifyClockQr(db, wp.id, body.qr);
  const gps = qr ? ('inside' as const) : ('outside' as const);
  const allowClientTime = (await must(db.from('app_settings').select('value').eq('key', 'client_clock_time_allowed')))[0]?.value === true;
  const time = body.time !== undefined && allowClientTime ? hhmm(body.time, 'time') : kstNowHHMM();
  const plan = E.dayPlan(state, e, base);
  const existing = state.attendance.find((a) => a.employeeId === e.id && a.date === base);
  const tolerance = wp.late_tolerance_min;
  if (kind === 'in') {
    if (existing) throw conflict('오늘 출근 기록이 이미 있어요');
    const { data: recordNo, error } = await db.rpc('next_record_no', { p_workplace_id: wp.id, p_date: base });
    if (error) throw error;
    const cls = gps === 'inside' ? { status: 'pending' as const, reason: '퇴근 기록 전' } : E.classifyClock(plan, time, null, tolerance, gps, 'qr');
    const rec = await must(db.from('attendance_records').insert({ workplace_id: wp.id, employee_id: e.id, record_no: recordNo as string, date: base, original_clock_in: time, source: qr ? 'qr' : 'manual', gps, status: cls.status, reason: cls.reason }).select('*').single());
    if (cls.status === 'exception') await pushNotification(db, { workplace_id: wp.id, recipient: 'owner', kind: 'attendance', text: `${e.alias} ${fmtMD(base)} 출근 확인 요청 · ${cls.reason}`, link: `/owner/work?tab=attendance&record=${rec.id}` });
    return { receipt: { recordNo: rec.record_no, kind: '출근', time, gps, qr, status: rec.status, reason: rec.reason } };
  }
  if (!existing || !existing.original.clockIn) throw bad('출근 기록이 없어요');
  if (existing.original.clockOut) throw conflict('이미 퇴근 기록이 있어요');
  const g = existing.gps === 'inside' && gps === 'inside' ? 'inside' : existing.gps === 'denied' || gps === 'denied' ? 'denied' : 'outside';
  const cls = E.classifyClock(plan, existing.original.clockIn, time, tolerance, g, 'qr');
  await must(db.from('attendance_records').update({ original_clock_out: time, gps: g, status: cls.status, reason: cls.reason, confirmed_at: cls.status === 'confirmed' ? new Date().toISOString() : null }).eq('id', existing.id));
  if (cls.status !== 'confirmed') await pushNotification(db, { workplace_id: wp.id, recipient: 'owner', kind: 'attendance', text: `${e.alias} ${fmtMD(base)} 출퇴근 확인 요청 · ${cls.reason}`, link: `/owner/work?tab=attendance&record=${existing.id}` });
  return { receipt: { recordNo: existing.recordNo, kind: '퇴근', time, gps: g, status: cls.status, reason: cls.status === 'confirmed' ? cls.reason : `${cls.reason} — 사장님 확인 대기`, qr } };
}

async function employeeRoutes(req: Request, db: Db, user: User, path: string, body: Body, url: URL): Promise<Response> {
  const ctx = await employeeCtx(db, user, (body.employeeId as string | undefined) ?? url.searchParams.get('employeeId'));
  if (req.method === 'GET' && path === 'me') return json(req, employeeView(ctx.state, ctx.e, ctx.base));
  if (req.method === 'GET' && path === 'state') return json(req, { base: ctx.base, employeeId: ctx.e.id, state: employeeState(ctx.state, ctx.e) });
  if (req.method === 'POST' && path === 'clock') return json(req, await clock(db, ctx, body), 201);
  throw notFound(`없는 경로예요: ${req.method} /employee/${path}`);
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  try {
    const path = subPath(req, 'api');
    if (path === 'health' || path === '') {
      const today = kstToday();
      const check = new URL(req.url).searchParams.get('check');
      // ?check=ai: Gemini 키·모델 사전 점검 (모델 정보만 조회 — 사용자 질문은 보내지 않음)
      const aiCheck = check === 'ai' || check === 'ai-answer' ? await checkGemini() : undefined;
      // ?check=ai-answer: 개인정보가 없는 고정 시험 질문 하나로 끝까지 점검 (처리방침 시행일 전에도 — 사용자 입력은 받지 않음)
      const aiSelfTest = check === 'ai-answer' && aiCheck?.ok ? await aiSelfTestAnswer(today) : undefined;
      return json(req, {
        ok: true,
        function: 'api',
        time: new Date().toISOString(),
        kstToday: today,
        ai: aiConfigured(today),
        aiProvider: aiProvider(today),
        aiFrom: GEMINI_POLICY_FROM,
        ...(aiCheck ? { aiCheck } : {}),
        ...(aiSelfTest ? { aiSelfTest } : {}),
        kakao: K.kakaoConfigured(),
        kakaoFrom: K.KAKAO_POLICY_FROM,
        // ?check=kakao: 카카오 키 사전 점검 (가짜 코드로 토큰 요청 — 사용자 정보 없음)
        ...(check === 'kakao' ? { kakaoCheck: await K.checkKakaoKeys() } : {}),
        // ?check=datagokr: 공공데이터 API 응답 확인 (공휴일·지역 행사, 사용자 정보 없음)
        ...(check === 'datagokr' ? { dataGoKr: await checkDataGoKr() } : {}),
        // ?check=law: 법제처 OPEN API 호출 확인 (근로기준법 검색, 사용자 정보 없음)
        ...(check === 'law' ? { law: await checkLawApi() } : {}),
      });
    }
    const user = await requireUser(req);
    const db = serviceClient();
    await ensureHolidays(db);
    const body = (await readJson<Body>(req)) ?? {};
    const url = new URL(req.url);
    const [area, ...rest] = path.split('/');
    if (path === 'me') return json(req, await me(db, user));
    if (path === 'account/delete' && req.method === 'POST') return json(req, await deleteAccount(db, user, body));
    if (area === 'owner') return await ownerRoutes(req, db, user, rest.join('/'), body, url);
    if (area === 'admin') return await adminRoutes(req, db, user, rest.join('/'));
    if (area === 'employee') return await employeeRoutes(req, db, user, rest.join('/'), body, url);
    throw notFound(`없는 경로예요: ${path}`);
  } catch (e) {
    return handleError(req, e);
  }
}
