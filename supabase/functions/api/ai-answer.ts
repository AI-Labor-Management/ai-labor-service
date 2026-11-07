// AI 노무 상담 응답 변환 (Deno·Node 공통 순수 코드 — tests/backend/ai-answer.test.ts)
import type Anthropic from '@anthropic-ai/sdk';

export interface AiAnswer {
  status: 'answer' | 'insufficient_evidence' | 'expert_required';
  text: string;
  citations: { title: string; url: string; checkedAt: string }[];
}

/** Claude 응답 블록 → 화면 계약. 상태 표시를 떼고, 웹 검색 인용만 근거로 모은다 */
export function toAiAnswer(content: Anthropic.Beta.BetaContentBlock[], checkedAt: string): AiAnswer {
  let text = '';
  const seen = new Map<string, string>();
  for (const block of content) {
    if (block.type !== 'text') continue;
    text += block.text;
    for (const c of block.citations ?? []) {
      if (c.type === 'web_search_result_location' && /^https:\/\//.test(c.url) && !seen.has(c.url)) seen.set(c.url, c.title?.trim() || c.url);
    }
  }
  const m = text.match(/\[상태\s*:\s*(answer|insufficient_evidence|expert_required)\]/);
  let status: AiAnswer['status'] = (m?.[1] as AiAnswer['status']) ?? 'answer';
  text = text
    .replace(/\[상태\s*:\s*[a-z_]+\]\s*/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^#+\s*/gm, '')
    .trim();
  const citations = [...seen].slice(0, 5).map(([url, title]) => ({ title, url, checkedAt }));
  // 근거 없는 '답'은 근거 부족으로 바꾼다 (계약)
  if (status === 'answer' && citations.length === 0) status = 'insufficient_evidence';
  if (!text) {
    status = 'insufficient_evidence';
    text = '공식 자료에서 확인할 수 있는 근거를 찾지 못했어요. 노무 전문가와 확인해 주세요.';
  }
  return { status, text, citations };
}
