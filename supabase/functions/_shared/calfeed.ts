// 구글 캘린더 연결 (구독 주소) — DB 처리. 표 calendar_feeds는 직접 접근 없이 서비스 키로만 다룬다 (마이그레이션 21).
import { engine as E } from './engine.ts';
import { type Db, kstToday, loadWorkplace, serviceClient } from './db.ts';
import { bad } from './http.ts';
import { feedLinks, newFeedToken, type FeedLinks } from './calfeed-core.ts';

export interface FeedStatus {
  connected: boolean;
  links: FeedLinks | null;
  createdAt: string | null;
  /** 캘린더 앱이 마지막으로 읽어 간 때 (연결이 됐는지 확인용) */
  lastFetchedAt: string | null;
}

const projectUrl = () => Deno.env.get('SUPABASE_URL')!;

type FeedRow = { workplace_id: string; token: string; created_at: string; last_fetched_at: string | null };

function status(row: FeedRow | null): FeedStatus {
  if (!row) return { connected: false, links: null, createdAt: null, lastFetchedAt: null };
  return { connected: true, links: feedLinks(projectUrl(), row.token), createdAt: row.created_at, lastFetchedAt: row.last_fetched_at };
}

async function readFeed(workplaceId: string): Promise<FeedRow | null> {
  const { data, error } = await serviceClient().from('calendar_feeds' as never).select('workplace_id, token, created_at, last_fetched_at').eq('workplace_id', workplaceId).maybeSingle();
  if (error) throw error;
  return (data as FeedRow | null) ?? null;
}

/** 사장님: 상태 보기 */
export async function feedStatus(workplaceId: string): Promise<FeedStatus> {
  return status(await readFeed(workplaceId));
}

/** 사장님: 만들기(없으면) · 다시 만들기(예전 주소 끊김) · 끊기 */
export async function feedAction(workplaceId: string, userId: string, action: unknown): Promise<FeedStatus> {
  const db = serviceClient();
  if (action === 'delete') {
    const { error } = await db.from('calendar_feeds' as never).delete().eq('workplace_id', workplaceId);
    if (error) throw error;
    return status(null);
  }
  if (action !== 'create' && action !== 'rotate') throw bad("action은 'create' · 'rotate' · 'delete' 중 하나예요");
  const existing = await readFeed(workplaceId);
  if (existing && action === 'create') return status(existing);
  const row = { workplace_id: workplaceId, token: newFeedToken(), created_by: userId, created_at: new Date().toISOString(), last_fetched_at: null };
  const { error } = await db.from('calendar_feeds' as never).upsert(row as never, { onConflict: 'workplace_id' });
  if (error) throw error;
  return status(row);
}

/** 캘린더 앱: 구독 주소 읽기. 모르는 토큰이면 null (404) */
export async function feedIcs(token: string, now = new Date()): Promise<string | null> {
  const db: Db = serviceClient();
  const { data, error } = await db.from('calendar_feeds' as never).select('workplace_id').eq('token', token).maybeSingle();
  if (error) throw error;
  const feed = data as { workplace_id: string } | null;
  if (!feed) return null;
  const today = kstToday();
  const { rows, state } = await loadWorkplace(db, feed.workplace_id, today);
  const base = (rows.workplace as { base_date_override?: string | null }).base_date_override ?? today;
  const items = E.computeDeadlines(state, base).filter((d) => d.status !== 'done');
  const name = (rows.workplace as { name?: string }).name?.trim();
  // 읽어 간 때 기록 (실패해도 일정은 돌려준다)
  await db.from('calendar_feeds' as never).update({ last_fetched_at: now.toISOString() } as never).eq('workplace_id', feed.workplace_id);
  return E.buildIcs(items, now, { subscription: true, calName: name ? `사람샘각 · ${name}` : '사람샘각 노무 기한' });
}
