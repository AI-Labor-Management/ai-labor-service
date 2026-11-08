// 공공데이터포털(data.go.kr) API — 함수 비밀 값 DATA_GO_KR_KEY(계정당 하나인 일반 인증키)
//  · 한국천문연구원_특일 정보 SpcdeInfoService/getRestDeInfo — 공휴일·대체공휴일
//  · 한국관광공사_국문 관광정보 서비스_GW KorService2/searchFestival2 — 지역 축제·행사
// 키 값은 응답·로그에 넣지 않는다.

export const dataGoKrConfigured = () => !!Deno.env.get('DATA_GO_KR_KEY');
const key = () => Deno.env.get('DATA_GO_KR_KEY') ?? '';

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
  return { status: r.status, body, text: text.replaceAll(key(), '***').slice(0, 1500) };
}

/** 진단 — 두 API의 실제 응답 앞부분 (health?check=datagokr). 사용자 정보는 보내지 않는다 */
export async function checkDataGoKr() {
  if (!dataGoKrConfigured()) return { ok: false, detail: 'DATA_GO_KR_KEY 없음' };
  const out: Record<string, unknown> = {};
  try {
    const h = await getJson('https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo', { solYear: '2026', numOfRows: '50', pageNo: '1' });
    out.holidays = { status: h.status, sample: h.text };
  } catch (e) {
    out.holidays = { error: e instanceof Error ? e.message : String(e) };
  }
  try {
    const f = await getJson('https://apis.data.go.kr/B551011/KorService2/searchFestival2', {
      MobileOS: 'ETC',
      MobileApp: 'saram-saemgak',
      eventStartDate: '20261101',
      areaCode: '1',
      numOfRows: '3',
      pageNo: '1',
      arrange: 'A',
    });
    out.festivals = { status: f.status, sample: f.text };
  } catch (e) {
    out.festivals = { error: e instanceof Error ? e.message : String(e) };
  }
  return { ok: true, ...out };
}
