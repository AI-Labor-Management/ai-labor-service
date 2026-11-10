// 공공데이터포털 응답 해석 — Deno·Node 공통 순수 부분 (tests/backend/datagokr.test.ts)

export interface ApiHoliday {
  date: string; // YYYY-MM-DD
  name: string;
}

/** data.go.kr 응답의 items.item은 하나면 객체, 여러 개면 배열, 없으면 빈 문자열이다 */
export function itemsOf(json: unknown): Record<string, unknown>[] {
  const body = (json as { response?: { body?: { items?: unknown } } })?.response?.body;
  const items = body?.items as { item?: unknown } | string | undefined;
  if (!items || typeof items !== 'object') return [];
  const it = items.item;
  if (Array.isArray(it)) return it as Record<string, unknown>[];
  return it && typeof it === 'object' ? [it as Record<string, unknown>] : [];
}

/** 응답 머리말의 결과 코드 — 정상은 '00'(특일정보) 또는 '0000'(관광정보) */
export function resultCode(json: unknown): string | null {
  const h = (json as { response?: { header?: { resultCode?: unknown } } })?.response?.header;
  return h?.resultCode != null ? String(h.resultCode) : null;
}

/** 특일정보 getRestDeInfo → 공휴일 목록 (isHoliday = 'Y'만, 날짜순·중복 제거) */
export function parseHolidays(json: unknown): ApiHoliday[] {
  const seen = new Map<string, string>();
  for (const it of itemsOf(json)) {
    if (String(it.isHoliday ?? 'Y') !== 'Y') continue;
    const d = String(it.locdate ?? '');
    if (!/^\d{8}$/.test(d)) continue;
    const date = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
    const name = String(it.dateName ?? '').trim() || '공휴일';
    seen.set(date, seen.has(date) ? `${seen.get(date)}·${name}` : name);
  }
  return [...seen].sort(([a], [b]) => a.localeCompare(b)).map(([date, name]) => ({ date, name }));
}

/** 내장 목록과 API 목록 비교 — 같은 해에 한쪽에만 있는 날짜 (점검 화면용) */
export function diffHolidays(builtIn: string[], api: ApiHoliday[], year: number) {
  const y = String(year);
  const a = new Set(builtIn.filter((d) => d.startsWith(y)));
  const b = new Set(api.map((h) => h.date).filter((d) => d.startsWith(y)));
  return { onlyBuiltIn: [...a].filter((d) => !b.has(d)).sort(), onlyApi: [...b].filter((d) => !a.has(d)).sort() };
}

// ───────────────────────── 한국관광공사 TourAPI (국문 관광정보 서비스_GW, KorService2) ─────────────────────────

export interface TourRegion {
  code: string; // 시도 2자리 또는 시군구 3자리 (법정동 코드)
  name: string;
}
export interface TourEvent {
  id: string;
  title: string;
  start: string; // YYYY-MM-DD
  end: string;
  addr: string;
}

const iso8 = (v: unknown) => {
  const d = String(v ?? '');
  return /^\d{8}$/.test(d) ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : '';
};

/** ldongCode2 응답 → 지역 목록. 응답 칸 이름이 code/name 이거나 lDong…Cd/lDong…Nm 이어도 읽는다 */
export function parseRegions(json: unknown, level: 'sido' | 'sigungu'): TourRegion[] {
  const out: TourRegion[] = [];
  for (const it of itemsOf(json)) {
    const code = String(it.code ?? (level === 'sido' ? it.lDongRegnCd : it.lDongSignguCd) ?? '').trim();
    const name = String(it.name ?? (level === 'sido' ? it.lDongRegnNm : it.lDongSignguNm) ?? '').trim();
    if (!code || !name || !(level === 'sido' ? /^\d{2}$/ : /^\d{3}$/).test(code)) continue;
    if (!out.some((r) => r.code === code)) out.push({ code, name });
  }
  return out.sort((a, b) => a.code.localeCompare(b.code));
}

/** searchFestival2 응답 → 행사 목록 (제목·기간·주소만 — 사진은 이용 조건이 따로 있어 쓰지 않는다) */
export function parseFestivals(json: unknown): TourEvent[] {
  const out: TourEvent[] = [];
  for (const it of itemsOf(json)) {
    const start = iso8(it.eventstartdate);
    const end = iso8(it.eventenddate) || start;
    const title = String(it.title ?? '').trim();
    if (!start || !title) continue;
    out.push({ id: String(it.contentid ?? `${title}-${start}`), title: title.slice(0, 120), start, end, addr: [it.addr1, it.addr2].map((x) => String(x ?? '').trim()).filter(Boolean).join(' ').slice(0, 160) });
  }
  return out;
}

/** 기간 [from, to] 와 겹치는 행사만, 시작일 순 */
export function eventsBetween(events: TourEvent[], from: string, to: string): TourEvent[] {
  return events.filter((e) => e.start <= to && e.end >= from).sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
}
