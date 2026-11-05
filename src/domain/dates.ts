// 날짜 계산은 모두 'YYYY-MM-DD' 문자열과 UTC 일수로 처리해 시간대·서머타임 영향을 받지 않게 한다.
import type { HHMM, ISODate, Weekday } from './types';

const DAY_MS = 86_400_000;

export function isISODate(s: unknown): s is ISODate {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

export function parts(iso: ISODate): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
}

export function fromParts(y: number, m: number, d: number): ISODate {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function toDays(iso: ISODate): number {
  const { y, m, d } = parts(iso);
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
}

export function fromDays(n: number): ISODate {
  const dt = new Date(n * DAY_MS);
  return fromParts(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function addDays(iso: ISODate, n: number): ISODate {
  return fromDays(toDays(iso) + n);
}

/** b - a (일) */
export function diffDays(a: ISODate, b: ISODate): number {
  return toDays(b) - toDays(a);
}

/** 월을 더하고 말일을 넘으면 그 달 말일로 맞춘다 (1.31 + 1개월 = 2.28/29). */
export function addMonths(iso: ISODate, n: number): ISODate {
  const { y, m, d } = parts(iso);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return fromParts(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}

export function addYears(iso: ISODate, n: number): ISODate {
  return addMonths(iso, n * 12);
}

export function monthOf(iso: ISODate): string {
  return iso.slice(0, 7);
}

export function startOfMonth(ym: string): ISODate {
  return `${ym}-01`;
}

export function endOfMonth(ym: string): ISODate {
  const [y, m] = ym.split('-').map(Number);
  return fromParts(y, m, daysInMonth(y, m));
}

export function addMonthsYM(ym: string, n: number): string {
  return monthOf(addMonths(`${ym}-01`, n));
}

/** 사유가 생긴 달의 다음 달 15일 */
export function nextMonth15(iso: ISODate): ISODate {
  const { y, m } = parts(iso);
  const nm = m === 12 ? 1 : m + 1;
  const ny = m === 12 ? y + 1 : y;
  return fromParts(ny, nm, 15);
}

/** 0 = 월 … 6 = 일 */
export function weekday(iso: ISODate): Weekday {
  // 1970-01-01은 목요일(3)
  return (((toDays(iso) + 3) % 7) + 7) % 7 as Weekday;
}

export function startOfWeek(iso: ISODate): ISODate {
  return addDays(iso, -weekday(iso));
}

export function listDates(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let n = toDays(from); n <= toDays(to); n++) out.push(fromDays(n));
  return out;
}

export function minDate(a: ISODate, b: ISODate): ISODate {
  return a <= b ? a : b;
}
export function maxDate(a: ISODate, b: ISODate): ISODate {
  return a >= b ? a : b;
}

export function inRange(d: ISODate, from: ISODate | null | undefined, to: ISODate | null | undefined): boolean {
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

/** 브라우저 로컬 날짜(한국 사용 기준) */
export function todayLocal(): ISODate {
  const now = new Date();
  return fromParts(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export const WEEKDAY_KO = ['월', '화', '수', '목', '금', '토', '일'] as const;
export const WEEKDAY_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export function fmtDate(iso: ISODate | null | undefined): string {
  if (!iso) return '—';
  const { y, m, d } = parts(iso);
  return `${y}.${String(m).padStart(2, '0')}.${String(d).padStart(2, '0')}`;
}

export function fmtMD(iso: ISODate | null | undefined): string {
  if (!iso) return '—';
  const { m, d } = parts(iso);
  return `${String(m).padStart(2, '0')}.${String(d).padStart(2, '0')}`;
}

export function fmtMDW(iso: ISODate): string {
  return `${fmtMD(iso)}(${WEEKDAY_KO[weekday(iso)]})`;
}

export function fmtYM(ym: string): string {
  const [y, m] = ym.split('-');
  return `${y}년 ${Number(m)}월`;
}

export function dDayLabel(days: number): string {
  if (days === 0) return 'D-day';
  return days > 0 ? `D-${days}` : `D+${-days}`;
}

// ---- 시간 ----

export function isHHMM(s: unknown): s is HHMM {
  return typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

export function toMin(t: HHMM): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function fromMin(n: number): HHMM {
  const v = ((n % 1440) + 1440) % 1440;
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
}

/** 시작~종료 구간(분). 종료가 시작보다 이르거나 같으면 다음 날로 본다. */
export function spanMinutes(start: HHMM, end: HHMM): { s: number; e: number } {
  const s = toMin(start);
  let e = toMin(end);
  if (e <= s) e += 1440;
  return { s, e };
}

/** 22:00~06:00 과 겹치는 분 */
export function nightOverlapMinutes(start: HHMM, end: HHMM): number {
  const { s, e } = spanMinutes(start, end);
  const windows: [number, number][] = [
    [-120, 360], // 전날 22:00 ~ 당일 06:00
    [1320, 1800], // 당일 22:00 ~ 다음날 06:00
    [2760, 3240],
  ];
  let total = 0;
  for (const [ws, we] of windows) total += Math.max(0, Math.min(e, we) - Math.max(s, ws));
  return total;
}

export function hoursText(h: number): string {
  const r = Math.round(h * 100) / 100;
  return `${Number.isInteger(r) ? r : r.toFixed(2).replace(/0$/, '')}시간`;
}

// ---- 시각 (저장은 ISO UTC, 표시는 브라우저 로컬 시각) ----

/** ISO 시각 → 로컬 'YYYY-MM-DD' */
export function localDate(isoDateTime: string | null | undefined): ISODate {
  if (!isoDateTime) return '';
  const d = new Date(isoDateTime);
  if (Number.isNaN(d.getTime())) return isoDateTime.slice(0, 10);
  return fromParts(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/** ISO 시각 → 로컬 'YYYY-MM-DD HH:MM' */
export function fmtDateTime(isoDateTime: string | null | undefined): string {
  if (!isoDateTime) return '—';
  const d = new Date(isoDateTime);
  if (Number.isNaN(d.getTime())) return isoDateTime;
  return `${localDate(isoDateTime)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** ISO 시각 → 로컬 'MM.DD' */
export function fmtMDT(isoDateTime: string | null | undefined): string {
  return isoDateTime ? fmtMD(localDate(isoDateTime)) : '—';
}
