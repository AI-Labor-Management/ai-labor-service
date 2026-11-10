// 카카오톡 나에게 보내기 — Deno·DB에 기대지 않는 순수 부분 (Node 시험에서도 불러올 수 있게 kakao.ts에서 뗐다)
export const KAKAO_SCOPE = 'talk_message';
/** 처리방침 변경(카카오톡 알림 항목) 시행일 — 이날부터 연결을 받는다.
 *  2026-11-07에 알리고 원래 11-14 시행이었으나, 가입자가 운영자뿐이라 운영자 결정으로 2026-11-08 바로 시행 */
export const KAKAO_POLICY_FROM = '2026-11-08';
/** 연결 뒤 돌아갈 수 있는 사이트 (열린 리다이렉트 방지) */
export const RETURN_ORIGINS = ['https://saram.dreamhelixion.com', 'https://ai-labor-management.github.io', 'http://localhost:5173', 'http://localhost:4173', 'http://localhost:4175'];
export const STATE_TTL_MS = 10 * 60_000;

const b64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(`kakao-state:${secret}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))));
}

/** 사용자·돌아갈 주소·만료(10분)를 서명해 카카오 state로 실어 보낸다 */
export async function signState(secret: string, userId: string, returnTo: string, now = Date.now()): Promise<string> {
  const body = b64url(new TextEncoder().encode(JSON.stringify({ u: userId, r: returnTo, e: now + STATE_TTL_MS })));
  return `${body}.${await hmac(secret, body)}`;
}

/** 서명·만료를 확인한다. 고쳐졌거나 지났으면 null */
export async function readState(secret: string, state: string, now = Date.now()): Promise<{ userId: string; returnTo: string } | null> {
  const [body, sig] = state.split('.');
  if (!body || !sig || (await hmac(secret, body)) !== sig) return null;
  try {
    const o = JSON.parse(new TextDecoder().decode(fromB64url(body))) as { u?: string; r?: string; e?: number };
    if (!o.u || !o.r || !o.e || o.e < now) return null;
    return { userId: o.u, returnTo: o.r };
  } catch {
    return null;
  }
}

/** 돌아갈 주소 확인 — 허용한 사이트가 아니면 기본 사이트의 일정 화면으로 */
export function safeReturn(v: unknown, siteUrl: string): string {
  if (typeof v === 'string') {
    try {
      const u = new URL(v);
      if (RETURN_ORIGINS.includes(u.origin)) return u.toString();
    } catch {
      /* 주소가 아님 */
    }
  }
  return `${siteUrl}/owner/deadlines`;
}

export function withParam(url: string, key: string, value: string): string {
  const u = new URL(url);
  u.searchParams.set(key, value);
  return u.toString();
}

/** 토큰 응답의 scope에 메시지 전송 동의가 있는지 (공백·쉼표 구분) */
export const hasMessageScope = (scope: string | undefined) => (scope ?? '').split(/[\s,]+/).includes(KAKAO_SCOPE);

/** 나에게 보내기 기본 텍스트 템플릿 (본문 200자, 버튼 하나) */
export function memoTemplate(text: string, siteUrl: string, path: string) {
  const url = `${siteUrl}${path}`;
  return { object_type: 'text', text: text.slice(0, 200), link: { web_url: url, mobile_web_url: url }, button_title: '사람샘각에서 보기' };
}

/** 토큰 오류 구분: invalid_grant(만료·철회)는 다시 연결해야 한다 */
export const tokenErrorCode = (error: string | undefined): 'TOKEN_EXPIRED' | 'TOKEN_FAILED' => (error === 'invalid_grant' ? 'TOKEN_EXPIRED' : 'TOKEN_FAILED');
