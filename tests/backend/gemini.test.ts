// 무료 Gemini 호출 — 실패하면 대체 모델 → (빨리 실패했으면) 첫 모델 한 번 더, 키 문제는 다시 시도하지 않는다
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import rulesFile from '../../src/data/rules.json';
import { FAQS } from '../../src/data/faq';
import { resolveRule } from '../../src/domain/rules';
import { buildCorpus } from '../../supabase/functions/api/ai-ground';
import { askGemini, DEFAULT_GEMINI_MODEL, resetGeminiState } from '../../supabase/functions/api/gemini';

const TODAY = '2026-11-15';
const docs = buildCorpus(rulesFile.rules, (id) => resolveRule(id, TODAY), FAQS);
const CTX = { industry: '음식점·카페', scale: '1~4명' };

const ok = (answer: unknown) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(answer) }] }, finishReason: 'STOP' }] }), { status: 200 });
const fail = (status: number, googleStatus: string) => new Response(JSON.stringify({ error: { code: status, status: googleStatus, message: 'x' } }), { status });
const GOOD = { status: 'answer', text: '주 15시간 이상이면 줘요.', sources: ['R:weeklyHoliday.minWeeklyHours'] };

let fetchMock: ReturnType<typeof vi.fn>;
const calledModels = () => fetchMock.mock.calls.map(([url]) => decodeURIComponent(String(url)).match(/models\/([^:]+):/)?.[1]);

beforeEach(() => {
  resetGeminiState();
  vi.useFakeTimers({ toFake: ['setTimeout'] });
  vi.stubGlobal('Deno', { env: { get: (k: string) => (k === 'GEMINI_API_KEY' ? 'test-key' : undefined) } });
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const ask = async () => {
  const p = askGemini('주휴수당 줘야 하나요?', CTX, TODAY, docs);
  await vi.runAllTimersAsync();
  return p;
};

describe('Gemini 다시 시도', () => {
  it('첫 모델이 성공하면 한 번만 묻는다', async () => {
    fetchMock.mockResolvedValueOnce(ok(GOOD));
    const a = await ask();
    expect(a.status).toBe('answer');
    expect(calledModels()).toEqual([DEFAULT_GEMINI_MODEL]);
  });

  it('첫 모델이 붐비면(503) 대체 모델로 답한다', async () => {
    fetchMock.mockResolvedValueOnce(fail(503, 'UNAVAILABLE')).mockResolvedValueOnce(ok(GOOD));
    const a = await ask();
    expect(a.text).toBe('주 15시간 이상이면 줘요.');
    expect(calledModels()).toEqual([DEFAULT_GEMINI_MODEL, 'gemini-3.5-flash-lite']);
  });

  it('400 같은 다른 오류도 대체 모델로 넘기고, 둘 다 빨리 실패하면 첫 모델로 한 번 더 묻는다', async () => {
    fetchMock.mockResolvedValueOnce(fail(400, 'INVALID_ARGUMENT')).mockResolvedValueOnce(fail(500, 'INTERNAL')).mockResolvedValueOnce(ok(GOOD));
    const a = await ask();
    expect(a.status).toBe('answer');
    expect(calledModels()).toEqual([DEFAULT_GEMINI_MODEL, 'gemini-3.5-flash-lite', DEFAULT_GEMINI_MODEL]);
  });

  it('첫 모델이 이용량 소진(429)이면 남은 시도는 대체 모델로, 다음 질문도 10분 동안 대체 모델부터 묻는다', async () => {
    const LITE = 'gemini-3.5-flash-lite';
    fetchMock.mockResolvedValueOnce(fail(429, 'RESOURCE_EXHAUSTED')).mockResolvedValueOnce(fail(503, 'UNAVAILABLE')).mockResolvedValueOnce(ok(GOOD));
    expect((await ask()).status).toBe('answer');
    expect(calledModels()).toEqual([DEFAULT_GEMINI_MODEL, LITE, LITE]);
    fetchMock.mockClear();
    fetchMock.mockResolvedValueOnce(ok(GOOD));
    expect((await ask()).status).toBe('answer');
    expect(calledModels()).toEqual([LITE]);
  });

  it('빈 답이나 깨진 JSON도 다음 시도로 넘긴다', async () => {
    const broken = new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"status":"answer","te' }] }, finishReason: 'MAX_TOKENS' }] }), { status: 200 });
    fetchMock.mockResolvedValueOnce(broken).mockResolvedValueOnce(ok(GOOD));
    expect((await ask()).status).toBe('answer');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('세 번 모두 실패하면 화면 계약의 오류(502 AI_ERROR)를 던지고, 로그에는 질문 없이 모델·상태만 남긴다', async () => {
    fetchMock.mockResolvedValue(fail(503, 'UNAVAILABLE'));
    const p = askGemini('주휴수당 줘야 하나요?', CTX, TODAY, docs);
    const done = expect(p).rejects.toMatchObject({ status: 502, detail: { code: 'AI_ERROR' } });
    await vi.runAllTimersAsync();
    await done;
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const logged = (console.warn as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).toContain('HTTP 503 UNAVAILABLE');
    expect(logged).not.toContain('주휴수당');
    expect(logged).not.toContain('test-key');
  });

  it('키 문제(403)는 다시 묻지 않고 설정 확인 안내(503)를 던진다', async () => {
    fetchMock.mockResolvedValue(fail(403, 'PERMISSION_DENIED'));
    const p = askGemini('주휴수당 줘야 하나요?', CTX, TODAY, docs);
    const done = expect(p).rejects.toMatchObject({ status: 503, detail: { code: 'AI_NOT_CONFIGURED' } });
    await vi.runAllTimersAsync();
    await done;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('안전 차단은 다시 묻지 않고 전문가 안내로 바꾼다', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' } }), { status: 200 }));
    const a = await ask();
    expect(a.status).toBe('expert_required');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
