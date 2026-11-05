// 주휴·월 환산 시간 등 F2·F3가 함께 쓰는 기초 계산 (순환 참조를 피하려고 분리)
import { ruleValue } from './rules';
import { weeklyHours } from './work';
import type { ISODate, WorkCondition } from './types';

export const won = (n: number) => Math.round(n);

/** 주휴 시간 = min(주 소정근로시간, 40) / 40 × 8 (주 15시간 미만은 0) */
export function weeklyHolidayHours(weeklyHrs: number, date: ISODate): number {
  const min = ruleValue<number>('weeklyHoliday.minWeeklyHours', date);
  if (weeklyHrs < min) return 0;
  return (Math.min(weeklyHrs, 40) / 40) * 8;
}

/** 월 환산 시간 = (주 소정 + 주휴) × 365 / 7 / 12, 정수 반올림 (주 40시간 → 209시간) */
export function monthlyHours(weeklyHrs: number, date: ISODate): number {
  return Math.round(((weeklyHrs + weeklyHolidayHours(weeklyHrs, date)) * 365) / 7 / 12);
}

/** 등록 조건으로 계산한 예상 월 임금 (F3 보험료 기준 보수의 기본값) */
export function monthlyWageEstimate(c: WorkCondition | null, date: ISODate): number {
  if (!c) return 0;
  return won(monthlyHours(weeklyHours(c), date) * c.hourlyWage) + (c.mealAllowance || 0);
}
