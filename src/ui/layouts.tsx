import { useEffect, type ReactNode } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router';
import { useStore } from '../state/store';
import { fmtDate } from '../domain/dates';
import { computeTodos } from '../domain/todos';
import { Button, cx, Notice } from './kit';
import type { DemoSession } from '../domain/types';

export const SERVICE_NAME = 'AI 인사노무 관리';

const SCALE_LABEL = { '1-4': '1~4명', '5-9': '5~9명', '10+': '10명 이상' } as const;

const ROLE_PATH = { owner: '/owner', employee: '/employee', firm: '/firm', admin: '/admin' } as const;

/** 서버 모드 띠: 로그인 계정, 계정이 가진 역할 전환, 저장 상태, 로그아웃 */
function ServerBar() {
  const { auth, session, setSession, base, state, saveError, retrySave, syncing, logout } = useStore();
  const nav = useNavigate();
  const me = auth.me;
  const value = session ? (session.role === 'employee' ? `employee:${session.employeeId}` : session.role) : '';
  const change = (v: string) => {
    const s: DemoSession = v.startsWith('employee:') ? { role: 'employee', employeeId: v.slice(9) } : { role: v as DemoSession['role'], employeeId: null };
    setSession(s);
    nav(ROLE_PATH[s.role]);
  };
  return (
    <div className="no-print">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-ink px-4 py-1.5 text-xs text-white/90">
        <span className="font-bold text-kakao">서버 저장</span>
        <span className="max-w-[16rem] truncate">{auth.email}</span>
        <span aria-live="polite">{syncing ? '저장 중…' : '저장됨'}</span>
        {session?.role === 'owner' && (
          <Link to="/owner/settings" className="underline decoration-white/40 underline-offset-2">
            기준일 {fmtDate(base)}
            {state.settings.baseDateOverride ? ' (고정)' : ''}
          </Link>
        )}
        <span className="ml-auto flex items-center gap-2">
          {me && (
            <select value={value} onChange={(e) => change(e.target.value)} className="rounded bg-white/10 px-1.5 py-0.5 text-white outline-none [&>option]:text-ink" aria-label="내 역할 전환">
              <option value="owner">사장님{me.roles.owner ? ` · ${me.roles.owner.name || '내 사업장'}` : ' (사업장 만들기)'}</option>
              {me.roles.employee.map((e) => (
                <option key={e.employeeId} value={`employee:${e.employeeId}`}>
                  직원 · {e.alias}
                </option>
              ))}
              {me.roles.firm.length > 0 && <option value="firm">노무법인</option>}
              {me.roles.admin && <option value="admin">관리자</option>}
            </select>
          )}
          <button type="button" className="underline decoration-white/40 underline-offset-2" onClick={() => void logout().then(() => nav('/start'))}>
            로그아웃
          </button>
        </span>
      </div>
      {saveError && (
        <div role="alert" className="flex items-center gap-3 bg-risk-soft px-4 py-2 text-sm text-risk">
          <span>{saveError}</span>
          <Button size="sm" variant="danger" onClick={retrySave}>
            서버 내용 다시 불러오기
          </Button>
        </div>
      )}
    </div>
  );
}

/** 데모 띠: 실제 인증이 아님을 모든 화면에 표시하고, 역할을 바꿀 수 있게 한다 */
export function DemoBar() {
  const { mode } = useStore();
  return mode === 'server' ? <ServerBar /> : <LocalBar />;
}

function LocalBar() {
  const { state, session, setSession, base, saveError, retrySave, storageWarning } = useStore();
  const nav = useNavigate();
  const value = session ? (session.role === 'employee' ? `employee:${session.employeeId}` : session.role) : '';
  const change = (v: string) => {
    let s: DemoSession | null = null;
    if (v === 'owner') s = { role: 'owner', employeeId: null };
    else if (v === 'firm') s = { role: 'firm', employeeId: null };
    else if (v === 'admin') s = { role: 'admin', employeeId: null };
    else if (v.startsWith('employee:')) s = { role: 'employee', employeeId: v.slice(9) };
    setSession(s);
    nav(s ? { owner: '/owner', employee: '/employee', firm: '/firm', admin: '/admin' }[s.role] : '/start');
  };
  return (
    <div className="no-print">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-ink px-4 py-1.5 text-xs text-white/90">
        <span className="font-bold text-kakao">로컬 데모</span>
        <span>실제 인증·사용자별 격리 없음 · 데이터는 이 브라우저에만 저장</span>
        <Link to="/owner/settings" className="underline decoration-white/40 underline-offset-2">
          기준일 {fmtDate(base)}
          {state.settings.baseDateOverride ? ' (고정)' : ''}
        </Link>
        <label className="ml-auto flex items-center gap-1.5">
          <span className="sr-only sm:not-sr-only">데모 역할</span>
          <select value={value} onChange={(e) => change(e.target.value)} className="rounded bg-white/10 px-1.5 py-0.5 text-white outline-none [&>option]:text-ink" aria-label="데모 역할 전환 (실제 인증 아님)">
            <option value="" disabled>
              역할 선택
            </option>
            <option value="owner">사장님</option>
            {state.employees
              .filter((e) => !e.resignDate || e.resignDate >= base)
              .map((e) => (
                <option key={e.id} value={`employee:${e.id}`}>
                  직원 화면 · {e.alias}
                  {e.account === 'joined' ? '' : ' (미가입)'}
                </option>
              ))}
            <option value="firm">노무법인</option>
            <option value="admin">관리자</option>
          </select>
        </label>
      </div>
      {storageWarning && <div className="bg-warn-soft px-4 py-1.5 text-xs text-warn">{storageWarning}</div>}
      {saveError && (
        <div role="alert" className="flex items-center gap-3 bg-risk-soft px-4 py-2 text-sm text-risk">
          <span>저장 실패: {saveError} — 새로고침하면 마지막 변경이 사라질 수 있어요.</span>
          <Button size="sm" variant="danger" onClick={retrySave}>
            다시 저장
          </Button>
        </div>
      )}
    </div>
  );
}

export function LoadGate({ children }: { children: ReactNode }) {
  const { status, loadError, retryLoad, resetEmpty, mode, switchMode } = useStore();
  if (status === 'loading')
    return (
      <div className="flex min-h-screen items-center justify-center text-muted" aria-busy="true">
        {mode === 'server' ? '서버에서 불러오는 중…' : '저장된 데이터를 불러오는 중…'}
      </div>
    );
  if (status === 'error')
    return (
      <div className="mx-auto max-w-md p-6">
        <Notice tone="risk" title="데이터를 불러오지 못했어요">
          <p>{loadError}</p>
          <div className="mt-3 flex gap-2">
            <Button variant="primary" onClick={retryLoad}>
              다시 시도
            </Button>
            {mode === 'server' ? (
              <Button onClick={() => switchMode('local')}>로그인 없이 둘러보기로 바꾸기</Button>
            ) : (
              <Button variant="danger" onClick={() => void resetEmpty()}>
                저장 데이터 초기화
              </Button>
            )}
          </div>
        </Notice>
      </div>
    );
  return <>{children}</>;
}

const OWNER_MENU = [
  { to: '/owner', label: '홈', end: true },
  { to: '/owner/employees', label: '직원' },
  { to: '/owner/work', label: '근무' },
  { to: '/owner/payroll', label: '급여·보험', also: ['/owner/insurance'] },
  { to: '/owner/documents', label: '서류' },
  { to: '/owner/deadlines', label: '일정·기한' },
  { to: '/owner/risk', label: '노무 위험 점검' },
  { to: '/owner/consult', label: '상담' },
  { to: '/owner/settings', label: '설정', also: ['/owner/rules', '/owner/setup'] },
];

const OWNER_TABS = [
  { to: '/owner', label: '홈', end: true },
  { to: '/owner/employees', label: '직원' },
  { to: '/owner/work', label: '근무' },
  { to: '/owner/payroll', label: '급여·보험', also: ['/owner/insurance'] },
  { to: '/owner/more', label: '더보기', also: ['/owner/documents', '/owner/deadlines', '/owner/risk', '/owner/consult', '/owner/settings', '/owner/rules'] },
];

function useActive() {
  const loc = useLocation();
  return (m: { to: string; end?: boolean; also?: string[] }) => (m.end ? loc.pathname === m.to : loc.pathname.startsWith(m.to) || (m.also ?? []).some((a) => loc.pathname.startsWith(a)));
}

export function OwnerLayout() {
  const { state, session, base } = useStore();
  const active = useActive();
  const loc = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [loc.pathname]);
  if (!session) return <Navigate to="/start" replace />;
  if (session.role !== 'owner') return <Navigate to={{ employee: '/employee', firm: '/firm', admin: '/admin', owner: '/owner' }[session.role]} replace />;
  if (!state.workplace && loc.pathname !== '/owner/setup') return <Navigate to="/owner/setup" replace />;
  const wp = state.workplace;
  const active_ = state.employees.filter((e) => !e.resignDate || e.resignDate >= base);
  const todos = wp ? computeTodos(state, base) : [];
  const counts: Record<string, number> = {
    '/owner/work': todos.filter((t) => t.area === '근무').length,
    '/owner/documents': todos.filter((t) => t.area === '서류' && t.level !== 'check').length,
  };
  return (
    <div className="min-h-screen">
      <DemoBar />
      <div className="mx-auto flex max-w-7xl">
        <aside className="no-print sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-white px-3 py-5 md:flex">
          <Link to="/owner" className="px-3">
            <p className="text-lg font-bold">{wp?.name || '내 사업장'}</p>
            <p className="text-xs text-muted">
              사장님 · {wp ? SCALE_LABEL[wp.scale] : '-'} · 직원 {active_.length}명
            </p>
          </Link>
          <nav className="mt-5 flex flex-col gap-0.5" aria-label="사장님 메뉴">
            {OWNER_MENU.map((m) => (
              <NavLink key={m.to} to={m.to} end={m.end} className={cx('flex items-center justify-between rounded-lg px-3 py-2.5 text-[15px]', active(m) ? 'bg-brand-soft font-bold text-brand' : 'text-ink hover:bg-canvas')}>
                {m.label}
                {!!counts[m.to] && <span className="text-xs font-bold text-risk">{counts[m.to]}</span>}
              </NavLink>
            ))}
          </nav>
          <p className="mt-auto px-3 text-xs text-muted">
            기준일 {fmtDate(base)} · 참고용
            <br />
            {SERVICE_NAME} (가칭) · 초안
          </p>
        </aside>
        <main className="min-w-0 flex-1 px-4 pb-28 pt-5 sm:px-6 md:pb-10 lg:px-8">
          <Outlet />
        </main>
      </div>
      <nav className="no-print fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-white/95 backdrop-blur md:hidden" aria-label="하단 메뉴">
        {OWNER_TABS.map((m) => (
          <NavLink key={m.to} to={m.to} end={m.end} className={cx('py-3 text-center text-[13px]', active(m) ? 'font-bold text-brand' : 'text-muted')}>
            {m.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function RoleLayout({ role, title, tabs }: { role: 'employee' | 'firm' | 'admin'; title: ReactNode; tabs?: { to: string; label: string; end?: boolean }[] }) {
  const { session } = useStore();
  const active = useActive();
  if (!session) return <Navigate to="/start" replace />;
  if (session.role !== role) return <Navigate to={{ employee: '/employee', firm: '/firm', admin: '/admin', owner: '/owner' }[session.role]} replace />;
  return (
    <div className="min-h-screen">
      <DemoBar />
      <header className="no-print border-b border-line bg-white">
        <div className={cx('mx-auto flex items-center justify-between px-4 py-3', role === 'employee' ? 'max-w-xl' : 'max-w-6xl')}>{title}</div>
      </header>
      <main className={cx('mx-auto px-4 pb-28 pt-5', role === 'employee' ? 'max-w-xl' : 'max-w-6xl')}>
        <Outlet />
      </main>
      {tabs && (
        <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur" aria-label="직원 메뉴">
          <div className="mx-auto grid max-w-xl" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
            {tabs.map((m) => (
              <NavLink key={m.to} to={m.to} end={m.end} className={cx('py-3 text-center text-[13px]', active(m) ? 'font-bold text-brand' : 'text-muted')}>
                {m.label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
