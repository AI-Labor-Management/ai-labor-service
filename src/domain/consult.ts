// 상담 (16_상담). FAQ 먼저 → AI(연결 대기) → 노무 전문가 연결(고른 항목만, 동의 후, 철회 가능).
import { FAQS, type Faq } from '../data/faq';
import type { AppState, ISODate } from './types';

export function searchFaq(query: string): { faq: Faq; score: number }[] {
  const q = query.replace(/\s+/g, ' ').trim();
  if (!q) return [];
  const tokens = q.split(/[\s,.?!]+/).filter((t) => t.length >= 1);
  return FAQS.map((faq) => {
    let score = 0;
    for (const k of faq.keywords) if (q.includes(k)) score += 3;
    for (const t of tokens) if (t.length >= 2 && (faq.q.includes(t) || faq.oneLine.includes(t))) score += 1;
    return { faq, score };
  })
    .filter((x) => x.score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

/** 실명은 패턴으로 잡을 수 없어 안내만 하고, 주민등록번호·전화번호·외국인등록번호 패턴은 막는다 */
export function detectPII(text: string): string[] {
  const found: string[] = [];
  if (/\d{6}\s*-?\s*[1-8]\d{6}/.test(text)) found.push('주민등록번호·외국인등록번호로 보이는 숫자');
  if (/01[016789]\s*-?\s*\d{3,4}\s*-?\s*\d{4}/.test(text)) found.push('휴대폰 번호');
  if (/0\d{1,2}-\d{3,4}-\d{4}/.test(text)) found.push('전화번호');
  return Array.from(new Set(found));
}

export const EXPERT_TOPICS = ['해고·징계', '임금 체불 다툼', '직장 내 괴롭힘·성희롱 신고', '통상임금·근로자 여부(3.3%)', '산재 사고', '체류자격 문제', '수습 감액', '임금 공제', '기타'];

export function needsExpert(query: string): boolean {
  return /(해고|징계|진정|노동청|체불|괴롭힘|성희롱|산재|사고|체류|불법|통상임금|3\.3|프리랜서|소송|부당)/.test(query);
}

export function buildMemo(state: AppState, question: string, faq: Faq | null, base: ISODate): string {
  const wp = state.workplace;
  const ind = wp ? { food: '음식점·카페', retail: '소매', service: '기타 서비스업' }[wp.industry] : '-';
  const lines = [
    `상담 전 정리 메모 · 작성 ${base} · 참고용`,
    '',
    `질문: ${question || '(입력 없음)'}`,
    `사업장 조건: ${ind} · 상시 ${wp?.scale ?? '-'}명 구간`,
  ];
  if (faq) {
    lines.push(`관련 안내: ${faq.oneLine}`);
    lines.push(`관련 조문: ${faq.basis}`);
  } else lines.push('관련 조문: 자동으로 찾지 못함 — 전문가 확인 필요');
  lines.push('확인할 점:');
  lines.push('  1. 사실관계(날짜·근무 시간·지급 내역)');
  lines.push('  2. 사업장 규모별 적용 여부');
  lines.push('  3. 서비스 화면의 "확인 필요" 항목');
  lines.push('');
  lines.push('※ 이 메모는 브라우저에서만 만들었고 저장되지 않아요. 직원 실명·번호는 넣지 마세요.');
  return lines.join('\n');
}

/** 하루 3회 제한용 비가역 키 (번호 원문을 저장하지 않기 위함). 보안 해시가 아닌 데모용 — 운영 시 서버 HMAC으로 교체 */
export function phoneKey(phone: string, date: ISODate): string {
  const s = `${phone.replace(/\D/g, '')}|${date}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

export function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, '');
  if (d.length < 10) return '***';
  return `${d.slice(0, 3)}-****-${d.slice(-4)}`;
}

export function isValidMobile(phone: string): boolean {
  return /^01[016789]-?\d{3,4}-?\d{4}$/.test(phone.trim());
}
