// AI 노무 상담 — 앱의 검증된 근거 자료(규칙 44개·자주 묻는 질문)로만 답하게 하는 순수 부분 (Deno·Node 공통)
//  · 무료 Gemini는 웹 검색 근거를 쓸 수 없어서(무료 등급 미제공), 원문과 대조한 rules.json 값과 FAQ를 자료로 넘긴다.
//  · 모델은 자료 번호([R:…], [F:…])만 근거로 고르고, 서버가 그 번호를 국가법령정보센터·고시 링크로 바꾼다.
//  · 자료에 없으면 insufficient_evidence — 근거 없는 '답'을 만들지 않는다 (Claude 경로와 같은 계약).
import type { AiAnswer } from './ai-answer.ts';

/** 규칙 자료에 쓴 법령 약칭 → 국가법령정보센터 정식 이름 */
const LAW_NAMES: Record<string, string> = {
  퇴직급여법: '근로자퇴직급여 보장법',
  징수법: '고용보험 및 산업재해보상보험의 보험료징수 등에 관한 법률',
  '징수법 시행령': '고용보험 및 산업재해보상보험의 보험료징수 등에 관한 법률 시행령',
  기간제법: '기간제 및 단시간근로자 보호 등에 관한 법률',
  '기간제법 시행령': '기간제 및 단시간근로자 보호 등에 관한 법률 시행령',
  외국인고용법: '외국인근로자의 고용 등에 관한 법률',
  '남녀고용평등법 시행령': '남녀고용평등과 일ㆍ가정 양립 지원에 관한 법률 시행령',
  건강진단규칙: '식품위생 분야 종사자의 건강진단 규칙',
  공휴일규정: '관공서의 공휴일에 관한 규정',
};

export const lawFullName = (law: string) => LAW_NAMES[law] ?? law;

/** 국가법령정보센터 조문 주소 (예: https://www.law.go.kr/법령/근로기준법/제56조) */
export function lawUrl(law: string, article?: string): string {
  const name = encodeURIComponent(lawFullName(law).replace(/\s+/g, ''));
  return `https://www.law.go.kr/법령/${name}${article ? `/${encodeURIComponent(article)}` : ''}`;
}

export interface Source {
  type?: string;
  law?: string;
  article?: string;
  quote?: string;
  ref?: string;
  url?: string;
}
export interface Doc {
  id: string;
  title: string;
  text: string;
  url: string;
}
interface RuleLike {
  id: string;
  label: string;
  unit?: string;
}
interface ResolvedLike {
  ok: boolean;
  value?: unknown;
  sources?: Source[];
  note?: string;
}
interface FaqLike {
  id: string;
  q: string;
  oneLine: string;
  todo: string[];
  ruleIds: string[];
  basis: string;
  expert?: boolean;
}

const sourceUrl = (s: Source | undefined) =>
  !s ? 'https://www.law.go.kr' : s.url && /^https:\/\//.test(s.url) ? s.url : s.law ? lawUrl(s.law, s.article) : 'https://www.law.go.kr';
const sourceLabel = (s: Source) => [s.law ? lawFullName(s.law) : s.ref, s.article].filter(Boolean).join(' ');
const valueText = (v: unknown) => (typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v));

/** 오늘 시행 중인 규칙 값과 FAQ를 자료 목록으로 만든다 (시행령 대기 등 값이 없는 규칙은 뺀다) */
export function buildCorpus(rules: RuleLike[], resolve: (id: string) => ResolvedLike, faqs: FaqLike[]): Doc[] {
  const docs: Doc[] = [];
  const ruleUrl = new Map<string, string>();
  for (const r of rules) {
    const v = resolve(r.id);
    if (!v.ok) continue;
    const src = v.sources ?? [];
    const basis = src
      .slice(0, 3)
      .map((s) => `${sourceLabel(s)}${s.quote ? ` "${s.quote}"` : ''}`)
      .join('; ');
    const url = sourceUrl(src[0]);
    ruleUrl.set(r.id, url);
    docs.push({
      id: `R:${r.id}`,
      title: `${r.label}${src[0] ? ` (${sourceLabel(src[0])})` : ''}`,
      text: `${r.label}: ${valueText(v.value)}${r.unit ? ` [${r.unit}]` : ''}${basis ? ` · 근거: ${basis}` : ''}${v.note ? ` · 참고: ${v.note}` : ''}`,
      url,
    });
  }
  for (const f of faqs) {
    docs.push({
      id: `F:${f.id}`,
      title: `자주 묻는 질문 — ${f.q} (${f.basis})`,
      text: `질문: ${f.q} · 답: ${f.oneLine} · 할 일: ${f.todo.join(', ')} · 근거: ${f.basis}${f.expert ? ' · 노무 전문가 확인 권장' : ''}`,
      url: f.ruleIds.map((id) => ruleUrl.get(id)).find(Boolean) ?? 'https://www.law.go.kr',
    });
  }
  return docs;
}

export const corpusText = (docs: Doc[]) => docs.map((d) => `[${d.id}] ${d.text}`).join('\n');

/** 모델이 돌려줄 JSON 모양 */
export const ANSWER_SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['answer', 'insufficient_evidence', 'expert_required'] },
    text: { type: 'string', description: '한국어 존댓말 평문 답변 (마크다운 없이, 600자 안팎)' },
    sources: { type: 'array', items: { type: 'string' }, description: '답에 실제로 쓴 근거 자료 번호 (예: R:minimumWage.hourly, F:FAQ2)' },
  },
  required: ['status', 'text', 'sources'],
} as const;

const STATUSES = new Set(['answer', 'insufficient_evidence', 'expert_required']);

/** 모델 JSON → 화면 계약. 자료에 없는 번호는 버리고, 근거 없는 '답'은 근거 부족으로 바꾼다 */
export function toGroundedAnswer(raw: unknown, docs: Doc[], checkedAt: string): AiAnswer {
  const o = (raw && typeof raw === 'object' ? raw : {}) as { status?: unknown; text?: unknown; sources?: unknown };
  let status = (typeof o.status === 'string' && STATUSES.has(o.status) ? o.status : 'insufficient_evidence') as AiAnswer['status'];
  let text = (typeof o.text === 'string' ? o.text : '')
    .replace(/\[[RF]:[^\]]+\]/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^#+\s*/gm, '')
    .trim();
  const byId = new Map(docs.map((d) => [d.id, d]));
  const seen = new Map<string, string>();
  for (const id of Array.isArray(o.sources) ? o.sources : []) {
    const d = typeof id === 'string' ? byId.get(id.replace(/^\[|\]$/g, '').trim()) : undefined;
    if (d && !seen.has(d.url)) seen.set(d.url, d.title);
  }
  const citations = [...seen].slice(0, 5).map(([url, title]) => ({ title, url, checkedAt }));
  if (status === 'answer' && citations.length === 0) status = 'insufficient_evidence';
  if (!text) {
    status = 'insufficient_evidence';
    text = '앱에 있는 공식 근거 자료에서 이 질문의 답을 찾지 못했어요. 노무 전문가와 확인해 주세요.';
  }
  return { status, text, citations };
}
