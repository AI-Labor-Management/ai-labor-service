// 가게 QR 출퇴근 — Deno·Node 공통 순수 부분 (tests/backend/clockqr.test.ts)
//  · 화면 QR: 가게 기기(사장님 화면)에 띄우는 코드. 사업장 비밀 값의 HMAC으로 30초마다 바뀐다. 찍은 뒤 5분까지 받는다(로그인할 시간).
//  · 인쇄 QR: 벽에 붙이는 고정 코드. 사진으로 퍼질 수 있어 사장님이 언제든 새로 발급해 예전 것을 무효로 한다.
// 직원이 QR을 찍으면 출퇴근 화면이 코드를 들고 열리고, 서버가 코드를 확인하면 '가게에서 확인'으로 기록한다.
// 위치(좌표·반경)는 쓰지 않는다 — 위치정보법 제2조의 '측위'가 아니어서 위치기반서비스 신고·위치 동의가 필요 없다.

export const STEP_SEC = 30;
export const ACCEPT_STEPS = 10; // 5분
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // 헷갈리는 0·1·I·O 뺀 32자
const CODE_RE = /^[23456789A-HJ-NP-Z]{8}$/;
const POSTER_RE = /^P[23456789A-HJ-NP-Z]{11}$/;

export const stepAt = (ms: number) => Math.floor(ms / 1000 / STEP_SEC);
export const normalizeCode = (c: unknown) =>
  String(c ?? '')
    .trim()
    .toUpperCase()
    .slice(0, 16);
export const isPosterToken = (c: string) => POSTER_RE.test(c);

const pick = (bytes: Uint8Array, n: number) => Array.from(bytes.slice(0, n), (b) => ALPHABET[b % 32]).join(''); // 256 = 32×8 → 고르게

/** 화면 QR 코드 (그 30초 구간) */
export async function codeAt(secret: string, step: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`saram-clock:${step}`)));
  return pick(mac, 8);
}

/** 새 사업장 비밀 값 (64자리 16진수) */
export function newSecret(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** 새 인쇄용 코드 — P + 11자 */
export function newPosterToken(): string {
  return `P${pick(crypto.getRandomValues(new Uint8Array(11)), 11)}`;
}

/** 찍은 코드 확인 — 'screen'(화면 QR, 5분 안), 'poster'(지금 유효한 인쇄 QR), 아니면 null */
export async function verifyCode(code: unknown, keys: { secret: string; poster_token: string }, nowMs: number): Promise<'screen' | 'poster' | null> {
  const c = normalizeCode(code);
  if (isPosterToken(c)) return c === keys.poster_token ? 'poster' : null;
  if (!CODE_RE.test(c)) return null;
  const now = stepAt(nowMs);
  // 기기 시계가 조금 빠를 수 있어 다음 구간 하나도 받는다
  for (let s = now + 1; s >= now - ACCEPT_STEPS; s--) if ((await codeAt(keys.secret, s)) === c) return 'screen';
  return null;
}

/** 직원이 찍을 주소 — 사이트의 직원 출퇴근 화면 + 코드 */
export function clockUrl(siteUrl: string, code: string): string {
  return `${siteUrl.replace(/\/$/, '')}/employee?qr=${encodeURIComponent(code)}`;
}
