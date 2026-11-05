// S02 채용 전 점검 — 저장하지 않고 브라우저에서 계산, [이 조건으로 직원 등록]으로 이어짐
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useStore } from '../../state/store';
import { quickWage } from '../../domain/wage';
import { judgeInsurance, premiums, premiumTotals, VERDICT_LABEL, INSURANCE_LABEL } from '../../domain/insurance';
import { CHECKLIST_ITEMS } from '../../data/checklistItems';
import { addDays, addMonths } from '../../domain/dates';
import type { AgeBand, ScaleBand } from '../../domain/types';
import ScheduleEditor, { scheduleErrors, type Sched } from '../../ui/ScheduleEditor';
import { Badge, Basis, Button, Card, Choice, Field, inputCls, KV, Money, Notice, PageHeader } from '../../ui/kit';
import { AGE_LABEL, SCALE_LABEL } from '../../ui/labels';

export default function Precheck() {
  const { state, base } = useStore();
  const nav = useNavigate();
  const wp = state.workplace!;
  const [wage, setWage] = useState(10320);
  const [sched, setSched] = useState<Sched>([{ start: '10:00', end: '15:00', breakMin: 30 }, { start: '10:00', end: '15:00', breakMin: 30 }, null, { start: '10:00', end: '15:00', breakMin: 30 }, { start: '10:00', end: '15:00', breakMin: 30 }, null, null]);
  const [term, setTerm] = useState<'lt1m' | 'ge1m' | 'none'>('none');
  const [age, setAge] = useState<AgeBand>('18-59');
  const [foreign, setForeign] = useState(false);
  const [scale, setScale] = useState<ScaleBand>(wp.scale);
  const [date, setDate] = useState(base);
  const errs = scheduleErrors(sched);
  const valid = wage > 0 && !errs.length;

  const r = useMemo(() => (valid ? quickWage({ hourlyWage: wage, schedule: sched, scale, date }) : null), [valid, wage, sched, scale, date]);
  const ins = useMemo(() => {
    if (!r) return null;
    const j = judgeInsurance({ ageBand: age, startedBefore65: null, employmentType: term === 'none' ? 'regular' : 'fixed', hireDate: date, contractEnd: term === 'none' ? null : term === 'lt1m' ? addDays(date, 20) : addMonths(date, 6), isForeign: foreign, visa: null, nationality: '', weeklyHours: r.weeklyHours, variable: false }, date);
    const rows = premiums(r.monthlyPay, date, j, wp.industry, age, null);
    return { j, rows, totals: premiumTotals(rows) };
  }, [r, age, term, foreign, date, wp.industry]);

  const docs = CHECKLIST_ITEMS.filter((i) => {
    if (i.id === 'E1' || i.id === 'E3' || i.id === 'M1' || i.id === 'M2') return true;
    if (i.id === 'E4') return age === 'under18';
    if (i.id === 'E5') return wp.industry === 'food';
    if (i.id === 'F1') return foreign;
    return false;
  });

  return (
    <div className="max-w-5xl">
      <PageHeader title="채용 전 점검" sub="입력값은 저장하지 않고 이 화면에서만 계산해요. 참고용 예상 금액이에요." />
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card title="조건">
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="시급 (원)" htmlFor="pc-w" error={wage > 0 ? null : '시급을 입력하세요'}>
                <input id="pc-w" type="number" inputMode="numeric" className={inputCls} value={wage || ''} onChange={(e) => setWage(Number(e.target.value))} />
              </Field>
              <Field label="기준일" htmlFor="pc-d" hint="최저임금·요율을 고르는 날짜">
                <input id="pc-d" type="date" className={inputCls} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
              </Field>
            </div>
            <Field label="요일별 근무 시간">
              <ScheduleEditor value={sched} onChange={setSched} idPrefix="pc" />
            </Field>
            {errs.map((e) => (
              <p key={e} className="text-xs font-semibold text-risk" role="alert">
                {e}
              </p>
            ))}
            <Field label="계약 기간" hint="건강·연금 판정에 필요해요">
              <Choice name="계약 기간" options={[{ value: 'lt1m', label: '1개월 미만' }, { value: 'ge1m', label: '1개월 이상' }, { value: 'none', label: '정하지 않음' }]} value={term} onChange={setTerm} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="나이대" htmlFor="pc-age">
                <select id="pc-age" className={inputCls} value={age} onChange={(e) => setAge(e.target.value as AgeBand)}>
                  {Object.entries(AGE_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="규모 구간" htmlFor="pc-scale">
                <select id="pc-scale" className={inputCls} value={scale} onChange={(e) => setScale(e.target.value as ScaleBand)}>
                  {Object.entries(SCALE_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={foreign} onChange={(e) => setForeign(e.target.checked)} /> 외국인·유학생
            </label>
          </div>
        </Card>
        <div className="grid content-start gap-4">
          {!r && <Notice tone="info">조건을 바르게 입력하면 결과가 나와요.</Notice>}
          {r && (
            <Card title="임금" right={`기준일 ${date}`}>
              {r.minWage.status === 'below' && <Notice tone="risk" title={`최저임금 미달 — ${r.minWage.required?.toLocaleString('ko-KR')}원 이상이어야 해요`} className="mb-3" />}
              {r.minWage.status === 'noRule' && <Notice tone="warn" title="이 날짜의 최저임금 기준이 규칙 파일에 없어요" className="mb-3" />}
              <KV k="주 소정근로시간" v={`${r.weeklyHours.toFixed(1)}시간`} />
              <KV k="최저임금 판정" v={r.minWage.status === 'ok' ? <Badge tone="ok">충족</Badge> : r.minWage.status === 'below' ? <Badge tone="risk">미달</Badge> : <Badge tone="warn">기준 없음</Badge>} />
              <KV k="주휴수당 (1주)" v={r.weeklyHolidayHours ? <><Money value={r.weeklyHolidayPay} /> <span className="text-xs text-muted">({r.weeklyHolidayHours.toFixed(1)}h)</span></> : '주 15시간 미만 — 없음'} />
              <KV k="연장·야간 가산 (1주)" v={scale === '1-4' ? <span className="text-sm">1~4명 미적용 <span className="text-xs text-muted">(5명 이상이면 {r.weeklyPremiumIf5.toLocaleString('ko-KR')}원)</span></span> : <Money value={r.weeklyPremium} />} />
              <KV k="월 환산 시간" v={`${r.monthlyHours}시간`} />
              <KV k="예상 월 급여" v={<Money value={r.monthlyPay} className="font-bold" />} />
              {r.breakIssues.map((b) => (
                <p key={b} className="mt-1 text-xs font-semibold text-risk">
                  휴게 부족: {b}
                </p>
              ))}
              <div className="mt-2">
                <Basis ids={['minimumWage.hourly', 'weeklyHoliday.paidHours', 'scope.under5.appliedArticles', 'break.minimum']} date={date} />
              </div>
            </Card>
          )}
          {ins && r && (
            <Card title="4대보험 예상" right="예상 금액 · 참고용">
              <ul className="space-y-1 text-sm">
                {ins.rows.map((row) => (
                  <li key={row.kind} className="flex items-center justify-between gap-2">
                    <span>
                      {INSURANCE_LABEL[row.kind]} <Badge tone={row.verdict === 'expected' ? 'brand' : row.verdict === 'excluded' ? 'muted' : 'warn'}>{VERDICT_LABEL[row.verdict]}</Badge>
                    </span>
                    <span className="num text-xs">
                      사장님 <Money value={row.employer} />
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 border-t border-line pt-2">
                <KV k="사장님 부담 합계" v={ins.totals.employer === null ? <span className="text-warn">일부 금액은 기준 없음</span> : <Money value={ins.totals.employer} />} />
                <KV k="예상 월 인건비" v={ins.totals.employer === null ? '—' : <Money value={r.monthlyPay + ins.totals.employer} className="font-bold" />} />
              </div>
            </Card>
          )}
          <Card title="필요한 서류">
            <ul className="space-y-1 text-sm">
              {docs.map((d) => (
                <li key={d.id}>
                  · {d.title} <span className="text-xs text-muted">({d.basis})</span>
                </li>
              ))}
            </ul>
          </Card>
          <Button
            variant="primary"
            size="lg"
            reason={!valid ? '조건을 먼저 바르게 입력하세요' : undefined}
            onClick={() => nav('/owner/employees/new', { state: { prefill: { hourlyWage: wage, schedule: sched, ageBand: age, isForeign: foreign, employmentType: term === 'none' ? 'regular' : 'fixed' } } })}
          >
            이 조건으로 직원 등록
          </Button>
        </div>
      </div>
    </div>
  );
}
