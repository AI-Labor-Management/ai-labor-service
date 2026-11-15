// 동네 행사 알림 — 계산만 (Deno · 시험 공용). DB는 eventalerts.ts, 매일 보내기는 cron-daily.
import type { TourEvent } from './datagokr-core.ts';

/** 개인정보 처리방침 변경(행사 알림: 지역 저장 · 카카오톡 알림 내용 추가) 시행일 — 이날부터 켜기를 받고 알림을 보낸다.
 *  사람샘각 src/pages/public/Privacy.tsx EVENT_ALERT_CHANGE와 같아야 한다 */
export const EVENT_ALERT_POLICY_FROM = '2026-11-22';
/** 행사 며칠 전에 알릴지 */
export const EVENT_ALERT_DAYS = [3, 1] as const;
export type AlertBefore = (typeof EVENT_ALERT_DAYS)[number];
/** 이 일수보다 길게 하는 행사(상설·장기)는 바쁜 날 판단에 쓸모가 없어 알리지 않는다 — 사람샘각 tourEvents.ts LONG_EVENT_DAYS와 같음 */
export const LONG_EVENT_DAYS = 31;

export interface EventRegion {
  sido: string;
  sidoName: string;
  sigungu: string | null;
  sigunguName: string | null;
}

const dayMs = 86_400_000;
const utc = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
/** b - a (일) */
export const daysBetween = (a: string, b: string) => Math.round((utc(b) - utc(a)) / dayMs);
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
/** '11/21(토)' */
export const mdw = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}(${WEEK[new Date(utc(iso)).getUTCDay()]})`;

/** 오늘 기준 3일 뒤 · 내일 시작하는 짧은 행사 (가까운 것부터) */
export function pickEventAlerts(events: TourEvent[], today: string): { event: TourEvent; before: AlertBefore }[] {
  const out: { event: TourEvent; before: AlertBefore }[] = [];
  for (const e of events) {
    if (daysBetween(e.start, e.end) > LONG_EVENT_DAYS) continue;
    const d = daysBetween(today, e.start);
    if ((EVENT_ALERT_DAYS as readonly number[]).includes(d)) out.push({ event: e, before: d as AlertBefore });
  }
  return out.sort((a, b) => a.before - b.before || a.event.title.localeCompare(b.event.title));
}

/** 같은 행사 · 같은 알림 날에는 한 번만 (notification_log.deadline_key) */
export const eventAlertKey = (e: TourEvent, before: AlertBefore) => `event:${e.id}:${e.start}:d${before}`.slice(0, 200);

/** 알림 글 — 앱 안 알림 · 카카오톡 공용. 행사 이름은 공개 정보(TourAPI) */
export function eventAlertText(list: { event: TourEvent; before: AlertBefore }[]): string {
  if (!list.length) return '';
  const first = list[0];
  const when = first.before === 1 ? '내일' : '3일 뒤';
  const name = first.event.title.length > 30 ? `${first.event.title.slice(0, 29)}…` : first.event.title;
  const more = list.length > 1 ? ` 외 ${list.length - 1}건` : '';
  return `동네 행사: ${when} ${mdw(first.event.start)} ${name}${more} — 손님이 늘 수 있어요. 근무표를 확인해 보세요`;
}

/** 켜기 요청의 지역 확인 (시도 2자리 · 시군구 3자리 또는 없음, 이름은 짧게) */
export function parseRegion(v: unknown): EventRegion | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;
  const s = (x: unknown, max: number) => (typeof x === 'string' ? x.trim().slice(0, max) : '');
  if (typeof r.sido !== 'string' || !/^\d{2}$/.test(r.sido)) return null;
  const sigungu = r.sigungu == null || r.sigungu === '' ? null : r.sigungu;
  if (sigungu !== null && (typeof sigungu !== 'string' || !/^\d{3}$/.test(sigungu))) return null;
  return { sido: r.sido, sidoName: s(r.sidoName, 20), sigungu, sigunguName: sigungu ? s(r.sigunguName, 30) || null : null };
}
