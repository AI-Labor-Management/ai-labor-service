import { useMemo, useState, type CSSProperties } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useStore } from '../../state/store';
import { computeTodos, type TodoArea, type TodoLevel } from '../../domain/todos';
import { evaluateRisk } from '../../domain/risk';
import { dayPlan, netMinutes, weekDates } from '../../domain/work';
import { draftLines } from '../../domain/payroll';
import { employeeInsurance } from '../../domain/insurance';
import { estimateSeverance } from '../../domain/severance';
import { computeDeadlines, type Deadline } from '../../domain/deadlines';
import { addMonthsYM, fmtDate, fmtMD, fmtMDW, monthOf, WEEKDAY_KO, fmtMDT } from '../../domain/dates';
import { Badge, Empty, won } from '../../ui/kit';
import { Icon, type IconName } from '../../ui/Icon';
import { usePreferences } from '../../ui/preferences';
import { AnimatedNumber, useListMotion, useSelectionIndicator } from '../../ui/motion';
import { TaskPreview } from '../../ui/TaskPreview';

const AREA_ICON: Record<TodoArea, IconName> = {
  서류: 'file',
  임금: 'wallet',
  '보험·퇴직금': 'shield',
  기한: 'calendar',
  외국인: 'people',
  근무: 'clock',
  점검: 'check',
  직원: 'people',
};
function MonthCalendar({ base, deadlines }: { base: string; deadlines: Deadline[] }) {
  const [ym, setYm] = useState(base.slice(0, 7));
  const [selected, setSelected] = useState<string | null>(null);
  const [year, month] = ym.split('-').map(Number);
  const offset = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const pending = deadlines.filter((d) => d.status !== 'done' && d.status !== 'onboarding');
  const events = pending
    .filter((d) => (selected ? d.date === selected : d.date.startsWith(ym) && d.date >= base))
    .slice(0, 3);
  const move = (offset: number) => {
    setYm(addMonthsYM(ym, offset));
    setSelected(null);
  };
  return (
    <section className="dashboard-panel calendar-panel">
      <div className="panel-heading">
        <h2>다가오는 일정</h2>
        <Link to="/owner/deadlines" aria-label="전체 일정 보기">
          전체
          <Icon name="chevron" size={12} />
        </Link>
      </div>
      <div className="calendar-header">
        <strong>
          {year}년 {month}월
        </strong>
        <div>
          <button className="icon-button" onClick={() => move(-1)} aria-label="이전 달">
            <Icon name="chevron" size={14} style={{ transform: 'rotate(180deg)' }} />
          </button>
          <button
            className="icon-button"
            onClick={() => {
              setYm(base.slice(0, 7));
              setSelected(null);
            }}
            aria-label="이번 달로 이동"
          >
            <Icon name="calendar" size={13} />
          </button>
          <button className="icon-button" onClick={() => move(1)} aria-label="다음 달">
            <Icon name="chevron" size={14} />
          </button>
        </div>
      </div>
      <div className="mini-calendar flow-swap" key={'calendar:' + ym}>
        {WEEKDAY_KO.map((day) => (
          <span className="calendar-weekday" key={day}>
            {day}
          </span>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={'blank' + i} />
        ))}
        {Array.from({ length: count }, (_, i) => {
          const date = ym + '-' + String(i + 1).padStart(2, '0');
          const hasDeadline = pending.some((d) => d.date === date);
          return (
            <button
              key={date}
              className={[
                date === base ? 'today' : '',
                selected === date ? 'selected' : '',
                hasDeadline ? 'has-deadline' : '',
              ].join(' ')}
              onClick={() => setSelected(selected === date ? null : date)}
              aria-label={fmtDate(date) + (hasDeadline ? ' 일정 있음' : '')}
              aria-pressed={selected === date}
              aria-current={date === base ? 'date' : undefined}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <div
        className="calendar-events flow-swap"
        key={'events:' + ym + ':' + (selected ?? '')}
        aria-live="polite"
      >
        {selected && (
          <div className="flex justify-between text-[10px] text-muted">
            <span>{fmtMD(selected)} 일정</span>
            <button onClick={() => setSelected(null)}>전체 보기</button>
          </div>
        )}
        {events.length ? (
          events.map((d) => (
            <Link to={d.link} key={d.key} className="calendar-event">
              <i />
              <span>
                <strong>{d.title}</strong>
                <small>{fmtMDW(d.date)}</small>
              </span>
              <b>{d.dLabel}</b>
            </Link>
          ))
        ) : (
          <p className="empty-copy">
            {selected ? '이 날짜에는 예정된 기한이 없어요.' : '이 달에는 다가오는 기한이 없어요.'}
          </p>
        )}
      </div>
    </section>
  );
}

export default function OwnerHome() {
  const { state, update, base } = useStore();
  const { openGuide } = usePreferences();
  const [params, setParams] = useSearchParams();
  const filterParam = params.get('filter');
  const filter: TodoLevel | 'all' =
    filterParam === 'risk' || filterParam === 'soon' || filterParam === 'check' ? filterParam : 'all';
  const [all, setAll] = useState(false);
  const [previewState, setPreviewState] = useState<{ id: string; open: boolean } | null>(null);
  const selection = useSelectionIndicator(filter);
  const todos = useMemo(() => computeTodos(state, base), [state, base]);
  const deadlines = useMemo(() => computeDeadlines(state, base), [state, base]);
  const risk = evaluateRisk(state, base);
  const active = state.employees.filter((e) => !e.resignDate || e.resignDate >= base);
  const pendingOnb = active.filter((e) => e.onboarding === 'existing-pending');
  const wp = state.workplace!;
  const month = monthOf(base);
  const lines = useMemo(() => draftLines(state, month), [state, month]);
  const gross = lines.reduce((s, l) => s + l.gross, 0);
  const employerValues = active.map((e) => employeeInsurance(state, e, base).totals.employer);
  const employer = employerValues.some((v) => v === null)
    ? null
    : employerValues.reduce<number>((s, v) => s + (v ?? 0), 0);
  const sevAccrual = active.reduce((s, e) => s + estimateSeverance(state, e, base).monthlyAccrual, 0);
  const nextPay = deadlines.find((d) => d.type === 'payday' && d.date >= base);
  const today = active
    .map((e) => ({
      e,
      plan: dayPlan(state, e, base),
      rec: state.attendance.find((a) => a.employeeId === e.id && a.date === base),
    }))
    .filter((x) => x.plan.shift);
  const week = weekDates(base);
  const notes = state.notifications.filter((n) => n.to === 'owner');
  const filtered = todos.filter((t) => filter === 'all' || t.level === filter);
  const shown = all ? filtered : filtered.slice(0, 4);
  const listRef = useListMotion(`${filter}:${all}:${shown.map((t) => t.id).join(',')}`);
  const preview = todos.find((t) => t.id === previewState?.id) ?? null;
  const riskTodos = todos.filter((t) => t.level === 'risk').length;
  const soonTodos = todos.filter((t) => t.level === 'soon').length;
  const pendingAttendance = state.attendance.filter((a) => a.status !== 'confirmed').length;
  return (
    <div>
      <div className="dashboard-heading">
        <div>
          <div className="date-label">{wp.name || '내 사업장'}</div>
          <h1>오늘의 사업장</h1>
          <p>
            {active.length
              ? '사장님이 챙길 일, 중요한 것부터 모아뒀어요.'
              : '직원을 등록하면 필요한 서류와 기한을 함께 챙겨드려요.'}
          </p>
        </div>
        <div className="dashboard-heading-actions">
          <Link to="/owner/precheck" className="ui-button secondary">
            <Icon name="shield" size={16} />
            채용 전 점검
          </Link>
          <Link to="/owner/employees/new" className="ui-button primary">
            <Icon name="plus" size={17} />
            직원 등록
          </Link>
        </div>
      </div>
      <div className="stat-grid">
        <a href="#today-todos" className="stat-card">
          <div className="stat-card-title">
            오늘 챙길 일<Icon name="chevron" size={15} />
          </div>
          <div className="stat-value">
            <AnimatedNumber value={todos.length} />
            <small>건</small>
          </div>
          <div className="stat-card-bottom">
            <span className="text-risk">우선 확인 {riskTodos}건</span>
            <span>·</span>
            <span>기한 임박 {soonTodos}건</span>
          </div>
        </a>
        <Link className="stat-card pay-card" to="/owner/payroll">
          <div className="stat-card-title">
            {Number(month.slice(5))}월 예상 인건비<span className="status-chip">지급액 기준</span>
          </div>
          <div className="stat-value">
            <AnimatedNumber value={gross} />
            <small>원</small>
          </div>
          <div className="stat-card-bottom">
            사업주 보험 부담 {employer === null ? '일부 기준 확인 필요' : '+ ' + won(employer)}
            <Icon name="chevron" size={12} />
          </div>
          <div className="mini-progress" aria-hidden="true">
            <span style={{ flex: Math.max(1, gross) }} />
            <span style={{ flex: Math.max(1, employer ?? 0) }} />
          </div>
        </Link>
        <Link className="stat-card" to="/owner/work">
          <div className="stat-card-title">
            오늘 함께하는 직원
            <Icon name="people" size={18} />
          </div>
          <div className="stat-value">
            <AnimatedNumber value={today.length} />
            <small>명</small>
          </div>
          <div className="stat-card-bottom">
            전체 직원 {active.length}명<span>·</span>
            <span>{pendingAttendance ? '근무 확인 대기 ' + pendingAttendance + '건' : '확인 대기 없음'}</span>
          </div>
        </Link>
      </div>

      <div className="dashboard-columns">
        <div>
          <section className="dashboard-panel" id="today-todos">
            <div className="panel-heading">
              <h2>
                오늘 처리할 일 <span>{todos.length}</span>
              </h2>
              <span className="task-preview-help">눌러서 미리보기</span>
            </div>
            <div ref={selection.ref} className="todo-filters selection-tabs" aria-label="할 일 필터">
              {selection.indicator}
              {(
                [
                  { key: 'all', label: '전체', count: todos.length },
                  { key: 'risk', label: '우선 확인', count: riskTodos },
                  { key: 'soon', label: '기한 임박', count: soonTodos },
                  {
                    key: 'check',
                    label: '확인 필요',
                    count: todos.filter((t) => t.level === 'check').length,
                  },
                ] as const
              ).map((f) => (
                <button
                  key={f.key}
                  className={filter === f.key ? 'active' : ''}
                  aria-pressed={filter === f.key}
                  onClick={() => {
                    setParams(
                      (p) => {
                        if (f.key === 'all') p.delete('filter');
                        else p.set('filter', f.key);
                        return p;
                      },
                      { replace: true, preventScrollReset: true },
                    );
                    setAll(false);
                  }}
                >
                  {f.label} {f.count}
                </button>
              ))}
            </div>
            <div aria-live="polite">
              <ul ref={listRef}>
                {shown.map((t) => (
                  <li className="todo-row" key={t.id} data-motion-key={t.id}>
                    <button
                      className="todo-preview-trigger"
                      aria-label={t.title + ' 미리보기'}
                      aria-haspopup="dialog"
                      onClick={() => setPreviewState({ id: t.id, open: true })}
                    >
                      <span className={'todo-row-icon ' + t.level}>
                        <Icon name={AREA_ICON[t.area]} size={20} />
                      </span>
                      <span className="todo-row-content">
                        <span className="todo-meta">
                          <span className={'priority ' + t.level}>
                            {t.level === 'risk' ? '우선 확인' : t.badge}
                          </span>
                          <span>·</span>
                          <span>{t.area}</span>
                          {t.date && (
                            <>
                              <span>·</span>
                              <span>{fmtMD(t.date)}</span>
                            </>
                          )}
                        </span>
                        <span className="todo-title">{t.title}</span>
                      </span>
                    </button>
                    <Link to={t.link} aria-label={t.title + ' 처리하기'}>
                      바로 처리
                      <Icon name="chevron" size={13} />
                    </Link>
                  </li>
                ))}
              </ul>
              {!filtered.length && (
                <Empty title={todos.length ? '이 분류에는 할 일이 없어요' : '지금은 처리할 일이 없어요'}>
                  {!active.length
                    ? '첫 직원을 등록하고 가게 관리를 시작해 보세요.'
                    : '새로운 할 일이 생기면 여기에 모아둘게요.'}
                </Empty>
              )}
            </div>
            {filtered.length > 4 && (
              <button className="todo-more" onClick={() => setAll(!all)}>
                {all ? '간단히 보기' : '할 일 ' + filtered.length + '건 모두 보기'}
                <Icon
                  name="chevron"
                  size={12}
                  style={{ transform: all ? 'rotate(-90deg)' : 'rotate(90deg)' }}
                />
              </button>
            )}
            {pendingOnb.length > 0 && (
              <div className="onboarding-strip">
                <Icon name="file" size={19} />
                <p>
                  <strong>{pendingOnb[0].alias}의 기존 서류를 정리해 볼까요?</strong>
                  <br />
                  이미 처리한 서류와 보험을 한 번에 체크해요.
                </p>
                <Link to={'/owner/employees/' + pendingOnb[0].id + '/onboarding'}>
                  정리하기
                  <Icon name="chevron" size={12} />
                </Link>
              </div>
            )}
          </section>
          <div className="quick-actions">
            {(
              [
                { to: '/owner/documents', title: '서류 확인', icon: 'file' },
                { to: '/owner/insurance', title: '4대보험 확인', icon: 'shield' },
                { to: '/owner/payroll', title: '급여 계산', icon: 'wallet' },
                { to: '/owner/consult', title: '전문가 상담', icon: 'chat' },
              ] as const
            ).map((a) => (
              <Link key={a.to} to={a.to} className="quick-action">
                <span>
                  <Icon name={a.icon} size={20} />
                </span>
                {a.title}
              </Link>
            ))}
          </div>
          <section className="dashboard-panel schedule-panel">
            <div className="panel-heading">
              <h2>이번 주 근무</h2>
              <Link to="/owner/work">
                {fmtMD(week[0])}–{fmtMD(week[6])}
                <Icon name="chevron" size={12} />
              </Link>
            </div>
            {!active.length ? (
              <p className="empty-copy">직원을 등록하면 주간 근무 일정이 여기에 보여요.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="week-table" aria-label="이번 주 직원 근무 일정">
                  <thead>
                    <tr>
                      <th scope="col">직원</th>
                      {week.map((d, i) => (
                        <th scope="col" key={d} className={d === base ? 'today' : ''}>
                          {WEEKDAY_KO[i]}
                          <span className="block mt-1">{d.slice(8)}</span>
                        </th>
                      ))}
                      <th scope="col">합계</th>
                    </tr>
                  </thead>
                  <tbody>
                    {active.map((e, i) => {
                      let total = 0;
                      const plans = week.map((d) => {
                        const p = dayPlan(state, e, d);
                        if (p.shift) total += netMinutes(p.shift);
                        return p;
                      });
                      return (
                        <tr key={e.id}>
                          <th scope="row">
                            <Link className="employee-cell" to={'/owner/employees/' + e.id}>
                              <span className="employee-avatar" data-index={i % 3}>
                                {e.alias.slice(-1)}
                              </span>
                              {e.alias}
                            </Link>
                          </th>
                          {plans.map((p) => (
                            <td key={p.date}>
                              {p.shift ? (
                                <span className="shift-time">
                                  {p.shift.start.slice(0, 2)}–{p.shift.end.slice(0, 2)}
                                </span>
                              ) : p.off === 'leave' ? (
                                <Badge tone="info">연차</Badge>
                              ) : p.off === 'absent' ? (
                                <Badge tone="muted">결근</Badge>
                              ) : p.off === 'subOut' ? (
                                <Badge tone="muted">대타</Badge>
                              ) : p.off === 'publicHoliday' ? (
                                <Badge tone="muted">유급휴일</Badge>
                              ) : (
                                <span className="text-muted">–</span>
                              )}
                            </td>
                          ))}
                          <td className="font-semibold">{(total / 60).toFixed(1).replace(/\.0$/, '')}h</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <Link className="todo-more" to="/owner/work">
              일정 자세히 보기
              <Icon name="arrow" size={13} />
            </Link>
          </section>
          <section className="dashboard-panel schedule-panel" id="notifications">
            <div className="panel-heading">
              <h2>우리 가게 알림</h2>
              <span className="text-[10px] text-muted">앱 안 알림</span>
            </div>
            {notes.length ? (
              <ul className="notification-list">
                {notes.slice(0, 5).map((n) => (
                  <li key={n.id}>
                    {!n.readAt && <i aria-label="안 읽음" />}
                    <Link
                      to={n.link}
                      onClick={() =>
                        update((d) => {
                          const note = d.notifications.find((v) => v.id === n.id);
                          if (note && !note.readAt) note.readAt = new Date().toISOString();
                        })
                      }
                    >
                      {n.text}
                    </Link>
                    <span>{fmtMDT(n.createdAt)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-copy">아직 새로운 알림이 없어요.</p>
            )}
            <p className="mt-3 text-[10px] text-muted">
              카카오 알림은 연결 준비 중이에요. 현재는 앱 안에서만 확인할 수 있어요.
            </p>
          </section>
        </div>
        <div className="dashboard-side">
          <MonthCalendar base={base} deadlines={deadlines} />
          <section className="guide-callout">
            <small>사람샘각 사용 안내</small>
            <h3>
              처음부터 차근차근,
              <br />
              4단계로 시작하세요
            </h3>
            <button onClick={openGuide}>
              <Icon name="play" size={12} />
              움직이는 가이드 보기
              <Icon name="chevron" size={12} />
            </button>
            <span className="guide-callout-icon">
              <Icon name="file" size={27} />
            </span>
          </section>
          <section className="dashboard-panel">
            <div className="panel-heading">
              <h2>오늘 근무</h2>
              <Link to="/owner/work?tab=attendance">
                기록 보기
                <Icon name="chevron" size={12} />
              </Link>
            </div>
            {today.length ? (
              today.map(({ e, plan, rec }, i) => (
                <div className="today-worker" key={e.id}>
                  <span className="employee-avatar" data-index={i % 3}>
                    {e.alias.slice(-1)}
                  </span>
                  <span>
                    {e.alias}
                    <small>
                      {plan.shift!.start}–{plan.shift!.end}
                    </small>
                  </span>
                  <b>{rec?.original.clockOut ? '퇴근' : rec?.original.clockIn ? '출근' : '출근 전'}</b>
                </div>
              ))
            ) : (
              <p className="empty-copy">오늘 예정된 근무가 없어요.</p>
            )}
          </section>
          <section className="dashboard-panel">
            <div className="panel-heading">
              <h2>노무 점검</h2>
              <Link to="/owner/risk">
                이어서 하기
                <Icon name="chevron" size={12} />
              </Link>
            </div>
            <div className="checkup-summary">
              <div
                className="checkup-progress"
                style={
                  { '--progress': (risk.answered / Math.max(1, risk.total)) * 100 + '%' } as CSSProperties
                }
              >
                <span>
                  {risk.answered}/{risk.total}
                </span>
              </div>
              <p>
                우리 가게 노무 상태
                <br />
                <strong>
                  {risk.riskCount ? '확인이 필요한 항목 ' + risk.riskCount + '개' : '차근차근 점검해 보세요'}
                </strong>
              </p>
            </div>
          </section>
          <section className="dashboard-panel">
            <div className="panel-heading">
              <h2>미리 준비해요</h2>
              <Icon name="wallet" size={18} className="text-muted" />
            </div>
            <div className="flex justify-between gap-3 text-xs">
              <span className="text-muted">다음 급여일</span>
              <Link className="font-semibold text-brand" to="/owner/payroll">
                {nextPay ? fmtMDW(nextPay.date) : '등록 후 확인'}
              </Link>
            </div>
            <div className="flex justify-between gap-3 text-xs mt-4">
              <span className="text-muted">퇴직금 월 적립 참고</span>
              <span className="font-semibold">{won(sevAccrual)}</span>
            </div>
            <p className="text-[10px] text-muted mt-4 leading-5">
              금액은 등록한 조건에 따른 예상이에요.
              <br />
              실제 지급 전 계산 내역을 확인해 주세요.
            </p>
          </section>
        </div>
      </div>
      <TaskPreview
        open={!!previewState?.open}
        todo={preview}
        employee={state.employees.find((e) => e.id === preview?.employeeId)?.alias}
        onClose={() => setPreviewState((p) => p && { ...p, open: false })}
      />
    </div>
  );
}
