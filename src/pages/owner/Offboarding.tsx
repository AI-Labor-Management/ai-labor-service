// S14 퇴사 처리 마법사: ① 퇴사일·유형 → ② 마지막 급여 → ③ 퇴직금 → ④ 4대보험 상실 → ⑤ 서류 → ⑥ 정리(빈 근무 → 대타·채용)
import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useStore, nowIso } from '../../state/store';
import { addDays, addYears, diffDays, fmtDate, fmtMDW, isISODate, listDates, monthOf, weekday } from '../../domain/dates';
import { computePayrollLine } from '../../domain/wage';
import { payrollPeriodFor } from '../../domain/payroll';
import { estimateSeverance } from '../../domain/severance';
import { leaveAccrual } from '../../domain/leave';
import { lossDate, reportDeadlines } from '../../domain/insurance';
import { conditionAt, dailyScheduledHours, isUnder5 } from '../../domain/work';
import { resolveRule } from '../../domain/rules';
import type { ResignType } from '../../domain/types';
import { Badge, Basis, Button, Card, Choice, Empty, Field, inputCls, KV, LinkButton, Money, Notice, PageHeader, useToast } from '../../ui/kit';
import { INSURANCE_METHOD_LABEL, RESIGN_LABEL } from '../../ui/labels';

const STEPS = ['date', 'pay', 'severance', 'insurance', 'docs', 'wrap'] as const;
const STEP_LABEL: Record<(typeof STEPS)[number], string> = { date: '① 퇴사일·유형', pay: '② 마지막 급여', severance: '③ 퇴직금', insurance: '④ 4대보험 상실', docs: '⑤ 서류', wrap: '⑥ 정리' };

export default function Offboarding() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { state, update, base } = useStore();
  const nav = useNavigate();
  const toast = useToast();
  const e = state.employees.find((x) => x.id === id);
  const [date, setDate] = useState(e?.resignDate ?? params.get('date') ?? base);
  const [type, setType] = useState<ResignType>((e?.resignType ?? (params.get('type') as ResignType)) || 'self');
  const [noticeDate, setNoticeDate] = useState(base);
  if (!e) return <Empty title="직원을 찾을 수 없어요" />;
  const prog = state.offboarding.find((o) => o.employeeId === e.id);
  const saved = !!e.resignDate;
  const under5 = isUnder5(state.workplace?.scale);
  const c = conditionAt(state.conditions, e.id, saved ? e.resignDate! : base);
  const ordinaryDaily = Math.round((c?.hourlyWage ?? 0) * dailyScheduledHours(c));
  const dn = resolveRule<{ daysBefore: number; payInLieuDays: number; exemptUnderMonths: number }>('dismissal.notice', date);
  const months = diffDays(e.hireDate, date) / 30.4;
  const noticeDays = isISODate(noticeDate) ? diffDays(noticeDate, date) : 0;

  const mark = (step: string, v: boolean) =>
    update((d) => {
      let p = d.offboarding.find((o) => o.employeeId === e.id);
      if (!p) {
        p = { employeeId: e.id, steps: {}, startedAt: nowIso(), completedAt: null };
        d.offboarding.push(p);
      }
      p.steps[step] = v;
      p.completedAt = STEPS.every((s) => p!.steps[s]) ? nowIso() : null;
    });

  const saveDate = () => {
    if (!isISODate(date)) return toast('퇴사일을 입력하세요', 'warn');
    if (date < e.hireDate) return toast('입사일보다 이른 날짜예요', 'warn');
    update((d) => {
      const t = d.employees.find((x) => x.id === e.id)!;
      t.resignDate = date;
      t.resignType = type;
    });
    mark('date', true);
    toast('퇴사일을 저장했어요. 퇴직금 지급·보험 상실·서류 보관 기한이 생겼어요.');
  };

  const payMonth = monthOf(date);
  const per = state.workplace ? payrollPeriodFor(state.workplace, payMonth) : null;
  const last = saved && per ? computePayrollLine({ state, employee: e, from: per.from, to: per.to, payDate: per.payDate, scale: state.workplace!.scale }) : null;
  const sev = saved ? estimateSeverance(state, e, e.resignDate!) : null;
  const leave = !under5 && saved ? leaveAccrual(state, e, e.resignDate!) : null;
  const ins = saved ? reportDeadlines(lossDate(e.resignDate!), lossDate(e.resignDate!)) : null;
  // 빈 근무: 퇴사일 다음 날부터 4주 안에 원래 근무하던 요일
  const empty = saved && c && !c.variable ? listDates(addDays(e.resignDate!, 1), addDays(e.resignDate!, 28)).filter((d) => !!c.schedule[weekday(d)]) : [];

  const Step = ({ k, children }: { k: (typeof STEPS)[number]; children: React.ReactNode }) => (
    <Card
      title={
        <span className="flex items-center gap-2">
          {STEP_LABEL[k]} {prog?.steps[k] && <Badge tone="ok">완료</Badge>}
        </span>
      }
      right={k !== 'date' && <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={!!prog?.steps[k]} disabled={!saved} onChange={(ev) => mark(k, ev.target.checked)} /> 완료 표시</label>}
    >
      {children}
    </Card>
  );

  return (
    <div className="max-w-3xl">
      <PageHeader title={`${e.alias} 퇴사 처리`} sub="흩어진 퇴사 할 일을 한 흐름으로 처리해요. 정당성은 판단하지 않아요." actions={prog?.completedAt ? <Badge tone="ok">모든 단계 완료</Badge> : undefined} />
      <div className="grid gap-4">
        <Step k="date">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="퇴사일 (마지막 근무일)" htmlFor="ob-d">
              <input id="ob-d" type="date" className={inputCls} value={date} onChange={(ev) => setDate(ev.target.value)} />
            </Field>
            <Field label="유형">
              <Choice<ResignType> name="퇴사 유형" options={(Object.keys(RESIGN_LABEL) as ResignType[]).map((v) => ({ value: v, label: RESIGN_LABEL[v] }))} value={type} onChange={setType} />
            </Field>
          </div>
          {type === 'dismissal' && (
            <div className="mt-3 grid gap-3">
              <Notice tone="risk" title="사장님이 내보내는 경우 — 해고 예고와 서면 통지를 확인하세요">
                30일 전에 알리거나 30일분 통상임금을 줘야 해요 (1~4명 포함, 계속 근로 3개월 미만은 예외). {under5 ? '' : '5명 이상은 해고 사유와 시기를 서면으로 알려야 하고, 부당해고 다툼이 생길 수 있어요.'}
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <Field label="알린 날 (예고일)" htmlFor="ob-n">
                    <input id="ob-n" type="date" className={inputCls} value={noticeDate} onChange={(ev) => setNoticeDate(ev.target.value)} />
                  </Field>
                  <div className="text-sm">
                    예고 기간 <b>{noticeDays}일</b>
                    {dn.ok && months < dn.value.exemptUnderMonths ? (
                      <p className="text-xs">계속 근로 {dn.value.exemptUnderMonths}개월 미만 — 예고 예외 대상일 수 있어요 (확인 필요)</p>
                    ) : noticeDays < (dn.ok ? dn.value.daysBefore : 30) ? (
                      <p className="text-xs">30일 미만 → 해고예고수당 약 <Money value={ordinaryDaily * (dn.ok ? dn.value.payInLieuDays : 30)} /> (1일 통상임금 {ordinaryDaily.toLocaleString('ko-KR')}원 × 30)</p>
                    ) : (
                      <p className="text-xs">30일 이상 예고</p>
                    )}
                  </div>
                </div>
              </Notice>
              <LinkButton to="/owner/consult?topic=해고·징계" variant="primary" size="lg">
                노무 전문가와 확인하기
              </LinkButton>
            </div>
          )}
          <div className="mt-3 flex items-center gap-2">
            <Button variant="primary" onClick={saveDate}>
              {saved ? '퇴사일 수정' : '퇴사일 저장'}
            </Button>
            {saved && <span className="text-sm text-muted">저장됨: {fmtDate(e.resignDate)} · {e.resignType ? RESIGN_LABEL[e.resignType] : ''}</span>}
          </div>
          <div className="mt-2">
            <Basis ids={['dismissal.notice']} date={date} />
          </div>
        </Step>
        {!saved ? (
          <Notice tone="muted">퇴사일을 저장하면 다음 단계가 열려요.</Notice>
        ) : (
          <>
            <Step k="pay">
              {last && (
                <>
                  <KV k={`${payMonth.replace('-', '.')}월분 (~${fmtDate(e.resignDate)})`} v={<Money value={last.gross} className="font-bold" />} />
                  <KV k="지급 기한" v={`퇴사 후 14일 (${fmtDate(addDays(e.resignDate!, 14))}) — 합의하면 연장 가능`} />
                  {last.warnings.map((w, i) => (
                    <p key={i} className="text-xs text-warn">
                      · {w.text}
                    </p>
                  ))}
                  {leave?.applicable && (
                    <KV k="남은 연차 수당 (5명 이상)" v={<span>{leave.partTime ? `${leave.remainingHours}시간` : `${leave.remainingDays}일`} × 통상임금 ≈ <Money value={leave.partTime ? (leave.remainingHours ?? 0) * (c?.hourlyWage ?? 0) : leave.remainingDays * ordinaryDaily} /></span>} />
                  )}
                  <LinkButton size="sm" className="mt-2" to={`/owner/payroll?month=${payMonth}`}>
                    급여 화면에서 확정
                  </LinkButton>
                </>
              )}
            </Step>
            <Step k="severance">
              {sev?.applicable === 'e9' ? (
                <Notice tone="info">{sev.notes[0]}</Notice>
              ) : sev ? (
                <>
                  <KV k="재직일수" v={`${sev.serviceDays}일`} />
                  <KV k="퇴직금" v={sev.eligible && sev.applicable !== 'no' ? <Money value={sev.amount} className="font-bold" /> : <span className="text-muted">{sev.reason || '대상 아님'}</span>} />
                  <KV k="계산" v={`1일 ${sev.used === 'ordinary' ? '통상' : '평균'}임금 ${Math.floor(sev.usedDaily).toLocaleString('ko-KR')}원 × 30 × ${sev.serviceDays}/365`} />
                  <KV k="지급 기한" v={sev.paymentDue ? fmtDate(sev.paymentDue) : '—'} />
                  <ul className="mt-1 list-disc pl-4 text-xs text-muted">
                    {sev.notes.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                </>
              ) : null}
            </Step>
            <Step k="insurance">
              <KV k="처리 방식" v={INSURANCE_METHOD_LABEL[e.insuranceMethod]} />
              {ins && <KV k="상실 신고 기한" v={`건강 ${fmtDate(ins.health)} · 연금·고용·산재 ${fmtDate(ins.others)} (상실일 ${fmtDate(lossDate(e.resignDate!))})`} />}
              <LinkButton size="sm" className="mt-2" to={`/owner/insurance?emp=${e.id}`}>
                보험 화면에서 신고 기록
              </LinkButton>
            </Step>
            <Step k="docs">
              <ul className="list-disc space-y-1 pl-5 text-sm">
                <li>사용증명서: 퇴직 후 직원이 요구하면 즉시, 요구한 사항만 (근로기준법 제39조)</li>
                <li>서류 3년 보관 종료일: {fmtDate(addYears(e.resignDate!, 3))} — 기한 화면에 등록됐어요</li>
                {e.isForeign && <li>외국인 고용 변동 신고 — 대상·기한 원문 확인 전 (출입국관리법)</li>}
                <li>고용보험 이직확인서 포함 여부는 개발 중 결정 예정이에요</li>
              </ul>
            </Step>
            <Step k="wrap">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span>직원 앱 로그인:</span>
                {e.account === 'blocked' ? (
                  <Badge tone="muted">차단됨</Badge>
                ) : (
                  <Button size="sm" onClick={() => { update((d) => { d.employees.find((x) => x.id === e.id)!.account = 'blocked'; }); toast('로그인을 막았어요. 기록은 3년 보관 기한까지 남아요.'); }} reason={e.account === 'none' ? '가입하지 않은 직원이에요' : undefined}>
                    로그인 차단
                  </Button>
                )}
              </div>
              <div className="mt-3">
                <p className="text-sm font-semibold">빈 근무 {empty.length}개 (퇴사 후 4주)</p>
                <p className="text-xs text-muted">{empty.slice(0, 8).map(fmtMDW).join(' · ')}{empty.length > 8 ? ' …' : ''}</p>
                <div className="mt-2 flex gap-2">
                  <LinkButton size="sm" to="/owner/work">대타 지정</LinkButton>
                  <LinkButton size="sm" to="/owner/precheck">채용 전 점검</LinkButton>
                </div>
              </div>
            </Step>
            <div className="flex justify-end">
              <Button onClick={() => nav(`/owner/employees/${e.id}`)}>직원 상세로</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
