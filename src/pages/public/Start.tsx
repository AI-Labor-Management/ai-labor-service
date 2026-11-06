// S20 로그인·역할 선택 — 두 가지 방식
//  · 로그인 없이 둘러보기: 이 브라우저에만 저장(로컬 데모), 데모 역할 전환
//  · 로그인해서 서버에 저장: Supabase 이메일 로그인, 계정이 가진 역할(사장님·직원·노무법인·관리자)만
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useStore } from '../../state/store';
import { serverConfigured } from '../../adapters/server';
import { AuthForm } from '../../ui/AuthForm';
import { Badge, Button, Card, cx, Notice } from '../../ui/kit';
import { SERVICE_NAME } from '../../ui/layouts';
import type { DemoSession } from '../../domain/types';

function ModeChooser() {
  const { mode, switchMode } = useStore();
  if (!serverConfigured) return null;
  const opt = (m: 'local' | 'server', title: string, sub: string) => (
    <button
      type="button"
      aria-pressed={mode === m}
      onClick={() => mode !== m && switchMode(m)}
      className={cx('flex-1 rounded-xl border p-3 text-left', mode === m ? 'border-brand bg-brand-soft' : 'border-line bg-white hover:bg-canvas')}
    >
      <p className="font-semibold">{title}</p>
      <p className="text-xs text-muted">{sub}</p>
    </button>
  );
  return (
    <div className="mt-4 flex flex-col gap-2 sm:flex-row" role="group" aria-label="시작 방식">
      {opt('local', '로그인 없이 둘러보기', '이 브라우저에만 저장 · 데모 역할 전환')}
      {opt('server', '로그인해서 서버에 저장', '계정별 격리 · 시험 운영 (가상 데이터만)')}
    </div>
  );
}

function ServerStart() {
  const { auth, refresh, resetSeed, logout, state, session } = useStore();
  const nav = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmSeed, setConfirmSeed] = useState(false);
  const me = auth.me;
  if (!auth.ready) return <p className="mt-4 text-sm text-muted">로그인 확인 중…</p>;
  if (!me)
    return (
      <Card className="mt-4" title="로그인">
        <AuthForm />
        <p className="mt-3 text-xs text-muted">카카오 로그인은 앱 키를 받은 뒤 연결해요. 직원은 사장님이 보낸 초대 링크를 열면 가입·연결돼요.</p>
      </Card>
    );
  const go = async (s: DemoSession, path: string, label: string) => {
    setBusy(label);
    await refresh(s);
    setBusy(null);
    nav(path);
  };
  const owner = me.roles.owner;
  const seed = async () => {
    if (owner && !confirmSeed) return setConfirmSeed(true);
    setBusy('seed');
    if (session?.role !== 'owner') await refresh({ role: 'owner', employeeId: null });
    await resetSeed();
    setBusy(null);
    nav('/owner');
  };
  return (
    <>
      <Card className="mt-4" title="사장님" right={<span className="text-xs text-muted">{auth.email}</span>}>
        <div className="flex flex-col gap-2">
          {owner ? (
            <Button variant="primary" disabled={!!busy} onClick={() => void go({ role: 'owner', employeeId: null }, '/owner', 'owner')}>
              {busy === 'owner' ? '불러오는 중…' : `내 사업장으로 (${owner.name || state.workplace?.name || '내 사업장'})`}
            </Button>
          ) : (
            <Button variant="primary" disabled={!!busy} onClick={() => void go({ role: 'owner', employeeId: null }, '/owner/setup', 'setup')}>
              빈 사업장으로 시작 (직접 입력)
            </Button>
          )}
          <Button disabled={busy === 'seed'} onClick={() => void seed()}>
            {busy === 'seed'
              ? '가상 시드를 넣는 중…'
              : confirmSeed
                ? '정말 지우고 가상 시드로 바꿀까요? (한 번 더 누르면 서버 데이터가 바뀌어요)'
                : owner
                  ? '가상 시드로 바꾸기 (카페 샘터 · 직원 A·B·C)'
                  : '가상 시드로 둘러보기 (카페 샘터 · 직원 A·B·C)'}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted">가상 시드의 직원 A·B·C는 계정이 없어요. 직원 화면은 직원 상세 → 초대 링크를 다른 계정으로 열어 연결해요.</p>
      </Card>
      {(me.roles.employee.length > 0 || me.roles.firm.length > 0 || me.roles.admin) && (
        <Card className="mt-4" title="다른 역할">
          <div className="flex flex-wrap gap-2">
            {me.roles.employee.map((e) => (
              <Button key={e.employeeId} disabled={!!busy} onClick={() => void go({ role: 'employee', employeeId: e.employeeId }, '/employee', e.employeeId)}>
                직원 · {e.alias}
              </Button>
            ))}
            {me.roles.firm.length > 0 && (
              <Button disabled={!!busy} onClick={() => void go({ role: 'firm', employeeId: null }, '/firm', 'firm')}>
                노무법인 화면
              </Button>
            )}
            {me.roles.admin && (
              <Button disabled={!!busy} onClick={() => void go({ role: 'admin', employeeId: null }, '/admin', 'admin')}>
                관리자 화면
              </Button>
            )}
          </div>
        </Card>
      )}
      <div className="mt-4 flex items-center justify-between gap-3 text-sm">
        <span className="text-muted">직원 초대 링크를 받았다면 그 링크를 그대로 여세요.</span>
        <button type="button" className="shrink-0 text-muted underline" onClick={() => void logout()}>
          로그아웃
        </button>
      </div>
    </>
  );
}

export default function Start() {
  const { mode } = useStore();
  return (
    <div className="min-h-screen bg-canvas px-4 py-10">
      <div className="mx-auto max-w-lg">
        <Link to="/" className="text-sm text-muted">
          ← {SERVICE_NAME} 홍보 페이지
        </Link>
        <h1 className="mt-3 text-2xl font-bold">시작하기</h1>
        <ModeChooser />
        {mode === 'server' ? <ServerStart /> : <LocalStart />}
      </div>
    </div>
  );
}

function LocalStart() {
  const { state, setSession, resetSeed, resetEmpty, base, switchMode } = useStore();
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
    <>
        {fromDiag && <Notice className="mt-3" tone="brand" title="자가진단 답을 이어받아요">업종·직원 수·외국인 여부를 사업장 설정에 미리 채워요. 답 자체는 저장하지 않아요.</Notice>}

        <Card className="mt-4" title="사장님 가입·로그인">
          <div className="flex flex-col gap-2">
            <Button variant="kakao" size="lg" reason="연결 대기 — 카카오 로그인 앱 키와 Supabase Auth가 필요해요">
              카카오로 시작하기
            </Button>
            {serverConfigured ? (
              <Button size="lg" onClick={() => switchMode('server')}>
                이메일로 가입·로그인 (서버에 저장)
              </Button>
            ) : (
              <Button size="lg" reason="연결 대기 — 이 빌드에는 서버 주소(VITE_SUPABASE_URL)가 없어요">
                이메일로 가입
              </Button>
            )}
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
    </>
  );
}
