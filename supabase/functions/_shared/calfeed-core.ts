// 구글 캘린더 연결 (구독 주소) — 순수 함수 (2026-11-14, 운영자 결정)
// 사장님 사업장마다 추측할 수 없는 토큰(32바이트, base64url 43자)을 하나 두고,
// 캘린더 앱(구글·아이폰·아웃룩)이 public-api/calendar/<토큰>.ics 를 주기적으로 읽어 간다.
// 토큰을 다시 만들면 예전 주소는 그때부터 통하지 않는다.

export const FEED_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export function newFeedToken(): string {
  const b = crypto.getRandomValues(new Uint8Array(32));
  let bin = '';
  for (const x of b) bin += String.fromCharCode(x);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export const isFeedToken = (t: unknown): t is string => typeof t === 'string' && FEED_TOKEN_RE.test(t);

export interface FeedLinks {
  /** 그대로 붙여 넣는 주소 (아웃룩 · 기타 캘린더) */
  https: string;
  /** 아이폰 · 맥 캘린더가 바로 구독하는 주소 */
  webcal: string;
  /** 구글 캘린더 '구독 추가' 화면을 바로 여는 주소 */
  google: string;
}

export function feedLinks(projectUrl: string, token: string): FeedLinks {
  const https = `${projectUrl.replace(/\/+$/, '')}/functions/v1/public-api/calendar/${token}.ics`;
  const webcal = https.replace(/^https:/, 'webcal:');
  return { https, webcal, google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}` };
}

/** public-api 경로 'calendar/<토큰>.ics' → 토큰 (형식이 다르면 null) */
export function feedTokenFromPath(path: string): string | null {
  const m = /^calendar\/([A-Za-z0-9_-]{43})\.ics$/.exec(path);
  return m ? m[1] : null;
}
