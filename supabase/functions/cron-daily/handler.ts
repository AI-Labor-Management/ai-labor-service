// Edge Function `cron-daily` — 하루 1번(pg_cron) 기한 알림을 만들고 보관 기간을 정리한다 (verify_jwt = false, x-cron-secret 검사)
// 알림 규칙(11_F4): 30·7·3일 전 + 당일, 매달 반복(급여일)은 3일 전·당일, 기한이 지나면 다음 날 한 번 위험 알림.
// 채널: 앱 안 알림은 늘 쌓는다. 카카오톡(나에게 보내기)은 키(KAKAO_REST_KEY·KAKAO_CLIENT_SECRET)가 있고
//       사장님이 연결했을 때만 같은 내용을 한 번 보낸다 (_shared/kakao.ts). 아니면 발송 기록에 'not-connected'.
import { engine as E } from '../_shared/engine.ts';
import { kstToday, loadWorkplace, must, serviceClient } from '../_shared/db.ts';
import { corsHeaders, handleError, HttpError, json } from '../_shared/http.ts';
import * as K from '../_shared/kakao.ts';

export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  try {
    const db = serviceClient();
    const secret = req.headers.get('x-cron-secret') ?? '';
    const { data: ok, error } = await db.rpc('verify_cron_secret', { p_secret: secret });
    if (error) throw error;
    if (!ok) throw new HttpError(401, 'cron 비밀 값이 맞지 않아요');

    const today = kstToday();
    const kakaoSwitch = (await must(db.from('app_settings').select('value').eq('key', 'kakao_enabled')))[0]?.value === true;
    const kakaoOn = kakaoSwitch && K.kakaoConfigured();
    const linked = new Set(kakaoOn ? (await must(db.from('kakao_links').select('user_id'))).map((l) => l.user_id) : []);
    const workplaces = await must(db.from('workplaces').select('id, owner_id, base_date_override'));
    const summary: { workplaceId: string; alerts: number; skipped: number; kakao: 'sent' | 'failed' | 'not-connected' | null }[] = [];
    for (const wp of workplaces) {
      // 기준일을 고정한 데모 사업장은 그 날짜로 계산한다
      const base = wp.base_date_override ?? today;
      const { state } = await loadWorkplace(db, wp.id, today);
      const due = E.computeDeadlines(state, base).filter(
        (d) => d.status !== 'done' && d.status !== 'onboarding' && (d.alerts.includes(base) || d.days === -1),
      );
      let skipped = 0;
      const fresh: typeof due = [];
      for (const d of due) {
        // 같은 기한·같은 날에는 한 번만 (unique 제약)
        const { error: e1 } = await db.from('notification_log').insert({ workplace_id: wp.id, deadline_key: d.key, channel: 'inApp', sent_on: base, status: 'delivered' });
        if (e1) {
          skipped++;
          continue;
        }
        fresh.push(d);
      }
      let kakao: 'sent' | 'failed' | 'not-connected' | null = null;
      if (fresh.length) {
        const first = fresh[0];
        const text = `오늘 처리할 노무 일 ${fresh.length}건: ${first.title} ${first.status === 'overdue' ? '(기한 지남)' : first.dLabel}${fresh.length > 1 ? ` 외 ${fresh.length - 1}건` : ''}`;
        let detail = '카카오 연결 대기 — 보내지 않음';
        kakao = 'not-connected';
        if (kakaoOn && linked.has(wp.owner_id)) {
          try {
            await K.sendMemo(db, wp.owner_id, `[사람샘각] ${text}`);
            await K.recordResult(db, wp.owner_id, base, null);
            kakao = 'sent';
            detail = '';
          } catch (e) {
            await K.recordResult(db, wp.owner_id, base, e);
            kakao = 'failed';
            detail = String(e instanceof Error ? e.message : e).slice(0, 200);
          }
        }
        await db.from('notification_log').insert(
          fresh.map((d) => ({ workplace_id: wp.id, deadline_key: d.key, channel: 'kakao', sent_on: base, status: kakao === 'sent' ? 'delivered' : kakao!, detail })),
        );
        await must(db.from('notifications').insert({
          workplace_id: wp.id,
          recipient: 'owner',
          kind: 'dailyDigest',
          text,
          link: '/owner/deadlines',
          kakao_status: kakao,
        }));
      }
      summary.push({ workplaceId: wp.id, alerts: fresh.length, skipped, kakao });
    }
    // 카카오 갱신 토큰은 2달 동안 안 쓰면 만료된다 — 만료 한 달 안쪽이면 오늘 미리 갱신해 둔다
    let kakaoRefreshed = 0;
    if (kakaoOn) {
      const soon = new Date(Date.now() + 31 * 86_400_000).toISOString();
      const stale = await must(db.from('kakao_links').select('user_id, last_sent_on').lt('refresh_expires_at', soon));
      for (const l of stale) {
        if (l.last_sent_on === today) continue;
        try {
          await K.refreshLink(db, l.user_id);
          kakaoRefreshed++;
        } catch (e) {
          // 만료·철회된 연결만 지운다 (다시 연결 안내). 일시 오류는 다음 날 다시 시도
          if (e instanceof K.KakaoError && e.code === 'TOKEN_EXPIRED') await db.from('kakao_links').delete().eq('user_id', l.user_id);
        }
      }
    }
    const { data: retention, error: re } = await db.rpc('run_retention');
    if (re) throw re;
    return json(req, { ok: true, date: today, workplaces: summary.length, summary, kakao: { on: kakaoOn, linked: linked.size, refreshed: kakaoRefreshed }, retention });
  } catch (e) {
    return handleError(req, e);
  }
}
