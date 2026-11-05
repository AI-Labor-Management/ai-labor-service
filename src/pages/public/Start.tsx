import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useStore } from '../../state/store';
import { Modal, Notice } from '../../ui/kit';
import { Icon } from '../../ui/Icon';
import { SiteHeader } from '../../ui/SiteHeader';
import { OWNER_MENU } from '../../ui/navigation';

export default function Start() {
  const { state, session, setSession, resetSeed, resetEmpty, base } = useStore();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const signup = params.get('mode') === 'signup';
  const nextParam = params.get('next') ?? '';
  const next = OWNER_MENU.some((m) => m.to === nextParam) ? nextParam : '/owner';
  const suffix = nextParam ? '&next=' + encodeURIComponent(nextParam) : '';
  const [confirm, setConfirm] = useState<'empty' | 'seed' | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const hasData = !!state.workplace;
  const start = async (kind: 'seed' | 'empty', confirmed = false) => {
    if (hasData && !confirmed) {
      setConfirm(kind);
      return;
    }
    if (kind === 'empty') await resetEmpty();
    else await resetSeed();
    setSession({ role: 'owner', employeeId: null });
    setConfirm(null);
    nav(kind === 'empty' ? '/owner/setup' : next);
  };
  const continueExisting = () => {
    setSession({ role: 'owner', employeeId: null });
    nav(next);
  };
  const previewAuth = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const err: Record<string, string> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(f.get('email'))))
      err.email = '이메일 형식을 확인해 주세요.';
    if (String(f.get('password')).length < 8)
      err.password = '8자 이상 입력해 주세요. 실제 비밀번호는 입력하지 마세요.';
    if (signup && f.get('password') !== f.get('confirmPassword'))
      err.confirmPassword = '비밀번호가 일치하지 않아요.';
    setErrors(err);
    if (Object.keys(err).length) return;
    e.currentTarget.reset();
    setNotice(
      signup
        ? '회원가입 화면 시연이 끝났어요. 계정은 생성되지 않았고 입력한 값도 저장하지 않았어요. 아래에서 데모를 시작해 보세요.'
        : '로그인 화면 시연이 끝났어요. 실제 계정 인증은 연결 전이에요. 아래의 체험하기로 서비스를 둘러보세요.',
    );
  };
  const joined = state.employees.filter(
    (e) => e.account === 'joined' && (!e.resignDate || e.resignDate >= base),
  );
  const invited = state.employees.filter((e) => e.account === 'invited');
  return (
    <div className="auth-page">
      <SiteHeader />
      <div className="auth-layout">
        <section className="auth-story reveal">
          <span className="eyebrow">
            <Icon name="spark" size={16} />
            계약부터 급여까지, 가게의 기록
          </span>
          <h1>
            우리 가게의 인사노무,
            <br />
            <span>한 권의 업무노트처럼.</span>
          </h1>
          <p>
            직원 등록부터 급여와 서류까지.
            <br />
            복잡한 인사노무를 쉬운 순서로 함께 챙겨요.
          </p>
          <div className="auth-art">
            <div className="auth-art-title">
              오늘도 차근차근, 한 번에<span>사용 흐름</span>
            </div>
            {[
              { icon: 'people', text: '직원 정보 한 번 등록하고' },
              { icon: 'clock', text: '일정과 출퇴근을 확인하면' },
              { icon: 'wallet', text: '급여와 서류까지 한곳에서' },
            ].map((s) => (
              <div className="auth-art-step" key={s.text}>
                <span>
                  <Icon name={s.icon as 'people' | 'clock' | 'wallet'} size={19} />
                </span>
                {s.text}
                <b>
                  <Icon name="check" size={12} />
                </b>
              </div>
            ))}
            <p className="auth-art-note">
              회원가입·로그인은 임시 디자인이에요.
              <br />
              실제 계정 연결 전까지 가상 데이터로 체험할 수 있어요.
            </p>
          </div>
        </section>
        <section className="auth-form-area reveal delay-1">
          <nav className="auth-tabs" aria-label="가입 및 로그인">
            <Link
              className={!signup ? 'active' : ''}
              to={'/start?mode=login' + suffix}
              aria-current={!signup ? 'page' : undefined}
              onClick={() => {
                setNotice('');
                setErrors({});
              }}
            >
              로그인
            </Link>
            <Link
              className={signup ? 'active' : ''}
              to={'/start?mode=signup' + suffix}
              aria-current={signup ? 'page' : undefined}
              onClick={() => {
                setNotice('');
                setErrors({});
              }}
            >
              회원가입
            </Link>
          </nav>
          <h2>{signup ? '반가워요, 사장님' : '다시 만나 반가워요'}</h2>
          <p className="auth-form-sub">
            {signup ? '우리 가게 관리를 시작할 준비를 해볼까요?' : '사장님의 가게, 오늘은 어떤 하루인가요?'}
            <br />
            <span className="text-brand">화면 시연용이에요. 실제 이메일·비밀번호는 넣지 마세요.</span>
          </p>
          {params.get('from') === 'diagnosis' && (
            <Notice className="mb-4" tone="brand" title="진단한 내용을 이어받아요">
              빈 사업장으로 시작하면 업종·직원 수를 미리 채워요.
            </Notice>
          )}
          <form key={signup ? 'signup' : 'login'} onSubmit={previewAuth} noValidate>
            <div className="auth-fields">
              <div className="auth-field">
                <label htmlFor="auth-email">이메일</label>
                <div className="auth-input">
                  <Icon name="mail" size={18} />
                  <input
                    id="auth-email"
                    name="email"
                    type="email"
                    autoComplete="off"
                    placeholder="example@company.com"
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? 'email-error' : undefined}
                  />
                </div>
                {errors.email && (
                  <p className="auth-error" role="alert" id="email-error">
                    {errors.email}
                  </p>
                )}
              </div>
              <div className="auth-field">
                <label htmlFor="auth-password">비밀번호</label>
                <div className="auth-input">
                  <Icon name="lock" size={18} />
                  <input
                    id="auth-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="off"
                    placeholder="시연용 비밀번호 8자 이상"
                    aria-invalid={!!errors.password}
                    aria-describedby={errors.password ? 'password-error' : undefined}
                  />
                  <button
                    className="icon-button"
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                  >
                    <Icon name={showPassword ? 'eyeOff' : 'eye'} size={18} />
                  </button>
                </div>
                {errors.password && (
                  <p className="auth-error" role="alert" id="password-error">
                    {errors.password}
                  </p>
                )}
              </div>
              {signup && (
                <div className="auth-field">
                  <label htmlFor="auth-confirm">비밀번호 확인</label>
                  <div className="auth-input">
                    <Icon name="lock" size={18} />
                    <input
                      id="auth-confirm"
                      name="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="off"
                      placeholder="시연용 비밀번호를 한 번 더 입력해 주세요"
                      aria-invalid={!!errors.confirmPassword}
                      aria-describedby={errors.confirmPassword ? 'confirm-error' : undefined}
                    />
                  </div>
                  {errors.confirmPassword && (
                    <p className="auth-error" role="alert" id="confirm-error">
                      {errors.confirmPassword}
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="auth-options">
              <span>
                <Icon name="lock" size={12} />
                입력 정보는 저장·전송하지 않아요
              </span>
              {!signup && (
                <button
                  type="button"
                  onClick={() => setNotice('비밀번호 재설정은 실제 계정 서비스 연결 후 사용할 수 있어요.')}
                >
                  비밀번호를 잊으셨나요?
                </button>
              )}
            </div>
            <button type="submit" className="ui-button primary auth-submit">
              {signup ? '회원가입 화면 체험하기' : '로그인 화면 체험하기'}
              <Icon name="arrow" size={17} />
            </button>
          </form>
          <div className="auth-divider">또는 간편하게</div>
          <button
            className="kakao-login"
            onClick={() =>
              setNotice(
                '카카오 로그인 화면은 준비 중이에요. 실제 인증은 연결되지 않았어요. 아래 데모로 먼저 둘러보세요.',
              )
            }
          >
            <Icon name="chat" size={19} />
            카카오로 {signup ? '시작하기' : '계속하기'}
            <span>연결 준비 중</span>
          </button>
          {notice && (
            <div className="auth-notice" role="status">
              {notice}
            </div>
          )}
          <div className="demo-entry">
            <div className="demo-entry-title">
              <Icon name="play" size={16} />
              가입 없이, 먼저 둘러보세요
            </div>
            <p>
              가상 카페와 직원 3명으로 실제 관리 흐름을 체험해요.
              <br />
              데이터는 이 브라우저에만 저장돼요.
            </p>
            {hasData && (
              <button className="ui-button primary" onClick={continueExisting}>
                이어서 관리하기
                <Icon name="arrow" size={16} />
              </button>
            )}
            <button
              className={'ui-button ' + (!hasData ? 'primary' : 'secondary')}
              onClick={() => void start('seed')}
            >
              가상 가게로 체험하기
              <Icon name="arrow" size={16} />
            </button>
            <button className="ui-button secondary" onClick={() => void start('empty')}>
              빈 사업장으로 시작하기
              <Icon name="plus" size={15} />
            </button>
          </div>
          <details className="auth-extra">
            <summary>직원·노무법인·관리자 체험</summary>
            <div className="auth-extra-content">
              {joined.map((e) => (
                <button
                  className="ui-button secondary"
                  key={e.id}
                  onClick={() => {
                    setSession({ role: 'employee', employeeId: e.id });
                    nav('/employee');
                  }}
                >
                  {e.alias} 직원 화면
                </button>
              ))}
              {invited.map((e) => (
                <button
                  className="ui-button secondary"
                  key={e.id}
                  onClick={() => {
                    setSession({ role: 'employee', employeeId: e.id });
                    nav('/employee/join');
                  }}
                >
                  {e.alias} 초대 열기
                </button>
              ))}
              <button
                className="ui-button secondary"
                onClick={() => {
                  setSession({ role: 'firm', employeeId: null });
                  nav('/firm');
                }}
              >
                노무법인
              </button>
              <button
                className="ui-button secondary"
                onClick={() => {
                  setSession({ role: 'admin', employeeId: null });
                  nav('/admin');
                }}
              >
                관리자
              </button>
            </div>
            <p className="text-muted">
              실제 인증이 없는 체험 공간이에요. 같은 브라우저의 모든 데이터에 접근할 수 있어요.
            </p>
          </details>
          {session && <p className="auth-privacy-note">현재 체험 데이터는 초기화 전까지 유지돼요.</p>}
        </section>
      </div>
      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title="현재 체험 데이터를 바꿀까요?"
        footer={
          <>
            <button className="ui-button secondary" onClick={() => setConfirm(null)}>
              돌아가기
            </button>
            <button className="ui-button primary" onClick={() => confirm && void start(confirm, true)}>
              새로 시작하기
            </button>
          </>
        }
      >
        <p className="text-sm leading-7 text-muted">
          {confirm === 'seed'
            ? '가상 카페와 직원 3명으로 현재 데이터를 교체해요.'
            : '현재 데이터를 비우고 새 사업장을 설정해요.'}{' '}
          필요한 기록은 설정에서 JSON으로 내보낸 후 진행해 주세요.
        </p>
      </Modal>
    </div>
  );
}
