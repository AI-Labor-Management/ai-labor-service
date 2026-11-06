import type { CSSProperties } from 'react';
import { SERVICE_NAME } from './brand';

export type IconName =
  | 'home'
  | 'people'
  | 'calendar'
  | 'wallet'
  | 'file'
  | 'shield'
  | 'chat'
  | 'settings'
  | 'search'
  | 'sun'
  | 'moon'
  | 'menu'
  | 'close'
  | 'chevron'
  | 'arrow'
  | 'plus'
  | 'bell'
  | 'help'
  | 'logout'
  | 'check'
  | 'clock'
  | 'spark'
  | 'play'
  | 'pause'
  | 'mail'
  | 'lock'
  | 'eye'
  | 'eyeOff'
  | 'building'
  | 'panel'
  | 'download';
const paths: Record<IconName, React.ReactNode> = {
  home: (
    <>
      <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m3 9v-2a6 6 0 0 0-2-4.5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M7 3v4m10-4v4M3 11h18m-13 4h.01M12 15h.01M16 15h.01M8 18h.01M12 18h.01" />
    </>
  ),
  wallet: (
    <>
      <path d="M20 8V5a2 2 0 0 0-2-2H6a3 3 0 0 0 0 6h14v11H6a3 3 0 0 1-3-3V6" />
      <path d="M21 12h-6v5h6Z" />
      <path d="M17 14.5h.01" />
    </>
  ),
  file: (
    <>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Zm0 0v6h6M8 13h8m-8 4h5" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7Z" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  chat: (
    <>
      <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2v-9.5A8.5 8.5 0 0 1 10.5 4h2a8.5 8.5 0 0 1 8.5 7.5Z" />
      <path d="M7 10h9m-9 4h6" />
    </>
  ),
  settings: (
    <>
      <path d="m9 3-1 3-3 1-2 4 2 2v4l4 2 2-1 3 2 4-2v-3l3-2-1-5-3-1-1-3Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="7" />
      <path d="m16 16 5 5" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
    </>
  ),
  moon: <path d="M21 13a9 9 0 0 1-10-10 9 9 0 1 0 10 10Z" />,
  menu: <path d="M4 6h16M4 12h11M4 18h16" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  plus: <path d="M12 4v16M4 12h16" />,
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1 .5-1.5 1-1.5 2m0 3h.01" />
    </>
  ),
  logout: (
    <>
      <path d="M9 3H4v18h5m-1-9h13m-4-4 4 4-4 4" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  spark: <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Zm7 0v4m-2-2h4" />,
  play: <path d="m8 4 12 8L8 20Z" />,
  pause: <path d="M8 5v14M16 5v14" />,
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10" width="14" height="11" rx="3" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="m3 3 18 18M9 5.5a11 11 0 0 1 3-.5c6 0 10 7 10 7a21 21 0 0 1-3 4m-3 2.5a11 11 0 0 1-4 .5C6 19 2 12 2 12a24 24 0 0 1 4-4" />
    </>
  ),
  building: (
    <>
      <path d="M5 21V3h14v18M9 7h1m4 0h1m-6 4h1m4 0h1M9 21v-6h6v6M3 21h18" />
    </>
  ),
  panel: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M9 4v16m4-11 3 3-3 3" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4" />
    </>
  ),
};

export function Icon({
  name,
  size = 20,
  className,
  style,
}: {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      style={style}
    >
      {paths[name]}
    </svg>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand-lockup" aria-label={SERVICE_NAME}>
      <svg className="brand-symbol" viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <path d="M5 18C5 10.82 10.82 5 18 5h10v7H18a6 6 0 0 0-6 6v10H5V18Z" fill="currentColor" />
        <path d="M35 22c0 7.18-5.82 13-13 13H12v-7h10a6 6 0 0 0 6-6V12h7v10Z" fill="currentColor" />
      </svg>
      {!compact && (
        <span className="brand-wordmark" aria-hidden="true">
          사람샘각
        </span>
      )}
    </span>
  );
}
