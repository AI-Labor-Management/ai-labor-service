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

export function createStorage(): { adapter: StorageAdapter; warning: string | null } {
  const want = (import.meta.env.VITE_STORAGE_ADAPTER as string | undefined) ?? 'local';
  if (want === 'supabase') {
    return { adapter: new LocalStorageAdapter(), warning: 'VITE_STORAGE_ADAPTER=supabase 는 아직 구현되지 않아 로컬 저장소로 실행 중이에요.' };
  }
  return { adapter: new LocalStorageAdapter(), warning: null };
}
