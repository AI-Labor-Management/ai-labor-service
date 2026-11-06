// W03 노무법인 — 사장님이 고른 항목만(firmScope). 상담 요청함(회원/비회원 구분), 맡김 4대보험 처리, 규칙·FAQ 검수 의견(값 변경 불가).
import { useState } from 'react';
import { useStore, uid, nowIso, pushNotification } from '../../state/store';
import { firmScope } from '../../domain/scopes';
import { allRules } from '../../domain/rules';
import { FAQS } from '../../data/faq';
import { RISK_QUESTIONS } from '../../domain/risk';
import { fmtDate, fmtDateTime, localDate } from '../../domain/dates';
import { Badge, Button, Card, Empty, Field, inputCls, Notice, Tabs, useToast } from '../../ui/kit';
import { INDUSTRY_LABEL, SCALE_LABEL } from '../../ui/labels';

type Tab = 'inbox' | 'insurance' | 'review';

export default function Firm() {
  const { state, update, base, mode } = useStore();
  const toast = useToast();
  const v = firmScope(state);
  const [tab, setTab] = useState<Tab>('inbox');
  const [target, setTarget] = useState(allRules()[0].id);
  const [comment, setComment] = useState('');
  return (
    <div>
      {mode === 'server' ? (
        <Notice tone="info" className="mb-4" title="서버 · 2단계 인증 연결 대기">
          협력 사업장의 사장님이 보낸 요청 중 고른 항목만, 맡김·공유 동의한 4대보험 건만 보여요. 철회된 요청은 내용이 가려져요. 급여·서류 상태는 볼 수 없어요.
        </Notice>
      ) : (
        <Notice tone="warn" className="mb-4" title="로컬 데모 · 2단계 인증 연결 대기">
          실제 운영에서는 별도 입구와 2단계 인증을 써요. 이 화면은 이 브라우저의 사장님 데이터 중 사장님이 고른 항목만 보여줘요 — 급여·서류 상태는 볼 수 없어요.
        </Notice>
      )}
      <Tabs<Tab>
        tabs={[
          { value: 'inbox', label: `상담 요청함 (${v.consults.length + v.guests.length})` },
          { value: 'insurance', label: `4대보험 위임 (${v.delegated.length})` },
          { value: 'review', label: '규칙·FAQ 검수 의견' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'inbox' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="grid content-start gap-3">
            <h2 className="font-bold">회원 요청</h2>
            {!v.consults.length && <Empty title="회원 요청이 없어요" />}
            {v.consults.map((c) => (
              <Card key={c.id} title={c.topic} right={fmtDateTime(c.createdAt)}>
                {c.revokedAt ? (
                  <Badge tone="muted">사장님이 공유를 철회했어요 — 첨부가 사라졌어요</Badge>
                ) : (
                  <div className="grid gap-2 text-sm">
                    <p>{c.question}</p>
                    <p className="text-xs text-muted">동의 {fmtDateTime(c.consentAt)} · 공유 항목: {c.shareItems.join(', ')}</p>
                    {c.snapshot?.workplace && <p>사업장: {INDUSTRY_LABEL[c.snapshot.workplace.industry]} · {SCALE_LABEL[c.snapshot.workplace.scale]}</p>}
                    {c.snapshot?.conditions?.map((x) => (
                      <p key={x.alias} className="text-xs">
                        {x.alias}: {x.text}
                      </p>
                    ))}
                    {c.snapshot?.attendance?.map((x) => (
                      <details key={x.alias} className="text-xs">
                        <summary className="cursor-pointer">{x.alias} 출퇴근 {x.lines.length}건</summary>
                        <ul className="mt-1 font-mono">
                          {x.lines.map((l) => (
                            <li key={l}>{l}</li>
                          ))}
                        </ul>
                      </details>
                    ))}
                    {c.memo && <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-canvas p-2 text-xs">{c.memo}</pre>}
                    {c.status !== 'firm-read' && (
                      <Button size="sm" onClick={() => update((d) => { d.consults.find((x) => x.id === c.id)!.status = 'firm-read'; })}>
                        확인함 표시
                      </Button>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
          <div className="grid content-start gap-3">
            <h2 className="font-bold">비회원 신청 (시연 모드 · 실제 접수 아님)</h2>
            {!v.guests.length && <Empty title="비회원 신청이 없어요" />}
            {v.guests.map((g) => (
              <Card key={g.id} title={`${g.nickname} · ${g.topic}`} right={localDate(g.createdAt)}>
                <p className="text-sm">
                  {g.phoneMasked} · 연락 {g.contactTime}
                </p>
                {g.summary && <p className="text-xs text-muted">진단 요약: {g.summary}</p>}
                <p className="text-xs text-muted">동의 2종 {localDate(g.consents.collect)} · 보유 기간 후 파기 (기간 확정 전)</p>
              </Card>
            ))}
          </div>
        </div>
      )}
      {tab === 'insurance' && (
        <Card>
          {!v.insuranceShareConsent && <Notice tone="muted">사장님이 맡김 건 공유에 동의하지 않았어요.</Notice>}
          {v.insuranceShareConsent && !v.delegated.length && <Empty title="맡김 건이 없어요" />}
          <ul className="divide-y divide-line">
            {v.delegated.map((x) => (
              <li key={x.employeeId} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <b>{x.alias}</b> 입사 {fmtDate(x.hireDate)}
                {x.resignDate && ` · 퇴사 ${fmtDate(x.resignDate)}`}
                <Badge tone={x.acquisition === 'firmDone' || x.acquisition === 'confirmed' ? 'ok' : 'warn'}>취득 {{ none: '미전달', reported: '신고함', handedOver: '전달받음', firmDone: '처리 완료', confirmed: '처리 확인' }[x.acquisition]}</Badge>
                {(['acquisition', 'loss'] as const).map((phase) =>
                  (phase === 'loss' && !x.resignDate) || (phase === 'acquisition' ? x.acquisition : x.loss) === 'firmDone' || (phase === 'acquisition' ? x.acquisition : x.loss) === 'confirmed' ? null : (
                    <Button
                      key={phase}
                      size="sm"
                      onClick={() => {
                        update((d) => {
                          d.insuranceReports = d.insuranceReports.filter((r) => !(r.employeeId === x.employeeId && r.phase === phase));
                          d.insuranceReports.push({ employeeId: x.employeeId, phase, status: 'firmDone', date: base, by: 'firm' });
                          pushNotification(d, 'owner', 'firmDone', `노무법인이 ${x.alias} 4대보험 ${phase === 'acquisition' ? '취득' : '상실'} 신고를 처리 완료로 표시했어요`, `/owner/insurance?emp=${x.employeeId}`);
                        });
                        toast('처리 완료로 표시했어요 (사장님 화면에 "처리 확인"이 채워져요)');
                      }}
                    >
                      {phase === 'acquisition' ? '취득' : '상실'} 처리 완료 표시
                    </Button>
                  ),
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">주민등록번호 등 신고에 필요한 정보는 서비스 밖에서 직접 받아요.</p>
        </Card>
      )}
      {tab === 'review' && (
        <div className="grid gap-4">
          <Card title="검수 의견 남기기 (값은 바꿀 수 없어요)">
            <div className="grid gap-2">
              <Field label="대상" htmlFor="rv-t">
                <select id="rv-t" className={inputCls} value={target} onChange={(e) => setTarget(e.target.value)}>
                  <optgroup label="규칙">
                    {allRules().map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="FAQ">
                    {FAQS.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.q}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="위험 점검 문항">
                    {RISK_QUESTIONS.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.no}. {q.text}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </Field>
              <Field label="의견" htmlFor="rv-c">
                <textarea id="rv-c" rows={3} className={inputCls} value={comment} onChange={(e) => setComment(e.target.value)} />
              </Field>
              <Button variant="primary" reason={!comment.trim() ? '의견을 적어 주세요' : undefined} onClick={() => { update((d) => { d.reviewComments.unshift({ id: uid('rc'), target, comment: comment.trim(), at: nowIso() }); }); setComment(''); toast('의견을 남겼어요'); }}>
                남기기
              </Button>
            </div>
          </Card>
          <Card title="남긴 의견">
            {!state.reviewComments.length && <p className="text-sm text-muted">없어요</p>}
            <ul className="divide-y divide-line text-sm">
              {state.reviewComments.map((c) => (
                <li key={c.id} className="py-2">
                  <code className="text-xs text-muted">{c.target}</code> {c.comment} <span className="text-xs text-muted">{localDate(c.at)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}
