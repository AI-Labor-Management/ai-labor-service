// Supabase 클라이언트·인증·사업장 데이터 읽기 (서비스 역할 키는 함수 환경에만 있고 밖으로 나가지 않는다)
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import type { Database } from './database.types.ts';
import { type WorkplaceRows, WORKPLACE_TABLES, rowsToState } from './mapping.ts';
import { HttpError } from './http.ts';
import type { AppState } from './domain-types.ts';

export type Db = SupabaseClient<Database>;

// supabase-js의 createClient는 진입점(index.ts)이 넣어 준다. 묶음(_dist/*.js)이 jsr 모듈을 직접 가져오지 않게 하기 위함
type CreateClient = (url: string, key: string, options?: Record<string, unknown>) => Db;
let createClient: CreateClient | null = null;
export function setCreateClient(fn: unknown) {
  createClient = fn as CreateClient;
}
function cc(): CreateClient {
  if (!createClient) throw new Error('createClient가 설정되지 않았어요 (index.ts에서 setCreateClient 호출)');
  return createClient;
}

function serviceKey(): string {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  // 새 API 키 체계: SUPABASE_SECRET_KEYS = {"default":"sb_secret_..."}
  const keys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (keys) {
    const parsed = JSON.parse(keys) as Record<string, string>;
    const first = parsed.default ?? Object.values(parsed)[0];
    if (first) return first;
  }
  throw new Error('서비스 키 환경변수가 없어요');
}

let admin: Db | null = null;
export function serviceClient(): Db {
  admin ??= cc()(Deno.env.get('SUPABASE_URL')!, serviceKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}

/** 요청의 사용자 토큰을 검증해 사용자 id를 돌려준다 */
export async function requireUser(req: Request): Promise<{ id: string; email: string | null; token: string }> {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, '로그인이 필요해요');
  const { data, error } = await serviceClient().auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, '로그인이 필요해요 (토큰이 만료됐거나 올바르지 않아요)');
  return { id: data.user.id, email: data.user.email ?? null, token };
}

function anonKey(): string {
  const legacy = Deno.env.get('SUPABASE_ANON_KEY');
  if (legacy) return legacy;
  const keys = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS');
  if (keys) {
    const parsed = JSON.parse(keys) as Record<string, string>;
    const first = parsed.default ?? Object.values(parsed)[0];
    if (first) return first;
  }
  throw new Error('공개 키 환경변수가 없어요');
}

/** 사용자 권한으로 PostgREST·RPC를 호출하는 클라이언트 (RLS 적용) */
export function userClient(token: string): Db {
  return cc()(Deno.env.get('SUPABASE_URL')!, anonKey(), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function kstToday(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}

export function kstNowHHMM(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(11, 16);
}

/** 오류면 던지고 데이터를 돌려준다. select/single 결과에 쓴다 (select 없는 insert의 반환값은 쓰지 않는다) */
export async function must<T>(p: PromiseLike<{ data: T; error: unknown }>): Promise<NonNullable<T>> {
  const { data, error } = await p;
  if (error) throw error;
  return data as NonNullable<T>;
}

/** 한 사업장 데이터를 모두 읽어 계산 엔진 상태로 바꾼다 */
export async function loadWorkplace(db: Db, workplaceId: string, today = kstToday()): Promise<{ rows: WorkplaceRows; state: AppState }> {
  const wp = await must(db.from('workplaces').select('*').eq('id', workplaceId).single());
  const since = new Date(Date.parse(today) - 430 * 86400_000).toISOString().slice(0, 10);
  const results = await Promise.all(
    WORKPLACE_TABLES.map((t) => {
      let q = db.from(t).select('*').eq('workplace_id', workplaceId);
      if (t === 'attendance_records') q = q.gte('date', since);
      if (t === 'notifications') q = q.order('created_at', { ascending: false }).limit(200);
      return must(q.limit(5000)).then((data) => [t, data] as const);
    }),
  );
  const rows = { workplace: wp, ...Object.fromEntries(results) } as unknown as WorkplaceRows;
  return { rows, state: rowsToState(rows) };
}

export async function ownerWorkplace(db: Db, userId: string) {
  const { data, error } = await db.from('workplaces').select('*').eq('owner_id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function pushNotification(db: Db, n: Database['public']['Tables']['notifications']['Insert']) {
  await must(db.from('notifications').insert(n));
}
