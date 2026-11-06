// 직원 화면 (S15~S18) — 본인 데이터만(employeeScope). 출퇴근(가상 위치·영수증), 내 일정·확정 시간, 대타, 연차(5명 이상), 임금명세서 수령 확인.
import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { useStore, uid, nowIso, pushNotification } from '../../state/store';
import { employeeScope } from '../../domain/scopes';
import { classifyClock, conditionAt, dayPlan, isUnder5, weekDates } from '../../domain/work';
import { leaveAccrual } from '../../domain/leave';
import { demoLocate } from '../../adapters/integrations';
import { addDays, fmtDate, fmtMD, fmtMDW, fmtYM, isHHMM, isISODate, listDates, WEEKDAY_EN, WEEKDAY_KO, fmtDateTime, localDate, fmtMDT } from '../../domain/dates';
import type { Employee } from '../../domain/types';
import { Badge, Button, Card, cx, Empty, Field, inputCls, inputBaseCls, Modal, Notice, useToast } from '../../ui/kit';
import { StatementView } from '../../ui/Statement';
import { schedText } from '../../ui/scheduleText';

function useMe() {
  const { state, session, base } = useStore();
  const id = session?.employeeId ?? '';
  const emp = state.employees.find((e) => e.id === id) ?? null;
  const view = useMemo(() => (id ? employeeScope(state, id, base) : null), [state, id, base]);
  const en = state.settings.employeeLang[id] === 'en';
  const t = (ko: string, eng: string) => (en ? eng : ko);
  return { emp, view, en, t, id };
}

const nowHM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export function EmployeeTitle() {
  const { state, update } = useStore();
  const { emp, view, en, id } = useMe();
  return (
    <>
      <p className="font-bold">
        {emp?.alias ?? '직원'} · {view?.workplaceName ?? ''}
      </p>
      <button type="button" className="rounded-lg border border-line px-2 py-1 text-xs font-semibold" onClick={() => update((d) => { d.settings.employeeLang = { ...state.settings.employeeLang, [id]: en ? 'ko' : 'en' }; })} aria-label="언어 전환">
        {en ? '한국어' : 'EN'}
      </button>
    </>
  );
}

function Guard({ children }: { children: React.ReactNode }) {
  const { emp } = useMe();
  if (!emp) return <Empty title="직원 정보를 찾을 수 없어요">데모 역할 메뉴에서 다른 직원을 고르세요.</Empty>;
  if (emp.account === 'blocked') return <Notice tone="muted" title="로그인이 막혔어요">퇴사 처리로 직원 앱 사용이 끝났어요. 기록은 서류 보관 기한까지 사장님 쪽에 남아요.</Notice>;
  if (emp.account !== 'joined') return <Navigate to="/employee/join" replace />;
  return <>{children}</>;
}

// ---- 가입·근로조건 확인 ----
export function EmpJoin() {
  const { state, update, base } = useStore();
  const { emp, t } = useMe();
  const nav = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState<'login' | 'confirm' | 'location' | 'done'>(emp?.account === 'joined' ? 'confirm' : 'login');
  const [memo, setMemo] = useState('');
  const [disputing, setDisputing] = useState(false);
  const [params, setParams] = useSearchParams();
  if (!emp) return <Empty title="초대 정보를 찾을 수 없어요" />;
  if (emp.account === 'blocked') return <Notice tone="muted">퇴사 처리된 계정이에요.</Notice>;
  const mine = state.conditions.filter(x => x.employeeId === emp.id).sort((a,b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  const pending = mine.filter(c => !emp.conditionAcks.some(a => a.conditionId === c.id && a.status === 'confirmed'));
  const target = params.get('condition');
  const c = target ? mine.find(c => c.id === target) : pending[0] ?? conditionAt(state.conditions, emp.id, base) ?? mine[0];
  const inviteValid = emp.account === 'joined' || (emp.invite && !emp.invite.used && emp.invite.expiresAt >= base);
  const finish = (status: 'confirmed' | 'disputed') => {
    if (status === 'disputed' && !memo.trim()) return;
    update((d) => {
      const x = d.employees.find((y) => y.id === emp.id)!;
      const first = x.account !== 'joined';
      x.account = 'joined';
      if (x.invite) x.invite.used = true;
      if (c && (status === 'disputed' || !x.conditionAcks.some(a => a.conditionId === c.id && a.status === 'confirmed'))) x.conditionAcks.push({ conditionId: c.id, status, memo: memo.trim(), at: nowIso(), resolvedAt: null });
      pushNotification(d, 'owner', 'employeeJoined', status === 'confirmed' ? `${x.alias} ${first ? '가입·' : ''}근로조건 확인 완료` : `${x.alias} 근로조건에 "다른 점이 있어요": ${memo.trim()}`, `/owner/employees/${x.id}`);
    });
    setStep(state.workplace?.gpsEnabled && !emp.locationConsent ? 'location' : 'done');
  };
  if (!inviteValid) return <Notice tone="warn" title="초대 링크가 만료됐거나 이미 쓰였어요">사장님께 다시 보내 달라고 하세요 (재발급 가능).</Notice>;
  if (!c) return <Notice tone="warn" title="확인할 근로조건을 찾지 못했어요">사장님께 근로조건 등록을 요청해 주세요.</Notice>;
  return (
    <div className="grid gap-4">
      {step === 'login' && (
        <Card title={t('가입하기', 'Sign up')}>
          <p className="text-sm text-muted">사장님이 보낸 초대 링크예요 (일회용 · {emp.invite ? fmtDate(emp.invite.expiresAt) : ''}까지).</p>
          <div className="mt-3 grid gap-2">
            <Button variant="kakao" reason="연결 대기 — 카카오 로그인 미연결">{t('카카오로 시작하기', 'Continue with Kakao')}</Button>
            <Button reason="연결 대기 — 이메일 가입 미연결">{t('이메일로 가입', 'Sign up with email')}</Button>
            <Button variant="primary" onClick={() => setStep('confirm')}>
              {t('로컬 데모로 계속', 'Continue (local demo)')}
            </Button>
          </div>
        </Card>
      )}
      {step === 'confirm' && c && (
        <Card title={t('근로조건 확인', 'Check your working conditions')}>
          {mine.length > 1 && <Field label={t('확인할 조건', 'Working conditions')} htmlFor="join-condition"><select id="join-condition" className={inputCls} value={c.id} onChange={ev => { setParams({ condition: ev.target.value }, { replace: true }); setMemo(''); setDisputing(false); }}>
            {mine.map(item => <option key={item.id} value={item.id}>{item.effectiveFrom} · {emp.conditionAcks.some(a => a.conditionId === item.id && a.status === 'confirmed') ? t('확인함','Confirmed') : t('확인 대기','To review')}</option>)}
          </select></Field>}
          <p className="my-3 text-sm font-semibold text-brand">{c.effectiveFrom > base ? t('앞으로 적용될 근로조건이에요.', 'These conditions take effect in the future.') : t('선택한 적용일의 근로조건이에요.', 'Conditions for the selected effective date.')}</p>
          <ul className="space-y-1 text-sm">
            <li>{t('입사일', 'Start date')}: {fmtDate(emp.hireDate)}</li>
            <li>{t('근무 요일·시간', 'Schedule')}: {schedText(c, state.settings.employeeLang[emp.id] === 'en')}</li>
            <li>{t('시급', 'Hourly wage')}: {c.hourlyWage.toLocaleString('ko-KR')}원</li>
            <li>{t('적용일', 'Effective from')}: {fmtDate(c.effectiveFrom)}</li>
          </ul>
          <p className="mt-2 text-xs text-muted">{t('확인 기록은 분쟁 때 근거가 돼요. 근로계약서 교부를 대신하지 않아요.', 'Your confirmation is kept as a record. It does not replace the written contract.')}</p>
          {disputing ? (
            <div className="mt-3 grid gap-2">
              <Field label={t('다른 점 (한 줄)', 'What is different?')} htmlFor="j-m">
                <input id="j-m" className={inputCls} value={memo} onChange={(e) => setMemo(e.target.value)} />
              </Field>
              <Button variant="primary" onClick={() => finish('disputed')} reason={!memo.trim() ? '내용을 적어 주세요' : undefined}>
                {t('보내기', 'Send')}
              </Button>
            </div>
          ) : (
            <div className="mt-3 flex gap-2">
              <Button variant="primary" onClick={() => finish('confirmed')}>
                {t('확인했어요', 'Confirmed')}
              </Button>
              <Button onClick={() => setDisputing(true)}>{t('다른 점이 있어요', 'Something is different')}</Button>
            </div>
          )}
        </Card>
      )}
      {step === 'location' && (
        <Card title={t('위치 확인 동의', 'Location consent')}>
          <p className="text-sm">출근·퇴근 버튼을 누를 때만 위치를 한 번 확인해요. 실시간 추적은 없고, 사장님에게는 반경 안/밖 판정만 보여요. 데모는 가상 위치를 써요.</p>
          <div className="mt-3 flex gap-2">
            <Button variant="primary" onClick={() => { update((d) => { d.employees.find((y) => y.id === emp.id)!.locationConsent = { at: nowIso(), revokedAt: null }; }); setStep('done'); }}>
              {t('동의', 'Agree')}
            </Button>
            <Button onClick={() => setStep('done')}>{t('거부 (수동 출퇴근)', 'Decline (manual)')}</Button>
          </div>
        </Card>
      )}
      {step === 'done' && (
        <Card title={t('완료', 'Done')}>
          <p className="text-sm">{t('사장님께 확인 결과가 앱 안 알림으로 전달됐어요.', 'Your employer was notified in the app.')}</p>
          <Button variant="primary" className="mt-3" onClick={() => { toast('가입 완료'); nav('/employee'); }}>
            {t('홈으로', 'Home')}
          </Button>
        </Card>
      )}
    </div>
  );
}

// ---- 홈 (S15) + 출근 영수증 (S16) ----
export function EmpHome() {
  return (
    <Guard>
      <EmpHomeInner />
    </Guard>
  );
}

function Receipt({ rec, en }: { rec: { recordNo: string; time: string; inside: boolean; distance: number; kind: '출근' | '퇴근'; reason: string }; en: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <svg viewBox="0 0 200 110" className="h-28 w-full rounded-xl bg-canvas" role="img" aria-label={en ? 'Virtual map showing shop radius' : '가상 지도: 가게 반경과 내 위치'}>
        <rect x="0" y="50" width="200" height="10" fill="var(--surface)" />
        <rect x="95" y="0" width="10" height="110" fill="var(--surface)" />
        <circle cx="100" cy="55" r="34" fill="var(--action)" fillOpacity=".12" stroke="var(--action)" strokeDasharray="4 3" />
        <circle cx="100" cy="55" r="4" fill="var(--action)" />
        <circle cx={rec.inside ? 112 : 168} cy={rec.inside ? 48 : 20} r="5" fill={rec.inside ? 'var(--color-ok)' : 'var(--color-risk)'} />
      </svg>
      <p className="mt-3 text-lg font-bold">
        {rec.time} {rec.kind} {en ? 'recorded' : '기록됨'}
      </p>
      <p className="text-sm">
        {rec.inside ? (en ? 'Inside the shop radius' : '가게 반경 안') : en ? 'Outside the radius' : '가게 반경 밖'} · 약 {rec.distance}m {en ? '(virtual location)' : '(가상 위치)'}
      </p>
      {rec.reason && <p className="text-sm text-warn">{rec.reason}</p>}
      <p className="mt-1 font-mono text-xs text-muted">기록 번호 {rec.recordNo}</p>
      <p className="mt-1 text-xs text-muted">사장님 화면에도 같은 기록이 보여요. 좌표는 보내지 않아요.</p>
    </div>
  );
}

function EmpHomeInner() {
  const { state, update, base } = useStore();
  const { emp, view, en, t } = useMe();
  const toast = useToast();
  const nav = useNavigate();
  const [inside, setInside] = useState(true);
  const [time, setTime] = useState(nowHM());
  const [receipt, setReceipt] = useState<null | Parameters<typeof Receipt>[0]['rec']>(null);
  if (!emp || !view) return null;
  const plan = dayPlan(state, emp, base);
  const rec = view.attendance.find((a) => a.date === base);
  const week = weekDates(base);
  const gps = view.gpsEnabled;
  const consent = !!emp.locationConsent && !emp.locationConsent.revokedAt;
  const unread = view.notifications.filter((n) => !n.readAt);

  const clock = (kind: '출근' | '퇴근') => {
    if (!isHHMM(time)) return toast('시각 형식을 확인하세요', 'warn');
    const existing = state.attendance.find(a => a.employeeId === emp.id && a.date === base);
    if (kind === '출근' && existing) return toast(t('이미 출근 기록이 있어요.', 'You have already clocked in.'), 'warn');
    if (kind === '퇴근' && (!existing || existing.original.clockOut)) return toast(t('출퇴근 기록을 다시 확인해 주세요.', 'Please check your clock-in record.'), 'warn');
    const loc = consent ? demoLocate(inside) : null;
    const gpsResult = loc ? loc.gps : 'denied';
    let recordNo = rec?.recordNo ?? '';
    let reason = '';
    update((d) => {
      const tolerance = d.workplace?.lateToleranceMin ?? 5;
      const p = dayPlan(d, emp, base);
      if (kind === '출근') {
        d.seq += 1;
        recordNo = `R-${base.replace(/-/g, '')}-${String(d.seq).padStart(4, '0')}`;
        const cls = gpsResult === 'inside' ? { status: 'pending' as const, reason: '퇴근 기록 전' } : classifyClock(p, time, null, tolerance, gpsResult);
        reason = gpsResult !== 'inside' ? cls.reason : '';
        d.attendance.push({ id: uid('att'), recordNo, employeeId: emp.id, date: base, original: { clockIn: time, clockOut: null }, source: consent ? 'gps-demo' : 'manual', gps: gpsResult, status: cls.status, approval: null, reason: cls.reason, createdAt: nowIso(), confirmedAt: null });
      } else {
        const x = d.attendance.find((a) => a.employeeId === emp.id && a.date === base)!;
        x.original = { ...x.original, clockOut: time }; // 퇴근 시각을 처음 남기는 것 — 수정이 아님
        const g = x.gps === 'inside' && gpsResult === 'inside' ? 'inside' : x.gps === 'denied' || gpsResult === 'denied' ? 'denied' : 'outside';
        const cls = classifyClock(p, x.original.clockIn, time, tolerance, g);
        x.status = cls.status;
        x.reason = cls.reason;
        x.gps = g;
        if (cls.status === 'confirmed') x.confirmedAt = nowIso();
        recordNo = x.recordNo;
        reason = cls.status === 'confirmed' ? cls.reason : `${cls.reason} — 사장님 확인 대기`;
        if (cls.status !== 'confirmed') pushNotification(d, 'owner', 'attendance', `${emp.alias} ${fmtMD(base)} 출퇴근 확인 요청 · ${cls.reason}`, `/owner/work?tab=attendance&record=${x.id}`);
      }
    });
    setReceipt({ recordNo, time, inside: gpsResult === 'inside', distance: loc?.distanceM ?? 0, kind, reason });
  };

  return (
    <div className="grid gap-4">
      <Card title={t('오늘', 'Today')} right={fmtMDW(base)}>
        {plan.shift ? (
          <p className="text-lg font-bold">
            {plan.shift.start}–{plan.shift.end} <span className="text-sm font-normal text-muted">({t('휴게', 'break')} {plan.shift.breakMin}분)</span>
          </p>
        ) : (
          <p className="text-muted">{t('오늘은 예정된 근무가 없어요', 'No shift today')}</p>
        )}
        {gps ? (
          <div className="mt-3 grid gap-2">
            {consent ? (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted">데모 가상 위치:</span>
                <Button size="sm" variant={inside ? 'primary' : 'secondary'} onClick={() => setInside(true)}>가게 안</Button>
                <Button size="sm" variant={!inside ? 'primary' : 'secondary'} onClick={() => setInside(false)}>가게 밖</Button>
              </div>
            ) : (
              <p className="text-xs text-muted">위치 동의를 하지 않아 수동 기록으로 남고 사장님 확인을 거쳐요.</p>
            )}
            <label className="flex items-center gap-2 text-xs text-muted">
              데모 기록 시각
              <input type="time" className={cx(inputBaseCls, 'w-32')} value={time} onChange={(e) => setTime(e.target.value)} />
            </label>
            {!rec ? (
              <Button variant="primary" size="lg" className="w-full" onClick={() => clock('출근')}>
                {consent && !inside ? t('수동 출근 요청', 'Request manual clock-in') : t('출근하기', 'Clock in')}
              </Button>
            ) : !rec.original.clockOut ? (
              <Button variant="primary" size="lg" className="w-full" onClick={() => clock('퇴근')}>
                {t('퇴근하기', 'Clock out')}
              </Button>
            ) : (
              <p className="text-sm">
                {t('오늘 기록', 'Today')}: {rec.current.clockIn}–{rec.current.clockOut} <Badge tone={rec.status === 'confirmed' ? 'ok' : 'warn'}>{rec.status === 'confirmed' ? t('확정', 'Confirmed') : t('사장님 확인 대기', 'Pending')}</Badge>
              </p>
            )}
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted">{t('이 가게는 GPS 출퇴근을 쓰지 않아요. 일정이 곧 근무 기록이에요.', 'This shop does not use GPS clock-in.')}</p>
        )}
      </Card>
      {receipt && <Receipt rec={receipt} en={en} />}
      <Card title={t('이번 주', 'This week')}>
        <ul className="grid grid-cols-7 gap-1 text-center text-xs">
          {week.map((d, i) => {
            const p = dayPlan(state, emp, d);
            return (
              <li key={d} className={cx('rounded-lg border p-1', d === base ? 'border-brand' : 'border-line')}>
                <p className="font-semibold">{en ? WEEKDAY_EN[i] : WEEKDAY_KO[i]}</p>
                <p className="num">{p.shift ? `${p.shift.start.slice(0, 2)}-${p.shift.end.slice(0, 2)}` : p.off === 'leave' ? t('연차', 'Leave') : '–'}</p>
              </li>
            );
          })}
        </ul>
      </Card>
      <Card title={`${t('알림', 'Notifications')}${unread.length ? ` (${unread.length})` : ''}`}>
        {!view.notifications.length && <p className="text-sm text-muted">{t('알림이 없어요', 'No notifications')}</p>}
        <ul className="divide-y divide-line text-sm">
          {view.notifications.slice(0, 8).map((n) => (
            <li key={n.id} className={cx('py-2', !n.readAt && 'font-semibold')}>
              <button type="button" className="w-full text-left" onClick={() => { update((d) => { const x = d.notifications.find((y) => y.id === n.id); if (x && !x.readAt) x.readAt = nowIso(); }); if (n.link.startsWith('/employee')) nav(n.link); }}>{n.text} <span className="text-xs font-normal text-muted">{fmtMDT(n.createdAt)}</span></button>
            </li>
          ))}
        </ul>
        {view.openSubRequests.filter((s) => !s.mine && s.status === 'open').map((s) => (
          <div key={s.id} className="mt-2 flex items-center justify-between rounded-xl bg-canvas px-3 py-2 text-sm">
            <span>
              {s.fromAlias}가 {fmtMDW(s.date)} 대타를 구해요
            </span>
            <Button size="sm" variant="primary" onClick={() => { update((d) => { const x = d.substitutions.find((y) => y.id === s.id)!; x.status = 'applied'; x.toEmployeeId = emp.id; pushNotification(d, 'owner', 'sub', `${emp.alias}가 ${fmtMD(s.date)} 대타를 신청했어요 — 승인 대기`, '/owner/work?tab=subs'); }); toast('신청했어요. 사장님 승인을 기다려요.'); }}>
              {t('신청하기', 'Apply')}
            </Button>
          </div>
        ))}
        <p className="mt-2 text-xs text-muted">카톡 알림은 연결 대기예요 — 앱 안 알림만 와요.</p>
      </Card>
    </div>
  );
}

// ---- 일정 · 지난 근무 확정 시간 · 대타 ----
export function EmpSchedule() {
  return (
    <Guard>
      <EmpScheduleInner />
    </Guard>
  );
}

function EmpScheduleInner() {
  const { state, update, base } = useStore();
  const { emp, view, t } = useMe();
  const toast = useToast();
  const [dispute, setDispute] = useState<{ editId: string | null; recordId: string; memo: string } | null>(null);
  if (!emp || !view) return null;
  const upcoming = listDates(base, addDays(base, 27)).map((d) => ({ d, p: dayPlan(state, emp, d) })).filter((x) => x.p.shift || x.p.off);
  const past = view.attendance.filter((a) => a.date < base || a.original.clockOut).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 14);
  const requestSub = (date: string) => {
    if (view.openSubRequests.some((s) => s.mine && s.date === date && (s.status === 'open' || s.status === 'applied'))) return toast('이미 요청했어요', 'info');
    update((d) => {
      d.substitutions.push({ id: uid('sub'), date, fromEmployeeId: emp.id, toEmployeeId: null, mode: 'request', status: 'open', memo: '', createdAt: nowIso(), decidedAt: null });
      for (const o of d.employees.filter((x) => x.id !== emp.id && x.account === 'joined' && (!x.resignDate || x.resignDate >= base))) pushNotification(d, o.id, 'subRequest', `${emp.alias}가 ${fmtMD(date)} 대타를 구해요`, '/employee');
    });
    toast('대타 요청을 올렸어요 (가입한 다른 직원에게 앱 안 알림)');
  };
  return (
    <div className="grid gap-4">
      <Card title={t('다가오는 근무 (4주)', 'Upcoming shifts')}>
        <ul className="divide-y divide-line text-sm">
          {upcoming.map(({ d, p }) => {
            const req = view.openSubRequests.find((s) => s.mine && s.date === d && s.status !== 'cancelled' && s.status !== 'rejected');
            return (
              <li key={d} className="flex items-center justify-between gap-2 py-2">
                <span>
                  {fmtMDW(d)} {p.shift ? `${p.shift.start}–${p.shift.end}` : p.off === 'leave' ? t('연차', 'Leave') : p.off === 'subOut' ? t('대타로 빠짐', 'Covered') : p.off === 'publicHoliday' ? t('유급휴일', 'Paid holiday') : t('결근', 'Absent')}
                  {p.shift?.kind === 'subIn' && <Badge tone="info" className="ml-1">대타 근무</Badge>}
                </span>
                {p.shift && p.shift.kind !== 'subIn' && d > base && (req ? <Badge tone="warn">{{ open: '대타 구하는 중', applied: '승인 대기', approved: '승인', rejected: '', cancelled: '' }[req.status as 'open']}</Badge> : <Button size="sm" onClick={() => requestSub(d)}>{t('대타 요청', 'Request cover')}</Button>)}
              </li>
            );
          })}
        </ul>
      </Card>
      <Card title={t('지난 근무 확정 시간', 'Confirmed past hours')} right={t('금액은 보여주지 않아요', 'No amounts shown')}>
        {!past.length && <p className="text-sm text-muted">기록이 없어요.</p>}
        <ul className="divide-y divide-line text-sm">
          {past.map((a) => {
            const lastEdit = a.edits.slice(-1)[0];
            return (
              <li key={a.id} className="py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <b>{fmtMDW(a.date)}</b>
                  <span className="num">
                    {a.current.clockIn ?? '—'}–{a.current.clockOut ?? '—'}
                  </span>
                  <Badge tone={a.status === 'confirmed' ? 'ok' : 'warn'}>{a.status === 'confirmed' ? t('확정', 'Confirmed') : t('확인 대기', 'Pending')}</Badge>
                  <span className="font-mono text-[11px] text-muted">{a.recordNo}</span>
                </div>
                {lastEdit && (
                  <div className="mt-1 rounded-lg bg-canvas px-2 py-1 text-xs">
                    사장님에 의해 수정됐어요: {lastEdit.before.clockIn}–{lastEdit.before.clockOut} → {lastEdit.after.clockIn}–{lastEdit.after.clockOut} · 사유: {lastEdit.reason}
                    {lastEdit.employeeResponse ? (
                      <span className="ml-1 font-semibold">· {lastEdit.employeeResponse.status === 'confirmed' ? '확인함' : `다른 점 있음: ${lastEdit.employeeResponse.memo}`}</span>
                    ) : (
                      <span className="ml-1 inline-flex gap-1">
                        <button type="button" className="font-semibold text-brand underline" onClick={() => update((d) => { d.attendanceEdits.find((x) => x.id === lastEdit.id)!.employeeResponse = { status: 'confirmed', memo: '', at: nowIso() }; })}>
                          확인
                        </button>
                        <button type="button" className="font-semibold text-risk underline" onClick={() => setDispute({ editId: lastEdit.id, recordId: a.id, memo: '' })}>
                          다른 점이 있어요
                        </button>
                      </span>
                    )}
                  </div>
                )}
                {!lastEdit && a.status === 'confirmed' && (
                  <button type="button" className="mt-1 text-xs text-muted underline" onClick={() => setDispute({ editId: null, recordId: a.id, memo: '' })}>
                    {t('다른 점이 있어요', 'Something is different')}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-muted">시간 차이를 매주 바로 잡으면 나중에 몇 달 치를 한꺼번에 다투는 일을 줄일 수 있어요.</p>
      </Card>
      <Modal open={!!dispute} onClose={() => setDispute(null)} title="다른 점이 있어요" footer={<><Button onClick={() => setDispute(null)}>취소</Button><Button variant="primary" reason={!dispute?.memo.trim() ? '한 줄 사유를 적어 주세요' : undefined} onClick={() => { if (!dispute) return; update((d) => { const rec = d.attendance.find((r) => r.id === dispute.recordId)!; if (dispute.editId) d.attendanceEdits.find((x) => x.id === dispute.editId)!.employeeResponse = { status: 'disputed', memo: dispute.memo.trim(), at: nowIso() }; else { rec.status = 'exception'; rec.reason = `직원 이의: ${dispute.memo.trim()}`; } pushNotification(d, 'owner', 'dispute', `${emp.alias} ${fmtMD(rec.date)} 출퇴근 기록에 "다른 점이 있어요": ${dispute.memo.trim()}`, `/owner/work?tab=attendance&record=${rec.id}`); }); setDispute(null); toast('사장님 확인으로 넘겼어요'); }}>보내기</Button></>}>
        <Field label="한 줄 사유" htmlFor="ds-m">
          <input id="ds-m" className={inputCls} value={dispute?.memo ?? ''} onChange={(e) => dispute && setDispute({ ...dispute, memo: e.target.value })} placeholder="예: 15:30에 퇴근했어요" />
        </Field>
      </Modal>
    </div>
  );
}

// ---- 급여 (S17) ----
export function EmpPay() {
  return (
    <Guard>
      <EmpPayInner />
    </Guard>
  );
}

function EmpPayInner() {
  const { update } = useStore();
  const { emp, view, en, t } = useMe();
  const toast = useToast();
  const [open, setOpen] = useState<string | null>(null);
  const [memo, setMemo] = useState('');
  if (!emp || !view) return null;
  const list = [...view.statements].sort((a, b) => (a.month < b.month ? 1 : -1));
  const cur = list.find((s) => s.delivery.id === open);
  const openStmt = (id: string) => {
    setOpen(id);
    update((d) => {
      const s = d.statements.find((x) => x.id === id);
      if (s && !s.viewedAt) s.viewedAt = nowIso(); // 열람 시각 = 수령 확인
    });
  };
  return (
    <div className="grid gap-4">
      {!list.length && <Empty title={t('받은 임금명세서가 없어요', 'No wage statements yet')} />}
      {!cur && (
        <ul className="grid gap-2">
          {list.map((s) => (
            <li key={s.delivery.id}>
              <button type="button" onClick={() => openStmt(s.delivery.id)} className="flex w-full items-center justify-between rounded-2xl border border-line bg-white p-4 text-left">
                <span>
                  <b>{fmtYM(s.month)}분</b> <span className="text-sm text-muted">지급일 {fmtDate(s.line.payDate)}</span>
                </span>
                {s.delivery.viewedAt ? <Badge tone="ok">{t('수령 확인', 'Received')}</Badge> : <Badge tone="warn">{t('새 명세서', 'New')}</Badge>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {cur && (
        <>
          <Button onClick={() => setOpen(null)}>← {t('목록', 'List')}</Button>
          <StatementView line={cur.line} workplaceName={view.workplaceName} month={cur.month} en={en} nameInput={false} revision={cur.delivery.revision} />
          <p className="text-xs text-muted">{t('명세서를 연 시각이 수령 확인으로 남아요', 'Opening this statement records your receipt')}: {fmtDateTime(cur.delivery.viewedAt) ?? '방금'}</p>
          {cur.delivery.disputed ? (
            <Notice tone="info">이의를 남겼어요: “{cur.delivery.disputed.memo}”</Notice>
          ) : (
            <div className="flex gap-2">
              <input className={inputCls} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder={t('금액이 이상하면 한 줄로 적어 주세요', 'Describe the issue')} aria-label="금액 이의" />
              <Button
                reason={!memo.trim() ? undefined : undefined}
                disabled={!memo.trim()}
                onClick={() => {
                  update((d) => {
                    const s = d.statements.find((x) => x.id === cur.delivery.id)!;
                    s.disputed = { memo: memo.trim(), at: nowIso() };
                    pushNotification(d, 'owner', 'statementDispute', `${emp.alias} ${fmtYM(cur.month)}분 명세서 "금액이 이상해요": ${memo.trim()}`, `/owner/payroll?month=${cur.month}`);
                  });
                  setMemo('');
                  toast('사장님께 앱 안 알림으로 전달했어요');
                }}
              >
                {t('금액이 이상해요', 'Report an issue')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---- 연차 (S18, 5명 이상) ----
export function EmpLeave() {
  return (
    <Guard>
      <EmpLeaveInner />
    </Guard>
  );
}

function EmpLeaveInner() {
  const { state, update, base } = useStore();
  const { emp, view, t } = useMe();
  const toast = useToast();
  const [date, setDate] = useState(addDays(base, 7));
  const [hours, setHours] = useState('');
  if (!emp || !view) return null;
    if (isUnder5(state.workplace?.scale)) return <Notice tone="muted" title={t('해당 없음', 'Not applicable')}>{t('1~4명 사업장은 연차 규정이 적용되지 않아요.', 'Statutory annual leave does not apply to shops with 1–4 employees.')}</Notice>;
  const a = leaveAccrual(state, emp as Employee, base);
  const submit = () => {
    if (!isISODate(date)) return toast(t('날짜를 선택해 주세요', 'Choose a date'), 'warn');
    if (hours && (!Number.isFinite(Number(hours)) || Number(hours) <= 0 || Number(hours) > 24)) return toast(t('신청 시간은 0보다 크고 24시간 이하여야 해요', 'Hours must be greater than 0 and no more than 24'), 'warn');
    if (date <= base) return toast('오늘 이후 날짜를 고르세요', 'warn');
    if (!dayPlan(state, emp, date).contract) return toast('그날은 근무일이 아니에요', 'warn');
    if (view.leaveRequests.some((l) => l.date === date && (l.status === 'requested' || l.status === 'approved'))) return toast('이미 신청한 날이에요', 'info');
    update((d) => {
      d.leaveRequests.push({ id: uid('lv'), employeeId: emp.id, date, hours: hours ? Number(hours) : null, status: 'requested', adjustReason: '', requestedAt: nowIso(), decidedAt: null, by: 'employee' });
      pushNotification(d, 'owner', 'leave', `${emp.alias} 연차 신청: ${fmtMDW(date)}${hours ? ` ${hours}시간` : ' 하루'}`, '/owner/work?tab=leave');
    });
    toast('신청했어요. 사장님께 앱 안 알림이 갔어요 (카톡은 연결 대기)');
  };
  return (
    <div className="grid gap-4">
      <Card title={t('남은 연차', 'Remaining leave')}>
        {a.applicable ? (
          <p className="text-2xl font-bold">
            {a.partTime ? `${a.remainingHours}시간` : `${a.remainingDays}일`} <span className="text-sm font-normal text-muted">/ {a.partTime ? `${a.totalHours}시간` : `${a.totalDays}일`}</span>
          </p>
        ) : (
          <p className="text-sm text-muted">{a.reason}</p>
        )}
      </Card>
      {a.applicable && (
        <Card title={t('연차 신청', 'Request leave')}>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label={t('날짜', 'Date')} htmlFor="lv-d">
              <input id="lv-d" type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            {state.workplace?.hourlyLeaveAllowed && (
              <Field label={t('시간 단위 (선택)', 'Hours (optional)')} htmlFor="lv-h" hint="사업장에서 쓰는 경우만">
                <input id="lv-h" type="number" className={inputCls} value={hours} onChange={(e) => setHours(e.target.value)} />
              </Field>
            )}
          </div>
          <Button variant="primary" className="mt-3" onClick={submit}>
            {t('신청', 'Submit')}
          </Button>
        </Card>
      )}
      <Card title={t('신청 기록', 'History')}>
        <ul className="text-sm">
          {view.leaveRequests.map((l) => (
            <li key={l.id} className="py-1">
              {fmtMDW(l.date)} {l.hours ? `${l.hours}h` : ''} · {{ requested: '대기', approved: '승인', adjust: `조정 요청: ${l.adjustReason}`, cancelled: '취소' }[l.status]}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

// ---- 설정 ----
export function EmpSettings() {
  return (
    <Guard>
      <EmpSettingsInner />
    </Guard>
  );
}

function EmpSettingsInner() {
  const { update, setSession } = useStore();
  const { emp, t } = useMe();
  const nav = useNavigate();
  const toast = useToast();
  if (!emp) return null;
  const consent = emp.locationConsent && !emp.locationConsent.revokedAt;
  return (
    <div className="grid gap-4">
      <Card title={t('알림', 'Notifications')}>
        <Button variant="kakao" reason="연결 대기 — 카카오 메시지 미연결">{t('카톡 알림 연결', 'Connect KakaoTalk')}</Button>
      </Card>
      <Card title={t('위치 동의', 'Location consent')}>
        <p className="text-sm">{consent ? `동의함 (${localDate(emp.locationConsent!.at)})` : '동의 안 함 — 수동 출퇴근'}</p>
        <Button size="sm" className="mt-2" onClick={() => { update((d) => { const x = d.employees.find((y) => y.id === emp.id)!; x.locationConsent = consent ? { ...x.locationConsent!, revokedAt: nowIso() } : { at: nowIso(), revokedAt: null }; }); toast(consent ? '철회했어요 — 수동 출퇴근과 사장님 확인으로 바뀌어요' : '동의했어요'); }}>
          {consent ? t('동의 철회', 'Withdraw') : t('동의하기', 'Agree')}
        </Button>
      </Card>
      <Card title={t('계정', 'Account')}>
        <Button size="sm" variant="danger" onClick={() => { update((d) => { const x = d.employees.find((y) => y.id === emp.id)!; x.account = 'none'; x.invite = null; }); setSession(null); nav('/start'); }}>
          {t('탈퇴 (사장님 기록은 유지)', 'Leave the app')}
        </Button>
      </Card>
    </div>
  );
}

