// Edge Function `cron-daily` — 하루 1번(pg_cron) 기한 알림을 만들고 보관 기간을 정리한다 (verify_jwt = false, x-cron-secret 검사)
// 알림 규칙(11_F4): 30·7·3일 전 + 당일, 매달 반복(급여일)은 3일 전·당일, 기한이 지나면 다음 날 한 번 위험 알림.
// 채널: 앱 안 알림만 실제로 쌓는다. 카카오는 연결 대기라 발송 기록에 'not-connected'로 남기고 보내지 않는다.
import { engine as E } from '../_shared/engine.ts';
import { kstToday, loadWorkplace, must, serviceClient } from '../_shared/db.ts';
import { corsHeaders, handleError, HttpError, json } from '../_shared/http.ts';

export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  try {
    const db = serviceClient();
    const secret = req.headers.get('x-cron-secret') ?? '';
    const { data: ok, error } = await db.rpc('verify_cron_secret', { p_secret: secret });
    if (error) throw error;
    if (!ok) throw new HttpError(401, 'cron 비밀 값이 맞지 않아요');

    const today = kstToday();
    const kakao = (await must(db.from('app_settings').select('value').eq('key', 'kakao_enabled')))[0]?.value === true;
    const workplaces = await must(db.from('workplaces').select('id, base_date_override'));
    const summary: { workplaceId: string; alerts: number; skipped: number }[] = [];
    for (const wp of workplaces) {
      // 기준일을 고정한 데모 사업장은 그 날짜로 계산한다
      const base = wp.base_date_override ?? today;
      const { state } = await loadWorkplace(db, wp.id, today);
      const due = E.computeDeadlines(state, base).filter(
        (d) => d.status !== 'done' && d.status !== 'onboarding' && (d.alerts.includes(base) || d.days === -1),
      );
      let alerts = 0;
      let skipped = 0;
      const fresh: typeof due = [];
      for (const d of due) {
        // 같은 기한·같은 날에는 한 번만 (unique 제약)
        const { error: e1 } = await db.from('notification_log').insert({ workplace_id: wp.id, deadline_key: d.key, channel: 'inApp', sent_on: base, status: 'delivered' });
        if (e1) {
          skipped++;
          continue;
        }
        await db.from('notification_log').insert({ workplace_id: wp.id, deadline_key: d.key, channel: 'kakao', sent_on: base, status: kakao ? 'failed' : 'not-connected', detail: kakao ? '발송 모듈 미구현' : '카카오 연결 대기 — 보내지 않음' });
        fresh.push(d);
        alerts++;
      }
      if (fresh.length) {
        const first = fresh[0];
        await must(db.from('notifications').insert({
          workplace_id: wp.id,
          recipient: 'owner',
          kind: 'dailyDigest',
          text: `오늘 처리할 노무 일 ${fresh.length}건: ${first.title} ${first.status === 'overdue' ? '(기한 지남)' : first.dLabel}${fresh.length > 1 ? ` 외 ${fresh.length - 1}건` : ''}`,
          link: '/owner/deadlines',
          kakao_status: 'not-connected',
        }));
      }
      summary.push({ workplaceId: wp.id, alerts, skipped });
    }
    const { data: retention, error: re } = await db.rpc('run_retention');
    if (re) throw re;
    return json(req, { ok: true, date: today, workplaces: summary.length, summary, retention });
  } catch (e) {
    return handleError(req, e);
  }
}
