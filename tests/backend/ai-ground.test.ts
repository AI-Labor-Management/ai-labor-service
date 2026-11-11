// 무료 Gemini용 근거 자료(검증된 규칙·FAQ)와 답 변환 — 근거 없는 답을 만들지 않는 계약
import { describe, expect, it } from 'vitest';
import rulesFile from '../../src/data/rules.json';
import { FAQS } from '../../src/data/faq';
import { resolveRule } from '../../src/domain/rules';
import { buildCorpus, corpusText, lawUrl, toGroundedAnswer } from '../../supabase/functions/api/ai-ground';

const TODAY = '2026-11-15';
const docs = buildCorpus(rulesFile.rules, (id) => resolveRule(id, TODAY), FAQS);
const byId = new Map(docs.map((d) => [d.id, d]));

describe('근거 자료', () => {
  it('오늘 시행 중인 규칙과 FAQ를 모두 담고 번호가 겹치지 않는다', () => {
    const okRules = rulesFile.rules.filter((r) => resolveRule(r.id, TODAY).ok).length;
    expect(docs.filter((d) => d.id.startsWith('R:'))).toHaveLength(okRules);
    expect(docs.filter((d) => d.id.startsWith('F:'))).toHaveLength(FAQS.length);
    expect(new Set(docs.map((d) => d.id)).size).toBe(docs.length);
  });

  it('법령 근거는 국가법령정보센터 조문 주소, 고시는 원문 주소로 연결한다', () => {
    const wh = byId.get('R:weeklyHoliday.minWeeklyHours')!;
    expect(wh.url).toBe(lawUrl('근로기준법', '제18조'));
    expect(decodeURIComponent(wh.url)).toBe('https://www.law.go.kr/법령/근로기준법/제18조');
    expect(wh.text).toContain('15시간 미만인 근로자에 대하여는');
    for (const d of docs) expect(d.url).toMatch(/^https:\/\//);
  });

  it('법령 약칭은 정식 이름으로 바꾼다', () => {
    expect(decodeURIComponent(lawUrl('퇴직급여법', '제4조'))).toBe('https://www.law.go.kr/법령/근로자퇴직급여보장법/제4조');
    expect(decodeURIComponent(lawUrl('공휴일규정'))).toBe('https://www.law.go.kr/법령/관공서의공휴일에관한규정');
  });

  it('자료 전체가 무료 등급에서 부담 없는 크기다 (6만 자 이하)', () => {
    expect(corpusText(docs).length).toBeLessThan(60_000);
  });
});

describe('답 변환', () => {
  it('고른 자료 번호를 근거 링크로 바꾸고, 없는 번호는 버린다', () => {
    const a = toGroundedAnswer({ status: 'answer', text: '주 15시간 이상이면 줘요 [R:weeklyHoliday.minWeeklyHours]', sources: ['R:weeklyHoliday.minWeeklyHours', 'F:FAQ2', 'R:없는번호'] }, docs, TODAY);
    expect(a.status).toBe('answer');
    expect(a.text).toBe('주 15시간 이상이면 줘요');
    expect(a.citations.map((c) => c.url)).toContain(lawUrl('근로기준법', '제18조'));
    expect(a.citations.every((c) => c.checkedAt === TODAY)).toBe(true);
  });

  it('괄호 없이 본문에 쓴 자료 번호도 지우고, 남는 쉼표·빈 근거 표시를 정리한다', () => {
    const t = (text: string) => toGroundedAnswer({ status: 'answer', text, sources: ['F:FAQ1'] }, docs, TODAY).text;
    expect(t('가산이 없어요. · 근거: 근로기준법 제56조, 근로기준법 시행령 별표 1, F:FAQ1')).toBe('가산이 없어요. · 근거: 근로기준법 제56조, 근로기준법 시행령 별표 1');
    expect(t('근거: F:FAQ1, 근로기준법 제55조')).toBe('근거: 근로기준법 제55조');
    expect(t('최저임금은 10,320원이에요 (R:minimumWage.hourly).')).toBe('최저임금은 10,320원이에요.');
    expect(t('주휴수당을 줘요.\n· 근거: F:FAQ2\n· 할 일: 시간 확인')).toBe('주휴수당을 줘요.\n· 할 일: 시간 확인');
    // 금액의 쉼표·시각·평범한 콜론은 그대로
    expect(t('월 2,156,880원, 오후 10:00부터. 참고: 연도별로 바뀌어요')).toBe('월 2,156,880원, 오후 10:00부터. 참고: 연도별로 바뀌어요');
  });

  it('근거 없는 답·이상한 상태·빈 답은 근거 부족으로 바꾼다', () => {
    expect(toGroundedAnswer({ status: 'answer', text: '아마 그럴 거예요', sources: [] }, docs, TODAY).status).toBe('insufficient_evidence');
    expect(toGroundedAnswer({ status: 'maybe', text: 'x', sources: ['F:FAQ1'] }, docs, TODAY).status).toBe('insufficient_evidence');
    const empty = toGroundedAnswer(null, docs, TODAY);
    expect(empty.status).toBe('insufficient_evidence');
    expect(empty.text).toContain('노무 전문가');
  });

  it('전문가 확인 상태는 근거가 없어도 그대로 둔다', () => {
    expect(toGroundedAnswer({ status: 'expert_required', text: '해고는 개별 판단이 필요해요', sources: [] }, docs, TODAY).status).toBe('expert_required');
  });
});
