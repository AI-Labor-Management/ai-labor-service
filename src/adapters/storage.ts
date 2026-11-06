// 저장 어댑터. 현재 구현은 브라우저 localStorage(이 브라우저·이 기기에만, 사용자별 격리 없음).
// 운영 전환 시 같은 인터페이스로 Supabase(인증 + RLS) 어댑터를 붙인다 — HANDOFF.md 참고.
import type { AppState, DemoSession } from '../domain/types';
import { SCHEMA_VERSION } from '../data/seed';
import { validateAppState } from '../domain/validateState';
import { ApiStorageAdapter } from './apiStorage';

export interface StorageAdapter {
  readonly kind: 'local' | 'api' | 'supabase';
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
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
  }
}

/** 이전 스키마를 현재 스키마로 올린다. 지금은 v1만 있다. */
export function migrate(raw: unknown): AppState {
  if (!raw || typeof raw !== 'object') throw new StorageError('저장된 데이터 형식이 올바르지 않아요');
  const obj = raw as Partial<AppState> & { schemaVersion?: number };
  if (obj.schemaVersion !== SCHEMA_VERSION)
    throw new StorageError(`지원하지 않는 데이터 버전이에요 (v${obj.schemaVersion ?? '?'})`);
  return validateAppState(obj);
}

export class LocalStorageAdapter implements StorageAdapter {
  readonly kind: StorageAdapter['kind'] = 'local';
  readonly description: string = '이 브라우저의 localStorage (로컬 데모 · 사용자별 격리 없음)';
  private lastSavedText: string | null | undefined;

  async load(): Promise<AppState | null> {
    let text: string | null;
    try {
      text = localStorage.getItem(KEY);
      this.lastSavedText = text;
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
      if (this.lastSavedText !== undefined && localStorage.getItem(KEY) !== this.lastSavedText)
        throw new StorageError('다른 창에서 데이터를 바꿨어요. 현재 내용을 백업한 뒤 새로고침해 주세요.');
      const next = JSON.stringify(state);
      localStorage.setItem(KEY, next);
      this.lastSavedText = next;
    } catch (e) {
      if (e instanceof StorageError) throw e;
      throw new StorageError('저장하지 못했어요 (저장 공간 부족 또는 저장소 차단)', e);
    }
  }

  async clear(): Promise<void> {
    try {
      localStorage.removeItem(KEY);
      this.lastSavedText = null;
    } catch (e) {
      throw new StorageError('초기화하지 못했어요', e);
    }
  }

  loadSession(): DemoSession | null {
    try {
      const t = localStorage.getItem(SESSION_KEY);
      if (!t) return null;
      const s = JSON.parse(t) as DemoSession;
      return s &&
        ['owner', 'employee', 'firm', 'admin'].includes(s.role) &&
        (s.employeeId === null || typeof s.employeeId === 'string')
        ? s
        : null;
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
  if (want === 'api') {
    if (import.meta.env.DEV)
      return {
        adapter: new ApiStorageAdapter(),
        warning: '개발용 API 모드예요. 가상 데이터만 사용하세요. 실제 인증은 연결 전이에요.',
      };
    return {
      adapter: new UnconfiguredStorageAdapter(),
      warning: '개발용 API는 공개 배포에서 사용할 수 없어요.',
    };
  }
  if (want === 'supabase') {
    return { adapter: new UnconfiguredStorageAdapter(), warning: 'Supabase 어댑터 연결을 완료해 주세요.' };
  }
  return { adapter: new LocalStorageAdapter(), warning: null };
}

class UnconfiguredStorageAdapter extends LocalStorageAdapter {
  override readonly kind = 'supabase' as const;
  override async load(): Promise<AppState | null> {
    throw new StorageError(
      '선택한 서버 저장소가 연결되지 않았어요. 체험은 VITE_STORAGE_ADAPTER=local로 실행해 주세요.',
    );
  }
  override async save(): Promise<void> {
    throw new StorageError('서버 저장소가 연결되지 않았어요.');
  }
}
