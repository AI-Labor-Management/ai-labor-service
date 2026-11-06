import { useNavigate, useParams } from 'react-router';
import { useStore } from '../../state/store';
import { resolveInvite } from '../../domain/employees';
import { fmtDate } from '../../domain/dates';
import { Brand } from '../../ui/Icon';
import { Button, Card, LinkButton, Notice } from '../../ui/kit';

export default function Invite() {
  const { token = '' } = useParams();
  const { state, base, setSession } = useStore();
  const nav = useNavigate();
  const result = resolveInvite(state, token, base);
  const e = result.employee;
  const reason = {
    missing: '이 브라우저에서 초대 정보를 찾지 못했어요',
    used: '이미 사용한 초대 링크예요',
    expired: '초대 링크의 유효기간이 지났어요',
    blocked: '사용이 중지된 초대예요',
    valid: '',
  }[result.status];
  return (
    <main className="invite-page mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-5 py-12">
      <Brand />
      <Card>
        <p className="mb-2 text-sm font-semibold text-brand">직원 초대</p>
        <h1 className="text-2xl font-bold">{e ? `${e.alias}님, 반가워요` : reason}</h1>
        <p className="mt-3 text-sm text-muted">
          {e
            ? `${state.workplace?.name || '가게'}의 근무 관리에 초대받았어요. 근로조건을 확인한 뒤 시작해요.`
            : '사장님께 초대 링크 재발급을 요청해 주세요. 체험 링크는 초대를 만든 브라우저에서만 확인할 수 있어요.'}
        </p>
        <Notice tone="info" className="mt-4">
          현재는 가상 초대 체험이에요. 실제 계정 생성과 다른 기기 연결은 로그인·서버 연동 후 제공돼요.
        </Notice>
        {e && <p className="mt-3 text-xs text-muted">{fmtDate(e.invite!.expiresAt)}까지 · 한 번 사용 가능</p>}
        <div className="mt-5 flex flex-wrap gap-2">
          {e && (
            <Button
              variant="primary"
              onClick={() => {
                setSession({ role: 'employee', employeeId: e.id });
                nav('/employee/join');
              }}
            >
              근로조건 확인하기
            </Button>
          )}
          <LinkButton to="/start">시작 화면</LinkButton>
        </div>
      </Card>
    </main>
  );
}
