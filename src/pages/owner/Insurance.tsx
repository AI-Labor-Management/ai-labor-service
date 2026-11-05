// S10 4대보험·퇴직금 (F3). 판정은 예상/제외 예상/확인 필요만, 금액은 "예상". 고지서 금액이 있으면 그 값이 급여 공제에 우선.
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useStore, uid, nowIso } from '../../state/store';
import { employeeInsurance, INSURANCE_LABEL, lossDate, noticeFor, reportDeadlines, VERDICT_LABEL } from '../../domain/insurance';
import { estimateSeverance } from '../../domain/severance';
import { weeklyHours } from '../../domain/work';
import { fmtDate, fmtMD, isISODate, monthOf } from '../../domain/dates';
import type { Employee, InsuranceKind, InsuranceMethod, InsuranceReport } from '../../domain/types';
import { Badge, Basis, Button, Card, cx, Empty, Field, inputCls, inputBaseCls, KV, Modal, Money, Notice, PageHeader, RuleStatusBadge, useToast } from '../../ui/kit';
import { INSURANCE_METHOD_LABEL } from '../../ui/labels';

function ReportRow({ e, phase }: { e: Employee; phase: 'acquisition' | 'loss' }) {
  const { state, update, base } = useStore();
  const toast = useToast();
  const rep = state.insuranceReports.find((r) => r.employeeId === e.id && r.phase === phase);
  const event = phase === 'acquisition' ? e.hireDate : e.resignDate ? lossDate(e.resignDate) : null;
  const [date, setDate] = useState(base);
  if (!event) return null;
  const dl = reportDeadlines(event, event);
  const set = (status: InsuranceReport['status']) => {
    update((d) => {
      d.insuranceReports = d.insuranceReports.filter((r) => !(r.employeeId === e.id && r.phase === phase));
      d.insuranceReports.push({ employeeId: e.id, phase, status, date: isISODate(date) ? date : base, by: 'owner' });
    });
    toast('처리 상태를 남겼어요');
  };
  const method = e.insuranceMethod;
  return (
    <div className="rounded-xl border border-line p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <b>{phase === 'acquisition' ? '입사(취득) 신고' : '퇴사(상실) 신고'}</b>
        <span className="text-muted">
          건강 {fmtMD(dl.health)}까지 · 연금·고용·산재 {fmtMD(dl.others)}까지
        </span>
        {rep && rep.status !== 'none' ? (
          <Badge tone="ok">{{ reported: '신고함', handedOver: '전달함', firmDone: '노무법인 처리 완료', confirmed: '처리 확인', none: '' }[rep.status]} {rep.date ? fmtMD(rep.date) : ''}</Badge>
        ) : method === 'alreadyDone' && phase === 'acquisition' ? (
          <Badge tone="muted">이미 처리함 (날짜 모름)</Badge>
        ) : (
          <Badge tone={method === 'notYet' ? 'risk' : 'warn'}>아직</Badge>
        )}
      </div>
      {!(method === 'alreadyDone' && phase === 'acquisition') && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <input type="date" className={cx(inputBaseCls, 'w-40')} value={date} onChange={(ev) => setDate(ev.target.value)} aria-label="처리 날짜" />
          {method === 'delegated' ? (
            <>
              <Button size="sm" onClick={() => set('handedOver')}>전달함</Button>
              <Button size="sm" onClick={() => set('confirmed')} reason={!rep || rep.status === 'none' ? '먼저 전달함을 기록하세요' : undefined}>처리 확인</Button>
            </>
          ) : (
            <Button size="sm" onClick={() => set('reported')} reason={method === 'notYet' ? '처리 방식을 먼저 고르세요 (직접/맡김)' : undefined}>
              신고함
            </Button>
          )}
          {rep && <Button size="sm" variant="ghost" onClick={() => update((d) => { d.insuranceReports = d.insuranceReports.filter((r) => !(r.employeeId === e.id && r.phase === phase)); })}>기록 지우기</Button>}
        </div>
      )}
      <p className="mt-1 text-xs text-muted">이 서비스는 신고를 대행하지 않아요. 신고에 필요한 주민등록번호는 공단 사이트나 대리인에게 직접 제공해요.</p>
    </div>
  );
}

export default function Insurance() {
  const { state, update, base } = useStore();
  const toast = useToast();
  const [params] = useSearchParams();
  const focus = params.get('emp');
  const [date, setDate] = useState(base);
  const [notice, setNotice] = useState<{ emp: Employee; from: string; v: Record<string, string> } | null>(null);
  const [summary, setSummary] = useState<Employee | null>(null);
  const [printName, setPrintName] = useState('');
  const emps = state.employees.filter((e) => !e.resignDate || e.resignDate >= monthOf(base) + '-01' || state.insuranceReports.every((r) => !(r.employeeId === e.id && r.phase === 'loss')));
  let employerSum: number | null = 0;
  let workerSum: number | null = 0;
  const data = emps.map((e) => {
    const ins = employeeInsurance(state, e, date);
    if (ins.totals.employer === null) employerSum = null;
    else if (employerSum !== null) employerSum += ins.totals.employer;
    if (ins.totals.worker === null) workerSum = null;
    else if (workerSum !== null) workerSum += ins.totals.worker;
    return { e, ins, sev: estimateSeverance(state, e, base) };
  });

  return (
    <div>
      <PageHeader
        title="4대보험 · 퇴직금"
        sub="예상 금액 · 참고용. 공단별 끝수 처리 확인 전이라 실제 고지액과 다를 수 있어요."
        actions={
          <label className="flex items-center gap-2 text-sm">
            요율 기준일
            <input type="date" className={cx(inputBaseCls, 'w-40')} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
            <Button size="sm" variant="ghost" onClick={() => setDate('2027-01-01')}>2027.1.1</Button>
          </label>
        }
      />
      <Card className="mb-4" title="사업장 합계 (월 예상)">
        <div className="grid gap-2 sm:grid-cols-2">
          <KV k="근로자 부담 합계" v={workerSum === null ? <span className="text-warn">일부 금액은 기준 없음</span> : <Money value={workerSum} />} />
          <KV k="사장님 부담 합계" v={employerSum === null ? <span className="text-warn">일부 금액은 기준 없음</span> : <Money value={employerSum} className="font-bold" />} />
        </div>
        <p className="mt-1 text-xs text-muted">기준일의 규칙이 대기(시행령 미정)이거나 없으면 합계를 내지 않아요 — 빠진 채로 합계를 내면 인건비가 적게 보이기 때문이에요. 두루누리 등 지원금 안내는 범위 밖이에요.</p>
      </Card>
      {!data.length && <Empty title="등록한 직원이 없어요" />}
      <div className="grid gap-4">
        {data.map(({ e, ins, sev }) => {
          const n = noticeFor(state, e.id, monthOf(date));
          return (
            <Card key={e.id} id={e.id} className={cx(focus === e.id && 'ring-2 ring-brand/30')} title={<Link to={`/owner/employees/${e.id}`}>{e.alias}</Link>} right={`월 기준 보수 ${ins.base.toLocaleString('ko-KR')}원 (월 ${ins.monthlyHours}시간 환산, 비과세 제외)`}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-sm">
                  <thead className="text-left text-xs text-muted">
                    <tr>
                      <th className="py-1">보험</th>
                      <th>판정</th>
                      <th className="text-right">근로자</th>
                      <th className="text-right">사장님</th>
                      <th className="pl-3">상태</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {ins.rows.map((r) => {
                      const j = ins.judgments.find((x) => x.kind === r.kind)!;
                      const nv = r.kind !== 'industrial' ? n?.amounts[r.kind as Exclude<InsuranceKind, 'industrial'>] : undefined;
                      return (
                        <tr key={r.kind} className="align-top">
                          <td className="py-1.5 font-medium">{INSURANCE_LABEL[r.kind]}</td>
                          <td>
                            <Badge tone={r.verdict === 'expected' ? 'brand' : r.verdict === 'excluded' ? 'muted' : 'warn'}>{VERDICT_LABEL[r.verdict]}</Badge>
                            <p className="mt-0.5 max-w-xs text-xs text-muted">{j.reasons.join(' · ')}</p>
                          </td>
                          <td className="num text-right">
                            {nv != null ? (
                              <>
                                <Money value={nv} />
                                <span className="block text-[10px] text-brand">고지액 (예상 {r.worker?.toLocaleString('ko-KR') ?? '—'})</span>
                              </>
                            ) : (
                              <Money value={r.worker} />
                            )}
                          </td>
                          <td className="num text-right">
                            <Money value={r.employer} />
                          </td>
                          <td className="pl-3 text-xs">
                            {r.status === 'excluded' ? '—' : r.status === 'missing' ? <span className="text-warn">{r.note}</span> : <RuleStatusBadge status={r.status} />}
                            {r.status !== 'missing' && r.status !== 'excluded' && <span className="block text-muted">{r.note}</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2 text-sm">
                <span>
                  근로자 합계 <b><Money value={ins.totals.worker} /></b> · 사장님 합계 <b><Money value={ins.totals.employer} /></b>
                  {ins.totals.worker === null && <span className="ml-1 text-xs text-warn">일부 금액은 기준 없음</span>}
                </span>
                <Basis ids={Array.from(new Set(ins.rows.flatMap((r) => r.basis)))} date={date} />
              </div>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <div>
                  <Field label="처리 방식" htmlFor={`im-${e.id}`}>
                    <select
                      id={`im-${e.id}`}
                      className={inputCls}
                      value={e.insuranceMethod}
                      onChange={(ev) => {
                        const v = ev.target.value as InsuranceMethod;
                        update((d) => {
                          d.employees.find((x) => x.id === e.id)!.insuranceMethod = v;
                          if (d.workplace && v !== 'alreadyDone') d.workplace.defaultInsuranceMethod = v;
                        });
                        toast(`처리 방식: ${INSURANCE_METHOD_LABEL[v]} (다음 직원 기본값으로도 저장)`);
                      }}
                    >
                      {(Object.keys(INSURANCE_METHOD_LABEL) as InsuranceMethod[]).map((v) => (
                        <option key={v} value={v}>
                          {INSURANCE_METHOD_LABEL[v]}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {e.insuranceMethod === 'notYet' && <Notice tone="risk" className="mt-2">아직 안 함 — 홈에 위험으로 떠요.</Notice>}
                  {e.insuranceMethod === 'delegated' && <p className="mt-1 text-xs text-muted">노무법인 공유 {state.workplace?.firmInsuranceShareConsent ? '동의함 — 노무법인이 처리 완료로 표시하면 "처리 확인"이 채워져요' : '안 함 — 사장님이 직접 체크해요 (설정에서 바꿀 수 있어요)'}</p>}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => setNotice({ emp: e, from: monthOf(base), v: { pension: String(n?.amounts.pension ?? ''), health: String(n?.amounts.health ?? ''), ltc: String(n?.amounts.ltc ?? ''), employment: String(n?.amounts.employment ?? '') } })}>
                      고지서 금액 입력
                    </Button>
                    <Button size="sm" onClick={() => { setSummary(e); setPrintName(''); }}>
                      전달 요약 출력
                    </Button>
                  </div>
                </div>
                <div className="grid gap-2">
                  <ReportRow e={e} phase="acquisition" />
                  {e.resignDate && <ReportRow e={e} phase="loss" />}
                </div>
              </div>
              <div className="mt-3 rounded-xl bg-canvas p-3 text-sm">
                <p className="font-semibold">퇴직금</p>
                {sev.applicable === 'e9' ? (
                  <p className="text-muted">{sev.notes[0]}</p>
                ) : (
                  <p>
                    1년 되는 날 <b>{fmtDate(sev.oneYearDate)}</b> · 지금 퇴사하면 {sev.eligible && sev.applicable !== 'no' ? <b><Money value={sev.amount} /></b> : <span className="text-muted">{sev.reason || '대상 아님'}</span>} · 이번 달 적립 예상 <Money value={sev.monthlyAccrual} />
                    <span className="block text-xs text-muted">1~4명 사업장도 퇴직금은 적용돼요. 1년 직전 퇴사 등 시기 조언은 하지 않아요.</span>
                  </p>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Modal open={!!notice} onClose={() => setNotice(null)} title={`${notice?.emp.alias} 고지서 금액 (근로자 부담분)`} footer={<><Button onClick={() => setNotice(null)}>취소</Button><Button variant="primary" onClick={() => { if (!notice) return; update((d) => { const amounts: Record<string, number> = {}; for (const [k, v] of Object.entries(notice.v)) if (v !== '') amounts[k] = Number(v); d.insuranceNotices.push({ id: uid('notice'), employeeId: notice.emp.id, fromMonth: notice.from, amounts, enteredAt: nowIso() }); }); setNotice(null); toast('고지서 금액을 저장했어요. 급여 공제에 우선 적용돼요.'); }}>저장</Button></>}>
        {notice && (
          <div className="grid gap-3">
            <Field label="적용 시작 월" htmlFor="nt-m" hint="이 달부터 다음 입력 전까지 급여 공제에 써요">
              <input id="nt-m" type="month" className={inputCls} value={notice.from} onChange={(e) => setNotice({ ...notice, from: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              {(['pension', 'health', 'ltc', 'employment'] as const).map((k) => (
                <Field key={k} label={INSURANCE_LABEL[k]} htmlFor={`nt-${k}`}>
                  <input id={`nt-${k}`} type="number" className={inputCls} value={notice.v[k]} placeholder="비우면 예상 금액" onChange={(e) => setNotice({ ...notice, v: { ...notice.v, [k]: e.target.value } })} />
                </Field>
              ))}
            </div>
            <p className="text-xs text-muted">연말 정산으로 달라지는 금액은 계산하지 않아요 — 공단 고지를 따르세요.</p>
          </div>
        )}
      </Modal>

      <Modal open={!!summary} onClose={() => setSummary(null)} title="대리인 전달 요약" footer={<Button variant="primary" onClick={() => window.print()}>인쇄</Button>}>
        {summary && (
          <div className="print-area text-sm">
            <p className="font-bold">4대보험 처리 요청 요약 · {state.workplace?.name}</p>
            <label className="no-print mt-2 flex flex-col gap-1 text-xs text-muted">
              출력용 이름 (선택 · 저장 안 함)
              <input className={inputCls} value={printName} onChange={(e) => setPrintName(e.target.value)} />
            </label>
            {(() => {
              const ins = employeeInsurance(state, summary, base);
              return (
                <div className="mt-2">
                  <KV k="직원" v={`${summary.alias}${printName ? ` · ${printName}` : ''}`} />
                  <KV k="입사일" v={fmtDate(summary.hireDate)} />
                  {summary.resignDate && <KV k="퇴사일 / 상실일" v={`${fmtDate(summary.resignDate)} / ${fmtDate(lossDate(summary.resignDate))}`} />}
                  <KV k="근무 시간" v={ins.condition ? `주 ${weeklyHours(ins.condition).toFixed(1)}시간${ins.condition.variable ? ' (매주 달라요, 평균 예상)' : ''} · 월 ${ins.monthlyHours}시간 환산` : '—'} />
                  <KV k="월 보수 (예상)" v={<Money value={ins.base} />} />
                  {ins.judgments.map((j) => (
                    <KV key={j.kind} k={INSURANCE_LABEL[j.kind]} v={VERDICT_LABEL[j.verdict]} />
                  ))}
                  <p className="mt-2 text-xs text-muted">주민등록번호 칸은 두지 않았어요. 신고에 필요한 정보는 직접 전달하세요.</p>
                </div>
              );
            })()}
          </div>
        )}
      </Modal>
    </div>
  );
}
