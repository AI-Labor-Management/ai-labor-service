import { useEffect, useRef, useState } from 'react';
import { aiEnabled, askAi, ServiceError, type AiAnswer } from '../adapters/api';
import { Button, Notice } from './kit';

/** In-memory only. Cancels on unmount/question change and ignores stale provider replies. */
export function AiQuestion({ question, onExpert }: { question: string; onExpert: () => void }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'done' | 'cancelled'>('idle');
  const [answer, setAnswer] = useState<AiAnswer | null>(null);
  const [error, setError] = useState<ServiceError | null>(null);
  const active = useRef<AbortController | null>(null);
  useEffect(() => {
    active.current?.abort();
    setStatus('idle');
    setAnswer(null);
    setError(null);
    return () => active.current?.abort();
  }, [question]);
  const ask = async () => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setStatus('loading');
    setError(null);
    setAnswer(null);
    try {
      const result = await askAi(question, controller.signal);
      if (active.current === controller && !controller.signal.aborted) {
        setAnswer(result);
        setStatus('done');
      }
    } catch (e) {
      if (active.current !== controller) return;
      const failure =
        e instanceof ServiceError ? e : new ServiceError('UNKNOWN', '답변을 불러오지 못했어요.');
      if (controller.signal.aborted || failure.code === 'CANCELLED') setStatus('cancelled');
      else {
        setError(failure);
        setStatus('error');
      }
    }
  };
  return (
    <section className="ai-answer-panel" aria-label="AI 상담">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold">질문의 맥락을 더 확인해 볼까요?</h3>
          <p className="mt-1 text-sm text-muted">
            개인정보 없이 질문과 업종·규모만 사용해요. 대화는 저장하지 않아요.
          </p>
        </div>
        {status !== 'loading' && (
          <Button onClick={() => void ask()} reason={!aiEnabled ? 'AI 제공사 연결 대기' : undefined}>
            {status === 'error' || status === 'cancelled' ? '다시 시도' : 'AI로 확인하기'}
          </Button>
        )}
      </div>
      {status === 'loading' && (
        <div className="ai-loading" role="status">
          <span className="thinking-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <p>확인 가능한 근거를 찾고 있어요</p>
          <Button size="sm" onClick={() => active.current?.abort()}>
            취소
          </Button>
        </div>
      )}
      {status === 'cancelled' && (
        <p role="status" className="mt-4 text-sm text-muted">
          요청을 취소했어요. 질문은 저장되지 않았어요.
        </p>
      )}
      {error && (
        <Notice className="mt-4" tone="warn">
          <p role="alert">{error.message}</p>
          {error.status === 429 && (
            <p className="mt-1 text-xs">이용 한도가 다시 열릴 때까지 전문가 상담을 이용할 수 있어요.</p>
          )}
          {error.requestId && <p className="mt-2 text-xs text-muted">문의 코드 {error.requestId}</p>}
        </Notice>
      )}
      {answer && (
        <div className="mt-4" aria-live="polite">
          <p className="whitespace-pre-wrap text-sm">{answer.text}</p>
          {answer.citations.length > 0 && (
            <ul className="mt-3 grid gap-2 text-xs">
              {answer.citations.map((c, i) => (
                <li key={i}>
                  <a className="text-brand underline" href={c.url} target="_blank" rel="noreferrer">
                    {c.title}
                  </a>
                  <span className="ml-2 text-muted">확인일 {c.checkedAt}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted">
            AI 안내는 참고용이에요. 개별 사안의 판단은 노무 전문가와 확인해 주세요.
          </p>
        </div>
      )}
      <div className="mt-4">
        <Button size="sm" variant="ghost" onClick={onExpert}>
          노무 전문가와 확인하기 →
        </Button>
      </div>
    </section>
  );
}
