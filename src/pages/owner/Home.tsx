// S05/W02 사장님 홈 — "오늘 처리할 일"을 맨 위에. 위험 → 7일 이내 → 확인 필요 순, [처리]는 해당 화면으로.
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useStore } from '../../state/store';
import { areaCounts, computeTodos } from '../../domain/todos';
import { evaluateRisk } from '../../domain/risk';
import { dayPlan, netMinutes, weekDates, weekWarnings } from '../../domain/work';
import { draftLines, payrollPeriodFor } from '../../domain/payroll';
import { employeeInsurance } from '../../domain/insurance';
import { estimateSeverance } from '../../domain/severance';
import { computeDeadlines } from '../../domain/deadlines';
import { resolveRule } from '../../domain/rules';
import { fmtDate, fmtMD, fmtMDW, monthOf, WEEKDAY_KO, fmtMDT } from '../../domain/dates';
import { holidayOn } from '../../data/holidays';
import { Badge, Button, Card, cx, Empty, KV, levelTone, LinkButton, Money, PageHeader } from '../../ui/kit';

export default function OwnerHome() {
  const { state, update, base } = useStore();
  const [all, setAll] = useState(false);
  const todos = useMemo(() => computeTodos(state, base), [state, base]);
  const counts = areaCounts(todos);
  const risk = evaluateRisk(state, base);
  const active = state.employees.filter((e) => !e.resignDate || e.resignDate >= base);
  const pendingOnb = active.filter((e) => e.onboarding === 'existing-pending');
  const existingAll = active.filter((e) => e.onboarding !== 'new');
  const wp = state.workplace!;

  const month = monthOf(base);
  const money = useMemo(() => {
    const lines = draftLines(state, month);
    const gross = lines.reduce((s, l) => s + l.gross, 0);
    let employer: number | null = 0;
    for (const e of active) {
      const t = employeeInsurance(state, e, base).totals.employer;
      if (t === null) employer = null;
      else if (employer !== null) employer += t;
    }
    const sevAccrual = active.reduce((s, e) => s + estimateSeverance(state, e, base).monthlyAccrual, 0);
    return { gross, employer, sevAccrual };
  }, [state, base, month, active]);
  const nextPay = computeDeadlines(state, base).filter((d) => d.type === 'payday' && d.date >= base)[0];

  const today = active.map((e) => ({ e, plan: dayPlan(state, e, base), rec: state.attendance.find((a) => a.employeeId === e.id && a.date === base) })).filter((x) => x.plan.shift);
  const week = weekDates(base);
  const breakRule = resolveRule<{ per4h: number; per8h: number; waiver4hOnRequest: boolean }>('break.minimum', base);
  const minorRule = resolveRule<{ daily: number; weekly: number }>('minor.limits', base);
  const myNotes = state.notifications.filter((n) => n.to === 'owner');
  const shown = all ? todos : todos.slice(0, 5);

  if (!active.length)
    return (
      <div>
        <PageHeader title="시작해 볼까요" sub="직원이 아직 없어요. 채용 전 점검과 첫 직원 등록부터 해요." />
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="채용 전 점검">
            <p className="text-sm text-muted">시급과 요일별 근무 시간을 넣으면 최저임금·주휴·4대보험·예상 인건비·필요한 서류를 보여줘요. 저장하지 않아요.</p>
            <LinkButton to="/owner/precheck" variant="primary" className="mt-4">
              채용 전 점검하기
            </LinkButton>
          </Card>
          <Card title="첫 직원 등록">
            <p className="text-sm text-muted">이미 일하는 직원이 있다면 등록 후 있는 서류·보험·지난 기한을 한 번에 정리해요.</p>
            <LinkButton to="/owner/employees/new" variant="primary" className="mt-4">
              직원 등록
            </LinkButton>
          </Card>
        </div>
      </div>
    );

  return (
    <div>
      <PageHeader
        title={`오늘 처리할 일 ${todos.length}건`}
        sub={`${wp.name || '내 사업장'} · 기준일 ${fmtDate(base)} · 참고용`}
        actions={
          <>
            <LinkButton to="/owner/precheck">채용 전 점검</LinkButton>
            <LinkButton to="/owner/employees/new" variant="primary">
              직원 등록
            </LinkButton>
          </>
        }
      />
      {pendingOnb.length > 0 && (
        <Card className="mb-4 border-info/40 bg-info-soft/40" title={`있는 서류 체크하기 ${existingAll.length - pendingOnb.length}/${existingAll.length}명 완료`}>
          <p className="text-sm text-muted">기존 직원은 이미 처리한 서류·보험·지난 기한을 먼저 정리해요. 정리 전에는 지난 기한을 위험으로 띄우지 않아요.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {pendingOnb.map((e) => (
              <LinkButton key={e.id} to={`/owner/employees/${e.id}/onboarding`} variant="primary" size="sm">
                {e.alias} 정리하기
              </LinkButton>
            ))}
          </div>
        </Card>
      )}
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card title="할 일" right="위험 → 7일 이내 → 확인 필요">
          {!todos.length && <Empty title="지금 처리할 일이 없어요">새 기한이 다가오면 여기에 모여요.</Empty>}
          <ul className="divide-y divide-line">
            {shown.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2.5">
                <Badge tone={levelTone(t.level)} className="w-12 justify-center">
                  {t.badge}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{t.title}</p>
                  <p className="truncate text-xs text-muted">
                    {t.area} · {t.basis}
                  </p>
                </div>
                <LinkButton to={t.link} size="sm" className="shrink-0 border-brand text-brand">
                  처리
                </LinkButton>
              </li>
            ))}
          </ul>
          {todos.length > 5 && (
            <button type="button" className="mt-2 text-sm font-semibold text-brand" onClick={() => setAll(!all)}>
              {all ? '접기' : `모두 보기 (${todos.length}) ▸`}
            </button>
          )}
          {!state.settings.kakaoBannerDismissed && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-canvas px-3 py-2 text-sm">
              <span className="flex-1">카톡 "나에게 보내기"로 매일 할 일을 받아볼 수 있어요 — <b>연결 대기</b> (지금은 앱 안 알림·캘린더 파일만)</span>
              <LinkButton size="sm" to="/owner/deadlines">캘린더 파일 받기</LinkButton>
              <Button size="sm" variant="ghost" onClick={() => update((d) => { d.settings.kakaoBannerDismissed = true; })}>
                닫기
              </Button>
            </div>
          )}
        </Card>
        <div className="grid content-start gap-4">
          <Card title="점검 현황" right={`주의 ${Object.values(counts).reduce((a, b) => a + b, 0)}건`}>
            <div className="flex flex-wrap gap-2">
              {(['서류', '임금', '보험·퇴직금', '기한', '외국인', '근무'] as const).map((a) => (
                <span key={a} className={cx('rounded-lg border px-2.5 py-1 text-sm', counts[a] ? 'border-risk/30 bg-risk-soft text-risk' : 'border-line')}>
                  {a} {counts[a]}
                </span>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-sm">
              <span>
                노무 위험 점검 <b className="num">{risk.answered}/{risk.total}</b>
                {risk.riskCount > 0 && <Badge tone="risk" className="ml-2">위험 {risk.riskCount}</Badge>}
              </span>
              <LinkButton to="/owner/risk" size="sm">
                {risk.answered < risk.total ? '이어서 하기' : '다시 보기'}
              </LinkButton>
            </div>
          </Card>
          <Card title="이번 달" right={`${Number(month.slice(5))}월 근무분 · 예상`}>
            <KV k="예상 인건비 (지급액)" v={<Money value={money.gross} />} />
            <KV k="+ 4대보험 사장님 부담" v={money.employer === null ? <span className="text-warn">일부 금액은 기준 없음</span> : <Money value={money.employer} />} />
            <KV k="다음 급여일" v={nextPay ? `${fmtMDW(nextPay.date)} · ${nextPay.title}` : '—'} />
            <KV k="퇴직금 예상 적립 (월)" v={<Money value={money.sevAccrual} />} />
            <p className="mt-1 text-xs text-muted">지급일 매달 {wp.payDay}일 · {wp.payMonthBasis === 'previous' ? '전월분' : '당월분'} · 산정 {fmtMD(payrollPeriodFor(wp, month).from)}~{fmtMD(payrollPeriodFor(wp, month).to)}</p>
          </Card>
          <Card title="오늘 근무" right={wp.gpsEnabled ? 'GPS 기록 기준' : '일정 기준'}>
            <p className="text-sm">
              예정 {today.length}명 · 출근 {today.filter((x) => x.rec?.original.clockIn).length} · 아직 {today.filter((x) => !x.rec).length}
            </p>
            <ul className="mt-2 text-sm text-muted">
              {today.map((x) => (
                <li key={x.e.id}>
                  {x.e.alias} {x.plan.shift!.start}–{x.plan.shift!.end} {x.rec ? `· 출근 ${x.rec.original.clockIn}` : ''}
                </li>
              ))}
            </ul>
            <LinkButton to="/owner/work?tab=attendance" size="sm" className="mt-2">
              출퇴근 기록
            </LinkButton>
          </Card>
        </div>
      </div>

      <Card title="이번 주 근무" className="mt-4" right={`${fmtMD(week[0])}–${fmtMD(week[6])}${state.busyDays.filter((b) => week.includes(b.date)).map((b) => ` · 바쁜 날 ${fmtMD(b.date)} ${b.memo}`).join('')}`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="bg-canvas text-left text-xs text-muted">
                <th className="px-2 py-2"></th>
                {week.map((d, i) => (
                  <th key={d} className={cx('px-2 py-2 font-semibold', d === base && 'text-brand')}>
                    {WEEKDAY_KO[i]} {fmtMD(d)}
                    {holidayOn(d) && <span className="block text-[10px] text-risk">{holidayOn(d)!.name}</span>}
                  </th>
                ))}
                <th className="px-2 py-2">주 합계</th>
                <th className="px-2 py-2">확인</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {active.map((e) => {
                let total = 0;
                const cells = week.map((d) => {
                  const p = dayPlan(state, e, d);
                  if (p.shift) total += netMinutes(p.shift);
                  return p;
                });
                const warns = weekWarnings(state, e, week[0], breakRule.ok ? breakRule.value : null, minorRule.ok ? minorRule.value : null);
                const variableEmpty = cells.every((c) => !c.shift) && cells.some((c) => c.variableNeedsInput);
                return (
                  <tr key={e.id}>
                    <td className="px-2 py-2 font-semibold">
                      <Link to={`/owner/employees/${e.id}`}>{e.alias}</Link>
                    </td>
                    {variableEmpty ? (
                      <td colSpan={7} className="px-2 py-2 text-muted">
                        매주 달라요 · 이번 주 입력 필요
                      </td>
                    ) : (
                      cells.map((p) => (
                        <td key={p.date} className="num px-2 py-2">
                          {p.shift ? `${p.shift.start.slice(0, 2)}–${p.shift.end.slice(0, 2)}` : p.off === 'leave' ? <Badge tone="info">연차</Badge> : p.off === 'absent' ? <Badge tone="muted">결근</Badge> : p.off === 'subOut' ? <Badge tone="muted">대타</Badge> : p.off === 'publicHoliday' ? <Badge tone="muted">유급휴일</Badge> : '–'}
                        </td>
                      ))
                    )}
                    <td className={cx('num px-2 py-2', warns.some((w) => w.level === 'risk') && 'font-bold text-warn')}>{(total / 60).toFixed(1).replace(/\.0$/, '')}h</td>
                    <td className="px-2 py-2">
                      {warns.slice(0, 2).map((w, i) => (
                        <Badge key={i} tone={w.level === 'risk' ? 'warn' : 'info'} className="mr-1 max-w-[180px] truncate">
                          {w.text.length > 14 ? w.text.slice(0, 14) + '…' : w.text}
                        </Badge>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <LinkButton to="/owner/work" size="sm" className="mt-3">
          근무 일정 열기
        </LinkButton>
      </Card>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card title="알림함 (앱 안)" right="카톡은 연결 대기 — 보내지 않았어요">
          {!myNotes.length && <p className="text-sm text-muted">알림이 없어요.</p>}
          <ul className="divide-y divide-line text-sm">
            {myNotes.slice(0, 6).map((n) => (
              <li key={n.id} className="flex items-center gap-2 py-2">
                {!n.readAt && <span className="h-2 w-2 shrink-0 rounded-full bg-risk" aria-label="안 읽음" />}
                <Link to={n.link} className="flex-1" onClick={() => update((d) => { const x = d.notifications.find((y) => y.id === n.id); if (x && !x.readAt) x.readAt = new Date().toISOString(); })}>
                  {n.text}
                </Link>
                <span className="shrink-0 text-xs text-muted">{fmtMDT(n.createdAt)}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="바로가기">
          <div className="flex flex-wrap gap-2">
            <LinkButton to="/owner/precheck">채용 전 점검</LinkButton>
            <LinkButton to="/owner/employees/new">직원 등록</LinkButton>
            <LinkButton to="/owner/payroll">급여 확정</LinkButton>
            <LinkButton to="/owner/consult">상담</LinkButton>
            <LinkButton to="/owner/deadlines">캘린더 내보내기</LinkButton>
          </div>
        </Card>
      </div>
    </div>
  );
}
