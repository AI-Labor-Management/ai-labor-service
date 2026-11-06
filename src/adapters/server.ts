// 서버(Supabase) 연결 — 로그인, Edge Function `api` 호출, RPC, 역할별 데이터 읽기.
// 공개 가능한 값(프로젝트 주소·publishable 키)만 쓴다. 서비스 역할 키는 브라우저에 두지 않는다.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createEmptyState } from '../data/seed';
import type { AppState, DemoSession, Employee, GuestConsult } from '../domain/types';
import { WORKPLACE_SCOPED, type Op } from './sync';

const URL_ = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, '');
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** 빌드에 서버 주소·키가 들어 있으면 "로그인해서 서버에 저장" 모드를 고를 수 있다 */
export const serverConfigured = !!(URL_ && KEY);
export const serverUrl = URL_ ?? '';

let client: SupabaseClient | null = null;
export function sb(): SupabaseClient {
  if (!serverConfigured) throw new ServerError('서버 주소가 설정되지 않았어요 (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)');
  client ??= createClient(URL_!, KEY!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'ai-labor/auth' } });
  return client;
}

export class ServerError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}

/** PostgREST·트리거 오류를 사람이 읽을 말로 */
export function friendly(e: unknown): string {
  const m = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e);
  if (/row-level security|permission denied|42501/i.test(m)) return '권한이 없어요 (다른 사업장 데이터이거나 서버가 막은 변경이에요)';
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return '서버에 연결하지 못했어요 (인터넷 연결을 확인하세요)';
  if (/JWT|not authenticated|로그인이 필요/i.test(m)) return '로그인이 만료됐어요. 다시 로그인하세요';
  return m;
}

async function accessToken(): Promise<string> {
  const { data } = await sb().auth.getSession();
  if (!data.session) throw new ServerError('로그인이 필요해요', 401);
  return data.session.access_token;
}

async function call<T>(fn: 'api' | 'public-api', path: string, body?: unknown, method?: string): Promise<T> {
  const headers: Record<string, string> = { apikey: KEY! };
  if (fn === 'api') headers.Authorization = `Bearer ${await accessToken()}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let r: Response;
  try {
    r = await fetch(`${URL_}/functions/v1/${fn}/${path}`, { method: method ?? (body !== undefined ? 'POST' : 'GET'), headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch (e) {
    throw new ServerError(friendly(e));
  }
  const text = await r.text();
  let j: unknown = text;
  try {
    j = JSON.parse(text);
  } catch {
    /* 본문이 JSON이 아님 */
  }
  if (!r.ok) {
    const o = (j && typeof j === 'object' ? j : {}) as { error?: string; message?: string };
    throw new ServerError(o.error ?? o.message ?? `서버 오류 (${r.status})`, r.status);
  }
  return j as T;
}

/** 로그인 필요한 서버 API (/functions/v1/api/...) */
export const api = <T>(path: string, body?: unknown) => call<T>('api', path, body);
/** 로그인 없는 공개 API (/functions/v1/public-api/...) */
export const publicApi = <T>(path: string, body?: unknown) => call<T>('public-api', path, body);

export async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await sb().rpc(name, args);
  if (error) throw new ServerError(friendly(error));
  return data as T;
}

// ───────────────────────── 로그인 ─────────────────────────

export interface Me {
  userId: string;
  roles: {
    owner: { workplaceId: string; name: string; scale: string } | null;
    employee: { employeeId: string; alias: string; workplaceId: string }[];
    firm: string[];
    admin: boolean;
  };
}

export const fetchMe = () => api<Me>('me');

export async function signIn(email: string, password: string) {
  const { error } = await sb().auth.signInWithPassword({ email, password });
  if (error) throw new ServerError(/Invalid login/i.test(error.message) ? '이메일 또는 비밀번호가 맞지 않아요' : /Email not confirmed/i.test(error.message) ? '메일의 확인 링크를 먼저 눌러 주세요' : error.message);
}

/** 가입. 이메일 확인이 켜져 있으면 세션 없이 돌아온다(needsConfirm) */
export async function signUp(email: string, password: string, redirectPath = 'start'): Promise<{ needsConfirm: boolean }> {
  const { data, error } = await sb().auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}${import.meta.env.BASE_URL}${redirectPath}` } });
  if (error) throw new ServerError(/already registered/i.test(error.message) ? '이미 가입한 이메일이에요. 로그인하세요' : /Password should be/i.test(error.message) ? '비밀번호는 6자 이상이어야 해요' : error.message);
  return { needsConfirm: !data.session };
}

export async function signOut() {
  await sb().auth.signOut();
}

/** 역할 선택(로그인 계정이 가진 역할 중 하나). 없거나 맞지 않으면 기본값 */
export function pickSession(me: Me, wanted: DemoSession | null): DemoSession {
  const r = me.roles;
  if (wanted) {
    if (wanted.role === 'owner') return wanted;
    if (wanted.role === 'employee' && r.employee.some((e) => e.employeeId === wanted.employeeId)) return wanted;
    if (wanted.role === 'firm' && r.firm.length) return wanted;
    if (wanted.role === 'admin' && r.admin) return wanted;
  }
  if (r.owner) return { role: 'owner', employeeId: null };
  if (r.employee.length) return { role: 'employee', employeeId: r.employee[0].employeeId };
  if (r.firm.length) return { role: 'firm', employeeId: null };
  if (r.admin) return { role: 'admin', employeeId: null };
  return { role: 'owner', employeeId: null }; // 새 계정 → 사업장 설정부터
}

// ───────────────────────── 역할별 읽기 ─────────────────────────

export interface ServerIds {
  userId: string;
  workplaceId: string | null;
  payrollIdByMonth: Record<string, string>;
  firmId: string | null;
}

export interface AdminStats {
  workplaces: number;
  employees: number;
  joinedEmployees: number;
  payrollsConfirmed: number;
  consults: number;
  guestConsults: number;
  notifications7d: number;
  kakaoSent: number;
}

export interface Loaded {
  state: AppState;
  ids: ServerIds;
  adminStats: AdminStats | null;
}

interface InboxItem {
  id: string;
  topic: string;
  question: string;
  memo: string;
  shareItems: string[];
  snapshot: AppState['consults'][number]['snapshot'];
  consentAt: string;
  status: string;
  createdAt: string;
  revokedAt?: string;
}

interface GuestItem {
  id: string;
  nickname: string;
  phoneMasked: string;
  contactTime: string;
  topic: string;
  summary: string;
  consents: { collect: string; provide: string };
  createdAt: string;
}

interface DelegatedItem {
  employeeId: string;
  alias: string;
  hireDate: string;
  resignDate: string | null;
  acquisition: string;
  loss: string;
}

/** 노무법인 화면은 사업장 전체가 아니라 RPC 결과만 받는다. 화면(firmScope)이 그대로 쓰도록 같은 모양으로 맞춘다 */
async function loadFirm(me: Me, ids: ServerIds): Promise<Loaded> {
  const [inbox, guests, delegated, comments] = await Promise.all([
    rpc<InboxItem[]>('firm_consult_inbox'),
    rpc<GuestItem[]>('firm_guest_consults'),
    rpc<DelegatedItem[]>('firm_delegated_insurance'),
    sb().from('review_comments').select('id, target, comment, at').order('at', { ascending: false }).limit(100),
  ]);
  if (comments.error) throw new ServerError(friendly(comments.error));
  const s = createEmptyState();
  s.workplace = {
    name: '',
    industry: 'food',
    scale: '1-4',
    familyOnly: false,
    payDay: 10,
    payMonthBasis: 'previous',
    gpsEnabled: false,
    address: '',
    radiusM: 100,
    lateToleranceMin: 5,
    defaultInsuranceMethod: null,
    hourlyLeaveAllowed: false,
    firmInsuranceShareConsent: true, // RPC가 공유 동의한 건만 준다
    createdAt: new Date().toISOString(),
  };
  s.consults = inbox.map((c) => ({
    id: c.id,
    topic: c.topic,
    question: c.question,
    memo: c.memo,
    shareItems: c.shareItems as AppState['consults'][number]['shareItems'],
    employeeIds: [],
    snapshot: c.snapshot,
    consentAt: c.consentAt ?? c.createdAt,
    revokedAt: c.revokedAt ?? null,
    status: (c.status === 'delivered' ? 'demo-delivered' : c.status) as AppState['consults'][number]['status'],
    createdAt: c.createdAt,
  }));
  s.guestConsults = guests.map(
    (g): GuestConsult => ({ id: g.id, nickname: g.nickname, phoneMasked: g.phoneMasked, phoneKey: '', contactTime: g.contactTime, topic: g.topic, summary: g.summary, consents: g.consents, createdAt: g.createdAt, mode: 'demo' }),
  );
  s.employees = delegated.map(
    (d): Employee => ({
      id: d.employeeId, alias: d.alias, ageBand: '18-59', birthDate: null, startedBefore65: null, hireDate: d.hireDate, employmentType: 'regular', contractEnd: null,
      probationEnd: null, foodHandler: false, isForeign: false, foreign: null, school: null, insuranceMethod: 'delegated', registeredAt: d.hireDate, onboarding: 'existing-done',
      resignDate: d.resignDate, resignType: null, account: 'none', invite: null, locationConsent: null, conditionAcks: [], bonusAnnual: 0, leaveAllowanceAnnual: 0, createdAt: d.hireDate,
    }),
  );
  s.insuranceReports = delegated.flatMap((d) =>
    (['acquisition', 'loss'] as const)
      .filter((phase) => d[phase] !== 'none')
      .map((phase) => ({ employeeId: d.employeeId, phase, status: d[phase] as AppState['insuranceReports'][number]['status'], date: null, by: null })),
  );
  s.reviewComments = (comments.data ?? []).map((c) => ({ id: c.id as string, target: c.target as string, comment: c.comment as string, at: c.at as string }));
  return { state: s, ids: { ...ids, firmId: me.roles.firm[0] ?? null }, adminStats: null };
}

export async function loadForSession(me: Me, session: DemoSession): Promise<Loaded> {
  const ids: ServerIds = { userId: me.userId, workplaceId: null, payrollIdByMonth: {}, firmId: null };
  if (session.role === 'owner') {
    try {
      const r = await api<{ state: AppState; ids: { workplaceId: string; payrollIdByMonth: Record<string, string> } }>('owner/state');
      return { state: r.state, ids: { ...ids, workplaceId: r.ids.workplaceId, payrollIdByMonth: r.ids.payrollIdByMonth }, adminStats: null };
    } catch (e) {
      if (e instanceof ServerError && e.status === 404) return { state: createEmptyState(), ids, adminStats: null };
      throw e;
    }
  }
  if (session.role === 'employee') {
    const r = await api<{ state: AppState }>(`employee/state?employeeId=${encodeURIComponent(session.employeeId ?? '')}`);
    return { state: r.state, ids, adminStats: null };
  }
  if (session.role === 'firm') return loadFirm(me, ids);
  const stats = await rpc<AdminStats>('admin_stats');
  return { state: createEmptyState(), ids, adminStats: stats };
}

// ───────────────────────── 동기화 실행 ─────────────────────────


const LABEL: Record<string, string> = {
  workplaces: '사업장', employees: '직원', employee_foreign_info: '외국인 정보', work_conditions: '근로조건', condition_acks: '근로조건 확인',
  substitutions: '대타', shift_overrides: '일정 변경', attendance_records: '출퇴근 기록', attendance_edits: '출퇴근 수정 이력', leave_requests: '연차',
  payroll_months: '급여월', payroll_manual: '급여 직접 입력', insurance_reports: '4대보험 신고', insurance_notices: '보험 고지액', doc_records: '서류',
  doc_requests: '서류 요청', custom_forms: '내 서식', deadline_actions: '기한 처리', risk_answers: '위험 점검 답', offboarding_progress: '퇴사 처리',
  busy_days: '바쁜 날', notifications: '알림', review_comments: '검수 의견',
};

const sameKeys = (a: Record<string, unknown>, b: Record<string, unknown>) => Object.keys(a).sort().join() === Object.keys(b).sort().join();

/** 계획된 요청을 순서대로 보낸다. 같은 표에 연달아 넣는 행은 한 번에 보낸다. 하나라도 실패하면 멈춘다 */
export async function runOps(ops: Op[], workplaceId: string | null): Promise<void> {
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    const what = op.t === 'insert' || op.t === 'update' || op.t === 'delete' ? (LABEL[op.table] ?? op.table) : '';
    try {
      if (op.t === 'insert') {
        const rows = [...op.rows];
        while (i + 1 < ops.length) {
          const nx = ops[i + 1];
          if (nx.t !== 'insert' || nx.table !== op.table || !nx.rows.every((r) => sameKeys(r, rows[0]))) break;
          rows.push(...nx.rows);
          i++;
        }
        const scoped = WORKPLACE_SCOPED.has(op.table) ? rows.map((r) => ({ workplace_id: workplaceId, ...r })) : rows;
        const { error } = await sb().from(op.table).insert(scoped);
        if (error) throw error;
      } else if (op.t === 'update' || op.t === 'delete') {
        let q = op.t === 'update' ? sb().from(op.table).update(op.values) : sb().from(op.table).delete();
        if (WORKPLACE_SCOPED.has(op.table) && workplaceId) q = q.eq('workplace_id', workplaceId);
        for (const [k, v] of Object.entries(op.match)) q = v === null ? q.is(k, null) : q.eq(k, v as string);
        const { error } = await q;
        if (error) throw error;
      } else if (op.t === 'rpc') {
        await rpc(op.name, op.args);
      } else {
        await api(op.path, op.body);
      }
    } catch (e) {
      throw new ServerError(what ? `${what} 저장 실패: ${friendly(e)}` : friendly(e));
    }
  }
}
