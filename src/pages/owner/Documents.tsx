// S11 서류 (F1): 체크리스트 | 요청 현황 | 서식 자료실. 파일은 받지 않고 상태·날짜·유효기간·보관 위치만 저장.
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useStore, uid, nowIso } from '../../state/store';
import { computeChecklist, type ChecklistRow } from '../../domain/checklist';
import { CHECKLIST_ITEMS, EVENT_GUIDES } from '../../data/checklistItems';
import { FORMS } from '../../data/forms';
import { addDays, addYears, fmtDate, fmtMD, isISODate } from '../../domain/dates';
import { Badge, Button, Card, copyText, cx, Empty, Field, inputCls, inputBaseCls, KV, levelTone, LinkButton, Modal, Notice, PageHeader, Tabs, useToast } from '../../ui/kit';

type Tab = 'list' | 'requests' | 'forms';
type Filter = 'todo' | 'done' | 'na' | 'all';

function statusBadge(r: ChecklistRow) {
  if (r.status === 'na') return <Badge tone="muted">해당 없음</Badge>;
  if (r.status === 'onboarding') return <Badge tone="info">정리 전</Badge>;
  if (r.status === 'done') return <Badge tone="ok">완료</Badge>;
  if (r.status === 'stored') return <Badge tone="ok">보관 중</Badge>;
  if (r.level) return <Badge tone={levelTone(r.level)}>{r.level === 'risk' ? '위험' : r.level === 'soon' ? '임박' : '확인'}</Badge>;
  return <Badge tone="warn">할 일</Badge>;
}

function ItemSheet({ row, onClose }: { row: ChecklistRow; onClose: () => void }) {
  const { state, update, base } = useStore();
  const toast = useToast();
  const rec = row.record;
  const [doneAt, setDoneAt] = useState(rec?.doneAt ?? base);
  const [loc, setLoc] = useState(rec?.location ?? '');
  const [exam, setExam] = useState(rec?.examDate ?? '');
  const [expiry, setExpiry] = useState(rec?.expiry ?? '');
  const [na, setNa] = useState(false);
  const [naReason, setNaReason] = useState('');
  const [err, setErr] = useState('');
  const isE5 = row.item.id === 'E5';
  const derived = row.item.group === 'monthly' || row.key.startsWith('F2:') || (row.key.startsWith('F1:') && !!state.employees.find((e) => e.id === row.employeeId)?.foreign?.checkedAt);
  const emp = state.employees.find((e) => e.id === row.employeeId);

  const save = (status: 'done' | 'stored' | 'na') => {
    if (status === 'na' && !naReason.trim()) return setErr('해당 없음 사유는 필수예요');
    if (status !== 'na' && !isISODate(doneAt)) return setErr('날짜를 입력하세요');
    if (isE5 && status !== 'na' && !isISODate(expiry)) return setErr('보건증 유효기간(만료일)을 입력하세요 — 검진일을 넣으면 1년 뒤로 제안해요');
    update((d) => {
      d.docRecords = d.docRecords.filter((x) => x.key !== row.key);
      d.docRecords.push({ id: uid('doc'), key: row.key, itemId: row.item.id, employeeId: row.employeeId, status, doneAt: status === 'na' ? null : doneAt, naReason: status === 'na' ? naReason.trim() : '', expiry: isE5 && expiry ? expiry : null, examDate: isE5 && exam ? exam : null, location: loc.trim(), bulk: false, updatedAt: nowIso() });
    });
    toast(status === 'na' ? '해당 없음으로 처리했어요' : '완료로 기록했어요 (실물은 사업장에 보관)');
    onClose();
  };
  const requestDoc = async () => {
    if (!emp) return;
    const due = addDays(base, 7);
    const text = `${emp.alias}님, ${row.item.title.replace(/ 작성·교부| 비치/, '')}을(를) ${fmtMD(due)}까지 가게로 가져와 주세요. 사본·사진 파일은 보내지 않아도 돼요.`;
    update((d) => {
      d.docRequests.unshift({ id: uid('req'), employeeId: emp.id, itemId: row.item.id, customName: row.item.title, status: 'requested', requestedAt: base, dueDate: due, receivedAt: null, fixReason: '', expiry: null, location: '', history: [{ status: 'requested', at: base, memo: '요청 문구 복사' }] });
    });
    const ok = await copyText(text);
    toast(ok ? '요청 문구를 복사했어요. 카톡·문자로 직접 보내세요.' : '요청을 남겼어요. 복사는 실패했어요 — 요청 현황에서 문구를 확인하세요', ok ? 'ok' : 'warn');
    onClose();
  };

  return (
    <Modal open onClose={onClose} wide title={`${row.title}${row.alias ? ` · ${row.alias}` : ''}`} footer={
      row.applies && !derived ? (
        <>
          {rec && <Button variant="ghost" onClick={() => { update((d) => { d.docRecords = d.docRecords.filter((x) => x.key !== row.key); }); toast('기록을 지웠어요 — 다시 할 일로 떠요', 'info'); onClose(); }}>기록 지우기</Button>}
          <Button onClick={() => setNa(!na)}>해당 없음 처리</Button>
          <Button onClick={() => save('stored')}>보관 중</Button>
          <Button variant="primary" onClick={() => save('done')}>{row.item.id === 'E1' ? '직원에게 줬어요' : '완료'}</Button>
        </>
      ) : undefined
    }>
      <div className="grid gap-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          {statusBadge(row)} {row.levelText && <span className="text-muted">{row.levelText}</span>}
          <Badge tone={row.item.evidence === 'verified' ? 'ok' : row.item.evidence === 'article' ? 'info' : 'warn'}>{row.item.evidence === 'verified' ? '원문 확인 (11.04)' : row.item.evidence === 'article' ? '조문 확인' : '원문 확인 전'}</Badge>
        </div>
        {!row.applies && <Notice tone="muted" title="지금은 해당 없음">{row.naReason}</Notice>}
        <KV k="쉬운 설명" v={<span className="font-normal">{row.item.plain}</span>} />
        {row.contractKind && <KV k="안내할 계약서" v={row.contractKind} />}
        <div>
          <p className="text-muted">해야 할 일</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5">
            {row.item.todo.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ol>
          <div className="mt-2 flex flex-wrap gap-2">
            {row.item.makeable === 'contract' && row.employeeId && (
              <LinkButton size="sm" variant="primary" to={`/owner/documents/make/contract/${row.employeeId}${row.conditionId ? `?cond=${row.conditionId}` : ''}`}>
                계약서 만들기
              </LinkButton>
            )}
            {row.item.makeable === 'roster' && row.employeeId && (
              <LinkButton size="sm" variant="primary" to={`/owner/documents/make/roster/${row.employeeId}`}>
                명부 만들기
              </LinkButton>
            )}
            {row.item.group === 'monthly' && <LinkButton size="sm" variant="primary" to={row.link}>급여 화면에서 확정</LinkButton>}
            {emp && ['E4', 'E5'].includes(row.item.id) && <Button size="sm" onClick={() => void requestDoc()}>직원에게 요청 (문구 복사)</Button>}
            {row.item.group === 'foreign' && emp && <LinkButton size="sm" to={`/owner/employees/${emp.id}`}>외국인 정보 확인</LinkButton>}
            <LinkButton size="sm" to={`/owner/consult?topic=${encodeURIComponent(row.item.title)}`}>전문가 상담 권장</LinkButton>
          </div>
        </div>
        <KV k="안 하면" v={<span className="font-normal">{row.item.penalty}</span>} />
        <KV k="보관" v={<span className="font-normal">{row.item.retention}</span>} />
        {row.item.reissue && <KV k="잃어버렸을 때" v={<span className="font-normal">{row.item.reissue}</span>} />}
        <KV k="근거" v={<span className="font-normal">{row.item.basis}</span>} />
        {row.applies && !derived && (
          <div className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-2">
            <Field label={row.item.id === 'E1' ? '직원에게 준 날' : '완료한 날'} htmlFor="is-d">
              <input id="is-d" type="date" className={inputCls} value={doneAt} onChange={(e) => setDoneAt(e.target.value)} />
            </Field>
            <Field label="보관 위치 (한 줄)" htmlFor="is-l" hint="개인정보는 적지 마세요">
              <input id="is-l" className={inputCls} value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="예: 카운터 서랍 파란 파일" />
            </Field>
            {isE5 && (
              <>
                <Field label="검진일" htmlFor="is-ex" hint="넣으면 1년 뒤를 만료일로 제안">
                  <input id="is-ex" type="date" className={inputCls} value={exam} onChange={(e) => { setExam(e.target.value); if (isISODate(e.target.value)) setExpiry(addYears(e.target.value, 1)); }} />
                </Field>
                <Field label="유효기간 (만료일)" htmlFor="is-exp" hint="보건증에 적힌 날짜로 고칠 수 있어요. 만료 30일 전부터 알려줘요">
                  <input id="is-exp" type="date" className={inputCls} value={expiry} onChange={(e) => setExpiry(e.target.value)} />
                </Field>
              </>
            )}
            {na && (
              <div className="sm:col-span-2">
                <Field label="해당 없음 사유 (필수)" htmlFor="is-na">
                  <input id="is-na" className={inputCls} value={naReason} onChange={(e) => setNaReason(e.target.value)} placeholder="예: 완전 포장 식품만 판매" />
                </Field>
                <Button size="sm" className="mt-2" onClick={() => save('na')}>해당 없음으로 저장</Button>
              </div>
            )}
            {err && <p role="alert" className="text-sm font-semibold text-risk sm:col-span-2">{err}</p>}
          </div>
        )}
        {derived && <p className="text-xs text-muted">이 항목은 연결된 화면(급여·직원 정보)의 상태로 자동 판단해요.</p>}
        <p className="text-xs text-muted">서비스의 체크는 사장님의 입력일 뿐이라 실물이 있는지 보증하지 않아요. 파일·사진은 받지 않아요.</p>
      </div>
    </Modal>
  );
}

function ChecklistTab() {
  const { state, update, base } = useStore();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const rows = useMemo(() => computeChecklist(state, base), [state, base]);
  const [filter, setFilter] = useState<Filter>('todo');
  const empF = params.get('emp') ?? '';
  const itemQ = params.get('item');
  const condQ = params.get('cond');
  const open = itemQ ? rows.find((r) => r.item.id === itemQ && (!empF || r.employeeId === empF) && (!condQ || r.conditionId === condQ)) ?? null : null;
  const [bulk, setBulk] = useState<string | null>(null);
  const [bulkSel, setBulkSel] = useState<Record<string, boolean>>({});
  const [inspect, setInspect] = useState(false);
  const closeSheet = () => setParams((p) => { p.delete('item'); p.delete('cond'); return p; }, { replace: true });
  const vis = rows.filter((r) => !empF || r.employeeId === empF || (!r.employeeId && !empF));
  const by = (f: Filter) => vis.filter((r) => (f === 'all' ? true : f === 'todo' ? r.applies && (r.status === 'todo' || r.status === 'onboarding') : f === 'done' ? r.status === 'done' || r.status === 'stored' : r.status === 'na'));
  const emps = state.employees.filter((e) => !e.resignDate || e.resignDate >= base);
  const urgent = vis.filter((r) => r.level && r.status !== 'done' && r.status !== 'na' && r.status !== 'stored');
  const empItems = ['E1', 'E3', 'E4', 'E5'];

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ['todo', '처리할 일'],
            ['done', '완료·보관'],
            ['na', '해당 없음'],
            ['all', '전체'],
          ] as const
        ).map(([f, l]) => (
          <Button key={f} size="sm" variant={filter === f ? 'primary' : 'secondary'} onClick={() => setFilter(f)}>
            {l} {by(f).length}
          </Button>
        ))}
        <select className={cx(inputBaseCls, 'w-auto')} value={empF} onChange={(e) => setParams((p) => { if (e.target.value) p.set('emp', e.target.value); else p.delete('emp'); return p; })} aria-label="직원 필터">
          <option value="">직원 전체</option>
          {state.employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.alias}
            </option>
          ))}
        </select>
        <Button size="sm" className="ml-auto" onClick={() => setInspect(true)}>
          점검 대비 목록
        </Button>
      </div>
      {urgent.length > 0 && (
        <Card title="지금 처리할 서류" right="위험 → 임박 → 확인">
          <ul className="divide-y divide-line">
            {urgent
              .sort((a, b) => ['risk', 'soon', 'check'].indexOf(a.level!) - ['risk', 'soon', 'check'].indexOf(b.level!))
              .map((r) => (
                <li key={r.key} className="flex items-center gap-3 py-2 text-sm">
                  {statusBadge(r)}
                  <span className="flex-1">
                    {r.alias && <b>{r.alias} </b>}
                    {r.title} <span className="text-muted">({r.levelText})</span>
                  </span>
                  <Button size="sm" onClick={() => setParams((p) => { p.set('item', r.item.id); if (r.employeeId) p.set('emp', r.employeeId); if (r.conditionId) p.set('cond', r.conditionId); return p; })}>
                    처리
                  </Button>
                </li>
              ))}
          </ul>
        </Card>
      )}
      <Card title="직원별 현황표" right={<Button size="sm" onClick={() => { setBulk('E1'); setBulkSel({}); }}>한 번에 체크</Button>}>
        {!emps.length ? (
          <p className="text-sm text-muted">직원을 등록하면 직원별 서류가 생겨요.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="py-1">직원</th>
                  {empItems.map((i) => (
                    <th key={i}>{CHECKLIST_ITEMS.find((x) => x.id === i)!.title.split(' ')[0].replace('(보건증)', '')}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {emps.map((e) => (
                  <tr key={e.id}>
                    <td className="py-2 font-semibold">{e.alias}</td>
                    {empItems.map((i) => {
                      const rs = rows.filter((r) => r.item.id === i && r.employeeId === e.id);
                      return (
                        <td key={i} className="py-1">
                          <div className="flex flex-wrap gap-1">
                            {rs.map((r) => (
                              <button key={r.key} type="button" className="rounded" onClick={() => setParams((p) => { p.set('item', i); p.set('emp', e.id); if (r.conditionId) p.set('cond', r.conditionId); return p; })} title={r.title}>
                                {statusBadge(r)}
                              </button>
                            ))}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {(['workplace', 'employee', 'monthly', 'foreign', 'event'] as const).map((g) => {
        const list = by(filter).filter((r) => r.item.group === g);
        if (!list.length) return null;
        return (
          <Card key={g} title={{ workplace: '사업장 공통 (서류 · 게시·교육)', employee: '직원별', monthly: '매달', foreign: '외국인 추가 항목 (원문 확인 전 — 기한·금액 표시 안 함)', event: '사유가 생겼을 때' }[g]}>
            <ul className="divide-y divide-line">
              {list.map((r) => (
                <li key={r.key} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                  {statusBadge(r)}
                  <Badge tone="muted">{r.item.kind}</Badge>
                  <span className="flex-1">
                    {r.alias && <b>{r.alias} </b>}
                    {r.title}
                    <span className="block text-xs text-muted">{r.status === 'na' ? r.naReason || r.record?.naReason : `${r.levelText}${r.record?.location ? ` · 보관: ${r.record.location}` : ''}`}{r.boundaryHint ? ` · ${r.boundaryHint}` : ''}</span>
                  </span>
                  <Button size="sm" onClick={() => setParams((p) => { p.set('item', r.item.id); if (r.employeeId) p.set('emp', r.employeeId); else p.delete('emp'); if (r.conditionId) p.set('cond', r.conditionId); return p; })}>
                    열기
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        );
      })}
      <Card title="사유가 생겼을 때 (안내)">
        <ul className="space-y-1 text-sm">
          {EVENT_GUIDES.map((g) => (
            <li key={g.id}>
              <b>{g.title}</b> — {g.when} · {g.scope} <span className="text-xs text-muted">({g.basis})</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted">직장 내 괴롭힘 예방은 서류 항목이 아니라 노무 위험 점검 9번에서 다뤄요.</p>
      </Card>
      {open && <ItemSheet row={open} onClose={closeSheet} />}
      <Modal open={!!bulk} onClose={() => setBulk(null)} title="한 번에 체크" footer={<><Button onClick={() => setBulk(null)}>취소</Button><Button variant="primary" onClick={() => { const targets = rows.filter((r) => r.item.id === bulk && bulkSel[r.key]); update((d) => { for (const r of targets) { d.docRecords = d.docRecords.filter((x) => x.key !== r.key); d.docRecords.push({ id: uid('doc'), key: r.key, itemId: r.item.id, employeeId: r.employeeId, status: 'done', doneAt: base, naReason: '', expiry: null, examDate: null, location: '', bulk: true, updatedAt: nowIso() }); } }); toast(`${targets.length}건을 확인함으로 처리했어요`); setBulk(null); }}>확인함으로 처리</Button></>}>
        <Field label="서류" htmlFor="bk-i">
          <select id="bk-i" className={inputCls} value={bulk ?? ''} onChange={(e) => { setBulk(e.target.value); setBulkSel({}); }}>
            {['E1', 'E3', 'E4'].map((i) => (
              <option key={i} value={i}>
                {CHECKLIST_ITEMS.find((x) => x.id === i)!.title}
              </option>
            ))}
          </select>
        </Field>
        <ul className="mt-3 space-y-1 text-sm">
          {rows.filter((r) => r.item.id === bulk && r.applies && r.status !== 'done' && r.status !== 'stored').map((r) => (
            <li key={r.key}>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={!!bulkSel[r.key]} onChange={(e) => setBulkSel({ ...bulkSel, [r.key]: e.target.checked })} /> {r.alias} · {r.title}
              </label>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted">보건증은 유효기간이 필요해 직원별로 처리해요.</p>
      </Modal>
      <Modal open={inspect} onClose={() => setInspect(false)} wide title="점검 대비 목록 (별칭)" footer={<Button variant="primary" onClick={() => window.print()}>인쇄</Button>}>
        <div className="print-area">
          <p className="hidden font-bold print:block">점검 대비 서류 목록 · {state.workplace?.name} · {fmtDate(base)}</p>
          <table className="w-full text-xs">
            <thead className="text-left text-muted">
              <tr>
                <th className="py-1">서류</th>
                <th>직원</th>
                <th>상태</th>
                <th>작성일</th>
                <th>보관 위치</th>
                <th>보관 기한</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.filter((r) => r.applies && r.item.kind === '서류').map((r) => (
                <tr key={r.key}>
                  <td className="py-1">{r.title}</td>
                  <td>{r.alias ?? '-'}</td>
                  <td>{{ todo: '미완료', done: '완료', na: '해당 없음', stored: '보관 중', onboarding: '정리 전' }[r.status]}</td>
                  <td>{r.record?.doneAt ?? '-'}</td>
                  <td>{r.record?.location || '-'}</td>
                  <td>{r.item.retention}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>
    </div>
  );
}

function RequestsTab() {
  const { state, update, base } = useStore();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ emp: state.employees[0]?.id ?? '', name: '', due: addDays(base, 7) });
  const [recv, setRecv] = useState<{ id: string; date: string; expiry: string; loc: string } | null>(null);
  const [fix, setFix] = useState<{ id: string; reason: string } | null>(null);
  const alias = (id: string) => state.employees.find((e) => e.id === id)?.alias ?? '';
  const idWarn = /(신분증|주민등록|외국인등록|여권)/.test(f.name);
  const text = (r: (typeof state.docRequests)[number]) => `${alias(r.employeeId)}님, ${r.customName}을(를) ${fmtMD(r.dueDate)}까지 가게로 가져와 주세요.${r.status === 'needsFix' ? ` (보완: ${r.fixReason})` : ''}`;
  return (
    <div className="grid gap-4">
      <div className="flex justify-between">
        <p className="text-sm text-muted">직원 앱에는 서류 기능이 없어요. 사장님이 문구를 복사해 직접 보내고, 실물을 받으면 [받음]으로 확인해요.</p>
        <Button variant="primary" onClick={() => setAdding(true)} reason={!state.employees.length ? '직원을 먼저 등록하세요' : undefined}>
          + 요청 추가
        </Button>
      </div>
      {!state.docRequests.length && <Empty title="요청한 서류가 없어요" />}
      <ul className="grid gap-2">
        {state.docRequests.map((r) => (
          <li key={r.id} className="rounded-xl border border-line bg-white p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <b>{alias(r.employeeId)}</b> {r.customName}
              <Badge tone={r.status === 'received' ? 'ok' : r.status === 'needsFix' ? 'warn' : r.dueDate < base ? 'risk' : 'info'}>{r.status === 'received' ? `받음 ${fmtMD(r.receivedAt)}` : r.status === 'needsFix' ? `보완 필요 (${r.fixReason})` : `요청함 ${fmtMD(r.requestedAt)} · 기한 ${fmtMD(r.dueDate)}`}</Badge>
              {r.expiry && <span className="text-xs text-muted">만료 {fmtDate(r.expiry)}</span>}
              {r.location && <span className="text-xs text-muted">보관: {r.location}</span>}
            </div>
            {r.status !== 'received' && (
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" onClick={async () => toast((await copyText(text(r))) ? '문구를 복사했어요' : '복사 실패 — 아래 문구를 직접 선택하세요', 'info')}>문구 복사</Button>
                <Button size="sm" variant="primary" onClick={() => setRecv({ id: r.id, date: base, expiry: '', loc: '' })}>받음</Button>
                <Button size="sm" onClick={() => setFix({ id: r.id, reason: '' })}>보완 필요</Button>
                {r.status === 'needsFix' && <Button size="sm" onClick={() => update((d) => { const x = d.docRequests.find((y) => y.id === r.id)!; x.status = 'requested'; x.requestedAt = base; x.history.push({ status: 'requested', at: base, memo: '다시 요청' }); })}>다시 요청</Button>}
              </div>
            )}
            <p className="mt-1 text-xs text-muted">“{text(r)}”</p>
            <p className="text-[11px] text-muted">{r.history.map((h) => `${fmtMD(h.at)} ${({ requested: '요청', received: '받음', needsFix: '보완 필요' } as const)[h.status]}${h.memo ? `(${h.memo})` : ''}`).join(' → ')}</p>
          </li>
        ))}
      </ul>
      <Modal open={adding} onClose={() => setAdding(false)} title="서류 요청 추가" footer={<><Button onClick={() => setAdding(false)}>취소</Button><Button variant="primary" onClick={() => { if (!f.name.trim() || !f.emp) return; update((d) => { d.docRequests.unshift({ id: uid('req'), employeeId: f.emp, itemId: null, customName: f.name.trim(), status: 'requested', requestedAt: base, dueDate: f.due, receivedAt: null, fixReason: '', expiry: null, location: '', history: [{ status: 'requested', at: base, memo: '' }] }); }); setAdding(false); toast('요청을 남겼어요. 문구를 복사해 보내세요.'); }} reason={!f.name.trim() ? '서류 이름을 적어 주세요' : undefined}>추가</Button></>}>
        <div className="grid gap-3">
          <Field label="직원" htmlFor="rq-e">
            <select id="rq-e" className={inputCls} value={f.emp} onChange={(e) => setF({ ...f, emp: e.target.value })}>
              {state.employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.alias}
                </option>
              ))}
            </select>
          </Field>
          <Field label="서류 이름" htmlFor="rq-n" hint="목록에 없는 서류도 이름만 적어 요청할 수 있어요. 내용(계좌번호 등)은 받지 않아요">
            <input id="rq-n" className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          {idWarn && <Notice tone="warn" title="번호가 보이는 사본은 보관 주의">주민등록증·외국인등록증 사본은 받지 않는 것이 원칙이에요. 꼭 필요하면 번호를 가리고 받으세요.</Notice>}
          <Field label="기한" htmlFor="rq-d">
            <input id="rq-d" type="date" className={inputCls} value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} />
          </Field>
        </div>
      </Modal>
      <Modal open={!!recv} onClose={() => setRecv(null)} title="받음 처리" footer={<><Button onClick={() => setRecv(null)}>취소</Button><Button variant="primary" onClick={() => { if (!recv) return; update((d) => { const x = d.docRequests.find((y) => y.id === recv.id)!; x.status = 'received'; x.receivedAt = recv.date; x.expiry = recv.expiry || null; x.location = recv.loc; x.history.push({ status: 'received', at: recv.date, memo: '' }); if (x.itemId === 'E5' && recv.expiry) { const key = `E5:${x.employeeId}`; d.docRecords = d.docRecords.filter((r) => r.key !== key); d.docRecords.push({ id: uid('doc'), key, itemId: 'E5', employeeId: x.employeeId, status: 'done', doneAt: recv.date, naReason: '', expiry: recv.expiry, examDate: null, location: recv.loc, bulk: false, updatedAt: nowIso() }); } }); setRecv(null); toast('받음으로 기록했어요'); }}>저장</Button></>}>
        {recv && (
          <div className="grid gap-3">
            <Field label="받은 날" htmlFor="rv-d">
              <input id="rv-d" type="date" className={inputCls} value={recv.date} onChange={(e) => setRecv({ ...recv, date: e.target.value })} />
            </Field>
            <Field label="유효기간 (보건증 등, 선택)" htmlFor="rv-e" hint="입력하면 기한 화면으로 넘어가요">
              <input id="rv-e" type="date" className={inputCls} value={recv.expiry} onChange={(e) => setRecv({ ...recv, expiry: e.target.value })} />
            </Field>
            <Field label="보관 위치" htmlFor="rv-l">
              <input id="rv-l" className={inputCls} value={recv.loc} onChange={(e) => setRecv({ ...recv, loc: e.target.value })} />
            </Field>
          </div>
        )}
      </Modal>
      <Modal open={!!fix} onClose={() => setFix(null)} title="보완 필요" footer={<><Button onClick={() => setFix(null)}>취소</Button><Button variant="primary" onClick={() => { if (!fix?.reason.trim()) return; update((d) => { const x = d.docRequests.find((y) => y.id === fix.id)!; x.status = 'needsFix'; x.fixReason = fix.reason.trim(); x.history.push({ status: 'needsFix', at: base, memo: fix.reason.trim() }); }); setFix(null); }} reason={!fix?.reason.trim() ? '사유를 적어 주세요' : undefined}>저장</Button></>}>
        <Field label="사유 한 줄" htmlFor="fx-r">
          <input id="fx-r" className={inputCls} value={fix?.reason ?? ''} onChange={(e) => fix && setFix({ ...fix, reason: e.target.value })} placeholder="예: 서명 누락" />
        </Field>
      </Modal>
    </div>
  );
}

function FormsTab() {
  const { state, update } = useStore();
  const toast = useToast();
  const [f, setF] = useState({ name: '', url: '' });
  const firstEmp = state.employees[0]?.id;
  return (
    <div className="grid gap-4">
      <Notice tone="muted">공식 원본은 서버에 두지 않고 링크만 걸어요. 세부 서식 링크·개정일은 아직 확보하지 못해 제공 기관 홈페이지로 연결해요 (마지막 확인일: 확인 전).</Notice>
      {(['채용할 때', '매달', '바뀔 때', '퇴사할 때'] as const).map((g) => (
        <Card key={g} title={g}>
          <ul className="divide-y divide-line">
            {FORMS.filter((x) => x.group === g).map((x) => (
              <li key={x.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <span className="flex-1">
                  <b>{x.name}</b>
                  <span className="block text-xs text-muted">
                    {x.provider} · 개정일 {x.revised ?? '확인 전'} · 마지막 확인 {x.lastChecked ?? '확인 전'}
                    {x.note ? ` · ${x.note}` : ''}
                  </span>
                </span>
                {x.make === 'contract' || x.make === 'roster' ? (
                  <LinkButton size="sm" to={firstEmp ? `/owner/documents/make/${x.make}/${firstEmp}` : '/owner/employees/new'}>
                    만들기
                  </LinkButton>
                ) : x.make === 'statement' || x.make === 'ledger' ? (
                  <LinkButton size="sm" to="/owner/payroll">
                    만들기 (급여)
                  </LinkButton>
                ) : (
                  <Button size="sm" reason="이 서식은 만들기를 지원하지 않아요">
                    만들기
                  </Button>
                )}
                {x.url ? (
                  <a className="rounded-lg border border-line px-2.5 py-1 text-sm font-semibold hover:bg-canvas" href={x.url} target="_blank" rel="noreferrer noopener">
                    원본 보기 ↗
                  </a>
                ) : (
                  <Button size="sm" reason="링크 미확보">
                    원본 보기
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      ))}
      <Card title="우리 사업장 자체 양식 (링크만)">
        <div className="flex flex-wrap items-end gap-2">
          <Field label="이름" htmlFor="cf-n">
            <input id="cf-n" className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <Field label="링크 (https://)" htmlFor="cf-u">
            <input id="cf-u" className={inputCls} value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} />
          </Field>
          <Button
            onClick={() => {
              if (!f.name.trim() || !/^https?:\/\//.test(f.url.trim())) return toast('이름과 http(s) 링크를 입력하세요', 'warn');
              update((d) => {
                d.customForms.push({ id: uid('cf'), name: f.name.trim(), url: f.url.trim() });
              });
              setF({ name: '', url: '' });
            }}
          >
            등록
          </Button>
        </div>
        <ul className="mt-2 text-sm">
          {state.customForms.map((c) => (
            <li key={c.id} className="flex items-center gap-2 py-1">
              <a href={c.url} target="_blank" rel="noreferrer noopener" className="text-brand underline">
                {c.name}
              </a>
              <button type="button" className="text-muted" aria-label="삭제" onClick={() => update((d) => { d.customForms = d.customForms.filter((x) => x.id !== c.id); })}>
                ✕
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-1 text-xs text-muted">파일 업로드는 받지 않아요 (파일 저장소를 두지 않는 설계).</p>
      </Card>
    </div>
  );
}

export default function Documents() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'list';
  const { base } = useStore();
  return (
    <div>
      <PageHeader title="서류" sub={`기준일 ${fmtDate(base)} · 참고용 안내 · 서류 실물은 가게에 보관하고, 서비스는 상태만 관리해요`} actions={<Link to="/owner/deadlines" className="text-sm text-brand underline">기한 보기</Link>} />
      <Tabs<Tab>
        tabs={[
          { value: 'list', label: '체크리스트' },
          { value: 'requests', label: '요청 현황' },
          { value: 'forms', label: '서식 자료실' },
        ]}
        value={tab}
        onChange={(t) => setParams({ tab: t }, { replace: true })}
      />
      {tab === 'list' && <ChecklistTab />}
      {tab === 'requests' && <RequestsTab />}
      {tab === 'forms' && <FormsTab />}
    </div>
  );
}
