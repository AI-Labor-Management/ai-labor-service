// S12 일정·기한 (F4): 원래 날짜에서 계산, 목록·달력·남은 일수, 처리 기록, 반복 일정, .ics 내보내기, 카톡 미리보기(연결 대기)
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useStore, uid, nowIso } from '../../state/store';
import { computeDeadlines, handleDeadline, TYPE_LABEL, type Deadline, type DeadlineStatus } from '../../domain/deadlines';
import { buildIcs } from '../../domain/ics';
import { addDays, addMonthsYM, addYears, fmtDate, fmtMD, fmtYM, isISODate, listDates, monthOf, startOfWeek, WEEKDAY_KO, endOfMonth } from '../../domain/dates';
import { holidayOn } from '../../data/holidays';
import { Badge, Button, Card, cx, download, Empty, Field, inputCls, levelTone, Modal, Notice, PageHeader, Tabs, useToast } from '../../ui/kit';

const ST_LABEL: Record<DeadlineStatus, string> = { overdue: '위험', due7: '7일 이내', due30: '30일 이내', later: '나중', done: '처리함', onboarding: '정리 필요' };

function DeadlineActions({ d }: { d: Deadline }) {
  const { state, update, base } = useStore();
  const toast = useToast();
  const nav = useNavigate();
  const [modal, setModal] = useState<null | 'renew' | 'visa' | 'health'>(null);
  const [date, setDate] = useState('');
  const e = state.employees.find((x) => x.id === d.employeeId);
  const done = (action: 'done' | 'unknown' = 'done', note = '') => {
    update((s) => {
      s.deadlineActions = handleDeadline(s.deadlineActions, d.key, action, base, note);
    });
    toast(action === 'unknown' ? '아직 모름으로 남겼어요 — 계속 알려줘요' : '처리했어요. 이 기한의 알림이 멈춰요.');
  };
  if (d.status === 'done')
    return (
      <span className="flex items-center gap-2 text-xs text-muted">
        {d.handled?.at ? `${d.handled.date} 처리` : d.handled?.note}
        {d.handled?.at && (
          <button type="button" className="underline" onClick={() => update((s) => { s.deadlineActions = s.deadlineActions.filter((a) => a.key !== d.key); })}>
            취소
          </button>
        )}
      </span>
    );
  return (
    <span className="flex flex-wrap gap-1.5">
      {d.type === 'contractEnd' && e ? (
        <>
          <Button size="sm" onClick={() => { setModal('renew'); setDate(addYears(d.date, 1)); }}>갱신</Button>
          <Button size="sm" onClick={() => { done('done', '종료 → 퇴사 처리'); nav(`/owner/offboarding/${e.id}?date=${d.date}&type=contractEnd`); }}>종료</Button>
          <Button size="sm" variant="ghost" onClick={() => done('unknown')}>아직 모름</Button>
        </>
      ) : d.type === 'visaExpiry' && e ? (
        <Button size="sm" onClick={() => { setModal('visa'); setDate(''); }}>연장 확인함</Button>
      ) : d.type === 'healthCert' && e ? (
        <Button size="sm" onClick={() => { setModal('health'); setDate(base); }}>새 검진일</Button>
      ) : d.type === 'payday' || d.type === 'insAcquisition' || d.type === 'insLoss' ? (
        <Button size="sm" onClick={() => nav(d.link)}>처리 화면</Button>
      ) : d.type === 'minWageTransition' ? (
        <Button size="sm" onClick={() => nav(d.link)}>시급 변경</Button>
      ) : (
        <Button size="sm" onClick={() => done()}>{d.type === 'severanceYear' ? '확인' : d.type === 'severancePay' ? '지급함' : d.type === 'retentionEnd' ? '파기함' : '처리함'}</Button>
      )}
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal === 'renew' ? `${d.alias} 계약 갱신` : modal === 'visa' ? `${d.alias} 체류기간 연장 확인` : `${d.alias} 보건증 재검진`}
        footer={
          <>
            <Button onClick={() => setModal(null)}>취소</Button>
            <Button
              variant="primary"
              reason={!isISODate(date) ? '날짜를 입력하세요' : modal === 'renew' && date <= d.date ? '새 종료일은 기존 종료일 이후여야 해요' : undefined}
              onClick={() => {
                if (!e || !isISODate(date)) return;
                update((s) => {
                  const t = s.employees.find((x) => x.id === e.id)!;
                  s.deadlineActions = handleDeadline(s.deadlineActions, d.key, modal === 'renew' ? 'renewed' : 'done', base);
                  if (modal === 'renew') {
                    t.contractEnd = date;
                    const cur = s.conditions.filter((c) => c.employeeId === e.id && c.effectiveFrom <= d.date).sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1))[0];
                    if (cur) s.conditions.push({ ...cur, id: uid('cond'), effectiveFrom: addDays(d.date, 1), reason: `계약 갱신 (${fmtDate(date)}까지)`, createdAt: nowIso() });
                  }
                  if (modal === 'visa' && t.foreign) t.foreign.expiry = date;
                  if (modal === 'health') {
                    const key = `E5:${e.id}`;
                    const old = s.docRecords.find((r) => r.key === key);
                    s.docRecords = s.docRecords.filter((r) => r.key !== key);
                    s.docRecords.push({ id: uid('doc'), key, itemId: 'E5', employeeId: e.id, status: 'done', doneAt: date, naReason: '', expiry: addYears(date, 1), examDate: date, location: old?.location ?? '', bulk: false, updatedAt: nowIso() });
                  }
                });
                setModal(null);
                toast(modal === 'renew' ? '갱신했어요. 새 종료일로 다시 계산하고 변경 계약서 할 일을 만들었어요.' : '새 날짜로 다시 계산했어요');
              }}
            >
              저장
            </Button>
          </>
        }
      >
        <Field label={modal === 'renew' ? '새 계약 종료일' : modal === 'visa' ? '새 체류기간 만료일' : '검진일 (1년 뒤를 만료일로)'} htmlFor="dl-date">
          <input id="dl-date" type="date" className={inputCls} value={date} onChange={(ev) => setDate(ev.target.value)} />
        </Field>
        {modal === 'visa' && <p className="mt-2 text-xs text-muted">알림은 체류 연장이나 취업 허가를 대신하지 않아요.</p>}
        {modal === 'renew' && <p className="mt-2 text-xs text-muted">5명 이상 사업장은 기간제 2년 통산을 확인해요 (기간제법 제4조).</p>}
      </Modal>
    </span>
  );
}

function Row({ d }: { d: Deadline }) {
  return (
    <li className="grid gap-2 py-3 text-sm sm:grid-cols-[110px_1fr_auto] sm:items-center">
      <div className="flex items-center gap-2 sm:block">
        <p className="num font-bold">{fmtMD(d.date)}</p>
        <Badge tone={d.status === 'done' ? 'ok' : d.status === 'onboarding' ? 'info' : levelTone(d.status)}>{d.status === 'done' ? '처리함' : d.status === 'onboarding' ? '정리 필요' : d.dLabel}</Badge>
      </div>
      <div className="min-w-0">
        <p className="font-medium">
          {d.title} {d.recurring && <Badge tone="muted">매달</Badge>}
        </p>
        {d.secondaryLabel && <p className="text-xs">{d.secondaryLabel} · 앞 날짜로 D-day</p>}
        <p className="text-xs text-muted">
          계산 근거: {d.origin} · {d.basis}
          {d.nextAlert && ` · 다음 알림 ${fmtMD(d.nextAlert)} (앱 안)`}
        </p>
      </div>
      <DeadlineActions d={d} />
    </li>
  );
}

function CalendarView({ list }: { list: Deadline[] }) {
  const { base } = useStore();
  const [ym, setYm] = useState(monthOf(base));
  const first = `${ym}-01`;
  const start = startOfWeek(first);
  const end = addDays(startOfWeek(endOfMonth(ym)), 6);
  const days = listDates(start, end);
  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <Button size="sm" onClick={() => setYm(addMonthsYM(ym, -1))} aria-label="이전 달">←</Button>
        <p className="font-bold">{fmtYM(ym)}</p>
        <Button size="sm" onClick={() => setYm(addMonthsYM(ym, 1))} aria-label="다음 달">→</Button>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-line bg-line text-xs">
        {WEEKDAY_KO.map((w) => (
          <div key={w} className="bg-canvas px-1 py-1 text-center font-semibold text-muted">
            {w}
          </div>
        ))}
        {days.map((d) => {
          const items = list.filter((x) => x.date === d || x.secondaryDate === d);
          const h = holidayOn(d);
          return (
            <div key={d} className={cx('min-h-20 bg-white p-1', !d.startsWith(ym) && 'bg-canvas/60 text-muted', d === base && 'ring-2 ring-inset ring-brand')}>
              <p className={cx('num font-semibold', h && 'text-risk')}>{Number(d.slice(8))}</p>
              {h && <p className="truncate text-[10px] text-risk">{h.name}</p>}
              {items.map((x) => (
                <Link key={x.key + d} to={x.link} className={cx('mt-0.5 block truncate rounded px-1 py-0.5', x.status === 'done' ? 'bg-ok-soft text-ok line-through' : x.status === 'overdue' ? 'bg-risk-soft text-risk' : 'bg-info-soft text-info')} title={x.title}>
                  {x.secondaryDate === d && x.date !== d ? '(2차) ' : ''}
                  {x.title}
                </Link>
              ))}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default function Deadlines() {
  const { state, base } = useStore();
  const toast = useToast();
  const all = useMemo(() => computeDeadlines(state, base), [state, base]);
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [filter, setFilter] = useState<DeadlineStatus | 'open'>('open');
  const [preview, setPreview] = useState(false);
  const count = (s: DeadlineStatus) => all.filter((d) => d.status === s).length;
  const list = all.filter((d) => (filter === 'open' ? d.status !== 'done' : d.status === filter));
  const todayAlerts = all.filter((d) => d.status !== 'done' && (d.status === 'overdue' || d.alerts.includes(base)));
  const exportIcs = () => {
    const items = all.filter((d) => d.status !== 'done');
    if (!items.length) return toast('내보낼 기한이 없어요', 'info');
    download(`labor-deadlines-${base}.ics`, buildIcs(items), 'text/calendar;charset=utf-8');
    toast(`${items.length}건을 캘린더 파일로 내려받았어요 (내려받은 시점의 사본)`);
  };
  return (
    <div>
      <PageHeader
        title="일정·기한"
        sub={`기준일 ${fmtDate(base)} · 기한은 저장하지 않고 원래 날짜(입사일·계약 종료일·만료일 등)에서 계산해요`}
        actions={
          <>
            <Button onClick={() => setPreview(true)}>카톡 미리보기</Button>
            <Button variant="primary" onClick={exportIcs}>
              캘린더로 내보내기 (.ics)
            </Button>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {(['overdue', 'due7', 'due30', 'later', 'onboarding', 'done'] as DeadlineStatus[]).map((s) => (
          <Button key={s} size="sm" variant={filter === s ? 'primary' : 'secondary'} onClick={() => setFilter(filter === s ? 'open' : s)}>
            {ST_LABEL[s]} {count(s)}
          </Button>
        ))}
        {filter !== 'open' && (
          <Button size="sm" variant="ghost" onClick={() => setFilter('open')}>
            전체(처리 전)
          </Button>
        )}
      </div>
      <Tabs tabs={[{ value: 'list', label: '목록' }, { value: 'calendar', label: '달력' }]} value={view} onChange={setView} />
      {view === 'list' ? (
        <Card>
          {!list.length ? <Empty title="해당하는 기한이 없어요" /> : <ul className="divide-y divide-line">{list.map((d) => <Row key={d.key} d={d} />)}</ul>}
          <p className="mt-3 text-xs text-muted">알림: 30·7·3일 전 + 당일 (매달 반복은 3일 전·당일). 처리를 누르면 알림이 멈춰요. 지금은 앱 안 알림만 동작하고 카톡은 연결 대기예요.</p>
        </Card>
      ) : (
        <CalendarView list={all} />
      )}
      <Card title="종류별 안내" className="mt-4">
        <ul className="grid gap-1 text-xs text-muted sm:grid-cols-2">
          {Object.entries(TYPE_LABEL).map(([k, v]) => (
            <li key={k}>· {v}</li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted">2027.1.1부터 고용·산재 "월 보수 등의 신고"가 매월로 바뀌어요(징수법 제16조의10). 매월 신고 알림을 넣을지는 아직 정하지 않았어요.</p>
      </Card>
      <Modal open={preview} onClose={() => setPreview(false)} title="카카오톡 나에게 보내기 — 미리보기">
        <Notice tone="warn" title="연결 대기 · 실제로 보내지 않아요">카카오 메시지 API 동의와 서버 예약 실행(하루 1회)이 필요해요. 내용에는 별칭만 넣고 금액·실명은 넣지 않아요.</Notice>
        <div className="mt-3 rounded-2xl bg-[#b2c7d9] p-4">
          <div className="max-w-[85%] rounded-xl bg-white p-3 text-sm shadow">
            {todayAlerts.length ? (
              <>
                오늘 처리할 노무 일 {todayAlerts.length}건: {todayAlerts[0].title} {todayAlerts[0].dLabel}
                {todayAlerts.length > 1 ? ` 외 ${todayAlerts.length - 1}건` : ''}
                <p className="mt-2 text-xs text-brand">[앱에서 보기]</p>
              </>
            ) : (
              '오늘 알릴 기한이 없어요 (이 날은 발송하지 않음)'
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
