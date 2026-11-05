// S08 노무 위험 점검 — 등록 데이터로 알 수 없는 실제 운영 습관만 묻는다. 답한 날짜를 남기고 6개월 뒤·규모 변경 시 다시 묻는다.
import { useStore } from '../../state/store';
import { evaluateRisk, type RiskResult } from '../../domain/risk';
import type { RiskAnswerValue } from '../../domain/types';
import { Badge, Card, Choice, LinkButton, Notice, PageHeader } from '../../ui/kit';
import { fmtDate } from '../../domain/dates';
import { SCALE_LABEL } from '../../ui/labels';

const RES: Record<RiskResult, { tone: 'risk' | 'info' | 'ok' | 'muted' | 'warn'; label: string }> = {
  risk: { tone: 'risk', label: '위험' },
  check: { tone: 'warn', label: '확인 필요' },
  ok: { tone: 'ok', label: '괜찮아요' },
  info: { tone: 'info', label: '법적 의무 아님·권장' },
  unanswered: { tone: 'muted', label: '답 전' },
  stale: { tone: 'warn', label: '다시 확인' },
};

export default function Risk() {
  const { state, update, base } = useStore();
  const r = evaluateRisk(state, base);
  const scale = state.workplace!.scale;
  const answer = (qid: string, v: RiskAnswerValue) =>
    update((d) => {
      d.riskAnswers = d.riskAnswers.filter((a) => a.questionId !== qid);
      d.riskAnswers.push({ questionId: qid, answer: v, answeredAt: base, scaleAtAnswer: scale });
    });
  return (
    <div className="max-w-3xl">
      <PageHeader title="노무 위험 점검" sub={`${r.answered}/${r.total} 완료 · ${SCALE_LABEL[scale]} 기준 · 사장님에게 생길 수 있는 위험(체불 청구, 분쟁)을 미리 찾아요`} />
      <Notice tone="muted" className="mb-4">
        서류 상태처럼 등록 데이터로 이미 점검하는 것은 묻지 않아요. 위법 여부를 판단하지 않으며, 복잡한 건은 노무 전문가 상담이 다음 행동이에요. 답은 이 브라우저에만 저장돼요.
      </Notice>
      <div className="grid gap-3">
        {r.rows.map((row) => (
          <Card key={row.q.id} id={row.q.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="font-semibold">
                {row.q.no}. {row.q.text}
              </p>
              <Badge tone={RES[row.result].tone}>{RES[row.result].label}</Badge>
            </div>
            <div className="mt-3">
              <Choice<RiskAnswerValue> name={row.q.text} options={[{ value: 'yes', label: '예' }, { value: 'no', label: '아니오' }, { value: 'unknown', label: '잘 모르겠어요' }]} value={row.answer?.answer ?? null} onChange={(v) => answer(row.q.id, v)} />
            </div>
            {row.answer && <p className="mt-2 text-xs text-muted">답한 날 {fmtDate(row.answer.answeredAt)}{row.result === 'stale' ? ` · ${row.text}` : ''}</p>}
            {(row.result === 'risk' || row.result === 'check' || row.result === 'info') && (
              <div className="mt-3 rounded-xl bg-canvas p-3 text-sm">
                <p>{row.text}</p>
                <p className="mt-1 text-muted">다음 행동: {row.q.action}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <LinkButton size="sm" variant={row.q.expert ? 'primary' : 'secondary'} to={row.q.actionLink}>
                    {row.q.expert ? '노무 전문가와 확인하기' : '고치러 가기'}
                  </LinkButton>
                </div>
              </div>
            )}
            <details className="mt-2 text-xs text-muted">
              <summary className="cursor-pointer">근거 ▾</summary>
              <p className="mt-1">{row.q.basis}</p>
              {row.q.under5Info && <p className="mt-1">1~4명: {row.q.under5Info}</p>}
            </details>
          </Card>
        ))}
      </div>
    </div>
  );
}
