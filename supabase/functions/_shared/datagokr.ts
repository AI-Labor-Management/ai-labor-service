// 공공데이터포털(data.go.kr) API — 함수 비밀 값 DATA_GO_KR_KEY(계정당 하나인 일반 인증키)
//  · 한국천문연구원_특일 정보 SpcdeInfoService/getRestDeInfo — 공휴일·대체공휴일 → holidays_api (cron-daily, 매달 1일)
//  · 한국관광공사_국문 관광정보 서비스_GW KorService2/searchFestival2 — 지역 축제·행사
// 키 값은 응답·로그에 넣지 않는다. 응답 해석은 datagokr-core.ts(순수, 시험 있음).
import type { Db } from './db.ts';
import { engine as E } from './engine.ts';
import { type ApiHoliday, diffHolidays, eventsBetween, parseFestivals, parseHolidays, parseRegions, resultCode, type TourEvent, type TourRegion } from './datagokr-core.ts';

export const dataGoKrConfigured = () => !!Deno.env.get('DATA_GO_KR_KEY');
const rawKey = () => (Deno.env.get('DATA_GO_KR_KEY') ?? '').trim();
// 포털은 인증키를 두 형태로 보여준다 — Encoding(%2B 등으로 바뀐 값)과 Decoding(원래 값).
// 아래 URLSearchParams가 한 번 인코딩하므로 원래 값을 써야 한다. Encoding 키를 저장했으면 되돌린다.
const key = () => {
  const k = rawKey();
  if (!k.includes('%')) return k;
  try {
    return decodeURIComponent(k);
  } catch {
    return k;
  }
};
/** 키 형태 (값은 알려주지 않는다) — 점검용 */
const keyShape = () => {
  const k = rawKey();
  return { length: k.length, encodedForm: k.includes('%'), hasPlusSlashEq: /[+/=]/.test(k), hasSpace: /\s/.test(Deno.env.get('DATA_GO_KR_KEY') ?? '') };
};
const redact = (text: string) => [rawKey(), key()].filter(Boolean).reduce((t, k) => t.replaceAll(k, '***'), text);

const HOLIDAY_URL = 'https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo';
const FESTIVAL_URL = 'https://apis.data.go.kr/B551011/KorService2/searchFestival2';
const LDONG_URL = 'https://apis.data.go.kr/B551011/KorService2/ldongCode2';
const TOUR = { MobileOS: 'ETC', MobileApp: 'saram-saemgak' };

async function getJson(url: string, params: Record<string, string>): Promise<{ status: number; body: unknown; text: string }> {
  const q = new URLSearchParams({ serviceKey: key(), _type: 'json', ...params });
  const r = await fetch(`${url}?${q}`, { signal: AbortSignal.timeout(15_000) });
  const text = await r.text();
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  return { status: r.status, body, text: redact(text).slice(0, 1500) };
}

/** 한 해 공휴일 (특일정보). 실패하면 예외 — 결과 코드와 앞부분을 담는다 */
export async function fetchHolidayYear(year: number): Promise<ApiHoliday[]> {
  const r = await getJson(HOLIDAY_URL, { solYear: String(year), numOfRows: '100', pageNo: '1' });
  if (r.status !== 200 || resultCode(r.body) !== '00') throw new Error(`특일정보 ${year}: HTTP ${r.status} ${r.text.slice(0, 200)}`);
  return parseHolidays(r.body);
}

/** 올해·내년 공휴일을 받아 holidays_api를 그 해 기준으로 바꾼다 (그 해에 없어진 날은 지운다) */
export async function syncHolidays(db: Db, thisYear: number): Promise<{ year: number; count: number }[]> {
  const out: { year: number; count: number }[] = [];
  for (const year of [thisYear, thisYear + 1]) {
    const list = await fetchHolidayYear(year);
    // 다음 해 월력요항이 아직 없으면(보통 6월 발표 전) 빈 목록 — 있던 자료를 지우지 않는다
    if (!list.length) {
      out.push({ year, count: 0 });
      continue;
    }
    const { error: e1 } = await db.from('holidays_api').delete().gte('date', `${year}-01-01`).lte('date', `${year}-12-31`);
    if (e1) throw e1;
    const { error: e2 } = await db.from('holidays_api').insert(list.map((h) => ({ date: h.date, name: h.name.slice(0, 60), fetched_at: new Date().toISOString() })));
    if (e2) throw e2;
    out.push({ year, count: list.length });
  }
  loadedAt = 0; // 다음 계산 때 다시 읽게
  return out;
}

/** 저장된 API 공휴일을 계산 엔진에 더한다 (내장 목록이 우선). 함수 인스턴스마다 1시간에 한 번 읽는다 */
let loadedAt = 0;
export async function ensureHolidays(db: Db): Promise<void> {
  if (Date.now() - loadedAt < 3_600_000) return;
  loadedAt = Date.now();
  const { data, error } = await db.from('holidays_api').select('date, name').order('date');
  if (error || !data) return; // 공휴일 보강은 부가 기능 — 실패해도 계산은 내장 목록으로 계속한다
  E.registerHolidays(data as ApiHoliday[]);
}

/** 내장 목록과 API가 다른 날 (같은 해) — 점검용 */
export async function holidayDiff(db: Db, years: number[]) {
  const { data } = await db.from('holidays_api').select('date, name').order('date');
  const api = (data ?? []) as ApiHoliday[];
  const builtIn = [...E.HOLIDAYS, ...E.WEEKEND_HOLIDAYS].map((h) => h.date);
  return years.map((y) => ({ year: y, ...diffHolidays(builtIn, api, y) }));
}

// ───────── 지역 행사 (한국관광공사 TourAPI) — 공개 정보라 로그인 없이 public-api가 내준다. 함수 인스턴스마다 잠시 기억해 호출을 아낀다
const tourCache = new Map<string, { at: number; v: unknown }>();
async function remember<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = tourCache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.v as T;
  const v = await fn();
  if (tourCache.size > 500) tourCache.clear();
  tourCache.set(key, { at: Date.now(), v });
  return v;
}
const ymd8 = (iso: string) => iso.replaceAll('-', '');
const addDaysIso = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** 시도 목록(sido 없이) 또는 그 시도의 시군구 목록 */
export async function tourRegions(sido?: string): Promise<TourRegion[]> {
  return remember(`regions:${sido ?? ''}`, 24 * 3_600_000, async () => {
    const r = await getJson(LDONG_URL, { ...TOUR, numOfRows: '100', pageNo: '1', ...(sido ? { lDongRegnCd: sido } : {}) });
    if (r.status !== 200 || resultCode(r.body) !== '0000') throw new Error(`지역 목록: HTTP ${r.status} ${r.text.slice(0, 160)}`);
    return parseRegions(r.body, sido ? 'sigungu' : 'sido');
  });
}

/** 그 지역에서 [from, from+days] 동안 열리는 축제·행사. 이미 시작해 진행 중인 행사도 넣으려고 90일 앞부터 찾아 기간으로 거른다 */
export async function tourEvents(sido: string, sigungu: string | null, from: string, days: number): Promise<TourEvent[]> {
  const to = addDaysIso(from, days);
  return remember(`events:${sido}:${sigungu ?? ''}:${from}:${days}`, 6 * 3_600_000, async () => {
    const r = await getJson(FESTIVAL_URL, {
      ...TOUR,
      eventStartDate: ymd8(addDaysIso(from, -90)),
      lDongRegnCd: sido,
      ...(sigungu ? { lDongSignguCd: sigungu } : {}),
      numOfRows: '300',
      pageNo: '1',
      arrange: 'A',
    });
    if (r.status !== 200 || resultCode(r.body) !== '0000') throw new Error(`지역 행사: HTTP ${r.status} ${r.text.slice(0, 160)}`);
    return eventsBetween(parseFestivals(r.body), from, to);
  });
}

/** 진단 — 두 API의 실제 응답 앞부분 (health?check=datagokr). 사용자 정보는 보내지 않는다 */
export async function checkDataGoKr() {
  if (!dataGoKrConfigured()) return { ok: false, detail: 'DATA_GO_KR_KEY 없음' };
  const out: Record<string, unknown> = { keyShape: keyShape() };
  try {
    const h = await getJson(HOLIDAY_URL, { solYear: '2026', numOfRows: '50', pageNo: '1' });
    out.holidays = { status: h.status, resultCode: resultCode(h.body), parsed: parseHolidays(h.body).length, sample: h.text.slice(0, 600) };
  } catch (e) {
    out.holidays = { error: e instanceof Error ? e.message : String(e) };
  }
  try {
    const f = await getJson(FESTIVAL_URL, { ...TOUR, eventStartDate: '20261101', lDongRegnCd: '11', numOfRows: '3', pageNo: '1', arrange: 'A' });
    out.festivals = { status: f.status, resultCode: resultCode(f.body), parsed: parseFestivals(f.body).length, sample: f.text.slice(0, 900) };
    const g = await getJson(LDONG_URL, { ...TOUR, numOfRows: '3', pageNo: '1', lDongRegnCd: '11' });
    out.regions = { status: g.status, resultCode: resultCode(g.body), parsed: parseRegions(g.body, 'sigungu').length, sample: g.text.slice(0, 500) };
  } catch (e) {
    out.festivals = { error: e instanceof Error ? e.message : String(e) };
  }
  return { ok: true, ...out };
}
