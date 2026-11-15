// 동네 행사 알림 — DB 처리. 표 event_alerts는 직접 접근 없이 서비스 키로만 다룬다 (마이그레이션 22).
import { kstToday, serviceClient } from './db.ts';
import { bad, forbidden } from './http.ts';
import { dataGoKrConfigured } from './datagokr.ts';
import { EVENT_ALERT_DAYS, EVENT_ALERT_POLICY_FROM, type EventRegion, parseRegion } from './eventalerts-core.ts';

export interface EventAlertStatus {
  /** 켜져 있음 (지역이 저장돼 있음) */
  on: boolean;
  region: EventRegion | null;
  /** 지금 켤 수 있음 — 행사 자료(TourAPI) 연결 + 처리방침 변경 시행일 이후 */
  available: boolean;
  policyFrom: string;
  days: readonly number[];
}

type Row = { workplace_id: string; sido: string; sido_name: string; sigungu: string | null; sigungu_name: string };

const toRegion = (r: Row): EventRegion => ({ sido: r.sido, sidoName: r.sido_name, sigungu: r.sigungu, sigunguName: r.sigungu ? r.sigungu_name || null : null });
const available = () => dataGoKrConfigured() && kstToday() >= EVENT_ALERT_POLICY_FROM;

function status(row: Row | null): EventAlertStatus {
  return { on: !!row, region: row ? toRegion(row) : null, available: available(), policyFrom: EVENT_ALERT_POLICY_FROM, days: EVENT_ALERT_DAYS };
}

async function readRow(workplaceId: string): Promise<Row | null> {
  const { data, error } = await serviceClient()
    .from('event_alerts' as never)
    .select('workplace_id, sido, sido_name, sigungu, sigungu_name')
    .eq('workplace_id', workplaceId)
    .maybeSingle();
  if (error) throw error;
  return (data as Row | null) ?? null;
}

/** 사장님: 상태 보기 */
export async function eventAlertStatus(workplaceId: string): Promise<EventAlertStatus> {
  return status(await readRow(workplaceId));
}

/** 사장님: 켜기(지역 저장 · 바꾸기) · 끄기(지역 삭제) */
export async function eventAlertAction(workplaceId: string, userId: string, body: { action?: unknown; region?: unknown }): Promise<EventAlertStatus> {
  const db = serviceClient();
  if (body.action === 'off') {
    const { error } = await db.from('event_alerts' as never).delete().eq('workplace_id', workplaceId);
    if (error) throw error;
    return status(null);
  }
  if (body.action !== 'on') throw bad("action은 'on' · 'off' 중 하나예요");
  if (!available()) throw forbidden(dataGoKrConfigured() ? `행사 알림은 ${EVENT_ALERT_POLICY_FROM}부터 켤 수 있어요` : '지금은 행사 알림을 켤 수 없어요');
  const region = parseRegion(body.region);
  if (!region) throw bad('지역(시·도 코드 2자리, 시·군·구 코드 3자리)을 확인해 주세요');
  const row: Row & { updated_by: string; updated_at: string } = {
    workplace_id: workplaceId,
    sido: region.sido,
    sido_name: region.sidoName,
    sigungu: region.sigungu,
    sigungu_name: region.sigunguName ?? '',
    updated_by: userId,
    updated_at: new Date().toISOString(),
  };
  const { error } = await db.from('event_alerts' as never).upsert(row as never, { onConflict: 'workplace_id' });
  if (error) throw error;
  return status(row);
}

/** 매일 알림용: 켠 사업장들의 지역 */
export async function allEventRegions(): Promise<Map<string, EventRegion>> {
  const { data, error } = await serviceClient().from('event_alerts' as never).select('workplace_id, sido, sido_name, sigungu, sigungu_name');
  if (error) throw error;
  return new Map(((data ?? []) as Row[]).map((r) => [r.workplace_id, toRegion(r)]));
}
