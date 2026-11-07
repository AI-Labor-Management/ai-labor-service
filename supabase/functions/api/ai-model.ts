// AI 노무 상담 — 모델별 설정 (Deno에 기대지 않는 순수 부분, Node 시험에서 확인)
//  · 기본은 Claude Haiku 5.5: 무료 크레딧으로 오래 쓰도록 가장 싼 모델 (입력 $0.10·출력 $0.50 / 100만 토큰, 2026-11 가격표)
//  · 함수 비밀 값 ANTHROPIC_MODEL로 바꿀 수 있다 (예: claude-opus-5-5 — 입력 $4·출력 $20)
//  · 웹 검색은 1,000회당 $10라 질문 비용의 대부분 → Haiku는 질문당 2회까지

export const DEFAULT_AI_MODEL = 'claude-haiku-5-5';

/** 허용하는 모델 (오타로 엉뚱한 모델·비싼 모델이 쓰이지 않게) */
const ALLOWED = /^claude-(haiku|sonnet|opus)-5(-5)?$/;

export function pickModel(env: string | undefined): string {
  const m = (env ?? '').trim();
  return ALLOWED.test(m) ? m : DEFAULT_AI_MODEL;
}

export interface ModelProfile {
  /** 동적 필터 검색(web_search_20260209)은 Opus·Sonnet 5대만, Haiku는 기본 검색 */
  searchTool: 'web_search_20260209' | 'web_search_20250305';
  maxSearches: number;
  /** 안전 분류기 거절 시 서버 쪽 다른 모델 재시도 (Opus만) */
  serverFallback: boolean;
}

export function modelProfile(model: string): ModelProfile {
  const haiku = model.startsWith('claude-haiku-');
  return {
    searchTool: haiku ? 'web_search_20250305' : 'web_search_20260209',
    maxSearches: haiku ? 2 : 4,
    serverFallback: model.startsWith('claude-opus-'),
  };
}

/** 크레딧(무료 포함)이 떨어졌을 때 Anthropic이 주는 오류인지 */
export const isCreditError = (message: string) => /credit balance is too low|insufficient (credit|balance)|purchase credits/i.test(message);
