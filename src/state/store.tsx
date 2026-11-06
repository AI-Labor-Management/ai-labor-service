// 앱 상태 저장소. 모든 화면이 같은 AppState(사업장·직원·근로조건 이력 …)를 읽고, 변경은 update()로만 한다.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createStorage, type StorageAdapter } from '../adapters/storage';
import { createEmptyState, createSeed } from '../data/seed';
import { todayLocal } from '../domain/dates';
import type { AppState, DemoSession, ISODate } from '../domain/types';
import { SaveQueue } from '../adapters/saveQueue';
import { validateAppState } from '../domain/validateState';

type Status = 'loading' | 'ready' | 'error';

interface StoreValue {
  state: AppState;
  status: Status;
  loadError: string | null;
  saveError: string | null;
  saving: boolean;
  storageWarning: string | null;
  adapter: StorageAdapter;
  base: ISODate;
  session: DemoSession | null;
  setSession: (s: DemoSession | null) => void;
  update: (mutator: (draft: AppState) => void) => void;
  retryLoad: () => void;
  retrySave: () => void;
  resetEmpty: () => Promise<void>;
  resetSeed: () => Promise<void>;
  replaceState: (s: AppState) => void;
}

const Ctx = createContext<StoreValue | null>(null);

export function uid(prefix: string): string {
  const r =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${r}`;
}

export const nowIso = () => new Date().toISOString();

export function StoreProvider({ children }: { children: ReactNode }) {
  const { adapter, warning } = useMemo(() => createStorage(), []);
  const [state, setState] = useState<AppState>(createEmptyState);
  const [status, setStatus] = useState<Status>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [session, setSessionState] = useState<DemoSession | null>(() => adapter.loadSession());
  const latest = useRef(state);
  const queue = useMemo(
    () =>
      new SaveQueue<AppState>(
        (s) => adapter.save(s),
        (busy, error) => {
          setSaving(busy);
          setSaveError(error ? (error instanceof Error ? error.message : String(error)) : null);
        },
      ),
    [adapter],
  );

  const load = useCallback(async () => {
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

  useEffect(() => {
    void load();
  }, [load]);

  const update = useCallback(
    (mutator: (draft: AppState) => void) => {
      const draft = structuredClone(latest.current);
      mutator(draft);
      latest.current = draft;
      setState(draft);
      queue.enqueue(draft);
    },
    [queue],
  );

  const replaceState = useCallback(
    (s: AppState) => {
      validateAppState(s);
      latest.current = s;
      setState(s);
      setLoadError(null);
      setStatus('ready');
      queue.enqueue(s);
    },
    [queue],
  );

  const base = state.settings.baseDateOverride ?? todayLocal();

  const value: StoreValue = {
    state,
    status,
    loadError,
    saveError,
    saving,
    storageWarning: warning,
    adapter,
    base,
    session,
    setSession: (s) => {
      adapter.saveSession(s);
      setSessionState(s);
    },
    update,
    retryLoad: () => void load(),
    retrySave: () => queue.retry(),
    resetEmpty: async () => {
      const keepBase = latest.current.settings.baseDateOverride;
      const s = createEmptyState();
      s.settings.baseDateOverride = keepBase;
      replaceState(s);
    },
    resetSeed: async () => {
      const keepBase = latest.current.settings.baseDateOverride;
      const s = createSeed(keepBase ?? todayLocal());
      s.settings.baseDateOverride = keepBase;
      replaceState(s);
    },
    replaceState,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): StoreValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('StoreProvider 밖에서 useStore를 썼어요');
  return v;
}

/** 앱 안 알림을 쌓는다. 카카오는 연결되지 않았으므로 항상 'not-connected'로 기록 — 보냈다고 표시하지 않는다. */
export function pushNotification(
  draft: AppState,
  to: 'owner' | string,
  kind: string,
  text: string,
  link: string,
) {
  draft.notifications.unshift({
    id: uid('n'),
    to,
    kind,
    text,
    link,
    createdAt: nowIso(),
    readAt: null,
    channels: { inApp: 'delivered', kakao: 'not-connected' },
  });
  if (draft.notifications.length > 200) draft.notifications.length = 200;
}
