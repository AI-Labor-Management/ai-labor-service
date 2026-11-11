// AI 노무 상담 — Google Gemini 무료 등급 (기본 제공사)
//  · 모델: 무료 안정판 중 가장 좋은 gemini-3.6-flash → 실패(시간 초과·429·5xx)하면 gemini-3.5-flash-lite로 한 번 더.
//    2026-11-08 실측(근거 자료 전체): 3.6 Flash 2.7초, 3.5 Flash-Lite 2.0초, 3.8 Flash('New')는 무료 등급에서 40초 넘게 응답 없음.
//    함수 비밀 값 GEMINI_MODEL로 첫 모델을 바꿀 수 있다.
//  · 키: 함수 비밀 값 GEMINI_API_KEY (Google AI Studio에서 무료 발급, 카드 없음). 없으면 이 경로는 꺼짐.
//  · 무료 등급은 Google 검색 근거를 쓸 수 없어 앱의 검증된 규칙·FAQ만 자료로 넘긴다 (ai-ground.ts).
//  · 무료 등급의 입력·출력은 Google이 서비스 개선에 쓸 수 있다 → 처리방침에 적고, 개인정보 형식은 서버가 먼저 거절한다.
//  · REST models.generateContent — systemInstruction / contents / generationConfig(responseMimeType·responseJsonSchema·thinkingConfig)
import { HttpError } from '../_shared/http.ts';
import type { AiAnswer } from './ai-answer.ts';
import { ANSWER_SCHEMA, corpusText, type Doc, toGroundedAnswer } from './ai-ground.ts';

export const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash';
const FALLBACK_GEMINI_MODEL = 'gemini-3.5-flash-lite';
/** 처리방침 변경(AI 제공사 Google 추가) 시행일 — 이날부터 Gemini로 답한다.
 *  2026-11-08에 알리고 11-15 시행 예정이었으나, 가입자가 운영자뿐이라 운영자 결정으로 2026-11-10 바로 시행 */
export const GEMINI_POLICY_FROM = '2026-11-10';
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
/** 첫 모델 45초 + 대체 모델 30초 (+ 빨리 실패했을 때만 첫 모델 한 번 더) — 화면은 100초까지 기다리므로 모두 합쳐 95초 안에 끝낸다 */
const PRIMARY_TIMEOUT_MS = 45_000;
const FALLBACK_TIMEOUT_MS = 30_000;
const TOTAL_BUDGET_MS = 95_000;
/** 세 번째 시도는 앞의 두 번이 이 시간 안에 실패했을 때만 (무료 등급의 잠깐 붐빔·일시 오류) */
const LAST_TRY_IF_UNDER_MS = 40_000;
const LAST_TRY_PAUSE_MS = 1_200;

export function geminiConfigured(): boolean {
  return !!Deno.env.get('GEMINI_API_KEY');
}
export function geminiModel(): string {
  const m = (Deno.env.get('GEMINI_MODEL') ?? '').trim();
  return /^gemini-[0-9][\w.-]*$/.test(m) ? m : DEFAULT_GEMINI_MODEL;
}

const SYSTEM = (docs: Doc[]) => `너는 한국 소상공인 사장님을 돕는 인사·노무 안내 도우미다. 서비스 이름은 사람샘각이다.

원칙:
- 아래 "근거 자료"에 적힌 내용만으로 답한다. 자료에 없는 조문 번호·금액·비율·날짜를 기억으로 만들지 않는다.
- 자료로 답할 수 없으면 status를 insufficient_evidence로 하고, 무엇을 노무 전문가나 고용노동부(국번 없이 1350)에 확인하면 되는지만 짧게 안내한다.
- 해고·징계의 정당성, 임금 체불 다툼, 괴롭힘·성희롱 신고, 산재 사고, 근로자성 판단, 체류자격 문제처럼 개별 사실관계에 따라 결론이 달라지는 질문은 결론을 내리지 말고 status를 expert_required로 한다 (자료에 있는 일반 기준은 함께 안내해도 된다).
- 자료의 값은 기준일(오늘) 시행 중인 값이다. 연도별로 바뀌는 값(최저임금, 보험료율 등)은 연도를 함께 적는다.
- 질문에 개인 이름·연락처 같은 개인정보가 있어도 되풀이하지 않는다.

답변:
- text: 한국어 존댓말 평문. 마크다운·표·자료 번호 없이 600자 안팎. 결론 한두 문장 → 근거(법령 이름과 조문) → 사장님이 할 일. 목록은 줄 앞에 "· ".
- sources: text에 실제로 쓴 자료의 번호만 (예: "R:minimumWage.hourly", "F:FAQ2"). 쓰지 않은 자료는 넣지 않는다.

근거 자료:
${corpusText(docs)}`;

/**
 * 키·모델 사전 점검 — 모델 정보만 조회한다(사용자 질문·개인정보는 보내지 않음). 처리방침 시행일 전에도 쓸 수 있다.
 * health?check=ai 에서 부른다. 10분 동안 결과를 재사용한다.
 */
let lastCheck: { at: number; result: { ok: boolean; model: string; detail: string } } | null = null;
export async function checkGemini(): Promise<{ ok: boolean; model: string; detail: string }> {
  const key = Deno.env.get('GEMINI_API_KEY');
  const model = geminiModel();
  if (!key) return { ok: false, model, detail: 'GEMINI_API_KEY 없음' };
  if (lastCheck && Date.now() - lastCheck.at < 600_000) return lastCheck.result;
  let result: { ok: boolean; model: string; detail: string };
  try {
    const r = await fetch(`${ENDPOINT}/${encodeURIComponent(model)}`, { headers: { 'x-goog-api-key': key }, signal: AbortSignal.timeout(10_000) });
    const j = (await r.json().catch(() => ({}))) as { displayName?: string; error?: { status?: string } };
    result = r.ok ? { ok: true, model, detail: j.displayName ?? '' } : { ok: false, model, detail: `${r.status} ${j.error?.status ?? ''}`.trim() };
  } catch {
    result = { ok: false, model, detail: '연결 실패' };
  }
  lastCheck = { at: Date.now(), result };
  return result;
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { code?: number; message?: string; status?: string };
}

/** 실패 원인을 함수 로그에 남긴다 — 모델·HTTP 상태·Google 오류 종류만 (질문·답·키는 남기지 않는다) */
function logFailure(model: string, what: string) {
  console.warn(`[gemini] ${model} 실패: ${what}`);
}

/** 한 모델에 한 번 묻는다. 키 문제(401·403)만 다시 시도하지 않고, 나머지(시간 초과·429·4xx·5xx·연결)는 다른 모델로 다시 해 볼 만하다 */
async function callModel(key: string, model: string, body: unknown, timeoutMs: number): Promise<{ ok: true; json: GeminiResponse } | { ok: false; retryable: boolean; error: HttpError }> {
  let r: Response;
  try {
    r = await fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    const timeout = e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError');
    logFailure(model, timeout ? `시간 초과 ${timeoutMs}ms` : '연결 실패');
    return {
      ok: false,
      retryable: true,
      error: timeout
        ? new HttpError(504, 'AI 답변이 늦어지고 있어요. 잠시 뒤 다시 시도해 주세요.', { code: 'AI_TIMEOUT' })
        : new HttpError(502, 'AI 답변을 받지 못했어요. 잠시 뒤 다시 시도해 주세요.', { code: 'AI_ERROR' }),
    };
  }
  const j = (await r.json().catch(() => ({}))) as GeminiResponse;
  if (r.ok) return { ok: true, json: j };
  logFailure(model, `HTTP ${r.status} ${j.error?.status ?? ''}`.trim());
  const msg = j.error?.message ?? '';
  if (r.status === 401 || r.status === 403 || /API key/i.test(msg))
    return { ok: false, retryable: false, error: new HttpError(503, 'AI 연결 설정을 확인해야 해요. 운영자에게 알려 주세요.', { code: 'AI_NOT_CONFIGURED' }) };
  if (r.status === 429)
    return { ok: false, retryable: true, error: new HttpError(429, '오늘 무료 AI 이용량이 많아요. 잠시 뒤 다시 시도하거나 자주 묻는 질문을 이용해 주세요.', { code: 'AI_BUSY' }) };
  return { ok: false, retryable: true, error: new HttpError(502, 'AI 답변을 받지 못했어요. 잠시 뒤 다시 시도해 주세요.', { code: 'AI_ERROR', status: r.status }) };
}

/** 성공 응답에서 답을 꺼낸다. 안전 차단은 전문가 안내로, 비었거나 JSON이 깨졌으면 null(다른 시도로 넘긴다) */
function readAnswer(model: string, j: GeminiResponse, docs: Doc[], checkedAt: string): AiAnswer | null {
  const cand = j.candidates?.[0];
  if (j.promptFeedback?.blockReason || cand?.finishReason === 'SAFETY' || cand?.finishReason === 'PROHIBITED_CONTENT') {
    return { status: 'expert_required', text: '이 질문에는 AI가 답하지 않았어요. 노무 전문가와 확인해 주세요.', citations: [] };
  }
  const text = (cand?.content?.parts ?? [])
    .filter((p) => !p.thought && typeof p.text === 'string')
    .map((p) => p.text)
    .join('');
  let parsed: { text?: unknown } | null = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }
  if (!parsed || typeof parsed !== 'object' || typeof parsed.text !== 'string' || !parsed.text.trim()) {
    logFailure(model, `빈 답·깨진 JSON (finishReason ${cand?.finishReason ?? '없음'})`);
    return null;
  }
  return toGroundedAnswer(parsed, docs, checkedAt);
}

/** Gemini에 묻는다 (자료 안에서만, JSON으로). 첫 모델이 늦거나 막히면 가벼운 모델로 한 번 더. 실패는 화면 계약의 오류 코드로 바꾼다 */
export async function askGemini(question: string, context: { industry: string; scale: string }, checkedAt: string, docs: Doc[]): Promise<AiAnswer> {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw new HttpError(503, 'AI 상담이 아직 연결되지 않았어요. 자주 묻는 질문이나 노무 전문가 상담을 이용해 주세요.', { code: 'AI_NOT_CONFIGURED' });
  const primary = geminiModel();
  const bodyFor = (model: string) => ({
    systemInstruction: { parts: [{ text: SYSTEM(docs) }] },
    contents: [{ role: 'user', parts: [{ text: `기준일: ${checkedAt}\n사업장: ${context.industry} · 직원 ${context.scale}\n질문: ${question}` }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseJsonSchema: ANSWER_SCHEMA,
      maxOutputTokens: 4096,
      // thinkingLevel은 Gemini 3 이상에서만 (이전 모델에 보내면 오류). 자료 안에서 고르는 일이라 LOW로 충분하고 빠르다
      ...(/^gemini-([3-9]|\d\d)/.test(model) ? { thinkingConfig: { thinkingLevel: 'LOW' } } : {}),
    },
  });
  // 첫 모델 → 가벼운 대체 모델 → (둘 다 빨리 실패했으면) 잠깐 쉬고 첫 모델 한 번 더
  const tries = [primary, ...(primary !== FALLBACK_GEMINI_MODEL ? [FALLBACK_GEMINI_MODEL] : []), primary];
  const started = Date.now();
  let lastError = new HttpError(502, 'AI 답변을 받지 못했어요. 잠시 뒤 다시 시도해 주세요.', { code: 'AI_ERROR' });
  for (let i = 0; i < tries.length; i++) {
    const elapsed = Date.now() - started;
    const isLast = i === tries.length - 1 && i > 0;
    if (isLast) {
      if (elapsed > LAST_TRY_IF_UNDER_MS) break;
      await new Promise((r) => setTimeout(r, LAST_TRY_PAUSE_MS));
    }
    const timeout = Math.min(i === 0 ? PRIMARY_TIMEOUT_MS : FALLBACK_TIMEOUT_MS, TOTAL_BUDGET_MS - (Date.now() - started));
    if (timeout < 5_000) break;
    const res = await callModel(key, tries[i], bodyFor(tries[i]), timeout);
    if (!res.ok) {
      lastError = res.error;
      if (!res.retryable) break;
      continue;
    }
    const answer = readAnswer(tries[i], res.json, docs, checkedAt);
    if (answer) return answer;
  }
  throw lastError;
}
