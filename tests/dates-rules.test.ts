import { describe, expect, it } from 'vitest';
import { addMonths, addYears, diffDays, nextMonth15, nightOverlapMinutes, weekday, isISODate } from '../src/domain/dates';
import { resolveRule, allRules, RULES_FILE } from '../src/domain/rules';

describe('날짜 계산 경계', () => {
  it('월말 + 1개월은 다음 달 말일로 맞춘다', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29'); // 윤년
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
  });
  it('윤일 + 1년은 2월 28일', () => {
    expect(addYears('2028-02-29', 1)).toBe('2029-02-28');
  });
  it('다음 달 15일 — 연도 전환', () => {
    expect(nextMonth15('2026-12-20')).toBe('2027-01-15');
    expect(nextMonth15('2026-11-03')).toBe('2026-12-15');
  });
  it('요일과 일수 차이 (시간대 영향 없음)', () => {
    expect(weekday('2026-11-05')).toBe(3); // 목요일
    expect(weekday('2027-01-01')).toBe(4); // 금요일
    expect(diffDays('2026-12-31', '2027-01-01')).toBe(1);
    expect(diffDays('2028-02-28', '2028-03-01')).toBe(2);
  });
  it('야간(22~06시) 겹침', () => {
    expect(nightOverlapMinutes('18:00', '22:00')).toBe(0);
    expect(nightOverlapMinutes('21:00', '23:00')).toBe(60);
    expect(nightOverlapMinutes('22:00', '06:00')).toBe(480);
    expect(nightOverlapMinutes('16:00', '00:00')).toBe(120);
    expect(nightOverlapMinutes('05:00', '09:00')).toBe(60);
  });
  it('날짜 형식 검증', () => {
    expect(isISODate('2026-02-29')).toBe(false);
    expect(isISODate('2028-02-29')).toBe(true);
    expect(isISODate('2026-13-01')).toBe(false);
  });
});

describe('규칙 파일 (rules.json)', () => {
  it('원본 44개 규칙을 그대로 읽는다', () => {
    expect(RULES_FILE.schema).toBe('bix-rules/1');
    expect(allRules()).toHaveLength(44);
  });
  it('최저임금은 근무일 기준으로 고른다 (연도 전환)', () => {
    const a = resolveRule<number>('minimumWage.hourly', '2026-12-31');
    const b = resolveRule<number>('minimumWage.hourly', '2027-01-01');
    expect(a.ok && a.value).toBe(10320);
    expect(b.ok && b.value).toBe(10700);
    expect(resolveRule('minimumWage.hourly', '2025-12-31').ok).toBe(false);
  });
  it('시행령 대기(pending) 값은 이전 값으로 계산하지 않는다', () => {
    const r = resolveRule('insurance.employment.eligibility', '2027-01-01');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('pending');
    expect(resolveRule('insurance.employment.eligibility', '2026-12-31').ok).toBe(true);
  });
  it('발표 기준(announced) 값은 상태와 함께 돌려준다', () => {
    const r = resolveRule<number>('insurance.health.rate', '2027-03-01');
    expect(r.ok && r.status).toBe('announced');
  });
  it('휴게 생략 요청은 2026-12-10부터', () => {
    const before = resolveRule<{ waiver4hOnRequest: boolean }>('break.minimum', '2026-12-09');
    const after = resolveRule<{ waiver4hOnRequest: boolean }>('break.minimum', '2026-12-10');
    expect(before.ok && before.value.waiver4hOnRequest).toBe(false);
    expect(after.ok && after.value.waiver4hOnRequest).toBe(true);
  });
});
