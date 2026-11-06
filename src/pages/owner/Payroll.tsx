// S09 월 급여 (F2): 초안 → 바뀐 날 수정 → 규모 확인 → 확인 대기 처리 → 결과 확인 → 확정(임금대장·명세서) → 앱 교부
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useStore, uid, nowIso, pushNotification } from '../../state/store';
import { draftLines, payrollFor, payrollLines, payrollPeriodFor, pendingAttendanceIn } from '../../domain/payroll';
import { addMonthsYM, fmtDate, fmtMD, fmtYM, monthOf, fmtDateTime, localDate, fmtMDT } from '../../domain/dates';
import { isUnder5 } from '../../domain/work';
import type { AppState, PayrollLine, PayrollManual, ScaleBand } from '../../domain/types';
import { Badge, Basis, Button, Card, cx, Empty, Field, inputCls, inputBaseCls, KV, LinkButton, Modal, Money, Notice, PageHeader, useToast } from '../../ui/kit';
import { SCALE_LABEL } from '../../ui/labels';
import { validMonth } from '../../domain/navigation';

function defaultMonth(state: AppState, base: string): string {
  const wp = state.workplace!;
  const m = monthOf(base);
  for (const c of [addMonthsYM(m, -1), m]) {
    const p = payrollPeriodFor(wp, c);
    if (p.payDate >= base && payrollFor(state, c)?.status !== 'confirmed') return c;
  }
  return wp.payMonthBasis === 'previous' ? addMonthsYM(m, -1) : m;
}

function ensureDraft(d: AppState, month: string) {
  let p = d.payrolls.find((x) => x.month === month);
  if (!p) {
    p = { id: month, month, status: 'draft', scaleConfirmed: null, manual: [], confirmedAt: null, confirmedLines: null, confirmedWithPending: [], revision: 0 };
    d.payrolls.push(p);
  }
  return p;
}

function recompute(line: PayrollLine): PayrollLine {
  const gross = line.items.reduce((s, i) => s + i.amount, 0);
  const deductionTotal = line.deductions.reduce((s, d) => s + (d.amount ?? 0), 0);
  return { ...line, gross, deductionTotal, net: gross - deductionTotal, netComplete: line.deductions.every((d) => d.amount !== null) };
}

export default function Payroll() {
  const { state, update, base } = useStore();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const wp = state.workplace!;
  const month = validMonth(params.get('month')) ? params.get('month')! : defaultMonth(state, base);
  const setMonth = (m: string) => setParams({ month: m }, { replace: true });
  const per = payrollPeriodFor(wp, month);
  const { lines, confirmed, payroll } = useMemo(() => payrollLines(state, month), [state, month]);
  const pending = pendingAttendanceIn(state, month);
  const scale: ScaleBand = payroll?.scaleConfirmed ?? wp.scale;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [edit, setEdit] = useState<{ emp: string; kind: 'adjust' | 'incomeTax' | 'localTax'; label: string; amount: string; reason: string } | null>(null);
  const [editErr, setEditErr] = useState('');
  const [ledger, setLedger] = useState(false);
  const totals = lines.reduce((a, l) => ({ gross: a.gross + l.gross, ded: a.ded + l.deductionTotal, net: a.net + l.net }), { gross: 0, ded: 0, net: 0 });
  const manualOf = (eid: string): PayrollManual => payroll?.manual.find((m) => m.employeeId === eid) ?? { employeeId: eid, incomeTax: null, localTax: null, adjustments: [] };

  const setManual = (eid: string, patch: Partial<PayrollManual>) =>
    update((d) => {
      const p = ensureDraft(d, month);
      let m = p.manual.find((x) => x.employeeId === eid);
      if (!m) {
        m = { employeeId: eid, incomeTax: null, localTax: null, adjustments: [] };
        p.manual.push(m);
      }
      Object.assign(m, patch);
    });

  const doConfirm = () => {
    const snap = draftLines(state, month);
    update((d) => {
      const p = ensureDraft(d, month);
      p.status = 'confirmed';
      p.confirmedAt = nowIso();
      p.confirmedLines = snap;
      p.confirmedWithPending = pending.map((a) => a.date);
      p.scaleConfirmed = scale;
      p.revision = 1;
      for (const l of snap) {
        const e = d.employees.find((x) => x.id === l.employeeId)!;
        d.statements = d.statements.filter((s) => !(s.payrollId === p.id && s.employeeId === e.id));
        d.statements.push({ id: uid('st'), payrollId: p.id, employeeId: e.id, revision: 1, method: e.account === 'joined' ? 'app' : 'print', deliveredAt: nowIso(), viewedAt: null, disputed: null });
        if (e.account === 'joined') pushNotification(d, e.id, 'statement', `${fmtYM(month)}분 임금명세서가 도착했어요`, '/employee/pay');
      }
    });
    setConfirmOpen(false);
    toast('확정했어요. 임금대장과 임금명세서가 만들어졌어요.');
  };

  const saveEdit = () => {
    if (!edit || !payroll?.confirmedLines) return;
    const amt = Number(edit.amount);
    if (!Number.isFinite(amt) || edit.amount === '') return setEditErr('금액을 입력하세요');
    if (!edit.reason.trim()) return setEditErr('수정 사유는 필수예요');
    if (edit.kind === 'adjust' && !edit.label.trim()) return setEditErr('항목 이름을 적어 주세요');
    update((d) => {
      const p = d.payrolls.find((x) => x.month === month)!;
      const idx = p.confirmedLines!.findIndex((l) => l.employeeId === edit.emp);
      const line = structuredClone(p.confirmedLines![idx]);
      let before = '';
      let after = '';
      if (edit.kind === 'adjust') {
        line.items.push({ code: 'adjust', label: edit.label.trim(), amount: Math.round(amt), formula: `확정 후 수정 · ${edit.reason.trim()}`, basis: [] });
        before = '—';
        after = `${edit.label.trim()} ${Math.round(amt).toLocaleString('ko-KR')}원`;
      } else {
        const dd = line.deductions.find((x) => x.code === edit.kind)!;
        before = dd.amount === null ? '미정' : String(dd.amount);
        dd.amount = Math.round(amt);
        dd.source = 'manual';
        dd.note = '확정 후 사장님 입력';
        after = String(dd.amount);
      }
      p.confirmedLines![idx] = recompute(line);
      p.revision += 1;
      d.payrollEdits.push({ id: uid('pe'), payrollId: p.id, employeeId: edit.emp, field: edit.kind === 'adjust' ? '조정 항목 추가' : edit.kind === 'incomeTax' ? '소득세' : '지방소득세', before, after, reason: edit.reason.trim(), at: nowIso() });
      const e = d.employees.find((x) => x.id === edit.emp)!;
      d.statements = d.statements.filter((s) => !(s.payrollId === p.id && s.employeeId === e.id));
      d.statements.push({ id: uid('st'), payrollId: p.id, employeeId: e.id, revision: p.revision, method: e.account === 'joined' ? 'app' : 'print', deliveredAt: nowIso(), viewedAt: null, disputed: null });
      if (e.account === 'joined') pushNotification(d, e.id, 'statement', `${fmtYM(month)}분 임금명세서가 수정됐어요 · 사유: ${edit.reason.trim()}`, '/employee/pay');
    });
    setEdit(null);
    toast('수정 이력을 남기고 명세서를 다시 교부했어요');
  };

  const edits = state.payrollEdits.filter((x) => x.payrollId === month);

  return (
    <div>
      <PageHeader
        title={`${fmtYM(month)}분 급여`}
        sub={`산정 ${fmtDate(per.from)}~${fmtDate(per.to)} · 지급일 ${fmtDate(per.payDate)} · ${SCALE_LABEL[scale]} · 기준일 ${fmtDate(per.to)} · 참고용`}
        actions={
          <>
            <Button size="sm" onClick={() => setMonth(addMonthsYM(month, -1))}>← 이전 달</Button>
            <Button size="sm" onClick={() => setMonth(addMonthsYM(month, 1))}>다음 달 →</Button>
            <LinkButton size="sm" to="/owner/insurance">보험·퇴직금</LinkButton>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {confirmed ? <Badge tone="ok">확정 {localDate(payroll?.confirmedAt)} · {payroll?.revision}차</Badge> : <Badge tone="warn">초안 — 확정 전</Badge>}
        {payroll?.confirmedWithPending.length ? <Badge tone="info">확인 대기 상태로 확정된 날 {payroll.confirmedWithPending.length}일</Badge> : null}
      </div>
      {!lines.length && <Empty title="이 기간에 근무한 직원이 없어요" />}
      {lines.length > 0 && (
        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
          <div className="grid content-start gap-4">
            {!confirmed && (
              <Card title="확정 전 확인">
                <div className="grid gap-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span>이번 달도 <b>{SCALE_LABEL[scale]}</b>이 맞나요?</span>
                    <select className={cx(inputBaseCls, 'w-auto')} value={scale} aria-label="이번 달 규모 구간" onChange={(e) => update((d) => { ensureDraft(d, month).scaleConfirmed = e.target.value as ScaleBand; })}>
                      {Object.entries(SCALE_LABEL).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                    {scale !== wp.scale && <Badge tone="warn">사업장 설정({SCALE_LABEL[wp.scale]})과 달라요</Badge>}
                  </div>
                  {pending.length > 0 ? (
                    <Notice tone="info" title={`확정 전에 확인할 근무 ${pending.length}건`}>
                      {pending.map((a) => `${state.employees.find((e) => e.id === a.employeeId)?.alias} ${fmtMD(a.date)} ${a.reason}`).join(' · ')}. 그대로 확정하면 예정 시간으로 계산해요.{' '}
                      <Link className="font-semibold underline" to="/owner/work?tab=attendance">
                        출퇴근 기록에서 처리
                      </Link>
                    </Notice>
                  ) : (
                    <p className="text-muted">확인 대기 근무 없음</p>
                  )}
                </div>
              </Card>
            )}
            {lines.map((l) => (
              <LineCard key={l.employeeId} line={l} under5={isUnder5(scale)} confirmed={confirmed} manual={manualOf(l.employeeId)} setManual={(p) => setManual(l.employeeId, p)} month={month} onEdit={() => { setEdit({ emp: l.employeeId, kind: 'adjust', label: '', amount: '', reason: '' }); setEditErr(''); }} />
            ))}
          </div>
          <div className="grid content-start gap-4 xl:sticky xl:top-4">
            <Card title="합계">
              <KV k="지급액" v={<Money value={totals.gross} />} />
              <KV k="공제 (입력된 것)" v={<Money value={totals.ded} />} />
              <KV k="실수령액" v={<Money value={totals.net} className="font-bold" />} />
              {lines.some((l) => !l.netComplete) && <p className="mt-1 text-xs text-warn">소득세 등 미정 공제가 있어요. 확정 전·후에 직접 입력할 수 있어요.</p>}
              {!confirmed ? (
                <Button variant="primary" size="lg" className="mt-4 w-full" onClick={() => setConfirmOpen(true)}>
                  확정하고 임금명세서 보내기
                </Button>
              ) : (
                <div className="mt-4 grid gap-2">
                  <Button onClick={() => setLedger(true)}>임금대장 보기·인쇄</Button>
                  <p className="text-xs text-muted">확정분은 덮어쓰지 않아요. 직원 카드의 [수정]은 이력으로 남아요.</p>
                </div>
              )}
              <p className="mt-2 text-xs text-muted">명세서는 직원 앱으로 전자 교부해요 (직원이 열면 수령 확인). 앱이 없는 직원은 출력해서 드려요.</p>
            </Card>
            {confirmed && (
              <Card title="교부·수령 확인">
                <ul className="space-y-1 text-sm">
                  {lines.map((l) => {
                    const st = state.statements.find((s) => s.payrollId === month && s.employeeId === l.employeeId);
                    return (
                      <li key={l.employeeId} className="flex items-center justify-between gap-2">
                        <span>{l.alias}</span>
                        <span className="flex items-center gap-1">
                          {st?.method === 'app' ? st.viewedAt ? <Badge tone="ok">수령 {fmtMDT(st.viewedAt)}</Badge> : <Badge tone="warn">앱 교부 · 미열람</Badge> : <Badge tone="muted">출력 교부</Badge>}
                          {st?.disputed && <Badge tone="risk">금액 이의</Badge>}
                          <LinkButton size="sm" to={`/owner/payroll/statement/${month}/${l.employeeId}`}>명세서</LinkButton>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            )}
            {edits.length > 0 && (
              <Card title="수정 이력">
                <ul className="space-y-1 text-xs">
                  {edits.map((x) => (
                    <li key={x.id}>
                      {fmtDateTime(x.at)} · {state.employees.find((e) => e.id === x.employeeId)?.alias} · {x.field}: {x.before} → {x.after} · {x.reason}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </div>
      )}

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title={`${fmtYM(month)}분 급여 확정`} footer={<><Button onClick={() => setConfirmOpen(false)}>취소</Button><Button variant="primary" onClick={doConfirm}>{pending.length ? '그대로 확정' : '확정'}</Button></>}>
        {pending.length > 0 && (
          <Notice tone="warn" title={`확인 대기 근무 ${pending.length}건이 남아 있어요`} className="mb-3">
            그대로 확정하면 그 날은 예정 시간으로 계산하고 "확인 대기 상태로 확정됨" 표시를 남겨요.
          </Notice>
        )}
        <KV k="직원" v={`${lines.length}명`} />
        <KV k="지급액 합계" v={<Money value={totals.gross} />} />
        <KV k="규모 구간" v={SCALE_LABEL[scale]} />
        <p className="mt-2 text-sm text-muted">확정하면 임금대장·임금명세서가 만들어지고, 가입한 직원에게 앱 안 알림으로 교부해요 (카톡은 연결 대기). 이후 조건이 바뀌어도 이 급여는 바뀌지 않아요.</p>
      </Modal>

      <Modal open={!!edit} onClose={() => setEdit(null)} title="확정 급여 수정 (이력으로 남김)" footer={<><Button onClick={() => setEdit(null)}>취소</Button><Button variant="primary" onClick={saveEdit}>수정·재교부</Button></>}>
        {edit && (
          <div className="grid gap-3">
            <Field label="무엇을 고치나요">
              <select className={inputCls} value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value as 'adjust' })}>
                <option value="adjust">지급 항목 추가 (예: 퇴사 주 주휴 확인 후 지급)</option>
                <option value="incomeTax">소득세</option>
                <option value="localTax">지방소득세</option>
              </select>
            </Field>
            {edit.kind === 'adjust' && (
              <Field label="항목 이름" htmlFor="pe-l">
                <input id="pe-l" className={inputCls} value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value })} />
              </Field>
            )}
            <Field label="금액 (원, 차감은 음수)" htmlFor="pe-a">
              <input id="pe-a" type="number" className={inputCls} value={edit.amount} onChange={(e) => setEdit({ ...edit, amount: e.target.value })} />
            </Field>
            <Field label="사유 (필수)" htmlFor="pe-r">
              <input id="pe-r" className={inputCls} value={edit.reason} onChange={(e) => setEdit({ ...edit, reason: e.target.value })} />
            </Field>
            <p className="text-xs text-muted">지각 벌금·파손 비용은 공제 항목으로 둘 수 없어요 (근로기준법 제20조·제43조).</p>
            {editErr && <p role="alert" className="text-sm font-semibold text-risk">{editErr}</p>}
          </div>
        )}
      </Modal>

      <Modal open={ledger} onClose={() => setLedger(false)} title={`임금대장 · ${fmtYM(month)}분`} wide footer={<Button variant="primary" onClick={() => window.print()}>인쇄</Button>}>
        <div className="print-area overflow-x-auto">
          <p className="hidden font-bold print:block">임금대장 · {wp.name} · {fmtYM(month)}분 (별칭 기준)</p>
          <table className="w-full min-w-[560px] text-xs">
            <thead className="text-left text-muted">
              <tr>
                <th className="py-1">직원</th>
                {!isUnder5(scale) && <th>근로일수</th>}
                {!isUnder5(scale) && <th>근로시간</th>}
                <th>지급액</th>
                <th>공제</th>
                <th>실수령</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {lines.map((l) => (
                <tr key={l.employeeId}>
                  <td className="py-1">{l.alias}</td>
                  {!isUnder5(scale) && <td>{l.workDays}</td>}
                  {!isUnder5(scale) && <td>{l.hours.worked.toFixed(1)}</td>}
                  <td className="num">{l.gross.toLocaleString('ko-KR')}</td>
                  <td className="num">{l.deductionTotal.toLocaleString('ko-KR')}</td>
                  <td className="num">{l.net.toLocaleString('ko-KR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted">상시 4명 이하는 근로일수·근로시간수 생략 가능 (시행령 제27조). 보관: 마지막 기재일부터 3년.</p>
        </div>
      </Modal>
    </div>
  );
}

function LineCard({ line: l, under5, confirmed, manual, setManual, month, onEdit }: { line: PayrollLine; under5: boolean; confirmed: boolean; manual: PayrollManual; setManual: (p: Partial<PayrollManual>) => void; month: string; onEdit: () => void }) {
  const [adj, setAdj] = useState({ label: '', amount: '' });
  return (
    <Card
      title={
        <span className="flex flex-wrap items-center gap-2">
          {l.alias}
          <span className="text-sm font-normal text-muted">확정 근무 {l.hours.worked.toFixed(1)}시간 · {l.workDays}일</span>
        </span>
      }
      right={confirmed ? <Button size="sm" onClick={onEdit}>수정</Button> : <LinkButton size="sm" to={`/owner/work`}>근무 고치기</LinkButton>}
    >
      {l.warnings.map((w, i) => (
        <Notice key={i} tone={w.level === 'risk' ? 'risk' : w.level === 'check' ? 'warn' : 'info'} className="mb-2">
          {w.text}
        </Notice>
      ))}
      <table className="w-full text-sm">
        <tbody>
          {l.items.map((i, k) => (
            <tr key={k} className="align-top">
              <td className="py-1 pr-2 font-medium">{i.label}</td>
              <td className="py-1 pr-2 text-xs text-muted">{i.formula}</td>
              <td className="num py-1 text-right">{i.amount.toLocaleString('ko-KR')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {under5 && l.items.find((i) => i.code === 'premium')?.note && (
        <div className="mt-2 rounded-xl bg-info-soft px-3 py-2 text-sm">
          <p className="font-bold text-info">가산이 0원인 이유</p>
          <p className="text-ink/85">{l.items.find((i) => i.code === 'premium')!.note}</p>
          <div className="mt-1">
            <Basis ids={['scope.under5.appliedArticles']} date={l.period.to} label="근기법 시행령 별표 1" />
          </div>
        </div>
      )}
      <details className="mt-2 text-xs">
        <summary className="cursor-pointer font-semibold text-brand">주휴수당 주별 계산 ({l.weeklyHolidayDetail.length}주)</summary>
        <table className="mt-1 w-full">
          <tbody>
            {l.weeklyHolidayDetail.map((r) => (
              <tr key={r.weekEnd} className="border-b border-line/60 align-top">
                <td className="py-1">{fmtMD(r.weekStart)}~{fmtMD(r.weekEnd)}</td>
                <td>주 {r.scheduledHours}h (4주 평균 {r.avg4w}h)</td>
                <td>{r.included ? `${r.hours}h → ${r.amount.toLocaleString('ko-KR')}원` : r.eligible ? `${r.amount.toLocaleString('ko-KR')}원 (미포함)` : '없음'}</td>
                <td className="text-muted">{r.flags.join(' · ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-1">
          <Basis ids={['weeklyHoliday.minWeeklyHours', 'weeklyHoliday.paidHours']} date={l.period.to} />
        </div>
      </details>
      <div className="mt-3 flex items-center justify-between border-t border-line pt-2 font-bold">
        <span>지급액</span>
        <Money value={l.gross} />
      </div>
      <details className="mt-1 text-sm" open={!l.netComplete && !confirmed}>
        <summary className="cursor-pointer text-muted">공제 내역 ▾ <span className="text-xs">(보험료는 F3 예상 금액, 고지서 금액이 있으면 그 값)</span></summary>
        <ul className="mt-1 space-y-1">
          {l.deductions.map((d) => (
            <li key={d.code} className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {d.label} <span className="text-xs text-muted">{d.note}</span>
              </span>
              {!confirmed && (d.code === 'incomeTax' || d.code === 'localTax') && d.source !== 'dailyFormula' ? (
                <input
                  type="number"
                  className={cx(inputBaseCls, 'w-28 text-right')}
                  aria-label={`${l.alias} ${d.label}`}
                  value={(d.code === 'incomeTax' ? manual.incomeTax : manual.localTax) ?? ''}
                  placeholder="입력"
                  onChange={(e) => setManual(d.code === 'incomeTax' ? { incomeTax: e.target.value === '' ? null : Number(e.target.value) } : { localTax: e.target.value === '' ? null : Number(e.target.value) })}
                />
              ) : (
                <span className={cx('num', d.amount === null && 'text-warn')}>{d.amount === null ? '미정' : d.amount.toLocaleString('ko-KR')}</span>
              )}
            </li>
          ))}
        </ul>
      </details>
      {!confirmed && (
        <div className="mt-2 flex flex-wrap items-end gap-2 text-sm">
          {manual.adjustments.map((a, i) => (
            <Badge key={i} tone="muted">
              {a.label} {a.amount.toLocaleString('ko-KR')}
              <button type="button" className="ml-1" aria-label="조정 삭제" onClick={() => setManual({ adjustments: manual.adjustments.filter((_, j) => j !== i) })}>
                ✕
              </button>
            </Badge>
          ))}
          <input className={cx(inputBaseCls, 'w-36')} placeholder="조정 항목" value={adj.label} onChange={(e) => setAdj({ ...adj, label: e.target.value })} aria-label="조정 항목 이름" />
          <input className={cx(inputBaseCls, 'w-28')} type="number" placeholder="금액" value={adj.amount} onChange={(e) => setAdj({ ...adj, amount: e.target.value })} aria-label="조정 금액" />
          <Button size="sm" reason={!adj.label.trim() || adj.amount === '' ? undefined : undefined} disabled={!adj.label.trim() || adj.amount === ''} onClick={() => { setManual({ adjustments: [...manual.adjustments, { label: adj.label.trim(), amount: Number(adj.amount) }] }); setAdj({ label: '', amount: '' }); }}>
            조정 추가
          </Button>
        </div>
      )}
      <div className="mt-2 flex items-center justify-between font-bold">
        <span>
          실수령액 {!l.netComplete && <span className="text-xs font-normal text-warn">(미정 공제 제외)</span>}
        </span>
        <Money value={l.net} />
      </div>
      <p className="mt-1 text-xs text-muted">
        3.3% 사업소득 처리 선택지는 없어요 — 등록한 직원은 근로자로 계산해요. 세금은 세무 전문가 확인 권장.{' '}
        <Link className="underline" to={`/owner/payroll/statement/${month}/${l.employeeId}`}>
          명세서 미리보기
        </Link>
      </p>
    </Card>
  );
}

