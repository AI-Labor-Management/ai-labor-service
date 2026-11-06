// 직원 초대 링크 (서버 모드): 로그인·가입 → 초대 수락(accept_invite) → 근로조건 확인(/employee/join)
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useStore } from '../../state/store';
import { friendly, rpc, serverConfigured } from '../../adapters/server';
import { AuthForm } from '../../ui/AuthForm';
import { Button, Card, Empty, Notice } from '../../ui/kit';
import { SERVICE_NAME } from '../../ui/layouts';

export default function Invite() {
  const { mode, auth, refresh, switchMode, logout } = useStore();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const accept = async () => {
    setBusy(true);
    setErr(null);
    try {
      const employeeId = await rpc<string>('accept_invite', { p_token: token });
      await refresh({ role: 'employee', employeeId });
      nav('/employee/join');
    } catch (e) {
      setErr(friendly(e));
    } finally {
      setBusy(false);
    }
  };

  let body;
  if (!token) body = <Empty title="초대 정보가 없어요">사장님이 보낸 링크를 그대로 열어 주세요.</Empty>;
  else if (mode !== 'server')
    body = serverConfigured ? (
      <Notice tone="brand" title="서버에 저장되는 초대 링크예요">
        <Button className="mt-2" variant="primary" onClick={() => switchMode('server', `invite?token=${encodeURIComponent(token)}`)}>
          로그인해서 초대 받기
        </Button>
      </Notice>
    ) : (
      <Notice tone="warn">이 빌드에는 서버 연결이 없어 초대를 받을 수 없어요.</Notice>
    );
  else if (!auth.ready) body = <p className="text-sm text-muted">로그인 확인 중…</p>;
  else if (!auth.me)
    body = (
      <Card title="근무지 초대를 받았어요">
        <p className="mb-3 text-sm text-muted">본인 계정으로 로그인하거나 가입하면 사장님 사업장의 직원으로 연결돼요. 연결 후에는 내 일정·출퇴근·임금명세서만 볼 수 있어요.</p>
        <AuthForm title="로그인 또는 가입" redirectPath={`invite?token=${encodeURIComponent(token)}`} />
      </Card>
    );
  else
    body = (
      <Card title="근무지 초대를 받았어요">
        <p className="text-sm">
          <b>{auth.email}</b> 계정을 이 사업장의 직원으로 연결할까요?
        </p>
        <p className="mt-1 text-xs text-muted">링크는 한 번만 쓸 수 있고 7일 뒤 만료돼요. 사장님 계정으로는 받을 수 없어요.</p>
        {err && (
          <p role="alert" className="mt-2 text-sm text-risk">
            {err}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="primary" disabled={busy} onClick={() => void accept()}>
            {busy ? '연결 중…' : '초대 받기'}
          </Button>
          <Button disabled={busy} onClick={() => void logout()}>
            다른 계정으로 로그인
          </Button>
        </div>
      </Card>
    );

  return (
    <div className="min-h-screen bg-canvas px-4 py-10">
      <div className="mx-auto max-w-lg">
        <Link to="/" className="text-sm text-muted">
          ← {SERVICE_NAME}
        </Link>
        <h1 className="mb-4 mt-3 text-2xl font-bold">직원 초대</h1>
        {body}
      </div>
    </div>
  );
}
