import { mkdir, readFile, rename, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateAppState } from '../src/domain/validateState';
import { ApiError, type StateDocument, type StateRepository } from './contracts';
import type { AppState } from '../src/domain/types';

/** Single-process development storage. Production uses a DB transaction, not a shared JSON file. */
export class FileStateRepository implements StateRepository {
  private locks = new Map<string, Promise<unknown>>();
  constructor(private directory: string) {}
  private file(id: string) {
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id))
      throw new ApiError(400, 'INVALID_WORKSPACE', '사업장 식별자를 확인해 주세요.');
    return resolve(this.directory, `${id}.json`);
  }
  async read(id: string): Promise<StateDocument> {
    let text: string;
    try {
      text = await readFile(this.file(id), 'utf8');
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT')
        return { revision: 0, state: null, updatedAt: null };
      throw e;
    }
    const doc = JSON.parse(text) as StateDocument;
    if (!Number.isSafeInteger(doc.revision) || doc.revision < 0 || !doc.updatedAt)
      throw new Error('손상된 서버 저장 문서');
    validateAppState(doc.state);
    return doc;
  }
  write(id: string, expectedRevision: number, state: AppState): Promise<StateDocument> {
    // Snapshot before waiting: callers cannot mutate a queued write.
    const snapshot = structuredClone(validateAppState(state));
    const previous = this.locks.get(id) ?? Promise.resolve();
    const operation = previous
      .catch(() => {})
      .then(async () => {
        const old = await this.read(id);
        if (old.revision !== expectedRevision)
          throw new ApiError(
            409,
            'REVISION_CONFLICT',
            '다른 창에서 데이터를 바꿨어요. 현재 내용을 백업한 뒤 다시 불러와 주세요.',
          );
        const next = { revision: old.revision + 1, state: snapshot, updatedAt: new Date().toISOString() };
        const file = this.file(id);
        const tmp = `${file}.${randomUUID()}.tmp`;
        await mkdir(resolve(this.directory), { recursive: true });
        try {
          await writeFile(tmp, JSON.stringify(next), { encoding: 'utf8', flag: 'wx', mode: 0o600 });
          await rename(tmp, file);
        } finally {
          await rm(tmp, { force: true });
        }
        return next;
      });
    this.locks.set(id, operation);
    void operation
      .finally(() => {
        if (this.locks.get(id) === operation) this.locks.delete(id);
      })
      .catch(() => {});
    return operation;
  }
}
