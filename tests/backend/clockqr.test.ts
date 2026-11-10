// 가게 QR 출퇴근 — 30초마다 바뀌는 화면 코드(5분 안 유효), 인쇄용 고정 코드, 주소 만들기
import { describe, expect, it } from 'vitest';
import { ACCEPT_STEPS, clockUrl, codeAt, isPosterToken, newPosterToken, newSecret, STEP_SEC, stepAt, verifyCode } from '../../supabase/functions/_shared/clockqr-core';

const secret = 'a'.repeat(64);
const keys = { secret, poster_token: 'PABCDEFGH234' };
const T = 1_794_000_000_000; // 임의의 시각

describe('화면 QR 코드', () => {
  it('같은 30초 구간이면 같은 코드, 다음 구간이면 다른 코드 (헷갈리는 글자 없음)', async () => {
    const s = stepAt(T);
    const a = await codeAt(secret, s);
    expect(a).toMatch(/^[23456789A-HJ-NP-Z]{8}$/);
    expect(await codeAt(secret, s)).toBe(a);
    expect(await codeAt(secret, s + 1)).not.toBe(a);
    expect(await codeAt('b'.repeat(64), s)).not.toBe(a);
  });

  it('찍은 뒤 5분까지, 기기 시계가 30초 빠른 것까지 받고 그 밖은 거절', async () => {
    const s = stepAt(T);
    expect(await verifyCode(await codeAt(secret, s), keys, T)).toBe('screen');
    expect(await verifyCode((await codeAt(secret, s - ACCEPT_STEPS)).toLowerCase(), keys, T)).toBe('screen'); // 소문자로 와도 됨
    expect(await verifyCode(await codeAt(secret, s + 1), keys, T)).toBe('screen');
    expect(await verifyCode(await codeAt(secret, s - ACCEPT_STEPS - 1), keys, T)).toBeNull();
    expect(await verifyCode(await codeAt(secret, s + 2), keys, T)).toBeNull();
    expect(ACCEPT_STEPS * STEP_SEC).toBe(300);
  });

  it('형식이 다르거나 비어 있으면 거절', async () => {
    expect(await verifyCode('', keys, T)).toBeNull();
    expect(await verifyCode(null, keys, T)).toBeNull();
    expect(await verifyCode('<script>', keys, T)).toBeNull();
    expect(await verifyCode('O0I1O0I1', keys, T)).toBeNull();
  });
});

describe('인쇄용 QR', () => {
  it('지금 발급된 코드만 받는다 (새로 발급하면 예전 코드 거절)', async () => {
    expect(await verifyCode('PABCDEFGH234', keys, T)).toBe('poster');
    expect(await verifyCode('pabcdefgh234', keys, T)).toBe('poster');
    expect(await verifyCode('PZZZZZZZZZZZ', keys, T)).toBeNull();
    const fresh = newPosterToken();
    expect(isPosterToken(fresh)).toBe(true);
    expect(await verifyCode('PABCDEFGH234', { ...keys, poster_token: fresh }, T)).toBeNull();
  });

  it('비밀 값은 64자리 16진수, 주소는 직원 출퇴근 화면', () => {
    expect(newSecret()).toMatch(/^[0-9a-f]{64}$/);
    expect(newSecret()).not.toBe(newSecret());
    expect(clockUrl('https://x.github.io/site/', 'ABCD2345')).toBe('https://x.github.io/site/employee?qr=ABCD2345');
  });
});
