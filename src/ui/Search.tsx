import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useStore } from '../state/store';
import { Modal } from './kit';
import { Icon, type IconName } from './Icon';
import { OWNER_MENU } from './navigation';

export function GlobalSearch() {
  const { state, session } = useStore();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const nav = useNavigate();
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  useEffect(() => {
    if (open) input.current?.focus();
    else {
      setQ('');
      setSelected(0);
    }
  }, [open]);
  const results = useMemo(() => {
    const items: { title: string; sub: string; icon: IconName; to: string; keywords: string }[] = [];
    if (!session || session.role === 'owner') {
      items.push(
        ...OWNER_MENU.map((m) => ({
          title: m.label,
          sub: session ? '메뉴 바로가기' : '데모에서 확인할 수 있어요',
          icon: m.icon,
          to: session ? m.to : `/start?next=${encodeURIComponent(m.to)}`,
          keywords: m.keywords,
        })),
      );
      if (session?.role === 'owner')
        items.push(
          ...state.employees.map((e) => ({
            title: e.alias,
            sub: e.resignDate ? '직원 · 퇴사 기록 포함' : '직원 상세',
            icon: 'people' as const,
            to: `/owner/employees/${e.id}`,
            keywords: '직원 ' + e.alias,
          })),
        );
    } else if (session.role === 'employee') {
      items.push(
        ...[
          { title: '나의 홈', to: '/employee', icon: 'home' as const },
          { title: '내 근무 일정', to: '/employee/schedule', icon: 'calendar' as const },
          { title: '내 급여·명세서', to: '/employee/pay', icon: 'wallet' as const },
          { title: '내 연차', to: '/employee/leave', icon: 'clock' as const },
          { title: '내 설정', to: '/employee/settings', icon: 'settings' as const },
        ].map((m) => ({ ...m, sub: '직원 메뉴', keywords: m.title })),
      );
    } else
      items.push({
        title: session.role === 'firm' ? '상담 요청함' : '관리자 현황',
        sub: '내 역할의 메뉴',
        icon: 'home',
        to: `/${session.role}`,
        keywords: '홈 상담 관리자',
      });
    const query = q.trim().toLocaleLowerCase().replace(/\s/g, '');
    return items
      .filter(
        (r) => !query || `${r.title}${r.keywords}`.toLocaleLowerCase().replace(/\s/g, '').includes(query),
      )
      .slice(0, 9);
  }, [state.employees, session, q]);
  const go = (to: string) => {
    setOpen(false);
    nav(to);
  };
  return (
    <>
      <button
        className="global-search"
        onClick={() => setOpen(true)}
        aria-label="통합 검색 열기"
        aria-keyshortcuts="Control+k Meta+k"
      >
        <Icon name="search" />
        <span>직원, 급여, 필요한 업무 검색</span>
        <kbd>Ctrl K</kbd>
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="무엇을 찾고 계신가요?" wide>
        <div className="search-input-wrap">
          <Icon name="search" />
          <input
            ref={input}
            aria-label="메뉴와 직원 검색"
            placeholder="예: 직원 A, 급여, 계약서"
            value={q}
            autoComplete="off"
            onChange={(e) => {
              setQ(e.target.value);
              setSelected(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelected((s) => Math.min(s + 1, results.length - 1));
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelected((s) => Math.max(0, s - 1));
              }
              if (e.key === 'Enter' && results[selected]) {
                e.preventDefault();
                go(results[selected].to);
              }
            }}
          />
        </div>
        <p className="search-caption" aria-live="polite">
          {q ? `검색 결과 ${results.length}개` : '자주 찾는 메뉴'}{' '}
          {!session && '· 데모 시작 후 해당 메뉴로 이동해요'}
        </p>
        <div className="search-results">
          {results.map((r, i) => (
            <button
              className={`search-result ${i === selected ? 'selected' : ''}`}
              key={r.to}
              onClick={() => go(r.to)}
            >
              <span className="search-icon">
                <Icon name={r.icon} />
              </span>
              <span>
                <strong>{r.title}</strong>
                <small>{r.sub}</small>
              </span>
              <Icon name="arrow" size={17} />
            </button>
          ))}
        </div>
        {!results.length && (
          <div className="search-empty">
            <Icon name="search" size={30} />
            <strong>검색 결과가 없어요</strong>
            <span>‘급여’, ‘직원’처럼 짧은 단어로 찾아보세요.</span>
          </div>
        )}
        <div className="search-footer">
          <span>↑ ↓ 이동</span>
          <span>Enter 선택</span>
          <span>Esc 닫기</span>
        </div>
      </Modal>
    </>
  );
}
