import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router';
import { useStore } from '../state/store';
import { fmtDate } from '../domain/dates';
import { computeTodos } from '../domain/todos';
import { Button, cx, Notice } from './kit';
import { Brand, Icon } from './Icon';
import { OWNER_MENU } from './navigation';
import { GlobalSearch } from './Search';
import { readPreference, savePreference, ThemeToggle, usePreferences } from './preferences';
import type { DemoSession } from '../domain/types';
import { useDialog } from './useDialog';
export { SERVICE_NAME } from './brand';

const SCALE_LABEL = { '1-4': '1~4명', '5-9': '5~9명', '10+': '10명 이상' } as const;

export function DemoBar() {
  const { state, session, setSession, base, saveError, retrySave, storageWarning } = useStore();
  const nav = useNavigate();
  const value = session
    ? session.role === 'employee'
      ? 'employee:' + session.employeeId
      : session.role
    : '';
  const change = (v: string) => {
    let s: DemoSession | null = null;
    if (v === 'owner' || v === 'firm' || v === 'admin') s = { role: v, employeeId: null };
    else if (v.startsWith('employee:')) s = { role: 'employee', employeeId: v.slice(9) };
    setSession(s);
    nav(s ? '/' + s.role : '/start');
  };
  return (
    <div className="demo-bar no-print">
      <div className="demo-bar-inner">
        <span className="demo-tag">체험 모드</span>
        <span className="demo-description">
          <span className="demo-description-long">
            브라우저에만 저장되는 체험 공간이에요. 실제 인증·외부 전송은 연결 전이에요.
          </span>
          <span className="demo-description-short">브라우저 저장 데모 (인증·전송 연결 전)</span>
        </span>
        <span className="demo-date">기준일 {fmtDate(base)}</span>
        <label>
          <span>화면 둘러보기</span>
          <select
            value={value}
            onChange={(e) => change(e.target.value)}
            aria-label="데모 역할 전환 (실제 인증 아님)"
          >
            <option value="" disabled>
              역할 선택
            </option>
            <option value="owner">사장님</option>
            {state.employees
              .filter((e) => !e.resignDate || e.resignDate >= base)
              .map((e) => (
                <option key={e.id} value={'employee:' + e.id}>
                  {e.alias}
                  {e.account === 'joined' ? '' : ' (미가입)'}
                </option>
              ))}
            <option value="firm">노무법인</option>
            <option value="admin">관리자</option>
          </select>
        </label>
      </div>
      {storageWarning && <p className="bg-warn-soft px-4 py-2 text-warn">{storageWarning}</p>}
      {saveError && (
        <div role="alert" className="flex items-center gap-3 bg-risk-soft px-4 py-2 text-sm text-risk">
          <span>저장 실패: {saveError}</span>
          <Button size="sm" variant="danger" onClick={retrySave}>
            다시 저장
          </Button>
        </div>
      )}
    </div>
  );
}

export function LoadGate({ children }: { children: ReactNode }) {
  const { status, loadError, retryLoad, resetEmpty } = useStore();
  if (status === 'loading')
    return (
      <div className="loading-screen" aria-busy="true">
        <span className="loading-mark">
          <Brand compact />
        </span>
        <p>가게의 하루를 준비하고 있어요</p>
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
            <Button variant="danger" onClick={() => void resetEmpty()}>
              저장 데이터 초기화
            </Button>
          </div>
        </Notice>
      </div>
    );
  return <>{children}</>;
}

export function OwnerLayout() {
  const { state, session, base } = useStore();
  const { openGuide } = usePreferences();
  const [collapsed, setCollapsed] = useState(() => readPreference('sidebar', 'expanded') === 'collapsed');
  const [side, setSide] = useState(() =>
    readPreference('sidebar-side', 'left') === 'right' ? 'right' : 'left',
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 1023px)').matches);
  const mobileDialog = useDialog(mobileOpen, () => setMobileOpen(false), '.mobile-sidebar-content');
  const location = useLocation();
  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)');
    const change = () => {
      setIsMobile(media.matches);
      if (!media.matches) setMobileOpen(false);
    };
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    const target = location.hash ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
    if (target) target.scrollIntoView({ block: 'start' });
    else window.scrollTo(0, 0);
    setMobileOpen(false);
  }, [location.pathname, location.hash]);
  useEffect(() => {
    savePreference('sidebar', collapsed ? 'collapsed' : 'expanded');
  }, [collapsed]);
  useEffect(() => {
    savePreference('sidebar-side', side);
  }, [side]);
  if (!session) return <Navigate to="/start" replace />;
  if (session.role !== 'owner') return <Navigate to={'/' + session.role} replace />;
  if (!state.workplace && location.pathname !== '/owner/setup') return <Navigate to="/owner/setup" replace />;
  const wp = state.workplace;
  const active = state.employees.filter((e) => !e.resignDate || e.resignDate >= base);
  const todos = wp ? computeTodos(state, base) : [];
  const activeMenu = OWNER_MENU.find((m) =>
    m.end
      ? location.pathname === m.to
      : location.pathname.startsWith(m.to) || m.also?.some((a) => location.pathname.startsWith(a)),
  );
  const toggle = () => {
    if (isMobile) setMobileOpen((s) => !s);
    else setCollapsed((s) => !s);
  };
  const menuContent = (mobile = false) => (
    <>
      <Link to="/owner/setup" className="workspace-switch" aria-label="사업장 설정">
        <span className="workspace-icon">
          <Icon name="building" size={22} />
        </span>
        <span className="sidebar-label">
          <strong>{wp?.name || '내 사업장'}</strong>
          <small>
            {wp ? SCALE_LABEL[wp.scale] : '설정 전'} · 직원 {active.length}명
          </small>
        </span>
        <Icon name="chevron" size={15} className="sidebar-label" />
      </Link>
      <p className="sidebar-section sidebar-label">우리 가게 관리</p>
      <nav className="sidebar-nav" aria-label={mobile ? '모바일 전체 메뉴' : '사장님 메뉴'}>
        {OWNER_MENU.map((m, i) => (
          <NavLink
            key={m.to}
            to={m.to}
            end={m.end}
            onClick={() => setMobileOpen(false)}
            title={collapsed && !mobile ? m.label : undefined}
            aria-label={m.label}
            className={cx('sidebar-link', activeMenu?.to === m.to && 'active', i === 9 && 'sidebar-settings')}
          >
            <Icon name={m.icon} size={21} />
            <span className="sidebar-label">{m.label}</span>
            {m.to === '/owner/deadlines' && todos.filter((t) => t.level === 'soon').length > 0 && (
              <b className="sidebar-count sidebar-label">{todos.filter((t) => t.level === 'soon').length}</b>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <button
          className="sidebar-guide"
          onClick={() => {
            setMobileOpen(false);
            openGuide();
          }}
          title="사용 안내"
        >
          <span className="guide-bulb">
            <Icon name="help" size={21} />
          </span>
          <span className="sidebar-label">
            <strong>서비스 사용 안내</strong>
            <small>4단계로 알아보기</small>
          </span>
          <Icon name="chevron" size={14} className="sidebar-label" />
        </button>
        <button
          className="sidebar-position"
          onClick={() => setSide((s) => (s === 'left' ? 'right' : 'left'))}
          title={side === 'left' ? '메뉴 오른쪽에 배치' : '메뉴 왼쪽에 배치'}
          aria-label={side === 'left' ? '메뉴 오른쪽에 배치' : '메뉴 왼쪽에 배치'}
        >
          <Icon name="panel" size={18} />
          <span className="sidebar-label">{side === 'left' ? '오른쪽에 메뉴 배치' : '왼쪽에 메뉴 배치'}</span>
        </button>
        <Link className="sidebar-position" to="/start">
          <Icon name="logout" size={18} />
          <span className="sidebar-label">시작 화면으로</span>
        </Link>
      </div>
    </>
  );
  return (
    <div
      className="app-shell"
      data-collapsed={collapsed}
      data-side={side}
      data-home={location.pathname === '/owner'}
    >
      <a className="skip-link" href="#main-content">
        본문으로 바로가기
      </a>
      <header className="app-header no-print">
        <div className="app-brand">
          <button
            className="icon-button menu-toggle"
            onClick={toggle}
            aria-label={isMobile ? '전체 메뉴 열기' : collapsed ? '메뉴 펼치기' : '메뉴 접기'}
            aria-expanded={isMobile ? mobileOpen : !collapsed}
            aria-controls={isMobile ? 'mobile-sidebar' : 'desktop-sidebar'}
          >
            <Icon name="menu" size={23} />
          </button>
          <Link to="/" aria-label="사람샘각 홈">
            <Brand />
          </Link>
        </div>
        <GlobalSearch />
        <div className="header-actions">
          <button
            className="icon-button guide-header-button"
            onClick={openGuide}
            aria-label="사용 안내 열기"
            title="사용 안내"
          >
            <Icon name="help" />
          </button>
          <ThemeToggle />
          <Link
            className="icon-button notification-button"
            to="/owner#notifications"
            aria-label="알림함 열기"
          >
            <Icon name="bell" />
            {state.notifications.some((n) => n.to === 'owner' && !n.readAt) && <span />}
          </Link>
          <Link className="profile-button" to="/owner/settings" title="사업장 설정">
            <span className="profile-avatar">{(wp?.name || '사').slice(0, 1)}</span>
            <span>사장님</span>
            <Icon name="chevron" size={13} />
          </Link>
        </div>
      </header>
      <div className="shell-body">
        <aside className="app-sidebar no-print" id="desktop-sidebar">
          {menuContent()}
        </aside>
        <div className="app-content">
          <DemoBar />
          <div className="breadcrumb no-print">
            <span>내 사업장</span>
            <Icon name="chevron" size={12} />
            <strong>{activeMenu?.label || '사업장 관리'}</strong>
          </div>
          <main id="main-content" className="workspace-main">
            <div className="page-transition" key={location.pathname}>
              <Outlet />
            </div>
          </main>
          <footer className="app-footer no-print">
            <span>사람샘각</span>
            <span>법령 기준일 {fmtDate(base)} · 참고용 안내</span>
            <button onClick={openGuide}>도움이 필요하신가요?</button>
          </footer>
        </div>
      </div>
      <dialog
        {...mobileDialog}
        id="mobile-sidebar"
        className="mobile-sidebar-dialog no-print"
        data-side={side}
        aria-label="전체 메뉴"
      >
        <div className="mobile-sidebar-content">
          <div className="mobile-sidebar-top">
            <Brand />
            <button className="icon-button" onClick={() => setMobileOpen(false)} aria-label="메뉴 닫기">
              <Icon name="close" />
            </button>
          </div>
          {menuContent(true)}
        </div>
      </dialog>
      <nav className="mobile-bottom-nav no-print" aria-label="하단 메뉴">
        {[OWNER_MENU[0], OWNER_MENU[1], OWNER_MENU[2], OWNER_MENU[3]].map((m) => (
          <NavLink key={m.to} to={m.to} end={m.end} className={activeMenu?.to === m.to ? 'active' : ''}>
            <Icon name={m.icon} size={21} />
            <span>{m.label === '한눈에 보기' ? '홈' : m.label.replace(' 관리', '')}</span>
          </NavLink>
        ))}
        <button onClick={() => setMobileOpen(true)} aria-label="전체 메뉴 열기">
          <Icon name="menu" size={21} />
          <span>전체</span>
        </button>
      </nav>
    </div>
  );
}

export function RoleLayout({
  role,
  title,
  tabs,
}: {
  role: 'employee' | 'firm' | 'admin';
  title: ReactNode;
  tabs?: { to: string; label: string; end?: boolean }[];
}) {
  const { session } = useStore();
  const { openGuide } = usePreferences();
  const location = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  if (!session) return <Navigate to="/start" replace />;
  if (session.role !== role) return <Navigate to={'/' + session.role} replace />;
  return (
    <div className="min-h-screen">
      <header className="role-header no-print">
        <Link to="/" aria-label="사람샘각 홈">
          <Brand />
        </Link>
        <GlobalSearch />
        <div className="header-actions">
          <button className="icon-button" onClick={openGuide} aria-label="사용 안내 열기">
            <Icon name="help" />
          </button>
          <ThemeToggle />
          <Link className="ui-button secondary" to="/start">
            시작 화면
          </Link>
        </div>
      </header>
      <DemoBar />
      <div className={cx('mx-auto px-5 pt-7', role === 'employee' ? 'max-w-xl' : 'max-w-6xl')}>{title}</div>
      <main className={cx('mx-auto px-5 pb-28 pt-5', role === 'employee' ? 'max-w-xl' : 'max-w-6xl')}>
        <div className="page-transition" key={location.pathname}>
          <Outlet />
        </div>
      </main>
      {tabs && (
        <nav className="role-bottom-nav no-print" aria-label="직원 메뉴">
          <div>
            {tabs.map((m, i) => (
              <NavLink
                key={m.to}
                to={m.to}
                end={m.end}
                className={({ isActive }) => (isActive ? 'active' : '')}
              >
                <Icon name={(['home', 'calendar', 'wallet', 'clock', 'settings'] as const)[i]} size={20} />
                <span>{m.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
