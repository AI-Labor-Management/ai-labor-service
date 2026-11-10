// 가게 QR 출퇴근 — 사업장 비밀 값 보관(clock_qr_keys, 함수만 읽음)과 코드 확인. 계산은 clockqr-core.ts(순수, 시험 있음).
import type { Db } from './db.ts';
import { clockUrl, codeAt, newPosterToken, newSecret, STEP_SEC, stepAt, verifyCode } from './clockqr-core.ts';
import { SITE_URL } from './kakao.ts';

interface Keys {
  secret: string;
  poster_token: string;
  poster_issued_at: string;
}

/** 사업장 QR 비밀 값 — 없으면 만든다 (동시에 만들어도 하나만 남는다) */
async function keysFor(db: Db, workplaceId: string): Promise<Keys> {
  const read = async () => {
    const { data, error } = await db.from('clock_qr_keys').select('secret, poster_token, poster_issued_at').eq('workplace_id', workplaceId).maybeSingle();
    if (error) throw error;
    return data as Keys | null;
  };
  const have = await read();
  if (have) return have;
  const { error } = await db
    .from('clock_qr_keys')
    .upsert({ workplace_id: workplaceId, secret: newSecret(), poster_token: newPosterToken() }, { onConflict: 'workplace_id', ignoreDuplicates: true });
  if (error) throw error;
  const made = await read();
  if (!made) throw new Error('QR 비밀 값을 만들지 못했어요');
  return made;
}

/** 사장님 화면용 — 지금 화면 QR 코드(30초마다 바뀜)와 인쇄용 코드. 비밀 값은 내보내지 않는다 */
export async function ownerClockQr(db: Db, workplaceId: string) {
  const k = await keysFor(db, workplaceId);
  const now = Date.now();
  const code = await codeAt(k.secret, stepAt(now));
  return {
    screen: { code, url: clockUrl(SITE_URL, code), refreshInSec: STEP_SEC - (Math.floor(now / 1000) % STEP_SEC), validMinutes: 5 },
    poster: { token: k.poster_token, url: clockUrl(SITE_URL, k.poster_token), issuedAt: k.poster_issued_at },
  };
}

/** 인쇄용 코드 새로 발급 — 예전 인쇄물은 그때부터 통하지 않는다 */
export async function reissuePoster(db: Db, workplaceId: string) {
  await keysFor(db, workplaceId);
  const { error } = await db.from('clock_qr_keys').update({ poster_token: newPosterToken(), poster_issued_at: new Date().toISOString() }).eq('workplace_id', workplaceId);
  if (error) throw error;
  return ownerClockQr(db, workplaceId);
}

/** 직원이 찍어 온 코드 확인 */
export async function verifyClockQr(db: Db, workplaceId: string, code: unknown): Promise<'screen' | 'poster' | null> {
  if (code == null || code === '') return null;
  return verifyCode(code, await keysFor(db, workplaceId), Date.now());
}
