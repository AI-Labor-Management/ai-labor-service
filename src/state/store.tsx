// 앱 상태 저장소. 모든 화면이 같은 AppState(사업장·직원·근로조건 이력 …)를 읽고, 변경은 update()로만 한다.
//  · local 모드: 이 브라우저 localStorage에 통째로 저장 (기존 데모)
//  · server 모드: 로그인한 계정의 역할별 데이터를 서버에서 읽고, update()로 바뀐 부분만 sync.ts가 서버 요청으로 바꿔 보낸다.
//    화면에는 바로 반영(낙관적 갱신)하고, 저장이 끝나면 서버 상태를 다시 읽어 맞춘다(서버가 거절한 변경은 되돌아감).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createStorage, type StorageAdapter } from '../adapters/storage';
import { getMode, switchMode, type Mode } from '../adapters/mode';
import { api, fetchMe, friendly, loadForSession, pickSession, rpc, runOps, sb, signOut, type AdminStats, type Me, type ServerIds } from '../adapters/server';
import { planFor, type SyncCtx } from '../adapters/sync';
import { createEmptyState, createSeed } from '../data/seed';
import { todayLocal } from '../domain/dates';
import type { AppState, DemoSession, ISODate } from '../domain/types';

type Status = 'loading' | 'ready' | 'error';
type Mutator = (draft: AppState) => void;

export interface ServerAuth {
  ready: boolean;
  email: string | null;
  me: Me | null;
}

interface StoreValue {
  state: AppState;
  status: Status;
  loadError: string | null;
  saveError: string | null;
  storageWarning: string | null;
  adapter: StorageAdapter;
  base: ISODate;
  session: DemoSession | null;
  setSession: (s: DemoSession | null) => void;
  update: (mutator: Mutator) => void;
  retryLoad: () => void;
  retrySave: () => void;
  resetEmpty: () => Promise<void>;
  resetSeed: () => Promise<void>;
  replaceState: (s: AppState) => void;
  /** 'local' = 이 브라우저에만, 'server' = 로그인해서 서버에 저장 */
  mode: Mode;
  switchMode: (m: Mode, path?: string) => void;
  /** 서버 모드 로그인 상태 (local 모드에서는 ready=true, me=null) */
  auth: ServerAuth;
  /** 서버로 보내는 중 */
  syncing: boolean;
  /** 관리자 화면 집계 (서버 모드) */
  adminStats: AdminStats | null;
  /** 서버 상태 다시 읽기 (로그인·초대 수락 뒤 등). wanted로 역할을 바꿀 수 있다 */
  refresh: (wanted?: DemoSession | null) => Promise<void>;
  /** 보내지 않은 변경을 지금 보낸다 */
  flushNow: () => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<StoreValue | null>(null);

function uuid(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const b = new Uint8Array(16);
  if (c) c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** 새 항목 id. 서버 표의 uuid 열에 그대로 들어가도록 UUID를 쓴다 (prefix는 읽기 쉽게 남긴 인자) */
export function uid(_prefix: string): string {
  return uuid();
}

export const nowIso = () => new Date().toISOString();

function replay(base: AppState, ms: Mutator[], notes: string[]): AppState {
  let s = base;
  for (const m of ms) {
    const d = structuredClone(s);
    try {
      m(d);
      s = d;
    } catch {
      notes.push('일부 변경은 그 사이 서버 데이터가 바뀌어 적용하지 못했어요');
    }
  }
  return s;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const mode = useMemo(getMode, []);
  const { adapter, warning } = useMemo(() => createStorage(mode), [mode]);
  const [state, setState] = useState<AppState>(createEmptyState);
  const [status, setStatus] = useState<Status>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [session, setSessionState] = useState<DemoSession | null>(() => (mode === 'local' ? adapter.loadSession() : null));
  const [auth, setAuth] = useState<ServerAuth>({ ready: mode === 'local', email: null, me: null });
  const [syncing, setSyncing] = useState(false);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const latest = useRef(state);

  // ───────── local 모드 ─────────
  const loadLocal = useCallback(async () => {
    setStatus('loading');
    setLoadError(null);
    try {
      const s = await adapter.load();
      const next = s ?? createEmptyState();
      latest.current = next;
      setState(next);
      setStatus('ready');
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  }, [adapter]);

  const persistLocal = useCallback(
    async (s: AppState) => {
      try {
        await adapter.save(s);
        setSaveError(null);
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : String(e));
      }
    },
    [adapter],
  );

  // ───────── server 모드 ─────────
  const srv = useRef({
    base: createEmptyState(),
    pending: [] as Mutator[],
    inflight: null as Promise<void> | null,
    timer: 0 as ReturnType<typeof setTimeout> | 0,
    ids: null as ServerIds | null,
    me: null as Me | null,
    session: null as DemoSession | null,
  });

  const show = (s: AppState) => {
    latest.current = s;
    setState(s);
  };

  /** 로그인 확인 → 역할 고르기 → 그 역할의 데이터 읽기 */
  const loadServer = useCallback(
    async (wanted?: DemoSession | null, quiet = false) => {
      const S = srv.current;
      if (!quiet) {
        setStatus('loading');
        setLoadError(null);
      }
      try {
        const { data } = await (await sb()).auth.getSession();
        if (!data.session) {
          Object.assign(S, { me: null, session: null, ids: null, pending: [], base: createEmptyState() });
          show(S.base);
          setAuth({ ready: true, email: null, me: null });
          setSessionState(null);
          setAdminStats(null);
          setStatus('ready');
          return;
        }
        const me = await fetchMe();
        const s = wanted === null ? null : pickSession(me, wanted ?? S.session ?? adapter.loadSession());
        adapter.saveSession(s);
        S.me = me;
        S.session = s;
        setAuth({ ready: true, email: data.session.user.email ?? null, me });
        if (!s) {
          Object.assign(S, { ids: null, pending: [], base: createEmptyState() });
          show(S.base);
          setSessionState(null);
          setStatus('ready');
          return;
        }
        const loaded = await loadForSession(me, s);
        Object.assign(S, { base: loaded.state, ids: loaded.ids, pending: [] });
        show(loaded.state);
        setAdminStats(loaded.adminStats);
        setSessionState(s);
        setStatus('ready');
      } catch (e) {
        if (quiet) setSaveError(friendly(e));
        else {
          setLoadError(friendly(e));
          setStatus('error');
        }
      }
    },
    [adapter],
  );

  const flush = useCallback(async (): Promise<void> => {
    const S = srv.current;
    if (S.timer) {
      clearTimeout(S.timer);
      S.timer = 0;
    }
    if (S.inflight) {
      await S.inflight;
      if (S.pending.length) return flush();
      return;
    }
    if (!S.pending.length || !S.session || !S.me || !S.ids) return;
    const run = (async () => {
      setSyncing(true);
      const batch = S.pending.splice(0);
      const notes: string[] = [];
      let failed: string | null = null;
      try {
        const target = replay(S.base, batch, notes);
        const ctx: SyncCtx = { ...S.ids!, payrollIdByMonth: { ...S.ids!.payrollIdByMonth }, newId: uuid };
        const plan = planFor(S.session!, S.base, target, ctx);
        notes.push(...plan.notes);
        await runOps(plan.ops, ctx.workplaceId);
      } catch (e) {
        failed = friendly(e);
      }
      try {
        const loaded = await loadForSession(S.me!, S.session!);
        S.base = loaded.state;
        S.ids = loaded.ids;
        setAdminStats(loaded.adminStats);
      } catch (e) {
        failed ??= friendly(e);
      }
      show(replay(S.base, S.pending, notes));
      const uniq = [...new Set(notes)];
      setSaveError(failed ? `${failed} — 서버에 저장된 내용으로 되돌렸어요` : uniq.length ? `저장하지 않은 변경: ${uniq.join(' / ')}` : null);
      setSyncing(false);
    })();
    S.inflight = run;
    try {
      await run;
    } finally {
      S.inflight = null;
    }
    if (S.pending.length) S.timer = setTimeout(() => void flush(), 350);
  }, []);

  useEffect(() => {
    if (mode === 'local') {
      void loadLocal();
      return;
    }
    void loadServer();
    let unsubscribe: (() => void) | null = null;
    let closed = false;
    void sb().then((c) => {
      if (closed) return;
      const { data } = c.auth.onAuthStateChange((event, sess) => {
        // 다른 계정으로 로그인했거나 로그아웃했을 때만 다시 읽는다 (토큰 갱신·탭 전환은 무시)
        if (event === 'SIGNED_OUT' || (event === 'SIGNED_IN' && sess?.user.id !== srv.current.me?.userId)) setTimeout(() => void loadServer(), 0);
      });
      unsubscribe = () => data.subscription.unsubscribe();
    });
    const warn = (e: BeforeUnloadEvent) => {
      if (srv.current.pending.length || srv.current.inflight) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      closed = true;
      unsubscribe?.();
      window.removeEventListener('beforeunload', warn);
    };
  }, [mode, loadLocal, loadServer]);

  // ───────── 공통 동작 ─────────
  const update = useCallback(
    (mutator: Mutator) => {
      const draft = structuredClone(latest.current);
      mutator(draft);
      show(draft);
      if (mode === 'local') {
        void persistLocal(draft);
        return;
      }
      const S = srv.current;
      S.pending.push(mutator);
      if (S.timer) clearTimeout(S.timer);
      S.timer = setTimeout(() => void flush(), 350);
    },
    [mode, persistLocal, flush],
  );

  const replaceState = useCallback(
    (s: AppState) => {
      if (mode === 'server') {
        setSaveError('서버 모드에서는 JSON 가져오기·통째로 바꾸기를 쓸 수 없어요');
        return;
      }
      show(s);
      void persistLocal(s);
    },
    [mode, persistLocal],
  );

  const base = state.settings.baseDateOverride ?? todayLocal();

  const value: StoreValue = {
    state,
    status,
    loadError,
    saveError,
    storageWarning: warning,
    adapter,
    base,
    session,
    setSession: (s) => {
      if (mode === 'local') {
        adapter.saveSession(s);
        setSessionState(s);
        return;
      }
      // 보내지 않은 변경(예: 직원 앱 나가기)을 먼저 보내고 역할을 바꾼다
      void flush().then(() => loadServer(s, true));
    },
    update,
    retryLoad: () => void (mode === 'local' ? loadLocal() : loadServer()),
    retrySave: () => void (mode === 'local' ? persistLocal(latest.current) : loadServer(undefined, true).then(() => setSaveError(null))),
    resetEmpty: async () => {
      if (mode === 'server') {
        await flush();
        try {
          await rpc('delete_my_workplace');
          await loadServer({ role: 'owner', employeeId: null });
        } catch (e) {
          setSaveError(friendly(e));
        }
        return;
      }
      const keepBase = latest.current.settings.baseDateOverride;
      const s = createEmptyState();
      s.settings.baseDateOverride = keepBase;
      replaceState(s);
    },
    resetSeed: async () => {
      const keepBase = latest.current.settings.baseDateOverride;
      if (mode === 'server') {
        await flush();
        try {
          await api('owner/seed-demo', { replace: true, ...(keepBase ? { baseDate: keepBase } : {}) });
          await loadServer({ role: 'owner', employeeId: null });
        } catch (e) {
          setSaveError(friendly(e));
        }
        return;
      }
      const s = createSeed(keepBase ?? todayLocal());
      s.settings.baseDateOverride = keepBase;
      replaceState(s);
    },
    replaceState,
    mode,
    switchMode: (m, path) => switchMode(m, path),
    auth,
    syncing,
    adminStats,
    refresh: (wanted) => flush().then(() => loadServer(wanted, true)),
    flushNow: flush,
    logout: async () => {
      await flush();
      adapter.saveSession(null);
      await signOut();
      await loadServer();
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): StoreValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('StoreProvider 밖에서 useStore를 썼어요');
  return v;
}

/** 앱 안 알림을 쌓는다. 카카오는 연결되지 않았으므로 항상 'not-connected'로 기록 — 보냈다고 표시하지 않는다. */
export function pushNotification(draft: AppState, to: 'owner' | string, kind: string, text: string, link: string) {
  draft.notifications.unshift({ id: uid('n'), to, kind, text, link, createdAt: nowIso(), readAt: null, channels: { inApp: 'delivered', kakao: 'not-connected' } });
  if (draft.notifications.length > 200) draft.notifications.length = 200;
}
