// 카카오톡 나에게 보내기 — 순수 로직: state 서명·만료, 돌아갈 주소 제한, 동의 범위, 메시지 템플릿, 토큰 오류 구분
import { describe, expect, it } from 'vitest';
import {
  KAKAO_POLICY_FROM,
  STATE_TTL_MS,
  hasMessageScope,
  memoTemplate,
  readState,
  safeReturn,
  signState,
  tokenErrorCode,
  withParam,
} from '../../supabase/functions/_shared/kakao-core';

const SECRET = 'test-secret';
const SITE = 'https://ai-labor-management.github.io/saram-saemgak-site';
const BACK = `${SITE}/owner/deadlines`;

describe('카카오 state', () => {
  it('서명한 state를 다시 읽으면 사용자와 돌아갈 주소가 나온다', async () => {
    const s = await signState(SECRET, 'user-1', BACK, 1_000);
    expect(await readState(SECRET, s, 2_000)).toEqual({ userId: 'user-1', returnTo: BACK });
  });

  it('10분이 지나면 받지 않는다', async () => {
    const s = await signState(SECRET, 'user-1', BACK, 0);
    expect(await readState(SECRET, s, STATE_TTL_MS + 1)).toBeNull();
  });

  it('내용을 바꾸거나 다른 비밀 값으로 서명하면 받지 않는다', async () => {
    const s = await signState(SECRET, 'user-1', BACK, 0);
    const [body, sig] = s.split('.');
    const forged = Buffer.from(JSON.stringify({ u: 'attacker', r: BACK, e: 9e15 })).toString('base64url');
    expect(await readState(SECRET, `${forged}.${sig}`, 1)).toBeNull();
    expect(await readState('other-secret', s, 1)).toBeNull();
    expect(await readState(SECRET, body, 1)).toBeNull();
    expect(await readState(SECRET, 'garbage', 1)).toBeNull();
  });
});

describe('돌아갈 주소', () => {
  it('공개 사이트·로컬 개발 주소만 그대로 쓴다', () => {
    expect(safeReturn(`${SITE}/owner/deadlines?x=1`, SITE)).toBe(`${SITE}/owner/deadlines?x=1`);
    expect(safeReturn('http://localhost:5173/owner/deadlines', SITE)).toBe('http://localhost:5173/owner/deadlines');
  });

  it('다른 사이트·주소가 아닌 값은 기본 일정 화면으로 바꾼다 (열린 리다이렉트 방지)', () => {
    expect(safeReturn('https://evil.example/steal', SITE)).toBe(BACK);
    expect(safeReturn('javascript:alert(1)', SITE)).toBe(BACK);
    expect(safeReturn(null, SITE)).toBe(BACK);
  });

  it('결과를 쿼리에 붙인다', () => {
    expect(withParam(`${BACK}?a=1`, 'kakao', 'connected')).toBe(`${BACK}?a=1&kakao=connected`);
  });
});

describe('동의·템플릿·오류', () => {
  it('talk_message 동의가 있어야 연결한다', () => {
    expect(hasMessageScope('profile_nickname talk_message')).toBe(true);
    expect(hasMessageScope('profile_nickname,account_email')).toBe(false);
    expect(hasMessageScope(undefined)).toBe(false);
  });

  it('메시지는 200자로 자르고 버튼은 사이트의 화면을 연다', () => {
    const t = memoTemplate('가'.repeat(250), SITE, '/owner/deadlines');
    expect(t.text).toHaveLength(200);
    expect(t.link.web_url).toBe(BACK);
    expect(t.link.mobile_web_url).toBe(BACK);
    expect(t.object_type).toBe('text');
  });

  it('invalid_grant(만료·철회)만 다시 연결이 필요한 오류로 본다', () => {
    expect(tokenErrorCode('invalid_grant')).toBe('TOKEN_EXPIRED');
    expect(tokenErrorCode('invalid_client')).toBe('TOKEN_FAILED');
    expect(tokenErrorCode(undefined)).toBe('TOKEN_FAILED');
  });

  it('처리방침 변경 시행일은 오늘(2026-11-07)부터 7일 뒤다', () => {
    expect(KAKAO_POLICY_FROM).toBe('2026-11-14');
  });
});
