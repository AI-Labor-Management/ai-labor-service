import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
import { request as httpRequest } from 'node:http';
import { createApiServer } from '../server/api';
import { FileStateRepository } from '../server/repository';
import type { Identity } from '../server/contracts';
import { createSeed } from '../src/data/seed';
import { payrollLines } from '../src/domain/payroll';
const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  while (cleanup.length) await cleanup.pop()!();
});
async function start(options: Partial<Parameters<typeof createApiServer>[0]> = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'saram-test-'));
  const repository = new FileStateRepository(directory);
  cleanup.push(() => rm(directory, { recursive: true, force: true }));
  const server = createApiServer({ repository, ...options });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  cleanup.push(
    () =>
      new Promise<void>((r, j) => {
        server.close((e) => (e ? j(e) : r()));
        server.closeAllConnections();
      }),
  );
  const address = server.address() as Exclude<ReturnType<Server['address']>, null | string>;
  const url = `http://127.0.0.1:${address.port}/api/v1/`;
  const request = (path: string, method = 'GET', data?: unknown, headers: Record<string, string> = {}) =>
    fetch(url + path, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Saram-Client': 'web', ...headers },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
  return { repository, request, directory, url };
}
const owner: Identity = { userId: 'owner-a', workspaceId: 'a', role: 'owner', employeeId: null };
describe('development API boundaries', () => {
  it('has health/rules but fails closed without identity and providers', async () => {
    const { request } = await start();
    expect((await request('health')).status).toBe(200);
    expect((await request('state')).status).toBe(401);
    expect((await request('dev/session', 'POST', {})).status).toBe(404);
    expect((await request('auth', 'POST', {})).status).toBe(503);
  });
  it('rejects cross-origin/Host writes and invalid data; old state survives', async () => {
    const { request, repository, url } = await start({ verifyIdentity: async () => owner });
    await repository.write('a', 0, createSeed('2026-11-06'));
    expect((await request('state', 'PUT', { expectedRevision: 1, state: { schemaVersion: 1 } })).status).toBe(
      422,
    );
    expect((await request('state', 'PUT', {}, { Origin: 'https://untrusted.invalid' })).status).toBe(403);
    const hostDenied = await new Promise<number>((resolve) => {
      const req = httpRequest(url + 'state', { headers: { Host: 'untrusted.invalid' } }, (res) => {
        res.resume();
        resolve(res.statusCode!);
      });
      req.end();
    });
    expect(hostDenied).toBe(403);
    expect((await request('state', 'PUT', {}, { 'X-Saram-Client': '' })).status).toBe(403);
    expect((await repository.read('a')).revision).toBe(1);
    expect((await request('owner/payroll?month=2026-99')).status).toBe(422);
  });
  it('prevents lost updates and persists across repository instances', async () => {
    const { request, repository, directory } = await start({ verifyIdentity: async () => owner });
    const seed = createSeed('2026-11-06');
    const [a, b] = await Promise.all([
      request('state', 'PUT', { expectedRevision: 0, state: seed }),
      request('state', 'PUT', { expectedRevision: 0, state: seed }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect((await repository.read('a')).revision).toBe(1);
    expect((await request('state', 'GET')).status).toBe(200);
    expect((await new FileStateRepository(directory).read('a')).revision).toBe(1);
    await expect(repository.read('../outside')).rejects.toThrow(/식별자/);
  });
  it('reuses the exact browser payroll calculation on the server', async () => {
    const { request, repository } = await start({ verifyIdentity: async () => owner });
    const seed = createSeed('2026-11-06');
    await repository.write('a', 0, seed);
    const response = await request('owner/payroll?month=2026-10');
    const json = await response.json();
    expect(json.data).toEqual(JSON.parse(JSON.stringify(payrollLines(seed, '2026-10'))));
  });
  it('enforces employee scope, blocks raw state, and ignores client workspace IDs', async () => {
    const seed = createSeed('2026-11-06');
    seed.employees[0].account = 'joined';
    const { request, repository } = await start({
      verifyIdentity: async () => ({ ...owner, role: 'employee', employeeId: seed.employees[0].id }),
    });
    await repository.write('a', 0, seed);
    expect((await request('state')).status).toBe(403);
    expect((await request('state', 'PUT', {})).status).toBe(403);
    const response = await request('view?workspaceId=b');
    const json = await response.json();
    expect(json.data.me.id).toBe(seed.employees[0].id);
    expect(json.data).not.toHaveProperty('payrolls');
    expect(json.data.condition.employeeId).toBe(seed.employees[0].id);
    expect(
      json.data.attendance.every((a: { employeeId: string }) => a.employeeId === seed.employees[0].id),
    ).toBe(true);
  });
  it('rejects blocked employees and limits admins to aggregates', async () => {
    const seed = createSeed('2026-11-06');
    let identity: Identity = { ...owner, role: 'employee', employeeId: seed.employees[0].id };
    seed.employees[0].account = 'blocked';
    const { request, repository } = await start({ verifyIdentity: async () => identity });
    await repository.write('a', 0, seed);
    expect((await request('view')).status).toBe(403);
    identity = { ...owner, role: 'admin' };
    expect((await request('view')).status).toBe(403);
    identity = { ...owner, role: 'admin', assuranceLevel: 'aal2' };
    const json = await (await request('view')).json();
    expect(JSON.stringify(json.data)).not.toContain('직원 A');
    expect(json.data.employees).toBe(3);
  });
  it('has an explicit HttpOnly development session; no session token in JSON', async () => {
    const { request } = await start({ developmentSession: true });
    const response = await request('dev/session', 'POST', {});
    const cookie = response.headers.get('set-cookie')!;
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    const json = await response.json();
    expect(JSON.stringify(json)).not.toContain(cookie.split(';')[0].split('=')[1]);
    expect((await request('state', 'GET', undefined, { Cookie: cookie.split(';')[0] })).status).toBe(200);
    const reused = await request('dev/session', 'POST', {}, { Cookie: cookie.split(';')[0] });
    expect(reused.status).toBe(200);
    expect(reused.headers.get('set-cookie')).toBeNull();
  });
  it('blocks personal data and returns expert guidance before invoking AI', async () => {
    let calls = 0;
    const { request, repository } = await start({
      verifyIdentity: async () => owner,
      answerQuestion: async () => {
        calls++;
        return { status: 'answer', text: 'test', citations: [] };
      },
    });
    await repository.write('a', 0, createSeed('2026-11-06'));
    expect((await request('consult/answer', 'POST', { question: '010-1234-5678로 연락' })).status).toBe(422);
    const json = await (await request('consult/answer', 'POST', { question: '해고 정당성 판단' })).json();
    expect(json.data.status).toBe('expert_required');
    expect(calls).toBe(0);
  });
  it('requires cited AI output and enforces a per-identity daily limit', async () => {
    const { request, repository } = await start({
      verifyIdentity: async () => owner,
      aiDailyLimit: 1,
      answerQuestion: async () => ({ status: 'answer', text: 'uncited', citations: [] }),
    });
    await repository.write('a', 0, createSeed('2026-11-06'));
    const json = await (
      await request('consult/answer', 'POST', { question: '근무 일정을 어떻게 관리하나요?' })
    ).json();
    expect(json.data.status).toBe('insufficient_evidence');
    const limit = await request('consult/answer', 'POST', { question: '다른 질문' });
    expect(limit.status).toBe(429);
    expect(limit.headers.get('retry-after')).toBeTruthy();
  });
});
