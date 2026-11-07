// AI 노무 상담: Claude 응답 블록 → 화면 계약(status/text/citations) 변환
import { describe, expect, it } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { toAiAnswer } from '../../supabase/functions/api/ai-answer';

const cite = (url: string, title: string): Anthropic.Beta.BetaCitationsWebSearchResultLocation => ({
  type: 'web_search_result_location',
  url,
  title,
  cited_text: '…',
  encrypted_index: 'x',
});
const text = (t: string, citations: Anthropic.Beta.BetaTextCitation[] | null = null): Anthropic.Beta.BetaTextBlock => ({
  type: 'text',
  text: t,
  citations,
});

describe('toAiAnswer', () => {
  it('상태 표시를 떼고, 웹 검색 인용을 중복 없이 근거로 모은다', () => {
    const a = toAiAnswer(
      [
        text('[상태:answer]\n주휴수당은 '),
        text('1주 15시간 이상 일하면 줘야 해요.', [cite('https://www.law.go.kr/법령/근로기준법', '근로기준법 제55조')]),
        text(' **꼭** 확인하세요.', [cite('https://www.law.go.kr/법령/근로기준법', '근로기준법 제55조'), cite('https://www.moel.go.kr/x', '')]),
      ],
      '2026-11-07',
    );
    expect(a.status).toBe('answer');
    expect(a.text).toBe('주휴수당은 1주 15시간 이상 일하면 줘야 해요. 꼭 확인하세요.');
    expect(a.citations).toEqual([
      { title: '근로기준법 제55조', url: 'https://www.law.go.kr/법령/근로기준법', checkedAt: '2026-11-07' },
      { title: 'https://www.moel.go.kr/x', url: 'https://www.moel.go.kr/x', checkedAt: '2026-11-07' },
    ]);
  });

  it('근거 없는 답은 근거 부족으로 바꾼다', () => {
    const a = toAiAnswer([text('[상태:answer]\n아마 그럴 거예요.')], '2026-11-07');
    expect(a.status).toBe('insufficient_evidence');
    expect(a.citations).toHaveLength(0);
  });

  it('전문가 확인 상태는 그대로 두고, 빈 응답은 근거 부족 안내로 채운다', () => {
    expect(toAiAnswer([text('[상태:expert_required]\n해고는 사실관계에 따라 달라요.')], 'd').status).toBe('expert_required');
    const empty = toAiAnswer([], 'd');
    expect(empty.status).toBe('insufficient_evidence');
    expect(empty.text).toMatch(/노무 전문가/);
  });
});
