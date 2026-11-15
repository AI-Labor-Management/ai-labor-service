// 동네 행사 알림 — 3일 뒤 · 내일 시작하는 행사 고르기, 알림 글, 지역 확인 (2026-11-15)
import { describe, expect, it } from 'vitest';
import { daysBetween, EVENT_ALERT_POLICY_FROM, eventAlertKey, eventAlertText, LONG_EVENT_DAYS, mdw, parseRegion, pickEventAlerts } from '../../supabase/functions/_shared/eventalerts-core';
import type { TourEvent } from '../../supabase/functions/_shared/datagokr-core';

const ev = (id: string, start: string, end = start, title = id): TourEvent => ({ id, title, start, end, addr: '' });

describe('행사 고르기', () => {
  const today = '2026-11-18';
  it('3일 뒤 · 내일 시작하는 행사만, 가까운 것부터', () => {
    const list = [ev('a', '2026-11-21'), ev('b', '2026-11-19'), ev('c', '2026-11-20'), ev('d', '2026-11-18'), ev('e', '2026-11-25')];
    expect(pickEventAlerts(list, today).map((p) => [p.event.id, p.before])).toEqual([
      ['b', 1],
      ['a', 3],
    ]);
  });
  it('한 달 넘게 하는 상설 · 장기 행사는 알리지 않는다', () => {
    expect(LONG_EVENT_DAYS).toBe(31);
    const list = [ev('long', '2026-11-21', '2026-12-31'), ev('ok', '2026-11-21', '2026-12-22')];
    expect(pickEventAlerts(list, today).map((p) => p.event.id)).toEqual(['ok']);
  });
  it('같은 행사 · 같은 알림 날은 같은 키 (하루 한 번)', () => {
    expect(eventAlertKey(ev('123', '2026-11-21'), 3)).toBe('event:123:2026-11-21:d3');
    expect(eventAlertKey(ev('123', '2026-11-21'), 1)).not.toBe(eventAlertKey(ev('123', '2026-11-21'), 3));
  });
  it('날짜 계산', () => {
    expect(daysBetween('2026-11-18', '2026-11-21')).toBe(3);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(mdw('2026-11-21')).toBe('11/21(토)');
  });
});

describe('알림 글', () => {
  it('가까운 행사 하나 + 나머지 건수, 해요체', () => {
    const t = eventAlertText([
      { event: ev('1', '2026-11-19', '2026-11-19', '해운대 빛축제'), before: 1 },
      { event: ev('2', '2026-11-21', '2026-11-21', '김장 축제'), before: 3 },
    ]);
    expect(t).toBe('동네 행사: 내일 11/19(목) 해운대 빛축제 외 1건 — 손님이 늘 수 있어요. 근무표를 확인해 보세요');
    expect(eventAlertText([])).toBe('');
  });
  it('긴 이름은 줄인다 (카카오톡 200자 안에 기한 알림과 함께 들어가게)', () => {
    const t = eventAlertText([{ event: ev('1', '2026-11-21', '2026-11-21', '가'.repeat(60)), before: 3 }]);
    expect(t).toContain('…');
    expect(t.length).toBeLessThan(100);
  });
});

describe('지역 확인', () => {
  it('시도 2자리 · 시군구 3자리 또는 없음', () => {
    expect(parseRegion({ sido: '26', sidoName: '부산광역시', sigungu: '350', sigunguName: '해운대구' })).toEqual({ sido: '26', sidoName: '부산광역시', sigungu: '350', sigunguName: '해운대구' });
    expect(parseRegion({ sido: '26', sidoName: '부산광역시', sigungu: null })).toEqual({ sido: '26', sidoName: '부산광역시', sigungu: null, sigunguName: null });
    expect(parseRegion({ sido: '26', sigungu: '' })?.sigungu).toBeNull();
  });
  it('형식이 다르면 거절', () => {
    expect(parseRegion(null)).toBeNull();
    expect(parseRegion({ sido: '2' })).toBeNull();
    expect(parseRegion({ sido: '26', sigungu: '35' })).toBeNull();
    expect(parseRegion({ sido: 26 })).toBeNull();
  });
  it('이름은 짧게 자른다', () => {
    expect(parseRegion({ sido: '26', sidoName: '가'.repeat(50) })?.sidoName).toHaveLength(20);
  });
});

it('처리방침 변경 시행일 (사람샘각 Privacy.tsx와 같아야 함)', () => {
  expect(EVENT_ALERT_POLICY_FROM).toBe('2026-11-15'); // 11-22 예정 → 운영자 결정으로 11-15 바로 시행
});
