// 법제처 국가법령정보 OPEN API (DRF) — 함수 비밀 값 LAW_API_OC (open.law.go.kr에서 정한 인증키 아이디)
//  · 신청 정보: 도메인 smbxhspzflnvncatdgjs.supabase.co (2026-11-08 승인). 서버 IP는 고정이 아니라 등록하지 않았다.
//    호출할 때 그 도메인을 Referer 머리말로 보낸다 — 없으면 '필수입력요소 검증에 실패'로 거절된다 (2026-11-08 확인).
//  · 법령 검색 lawSearch.do, 본문 lawService.do — type=JSON
// OC 값은 응답·로그에 넣지 않는다.

import type { Json } from './database.types.ts';
import type { Db } from './db.ts';
import { engine as E } from './engine.ts';
import * as K from './kakao.ts';
import { alertText, lawRefs, newlyFlagged, type RuleLike, runWatch, type WatchPrev, type WatchRow } from './lawwatch-core.ts';

export const lawApiConfigured = () => !!Deno.env.get('LAW_API_OC');
const oc = () => (Deno.env.get('LAW_API_OC') ?? '').trim();
const REFERER = `${Deno.env.get('SUPABASE_URL') ?? 'https://smbxhspzflnvncatdgjs.supabase.co'}/`;

async function drf(path: 'lawSearch.do' | 'lawService.do', params: Record<string, string>, withReferer: boolean) {
  const q = new URLSearchParams({ OC: oc(), type: 'JSON', ...params });
  const r = await fetch(`https://www.law.go.kr/DRF/${path}?${q}`, {
    headers: withReferer ? { Referer: REFERER } : {},
    signal: AbortSignal.timeout(15_000),
  });
  const text = await r.text();
  return { status: r.status, text: (oc() ? text.replaceAll(oc(), '***') : text).slice(0, 800) };
}

/** 진단 — 근로기준법 검색을 도메인 확인 머리말(Referer) 있이·없이 불러 본다 (health?check=law) */
export async function checkLawApi() {
  if (!lawApiConfigured()) return { ok: false, detail: 'LAW_API_OC 없음' };
  const out: Record<string, unknown> = { ok: true };
  for (const withReferer of [true, false]) {
    try {
      out[withReferer ? 'withReferer' : 'noReferer'] = await drf('lawSearch.do', { target: 'law', query: '근로기준법', display: '3' }, withReferer);
    } catch (e) {
      out[withReferer ? 'withReferer' : 'noReferer'] = { error: e instanceof Error ? e.message : String(e) };
    }
  }
  return out;
}

// ───────────────────────── 법령 변경 감지 ─────────────────────────
// rules.json이 쓰는 조문을 원문과 대조해 law_watch에 저장한다 (판정은 lawwatch-core.ts, 시험 있음).
// cron-daily가 7일마다, 관리자가 화면에서 직접(10분에 한 번까지) 부른다. 새로 확인할 것이 생기면
// 카카오톡을 연결한 관리자에게 나에게 보내기로 한 번 알린다. 값은 자동으로 바꾸지 않는다.

async function drfJson(path: 'lawSearch.do' | 'lawService.do', params: Record<string, string>): Promise<unknown> {
  const q = new URLSearchParams({ OC: oc(), type: 'JSON', ...params });
  const r = await fetch(`https://www.law.go.kr/DRF/${path}?${q}`, { headers: { Referer: REFERER }, signal: AbortSignal.timeout(20_000) });
  const text = await r.text();
  if (!r.ok) throw new Error(`법제처 ${path} HTTP ${r.status}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`법제처 응답을 읽지 못했어요: ${(oc() ? text.replaceAll(oc(), '***') : text).slice(0, 120)}`);
  }
}

export interface LawWatchSummary {
  ranAt: string;
  trigger: 'cron' | 'manual';
  checked: number;
  flagged: number;
  errors: number;
  calls: number;
  ms: number;
  newlyFlagged: string[];
  notified: number;
}

export async function runLawWatch(db: Db, trigger: 'cron' | 'manual'): Promise<LawWatchSummary> {
  if (!lawApiConfigured()) throw new Error('LAW_API_OC 없음');
  const started = Date.now();
  const refs = lawRefs(E.allRules() as unknown as RuleLike[]);
  const { data: prevRows, error: e0 } = await db.from('law_watch').select('key, baseline_hash, baseline_no, status, upcoming, status_since');
  if (e0) throw e0;
  const prev = new Map<string, WatchPrev>((prevRows ?? []).map((r): [string, WatchPrev] => [r.key, r as unknown as WatchPrev]));
  const { rows, calls, errors } = await runWatch(refs, prev, drfJson, { concurrency: 4 });
  const now = new Date().toISOString();
  const fresh = newlyFlagged(rows, prev);
  // 여러 행을 한 번에 upsert하면 어느 행에 없는 칸은 null로 들어간다 — status_since는 모든 행에 넣는다
  // (상태가 바뀐 행은 지금, 아니면 전에 기록한 시각)
  const since = new Map((prevRows ?? []).map((r): [string, string] => [r.key, r.status_since]));
  const { error: e1 } = await db.from('law_watch').upsert(
    rows.map((r: WatchRow) => ({
      ...r,
      upcoming: r.upcoming as unknown as Json,
      checked_at: now,
      status_since: prev.get(r.key)?.status === r.status ? (since.get(r.key) ?? now) : now,
    })),
    { onConflict: 'key' },
  );
  if (e1) throw e1;
  // rules.json에서 빠진 조문은 감시 목록에서도 지운다
  const keep = new Set(rows.map((r) => r.key));
  const gone = (prevRows ?? []).map((r) => r.key).filter((k) => !keep.has(k));
  if (gone.length) await db.from('law_watch').delete().in('key', gone);

  // 새로 확인할 것이 생겼으면 카카오톡을 연결한 관리자에게 알린다 (발송 스위치·키·시행일을 따른다)
  let notified = 0;
  if (fresh.length) {
    const sw = await db.from('app_settings').select('value').eq('key', 'kakao_enabled').maybeSingle();
    const today = new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);
    if (sw.data?.value === true && K.kakaoConfigured() && today >= K.KAKAO_POLICY_FROM) {
      const { data: admins } = await db.from('admins').select('user_id');
      const ids = (admins ?? []).map((a) => a.user_id);
      const { data: linked } = ids.length ? await db.from('kakao_links').select('user_id').in('user_id', ids) : { data: [] };
      for (const l of linked ?? []) {
        try {
          await K.sendMemo(db, l.user_id, alertText(fresh), '/admin');
          notified++;
        } catch (e) {
          if (e instanceof K.KakaoError && e.code === 'TOKEN_EXPIRED') await K.recordResult(db, l.user_id, today, e);
        }
      }
    }
  }
  const summary: LawWatchSummary = {
    ranAt: now,
    trigger,
    checked: rows.length,
    flagged: rows.filter((r) => ['changed', 'amended', 'upcoming', 'missing'].includes(r.status)).length,
    errors,
    calls,
    ms: Date.now() - started,
    newlyFlagged: fresh.map((r) => r.key),
    notified,
  };
  await db.from('law_watch_runs').insert({ ran_at: now, trigger, checked: summary.checked, flagged: summary.flagged, errors, calls, ms: summary.ms, notified, newly: summary.newlyFlagged });
  // 실행 기록은 1년만 둔다
  await db.from('law_watch_runs').delete().lt('ran_at', new Date(Date.now() - 366 * 86_400_000).toISOString());
  return summary;
}

/** 마지막 감지 시각 (cron-daily가 7일 간격을 지키는 데 쓴다) */
export async function lastLawWatchAt(db: Db): Promise<number> {
  const { data } = await db.from('law_watch_runs').select('ran_at').order('ran_at', { ascending: false }).limit(1);
  return data?.[0]?.ran_at ? Date.parse(data[0].ran_at) : 0;
}
