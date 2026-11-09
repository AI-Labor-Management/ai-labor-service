// 법령 변경 감지 — Deno·Node 공통 순수 부분 (tests/backend/lawwatch.test.ts)
// rules.json이 계산에 쓰는 조문(출처 type 'law')을 법제처 국가법령정보 OPEN API 원문과 대조한다.
//  · 기준: rules.json에 적은 검증 당시 법령 공포번호(check.lawNumber). 그 판의 원문을 처음 본 날 해시를 기준으로 삼는다.
//  · 지금 원문(현행)이 기준과 다르면 changed, 기준 판을 못 본 채 법령이 개정됐으면 amended,
//    공포됐지만 아직 시행 전인 개정(시행예정)이 이 조문을 바꾸면 upcoming.
//  · 값은 자동으로 바꾸지 않는다. 사람이 원문을 확인하고 rules.json을 고치면(공포번호·시행일) 다음 감지에서 기준이 옮겨진다.
import { lawFullName, lawUrl } from './lawnames.ts';

interface LawSourceLike {
  type?: string;
  law?: string;
  article?: string;
  check?: { lawNumber?: string; versionFrom?: string | null; versionStatus?: string };
}
export interface RuleLike {
  id: string;
  values: { sources?: LawSourceLike[] }[];
}

export interface LawRef {
  key: string; // '근로기준법#제56조' — 조문 없이 법령만 적은 출처는 '근로기준법 시행령#'
  law: string; // rules.json에 적은 이름 (줄임말 포함)
  lawFull: string;
  article: string | null;
  verifiedNo: string | null; // 검증 당시 공포번호 (숫자만)
  scheduledFrom: string[]; // rules.json에 이미 반영한 시행 예정일 (YYYY-MM-DD)
  ruleIds: string[];
}

// 공포번호는 '02156'처럼 앞에 0이 붙어 오기도 한다 — 숫자로 맞춘다
export const normNo = (no: unknown) => {
  const s = String(no ?? '').trim();
  return /^\d+$/.test(s) ? String(Number(s)) : s;
};
const noOf = (lawNumber?: string) => {
  const m = lawNumber?.match(/제(\d+)호/);
  return m ? normNo(m[1]) : null;
};

/** rules.json → 감시할 조문 목록 (법령#조문마다 하나) */
export function lawRefs(rules: RuleLike[]): LawRef[] {
  const m = new Map<string, LawRef>();
  for (const r of rules)
    for (const v of r.values)
      for (const s of v.sources ?? []) {
        if (s.type !== 'law' || !s.law) continue;
        const article = s.article?.trim() || null;
        const key = `${s.law}#${article ?? ''}`;
        const ref = m.get(key) ?? { key, law: s.law, lawFull: lawFullName(s.law), article, verifiedNo: null, scheduledFrom: [], ruleIds: [] };
        if (s.check?.versionStatus === 'scheduled') {
          const from = s.check.versionFrom;
          if (from && !ref.scheduledFrom.includes(from)) ref.scheduledFrom.push(from);
        } else {
          const no = noOf(s.check?.lawNumber);
          // 같은 조문을 여러 규칙이 쓰면 더 최근 판(큰 번호)을 기준으로
          if (no && (!ref.verifiedNo || Number(no) > Number(ref.verifiedNo))) ref.verifiedNo = no;
        }
        if (!ref.ruleIds.includes(r.id)) ref.ruleIds.push(r.id);
        m.set(key, ref);
      }
  return [...m.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/** '제56조' → '005600', '제7조의2' → '000702' (lawService.do JO 값) */
export function joCode(article: string): string | null {
  const m = article.match(/^제(\d+)조(?:의(\d+))?$/);
  return m ? m[1].padStart(4, '0') + (m[2] ?? '0').padStart(2, '0') : null;
}

const ymd = (s: unknown) => {
  const d = String(s ?? '');
  return /^\d{8}$/.test(d) ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : '';
};
const sameName = (a: string, b: string) => {
  const n = (s: string) => s.replace(/\s+/g, '').replace(/[·ㆍ・]/g, 'ㆍ');
  return n(a) === n(b);
};
const list = <T>(v: T | T[] | undefined | null): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);

export interface LawVersion {
  mst: string; // 법령일련번호
  effective: string; // 시행일자 YYYY-MM-DD
  no: string; // 공포번호
  promulgated: string; // 공포일자
  kind: string; // 제개정구분명 (일부개정·타법개정 …)
}

/** lawSearch.do target=eflaw(시행일 법령) → 지금 시행 중인 판과 시행 예정 판 */
export function parseVersions(json: unknown, fullName: string): { current: LawVersion | null; upcoming: LawVersion[] } {
  const rows = list((json as { LawSearch?: { law?: unknown } })?.LawSearch?.law as Record<string, unknown>[] | undefined);
  const vs = rows
    .filter((x) => sameName(String(x['법령명한글'] ?? ''), fullName))
    .map((x) => ({
      status: String(x['현행연혁코드'] ?? ''),
      v: { mst: String(x['법령일련번호'] ?? ''), effective: ymd(x['시행일자']), no: normNo(x['공포번호']), promulgated: ymd(x['공포일자']), kind: String(x['제개정구분명'] ?? '') },
    }))
    .filter((x) => x.v.mst && x.v.effective);
  const current = vs.find((x) => x.status === '현행')?.v ?? null;
  const seen = new Set<string>();
  const upcoming = vs
    .filter((x) => x.status === '시행예정')
    .map((x) => x.v)
    .filter((v) => !seen.has(`${v.mst}@${v.effective}`) && !!seen.add(`${v.mst}@${v.effective}`))
    .sort((a, b) => a.effective.localeCompare(b.effective) || Number(a.no) - Number(b.no));
  return { current, upcoming };
}

export interface ArticleText {
  text: string; // 조문 제목 + 항·호·목 (공백 정리)
  changedFlag: boolean; // 이 판에서 조문이 바뀌었다는 법제처 표시(조문변경여부)
}

/** lawService.do(JO 지정) 응답에서 그 조문 본문 */
export function articleOf(json: unknown, article: string): ArticleText | null {
  const m = article.match(/^제(\d+)조(?:의(\d+))?$/);
  if (!m) return null;
  const law = (json as Record<string, unknown>)?.['법령'] as Record<string, unknown> | undefined;
  const units = list((law?.['조문'] as Record<string, unknown> | undefined)?.['조문단위'] as Record<string, unknown>[] | undefined);
  const u = units.find(
    (x) => x['조문여부'] === '조문' && String(x['조문번호']) === String(Number(m[1])) && String(x['조문가지번호'] ?? '').replace(/^0+/, '') === (m[2] ? String(Number(m[2])) : ''),
  );
  if (!u) return null;
  const parts: string[] = [];
  const add = (v: unknown) => {
    for (const s of list(v as unknown)) if (typeof s === 'string') parts.push(s);
    else if (Array.isArray(s)) s.forEach(add);
  };
  add(u['조문내용']);
  for (const h of list(u['항'] as Record<string, unknown>[] | undefined)) {
    add(h['항내용']);
    for (const ho of list(h['호'] as Record<string, unknown>[] | undefined)) {
      add(ho['호내용']);
      for (const mo of list(ho['목'] as Record<string, unknown>[] | undefined)) add(mo['목내용']);
    }
  }
  const text = parts
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
  return text ? { text, changedFlag: u['조문변경여부'] === 'Y' } : null;
}

export async function hashText(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)]
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export type WatchStatus = 'ok' | 'changed' | 'amended' | 'upcoming' | 'missing' | 'error';
export const FLAGGED: WatchStatus[] = ['changed', 'amended', 'upcoming', 'missing'];

export interface UpcomingChange {
  effective: string;
  no: string;
  promulgated: string;
  kind: string;
  known: boolean; // rules.json에 이미 시행 예정으로 반영함
  text: string | null; // 바뀐 뒤 조문 (없어지면 null)
}

export interface WatchRow {
  key: string;
  law: string;
  article: string | null;
  law_full: string;
  rule_ids: string[];
  status: WatchStatus;
  detail: string;
  verified_no: string | null;
  current_no: string | null;
  current_effective: string | null;
  text_hash: string | null;
  baseline_hash: string | null;
  baseline_no: string | null;
  upcoming: UpcomingChange[];
  article_text: string | null;
  url: string;
}

export type WatchPrev = Pick<WatchRow, 'baseline_hash' | 'baseline_no' | 'status' | 'upcoming'>;

interface Observed {
  version: LawVersion;
  article: (ArticleText & { hash: string }) | null; // 조문 없이 법령만이면 null
  upcoming: UpcomingChange[];
}

/** 한 조문 판정 — 기준(검증한 판의 원문 해시)을 옮기고 상태를 정한다 */
export function judge(ref: LawRef, prev: WatchPrev | undefined, now: Observed): Pick<WatchRow, 'status' | 'detail' | 'baseline_hash' | 'baseline_no'> {
  let bh = prev?.baseline_hash ?? null;
  let bn = prev?.baseline_no ?? null;
  const { version: v, article: a } = now;
  const target = ref.verifiedNo;
  let note = '';
  if (ref.article && a) {
    if (target ? v.no === target && (bn !== target || !bh) : !bh) {
      // 검증한 판을 처음 보거나 rules.json이 새 판으로 다시 검증됐다 → 지금 원문이 기준
      bh = a.hash;
      bn = v.no;
    } else if (bh && a.hash !== bh && ref.scheduledFrom.includes(v.effective)) {
      // rules.json에 미리 반영해 둔 개정이 예정대로 시행됐다 → 기준을 옮긴다
      bh = a.hash;
      bn = v.no;
      note = `${v.effective} 시행 예정이던 개정이 시행됐어요 (rules.json에 반영돼 있음).`;
    }
  }
  const pending = now.upcoming.filter((u) => !u.known);
  const soon = pending.length ? ` 또 ${pending.map((u) => `${u.effective}부터 바뀌는 개정(제${u.no}호)`).join('·')}이 공포됐어요.` : '';
  const out = (status: WatchStatus, detail: string) => ({ status, detail: detail.trim(), baseline_hash: bh, baseline_no: bn });
  if (ref.article && !a) return out('missing', `지금 시행 중인 ${ref.lawFull}(제${v.no}호)에서 ${ref.article}를 찾지 못했어요. 삭제·이동됐는지 원문을 확인해 주세요.`);
  if (a && bh && a.hash !== bh)
    return out('changed', `검증한 원문(제${bn}호)과 지금 시행 중인 조문(제${v.no}호, ${v.effective} 시행)이 달라요. 원문을 확인하고 rules.json을 고쳐 주세요.${soon}`);
  if (target && v.no !== target && !(a && bh))
    return out(
      'amended',
      `검증 뒤 법령이 개정됐어요 (제${target}호 → 제${v.no}호, ${v.effective} 시행).${a ? (a.changedFlag ? ' 법제처 표시로는 이 조문도 바뀌었어요.' : ' 법제처 표시로는 이 조문은 그대로예요.') : ''} 원문을 확인해 주세요.${soon}`,
    );
  if (pending.length) return out('upcoming', `${pending.map((u) => `${u.effective}부터 이 조문이 바뀌어요 (제${u.no}호, ${u.promulgated} 공포)`).join(' · ')}. 시행 전에 rules.json에 반영해 주세요.`);
  if (target && v.no !== target) note += ` 법령은 개정됐지만(제${v.no}호) 이 조문은 검증한 원문 그대로예요.`;
  return out('ok', note || '검증한 원문과 같아요.');
}

/** 법제처 DRF 호출 (Referer·인증키는 호출하는 쪽이 붙인다) */
export type Drf = (path: 'lawSearch.do' | 'lawService.do', params: Record<string, string>) => Promise<unknown>;

async function pool<T>(items: T[], n: number, fn: (t: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) await fn(items[i++]);
    }),
  );
}

/** 감지 한 번 — 법령마다 판 목록을 받고, 조문마다 지금 판·시행 예정 판의 본문을 받아 비교한다 */
export async function runWatch(refs: LawRef[], prev: Map<string, WatchPrev>, drf: Drf, opts: { concurrency?: number } = {}): Promise<{ rows: WatchRow[]; calls: number; errors: number }> {
  let calls = 0;
  const call: Drf = (p, q) => {
    calls++;
    return drf(p, q);
  };
  const byLaw = new Map<string, LawRef[]>();
  for (const r of refs) byLaw.set(r.lawFull, [...(byLaw.get(r.lawFull) ?? []), r]);

  const versions = new Map<string, { current: LawVersion | null; upcoming: LawVersion[] } | Error>();
  await pool([...byLaw.keys()], opts.concurrency ?? 4, async (full) => {
    try {
      versions.set(full, parseVersions(await call('lawSearch.do', { target: 'eflaw', query: full, display: '100', nw: '1,2,3' }), full));
    } catch (e) {
      versions.set(full, e instanceof Error ? e : new Error(String(e)));
    }
  });

  // 같은 판의 같은 조문은 한 번만 받는다
  const texts = new Map<string, Promise<ArticleText | null>>();
  const fetchArticle = (v: LawVersion, article: string) => {
    const k = `${v.mst}@${v.effective}#${article}`;
    if (!texts.has(k)) texts.set(k, call('lawService.do', { target: 'eflaw', MST: v.mst, efYd: v.effective.replaceAll('-', ''), JO: joCode(article) ?? '' }).then((j) => articleOf(j, article)));
    return texts.get(k)!;
  };

  const rows: WatchRow[] = [];
  let errors = 0;
  await pool(refs, opts.concurrency ?? 4, async (ref) => {
    const base = { key: ref.key, law: ref.law, article: ref.article, law_full: ref.lawFull, rule_ids: ref.ruleIds, verified_no: ref.verifiedNo, url: lawUrl(ref.law, ref.article) };
    const p = prev.get(ref.key);
    const fail = (detail: string): WatchRow => {
      errors++;
      return { ...base, status: 'error', detail, current_no: null, current_effective: null, text_hash: null, article_text: null, upcoming: p?.upcoming ?? [], baseline_hash: p?.baseline_hash ?? null, baseline_no: p?.baseline_no ?? null };
    };
    const vs = versions.get(ref.lawFull);
    if (!vs || vs instanceof Error) return void rows.push(fail(`법령 목록을 받지 못했어요: ${vs instanceof Error ? vs.message : '응답 없음'}`.slice(0, 300)));
    if (!vs.current) return void rows.push(fail(`국가법령정보센터에서 '${ref.lawFull}'의 현행 판을 찾지 못했어요. 법령 이름이 바뀌었는지 확인해 주세요.`));
    if (ref.article && !joCode(ref.article)) return void rows.push(fail(`조문 번호 형식을 읽지 못했어요: ${ref.article}`));
    try {
      let article: Observed['article'] = null;
      const upcoming: UpcomingChange[] = [];
      if (ref.article) {
        const cur = await fetchArticle(vs.current, ref.article);
        article = cur ? { ...cur, hash: await hashText(cur.text) } : null;
        // 시행 예정 판은 시행일 순으로 바로 앞 판과 비교한다 (뒤 판은 앞 판의 개정을 이미 담고 있다)
        let before = article?.hash ?? null;
        for (const u of vs.upcoming) {
          const next = await fetchArticle(u, ref.article);
          const nextHash = next ? await hashText(next.text) : null;
          if (nextHash === before) continue;
          before = nextHash;
          upcoming.push({ effective: u.effective, no: u.no, promulgated: u.promulgated, kind: u.kind, known: ref.scheduledFrom.includes(u.effective), text: next?.text.slice(0, 4000) ?? null });
        }
      }
      const j = judge(ref, p, { version: vs.current, article, upcoming });
      rows.push({
        ...base,
        ...j,
        current_no: vs.current.no,
        current_effective: vs.current.effective,
        text_hash: article?.hash ?? null,
        article_text: article?.text.slice(0, 4000) ?? null,
        upcoming,
      });
    } catch (e) {
      rows.push(fail(`조문을 받지 못했어요: ${e instanceof Error ? e.message : String(e)}`.slice(0, 300)));
    }
  });
  rows.sort((a, b) => a.key.localeCompare(b.key));
  return { rows, calls, errors };
}

/** 이번 감지에서 새로 알릴 것 — 상태가 새로 '확인 필요'가 됐거나, 모르던 시행 예정 개정이 새로 보인 조문 */
export function newlyFlagged(rows: WatchRow[], prev: Map<string, WatchPrev>): WatchRow[] {
  return rows.filter((r) => {
    if (!FLAGGED.includes(r.status)) return false;
    const p = prev.get(r.key);
    if (!p || p.status !== r.status) return true;
    const before = new Set((p.upcoming ?? []).map((u) => `${u.no}@${u.effective}`));
    return r.upcoming.some((u) => !u.known && !before.has(`${u.no}@${u.effective}`));
  });
}

const STATUS_WORD: Record<WatchStatus, string> = { ok: '그대로', changed: '원문 바뀜', amended: '법령 개정', upcoming: '개정 예정', missing: '조문 없음', error: '확인 실패' };
export const statusWord = (s: WatchStatus) => STATUS_WORD[s];

/** 관리자 카카오톡 알림 문구 (짧게) */
export function alertText(flagged: WatchRow[]): string {
  const first = flagged[0];
  if (!first) return '';
  const name = (r: WatchRow) => `${r.law}${r.article ? ` ${r.article}` : ''}(${STATUS_WORD[r.status]})`;
  return `[사람샘각 관리자] 법령 변경 감지 ${flagged.length}건: ${name(first)}${flagged.length > 1 ? ` 외 ${flagged.length - 1}건` : ''}. 관리자 화면에서 원문을 확인해 주세요.`;
}
