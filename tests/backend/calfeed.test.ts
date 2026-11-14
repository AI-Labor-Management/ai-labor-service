// 구글 캘린더 연결 (구독 주소) — 토큰 · 주소 · 경로 · 구독용 일정 파일 (2026-11-14)
import { describe, expect, it } from 'vitest';
import { feedLinks, feedTokenFromPath, isFeedToken, newFeedToken } from '../../supabase/functions/_shared/calfeed-core';
import { buildIcs } from '../../src/domain/ics';
import type { Deadline } from '../../src/domain/deadlines';

describe('구독 토큰', () => {
  it('32바이트 → base64url 43자, 매번 다름', () => {
    const a = newFeedToken();
    const b = newFeedToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(isFeedToken(a)).toBe(true);
    expect(a).not.toBe(b);
  });
  it('형식이 다르면 거절', () => {
    expect(isFeedToken('')).toBe(false);
    expect(isFeedToken('a'.repeat(42))).toBe(false);
    expect(isFeedToken('a'.repeat(42) + '=')).toBe(false);
    expect(isFeedToken(null)).toBe(false);
  });
});

describe('구독 주소', () => {
  const t = 'A'.repeat(43);
  it('https · webcal · 구글 캘린더 구독 화면 주소를 만든다', () => {
    const l = feedLinks('https://ref.supabase.co/', t);
    expect(l.https).toBe(`https://ref.supabase.co/functions/v1/public-api/calendar/${t}.ics`);
    expect(l.webcal).toBe(`webcal://ref.supabase.co/functions/v1/public-api/calendar/${t}.ics`);
    expect(l.google).toBe(`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(l.webcal)}`);
  });
  it('public-api 경로에서 토큰을 꺼낸다 (형식이 다르면 null)', () => {
    expect(feedTokenFromPath(`calendar/${t}.ics`)).toBe(t);
    expect(feedTokenFromPath(`calendar/${t}`)).toBeNull();
    expect(feedTokenFromPath(`calendar/short.ics`)).toBeNull();
    expect(feedTokenFromPath(`calendar/${t}.ics/x`)).toBeNull();
    expect(feedTokenFromPath('health')).toBeNull();
  });
});

describe('구독용 일정 파일', () => {
  const d = { key: 'ins-acq:e1', date: '2026-12-01', title: '건강보험 취득 신고 · 직원 A', origin: '입사일 2026-11-17 + 14일', basis: '국민건강보험법 제8조', recurring: false, secondaryLabel: '' } as unknown as Deadline;
  it('구독이면 캘린더 이름 · 6시간 갱신 · 자동으로 바뀐다는 설명', () => {
    const ics = buildIcs([d], new Date('2026-11-14T00:00:00Z'), { subscription: true, calName: '사람샘각 · 카페, 샘터' });
    expect(ics).toContain('X-WR-CALNAME:사람샘각 · 카페\\, 샘터');
    expect(ics).toContain('REFRESH-INTERVAL;VALUE=DURATION:PT6H');
    expect(ics).toContain('X-PUBLISHED-TTL:PT6H');
    expect(ics.replace(/\r\n /g, '')).toContain('사람샘각과 연결된 일정이에요');
    expect(ics).not.toContain('내려받은 시점의 사본');
    expect(ics).toContain('UID:ins-acq:e1@ai-labor-service.local');
  });
  it('내려받기는 예전 그대로', () => {
    const ics = buildIcs([d], new Date('2026-11-14T00:00:00Z'));
    expect(ics).toContain('X-WR-CALNAME:사람샘각 노무 기한');
    expect(ics).not.toContain('REFRESH-INTERVAL');
    expect(ics.replace(/\r\n /g, '')).toContain('내려받은 시점의 사본');
  });
});
