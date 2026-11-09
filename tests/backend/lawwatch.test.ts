// 법령 변경 감지 — 규칙에서 조문 뽑기, 법제처 응답 해석, 기준·상태 판정, 새 알림 고르기 (법제처 응답은 가짜)
import { describe, expect, it } from 'vitest';
import { articleOf, type Drf, joCode, lawRefs, newlyFlagged, normNo, parseVersions, runWatch, type RuleLike, type WatchPrev } from '../../supabase/functions/_shared/lawwatch-core';
import { alertText } from '../../supabase/functions/_shared/lawwatch-core';
import rulesFile from '../../src/data/rules.json';

const src = (law: string, article: string | undefined, lawNumber: string, versionStatus = 'current', versionFrom = '2026-10-08') => ({
  type: 'law',
  law,
  article,
  check: { lawNumber, versionStatus, versionFrom },
});
const RULES: RuleLike[] = [
  { id: 'a', values: [{ sources: [src('근로기준법', '제54조', '법률 제21533호'), src('근로기준법', '제54조', '법률 제21533호', 'scheduled', '2026-12-10')] }] },
  { id: 'b', values: [{ sources: [src('근로기준법', '제61조', '법률 제21533호'), { type: 'notice', law: undefined, article: undefined }] }] },
  { id: 'c', values: [{ sources: [src('건강진단규칙', '제2조', '총리령 제2156호')] }] },
];

const search = (name: string, rows: [string, string, string, string, string][]) => ({
  LawSearch: { law: rows.map(([status, mst, eff, no, prom]) => ({ 법령명한글: name, 현행연혁코드: status, 법령일련번호: mst, 시행일자: eff, 공포번호: no, 공포일자: prom, 제개정구분명: '일부개정' })) },
});
const article = (no: number, title: string, paras: string[], changed = 'N', branch?: number) => ({
  법령: { 조문: { 조문단위: { 조문번호: String(no), ...(branch ? { 조문가지번호: String(branch) } : {}), 조문여부: '조문', 조문변경여부: changed, 조문내용: `제${no}조(${title})`, 항: paras.map((p) => ({ 항내용: p })) } } },
});

/** 가짜 법제처: 판(MST@시행일)마다 조문 본문 */
function fakeDrf(texts: Record<string, string[]>, versions: Record<string, [string, string, string, string, string][]>): Drf {
  return async (path, q) => {
    if (path === 'lawSearch.do') return search(q.query, versions[q.query] ?? []);
    const n = Number(q.JO.slice(0, 4));
    const paras = texts[`${q.MST}@${q.efYd}#${n}`];
    return paras ? article(n, '제목', paras) : { 법령: { 기본정보: {} } };
  };
}

describe('규칙에서 감시할 조문 뽑기', () => {
  it('법령#조문마다 하나, 검증 공포번호·시행 예정일을 모은다', () => {
    const refs = lawRefs(RULES);
    expect(refs.map((r) => r.key)).toEqual(['건강진단규칙#제2조', '근로기준법#제54조', '근로기준법#제61조']);
    const r54 = refs.find((r) => r.key === '근로기준법#제54조')!;
    expect(r54.verifiedNo).toBe('21533');
    expect(r54.scheduledFrom).toEqual(['2026-12-10']);
    expect(refs[0].lawFull).toBe('식품위생 분야 종사자의 건강진단 규칙');
  });

  it('실제 rules.json에서 조문 50개 이상을 읽고 조문 번호를 모두 해석한다', () => {
    const refs = lawRefs((rulesFile as unknown as { rules: RuleLike[] }).rules);
    expect(refs.length).toBeGreaterThanOrEqual(50);
    for (const r of refs) if (r.article) expect(joCode(r.article), r.key).not.toBeNull();
  });

  it('조문 번호 → JO 값, 공포번호 앞 0 정리', () => {
    expect(joCode('제56조')).toBe('005600');
    expect(joCode('제16조의10')).toBe('001610');
    expect(joCode('56조')).toBeNull();
    expect(normNo('02156')).toBe('2156');
  });
});

describe('법제처 응답 해석', () => {
  it('현행 판과 시행 예정 판(시행일 순)을 고르고 다른 이름은 뺀다', () => {
    const j = search('근로기준법', [
      ['시행예정', '286771', '20270610', '21784', '20260609'],
      ['시행예정', '286771', '20261210', '21784', '20260609'],
      ['현행', '285279', '20261008', '21533', '20260407'],
      ['연혁', '283457', '20260820', '21373', '20260219'],
    ]);
    j.LawSearch.law.push({ ...j.LawSearch.law[2], 법령명한글: '근로기준법 시행령', 현행연혁코드: '현행' });
    const v = parseVersions(j, '근로기준법');
    expect(v.current).toMatchObject({ mst: '285279', effective: '2026-10-08', no: '21533' });
    expect(v.upcoming.map((u) => u.effective)).toEqual(['2026-12-10', '2027-06-10']);
  });

  it('조문 본문을 제목·항·호 순으로 읽고 가지 조문을 구별한다', () => {
    const j = {
      법령: {
        조문: {
          조문단위: [
            { 조문번호: '7', 조문여부: '조문', 조문내용: '제7조(가)', 항: { 항내용: '① 본문', 호: [{ 호내용: '1. 하나' }, { 호내용: '2.  둘 ' }] } },
            { 조문번호: '7', 조문가지번호: '2', 조문여부: '조문', 조문변경여부: 'Y', 조문내용: '제7조의2(나) 내용' },
          ],
        },
      },
    };
    expect(articleOf(j, '제7조')).toEqual({ text: '제7조(가)\n① 본문\n1. 하나\n2. 둘', changedFlag: false });
    expect(articleOf(j, '제7조의2')).toEqual({ text: '제7조의2(나) 내용', changedFlag: true });
    expect(articleOf(j, '제8조')).toBeNull();
  });
});

describe('감지와 판정', () => {
  const versions = {
    근로기준법: [
      ['현행', '1', '20261008', '21533', '20260407'],
      ['시행예정', '2', '20261210', '21784', '20260609'],
      ['시행예정', '2', '20270610', '21784', '20260609'],
    ] as [string, string, string, string, string][],
    '식품위생 분야 종사자의 건강진단 규칙': [['현행', '9', '20260929', '02156', '20260929']] as [string, string, string, string, string][],
  };
  const texts: Record<string, string[]> = {
    '1@20261008#54': ['① 휴게 원문'],
    '2@20261210#54': ['① 휴게 원문. 다만 바뀜'], // rules.json에 반영된 예정 개정
    '2@20270610#54': ['① 휴게 원문. 다만 바뀜'], // 앞 판과 같음 → 새 개정 아님
    '1@20261008#61': ['① 제60조제7항'],
    '2@20261210#61': ['① 제60조제7항'],
    '2@20270610#61': ['① 제60조제8항'], // 모르던 개정
    '9@20260929#2': ['① 건강진단 대상'],
  };

  it('첫 감지: 검증한 판이면 기준을 잡고, 반영 안 된 예정 개정만 알린다 (공포번호 앞 0은 같은 판)', async () => {
    const refs = lawRefs(RULES);
    const { rows, errors } = await runWatch(refs, new Map(), fakeDrf(texts, versions));
    expect(errors).toBe(0);
    const by = Object.fromEntries(rows.map((r) => [r.key, r]));
    expect(by['근로기준법#제54조'].status).toBe('ok');
    expect(by['근로기준법#제54조'].upcoming).toMatchObject([{ effective: '2026-12-10', known: true }]);
    expect(by['근로기준법#제61조'].status).toBe('upcoming');
    expect(by['근로기준법#제61조'].upcoming).toMatchObject([{ effective: '2027-06-10', no: '21784', known: false, text: '제61조(제목)\n① 제60조제8항' }]);
    expect(by['건강진단규칙#제2조'].status).toBe('ok');
    expect(by['근로기준법#제54조'].baseline_no).toBe('21533');
    expect(newlyFlagged(rows, new Map()).map((r) => r.key)).toEqual(['근로기준법#제61조']);
    expect(alertText(newlyFlagged(rows, new Map()))).toContain('근로기준법 제61조(개정 예정)');
    expect(alertText([])).toBe('');
  });

  it('다음 감지: 같으면 다시 알리지 않고, 원문이 바뀌면 changed, 예정 개정이 시행되면 기준을 옮긴다', async () => {
    const refs = lawRefs(RULES);
    const first = await runWatch(refs, new Map(), fakeDrf(texts, versions));
    const prev = new Map<string, WatchPrev>(first.rows.map((r) => [r.key, r]));
    const again = await runWatch(refs, prev, fakeDrf(texts, versions));
    expect(newlyFlagged(again.rows, prev)).toEqual([]);

    // 법제처가 현행 조문을 고쳤다 (공포번호 그대로)
    const edited = await runWatch(refs, prev, fakeDrf({ ...texts, '9@20260929#2': ['① 건강진단 대상 (고침)'] }, versions));
    const r2 = edited.rows.find((r) => r.key === '건강진단규칙#제2조')!;
    expect(r2.status).toBe('changed');
    expect(newlyFlagged(edited.rows, prev).map((r) => r.key)).toContain('건강진단규칙#제2조');

    // 2026-12-10이 지나 예정 개정이 현행이 됐다 → rules.json에 반영된 시행일이라 기준을 옮기고 ok
    const later = {
      ...versions,
      근로기준법: [
        ['현행', '2', '20261210', '21784', '20260609'],
        ['시행예정', '2', '20270610', '21784', '20260609'],
      ] as [string, string, string, string, string][],
    };
    const applied = await runWatch(refs, prev, fakeDrf(texts, later));
    const r54 = applied.rows.find((r) => r.key === '근로기준법#제54조')!;
    expect(r54.status).toBe('ok');
    expect(r54.detail).toContain('2026-12-10 시행 예정이던 개정');
    expect(r54.baseline_no).toBe('21784');
  });

  it('검증한 판을 못 본 채 개정됐으면 amended, 조문이 없으면 missing, 법령을 못 찾으면 error', async () => {
    const refs = lawRefs([
      { id: 'x', values: [{ sources: [src('근로기준법', '제61조', '법률 제21000호'), src('근로기준법', '제99조', '법률 제21533호'), src('없는법', '제1조', '법률 제1호')] }] },
    ]);
    const { rows, errors } = await runWatch(refs, new Map(), fakeDrf(texts, versions));
    const by = Object.fromEntries(rows.map((r) => [r.key, r]));
    expect(by['근로기준법#제61조'].status).toBe('amended');
    expect(by['근로기준법#제61조'].detail).toContain('제21000호 → 제21533호');
    expect(by['근로기준법#제99조'].status).toBe('missing');
    expect(by['없는법#제1조'].status).toBe('error');
    expect(errors).toBe(1);
  });

  it('법제처 호출이 실패하면 그 법령 조문만 error로 두고 기준은 지킨다', async () => {
    const refs = lawRefs(RULES);
    const first = await runWatch(refs, new Map(), fakeDrf(texts, versions));
    const prev = new Map<string, WatchPrev>(first.rows.map((r) => [r.key, r]));
    const failing: Drf = async (path, q) => {
      if (path === 'lawSearch.do' && q.query === '근로기준법') throw new Error('timeout');
      return fakeDrf(texts, versions)(path, q);
    };
    const { rows, errors } = await runWatch(refs, prev, failing);
    expect(errors).toBe(2);
    const r54 = rows.find((r) => r.key === '근로기준법#제54조')!;
    expect(r54.status).toBe('error');
    expect(r54.baseline_hash).toBe(prev.get('근로기준법#제54조')!.baseline_hash);
    expect(newlyFlagged(rows, prev)).toEqual([]);
  });
});
