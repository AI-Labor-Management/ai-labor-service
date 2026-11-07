// AI 노무 상담 — 모델 고르기·모델별 검색 도구·크레딧 소진 오류 구분
import { describe, expect, it } from 'vitest';
import { DEFAULT_AI_MODEL, isCreditError, modelProfile, pickModel } from '../../supabase/functions/api/ai-model';

describe('AI 모델 설정', () => {
  it('기본은 가장 싼 Haiku 5.5이고, 비밀 값으로 허용한 모델만 바꿀 수 있다', () => {
    expect(DEFAULT_AI_MODEL).toBe('claude-haiku-5-5');
    expect(pickModel(undefined)).toBe('claude-haiku-5-5');
    expect(pickModel('  claude-opus-5-5 ')).toBe('claude-opus-5-5');
    expect(pickModel('claude-sonnet-5-5')).toBe('claude-sonnet-5-5');
    expect(pickModel('claude-fable-5-1')).toBe('claude-haiku-5-5'); // 비싼 모델은 비밀 값만으로 켜지 않는다
    expect(pickModel('gpt-x')).toBe('claude-haiku-5-5');
  });

  it('Haiku는 기본 검색 도구·질문당 2회, Opus는 동적 필터 검색·4회·서버 재시도', () => {
    expect(modelProfile('claude-haiku-5-5')).toEqual({ searchTool: 'web_search_20250305', maxSearches: 2, serverFallback: false });
    expect(modelProfile('claude-opus-5-5')).toEqual({ searchTool: 'web_search_20260209', maxSearches: 4, serverFallback: true });
    expect(modelProfile('claude-sonnet-5-5')).toEqual({ searchTool: 'web_search_20260209', maxSearches: 4, serverFallback: false });
  });

  it('크레딧이 떨어졌다는 오류를 알아본다', () => {
    expect(isCreditError('400 {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."}}')).toBe(true);
    expect(isCreditError('overloaded_error')).toBe(false);
  });
});
