// S20 로그인·역할 선택 — 실제 인증은 연결 대기. 로컬 데모 시작과 역할 전환만 동작한다.
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useStore } from '../../state/store';
import { Badge, Button, Card, Notice } from '../../ui/kit';
import { SERVICE_NAME } from '../../ui/layouts';

export default function Start() {
  const { state, setSession, resetSeed, resetEmpty, base } = useStore();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const fromDiag = params.get('from') === 'diagnosis';
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const hasData = !!state.workplace;

  const startEmpty = async () => {
    if (hasData && !confirmEmpty) {
      setConfirmEmpty(true);
      return;
    }
    await resetEmpty();
    setSession({ role: 'owner', employeeId: null });
    nav('/owner/setup');
  };
  const continueExisting = () => {
    setSession({ role: 'owner', employeeId: null });
    nav('/owner');
  };
  const startSeed = async () => {
    await resetSeed();
    setSession({ role: 'owner', employeeId: null });
    nav('/owner');
  };
  const joined = state.employees.filter((e) => e.account === 'joined' && (!e.resignDate || e.resignDate >= base));
  const invited = state.employees.filter((e) => e.account === 'invited');

  return (
    <div className="min-h-screen bg-canvas px-4 py-10">
      <div className="mx-auto max-w-lg">
        <Link to="/" className="text-sm text-muted">
          ← {SERVICE_NAME} 홍보 페이지
        </Link>
        <h1 className="mt-3 text-2xl font-bold">시작하기</h1>
        {fromDiag && <Notice className="mt-3" tone="brand" title="자가진단 답을 이어받아요">업종·직원 수·외국인 여부를 사업장 설정에 미리 채워요. 답 자체는 저장하지 않아요.</Notice>}

        <Card className="mt-4" title="사장님 가입·로그인">
          <div className="flex flex-col gap-2">
            <Button variant="kakao" size="lg" reason="연결 대기 — 카카오 로그인 앱 키와 Supabase Auth가 필요해요">
              카카오로 시작하기
            </Button>
            <Button size="lg" reason="연결 대기 — 이메일 가입은 Supabase Auth 연결 후 동작해요">
              이메일로 가입
            </Button>
          </div>
          <div className="mt-4 border-t border-line pt-4">
            <p className="text-sm font-semibold">
              로컬 데모로 시작 <Badge tone="brand">이 브라우저에만 저장</Badge>
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {hasData && (
                <Button variant="primary" onClick={continueExisting}>
                  이 브라우저의 데이터로 이어서 하기 ({state.workplace?.name || '내 사업장'})
                </Button>
              )}
              <Button variant={hasData ? 'secondary' : 'primary'} onClick={() => void startEmpty()}>
                {confirmEmpty ? '정말 비우고 새로 시작할까요? (한 번 더 누르면 초기화)' : '빈 사업장으로 시작 (직접 입력)'}
              </Button>
              <Button onClick={() => void startSeed()}>가상 시드로 둘러보기 (카페 샘터 · 직원 A·B·C)</Button>
            </div>
            <p className="mt-2 text-xs text-muted">데모 역할 전환은 실제 인증이 아니에요. 같은 브라우저를 쓰는 사람은 모든 데이터를 볼 수 있어요.</p>
          </div>
        </Card>

        <Card className="mt-4" title="직원">
          <p className="text-sm text-muted">직원은 사장님이 보낸 초대 링크로 가입해요. 데모에서는 아래에서 직원 화면으로 들어가요.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {joined.map((e) => (
              <Button key={e.id} onClick={() => { setSession({ role: 'employee', employeeId: e.id }); nav('/employee'); }}>
                {e.alias} (가입함)
              </Button>
            ))}
            {invited.map((e) => (
              <Button key={e.id} onClick={() => { setSession({ role: 'employee', employeeId: e.id }); nav('/employee/join'); }}>
                {e.alias} 초대 링크 열기
              </Button>
            ))}
            {!joined.length && !invited.length && <p className="text-sm text-muted">가입하거나 초대된 직원이 없어요. 사장님 화면의 직원 상세에서 초대 링크를 만들 수 있어요.</p>}
          </div>
        </Card>

        <Card className="mt-4" title="노무법인 · 관리자 (별도 입구)">
          <p className="text-sm text-muted">실제 운영에서는 별도 입구와 2단계 인증을 써요 (연결 대기). 데모에서는 바로 들어가요.</p>
          <div className="mt-3 flex gap-2">
            <Button onClick={() => { setSession({ role: 'firm', employeeId: null }); nav('/firm'); }}>노무법인 화면</Button>
            <Button onClick={() => { setSession({ role: 'admin', employeeId: null }); nav('/admin'); }}>관리자 화면</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
