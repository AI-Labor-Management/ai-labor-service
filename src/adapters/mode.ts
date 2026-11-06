// 실행 방식: local(로그인 없이 이 브라우저에만 저장 — 기존 데모) / server(로그인해서 Supabase에 저장)
// 서버 주소·키가 빌드에 없으면 항상 local. 고른 값은 이 브라우저에 기억한다.
import { serverConfigured } from './server';

export type Mode = 'local' | 'server';
const KEY = 'ai-labor/mode';

function fromAuthRedirect(): boolean {
  // 가입 확인 메일 링크로 돌아온 경우 (#access_token=… 또는 ?code=…)
  return /access_token=|error_description=/.test(location.hash) || /[?&]code=/.test(location.search);
}

export function getMode(): Mode {
  if (!serverConfigured) return 'local';
  if (fromAuthRedirect()) {
    remember('server');
    return 'server';
  }
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'server' || v === 'local') return v;
  } catch {
    /* 저장소 차단 */
  }
  return import.meta.env.VITE_STORAGE_ADAPTER === 'supabase' ? 'server' : 'local';
}

function remember(m: Mode) {
  try {
    localStorage.setItem(KEY, m);
  } catch {
    /* 저장소 차단 — 이번 방문만 */
  }
}

/** 방식을 바꾸면 저장소가 달라지므로 페이지를 새로 연다 */
export function switchMode(m: Mode, path = 'start') {
  remember(m);
  location.assign(`${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`);
}
