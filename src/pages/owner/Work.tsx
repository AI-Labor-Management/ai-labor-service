// S06·S07·S18 근무: 일정 → 대타 → 출퇴근 기록(수정 이력) → 연차. 사장님이 확정한 근무만 급여로 넘어간다.
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { choiceParam } from '../../domain/navigation';
import { useStore, uid, nowIso, pushNotification } from '../../state/store';
import { addDays, fmtDate, fmtMD, fmtMDW, isHHMM, listDates, monthOf, startOfWeek, WEEKDAY_KO, fmtDateTime, localDate } from '../../domain/dates';
import { currentTimes, dayPlan, isUnder5, netMinutes, weekWarnings } from '../../domain/work';
import { leaveAccrual } from '../../domain/leave';
import { resolveRule } from '../../domain/rules';
import { holidayOn } from '../../data/holidays';
import type { AppState, AttendanceRecord, Employee, ISODate, ShiftOverrideKind } from '../../domain/types';
import { Badge, Basis, Button, Card, cx, Empty, Field, inputCls, Modal, Notice, PageHeader, Tabs, useToast } from '../../ui/kit';

type Tab = 'schedule' | 'attendance' | 'subs' | 'leave';

function activeEmps(s: AppState, base: ISODate) {
  return s.employees.filter((e) => !e.resignDate || e.resignDate >= base);
}

function notifyEmp(d: AppState, e: Employee, text: string, link = '/employee/schedule') {
  if (e.account === 'joined') pushNotification(d, e.id, 'schedule', text, link);
}

// ---------------- 일정 ----------------
function ScheduleTab() {
  const { state, update, base } = useStore();
  const toast = useToast();
  const [ws, setWs] = useState(startOfWeek(base));
  const days = listDates(ws, addDays(ws, 6));
  const emps = activeEmps(state, base);
  const [cell, setCell] = useState<{ e: Employee; date: ISODate } | null>(null);
  const [busy, setBusy] = useState({ date: base, memo: '' });
  const breakRule = resolveRule<{ per4h: number; per8h: number; waiver4hOnRequest: boolean }>('break.minimum', days[6]);
  const minorRule = resolveRule<{ daily: number; weekly: number }>('minor.limits', days[6]);

  const copyLastWeek = () => {
    let n = 0;
    update((d) => {
      for (const e of emps) {
        const prev = d.overrides.filter((o) => o.employeeId === e.id && o.date >= addDays(ws, -7) && o.date < ws && (o.kind === 'extra' || o.kind === 'change'));
        for (const o of prev) {
          const nd = addDays(o.date, 7);
          if (d.overrides.some((x) => x.employeeId === e.id && x.date === nd)) continue;
          d.overrides.push({ ...o, id: uid('ov'), date: nd, memo: '지난주 복사', createdAt: nowIso() });
          n++;
        }
      }
    });
    toast(n ? `지난주 근무 ${n}건을 복사했어요` : '복사할 지난주 변경·추가 근무가 없어요 (이미 있는 날은 건너뛰어요)', n ? 'ok' : 'info');
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => setWs(addDays(ws, -7))} aria-label="지난주">
          ←
        </Button>
        <p className="font-bold">
          {fmtMD(ws)} – {fmtMD(addDays(ws, 6))}
        </p>
        <Button size="sm" onClick={() => setWs(addDays(ws, 7))} aria-label="다음 주">
          →
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setWs(startOfWeek(base))}>
          이번 주
        </Button>
        <Button size="sm" className="ml-auto" onClick={copyLastWeek}>
          지난주 복사
        </Button>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        {days.map((d) => (holidayOn(d) ? <Badge key={d} tone="risk">{fmtMD(d)} {holidayOn(d)!.name}</Badge> : null))}
        {state.busyDays.filter((b) => days.includes(b.date)).map((b) => (
          <Badge key={b.id} tone="warn">
            바쁜 날 {fmtMD(b.date)} {b.memo}
          </Badge>
        ))}
        <span className="text-muted">공휴일은 앱 내장 목록(확인 필요) · 지역 행사·학사일정 API는 연결 대기</span>
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="py-2"></th>
                {days.map((d, i) => (
                  <th key={d} className={cx('px-1 py-2', d === base && 'text-brand')}>
                    {WEEKDAY_KO[i]} {fmtMD(d)}
                  </th>
                ))}
                <th className="px-1">합계</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {emps.map((e) => {
                let total = 0;
                return (
                  <tr key={e.id}>
                    <td className="py-2 pr-2 font-semibold">{e.alias}</td>
                    {days.map((d) => {
                      const p = dayPlan(state, e, d);
                      if (p.shift) total += netMinutes(p.shift);
                      const label = p.shift ? `${p.shift.start}–${p.shift.end}` : p.off === 'leave' ? '연차' : p.off === 'absent' ? '결근' : p.off === 'subOut' ? '대타로 빠짐' : p.off === 'publicHoliday' ? '유급휴일' : p.variableNeedsInput ? '입력' : '–';
                      return (
                        <td key={d} className="px-1 py-1">
                          <button
                            type="button"
                            onClick={() => setCell({ e, date: d })}
                            disabled={d < e.hireDate || (!!e.resignDate && d > e.resignDate)}
                            className={cx(
                              'w-full rounded-lg border px-1.5 py-1.5 text-left text-xs disabled:opacity-30',
                              p.shift?.kind === 'regular' && 'border-line bg-white',
                              p.shift && p.shift.kind !== 'regular' && 'border-brand/40 bg-brand-soft',
                              p.off && 'border-dashed border-line bg-canvas text-muted',
                              !p.shift && !p.off && 'border-transparent text-muted hover:border-line',
                            )}
                            aria-label={`${e.alias} ${fmtMDW(d)} ${label} 변경`}
                          >
                            <span className="num">{label}</span>
                            {p.shift && p.shift.kind !== 'regular' && <span className="block text-[10px] text-brand">{{ change: '변경', extra: '추가', subIn: '대타 근무' }[p.shift.kind]}</span>}
                          </button>
                        </td>
                      );
                    })}
                    <td className="num px-1 font-semibold">{(total / 60).toFixed(1).replace(/\.0$/, '')}h</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">칸을 누르면 시간 변경 · 결근 · 추가 근무 · 대타 · 연차로 고쳐요. 등록한 요일별 시간으로 자동으로 채워져요.</p>
      </Card>
      <Card title="이번 주 경고">
        {emps.every((e) => !weekWarnings(state, e, ws, breakRule.ok ? breakRule.value : null, minorRule.ok ? minorRule.value : null).length) && <p className="text-sm text-muted">경고 없음</p>}
        <ul className="space-y-1 text-sm">
          {emps.flatMap((e) =>
            weekWarnings(state, e, ws, breakRule.ok ? breakRule.value : null, minorRule.ok ? minorRule.value : null).map((w, i) => (
              <li key={`${e.id}-${i}`} className="flex items-start gap-2">
                <Badge tone={w.level === 'risk' ? 'risk' : w.level === 'check' ? 'warn' : 'info'}>{e.alias}</Badge>
                <span>{w.text}</span>
              </li>
            )),
          )}
        </ul>
        <div className="mt-2">
          <Basis ids={['break.minimum', 'workHours.limits', 'minor.limits', 'weeklyHoliday.minWeeklyHours']} date={days[6]} />
        </div>
      </Card>
      <Card title="우리 가게 바쁜 날 (사장님 입력)">
        <div className="flex flex-wrap items-end gap-2">
          <Field label="날짜" htmlFor="busy-d">
            <input id="busy-d" type="date" className={inputCls} value={busy.date} onChange={(e) => setBusy({ ...busy, date: e.target.value })} />
          </Field>
          <Field label="메모" htmlFor="busy-m">
            <input id="busy-m" className={inputCls} value={busy.memo} onChange={(e) => setBusy({ ...busy, memo: e.target.value })} placeholder="예: 축제, 단체 예약" />
          </Field>
          <Button
            onClick={() => {
              if (!busy.memo.trim()) return toast('메모를 적어 주세요', 'warn');
              update((d) => {
                d.busyDays.push({ id: uid('busy'), date: busy.date, memo: busy.memo.trim() });
              });
              setBusy({ ...busy, memo: '' });
              toast('바쁜 날을 추가했어요');
            }}
          >
            추가
          </Button>
        </div>
        <ul className="mt-2 flex flex-wrap gap-2 text-sm">
          {state.busyDays.map((b) => (
            <li key={b.id} className="flex items-center gap-1 rounded-lg border border-line px-2 py-1">
              {fmtMD(b.date)} {b.memo}
              <button type="button" aria-label="삭제" className="text-muted" onClick={() => update((d) => { d.busyDays = d.busyDays.filter((x) => x.id !== b.id); })}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      </Card>
      {cell && <CellModal e={cell.e} date={cell.date} onClose={() => setCell(null)} />}
    </div>
  );
}

function CellModal({ e, date, onClose }: { e: Employee; date: ISODate; onClose: () => void }) {
  const { state, update, base } = useStore();
  const toast = useToast();
  const plan = dayPlan(state, e, date);
  const under5 = isUnder5(state.workplace?.scale);
  const [kind, setKind] = useState<'change' | 'extra' | 'absent' | 'leave' | 'sub' | 'reset'>(plan.shift ? 'change' : 'extra');
  const [t, setT] = useState({ start: plan.shift?.start ?? plan.contract?.start ?? '10:00', end: plan.shift?.end ?? plan.contract?.end ?? '15:00', breakMin: plan.shift?.breakMin ?? plan.contract?.breakMin ?? 30 });
  const [subTo, setSubTo] = useState('');
  const [memo, setMemo] = useState('');
  const [err, setErr] = useState('');
  const others = activeEmps(state, base).filter((x) => x.id !== e.id && date >= x.hireDate);

  const save = () => {
    if ((kind === 'change' || kind === 'extra') && (!isHHMM(t.start) || !isHHMM(t.end))) return setErr('시간을 확인하세요');
    if (kind === 'sub' && !subTo) return setErr('대신할 직원을 고르세요');
    if (kind === 'sub' && !plan.shift) return setErr('그날 예정 근무가 없어 대타를 지정할 수 없어요');
    const to = others.find((x) => x.id === subTo);
    update((d) => {
      // 같은 날의 이 직원 변경 기록을 정리하고 새로 넣는다 (대타로 들어온 근무는 유지)
      d.overrides = d.overrides.filter((o) => !(o.employeeId === e.id && o.date === date && o.kind !== 'subIn'));
      const add = (k: ShiftOverrideKind, empId: string, start: string | null, end: string | null, b: number, subId: string | null = null) =>
        d.overrides.push({ id: uid('ov'), employeeId: empId, date, kind: k, start, end, breakMin: b, memo, substitutionId: subId, createdAt: nowIso() });
      if (kind === 'change') add('change', e.id, t.start, t.end, t.breakMin);
      if (kind === 'extra') add('extra', e.id, t.start, t.end, t.breakMin);
      if (kind === 'absent') add('absent', e.id, null, null, 0);
      if (kind === 'leave') add('leave', e.id, null, null, 0);
      if (kind === 'sub' && to && plan.shift) {
        const sid = uid('sub');
        d.substitutions.push({ id: sid, date, fromEmployeeId: e.id, toEmployeeId: to.id, mode: 'owner', status: 'approved', memo, createdAt: nowIso(), decidedAt: nowIso() });
        add('subOut', e.id, null, null, 0, sid);
        add('subIn', to.id, plan.shift.start, plan.shift.end, plan.shift.breakMin, sid);
        notifyEmp(d, to, `${fmtMDW(date)} ${plan.shift.start}–${plan.shift.end} 대타 근무가 잡혔어요`);
      }
      notifyEmp(d, e, `${fmtMDW(date)} 일정이 바뀌었어요`);
    });
    toast('일정을 바꿨어요');
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={`${e.alias} · ${fmtMDW(date)}`} footer={<><Button onClick={onClose}>취소</Button><Button variant="primary" onClick={save}>반영</Button></>}>
      <p className="mb-3 text-sm text-muted">
        계약상: {plan.contract ? `${plan.contract.start}–${plan.contract.end} (휴게 ${plan.contract.breakMin}분)` : '근무 없음'}
        {plan.publicHoliday && ` · ${plan.publicHoliday}`}
        {plan.isWeeklyHoliday && ' · 주휴일'}
      </p>
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['change', '시간 변경', !plan.shift && !plan.contract ? '예정 근무가 없어요' : undefined],
            ['extra', '추가 근무', undefined],
            ['absent', '결근', !plan.shift ? '예정 근무가 없어요' : undefined],
            ['sub', '대타', !plan.shift ? '예정 근무가 없어요' : undefined],
            ['leave', '연차', under5 ? '1~4명 사업장은 연차 미적용' : !plan.contract ? '소정근로일이 아니에요' : undefined],
            ['reset', '원래대로', !plan.overrides.length ? '바꾼 내용이 없어요' : undefined],
          ] as const
        ).map(([k, l, reason]) => (
          <Button key={k} size="sm" variant={kind === k ? 'primary' : 'secondary'} onClick={() => setKind(k)} reason={reason} disabled={!!reason}>
            {l}
          </Button>
        ))}
      </div>
      {(kind === 'change' || kind === 'extra') && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Field label="시작" htmlFor="cm-s">
            <input id="cm-s" type="time" className={inputCls} value={t.start} onChange={(ev) => setT({ ...t, start: ev.target.value })} />
          </Field>
          <Field label="종료" htmlFor="cm-e">
            <input id="cm-e" type="time" className={inputCls} value={t.end} onChange={(ev) => setT({ ...t, end: ev.target.value })} />
          </Field>
          <Field label="휴게(분)" htmlFor="cm-b">
            <input id="cm-b" type="number" className={inputCls} value={t.breakMin} onChange={(ev) => setT({ ...t, breakMin: Number(ev.target.value) })} />
          </Field>
        </div>
      )}
      {kind === 'absent' && <Notice tone="info" className="mt-3">결근한 주는 주휴수당 개근 요건을 채우지 못해요. 지각은 일하지 않은 시간만 빼고, 벌금은 없어요.</Notice>}
      {kind === 'sub' && (
        <div className="mt-3">
          <Field label="대신할 직원" htmlFor="cm-sub">
            <select id="cm-sub" className={inputCls} value={subTo} onChange={(ev) => setSubTo(ev.target.value)}>
              <option value="">선택</option>
              {others.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.alias}
                </option>
              ))}
            </select>
          </Field>
          <p className="mt-1 text-xs text-muted">미리 합의한 대타는 근무일 변경으로 처리하고, 그 주 주휴수당에 "확인 필요"가 붙어요 (노무사 확인 C3). 반영 후 근무 경고에서 상대 직원의 주 15시간·허가시간을 확인하세요.</p>
        </div>
      )}
      {kind === 'leave' && <p className="mt-3 text-xs text-muted">연차로 표시한 날은 그날 소정근로시간만큼 유급으로 계산해요.</p>}
      {kind === 'reset' && <p className="mt-3 text-sm">이 날의 변경·결근·연차·대타 기록을 지우고 계약상 일정으로 되돌려요.</p>}
      <div className="mt-3">
        <Field label="메모 (선택)" htmlFor="cm-memo">
          <input id="cm-memo" className={inputCls} value={memo} onChange={(ev) => setMemo(ev.target.value)} />
        </Field>
      </div>
      {err && (
        <p role="alert" className="mt-2 text-sm font-semibold text-risk">
          {err}
        </p>
      )}
    </Modal>
  );
}

// ---------------- 출퇴근 기록 ----------------
function AttendanceTab() {
  const { state, update, base } = useStore();
  const toast = useToast();
  const [params] = useSearchParams();
  const focus = params.get('record');
  const [month, setMonth] = useState(monthOf(base));
  const [emp, setEmp] = useState('');
  const [editing, setEditing] = useState<AttendanceRecord | null>(null);
  const [form, setForm] = useState({ in: '', out: '', reason: '' });
  const [adding, setAdding] = useState(false);
  const [add, setAdd] = useState({ emp: '', date: base, in: '10:00', out: '15:00', reason: '' });
  const [err, setErr] = useState('');
  const recs = state.attendance
    .filter((a) => a.date.startsWith(month) && (!emp || a.employeeId === emp))
    .sort((a, b) => (a.status !== 'confirmed' ? -1 : 0) - (b.status !== 'confirmed' ? -1 : 0) || (a.date < b.date ? 1 : -1));
  const alias = (id: string) => state.employees.find((e) => e.id === id)?.alias ?? '';

  const decide = (r: AttendanceRecord, approval: 'actual' | 'planned') => {
    update((d) => {
      const x = d.attendance.find((y) => y.id === r.id)!;
      x.status = 'confirmed';
      x.approval = approval;
      x.confirmedAt = nowIso();
      const e = d.employees.find((y) => y.id === r.employeeId)!;
      notifyEmp(d, e, `${fmtMD(r.date)} 출퇴근 기록을 사장님이 ${approval === 'actual' ? '기록 시간대로' : '예정 시간으로'} 확정했어요`);
    });
    toast('확정했어요. 확정한 시간만 급여에 반영돼요.');
  };
  const saveEdit = () => {
    if (!editing) return;
    if (!isHHMM(form.in) || !isHHMM(form.out)) return setErr('출근·퇴근 시간을 확인하세요');
    if (!form.reason.trim()) return setErr('수정 사유는 필수예요 (직원에게도 보여요)');
    const before = currentTimes(editing, state.attendanceEdits);
    update((d) => {
      d.attendanceEdits.push({ id: uid('edit'), recordId: editing.id, before, after: { clockIn: form.in, clockOut: form.out }, reason: form.reason.trim(), by: 'owner', at: nowIso(), employeeResponse: null });
      const x = d.attendance.find((y) => y.id === editing.id)!;
      x.status = 'confirmed';
      x.approval = 'actual';
      x.confirmedAt = nowIso();
      const e = d.employees.find((y) => y.id === editing.employeeId)!;
      notifyEmp(d, e, `${fmtMD(editing.date)} 출퇴근 기록이 사장님에 의해 수정됐어요 · 사유: ${form.reason.trim()}`, '/employee/schedule');
    });
    setEditing(null);
    toast('수정했어요. 원래 기록은 그대로 남아요.');
  };
  const saveAdd = () => {
    const e = state.employees.find((x) => x.id === add.emp);
    if (!e) return setErr('직원을 고르세요');
    if (!isHHMM(add.in) || !isHHMM(add.out)) return setErr('시간을 확인하세요');
    if (!add.reason.trim()) return setErr('사유를 적어 주세요');
    if (state.attendance.some((a) => a.employeeId === e.id && a.date === add.date)) return setErr('그날 기록이 이미 있어요 — 기존 기록을 수정하세요');
    update((d) => {
      d.seq += 1;
      d.attendance.push({ id: uid('att'), recordNo: `R-${add.date.replace(/-/g, '')}-${String(d.seq).padStart(4, '0')}`, employeeId: e.id, date: add.date, original: { clockIn: add.in, clockOut: add.out }, source: 'owner', gps: null, status: 'confirmed', approval: 'actual', reason: add.reason.trim(), createdAt: nowIso(), confirmedAt: nowIso() });
      notifyEmp(d, e, `${fmtMD(add.date)} 출퇴근 기록을 사장님이 직접 남겼어요`);
    });
    setAdding(false);
    toast('기록했어요');
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-2">
        <Field label="월" htmlFor="at-m">
          <input id="at-m" type="month" className={inputCls} value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
        </Field>
        <Field label="직원" htmlFor="at-e">
          <select id="at-e" className={inputCls} value={emp} onChange={(e) => setEmp(e.target.value)}>
            <option value="">전체</option>
            {state.employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.alias}
              </option>
            ))}
          </select>
        </Field>
        <Button onClick={() => { setAdding(true); setErr(''); setAdd({ ...add, emp: emp || state.employees[0]?.id || '' }); }}>수동 기록 추가</Button>
        <Button onClick={() => window.print()} className="ml-auto">
          출퇴근 명부 인쇄
        </Button>
      </div>
      <Notice tone="muted">
        {state.workplace?.gpsEnabled ? 'GPS는 직원이 버튼을 누를 때만 확인해요 (데모는 가상 위치).' : 'GPS를 끈 사업장이에요. 일정이 곧 실제 근무이고, 바뀐 날만 고치면 돼요.'} 예정보다 일찍 출근·늦게 퇴근한 시간은 자르지도 더하지도 않고 "확인 대기"로 둬요.
      </Notice>
      {!recs.length && <Empty title="이 달의 출퇴근 기록이 없어요">기록이 없는 날은 일정 시간으로 급여를 계산해요.</Empty>}
      <div className="print-area grid gap-2">
        <p className="hidden text-lg font-bold print:block">
          출퇴근 명부 · {month} · {state.workplace?.name} (별칭 기준)
        </p>
        {recs.map((r) => {
          const e = state.employees.find((x) => x.id === r.employeeId)!;
          const plan = dayPlan(state, e, r.date);
          const cur = currentTimes(r, state.attendanceEdits);
          const edits = state.attendanceEdits.filter((x) => x.recordId === r.id);
          return (
            <div key={r.id} className={cx('rounded-xl border bg-white p-3 text-sm', r.id === focus ? 'border-brand ring-2 ring-brand/20' : 'border-line')}>
              <div className="flex flex-wrap items-center gap-2">
                <b>{alias(r.employeeId)}</b>
                <span>{fmtMDW(r.date)}</span>
                <span className="font-mono text-xs text-muted">{r.recordNo}</span>
                <Badge tone={r.status === 'confirmed' ? 'ok' : r.status === 'pending' ? 'warn' : 'risk'}>{r.status === 'confirmed' ? '확정' : r.status === 'pending' ? '확인 대기' : '예외'}</Badge>
                {r.gps && <Badge tone="muted">{r.gps === 'inside' ? '반경 안' : r.gps === 'outside' ? '반경 밖' : '위치 거부'} · {r.source === 'gps-demo' ? '가상 위치' : r.source}</Badge>}
                {r.approval === 'planned' && <Badge tone="info">예정 시간으로 확정</Badge>}
              </div>
              <p className="mt-1">
                예정 {plan.shift ? `${plan.shift.start}–${plan.shift.end}` : '없음'} · 기록 <span className="num">{r.original.clockIn ?? '—'}–{r.original.clockOut ?? '—'}</span>
                {edits.length > 0 && (
                  <>
                    {' '}
                    → 현재 <b className="num">{cur.clockIn}–{cur.clockOut}</b>
                  </>
                )}
                {r.reason && <span className="text-muted"> · {r.reason}</span>}
              </p>
              {edits.length > 0 && (
                <ul className="mt-1 space-y-0.5 border-l-2 border-line pl-2 text-xs text-muted">
                  {edits.map((x) => (
                    <li key={x.id}>
                      {fmtDateTime(x.at)} 사장님 수정 {x.before.clockIn}–{x.before.clockOut} → {x.after.clockIn}–{x.after.clockOut} · 사유: {x.reason}
                      {x.employeeResponse && <> · 직원 {x.employeeResponse.status === 'confirmed' ? '확인함' : `다른 점 있음: “${x.employeeResponse.memo}”`}</>}
                    </li>
                  ))}
                </ul>
              )}
              <div className="no-print mt-2 flex flex-wrap gap-2">
                {r.status !== 'confirmed' && (
                  <>
                    <Button size="sm" variant="primary" onClick={() => decide(r, 'actual')} reason={!r.original.clockIn || !r.original.clockOut ? '출근·퇴근 시간이 모두 있어야 해요 — 시간 수정으로 입력' : undefined}>
                      기록 시간대로 근무 인정
                    </Button>
                    <Button size="sm" onClick={() => decide(r, 'planned')} reason={!plan.shift ? '예정 근무가 없어요' : undefined}>
                      예정 시간으로 확정
                    </Button>
                  </>
                )}
                <Button size="sm" onClick={() => { setEditing(r); setErr(''); setForm({ in: cur.clockIn ?? plan.shift?.start ?? '', out: cur.clockOut ?? plan.shift?.end ?? '', reason: '' }); }}>
                  시간 수정
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="출퇴근 시간 수정" footer={<><Button onClick={() => setEditing(null)}>취소</Button><Button variant="primary" onClick={saveEdit}>수정</Button></>}>
        <p className="mb-3 text-sm text-muted">원래 기록은 지워지지 않고, 수정 이력과 사유가 직원에게도 보여요. 직원은 [다른 점이 있어요]로 이의를 남길 수 있어요.</p>
        <div className="grid grid-cols-2 gap-2">
          <Field label="출근" htmlFor="ed-in">
            <input id="ed-in" type="time" className={inputCls} value={form.in} onChange={(e) => setForm({ ...form, in: e.target.value })} />
          </Field>
          <Field label="퇴근" htmlFor="ed-out">
            <input id="ed-out" type="time" className={inputCls} value={form.out} onChange={(e) => setForm({ ...form, out: e.target.value })} />
          </Field>
        </div>
        <div className="mt-2">
          <Field label="사유 (필수)" htmlFor="ed-r">
            <input id="ed-r" className={inputCls} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </Field>
        </div>
        {err && <p role="alert" className="mt-2 text-sm font-semibold text-risk">{err}</p>}
      </Modal>
      <Modal open={adding} onClose={() => setAdding(false)} title="수동 출퇴근 기록" footer={<><Button onClick={() => setAdding(false)}>취소</Button><Button variant="primary" onClick={saveAdd}>기록</Button></>}>
        <div className="grid gap-2">
          <Field label="직원" htmlFor="ad-e">
            <select id="ad-e" className={inputCls} value={add.emp} onChange={(e) => setAdd({ ...add, emp: e.target.value })}>
              {state.employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.alias}
                </option>
              ))}
            </select>
          </Field>
          <Field label="날짜" htmlFor="ad-d">
            <input id="ad-d" type="date" className={inputCls} value={add.date} onChange={(e) => setAdd({ ...add, date: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="출근" htmlFor="ad-in">
              <input id="ad-in" type="time" className={inputCls} value={add.in} onChange={(e) => setAdd({ ...add, in: e.target.value })} />
            </Field>
            <Field label="퇴근" htmlFor="ad-out">
              <input id="ad-out" type="time" className={inputCls} value={add.out} onChange={(e) => setAdd({ ...add, out: e.target.value })} />
            </Field>
          </div>
          <Field label="사유" htmlFor="ad-r">
            <input id="ad-r" className={inputCls} value={add.reason} onChange={(e) => setAdd({ ...add, reason: e.target.value })} placeholder="예: 위치 거부 — 사장님 확인" />
          </Field>
          {err && <p role="alert" className="text-sm font-semibold text-risk">{err}</p>}
        </div>
      </Modal>
    </div>
  );
}

// ---------------- 대타 ----------------
function SubsTab() {
  const { state, update } = useStore();
  const toast = useToast();
  const alias = (id: string | null) => state.employees.find((e) => e.id === id)?.alias ?? '—';
  const list = [...state.substitutions].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const approve = (id: string, ok: boolean) => {
    const s = state.substitutions.find((x) => x.id === id)!;
    const from = state.employees.find((e) => e.id === s.fromEmployeeId)!;
    const plan = dayPlan(state, from, s.date);
    if (ok && !plan.shift) return toast('그날 원래 직원의 예정 근무가 없어요', 'warn');
    update((d) => {
      const x = d.substitutions.find((y) => y.id === id)!;
      x.status = ok ? 'approved' : 'rejected';
      x.decidedAt = nowIso();
      if (ok && plan.shift && x.toEmployeeId) {
        d.overrides = d.overrides.filter((o) => !(o.employeeId === from.id && o.date === s.date && o.kind !== 'subIn'));
        d.overrides.push({ id: uid('ov'), employeeId: from.id, date: s.date, kind: 'subOut', start: null, end: null, breakMin: 0, memo: '대타 승인', substitutionId: id, createdAt: nowIso() });
        d.overrides.push({ id: uid('ov'), employeeId: x.toEmployeeId, date: s.date, kind: 'subIn', start: plan.shift.start, end: plan.shift.end, breakMin: plan.shift.breakMin, memo: '대타 승인', substitutionId: id, createdAt: nowIso() });
      }
      for (const eid of [x.fromEmployeeId, x.toEmployeeId]) {
        const e = d.employees.find((y) => y.id === eid);
        if (e) notifyEmp(d, e, `${fmtMD(s.date)} 대타 ${ok ? '승인' : '거절'}됐어요`);
      }
    });
    toast(ok ? '승인했어요. 일정과 급여에 반영돼요.' : '거절했어요');
  };
  return (
    <div className="grid gap-4">
      <Notice tone="muted">기본은 사장님이 일정 칸에서 직접 지정해요 (직원 가입 불필요). 가입한 직원은 요청 → 다른 직원 신청 → 사장님 승인 순서예요.</Notice>
      {!list.length && <Empty title="대타 기록이 없어요">일정 탭에서 칸을 눌러 [대타]로 지정할 수 있어요.</Empty>}
      <ul className="grid gap-2">
        {list.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white p-3 text-sm">
            <b>{fmtMDW(s.date)}</b>
            <span>
              {alias(s.fromEmployeeId)} → {alias(s.toEmployeeId)}
            </span>
            <Badge tone="muted">{s.mode === 'owner' ? '사장님 지정' : '직원 요청'}</Badge>
            <Badge tone={s.status === 'approved' ? 'ok' : s.status === 'applied' ? 'warn' : s.status === 'open' ? 'info' : 'muted'}>{{ open: '구하는 중', applied: '승인 대기', approved: '승인', rejected: '거절', cancelled: '취소' }[s.status]}</Badge>
            {s.status === 'applied' && (
              <span className="ml-auto flex gap-2">
                <Button size="sm" variant="primary" onClick={() => approve(s.id, true)}>
                  승인
                </Button>
                <Button size="sm" onClick={() => approve(s.id, false)}>
                  거절
                </Button>
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------- 연차 ----------------
function LeaveTab() {
  const { state, update, base } = useStore();
  const toast = useToast();
  const [adjust, setAdjust] = useState<{ id: string; reason: string } | null>(null);
  const under5 = isUnder5(state.workplace?.scale);
  const emps = activeEmps(state, base);
  const rows = useMemo(() => emps.map((e) => ({ e, a: leaveAccrual(state, e, base) })), [emps, state, base]);
  if (under5)
    return (
      <Notice tone="muted" title="지금은 해당 없음">
        1~4명 사업장은 연차 규정이 적용되지 않아요 (근로기준법 시행령 별표 1). 규모 구간을 5명 이상으로 바꾸면 연차 신청·승인·촉진 기한이 열려요.
      </Notice>
    );
  const decide = (id: string, ok: boolean, reason = '') => {
    const l = state.leaveRequests.find((x) => x.id === id)!;
    update((d) => {
      const x = d.leaveRequests.find((y) => y.id === id)!;
      x.status = ok ? 'approved' : 'adjust';
      x.adjustReason = reason;
      x.decidedAt = nowIso();
      if (ok) {
        d.overrides = d.overrides.filter((o) => !(o.employeeId === l.employeeId && o.date === l.date && o.kind !== 'subIn'));
        if (!l.hours) d.overrides.push({ id: uid('ov'), employeeId: l.employeeId, date: l.date, kind: 'leave', start: null, end: null, breakMin: 0, memo: '연차 승인', substitutionId: null, createdAt: nowIso() });
      }
      const e = d.employees.find((y) => y.id === l.employeeId)!;
      notifyEmp(d, e, `${fmtMD(l.date)} 연차 ${ok ? '승인' : `조정 요청: ${reason}`}`, '/employee/leave');
    });
    toast(ok ? '승인했어요. 일정에 연차로 표시돼요.' : '조정 요청을 보냈어요 (앱 안 알림)');
  };
  const pending = state.leaveRequests.filter((l) => l.status === 'requested');
  return (
    <div className="grid gap-4">
      <Card title="승인 대기">
        {!pending.length && <p className="text-sm text-muted">대기 중인 신청이 없어요. 직원이 가입하지 않았으면 일정 칸에서 [연차]로 직접 기록하세요.</p>}
        <ul className="grid gap-2">
          {pending.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-2 text-sm">
              <b>{state.employees.find((e) => e.id === l.employeeId)?.alias}</b> {fmtMDW(l.date)} {l.hours ? `${l.hours}시간` : '하루'} <span className="text-muted">신청 {localDate(l.requestedAt)}</span>
              <span className="ml-auto flex gap-2">
                <Button size="sm" variant="primary" onClick={() => decide(l.id, true)}>
                  승인
                </Button>
                <Button size="sm" onClick={() => setAdjust({ id: l.id, reason: '' })}>
                  다른 날로 조정 요청
                </Button>
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="직원별 연차">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="py-1">직원</th>
              <th>발생</th>
              <th>사용</th>
              <th>남음</th>
              <th>촉진</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map(({ e, a }) => (
              <tr key={e.id}>
                <td className="py-2 font-semibold">{e.alias}</td>
                {a.applicable ? (
                  <>
                    <td>{a.partTime ? `${a.totalHours}h` : `${a.totalDays}일`}</td>
                    <td>{a.partTime ? `${a.usedHours}h` : `${a.usedDays}일`}</td>
                    <td className="font-bold">{a.partTime ? `${a.remainingHours}h` : `${a.remainingDays}일`}</td>
                    <td className="text-xs">{a.promotion ? `${fmtMD(a.promotion.notifyFrom)} 촉구 / ${fmtMD(a.promotion.designateBy)} 지정` : '—'}</td>
                  </>
                ) : (
                  <td colSpan={4} className="text-xs text-muted">
                    {a.reason}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-2">
          <Basis ids={['annualLeave.accrual', 'annualLeave.partTime', 'annualLeave.changeTiming', 'annualLeave.promotion']} date={base} />
        </div>
      </Card>
      <Card title="처리 기록">
        <ul className="text-sm">
          {state.leaveRequests.filter((l) => l.status !== 'requested').map((l) => (
            <li key={l.id} className="py-1">
              {state.employees.find((e) => e.id === l.employeeId)?.alias} {fmtDate(l.date)} · 신청 {localDate(l.requestedAt)} · 처리 {localDate(l.decidedAt)} · {l.status === 'approved' ? '승인' : l.status === 'adjust' ? `조정 요청 (${l.adjustReason})` : '취소'}
            </li>
          ))}
        </ul>
      </Card>
      <Modal open={!!adjust} onClose={() => setAdjust(null)} title="다른 날로 조정 요청" footer={<><Button onClick={() => setAdjust(null)}>취소</Button><Button variant="primary" onClick={() => { if (!adjust?.reason.trim()) return; decide(adjust.id, false, adjust.reason.trim()); setAdjust(null); }} reason={!adjust?.reason.trim() ? '사유를 적어야 보낼 수 있어요' : undefined}>보내기</Button></>}>
        <Notice tone="warn" title="사업 운영에 막대한 지장이 있을 때만 시기를 바꿀 수 있어요">근로기준법 제60조⑤ 단서 (2027.6.10부터 ⑥). 연차 청구·사용을 이유로 불리하게 대할 수 없어요.</Notice>
        <div className="mt-3">
          <Field label="사유" htmlFor="adj-r">
            <input id="adj-r" className={inputCls} value={adjust?.reason ?? ''} onChange={(e) => adjust && setAdjust({ ...adjust, reason: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

export default function Work() {
  const [params, setParams] = useSearchParams();
  const { state } = useStore();
  const tab = choiceParam(params.get('tab'), ['schedule', 'attendance', 'subs', 'leave'] as const, 'schedule');
  const pend = state.attendance.filter((a) => a.status !== 'confirmed').length;
  return (
    <div>
      <PageHeader title="근무" sub="일정이 기준이에요. 대타와 출퇴근 기록은 일정을 고치는 수단이고, 사장님이 확정한 시간만 급여로 넘어가요." />
      <Tabs<Tab>
        tabs={[
          { value: 'schedule', label: '일정' },
          { value: 'attendance', label: `출퇴근 기록${pend ? ` (${pend})` : ''}` },
          { value: 'subs', label: '대타' },
          { value: 'leave', label: '연차' },
        ]}
        value={tab}
        onChange={(t) => setParams({ tab: t }, { replace: true })}
      />
      {tab === 'schedule' && <ScheduleTab />}
      {tab === 'attendance' && <AttendanceTab />}
      {tab === 'subs' && <SubsTab />}
      {tab === 'leave' && <LeaveTab />}
    </div>
  );
}


