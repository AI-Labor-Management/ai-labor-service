// AI 노무 상담 — POST api/owner/consult/answer  { question }
//  · Claude(Anthropic API, 기본 claude-haiku-5-5 — ai-model.ts)가 공식 사이트(법령·고용노동부·4대보험 기관)만 검색해 근거와 함께 답한다.
//  · 비용: 무료 크레딧으로 시작하도록 가장 싼 모델·질문당 검색 2회. 크레딧이 떨어지면 503 AI_CREDIT_EMPTY.
//  · 보내는 것: 질문과 업종·규모뿐. 사용자 id·직원·금액은 보내지 않는다. 질문·답은 저장하지 않는다.
//  · 하루 이용 한도는 사용자별로 DB에서 센다(public.ai_take, 마이그레이션 11).
//  · 키(ANTHROPIC_API_KEY)는 Supabase 함수 비밀 값에만 둔다. 없으면 503 'AI 연결 전'.
//  · 응답 계약은 사람샘각 docs/API_HANDOFF.md의 AI 응답(status/text/citations)과 같다.
import type Anthropic from '@anthropic-ai/sdk';
import { HttpError } from '../_shared/http.ts';
import { type AiAnswer, toAiAnswer } from './ai-answer.ts';
import { isCreditError, modelProfile, pickModel } from './ai-model.ts';
import { GEMINI_POLICY_FROM, geminiConfigured } from './gemini.ts';

export type { AiAnswer };

type AnthropicClass = typeof Anthropic;
let AnthropicCtor: AnthropicClass | null = null;
/** 진입점(index.ts)이 npm SDK를 넣어 준다 (묶음 파일에 SDK를 넣지 않기 위해) */
export function setAnthropic(ctor: AnthropicClass) {
  AnthropicCtor = ctor;
}

/** 쓰는 모델 — 기본 Haiku 5.5(무료 크레딧으로 오래 쓰도록), 함수 비밀 값 ANTHROPIC_MODEL로 바꿀 수 있다 (ai-model.ts) */
export const aiModel = () => pickModel(Deno.env.get('ANTHROPIC_MODEL'));
export const AI_DAILY_LIMIT = 20;
const TIMEOUT_MS = 90_000;

/** 근거로 쓸 공식 사이트 (하위 도메인 포함) */
export const AI_SOURCES = [
  'law.go.kr', // 국가법령정보센터
  'moel.go.kr', // 고용노동부
  'minimumwage.go.kr', // 최저임금위원회
  '4insure.or.kr', // 4대사회보험 정보연계센터
  'comwel.or.kr', // 근로복지공단
  'ei.go.kr', // 고용보험
  'nhis.or.kr', // 국민건강보험공단
  'nps.or.kr', // 국민연금공단
  'nts.go.kr', // 국세청
  'hikorea.go.kr', // 하이코리아(체류)
  'eps.go.kr', // 고용허가제
];

/** Claude(유료 — 무료 크레딧이 끝나면 결제 필요) 키가 들어 있는지 */
export function claudeConfigured(): boolean {
  return !!AnthropicCtor && !!Deno.env.get('ANTHROPIC_API_KEY');
}

/**
 * 지금 답할 AI 제공사. 기본은 무료 Gemini(GEMINI_API_KEY, 처리방침 시행일 GEMINI_POLICY_FROM부터),
 * 없거나 AI_PROVIDER=anthropic이면 Claude(ANTHROPIC_API_KEY). 둘 다 없으면 null(연결 전).
 */
export function aiProvider(today: string): 'gemini' | 'anthropic' | null {
  const gemini = geminiConfigured() && today >= GEMINI_POLICY_FROM;
  if (Deno.env.get('AI_PROVIDER') === 'anthropic' && claudeConfigured()) return 'anthropic';
  if (gemini) return 'gemini';
  if (claudeConfigured()) return 'anthropic';
  return null;
}
export const aiConfigured = (today: string) => aiProvider(today) !== null;

const SYSTEM = `너는 한국 소상공인 사장님을 돕는 인사·노무 안내 도우미다. 서비스 이름은 사람샘각이다.

원칙:
- 반드시 web_search로 공식 자료(국가법령정보센터 법령·고용노동부·4대보험 기관 등)를 찾아 확인한 내용만 안내한다. 기억에 의존해 조문 번호·금액·비율을 만들지 않는다.
- 2026년 현재 시행 중인 기준으로 답한다. 연도별로 바뀌는 값(최저임금, 보험료율 등)은 연도를 함께 적는다.
- 해고·징계의 정당성, 임금 체불 다툼, 괴롭힘·성희롱 신고, 산재 사고, 근로자성 판단, 체류자격 문제처럼 개별 사실관계에 따라 결론이 달라지는 질문은 결론을 내리지 말고 확인할 점과 준비할 기록만 안내하고 노무 전문가 상담을 권한다.
- 공식 자료에서 근거를 찾지 못하면 추측하지 말고 근거가 부족하다고 말한다.
- 질문에 개인 이름·연락처·주민번호 같은 개인정보가 있어도 되풀이하지 않는다.

답변 형식:
- 첫 줄에 상태 표시 하나만 쓴다: [상태:answer] 또는 [상태:insufficient_evidence] 또는 [상태:expert_required]
  · answer: 공식 자료로 확인한 일반 안내
  · insufficient_evidence: 공식 자료에서 근거를 찾지 못함
  · expert_required: 개별 사안 판단이 필요해 전문가 확인이 필요함 (일반적인 확인 사항은 함께 안내해도 된다)
- 그다음 한국어 존댓말로, 마크다운 제목·굵은 글씨·표 없이 평문으로 쓴다. 목록이 필요하면 줄 앞에 "· "를 쓴다.
- 600자 안팎으로 핵심만: 결론 한두 문장 → 근거(법령 이름과 조문) → 사장님이 할 일.`;

/** Claude에게 묻는다. 서버 도구(web_search)가 길어지면 pause_turn으로 멈추므로 두 번까지 이어서 받는다 */
export async function askClaude(question: string, context: { industry: string; scale: string }, checkedAt: string, signal?: AbortSignal): Promise<AiAnswer> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!AnthropicCtor || !apiKey) throw new HttpError(503, 'AI 상담이 아직 연결되지 않았어요. 자주 묻는 질문이나 노무 전문가 상담을 이용해 주세요.', { code: 'AI_NOT_CONFIGURED' });
  const client = new AnthropicCtor({ apiKey, timeout: TIMEOUT_MS, maxRetries: 1 });
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: 'user', content: `사업장: ${context.industry} · 직원 ${context.scale}\n질문: ${question}` },
  ];
  const model = aiModel();
  const p = modelProfile(model);
  const search = {
    name: 'web_search' as const,
    max_uses: p.maxSearches,
    allowed_domains: AI_SOURCES,
    user_location: { type: 'approximate' as const, country: 'KR', timezone: 'Asia/Seoul' },
  };
  try {
    for (let turn = 0; turn < 3; turn++) {
      const res = await client.beta.messages.create(
        {
          model,
          max_tokens: 8000,
          // Opus만: 안전 분류기가 거절하면 Anthropic이 권장하는 다른 모델로 서버에서 다시 시도한다
          ...(p.serverFallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
          output_config: { effort: 'medium' },
          system: SYSTEM,
          tools: [p.searchTool === 'web_search_20260209' ? { type: 'web_search_20260209', ...search } : { type: 'web_search_20250305', ...search }],
          messages,
        },
        { signal },
      );
      if (res.stop_reason === 'refusal') {
        return {
          status: 'expert_required',
          text: '이 질문에는 AI가 답하지 않았어요. 노무 전문가와 확인해 주세요.',
          citations: [],
        };
      }
      if (res.stop_reason === 'pause_turn') {
        messages.push({ role: 'assistant', content: res.content });
        continue;
      }
      return toAiAnswer(res.content, checkedAt);
    }
    return toAiAnswer([], checkedAt);
  } catch (e) {
    if (e instanceof HttpError) throw e;
    if (AnthropicCtor && e instanceof AnthropicCtor.APIConnectionTimeoutError) throw new HttpError(504, 'AI 답변이 늦어지고 있어요. 잠시 뒤 다시 시도해 주세요.', { code: 'AI_TIMEOUT' });
    if (AnthropicCtor && e instanceof AnthropicCtor.RateLimitError) throw new HttpError(429, 'AI 이용량이 많아요. 잠시 뒤 다시 시도해 주세요.', { code: 'AI_BUSY' });
    if (AnthropicCtor && e instanceof AnthropicCtor.AuthenticationError) throw new HttpError(503, 'AI 연결 설정을 확인해야 해요. 운영자에게 알려 주세요.', { code: 'AI_NOT_CONFIGURED' });
    if (AnthropicCtor && e instanceof AnthropicCtor.APIError && isCreditError(e.message))
      throw new HttpError(503, 'AI 상담 이용량을 다 썼어요. 자주 묻는 질문이나 노무 전문가 상담을 이용해 주세요.', { code: 'AI_CREDIT_EMPTY' });
    if (AnthropicCtor && e instanceof AnthropicCtor.APIError) throw new HttpError(502, 'AI 답변을 받지 못했어요. 잠시 뒤 다시 시도해 주세요.', { code: 'AI_ERROR', status: e.status });
    throw e;
  }
}
