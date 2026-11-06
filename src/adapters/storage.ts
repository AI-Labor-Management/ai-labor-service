// 저장 어댑터. 현재 구현은 브라우저 localStorage(이 브라우저·이 기기에만, 사용자별 격리 없음).
// 운영 전환 시 같은 인터페이스로 Supabase(인증 + RLS) 어댑터를 붙인다 — HANDOFF.md 참고.
import type { AppState, DemoSession } from '../domain/types';
import { SCHEMA_VERSION } from '../data/seed';

export interface StorageAdapter {
  readonly kind: 'local' | 'supabase';
  readonly description: string;
  load(): Promise<AppState | null>;
  save(state: AppState): Promise<void>;
  clear(): Promise<void>;
  loadSession(): DemoSession | null;
  saveSession(s: DemoSession | null): void;
}

const KEY = 'ai-labor-demo/state';
const SESSION_KEY = 'ai-labor-demo/session';

export class StorageError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
  }
}

/** 이전 스키마를 현재 스키마로 올린다. 지금은 v1만 있다. */
export function migrate(raw: unknown): AppState {
  if (!raw || typeof raw !== 'object') throw new StorageError('저장된 데이터 형식이 올바르지 않아요');
  const obj = raw as Partial<AppState> & { schemaVersion?: number };
  if (obj.schemaVersion !== SCHEMA_VERSION) throw new StorageError(`지원하지 않는 데이터 버전이에요 (v${obj.schemaVersion ?? '?'})`);
  return obj as AppState;
}

export class LocalStorageAdapter implements StorageAdapter {
  readonly kind = 'local' as const;
  readonly description = '이 브라우저의 localStorage (로컬 데모 · 사용자별 격리 없음)';

  async load(): Promise<AppState | null> {
    let text: string | null;
    try {
      text = localStorage.getItem(KEY);
    } catch (e) {
      throw new StorageError('브라우저 저장소를 읽을 수 없어요 (사생활 보호 모드 또는 저장소 차단)', e);
    }
    if (!text) return null;
    try {
      return migrate(JSON.parse(text));
    } catch (e) {
      throw new StorageError(e instanceof StorageError ? e.message : '저장된 데이터를 해석하지 못했어요', e);
    }
  }

  async save(state: AppState): Promise<void> {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      throw new StorageError('저장하지 못했어요 (저장 공간 부족 또는 저장소 차단)', e);
    }
  }

  async clear(): Promise<void> {
    try {
      localStorage.removeItem(KEY);
    } catch (e) {
      throw new StorageError('초기화하지 못했어요', e);
    }
  }

  loadSession(): DemoSession | null {
    try {
      const t = localStorage.getItem(SESSION_KEY);
      return t ? (JSON.parse(t) as DemoSession) : null;
    } catch {
      return null;
    }
  }

  saveSession(s: DemoSession | null): void {
    try {
      if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      else localStorage.removeItem(SESSION_KEY);
    } catch {
      /* 세션 저장 실패는 화면 전환만 영향 */
    }
  }
}

/**
 * 서버 모드 표시용. 실제 읽기·쓰기는 store.tsx가 server.ts(로그인·역할별 읽기)와 sync.ts(변경 → 서버 요청)로 한다.
 * 화면은 지금처럼 update()만 쓰면 된다.
 */
export class ServerStorageInfo implements StorageAdapter {
  readonly kind = 'supabase' as const;
  readonly description = 'Supabase 서버 (로그인 계정별 · RLS로 사업장·직원별 격리)';
  async load(): Promise<AppState | null> {
    return null;
  }
  async save(): Promise<void> {}
  async clear(): Promise<void> {}
  loadSession(): DemoSession | null {
    try {
      const t = localStorage.getItem('ai-labor/server-session');
      return t ? (JSON.parse(t) as DemoSession) : null;
    } catch {
      return null;
    }
  }
  saveSession(s: DemoSession | null): void {
    try {
      if (s) localStorage.setItem('ai-labor/server-session', JSON.stringify(s));
      else localStorage.removeItem('ai-labor/server-session');
    } catch {
      /* 역할 기억 실패는 다음 접속 때 기본 역할로 */
    }
  }
}

export function createStorage(mode: 'local' | 'server' = 'local'): { adapter: StorageAdapter; warning: string | null } {
  if (mode === 'server') return { adapter: new ServerStorageInfo(), warning: null };
  const want = (import.meta.env.VITE_STORAGE_ADAPTER as string | undefined) ?? 'local';
  if (want === 'supabase' && !import.meta.env.VITE_SUPABASE_URL) {
    return { adapter: new LocalStorageAdapter(), warning: 'VITE_STORAGE_ADAPTER=supabase 인데 VITE_SUPABASE_URL·VITE_SUPABASE_ANON_KEY가 없어 로컬 저장소로 실행 중이에요.' };
  }
  return { adapter: new LocalStorageAdapter(), warning: null };
}
