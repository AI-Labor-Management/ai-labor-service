// 배포된 api / public-api / PostgREST를 실제 로그인 토큰으로 끝까지 시험한다 (가상 데이터만)
// 준비: supabase/tests/e2e_setup.sql 실행 → 나온 비밀번호를 E2E_PASSWORD로
// 실행: SUPABASE_URL=https://<ref>.supabase.co SB_KEY=<publishable key> E2E_PASSWORD=<...> node supabase/tests/e2e_api.mjs
// 정리: supabase/tests/e2e_cleanup.sql
// 주의: 계정 3개(e2e-owner/employee/firm@example.test, 탈퇴 시험용 e2e-delete는 사람샘각 실서버 시험이 씀)의 데이터를 지우고 다시 만든다. 운영 프로젝트에서 실행하지 마세요.
import { createHmac } from 'node:crypto';
const BASE = process.env.SUPABASE_URL;
const KEY = process.env.SB_KEY;
const PW = process.env.E2E_PASSWORD;
if (!BASE || !KEY || !PW) {
  console.error('SUPABASE_URL, SB_KEY, E2E_PASSWORD 환경변수가 필요해요');
  process.exit(2);
}
let pass = 0;
const fails = [];
const ok = (cond, name, extra) => {
  if (cond) pass++;
  else fails.push(`${name}${extra !== undefined ? ' → ' + JSON.stringify(extra).slice(0, 400) : ''}`);
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
};

async function signIn(email) {
  const r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PW }) });
  const j = await r.json();
  if (!j.access_token) throw new Error(`로그인 실패 ${email}: ${JSON.stringify(j)}`);
  return j.access_token;
}
// ── 2단계 인증(TOTP): 노무법인·관리자는 aal2 세션에서만 그 역할의 데이터를 본다 ──
function base32(s) {
  const a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const ch of s.replace(/=+$/, '').toUpperCase()) { const v = a.indexOf(ch); if (v >= 0) bits += v.toString(2).padStart(5, '0'); }
  const out = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(out);
}
function totp(secret, at = Date.now()) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30000)));
  const h = createHmac('sha1', base32(secret)).update(counter).digest();
  const o = h[h.length - 1] & 15;
  const n = (((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6;
  return String(n).padStart(6, '0');
}
/** 인증 앱 등록 → 확인 코드 → aal2 접근 토큰 */
async function mfaUpgrade(token) {
  const post = (path, body) => fetch(`${BASE}/auth/v1/${path}`, { method: 'POST', headers: { apikey: KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) }).then(async (r) => ({ status: r.status, body: await r.json() }));
  const en = await post('factors', { factor_type: 'totp', friendly_name: `e2e-${Date.now()}` });
  if (!en.body.id) throw new Error('2단계 인증 등록 실패 ' + JSON.stringify(en.body));
  const ch = await post(`factors/${en.body.id}/challenge`);
  const ve = await post(`factors/${en.body.id}/verify`, { challenge_id: ch.body.id, code: totp(en.body.totp.secret) });
  if (!ve.body.access_token) throw new Error('2단계 인증 확인 실패 ' + JSON.stringify(ve.body));
  mfaFactors.push({ id: en.body.id, token: ve.body.access_token });
  return ve.body.access_token;
}
const mfaFactors = [];
/** 시험이 끝나면 인증 앱 등록을 지운다 (다른 시험이 같은 계정으로 새로 등록할 수 있게) */
async function mfaCleanup() {
  for (const f of mfaFactors) await fetch(`${BASE}/auth/v1/factors/${f.id}`, { method: 'DELETE', headers: { apikey: KEY, Authorization: `Bearer ${f.token}` } });
}

async function call(fn, path, token, { method = 'GET', body, raw = false, origin } = {}) {
  const headers = { apikey: KEY };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (origin) headers.Origin = origin;
  const r = await fetch(`${BASE}/functions/v1/${fn}/${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const t = await r.text();
  let j = null;
  try { j = JSON.parse(t); } catch { /* text */ }
  return { status: r.status, body: raw ? t : j ?? t, headers: r.headers };
}
const api = (path, token, opts) => call('api', path, token, opts);
async function rest(path, token, { method = 'GET', body } = {}) {
  const headers = { apikey: KEY, Authorization: `Bearer ${token}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const r = await fetch(`${BASE}/rest/v1/${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const t = await r.text();
  let j = null;
  try { j = JSON.parse(t); } catch { /* */ }
  return { status: r.status, body: j ?? t };
}
const rpc = (name, token, args = {}) => rest(`rpc/${name}`, token, { method: 'POST', body: args });

const owner = await signIn('e2e-owner@example.test');
const emp = await signIn('e2e-employee@example.test');
const firmAal1 = await signIn('e2e-firm@example.test');
ok(true, '세 계정 로그인 (사장님·직원·노무법인)');
const firm = await mfaUpgrade(firmAal1);
ok(JSON.parse(Buffer.from(firm.split('.')[1], 'base64url').toString()).aal === 'aal2', '노무법인 2단계 인증 등록·확인 → aal2 세션');
await rpc('delete_my_workplace', owner); // 이전 실행 정리

// ── 인증·경로 ──
let r = await api('health');
ok(r.status === 200 && r.body.ok, 'GET /api/health (토큰 없이)', r);
r = await api('me');
ok(r.status === 401, 'GET /api/me 토큰 없으면 401', r.status);
r = await api('me', owner);
ok(r.status === 200 && r.body.roles.owner === null && r.body.roles.employee.length === 0, 'GET /api/me 새 계정은 역할 없음', r.body);
r = await api('owner/home', owner);
ok(r.status === 404, '사업장 없으면 /owner/home 404', r);
r = await api('nope', owner);
ok(r.status === 404, '없는 경로 404', r.status);
r = await call('api', 'health', null, { method: 'OPTIONS', origin: 'https://ai-labor-management.github.io' });
ok(r.headers.get('access-control-allow-origin') === 'https://ai-labor-management.github.io', 'CORS: GitHub Pages 주소 허용', r.headers.get('access-control-allow-origin'));
r = await call('api', 'health', null, { origin: 'https://evil.example.com' });
ok(r.headers.get('access-control-allow-origin') !== 'https://evil.example.com', 'CORS: 모르는 주소는 허용하지 않음', r.headers.get('access-control-allow-origin'));

// ── 가상 시드 ──
r = await api('owner/seed-demo', owner, { method: 'POST', body: {} });
ok(r.status === 201 && r.body.employees === 3, 'POST /owner/seed-demo 가상 시드 (직원 3명)', r.body);
r = await api('owner/seed-demo', owner, { method: 'POST', body: {} });
ok(r.status === 409, '시드 두 번 넣으면 409 (replace 없이)', r.status);
r = await api('me', owner);
ok(r.status === 200 && r.body.roles.owner?.name, 'GET /api/me 사장님 역할 생김', r.body);

r = await api('owner/state', owner);
ok(r.status === 200 && r.body.state.employees.length === 3, 'GET /owner/state', r.status);
const state = r.body.state;
const [eA, eB, eC] = state.employees;
ok(state.employees.every((e) => e.account === 'none'), '시드 직원은 계정 미연결로 저장', state.employees.map((e) => e.account));
ok(state.employees.every((e) => /^[0-9a-f-]{36}$/.test(e.id)), '시드 id가 UUID로 바뀜');

r = await api('owner/home', owner);
ok(r.status === 200 && Array.isArray(r.body.todos) && r.body.today.length >= 1 && typeof r.body.month.grossEstimate === 'number', 'GET /owner/home (할 일·오늘·이번 달)', r.body && { todos: r.body.todos?.length, month: r.body.month });
r = await api('owner/checklist', owner);
ok(r.status === 200 && r.body.rows.length > 0, 'GET /owner/checklist', r.status);
r = await api('owner/deadlines', owner);
ok(r.status === 200 && r.body.deadlines.length > 0, 'GET /owner/deadlines', r.status);
r = await api('owner/deadlines.ics', owner, { raw: true });
ok(r.status === 200 && r.body.startsWith('BEGIN:VCALENDAR') && (r.headers.get('content-type') ?? '').includes('text/calendar'), 'GET /owner/deadlines.ics 캘린더 파일', r.body.slice(0, 80));
r = await api('owner/insurance', owner);
ok(r.status === 200 && r.body.employees.length === 3, 'GET /owner/insurance', r.status);
r = await api(`owner/severance?employeeId=${eA.id}`, owner);
ok(r.status === 200 && 'monthlyAccrual' in r.body, 'GET /owner/severance', r.body);
r = await api('owner/severance?employeeId=not-a-uuid', owner);
ok(r.status === 400, '잘못된 employeeId는 400', r.status);
r = await api('owner/leave', owner);
ok(r.status === 200 && r.body.employees.length === 3, 'GET /owner/leave', r.status);
r = await api('owner/risk', owner);
ok(r.status === 200 && Array.isArray(r.body.rows) && typeof r.body.riskCount === 'number', 'GET /owner/risk', Object.keys(r.body ?? {}));
r = await api('owner/foreign', owner);
ok(r.status === 200 && Array.isArray(r.body.employees), 'GET /owner/foreign', r.status);

// ── 급여 ──
r = await api('owner/payroll?month=2026-10', owner);
ok(r.status === 200 && r.body.lines.length > 0 && r.body.confirmed === false, 'GET /owner/payroll 2026-10 초안', { status: r.status, lines: r.body?.lines?.length, pending: r.body?.pending?.length });
const draftGross = r.body.lines.reduce((s, l) => s + l.gross, 0);
const pendingCount = r.body.pending.length;
r = await api('owner/payroll/confirm', owner, { method: 'POST', body: { month: '2026-10' } });
if (pendingCount > 0) {
  ok(r.status === 409, '확인 대기 근무가 있으면 확정 막음 (409)', r);
  r = await api('owner/payroll/confirm', owner, { method: 'POST', body: { month: '2026-10', allowPending: true } });
}
ok(r.status === 200 && r.body.confirmed && r.body.gross === draftGross, 'POST /owner/payroll/confirm 확정 (초안과 같은 금액)', r.body);
const confirmedLines = r.body.lines;
r = await api('owner/payroll/confirm', owner, { method: 'POST', body: { month: '2026-10', allowPending: true } });
ok(r.status === 409, '두 번 확정하면 409', r.status);
r = await api('owner/payroll?month=2026-10', owner);
ok(r.status === 200 && r.body.confirmed === true && r.body.revision === 1 && r.body.lines.length === confirmedLines, '확정 후 조회 = 스냅샷', { confirmed: r.body.confirmed, revision: r.body.revision });
const lineA = r.body.lines[0];
r = await api('owner/payroll/edit', owner, { method: 'POST', body: { month: '2026-10', employeeId: lineA.employeeId, kind: 'adjust', label: '지각 벌금', amount: -10000, reason: '지각' } });
ok(r.status === 400, '지각 벌금 공제는 막음 (근로기준법)', r.body);
r = await api('owner/payroll/edit', owner, { method: 'POST', body: { month: '2026-10', employeeId: lineA.employeeId, kind: 'adjust', label: '교통비 정산', amount: 15000, reason: '10월 교통비 누락분' } });
ok(r.status === 200 && r.body.revision === 2 && r.body.line.gross === lineA.gross + 15000, 'POST /owner/payroll/edit 수정 이력 (revision 2)', r.body && { revision: r.body.revision, gross: r.body.line?.gross, before: lineA.gross });
r = await api('owner/payroll?month=2026-10', owner);
const lineA2 = r.body.lines.find((l) => l.employeeId === lineA.employeeId);
ok(r.body.revision === 2 && lineA2.gross === lineA.gross + 15000, '수정 후 최신 줄이 보임', { revision: r.body.revision, gross: lineA2?.gross });
r = await rest(`payroll_edits?select=field,before_value,after_value,reason`, owner);
ok(r.status === 200 && r.body.length === 1 && r.body[0].reason === '10월 교통비 누락분', 'payroll_edits 이력 1건 (RLS로 사장님만)', r.body);

// ── 근로조건·일정 ──
r = await api('owner/conditions', owner, { method: 'POST', body: { employeeId: eB.id, effectiveFrom: '2026-12-01', hourlyWage: 9000, schedule: [{ start: '10:00', end: '16:00', breakMin: 30 }, null, null, null, null, null, null], reason: '시급 변경' } });
ok(r.status === 201 && r.body.minimumWage && r.body.minimumWage.status === 'below' && r.body.minimumWage.required === 10320, 'POST /owner/conditions 최저임금 미달 경고와 함께 저장', r.body?.minimumWage ?? r.body);
r = await api('owner/conditions', owner, { method: 'POST', body: { employeeId: eB.id, effectiveFrom: '2020-01-01', hourlyWage: 11000, schedule: [{ start: '10:00', end: '16:00' }, null, null, null, null, null, null], reason: 'x' } });
ok(r.status === 400, '입사일 이전 적용일은 400', r.body);
r = await rest(`work_conditions?employee_id=eq.${eB.id}`, owner, { method: 'PATCH', body: { hourly_wage: 1 } });
const wc = await rest(`work_conditions?employee_id=eq.${eB.id}&select=hourly_wage`, owner);
ok(!wc.body.some((c) => c.hourly_wage === 1), '근로조건 이력은 PostgREST로 덮어쓸 수 없음', { patch: r.status, rows: wc.body });

// 다음 근무일 찾기
const home2 = (await api('owner/home', owner)).body;
let target = null;
for (let i = 1; i <= 14 && !target; i++) {
  const d = new Date(Date.parse(`${home2.base}T00:00:00Z`) + i * 864e5).toISOString().slice(0, 10);
  for (const e of [eA, eB, eC]) {
    const h = await api(`owner/home?date=${d}`, owner);
    const t = h.body.today.find((x) => x.employeeId === e.id);
    if (t?.plan?.shift && e.id !== eB.id) { target = { date: d, e }; break; }
  }
}
ok(!!target, '앞으로 2주 안 근무일 찾기', target);
if (target) {
  const before = (await api(`owner/home?date=${target.date}`, owner)).body.today.find((x) => x.employeeId === target.e.id).plan;
  r = await api('owner/schedule/override', owner, { method: 'POST', body: { employeeId: target.e.id, date: target.date, kind: 'absent', memo: '개인 사정' } });
  ok(r.status === 200 && r.body.plan && !r.body.plan.shift, 'POST /owner/schedule/override 결근 처리', r.body);
  r = await api('owner/schedule/override', owner, { method: 'POST', body: { employeeId: target.e.id, date: target.date, kind: 'reset' } });
  ok(r.status === 200 && r.body.plan.overrides.length === 0 && JSON.stringify(r.body.plan.contract) === JSON.stringify(before.contract), '일정 되돌리기(reset) → 계약상 일정', r.body);
}

// ── 직원 초대·연결 ──
r = await rpc('create_invite', emp, { p_employee_id: eA.id });
ok(r.status >= 400, '직원 계정은 초대 링크를 만들 수 없음', r.status);
r = await rpc('create_invite', owner, { p_employee_id: eA.id });
ok(r.status === 200 && r.body.token, 'create_invite (사장님)', r.status);
const tok = r.body.token;
r = await api('employee/me', emp);
ok(r.status === 403, '연결 전 직원 API는 403', r.status);
r = await rpc('accept_invite', emp, { p_token: tok });
ok(r.status === 200 && r.body === eA.id, 'accept_invite 직원 계정 연결', r.body);
r = await rpc('accept_invite', firm, { p_token: tok });
ok(r.status >= 400, '이미 쓴 초대 링크는 다시 못 씀', r.status);
r = await api('me', emp);
ok(r.status === 200 && r.body.roles.employee.length === 1 && r.body.roles.owner === null, 'GET /api/me 직원 역할', r.body.roles);

r = await api('employee/me', emp);
ok(r.status === 200 && r.body.employee.id === eA.id, 'GET /employee/me', r.status);
const ev = r.body;
const leak = JSON.stringify(ev);
ok(ev.conditionHistory.every((c) => c.employeeId === eA.id) && ev.attendance.every((a) => a.employeeId === eA.id) && ev.notifications.every((n) => n.to === eA.id), '직원 화면에 다른 직원 근로조건·출퇴근·알림 없음', null);
ok(ev.statements.length >= 1 && ev.statements.every((s) => s.line.employeeId === eA.id), '직원 본인 명세서만 보임', ev.statements.length);
r = await rest('employees?select=id,alias', emp);
ok(r.status === 200 && r.body.length === 1 && r.body[0].id === eA.id, 'PostgREST: 직원은 자기 직원 행 1개만', r.body);
r = await rest('payroll_lines?select=employee_id', emp);
ok(r.status === 200 && r.body.every((x) => x.employee_id === eA.id), 'PostgREST: 직원은 자기 급여 줄만', r.body.length);
r = await rest('workplaces?select=id', emp);
ok(r.status === 200 && r.body.length === 0, 'PostgREST: 직원은 사업장 행을 직접 못 봄', r.body);
r = await api('owner/home', emp);
ok(r.status === 404, '직원 토큰으로 사장님 API는 404 (사업장 없음)', r.status);

// 명세서 수령
const delivery = ev.statements.at(-1).delivery;
r = await rpc('mark_statement_viewed', emp, { p_delivery_id: delivery.id });
ok(r.status === 200 || r.status === 204, 'mark_statement_viewed 수령 확인', r);

// 출퇴근 (서버 시각 사용)
r = await rpc('set_location_consent', emp, { p_employee_id: eA.id, p_consent: true });
ok(r.status === 200 || r.status === 204, 'set_location_consent 위치 동의', r);
r = await api('employee/clock', emp, { method: 'POST', body: { kind: 'in', gps: 'inside', time: '03:00' } });
const todayRec = (await api('employee/me', emp)).body.attendance.find((a) => a.date === ev.base);
if (ev.attendance.some((a) => a.date === ev.base)) {
  ok(r.status === 409, '이미 오늘 기록이 있으면 출근 409', r.body);
} else {
  ok(r.status === 201 && r.body.receipt.kind === '출근' && r.body.receipt.time !== '03:00', 'POST /employee/clock 출근 (기기 시각 무시, 서버 시각)', r.body);
  r = await api('employee/clock', emp, { method: 'POST', body: { kind: 'in', gps: 'inside' } });
  ok(r.status === 409, '두 번 출근 409', r.status);
  r = await api('employee/clock', emp, { method: 'POST', body: { kind: 'out', gps: 'inside' } });
  ok(r.status === 201 && r.body.receipt.kind === '퇴근', 'POST /employee/clock 퇴근', r.body);
  r = await api('employee/clock', emp, { method: 'POST', body: { kind: 'out', gps: 'inside' } });
  ok(r.status === 409, '두 번 퇴근 409', r.status);
}
ok(!!todayRec, '출근 기록이 직원 화면에 보임', todayRec && { recordNo: todayRec.recordNo, status: todayRec.status });

// 사장님 출퇴근 처리
const st2 = (await api('owner/state', owner)).body.state;
const rec = st2.attendance.find((a) => a.employeeId === eA.id && a.date === ev.base);
if (rec) {
  r = await api('owner/attendance/edit', owner, { method: 'POST', body: { recordId: rec.id, clockIn: '10:00', clockOut: '15:00', reason: 'E2E 수정 시험' } });
  ok(r.status === 200 && r.body.original.clockIn === rec.original.clockIn, 'POST /owner/attendance/edit 원래 기록 보존 + 이력', r.body);
  const ed = (await api('employee/me', emp)).body.attendance.find((a) => a.id === rec.id);
  ok(ed && ed.current.clockIn === '10:00' && ed.edits.length === 1, '직원 화면에 수정 이력 보임', ed && { current: ed.current, edits: ed.edits.length });
  r = await rpc('respond_attendance_edit', emp, { p_edit_id: ed.edits[0].id, p_status: 'confirmed' });
  ok(r.status === 200 || r.status === 204, 'respond_attendance_edit 직원 확인', r);
  r = await rpc('respond_attendance_edit', emp, { p_edit_id: ed.edits[0].id, p_status: 'confirmed' });
  ok(r.status >= 400 && /이미 응답/.test(r.body.message), '두 번 응답하면 거절', r.body);
}
const pastDay = new Date(Date.parse(`${ev.base}T00:00:00Z`) - 3 * 864e5).toISOString().slice(0, 10);
r = await api('owner/attendance/manual', owner, { method: 'POST', body: { employeeId: eC.id, date: pastDay, clockIn: '09:00', clockOut: '13:00', reason: '기기 고장' } });
ok(r.status === 201 || r.status === 409, 'POST /owner/attendance/manual 사장님 직접 기록', r.status === 201 ? r.body.record_no : r.body);

// 연차·대타
r = await rpc('request_leave', emp, { p_employee_id: eA.id, p_date: target?.date ?? pastDay });
const leaveOk = r.status === 200;
ok(leaveOk || (r.status >= 400 && /연차|1~4|5명/.test(JSON.stringify(r.body))), 'request_leave (1~4명 사업장은 거절)', r.body);
if (leaveOk) {
  r = await api('owner/leave/decide', owner, { method: 'POST', body: { id: r.body, approve: true } });
  ok(r.status === 200 && r.body.status === 'approved', 'POST /owner/leave/decide 승인', r.body);
}
const myShift = ev.upcoming.find((p) => p.shift && p.date > ev.base);
if (myShift) {
  r = await rpc('request_substitution', emp, { p_employee_id: eA.id, p_date: myShift.date });
  ok(r.status === 200, 'request_substitution 대타 요청', r.body);
  const subs = (await api('owner/state', owner)).body.state.substitutions;
  ok(subs.some((x) => x.fromEmployeeId === eA.id && x.date === myShift.date && x.status === 'open'), '사장님 화면에 대타 요청(open) 보임', subs);
  r = await api('owner/substitution/decide', owner, { method: 'POST', body: { id: subs.find((x) => x.fromEmployeeId === eA.id).id, approve: true } });
  ok(r.status === 409, '지원자 없는 대타는 승인 대기 상태가 아님 (409)', r.body);
} else ok(false, '직원 A의 다음 근무일 찾기', ev.upcoming);

// ── 노무법인 상담 ──
r = await api('owner/consult', owner, { method: 'POST', body: { topic: '근로시간', question: '연장근로 계산이 맞는지 봐주세요. 010-1234-5678', shareItems: ['memo'], consent: true } });
ok(r.status === 400, '질문에 전화번호 있으면 보내지 않음', r.body);
r = await api('owner/consult', owner, { method: 'POST', body: { topic: '근로시간', question: '연장근로 계산이 맞는지 봐주세요.', shareItems: ['memo', 'workplace', 'conditions'], employeeIds: [eA.id], consent: false } });
ok(r.status === 400, '동의 없으면 400', r.status);
r = await api('owner/consult', owner, { method: 'POST', body: { topic: '근로시간', question: '연장근로 계산이 맞는지 봐주세요.', shareItems: ['memo', 'workplace', 'conditions'], employeeIds: [eA.id], consent: true } });
ok(r.status === 201 && r.body.id, 'POST /owner/consult 노무법인에 보내기', r.body);
const consultId = r.body.id;
r = await rpc('firm_consult_inbox', firmAal1);
ok(r.status === 200 && Array.isArray(r.body) && r.body.length === 0, '2단계 인증 전(aal1) 노무법인 요청함은 비어 있음', r.body);
r = await rpc('firm_delegated_insurance', firmAal1);
ok(r.status === 200 && Array.isArray(r.body) && r.body.length === 0, '2단계 인증 전(aal1) 보험 맡김 목록도 비어 있음', r.body);
r = await rpc('firm_consult_inbox', firm);
const mine = Array.isArray(r.body) ? r.body.find((x) => x.id === consultId) : null;
ok(r.status === 200 && mine && mine.snapshot?.conditions?.length === 1, '노무법인 요청함에 도착 (스냅샷 포함)', mine ?? r.body);
ok(mine && !JSON.stringify(mine).includes('hourly_wage') , '요청함에는 고른 항목 요약만', null);
r = await rpc('firm_consult_inbox', emp);
ok(r.status >= 400 || (Array.isArray(r.body) && r.body.length === 0), '직원은 노무법인 요청함을 못 봄', r.status);
r = await rpc('revoke_consult', owner, { p_id: consultId });
ok(r.status === 200 || r.status === 204, 'revoke_consult 철회', r);
r = await rpc('firm_consult_inbox', firm);
const revoked = r.body.find((x) => x.id === consultId);
ok(revoked && revoked.status === 'revoked' && revoked.snapshot === null && revoked.question === '(공유 철회됨)', '철회 후 노무법인에는 내용이 가려짐', revoked);
r = await rpc('firm_delegated_insurance', firm);
ok(r.status === 200 && Array.isArray(r.body), 'firm_delegated_insurance 맡김 건 목록', r.status);

// ── 비회원·공개 API ──
r = await call('public-api', 'health', null);
ok(r.status === 200, 'public-api health', r.status);
r = await call('public-api', 'guest-consult', null, { method: 'POST', body: { nickname: '가상', phone: '010-0000-0000', contactTime: '오후', topic: '기타', question: '', consentCollect: true, consentProvide: true } });
ok(r.status === 200 && r.body.mode === 'demo', 'public-api guest-consult 접수 꺼짐 = demo (저장 안 함)', r.body);

// ── 직원 앱 나가기 ──
r = await rpc('leave_employee_app', emp, { p_employee_id: eA.id });
ok(r.status === 200 || r.status === 204, 'leave_employee_app 연결 해제', r);
r = await api('employee/me', emp);
ok(r.status === 403, '연결 해제 후 직원 API 403', r.status);

// ── 시드 다시 넣기(replace) ──
r = await api('owner/seed-demo', owner, { method: 'POST', body: { replace: true, baseDate: '2026-11-06' } });
ok(r.status === 201 && r.body.employees === 3, 'seed-demo replace:true (기존 데이터 지우고 다시)', r.body);
r = await api('owner/payroll?month=2026-10', owner);
ok(r.status === 200 && r.body.confirmed === false, 'replace 후 급여는 다시 초안', r.body.confirmed);

// ── 사장님 알림 ──
// ── AI 노무 상담 (Claude) — 키가 없으면 503, 있으면 근거와 함께 답한다 ──
r = await api('health', owner);
const aiOn = r.body?.ai === true;
ok(r.status === 200 && typeof r.body?.ai === 'boolean', `health가 AI 연결 여부를 알려 줌 (ai=${r.body?.ai})`);
r = await api('owner/consult/answer', owner, { method: 'POST', body: { question: '주휴수당 010-1234-5678로 연락' } });
ok(r.status === 422 && r.body?.detail?.code === 'PII_DETECTED', 'AI 질문에 휴대폰 번호가 있으면 422', r.body);
r = await api('owner/consult/answer', owner, { method: 'POST', body: { question: '?' } });
ok(r.status === 422 && r.body?.detail?.code === 'INVALID_QUESTION', 'AI 질문이 너무 짧으면 422', r.body);
r = await api('owner/consult/answer', emp, { method: 'POST', body: { question: '주휴수당은 언제 줘야 하나요?' } });
ok(r.status === 404, '사업장 없는 계정(직원)은 AI 상담 경로를 못 씀', r.status);
r = await api('owner/consult/answer', owner, { method: 'POST', body: { question: '주 15시간 일하는 알바에게 주휴수당을 줘야 하나요?' } });
if (aiOn) {
  ok(r.status === 200 && ['answer', 'insufficient_evidence', 'expert_required'].includes(r.body?.status) && Array.isArray(r.body?.citations) && r.body?.text?.length > 0, `AI 답변 (${r.body?.status}, 근거 ${r.body?.citations?.length}개, 오늘 ${r.body?.usedToday}/${r.body?.dailyLimit})`, r.body);
  ok(r.body?.status !== 'answer' || r.body.citations.every((c) => /^https:\/\//.test(c.url)), 'AI 답의 근거는 https 공식 출처', r.body?.citations);
} else {
  ok(r.status === 503 && r.body?.detail?.code === 'AI_NOT_CONFIGURED', 'AI 키가 없으면 503 연결 전', r.body);
}
// ── 카카오톡 나에게 보내기 — 키가 없으면 연결 전, 토큰 표는 브라우저에서 못 읽는다 ──
r = await api('health', owner);
const kakaoOn = r.body?.kakao === true;
ok(typeof r.body?.kakao === 'boolean', `health가 카카오 알림 연결 여부를 알려 줌 (kakao=${r.body?.kakao})`);
r = await api('owner/kakao', owner);
ok(r.status === 200 && r.body?.connected === false && r.body?.configured === kakaoOn && r.body?.policyFrom === '2026-11-14', '카카오 알림 상태: 연결 안 됨', r.body);
r = await api('owner/kakao/start', emp, { method: 'POST', body: {} });
ok(r.status === 404, '사업장 없는 계정은 카카오 알림을 연결할 수 없음', r.status);
r = await api('owner/kakao/start', owner, { method: 'POST', body: { returnTo: 'https://evil.example/x' } });
if (!kakaoOn) ok(r.status === 503 && r.body?.detail?.code === 'KAKAO_NOT_CONFIGURED', '카카오 키가 없으면 503 연결 전', r.body);
else if (r.status === 409) ok(r.body?.detail?.code === 'KAKAO_POLICY_PENDING', '처리방침 시행일 전에는 409', r.body);
else ok(r.status === 200 && new URL(r.body.url).host === 'kauth.kakao.com' && new URL(r.body.url).searchParams.get('scope') === 'talk_message', '카카오 동의 주소(talk_message)', r.body);
r = await api('owner/kakao/disconnect', owner, { method: 'POST', body: {} });
ok(r.status === 200 && r.body?.connected === false, '카카오 알림 연결 끊기 (연결이 없어도 성공)', r.body);
r = await rest('kakao_links?select=user_id', owner);
ok(r.status === 401 || r.status === 403 || (r.status === 200 && Array.isArray(r.body) && r.body.length === 0), '카카오 토큰 표는 브라우저에서 읽을 수 없음', r.status);
{
  const cb = await fetch(`${BASE}/functions/v1/public-api/kakao/callback?code=x&state=forged.sig`, { headers: { apikey: KEY }, redirect: 'manual' });
  const loc = cb.headers.get('location') ?? '';
  ok(cb.status === 302 && loc.startsWith('https://ai-labor-management.github.io/') && /kakao=(error|expired)/.test(loc), '카카오 콜백: 위조 state는 사이트로 돌려보내고 저장하지 않음', `${cb.status} ${loc}`);
}

r = await rest('notifications?recipient=eq.owner&select=kind,text', owner);
ok(r.status === 200, '사장님 알림 조회', r.body.length);

await mfaCleanup();
console.log(`\nE2E: ${pass} passed, ${fails.length} failed`);
if (fails.length) { console.log(fails.join('\n')); process.exit(1); }
