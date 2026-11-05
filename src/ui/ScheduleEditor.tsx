import { WEEKDAY_KO, isHHMM, spanMinutes } from '../domain/dates';
import type { DaySchedule } from '../domain/types';
import { cx, inputCls } from './kit';

export type Sched = (DaySchedule | null)[];

export function scheduleErrors(s: Sched): string[] {
  const errs: string[] = [];
  s.forEach((d, i) => {
    if (!d) return;
    if (!isHHMM(d.start) || !isHHMM(d.end)) errs.push(`${WEEKDAY_KO[i]}요일 시간 형식을 확인하세요 (예: 09:00)`);
    else {
      const { s: a, e } = spanMinutes(d.start, d.end);
      if (!Number.isFinite(d.breakMin) || d.breakMin < 0) errs.push(`${WEEKDAY_KO[i]}요일 휴게시간은 0분 이상이어야 해요`);
      else if (d.breakMin >= e - a) errs.push(`${WEEKDAY_KO[i]}요일 휴게시간이 근무시간보다 길어요`);
    }
  });
  return errs;
}

export default function ScheduleEditor({ value, onChange, idPrefix = 'sch' }: { value: Sched; onChange: (v: Sched) => void; idPrefix?: string }) {
  const set = (i: number, d: DaySchedule | null) => onChange(value.map((x, j) => (j === i ? d : x)));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-sm">
        <thead>
          <tr className="text-left text-xs text-muted">
            <th className="py-1 pr-2 font-medium">요일</th>
            <th className="py-1 pr-2 font-medium">시작</th>
            <th className="py-1 pr-2 font-medium">종료</th>
            <th className="py-1 font-medium">휴게(분)</th>
          </tr>
        </thead>
        <tbody>
          {value.map((d, i) => (
            <tr key={i} className={cx(!d && 'text-muted')}>
              <td className="py-1 pr-2">
                <label className="flex items-center gap-2 font-semibold">
                  <input type="checkbox" checked={!!d} onChange={(e) => set(i, e.target.checked ? { start: '10:00', end: '15:00', breakMin: 30 } : null)} aria-label={`${WEEKDAY_KO[i]}요일 근무`} />
                  {WEEKDAY_KO[i]}
                </label>
              </td>
              <td className="py-1 pr-2">
                <input id={`${idPrefix}-s${i}`} type="time" step={600} disabled={!d} className={inputCls} value={d?.start ?? ''} onChange={(e) => d && set(i, { ...d, start: e.target.value })} aria-label={`${WEEKDAY_KO[i]}요일 시작`} />
              </td>
              <td className="py-1 pr-2">
                <input type="time" step={600} disabled={!d} className={inputCls} value={d?.end ?? ''} onChange={(e) => d && set(i, { ...d, end: e.target.value })} aria-label={`${WEEKDAY_KO[i]}요일 종료`} />
              </td>
              <td className="py-1">
                <input type="number" min={0} step={10} disabled={!d} className={inputCls} value={d?.breakMin ?? ''} onChange={(e) => d && set(i, { ...d, breakMin: Number(e.target.value) })} aria-label={`${WEEKDAY_KO[i]}요일 휴게`} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-xs text-muted">종료가 시작보다 이르면 다음 날로 봐요 (예: 18:00~02:00). 휴게는 근무시간에서 빼고 계산해요.</p>
    </div>
  );
}
