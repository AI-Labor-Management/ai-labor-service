// 임금명세서 (근로기준법 시행령 제27조의2: 근로자 특정 정보, 지급일, 총액, 구성항목별 금액, 계산방법, 공제내역)
// 이름은 출력 직전 브라우저에서만 입력하고 저장하지 않는다.
import { useState } from 'react';
import type { PayrollLine } from '../domain/types';
import { fmtDate } from '../domain/dates';
import { cx, inputCls } from './kit';

const EN: Record<string, string> = {
  기본급: 'Base pay',
  주휴수당: 'Weekly holiday allowance',
  '연장·야간·휴일 가산': 'Overtime/night/holiday premium',
  '연장 가산': 'Overtime premium',
  '야간 가산': 'Night premium',
  '휴일 가산': 'Holiday work premium',
  '단시간 초과근로 가산': 'Part-time excess premium',
  '공휴일 유급': 'Paid public holiday',
  '연차 사용일 유급': 'Paid annual leave',
  식대: 'Meal allowance',
  국민연금: 'National pension',
  건강보험: 'Health insurance',
  장기요양: 'Long-term care',
  고용보험: 'Employment insurance',
  소득세: 'Income tax',
  '소득세 (일용)': 'Income tax (daily)',
  지방소득세: 'Local income tax',
};

export function StatementView({ line, workplaceName, month, en = false, nameInput = true, revision }: { line: PayrollLine; workplaceName: string; month: string; en?: boolean; nameInput?: boolean; revision?: number }) {
  const [name, setName] = useState('');
  const t = (ko: string) => (en ? `${EN[ko] ?? ko}${EN[ko] ? ` (${ko})` : ''}` : ko);
  return (
    <div className="print-area rounded-2xl border border-line bg-white p-5 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-lg font-bold">{en ? 'Wage Statement (임금명세서)' : '임금명세서'}</p>
          <p className="text-muted">
            {workplaceName} · {month.replace('-', '.')}월분 · {en ? 'Pay date' : '지급일'} {fmtDate(line.payDate)}
            {revision && revision > 1 ? ` · 수정 ${revision}차` : ''}
          </p>
        </div>
        <div className="text-right text-xs text-muted">
          {en ? 'Period' : '산정 기간'} {fmtDate(line.period.from)} ~ {fmtDate(line.period.to)}
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg bg-canvas px-3 py-2">
          <span className="text-xs text-muted">{en ? 'Employee' : '근로자'}</span>
          <p className="font-semibold">
            {line.alias}
            {name && ` · ${name}`}
          </p>
        </div>
        {nameInput && (
          <label className="no-print flex flex-col gap-1 text-xs text-muted">
            출력용 이름 (선택 · 이 화면에서만, 저장 안 함)
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="출력할 때만 입력" />
          </label>
        )}
      </div>
      <table className="mt-4 w-full">
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            <th className="py-1">{en ? 'Item' : '항목'}</th>
            <th>{en ? 'Calculation' : '계산 방법'}</th>
            <th className="text-right">{en ? 'Amount' : '금액'}</th>
          </tr>
        </thead>
        <tbody>
          {line.items.map((i, k) => (
            <tr key={k} className="border-b border-line/60 align-top">
              <td className="py-1.5 pr-2 font-medium">{t(i.label)}</td>
              <td className="py-1.5 pr-2 text-xs text-muted">
                {i.formula}
                {i.note && <span className="block">{i.note}</span>}
              </td>
              <td className="num py-1.5 text-right">{i.amount.toLocaleString('ko-KR')}</td>
            </tr>
          ))}
          <tr className="font-bold">
            <td className="py-2" colSpan={2}>
              {en ? 'Gross pay (지급액)' : '지급액'}
            </td>
            <td className="num py-2 text-right">{line.gross.toLocaleString('ko-KR')}</td>
          </tr>
          {line.deductions.map((d) => (
            <tr key={d.code} className="border-b border-line/60 text-muted">
              <td className="py-1">− {t(d.label)}</td>
              <td className="py-1 text-xs">{d.note}</td>
              <td className={cx('num py-1 text-right', d.amount === null && 'text-warn')}>{d.amount === null ? '미정' : d.amount.toLocaleString('ko-KR')}</td>
            </tr>
          ))}
          <tr className="text-base font-bold">
            <td className="py-2" colSpan={2}>
              {en ? 'Net pay (실수령액)' : '실수령액'}
              {!line.netComplete && <span className="ml-1 text-xs font-normal text-warn">(미정 공제 제외)</span>}
            </td>
            <td className="num py-2 text-right">{line.net.toLocaleString('ko-KR')}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted">
        {en ? 'Confirmed hours' : '확정 근무'} {line.hours.worked.toFixed(1)}h · {en ? 'Hourly wage' : '시급'} {line.wageText}
        {line.hours.paidLeave ? ` · 연차 ${line.hours.paidLeave}h` : ''}
        {line.hours.paidPublicHoliday ? ` · 공휴일 ${line.hours.paidPublicHoliday}h` : ''}
      </p>
      {en && <p className="mt-1 text-xs text-muted">If the interpretation differs, the Korean version prevails (효력 확인 전 · 노무사 확인 C14).</p>}
      <p className="mt-1 text-xs text-muted">참고용 계산이에요. 보험료는 고지서 금액이 있으면 그 값을, 없으면 예상 금액을 썼어요.</p>
    </div>
  );
}
