// S13 상담: 자주 묻는 질문 → AI(연결 대기) → 노무 전문가 연결(고른 항목만, 동의 후, 철회 가능). 대화는 저장하지 않는다.
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useStore, uid, nowIso } from '../../state/store';
import { buildMemo, detectPII, EXPERT_TOPICS, needsExpert, searchFaq } from '../../domain/consult';
import { FAQS, type Faq } from '../../data/faq';
import { conditionAt, currentTimes, weeklyHours } from '../../domain/work';
import { addDays, fmtDate, WEEKDAY_KO, fmtDateTime, localDate } from '../../domain/dates';
import type { ShareItem } from '../../domain/types';
import { Badge, Basis, Button, Card, copyText, download, Field, inputCls, Notice, PageHeader, Tabs, useToast } from '../../ui/kit';
import { INDUSTRY_LABEL, SCALE_LABEL } from '../../ui/labels';

type Tab = 'faq' | 'expert' | 'sent';

export default function Consult() {
  const { state, update, base, mode } = useStore();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const topicQ = params.get('topic') ?? '';
  const tab = (params.get('tab') as Tab) || (topicQ ? 'expert' : 'faq');
  const setTab = (t: Tab) => setParams((p) => { p.set('tab', t); return p; }, { replace: true });
  const [q, setQ] = useState(topicQ ? `${topicQ} 관련해서 확인하고 싶어요` : '');
  const [asked, setAsked] = useState('');
  const [picked, setPicked] = useState<Faq | null>(null);
  const pii = detectPII(q);
  const results = useMemo(() => (asked ? searchFaq(asked) : []), [asked]);
  const memo = buildMemo(state, asked || q, picked ?? results[0]?.faq ?? searchFaq(asked || q)[0]?.faq ?? null, base);
  const [share, setShare] = useState<ShareItem[]>(['memo', 'workplace']);
  const [empSel, setEmpSel] = useState<string[]>([]);
  const [topic, setTopic] = useState(EXPERT_TOPICS.find((t) => topicQ.includes(t.split('·')[0])) ?? (topicQ ? '기타' : EXPERT_TOPICS[0]));
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const emps = state.employees.filter((e) => !e.resignDate || e.resignDate >= base);

  const ask = () => {
    if (pii.length) return;
    setAsked(q.trim());
    setPicked(null);
  };
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const send = () => {
    if (busy || !consent || !share.length) return;
    if (detectPII(memo).length) return toast('메모에 번호 패턴이 있어 보낼 수 없어요', 'risk');
    setBusy(true);
    const wp = state.workplace!;
    const snapshot = {
      workplace: share.includes('workplace') ? { industry: wp.industry, scale: wp.scale } : undefined,
      conditions: share.includes('conditions')
        ? empSel.map((id) => {
            const e = state.employees.find((x) => x.id === id)!;
            const c = conditionAt(state.conditions, id, base);
            return { alias: e.alias, text: c ? `시급 ${c.hourlyWage.toLocaleString('ko-KR')}원 · 주 ${weeklyHours(c).toFixed(1)}시간 · ${c.variable ? '매주 달라요' : c.schedule.map((d, i) => (d ? `${WEEKDAY_KO[i]} ${d.start}-${d.end}` : null)).filter(Boolean).join(', ')} · 입사 ${e.hireDate}` : '근로조건 없음' };
          })
        : undefined,
      attendance: share.includes('attendance')
        ? empSel.map((id) => {
            const e = state.employees.find((x) => x.id === id)!;
            const lines = state.attendance
              .filter((a) => a.employeeId === id && a.date >= addDays(base, -28))
              .map((a) => {
                const t = currentTimes(a, state.attendanceEdits);
                return `${a.recordNo} ${a.date} ${t.clockIn ?? '—'}~${t.clockOut ?? '—'} ${a.status === 'confirmed' ? '확정' : '확인 대기'}${state.attendanceEdits.some((x) => x.recordId === a.id) ? ' (수정 이력 있음)' : ''}`;
              });
            return { alias: e.alias, lines };
          })
        : undefined,
    };
    update((d) => {
      d.consults.unshift({ id: uid('cs'), topic, question: asked || q, memo, shareItems: share, employeeIds: empSel, snapshot, consentAt: nowIso(), revokedAt: null, status: 'demo-delivered', createdAt: nowIso() });
    });
    setBusy(false);
    setConsent(false);
    if (mode === 'server') toast('협력 노무법인 요청함에 보냈어요 (고른 항목만 · 언제든 철회할 수 있어요)');
    else toast('로컬 데모: 이 브라우저의 노무법인 화면에만 도착했어요 (실제 전송 아님)', 'warn');
    setTab('sent');
  };

  return (
    <div className="max-w-4xl">
      <PageHeader title="상담" sub="AI는 노무사를 대신하지 않아요. 기본 답은 바로, 복잡한 건은 정리된 상태로 노무법인에 넘겨요." />
      <Tabs<Tab>
        tabs={[
          { value: 'faq', label: '자주 묻는 질문 · AI에게 묻기' },
          { value: 'expert', label: '노무 전문가 상담' },
          { value: 'sent', label: `보낸 상담 (${state.consults.length})` },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'faq' && (
        <div className="grid gap-4">
          <Card>
            <Field label="질문" htmlFor="cs-q" hint="실명·주민번호·전화번호를 적지 마세요. 대화는 저장하지 않고 이 화면에서만 보여요." error={pii.length ? `${pii.join(', ')}가 들어 있어 보낼 수 없어요. 지우고 다시 입력하세요.` : null}>
              <textarea id="cs-q" rows={3} className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder="예: 직원이 수습 중인데 월급을 덜 줘도 되나요?" />
            </Field>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="primary" onClick={ask} reason={!q.trim() ? '질문을 입력하세요' : pii.length ? '개인정보 패턴을 지워야 해요' : undefined}>
                묻기
              </Button>
              <span className="text-xs text-muted">
                {state.workplace && `${INDUSTRY_LABEL[state.workplace.industry]} · ${SCALE_LABEL[state.workplace.scale]} 조건이 함께 붙어요 (직원 이름·금액은 안 붙어요)`}
              </span>
            </div>
          </Card>
          {asked && (
            <Card title={`Q. ${asked}`}>
              {results.length ? (
                <div className="grid gap-3">
                  {results.map(({ faq }) => (
                    <FaqAnswer key={faq.id} faq={faq} base={base} onExpert={() => { setPicked(faq); setTab('expert'); }} />
                  ))}
                </div>
              ) : (
                <Notice tone="warn" title="자주 묻는 질문에서 찾지 못했어요">
                  AI 상담은 <b>연결 대기</b>예요 (제공사 미정 — 서버 위치·학습 활용 여부 확인 후 결정). 근거 조문을 찾지 못하면 답을 지어내지 않고 전문가 상담을 권해요.
                  <div className="mt-2">
                    <Button size="sm" variant="primary" onClick={() => setTab('expert')}>
                      노무 전문가와 확인하기
                    </Button>
                  </div>
                </Notice>
              )}
              {needsExpert(asked) && (
                <Notice tone="risk" className="mt-3" title="분쟁·신고·판례 판단이 필요한 질문 같아요">
                  징계·해고 정당성은 서비스가 판단하지 않아요. 날짜·근무 시간·지급 내역 등 기록을 먼저 모아 두세요.
                  <div className="mt-2">
                    <Button size="lg" variant="primary" onClick={() => setTab('expert')}>
                      노무 전문가와 확인하기
                    </Button>
                  </div>
                </Notice>
              )}
            </Card>
          )}
          <Card title="자주 묻는 질문">
            <div className="grid gap-2">
              {FAQS.map((f) => (
                <details key={f.id} className="rounded-xl border border-line p-3">
                  <summary className="cursor-pointer font-semibold">{f.q}</summary>
                  <div className="mt-2">
                    <FaqAnswer faq={f} base={base} onExpert={() => { setPicked(f); setAsked(f.q); setTab('expert'); }} />
                  </div>
                </details>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">FAQ 문구는 기획 문서를 바탕으로 쓴 초안이며 노무법인 검수 전이에요.</p>
          </Card>
        </div>
      )}
      {tab === 'expert' && (
        <div className="grid gap-4">
          <Notice tone="brand" title="노무사 연결은 무료, 상담 비용과 방식은 노무법인과 직접">
            협력 노무법인 (협약 후 표시) · 연결 대가를 받지 않아요. <b>로컬 데모:</b> 보내면 이 브라우저의 노무법인 화면에만 도착하고 실제로 전송되지 않아요.
          </Notice>
          <Card title="1. 상담 주제">
            <select className={inputCls} value={topic} onChange={(e) => setTopic(e.target.value)} aria-label="상담 주제">
              {EXPERT_TOPICS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Card>
          <Card title="2. 보낼 항목 고르기 (사장님이 직접)">
            <div className="grid gap-2 text-sm">
              {(
                [
                  ['memo', '상담 전 정리 메모'],
                  ['workplace', '사업장 조건 (업종·규모)'],
                  ['conditions', '직원 근로조건 (별칭)'],
                  ['attendance', '최근 4주 출퇴근 기록'],
                ] as [ShareItem, string][]
              ).map(([k, l]) => (
                <label key={k} className="flex items-center gap-2">
                  <input type="checkbox" checked={share.includes(k)} onChange={() => setShare(toggle(share, k))} /> {l}
                </label>
              ))}
              {(share.includes('conditions') || share.includes('attendance')) && (
                <div className="rounded-xl border border-line p-2">
                  <p className="text-xs text-muted">어느 직원 것을 보낼까요?</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {emps.map((e) => (
                      <label key={e.id} className="flex items-center gap-1">
                        <input type="checkbox" checked={empSel.includes(e.id)} onChange={() => setEmpSel(toggle(empSel, e.id))} /> {e.alias}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {share.includes('memo') && (
              <div className="mt-3">
                <p className="text-sm font-semibold">정리 메모 미리보기</p>
                <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap rounded-xl bg-canvas p-3 text-xs">{memo}</pre>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" onClick={async () => toast((await copyText(memo)) ? '메모를 복사했어요' : '복사 실패', 'info')}>복사</Button>
                  <Button size="sm" onClick={() => download(`상담메모-${base}.txt`, memo, 'text/plain;charset=utf-8')}>파일로 저장</Button>
                </div>
              </div>
            )}
          </Card>
          <Card title="3. 동의">
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>
                <b>[필수] 노무법인 제공 동의</b> — 받는 곳: 협력 노무법인 · 항목: 위에서 고른 것만 · 목적: 노무 상담 · 보유: 상담 종료 후 일정 기간(확정 전). 보낸 뒤에도 공유를 철회할 수 있어요.
                <br />
                <span className="text-xs text-muted">제3자 제공 vs 위탁 판단과 동의 문구는 노무사·법률 확인 전이에요 (C15).</span>
              </span>
            </label>
            <Button className="mt-3" variant="primary" size="lg" onClick={send} disabled={busy} reason={!share.length ? '보낼 항목을 하나 이상 고르세요' : (share.includes('conditions') || share.includes('attendance')) && !empSel.length ? '직원을 고르세요' : !consent ? '노무법인 제공 동의가 필요해요' : undefined}>
              {mode === 'server' ? '협력 노무법인에 보내기' : '보내기 (로컬 데모)'}
            </Button>
          </Card>
        </div>
      )}
      {tab === 'sent' && (
        <div className="grid gap-3">
          {!state.consults.length && <p className="text-sm text-muted">보낸 상담이 없어요.</p>}
          {state.consults.map((c) => (
            <Card key={c.id} title={c.topic} right={fmtDateTime(c.createdAt)}>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {c.revokedAt ? <Badge tone="muted">공유 철회 {localDate(c.revokedAt)}</Badge> : mode === 'server' ? <Badge tone="ok">노무법인 요청함에 저장됨</Badge> : <Badge tone="warn">로컬 데모 도착 · 실제 전송 아님</Badge>}
                {c.status === 'firm-read' && !c.revokedAt && <Badge tone="info">노무법인 확인함{mode === 'server' ? '' : ' (데모)'}</Badge>}
                <span className="text-muted">공유 항목: {c.shareItems.map((s) => ({ memo: '정리 메모', workplace: '사업장 조건', conditions: '근로조건', attendance: '출퇴근 기록' })[s]).join(', ')}</span>
              </div>
              <p className="mt-2 text-sm">{c.question}</p>
              {!c.revokedAt && (
                <Button size="sm" variant="danger" className="mt-2" onClick={() => { update((d) => { const x = d.consults.find((y) => y.id === c.id)!; x.revokedAt = nowIso(); x.status = 'revoked'; x.snapshot = null; x.memo = ''; }); toast('공유를 철회했어요. 노무법인 화면에서 첨부가 사라져요.'); }}>
                  공유 철회
                </Button>
              )}
            </Card>
          ))}
          <p className="text-xs text-muted">동의 시각: 각 요청에 저장돼요. 실제 운영에서는 철회 시 노무법인 서버의 사본 삭제까지 처리해야 해요 (미구현).</p>
          <p className="text-xs text-muted">기준일 {fmtDate(base)}</p>
        </div>
      )}
    </div>
  );
}

function FaqAnswer({ faq, base, onExpert }: { faq: Faq; base: string; onExpert: () => void }) {
  return (
    <div className="text-sm">
      <p>
        <b>한 줄 답</b> {faq.oneLine}
      </p>
      <p className="mt-1 font-semibold">할 일</p>
      <ol className="list-decimal pl-5">
        {faq.todo.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ol>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge tone="muted">참고용</Badge>
        <Basis ids={faq.ruleIds} date={base} text={faq.basis} />
        <Button size="sm" variant={faq.expert ? 'primary' : 'secondary'} onClick={onExpert}>
          노무 전문가와 확인하기
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted">참고용 안내예요. 개별 사건의 법률 판단을 대신하지 않아요.</p>
    </div>
  );
}
