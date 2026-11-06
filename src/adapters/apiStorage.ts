import type { AppState } from '../domain/types';
import { createEmptyState } from '../data/seed';
import { LocalStorageAdapter, StorageError, migrate, type StorageAdapter } from './storage';
import { apiRequest, ServiceError } from './api';

/** Explicitly development-only: the server owns a single fake workspace; this is not authentication. */
export class ApiStorageAdapter implements StorageAdapter {
  readonly kind = 'api' as const;
  readonly description = '이 PC의 개발용 API · 파일 저장 (실제 로그인/운영 DB 연결 전)';
  private session = new LocalStorageAdapter();
  loadSession() {
    return this.session.loadSession();
  }
  saveSession(s: Parameters<LocalStorageAdapter['saveSession']>[0]) {
    this.session.saveSession(s);
  }
  private revision = 0;
  async load(): Promise<AppState | null> {
    await apiRequest('dev/session', { method: 'POST' });
    const doc = await apiRequest<{ revision: number; state: unknown }>('state');
    this.revision = doc.revision;
    return doc.state === null ? null : migrate(doc.state);
  }
  async save(state: AppState) {
    try {
      const doc = await apiRequest<{ revision: number }>('state', {
        method: 'PUT',
        body: { expectedRevision: this.revision, state },
      });
      this.revision = doc.revision;
    } catch (e) {
      throw new StorageError(
        e instanceof ServiceError
          ? `${e.message}${e.requestId ? ` (문의 코드 ${e.requestId})` : ''}`
          : '서버에 저장하지 못했어요.',
        e,
      );
    }
  }
  async clear() {
    await this.save(createEmptyState());
  }
}
