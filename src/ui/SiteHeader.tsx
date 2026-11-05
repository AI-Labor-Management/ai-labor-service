import { Link } from 'react-router';
import { useStore } from '../state/store';
import { Brand, Icon } from './Icon';
import { GlobalSearch } from './Search';
import { ThemeToggle, usePreferences } from './preferences';

export function SiteHeader() {
  const { session } = useStore();
  const { openGuide } = usePreferences();
  return (
    <header className="public-header no-print">
      <div className="public-header-main">
        <Link to="/" aria-label="AI 인사노무 관리 홈">
          <Brand />
        </Link>
        <GlobalSearch />
        <div className="header-actions">
          <button className="icon-button" onClick={openGuide} aria-label="사용 안내 열기" title="사용 안내">
            <Icon name="help" />
          </button>
          <ThemeToggle />
          <Link className="header-login" to="/start">
            로그인
          </Link>
          <Link className="ui-button primary header-signup" to="/start?mode=signup">
            회원가입
          </Link>
        </div>
      </div>
      <nav className="public-nav" aria-label="서비스 메뉴">
        <a href="/#features">서비스 소개</a>
        <a href="/#diagnosis">1분 노무 진단</a>
        <button onClick={openGuide}>이용 가이드</button>
        <a href="/#faq">자주 묻는 질문</a>
        {session && (
          <Link className="nav-app-link" to={`/${session.role}`}>
            내 사업장으로
            <Icon name="arrow" size={15} />
          </Link>
        )}
        <span className="public-nav-note">
          <span className="status-dot" />
          우리 가게를 위한 인사노무 도우미
        </span>
      </nav>
    </header>
  );
}
