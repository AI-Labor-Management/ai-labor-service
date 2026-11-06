import type { WorkCondition } from '../domain/types';
import { WEEKDAY_EN, WEEKDAY_KO } from '../domain/dates';
export function schedText(c: WorkCondition, en = false): string {
  if (c.variable)
    return en
      ? `Variable (about ${c.variableWeeklyHours}h/week)`
      : `매주 달라요 (주 평균 약 ${c.variableWeeklyHours}시간)`;
  return c.schedule
    .map((d, i) =>
      d
        ? `${(en ? WEEKDAY_EN : WEEKDAY_KO)[i]} ${d.start}-${d.end}${d.breakMin ? (en ? ` (${d.breakMin}m break)` : `(휴${d.breakMin})`) : ''}`
        : null,
    )
    .filter(Boolean)
    .join(' · ');
}
