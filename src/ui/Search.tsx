import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useStore } from '../state/store';
import { Modal } from './kit';
import { Icon, type IconName } from './Icon';
import { OWNER_MENU } from './navigation';

type SearchItem = { title: string; sub: string; icon: IconName; to: string; keywords: string };
export function GlobalSearch() {
  const { state, session } = useStore();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const listId = useId();
  const nav = useNavigate();
  const show = () => {
    setQ('');
    setSelected(0);
    setOpen(true);
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && !e.isComposing) {
        e.preventDefault();
        if (open) setOpen(false);
        else if (!document.querySelector('dialog[open]')) show();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [open]);
  useEffect(() => {
    if (open) input.current?.focus({ preventScroll: true });
  }, [open]);
  const results = useMemo(() => {
    const items: SearchItem[] = [];
    if (!session || session.role === 'owner') {
      items.push(
        ...OWNER_MENU.map((m) => ({
          title: m.label,
          sub: session ? '업무 메뉴' : '체험 화면에서 확인',
          icon: m.icon,
          to: session ? m.to : `/start?next=${encodeURIComponent(m.to)}`,
          keywords: m.keywords,
        })),
      );
      if (session?.role === 'owner')
        items.push(
          ...state.employees.map((e) => ({
            title: e.alias,
            sub: e.resignDate ? '직원 상세 (퇴사)' : '직원 상세',
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
    if (!query) return items.slice(0, 6);
    return items.filter((r) =>
      `${r.title}${r.keywords}`.toLocaleLowerCase().replace(/\s/g, '').includes(query),
    );
  }, [state.employees, session, q]);
  useEffect(() => {
    if (!open) return;
    list.current
      ?.querySelectorAll<HTMLElement>('[role="option"]')
      [selected]?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }, [selected, open]);
  const go = (to: string) => {
    setOpen(false);
    nav(to);
  };
  return (
    <>
      <button
        className="global-search"
        onClick={show}
        aria-label="통합 검색 열기"
        aria-keyshortcuts="Control+k Meta+k"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Icon name="search" size={18} />
        <span>직원, 급여, 필요한 업무 검색</span>
        <kbd>Ctrl K</kbd>
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="통합 검색" wide className="search-modal">
        <div className="search-input-wrap">
          <Icon name="search" size={21} />
          <input
            ref={input}
            role="combobox"
            aria-label="메뉴와 직원 검색"
            aria-controls={listId}
            aria-expanded={open}
            aria-autocomplete="list"
            aria-activedescendant={results[selected] ? `${listId}-${selected}` : undefined}
            placeholder="직원 이름이나 필요한 업무를 입력하세요"
            value={q}
            autoComplete="off"
            onChange={(e) => {
              setQ(e.target.value);
              setSelected(0);
            }}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return;
              if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key) && results.length) {
                if ((e.key === 'Home' || e.key === 'End') && !e.altKey) return;
                e.preventDefault();
                setSelected((s) =>
                  e.key === 'Home'
                    ? 0
                    : e.key === 'End'
                      ? results.length - 1
                      : (s + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length,
                );
              }
              if (e.key === 'Enter' && results[selected]) {
                e.preventDefault();
                go(results[selected].to);
              }
            }}
          />
          {q && (
            <button
              className="icon-button search-clear"
              aria-label="검색어 지우기"
              onClick={() => {
                setQ('');
                setSelected(0);
                input.current?.focus();
              }}
            >
              <Icon name="close" size={16} />
            </button>
          )}
        </div>
        <div className="search-caption" aria-live="polite" aria-atomic="true">
          <span>{q.trim() ? `검색 결과 ${results.length}개` : '자주 찾는 메뉴'}</span>
          {!session && <span>체험 시작 후 이동해요</span>}
        </div>
        <div className="search-results" id={listId} ref={list} role="listbox" aria-label="검색 결과">
          {results.map((r, i) => (
            <button
              type="button"
              role="option"
              aria-selected={i === selected}
              tabIndex={-1}
              id={`${listId}-${i}`}
              className={`search-result ${i === selected ? 'selected' : ''}`}
              key={r.to}
              onPointerMove={() => setSelected(i)}
              onClick={() => go(r.to)}
            >
              <Icon name={r.icon} size={20} className="search-result-icon" />
              <span>
                <strong>{r.title}</strong>
                <small>{r.sub}</small>
              </span>
              <Icon name="arrow" size={16} />
            </button>
          ))}
        </div>
        {!results.length && (
          <div className="search-empty" role="status">
            <Icon name="search" size={26} />
            <strong>일치하는 결과가 없어요</strong>
            <span>‘급여’, ‘계약서’처럼 다른 단어로 찾아보세요.</span>
            <button
              className="ui-button secondary"
              onClick={() => {
                setQ('');
                setSelected(0);
                input.current?.focus();
              }}
            >
              전체 메뉴 보기
            </button>
          </div>
        )}
        <div className="search-footer">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> 이동
          </span>
          <span>
            <kbd>Enter</kbd> 선택
          </span>
          <span className="search-dismiss-hint">
            <kbd>Esc</kbd> 또는 바깥을 눌러 닫기
          </span>
        </div>
      </Modal>
    </>
  );
}
