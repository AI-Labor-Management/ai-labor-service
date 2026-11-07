// 공휴일 내장 목록 — 2026·2027년 월력요항(우주항공청)과 노동절·제헌절 규정 개정에 맞춘 값 (2026-11-07 대조)
import { describe, expect, it } from 'vitest';
import { HOLIDAYS, WEEKEND_HOLIDAYS, holidayOn } from '../src/data/holidays';

const dow = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay(); // 0=일 … 6=토

describe('공휴일 내장 목록', () => {
  it('평일 목록에는 토·일이 없고, 주말 목록에는 토·일만 있다', () => {
    for (const h of HOLIDAYS) expect([0, 6], `${h.date} ${h.name}`).not.toContain(dow(h.date));
    for (const h of WEEKEND_HOLIDAYS) expect([0, 6], `${h.date} ${h.name}`).toContain(dow(h.date));
  });

  it('날짜가 겹치지 않는다', () => {
    const all = [...HOLIDAYS, ...WEEKEND_HOLIDAYS].map((h) => h.date);
    expect(new Set(all).size).toBe(all.length);
  });

  it('2026년 추석 연휴(9/24~26)에는 대체공휴일이 없다 — 9/28은 평일', () => {
    expect(holidayOn('2026-09-28')).toBeUndefined();
    expect(holidayOn('2026-09-25')?.name).toBe('추석');
  });

  it('노동절·제헌절은 2026년부터 공휴일이다', () => {
    expect(holidayOn('2026-05-01')?.name).toBe('노동절');
    expect(holidayOn('2026-07-17')?.name).toBe('제헌절');
  });

  it('2027년 대체공휴일 7일이 월력요항과 같다', () => {
    const subs = HOLIDAYS.filter((h) => h.substitute && h.date.startsWith('2027')).map((h) => h.date);
    expect(subs).toEqual(['2027-02-09', '2027-05-03', '2027-07-19', '2027-08-16', '2027-10-04', '2027-10-11', '2027-12-27']);
  });
});
