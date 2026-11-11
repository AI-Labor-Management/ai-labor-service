// 규칙·근거 (rules.json) — 값마다 시행 구간·근거·확인 상태. 관리자 화면과 같은 표를 쓴다 (조회 전용).
import { useState } from 'react';
import { allRules, resolveRule, RULES_FILE, sourceLabel } from '../../domain/rules';
import { useStore } from '../../state/store';
import { Badge, Card, cx, inputBaseCls, PageHeader, RuleStatusBadge } from '../../ui/kit';

const CAT: Record<string, string> = { wage: '임금', work: '근무', leave: '연차', scope: '적용 범위', end: '퇴직·해고', docs: '서류', insurance: '보험', deadline: '기한', calendar: '공휴일', tax: '세금', family: '출산·육아', penalty: '벌칙' };

export function RulesTable({ date }: { date: string }) {
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const rules = allRules().filter((r) => (!cat || r.category === cat) && (!q || r.label.includes(q) || r.id.includes(q)));
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <select className={cx(inputBaseCls, 'w-auto')} value={cat} onChange={(e) => setCat(e.target.value)} aria-label="분류">
          <option value="">전체 분류</option>
          {Object.entries(CAT).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <input className={cx(inputBaseCls, 'w-56')} placeholder="검색" value={q} onChange={(e) => setQ(e.target.value)} aria-label="규칙 검색" />
      </div>
      <div className="grid gap-3">
        {rules.map((r) => {
          const now = resolveRule(r.id, date);
          return (
            <Card key={r.id}>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-bold">{r.label}</p>
                <Badge tone="muted">{CAT[r.category] ?? r.category}</Badge>
                <code className="text-xs text-muted">{r.id}</code>
                {r.check && <Badge tone="muted">검증표 {r.check}</Badge>}
                <span className="ml-auto text-xs">
                  기준일 값: <RuleStatusBadge status={now.ok ? now.status : now.reason === 'pending' ? 'pending' : 'missing'} />
                </span>
              </div>
              <div className="mt-2 overflow-x-auto"><table className="w-full min-w-[520px] text-xs">
                <thead className="text-left text-muted">
                  <tr>
                    <th className="py-1">시행 구간</th>
                    <th>값</th>
                    <th>상태</th>
                    <th>근거</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {r.values.map((v, i) => (
                    <tr key={i} className="align-top">
                      <td className="py-1 pr-2 whitespace-nowrap">
                        {v.effectiveFrom ?? '—'} ~ {v.effectiveTo ?? '현재'}
                      </td>
                      <td className="pr-2">
                        <code className="break-all">{typeof v.value === 'object' ? JSON.stringify(v.value) : String(v.value)}</code>
                      </td>
                      <td className="pr-2">
                        <RuleStatusBadge status={v.status} />
                        {v.verifiedAt && <span className="block text-muted">{v.verifiedAt}</span>}
                      </td>
                      <td>
                        {(v.sources ?? []).map((s, k) => (
                          <span key={k} className="block">
                            {sourceLabel(s)}
                            {s.check?.hash && <span className="text-muted"> · 해시 {s.check.hash}</span>}
                            {s.url && (
                              <a className="ml-1 text-info underline" href={s.url} target="_blank" rel="noreferrer noopener">
                                원문
                              </a>
                            )}
                          </span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
              {r.note && <p className="mt-1 text-xs text-muted">메모: {r.note}</p>}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default function Rules() {
  const { base } = useStore();
  return (
    <div>
      <PageHeader title="규칙·근거" sub={`data/rules.json · schema ${RULES_FILE.schema} · 생성 ${RULES_FILE.generatedAt} · ${RULES_FILE.basis}`} />
      <p className="mb-4 rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">
        파일명과 검증 표시만으로 법령 내용이 맞다고 단정하지 마세요. 원본 자료에는 "원문 확인" 기록과 "전부 미확인" Notion 대조표가 함께 있어요 — 상태를 자동으로 합치지 않았어요. 실제 운영 전 해당 날짜의 공식 원문과 다시 대조해야 해요.
      </p>
      <RulesTable date={base} />
    </div>
  );
}
