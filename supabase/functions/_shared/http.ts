// 공통 HTTP 처리: CORS, JSON 응답, 오류, 아주 작은 라우터
const ALLOWED_ORIGINS = new Set([
  // 사람샘각 공개 사이트 (2026-11-10~, GitHub Pages + 자체 도메인)
  'https://saram.dreamhelixion.com',
  // 예전 사람샘각 주소(새 주소로 넘어감)와 이 저장소의 체험 사이트
  'https://ai-labor-management.github.io',
  // 사람샘각 공개 사이트 (AI-Labor-Management/saram-saemgak, OpenAI Sites)
  'https://ai-labor-service-draft-sj.gold89765.chatgpt.site',
  'http://localhost:5173',
  'http://localhost:4173',
]);

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const extra = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const allowed = ALLOWED_ORIGINS.has(origin) || extra.includes(origin);
  return {
    ...(allowed ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };
}

export class HttpError extends Error {
  constructor(public status: number, message: string, public detail?: unknown) {
    super(message);
  }
}

export const bad = (msg: string, detail?: unknown) => new HttpError(400, msg, detail);
export const forbidden = (msg = '권한이 없어요') => new HttpError(403, msg);
export const notFound = (msg = '찾을 수 없어요') => new HttpError(404, msg);
export const conflict = (msg: string) => new HttpError(409, msg);

export function json(req: Request, body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(req), ...headers },
  });
}

export function text(req: Request, body: string, contentType: string, headers: Record<string, string> = {}): Response {
  return new Response(body, { status: 200, headers: { 'Content-Type': contentType, ...corsHeaders(req), ...headers } });
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  if (req.method === 'GET') return {} as T;
  try {
    const t = await req.text();
    return (t ? JSON.parse(t) : {}) as T;
  } catch {
    throw bad('요청 본문이 올바른 JSON이 아니에요');
  }
}

/** /functions/v1/<name>/a/b → 'a/b' */
export function subPath(req: Request, fnName: string): string {
  const p = new URL(req.url).pathname;
  const i = p.indexOf(`/${fnName}`);
  return (i >= 0 ? p.slice(i + fnName.length + 1) : p).replace(/^\/+|\/+$/g, '');
}

export function handleError(req: Request, e: unknown): Response {
  if (e instanceof HttpError) return json(req, { error: e.message, detail: e.detail ?? null }, e.status);
  // DB 오류(트리거·제약)는 사용자에게 보여줄 문구를 담고 있다
  const pg = e as { message?: string; code?: string; details?: string };
  if (pg && typeof pg.message === 'string' && pg.code) {
    const status = pg.code === '42501' ? 403 : pg.code === '23505' ? 409 : 400;
    return json(req, { error: pg.message, code: pg.code }, status);
  }
  console.error('unhandled', e);
  return json(req, { error: '서버 오류가 났어요. 잠시 후 다시 시도하세요' }, 500);
}

// ---- 입력 검사 ----
export function str(v: unknown, name: string, max = 200, required = true): string {
  if (v === undefined || v === null || v === '') {
    if (required) throw bad(`${name}을(를) 입력하세요`);
    return '';
  }
  if (typeof v !== 'string') throw bad(`${name} 형식이 올바르지 않아요`);
  const s = v.trim();
  if (required && !s) throw bad(`${name}을(를) 입력하세요`);
  if (s.length > max) throw bad(`${name}은(는) ${max}자 이내로 적어 주세요`);
  return s;
}

export function oneOf<T extends string>(v: unknown, name: string, options: readonly T[]): T {
  if (typeof v !== 'string' || !options.includes(v as T)) throw bad(`${name} 값이 올바르지 않아요 (${options.join(' / ')})`);
  return v as T;
}

export function uuid(v: unknown, name: string): string {
  if (typeof v !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) throw bad(`${name} 값이 올바르지 않아요`);
  return v;
}

export function int(v: unknown, name: string, min = -1e12, max = 1e12): number {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isFinite(n) || Math.round(n) !== n || n < min || n > max) throw bad(`${name}은(는) ${min}~${max} 사이 정수여야 해요`);
  return n;
}
