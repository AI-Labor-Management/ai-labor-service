import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useStore, uid, nowIso, pushNotification } from '../../state/store';
import { conditionHistory, isUnder5, weeklyHours, netMinutes } from '../../domain/work';
import { foreignSignal, SIGNAL_LABEL, VISA_GUIDE } from '../../domain/foreign';
import { employeeInsurance, INSURANCE_LABEL, VERDICT_LABEL } from '../../domain/insurance';
import { estimateSeverance } from '../../domain/severance';
import { leaveAccrual } from '../../domain/leave';
import { checkMinimumWage } from '../../domain/wage';
import { addDays, fmtDate, isISODate, WEEKDAY_KO } from '../../domain/dates';
import type { Weekday, WorkCondition } from '../../domain/types';
import { Badge, Basis, Button, Card, copyText, Empty, Field, inputCls, KV, LinkButton, Money, Modal, Notice, PageHeader, Tabs, useToast } from '../../ui/kit';
import ScheduleEditor, { scheduleErrors, type Sched } from '../../ui/ScheduleEditor';
import { AGE_LABEL, EMPLOYMENT_LABEL, INSURANCE_METHOD_LABEL, RESIGN_LABEL, VISA_LABEL } from '../../ui/labels';
import { BasicFields, applyBasic, basicFromEmployee, validateBasic, type BasicForm } from './EmployeeForm';

export function schedText(c: WorkCondition): string {
  if (c.variable) return `매주 달라요 (주 평균 약 ${c.variableWeeklyHours}시간)`;
  return c.schedule.map((d, i) => (d ? `${WEEKDAY_KO[i]} ${d.start}-${d.end}${d.breakMin ? `(휴${d.breakMin})` : ''}` : null)).filter(Boolean).join(' · ');
}

type Tab = 'summary' | 'conditions' | 'insurance' | 'leave' | 'app';

export default function EmployeeDetail() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const { state, update, base, setSession } = useStore();
  const nav = useNavigate();
  const toast = useToast();
  const e = state.employees.find((x) => x.id === id);
  const tab = (params.get('tab') as Tab) || 'summary';
  const setTab = (t: Tab) => setParams((p) => { p.set('tab', t); return p; }, { replace: true });
  const [edit, setEdit] = useState<BasicForm | null>(null);
  const [editErr, setEditErr] = useState<Record<string, string>>({});
  const [change, setChange] = useState<null | { from: string; wage: number; sched: Sched; variable: boolean; varHours: string; holiday: Weekday; job: string; meal: string; waiver: boolean; reason: string }>(null);
  const [changeErr, setChangeErr] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!e) return <Empty title="직원을 찾을 수 없어요" action={<LinkButton to="/owner/employees">직원 목록</LinkButton>} />;
  const hist = conditionHistory(state.conditions, e.id);
  const cur = hist.filter((c) => c.effectiveFrom <= base).slice(-1)[0] ?? hist[0];
  const fs = foreignSignal(state, e, base);
  const ins = employeeInsurance(state, e, base);
  const sev = estimateSeverance(state, e, base);
  const leave = leaveAccrual(state, e, base);
  const under5 = isUnder5(state.workplace?.scale);
  const inConfirmedPayroll = state.payrolls.some((p) => p.confirmedLines?.some((l) => l.employeeId === e.id));
  const dispute = e.conditionAcks.find((a) => a.status === 'disputed' && !a.resolvedAt);

  const saveBasic = () => {
    if (!edit) return;
    const er = validateBasic(edit);
    setEditErr(er);
    if (Object.keys(er).length) return;
    update((d) => {
      const t = d.employees.find((x) => x.id === e.id)!;
      const hireChanged = t.hireDate !== edit.hireDate;
      applyBasic(t, edit);
      // 최초 근로조건의 적용일은 입사일을 따라간다
      if (hireChanged) {
        const first = d.conditions.filter((c) => c.employeeId === e.id).sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : 1))[0];
        if (first && first.effectiveFrom > edit.hireDate) first.effectiveFrom = edit.hireDate;
        else if (first && first.reason === '최초 등록') first.effectiveFrom = edit.hireDate;
      }
    });
    setEdit(null);
    toast('저장했어요. 관련 기한을 다시 계산했어요.');
  };

  const openChange = () => {
    const c = cur!;
    setChange({ from: addDays(base, 1), wage: c.hourlyWage, sched: c.schedule, variable: c.variable, varHours: String(c.variableWeeklyHours ?? ''), holiday: c.weeklyHolidayDay, job: c.job, meal: String(c.mealAllowance), waiver: c.breakWaiverRequested, reason: '' });
    setChangeErr('');
  };
  const saveChange = () => {
    if (!change) return;
    if (!isISODate(change.from)) return setChangeErr('적용 시작일을 입력하세요');
    if (change.from < e.hireDate) return setChangeErr('입사일보다 이른 날짜는 고를 수 없어요');
    if (!(change.wage > 0)) return setChangeErr('시급을 입력하세요');
    if (!change.reason.trim()) return setChangeErr('변경 사유를 적어 주세요 (이력으로 남아요)');
    if (!change.variable && (scheduleErrors(change.sched).length || !change.sched.some(Boolean))) return setChangeErr(scheduleErrors(change.sched)[0] ?? '근무 요일을 하나 이상 고르세요');
    if (change.variable && !(Number(change.varHours) > 0)) return setChangeErr('주 평균 예상 시간을 입력하세요');
    const condId = uid('cond');
    update((d) => {
      d.conditions.push({ id: condId, employeeId: e.id, effectiveFrom: change.from, hourlyWage: change.wage, schedule: change.variable ? [null, null, null, null, null, null, null] : change.sched, variable: change.variable, variableWeeklyHours: change.variable ? Number(change.varHours) : null, weeklyHolidayDay: change.holiday, job: change.job, mealAllowance: Number(change.meal) || 0, breakWaiverRequested: change.waiver, reason: change.reason.trim(), createdAt: nowIso() });
      if (e.account === 'joined') pushNotification(d, e.id, 'conditionRecheck', `근로조건이 ${fmtDate(change.from)}부터 바뀌어요. 확인해 주세요.`, '/employee/join');
    });
    setChange(null);
    toast('조건 변경을 이력으로 남겼어요. 변경 계약서 할 일이 생겼어요.');
  };

  const makeInvite = () => {
    const token = Math.random().toString(36).slice(2, 10);
    update((d) => {
      const t = d.employees.find((x) => x.id === e.id)!;
      t.invite = { token, expiresAt: addDays(base, 7), used: false };
      if (t.account === 'none') t.account = 'invited';
    });
    toast('초대 링크를 만들었어요 (7일 유효, 일회용)');
  };
  const inviteUrl = e.invite ? `${location.origin}/employee/join?invite=${e.invite.token}` : '';

  return (
    <div className="max-w-5xl">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {e.alias}
            {e.resignDate && <Badge tone="muted">퇴사 {fmtDate(e.resignDate)}</Badge>}
            {e.onboarding === 'existing-pending' && <Badge tone="info">기존 직원 정리 전</Badge>}
          </span>
        }
        sub={`${AGE_LABEL[e.ageBand]} · ${EMPLOYMENT_LABEL[e.employmentType]} · 입사 ${fmtDate(e.hireDate)}${e.contractEnd ? ` · 계약 종료 ${fmtDate(e.contractEnd)}` : ''}`}
        actions={
          <>
            {e.onboarding === 'existing-pending' && (
              <LinkButton to={`/owner/employees/${e.id}/onboarding`} variant="primary">
                있는 서류 한 번에 체크
              </LinkButton>
            )}
            <LinkButton to={`/owner/documents?emp=${e.id}`}>서류</LinkButton>
            {!e.resignDate ? (
              <LinkButton to={`/owner/offboarding/${e.id}`} variant="danger">
                퇴사 처리
              </LinkButton>
            ) : (
              <LinkButton to={`/owner/offboarding/${e.id}`}>퇴사 처리 보기</LinkButton>
            )}
          </>
        }
      />
      <Tabs<Tab>
        tabs={[
          { value: 'summary', label: '요약' },
          { value: 'conditions', label: `근로조건 이력 (${hist.length})` },
          { value: 'insurance', label: '보험·퇴직금' },
          { value: 'leave', label: '연차', hidden: under5 },
          { value: 'app', label: '직원 앱·초대' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'summary' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="기본 정보" right={<Button size="sm" onClick={() => { setEdit(basicFromEmployee(e)); setEditErr({}); }}>수정</Button>}>
            <KV k="나이대" v={AGE_LABEL[e.ageBand]} />
            {e.birthDate && <KV k="생년월일 (18세 미만)" v={e.birthDate} />}
            {e.ageBand === '65+' && <KV k="65세 전부터 근무" v={e.startedBefore65 === null ? '모름 (확인 필요)' : e.startedBefore65 ? '예' : '아니오'} />}
            <KV k="입사일" v={fmtDate(e.hireDate)} />
            <KV k="수습 종료" v={e.probationEnd ? fmtDate(e.probationEnd) : '없음'} />
            <KV k="고용 방식" v={`${EMPLOYMENT_LABEL[e.employmentType]}${e.contractEnd ? ` ~ ${fmtDate(e.contractEnd)}` : ''}`} />
            <KV k="4대보험 처리" v={INSURANCE_METHOD_LABEL[e.insuranceMethod]} />
            <KV k="학생" v={e.school ?? '아니오'} />
            {e.resignDate && <KV k="퇴사" v={`${fmtDate(e.resignDate)} · ${e.resignType ? RESIGN_LABEL[e.resignType] : ''}`} />}
          </Card>
          <Card title="현재 근로조건" right={cur ? `${fmtDate(cur.effectiveFrom)}부터` : ''}>
            {cur ? (
              <>
                <KV k="시급" v={<Money value={cur.hourlyWage} />} />
                <KV k="근무" v={<span className="text-xs">{schedText(cur)}</span>} />
                <KV k="주 소정근로시간" v={`${weeklyHours(cur).toFixed(1)}시간`} />
                <KV k="주휴일" v={`${WEEKDAY_KO[cur.weeklyHolidayDay]}요일`} />
                {(() => {
                  const m = checkMinimumWage(cur.hourlyWage, base);
                  return m.status === 'below' ? <Notice tone="risk" className="mt-2" title={`최저임금 미달 (${m.required?.toLocaleString('ko-KR')}원)`} /> : null;
                })()}
                {dispute && (
                  <Notice tone="warn" className="mt-2" title={`직원이 "다른 점이 있어요"를 남겼어요`}>
                    “{dispute.memo}”
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" onClick={openChange}>조건 변경</Button>
                      <Button size="sm" onClick={() => update((d) => { const a = d.employees.find((x) => x.id === e.id)!.conditionAcks.find((x) => x.at === dispute.at)!; a.resolvedAt = nowIso(); })}>
                        확인 처리
                      </Button>
                    </div>
                  </Notice>
                )}
              </>
            ) : (
              <p className="text-sm text-muted">근로조건이 없어요.</p>
            )}
          </Card>
          {fs && (
            <Card title={<span>외국인 신호등 <Badge tone={fs.signal === 'risk' ? 'risk' : fs.signal === 'check' ? 'warn' : 'ok'}>{SIGNAL_LABEL[fs.signal]}</Badge></span>} right={e.foreign ? VISA_LABEL[e.foreign.visa] : ''}>
              <ul className="space-y-1 text-sm">
                {fs.items.map((i, k) => (
                  <li key={k} className="flex gap-2">
                    <Badge tone={i.signal === 'risk' ? 'risk' : i.signal === 'check' ? 'warn' : 'ok'}>{SIGNAL_LABEL[i.signal]}</Badge>
                    {i.text}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted">{e.foreign ? VISA_GUIDE[e.foreign.visa] : ''}</p>
              {e.foreign && e.foreign.visa !== 'D-2' && e.foreign.visa !== 'D-4' && !e.foreign.checkedAt && (
                <Button size="sm" className="mt-2" onClick={() => update((d) => { d.employees.find((x) => x.id === e.id)!.foreign!.checkedAt = base; })}>
                  체류자격·근무처 확인함 ({fmtDate(base)})
                </Button>
              )}
            </Card>
          )}
          {!inConfirmedPayroll && !e.resignDate && (
            <Card title="잘못 등록했나요?">
              <p className="text-sm text-muted">확정한 급여가 없는 직원만 지울 수 있어요. 지우면 이 직원의 근로조건·일정·서류 상태도 함께 사라져요.</p>
              <Button variant="danger" size="sm" className="mt-2" onClick={() => setConfirmDelete(true)}>
                등록 취소
              </Button>
            </Card>
          )}
        </div>
      )}

      {tab === 'conditions' && (
        <Card title="근로조건 이력" right={<Button size="sm" variant="primary" onClick={openChange} reason={e.resignDate ? '퇴사한 직원이에요' : undefined}>조건 변경</Button>}>
          <p className="mb-3 text-sm text-muted">시급·근무 시간이 바뀌면 적용일과 함께 이력으로 남겨요. 지난 급여·계약서·연차 계산은 바뀌지 않아요.</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="py-2">적용 기간</th>
                  <th>시급</th>
                  <th>근무</th>
                  <th>사유</th>
                  <th>직원 확인</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {hist.map((c) => {
                  const ack = e.conditionAcks.filter((a) => a.conditionId === c.id).slice(-1)[0];
                  return (
                    <tr key={c.id} className={c.effectiveFrom > base ? 'bg-info-soft/40' : ''}>
                      <td className="py-2 align-top">
                        {fmtDate(c.effectiveFrom)} ~ {c.effectiveTo ? fmtDate(c.effectiveTo) : '현재'}
                        {c.effectiveFrom > base && <Badge tone="info" className="ml-1">예정</Badge>}
                      </td>
                      <td className="num align-top">{c.hourlyWage.toLocaleString('ko-KR')}원</td>
                      <td className="align-top text-xs">
                        {schedText(c)}
                        <br />
                        <span className="text-muted">주 {weeklyHours(c).toFixed(1)}h · 주휴일 {WEEKDAY_KO[c.weeklyHolidayDay]}{c.breakWaiverRequested ? ' · 4시간 근무 휴게 생략 요청 기록' : ''}</span>
                      </td>
                      <td className="align-top text-xs">{c.reason}</td>
                      <td className="align-top text-xs">{ack ? (ack.status === 'confirmed' ? <Badge tone="ok">확인함</Badge> : <Badge tone="warn">다른 점 있음</Badge>) : e.account === 'joined' ? <Badge tone="muted">확인 전</Badge> : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted">직원 확인은 근로계약서 교부를 대신하지 않아요. 조건이 바뀌면 서류 화면에 변경 계약서 할 일이 생겨요.</p>
        </Card>
      )}

      {tab === 'insurance' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="4대보험 판정" right={<LinkButton size="sm" to={`/owner/insurance?emp=${e.id}`}>보험 화면에서 처리</LinkButton>}>
            <ul className="space-y-2 text-sm">
              {ins.judgments.map((j) => (
                <li key={j.kind}>
                  <span className="font-semibold">{INSURANCE_LABEL[j.kind]}</span> <Badge tone={j.verdict === 'expected' ? 'brand' : j.verdict === 'excluded' ? 'muted' : 'warn'}>{VERDICT_LABEL[j.verdict]}</Badge>
                  <p className="text-xs text-muted">{j.reasons.join(' · ')}</p>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="퇴직금 (예상)" right="참고용 · 퇴직소득세 제외">
            {sev.applicable === 'e9' ? (
              <Notice tone="info">{sev.notes[0]}</Notice>
            ) : (
              <>
                <KV k="1년 되는 날" v={fmtDate(sev.oneYearDate)} />
                <KV k="재직일수" v={`${sev.serviceDays}일`} />
                <KV k="지금 퇴사하면" v={sev.eligible && sev.applicable !== 'no' ? <Money value={sev.amount} className="font-bold" /> : <span className="text-muted">{sev.reason || '대상 아님'}</span>} />
                <KV k={`3개월 임금 (${sev.days3m}일)`} v={<Money value={sev.wage3m} />} />
                <KV k="1일 평균임금 / 통상임금" v={`${sev.averageDaily.toLocaleString('ko-KR')} / ${sev.ordinaryDaily.toLocaleString('ko-KR')}원`} />
                <KV k="이번 달 쌓이는 예상 금액" v={<Money value={sev.monthlyAccrual} />} />
                <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-muted">
                  {sev.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Field label="연간 상여 (선택)" htmlFor="sv-b">
                    <input id="sv-b" type="number" className={inputCls} value={e.bonusAnnual || ''} onChange={(ev) => update((d) => { d.employees.find((x) => x.id === e.id)!.bonusAnnual = Number(ev.target.value) || 0; })} />
                  </Field>
                  <Field label="연간 연차수당 (선택)" htmlFor="sv-l">
                    <input id="sv-l" type="number" className={inputCls} value={e.leaveAllowanceAnnual || ''} onChange={(ev) => update((d) => { d.employees.find((x) => x.id === e.id)!.leaveAllowanceAnnual = Number(ev.target.value) || 0; })} />
                  </Field>
                </div>
                <div className="mt-2">
                  <Basis ids={['severance.basic']} date={base} />
                </div>
              </>
            )}
          </Card>
        </div>
      )}

      {tab === 'leave' && !under5 && (
        <Card title="연차" right={<LinkButton size="sm" to="/owner/work?tab=leave">신청·승인</LinkButton>}>
          {!leave.applicable ? (
            <p className="text-sm text-muted">{leave.reason}</p>
          ) : (
            <>
              <KV k="현재 연차 기간" v={`${fmtDate(leave.currentYearStart)} ~ ${fmtDate(leave.currentYearEnd)}`} />
              <KV k="발생" v={leave.partTime ? `${leave.totalDays}일 → 단시간 ${leave.totalHours}시간` : `${leave.totalDays}일`} />
              <KV k="사용" v={leave.partTime ? `${leave.usedHours}시간` : `${leave.usedDays}일`} />
              <KV k="남음" v={<b>{leave.partTime ? `${leave.remainingHours}시간` : `${leave.remainingDays}일`}</b>} />
              {leave.promotion && <KV k="사용 촉진" v={`${fmtDate(leave.promotion.notifyFrom)}~${fmtDate(leave.promotion.notifyTo)} 서면 촉구 · ${fmtDate(leave.promotion.designateBy)}까지 지정`} />}
              <p className="mt-2 text-xs text-muted">출근율 80% 이상을 가정했어요. 1년 미만은 개근한 달마다 1일(결근 기록이 있는 달 제외).</p>
              <Basis ids={['annualLeave.accrual', 'annualLeave.partTime', 'annualLeave.promotion']} date={base} />
            </>
          )}
        </Card>
      )}

      {tab === 'app' && (
        <Card title="직원 앱">
          <KV k="상태" v={e.account === 'joined' ? <Badge tone="ok">가입함</Badge> : e.account === 'invited' ? <Badge tone="info">초대함</Badge> : e.account === 'blocked' ? <Badge tone="muted">로그인 차단 (퇴사)</Badge> : <Badge tone="muted">미가입</Badge>} />
          <p className="mt-2 text-sm text-muted">직원이 가입하지 않아도 사장님은 모든 기능을 쓸 수 있어요. 직원 앱은 출퇴근·내 일정·대타·연차(5명 이상)·임금명세서 수령 확인만 있어요.</p>
          {e.account !== 'joined' && e.account !== 'blocked' && (
            <div className="mt-3 space-y-2">
              <Button variant="primary" onClick={makeInvite}>
                {e.invite ? '초대 링크 다시 만들기' : '초대 링크 만들기'}
              </Button>
              {e.invite && (
                <div className="rounded-xl border border-line p-3 text-sm">
                  <p className="break-all font-mono text-xs">{inviteUrl}</p>
                  <p className="mt-1 text-xs text-muted">{fmtDate(e.invite.expiresAt)}까지 · 일회용 · 연락처 대신 사장님이 직접 보내요 (카톡·문자 공유 연동은 연결 대기)</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" onClick={async () => toast((await copyText(`[${state.workplace?.name || '가게'}] 근무 관리 앱 초대 링크예요: ${inviteUrl}`)) ? '초대 문구를 복사했어요' : '복사하지 못했어요 — 직접 선택해 복사하세요', 'info')}>
                      초대 문구 복사
                    </Button>
                    <Button size="sm" onClick={() => { setSession({ role: 'employee', employeeId: e.id }); nav('/employee/join'); }}>
                      데모: 직원으로 링크 열기
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
          <p className="mt-3 text-xs text-muted">직원 확인은 근로계약서 교부를 대신하지 않아요.</p>
        </Card>
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={`${e.alias} 기본 정보 수정`} wide footer={<><Button onClick={() => setEdit(null)}>취소</Button><Button variant="primary" onClick={saveBasic}>저장</Button></>}>
        {edit && <BasicFields f={edit} setF={setEdit} errors={editErr} isFood={state.workplace?.industry === 'food'} editing />}
      </Modal>

      <Modal open={!!change} onClose={() => setChange(null)} title="근로조건 변경 (이력으로 남김)" wide footer={<><Button onClick={() => setChange(null)}>취소</Button><Button variant="primary" onClick={saveChange}>변경 저장</Button></>}>
        {change && (
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="적용 시작일" htmlFor="ch-from">
                <input id="ch-from" type="date" className={inputCls} value={change.from} onChange={(ev) => setChange({ ...change, from: ev.target.value })} />
              </Field>
              <Field label="시급" htmlFor="ch-w">
                <input id="ch-w" type="number" className={inputCls} value={change.wage || ''} onChange={(ev) => setChange({ ...change, wage: Number(ev.target.value) })} />
              </Field>
              <Field label="주휴일" htmlFor="ch-h">
                <select id="ch-h" className={inputCls} value={change.holiday} onChange={(ev) => setChange({ ...change, holiday: Number(ev.target.value) as Weekday })}>
                  {WEEKDAY_KO.map((w, i) => (
                    <option key={w} value={i}>
                      {w}요일
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {(() => {
              const m = isISODate(change.from) ? checkMinimumWage(change.wage, change.from) : null;
              return m?.status === 'below' ? <Notice tone="risk" title={`적용일 기준 최저임금 ${m.required?.toLocaleString('ko-KR')}원 미달`} /> : null;
            })()}
            {state.payrolls.some((p) => p.status === 'confirmed' && p.confirmedLines?.some((l) => l.employeeId === e.id && l.period.to >= change.from)) && (
              <Notice tone="warn">적용일이 이미 확정한 급여 기간에 걸쳐요. 확정분은 바뀌지 않으니 필요하면 급여 화면에서 수정 이력으로 조정하세요.</Notice>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={change.variable} onChange={(ev) => setChange({ ...change, variable: ev.target.checked })} /> 매주 달라요
            </label>
            {change.variable ? (
              <Field label="주 평균 예상 시간" htmlFor="ch-vh">
                <input id="ch-vh" type="number" className={inputCls} value={change.varHours} onChange={(ev) => setChange({ ...change, varHours: ev.target.value })} />
              </Field>
            ) : (
              <>
                <ScheduleEditor value={change.sched} onChange={(s) => setChange({ ...change, sched: s })} idPrefix="ch" />
                <p className="text-sm">
                  주 {(change.sched.reduce((s, d) => s + (d ? netMinutes(d) : 0), 0) / 60).toFixed(1)}시간
                </p>
              </>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={change.waiver} onChange={(ev) => setChange({ ...change, waiver: ev.target.checked })} /> 4시간 근무 휴게 생략을 직원이 명시적으로 요청함 (2026.12.10부터 적용)
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="하는 일" htmlFor="ch-job">
                <input id="ch-job" className={inputCls} value={change.job} onChange={(ev) => setChange({ ...change, job: ev.target.value })} />
              </Field>
              <Field label="식대 (월)" htmlFor="ch-meal">
                <input id="ch-meal" type="number" className={inputCls} value={change.meal} onChange={(ev) => setChange({ ...change, meal: ev.target.value })} />
              </Field>
            </div>
            <Field label="변경 사유 (필수)" htmlFor="ch-r">
              <input id="ch-r" className={inputCls} value={change.reason} onChange={(ev) => setChange({ ...change, reason: ev.target.value })} placeholder="예: 시급 인상, 최저임금 전환, 근무 요일 변경" />
            </Field>
            {changeErr && (
              <p role="alert" className="text-sm font-semibold text-risk">
                {changeErr}
              </p>
            )}
          </div>
        )}
      </Modal>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title={`${e.alias} 등록 취소`} footer={<><Button onClick={() => setConfirmDelete(false)}>닫기</Button><Button variant="danger" onClick={() => { update((d) => { d.employees = d.employees.filter((x) => x.id !== e.id); d.conditions = d.conditions.filter((x) => x.employeeId !== e.id); d.overrides = d.overrides.filter((x) => x.employeeId !== e.id); d.attendance = d.attendance.filter((x) => x.employeeId !== e.id); d.docRecords = d.docRecords.filter((x) => x.employeeId !== e.id); d.docRequests = d.docRequests.filter((x) => x.employeeId !== e.id); d.insuranceReports = d.insuranceReports.filter((x) => x.employeeId !== e.id); d.leaveRequests = d.leaveRequests.filter((x) => x.employeeId !== e.id); }); toast('등록을 취소했어요'); nav('/owner/employees'); }}>지우기</Button></>}>
        <p className="text-sm">이 브라우저에 저장된 {e.alias}의 기록을 지워요. 되돌릴 수 없어요.</p>
      </Modal>
      <p className="mt-6 text-sm">
        <Link to="/owner/employees" className="text-muted underline">
          ← 직원 목록
        </Link>
      </p>
    </div>
  );
}
