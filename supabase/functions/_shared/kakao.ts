// 카카오톡 "나에게 보내기" — 사장님 본인 카카오톡으로 기한 알림을 보낸다 (하루 1번, cron-daily).
//  · 연결: api owner/kakao/start → 카카오 동의(talk_message) → public-api kakao/callback → 갱신 토큰을 DB에 암호화 저장
//  · 발송: 갱신 토큰 → 접근 토큰 → kapi.kakao.com/v2/api/talk/memo/default/send
//  · 키: 함수 비밀 값 KAKAO_REST_KEY(카카오 앱 REST API 키)·KAKAO_CLIENT_SECRET(카카오 로그인 Client Secret). 없으면 꺼짐.
//  · 메시지에는 기한 제목·직원 별칭만 넣는다 (금액·실명·주민번호 없음). 내용은 저장하지 않는다.
//  · 순수 로직(state 서명·주소 검사·템플릿)은 kakao-core.ts — Node 시험(tests/backend/kakao.test.ts)이 직접 확인한다.
import type { Db } from './db.ts';
import { HttpError } from './http.ts';
import * as C from './kakao-core.ts';

export { KAKAO_POLICY_FROM, KAKAO_SCOPE, withParam } from './kakao-core.ts';

/** 알림 버튼이 여는 사이트 (카카오 앱 '플랫폼 → Web 사이트 도메인'에 등록돼 있어야 열린다) */
export const SITE_URL = (Deno.env.get('SITE_URL') ?? 'https://ai-labor-management.github.io/saram-saemgak-site').replace(/\/$/, '');
const AUTH_HOST = 'https://kauth.kakao.com';
const API_HOST = 'https://kapi.kakao.com';

function keys() {
  return { restKey: Deno.env.get('KAKAO_REST_KEY') ?? '', secret: Deno.env.get('KAKAO_CLIENT_SECRET') ?? '' };
}
export function kakaoConfigured(): boolean {
  const k = keys();
  return !!k.restKey && !!k.secret;
}
export function callbackUrl(): string {
  return `${Deno.env.get('SUPABASE_URL')}/functions/v1/public-api/kakao/callback`;
}
export const safeReturn = (v: unknown) => C.safeReturn(v, SITE_URL);
export const readState = (state: string) => C.readState(keys().secret, state);

export async function authorizeUrl(userId: string, returnTo: string): Promise<string> {
  const q = new URLSearchParams({
    client_id: keys().restKey,
    redirect_uri: callbackUrl(),
    response_type: 'code',
    scope: C.KAKAO_SCOPE,
    state: await C.signState(keys().secret, userId, returnTo),
  });
  return `${AUTH_HOST}/oauth/authorize?${q}`;
}

export class KakaoError extends Error {
  constructor(
    public readonly code: 'TOKEN_EXPIRED' | 'TOKEN_FAILED' | 'NO_SCOPE' | 'SEND_FAILED',
    message: string,
  ) {
    super(message);
  }
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}
async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const r = await fetch(`${AUTH_HOST}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body: new URLSearchParams({ client_id: keys().restKey, client_secret: keys().secret, ...params }),
    signal: AbortSignal.timeout(15_000),
  });
  const j = (await r.json().catch(() => ({}))) as TokenResponse;
  if (!r.ok || j.error) throw new KakaoError(C.tokenErrorCode(j.error), `${j.error ?? r.status} ${j.error_description ?? ''}`.trim());
  return j;
}

/** 동의 화면에서 받은 code를 갱신 토큰으로 바꿔 저장한다. talk_message 동의가 없으면 NO_SCOPE */
export async function connectWithCode(db: Db, userId: string, code: string): Promise<void> {
  const t = await tokenRequest({ grant_type: 'authorization_code', redirect_uri: callbackUrl(), code });
  if (!C.hasMessageScope(t.scope)) throw new KakaoError('NO_SCOPE', '카카오톡 메시지 전송에 동의하지 않았어요');
  if (!t.refresh_token) throw new KakaoError('TOKEN_FAILED', '갱신 토큰을 받지 못했어요');
  const { error } = await db.rpc('kakao_link_save', { p_user: userId, p_refresh: t.refresh_token, p_expires_in: t.refresh_token_expires_in ?? null, p_connect: true });
  if (error) throw error;
}

/** 저장한 갱신 토큰으로 접근 토큰을 받는다. 카카오가 새 갱신 토큰을 주면(만료 1달 전부터) 바꿔 저장한다 */
async function accessToken(db: Db, userId: string): Promise<string> {
  const { data: refresh, error } = await db.rpc('kakao_link_token', { p_user: userId });
  if (error) throw error;
  if (!refresh) throw new HttpError(404, '카카오톡 알림이 연결돼 있지 않아요', { code: 'KAKAO_NOT_LINKED' });
  const t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: refresh });
  if (t.refresh_token) {
    const { error: e2 } = await db.rpc('kakao_link_save', { p_user: userId, p_refresh: t.refresh_token, p_expires_in: t.refresh_token_expires_in ?? null, p_connect: false });
    if (e2) throw e2;
  }
  if (!t.access_token) throw new KakaoError('TOKEN_FAILED', '접근 토큰을 받지 못했어요');
  return t.access_token;
}

/** 보내지 않고 토큰만 갱신한다 (만료가 가까운 연결을 살려 둘 때) */
export async function refreshLink(db: Db, userId: string): Promise<void> {
  await accessToken(db, userId);
}

/** 나에게 보내기 (텍스트 200자, 버튼 하나). 실패하면 KakaoError */
export async function sendMemo(db: Db, userId: string, text: string, path = '/owner/deadlines'): Promise<void> {
  const token = await accessToken(db, userId);
  const r = await fetch(`${API_HOST}/v2/api/talk/memo/default/send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body: new URLSearchParams({ template_object: JSON.stringify(C.memoTemplate(text, SITE_URL, path)) }),
    signal: AbortSignal.timeout(15_000),
  });
  const j = (await r.json().catch(() => ({}))) as { result_code?: number; msg?: string; code?: number };
  if (!r.ok || j.result_code !== 0) throw new KakaoError('SEND_FAILED', `${j.code ?? r.status} ${j.msg ?? ''}`.trim());
}

/** 마지막 발송 결과 기록. 토큰이 만료·철회됐으면 연결을 지워 다시 연결하게 한다 */
export async function recordResult(db: Db, userId: string, on: string, e: unknown | null): Promise<void> {
  if (e instanceof KakaoError && e.code === 'TOKEN_EXPIRED') {
    await db.from('kakao_links').delete().eq('user_id', userId);
    return;
  }
  await db
    .from('kakao_links')
    .update({ last_sent_on: on, last_status: e ? 'failed' : 'sent', last_detail: e ? String(e instanceof Error ? e.message : e).slice(0, 300) : '' })
    .eq('user_id', userId);
}

/** 연결 상태 (화면용) */
export async function linkStatus(db: Db, userId: string) {
  const { data, error } = await db.from('kakao_links').select('connected_at, refresh_expires_at, last_sent_on, last_status, last_detail').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return {
    configured: kakaoConfigured(),
    policyFrom: C.KAKAO_POLICY_FROM,
    connected: !!data,
    connectedAt: data?.connected_at ?? null,
    expiresAt: data?.refresh_expires_at ?? null,
    lastSentOn: data?.last_sent_on ?? null,
    lastStatus: (data?.last_status ?? null) as 'sent' | 'failed' | null,
    lastDetail: data?.last_detail ?? '',
  };
}
