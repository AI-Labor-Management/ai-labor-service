// 서버 모드 이메일 로그인·가입 (Supabase Auth). 카카오 로그인은 앱 키를 받은 뒤 연결.
import { useState } from 'react';
import { signIn, signUp, friendly } from '../adapters/server';
import { useStore } from '../state/store';
import { Button, Field, inputCls, Notice } from './kit';

export function AuthForm({ onDone, title = '이메일로 로그인', redirectPath }: { onDone?: () => void; title?: string; redirectPath?: string }) {
  const { refresh } = useStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && password.length >= 6;
  const run = async (kind: 'in' | 'up') => {
    if (!valid) return setErr('이메일과 6자 이상 비밀번호를 입력하세요');
    setBusy(true);
    setErr(null);
    try {
      if (kind === 'in') await signIn(email.trim(), password);
      else {
        const r = await signUp(email.trim(), password, redirectPath);
        if (r.needsConfirm) {
          setSent(true);
          return;
        }
      }
      await refresh();
      onDone?.();
    } catch (e) {
      setErr(friendly(e));
    } finally {
      setBusy(false);
    }
  };

  if (sent)
    return (
      <Notice tone="brand" title="확인 메일을 보냈어요">
        {email} 받은편지함의 링크를 누르면 가입이 끝나요. 메일이 오지 않으면 운영자에게 알려 주세요 (서버 메일 발송 설정이 필요할 수 있어요).
      </Notice>
    );
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void run('in');
      }}
    >
      <p className="text-sm font-semibold">{title}</p>
      <Field label="이메일" htmlFor="auth-email">
        <input id="auth-email" type="email" autoComplete="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="비밀번호 (6자 이상)" htmlFor="auth-pw">
        <input id="auth-pw" type="password" autoComplete="current-password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      {err && (
        <p role="alert" className="text-sm text-risk">
          {err}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? '확인 중…' : '로그인'}
        </Button>
        <Button type="button" disabled={busy} onClick={() => void run('up')}>
          처음이에요 — 가입
        </Button>
      </div>
      <p className="text-xs text-muted">실제 개인정보(실명·주민번호 등)는 넣지 마세요. 시험 운영 중이라 가상 데이터만 써 주세요.</p>
    </form>
  );
}
