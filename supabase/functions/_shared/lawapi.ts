// 법제처 국가법령정보 OPEN API (DRF) — 함수 비밀 값 LAW_API_OC (open.law.go.kr에서 정한 인증키 아이디)
//  · 신청 정보: 도메인 smbxhspzflnvncatdgjs.supabase.co (2026-11-08 승인). 서버 IP는 고정이 아니라 등록하지 않았다.
//  · 법령 검색 lawSearch.do, 본문 lawService.do — type=JSON
// OC 값은 응답·로그에 넣지 않는다.

export const lawApiConfigured = () => !!Deno.env.get('LAW_API_OC');
const oc = () => Deno.env.get('LAW_API_OC') ?? '';
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
