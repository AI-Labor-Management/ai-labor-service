// 공통 UI 부품. 모든 버튼은 실제 동작 / 이유 있는 비활성(reason) / 연결 대기 중 하나여야 한다.
import {
  createContext,
  Children,
  cloneElement,
  isValidElement,
  useCallback,
  useContext,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import { Link } from 'react-router';
import { resolveRule, sourceLabel, STATUS_LABEL } from '../domain/rules';
import type { IntegrationStatus } from '../adapters/integrations';
import { STATUS_TEXT } from '../adapters/integrations';
import { Icon } from './Icon';
import { useDialog } from './useDialog';
import { useSelectionIndicator } from './motion';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'kakao';
const VARIANT: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-dark border border-brand',
  secondary: 'bg-white text-ink border border-line hover:border-brand/50 hover:bg-brand-soft/40',
  ghost: 'bg-transparent text-brand border border-transparent hover:bg-brand-soft/60',
  danger: 'bg-white text-risk border border-risk/40 hover:bg-risk-soft',
  kakao: 'bg-kakao text-[#191600] border border-kakao',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  reason,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  reason?: string;
}) {
  const id = useId();
  const isDisabled = disabled || !!reason;
  return (
    <span className={cx('inline-flex flex-col', className?.includes('w-full') && 'w-full')}>
      <button
        type="button"
        {...rest}
        disabled={isDisabled}
        aria-describedby={reason ? id : undefined}
        title={reason}
        className={cx(
          'kit-button inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
          size === 'sm'
            ? 'px-2.5 py-1 text-sm'
            : size === 'lg'
              ? 'px-5 py-3 text-base'
              : 'px-3.5 py-2 text-sm',
          VARIANT[variant],
          className,
        )}
      >
        {children}
      </button>
      {reason && (
        <span id={id} className="mt-1 text-xs text-muted">
          {reason}
        </span>
      )}
    </span>
  );
}

export function LinkButton({
  to,
  variant = 'secondary',
  size = 'md',
  className,
  children,
}: {
  to: string;
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      className={cx(
        'kit-button inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition-colors',
        size === 'sm' ? 'px-2.5 py-1 text-sm' : size === 'lg' ? 'px-5 py-3 text-base' : 'px-3.5 py-2 text-sm',
        VARIANT[variant],
        className,
      )}
    >
      {children}
    </Link>
  );
}

export type Tone = 'risk' | 'warn' | 'info' | 'ok' | 'muted' | 'brand';
const TONE: Record<Tone, string> = {
  risk: 'bg-risk-soft text-risk',
  warn: 'bg-warn-soft text-warn',
  info: 'bg-info-soft text-info',
  ok: 'bg-ok-soft text-ok',
  muted: 'bg-canvas text-muted border border-line',
  brand: 'bg-brand-soft text-brand',
};

export function Badge({
  tone = 'muted',
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold',
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Card({
  title,
  right,
  children,
  className,
  id,
}: {
  title?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cx('surface-card rounded-2xl border border-line bg-white p-4 sm:p-5', className)}
    >
      {(title || right) && (
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          {title && <h2 className="text-base font-bold">{title}</h2>}
          {right && <div className="text-sm text-muted">{right}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageHeader({
  title,
  sub,
  actions,
}: {
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="page-header mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** 너비를 따로 줄 때 쓰는 입력칸 스타일 */
export const inputBaseCls =
  'rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-canvas';
export const inputCls = `w-full ${inputBaseCls}`;

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  htmlFor?: string;
}) {
  const generatedId = useId();
  const descriptionId = `field-${generatedId}`;
  const describedChildren = Children.map(children, (child) => {
    if (
      !htmlFor ||
      !isValidElement<{ id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }>(child) ||
      child.props.id !== htmlFor
    )
      return child;
    return cloneElement(child, {
      'aria-invalid': !!error,
      'aria-describedby':
        [child.props['aria-describedby'], hint || error ? descriptionId : null].filter(Boolean).join(' ') ||
        undefined,
    });
  });
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm font-semibold">
        {label}
      </label>
      {describedChildren}
      {hint && !error && (
        <span id={descriptionId} className="text-xs text-muted">
          {hint}
        </span>
      )}
      {error && (
        <span id={descriptionId} role="alert" className="text-xs font-semibold text-risk">
          {error}
        </span>
      )}
    </div>
  );
}

export function Choice<T extends string>({
  options,
  value,
  onChange,
  name,
  multi,
}: {
  options: { value: T; label: ReactNode }[];
  value: T | T[] | null;
  onChange: (v: T) => void;
  name: string;
  multi?: boolean;
}) {
  return (
    <div role={multi ? 'group' : 'radiogroup'} aria-label={name} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = Array.isArray(value) ? value.includes(o.value) : value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role={multi ? 'checkbox' : 'radio'}
            aria-checked={on}
            tabIndex={multi || on || (!value && options[0].value === o.value) ? 0 : -1}
            onKeyDown={(ev) => {
              if (
                multi ||
                !['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(ev.key)
              )
                return;
              ev.preventDefault();
              const index = options.findIndex((item) => item.value === o.value);
              const next =
                ev.key === 'Home'
                  ? 0
                  : ev.key === 'End'
                    ? options.length - 1
                    : (index +
                        (ev.key === 'ArrowRight' || ev.key === 'ArrowDown' ? 1 : -1) +
                        options.length) %
                      options.length;
              onChange(options[next].value);
              const buttons =
                ev.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
              buttons?.[next]?.focus();
            }}
            onClick={() => onChange(o.value)}
            className={cx(
              'rounded-lg border px-3 py-2 text-sm font-semibold transition-colors',
              on ? 'border-brand bg-brand text-white' : 'border-line bg-white hover:border-brand/50',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Money({ value, className }: { value: number | null | undefined; className?: string }) {
  if (value === null || value === undefined) return <span className={cx('text-muted', className)}>미정</span>;
  return <span className={cx('num', className)}>{Math.round(value).toLocaleString('ko-KR')}원</span>;
}

export const won = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : `${Math.round(n).toLocaleString('ko-KR')}원`;

export function Notice({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('rounded-xl px-4 py-3 text-sm', TONE[tone], className)}>
      {title && <p className="font-bold">{title}</p>}
      {children && <div className={cx(!!title && 'mt-1', 'text-ink/85')}>{children}</div>}
    </div>
  );
}

export function Empty({
  title,
  children,
  action,
}: {
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-white/60 px-4 py-8 text-center">
      <p className="font-semibold">{title}</p>
      {children && <p className="mt-1 text-sm text-muted">{children}</p>}
      {action && <div className="mt-3 flex justify-center">{action}</div>}
    </div>
  );
}

export function RuleStatusBadge({ status }: { status: string }) {
  const tone: Tone =
    status === 'verified'
      ? 'ok'
      : status === 'announced' || status === 'partial'
        ? 'warn'
        : status === 'pending' || status === 'needsExpert'
          ? 'risk'
          : 'muted';
  const label =
    (STATUS_LABEL as Record<string, string>)[status] ??
    (status === 'noValueForDate' || status === 'unknownRule' ? STATUS_LABEL.missing : status);
  return <Badge tone={tone}>{label}</Badge>;
}

/** "근거 ▾" — rules.json의 값·상태·출처를 보여준다 */
export function Basis({
  ids,
  date,
  text,
  label = '근거',
}: {
  ids: string[];
  date: string;
  text?: string;
  label?: string;
}) {
  const uniq = Array.from(new Set(ids));
  if (!uniq.length && !text) return null;
  return (
    <details className="group text-xs">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-md bg-info-soft px-2 py-0.5 font-semibold text-info select-none">
        {label} <span className="transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div className="mt-2 space-y-2 rounded-lg border border-line bg-canvas/60 p-3 text-ink">
        {text && <p>{text}</p>}
        {uniq.map((id) => {
          const r = resolveRule(id, date);
          return (
            <div key={id}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{r.label}</span>
                <RuleStatusBadge status={r.ok ? r.status : r.reason === 'pending' ? 'pending' : 'missing'} />
                {r.ok && r.verifiedAt && <span className="text-muted">확인일 {r.verifiedAt}</span>}
              </div>
              {r.ok && (
                <p className="mt-0.5 text-muted">
                  값:{' '}
                  <code className="text-ink">
                    {typeof r.value === 'object' ? JSON.stringify(r.value) : String(r.value)}
                  </code>{' '}
                  · 시행 {r.effectiveFrom ?? '—'} ~ {r.effectiveTo ?? '현재'}
                </p>
              )}
              <ul className="mt-0.5 list-disc pl-4 text-muted">
                {r.sources.map((s, i) => (
                  <li key={i}>
                    {sourceLabel(s)}
                    {s.quote ? ` — “${s.quote}”` : ''}
                    {s.url && (
                      <>
                        {' '}
                        <a
                          className="text-info underline"
                          href={s.url}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          원문
                        </a>
                      </>
                    )}
                  </li>
                ))}
              </ul>
              {r.note && <p className="mt-0.5 text-muted">메모: {r.note}</p>}
            </div>
          );
        })}
        <p className="text-muted">
          기준일 {date} · 참고용 안내예요. 개별 사건의 법률 판단을 대신하지 않아요.
        </p>
      </div>
    </details>
  );
}

export function ConnBadge({ status }: { status: IntegrationStatus }) {
  return (
    <Badge tone={status === 'live' ? 'ok' : status === 'demo' ? 'brand' : 'warn'}>
      {STATUS_TEXT[status]}
    </Badge>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { value: T; label: ReactNode; hidden?: boolean }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const selection = useSelectionIndicator(value, '[role="tab"][aria-selected="true"]');
  return (
    <div
      ref={selection.ref}
      role="tablist"
      aria-label="보기 선택"
      className="selection-tabs common-tabs mb-4 flex gap-1 overflow-x-auto border-b border-line"
      onKeyDown={(e) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
        const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
        const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
        if (current < 0) return;
        e.preventDefault();
        const index =
          e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? buttons.length - 1
              : (current + (e.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
        buttons[index]?.focus();
        const item = tabs.filter((t) => !t.hidden)[index];
        if (item) onChange(item.value);
      }}
    >
      {selection.indicator}
      {tabs
        .filter((t) => !t.hidden)
        .map((t) => (
          <button
            key={t.value}
            role="tab"
            type="button"
            aria-selected={value === t.value}
            tabIndex={value === t.value ? 0 : -1}
            onClick={() => onChange(t.value)}
            className={cx(
              '-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold',
              value === t.value ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink',
            )}
          >
            {t.label}
          </button>
        ))}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  className?: string;
}) {
  const dialog = useDialog(open, onClose);
  const titleId = useId();
  return (
    <dialog
      {...dialog}
      aria-labelledby={titleId}
      className={cx('modal-surface', wide && 'modal-wide', className)}
    >
      <div className="modal-layout">
        <div className="modal-heading">
          <h2 id={titleId}>{title}</h2>
          <button type="button" onClick={onClose} className="icon-button modal-close" aria-label="닫기">
            <Icon name="close" size={19} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </dialog>
  );
}

// ---- 토스트: 실제로 완료된 로컬 동작에만 쓴다 ----
const ToastCtx = createContext<(msg: string, tone?: Tone) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string; tone: Tone }[]>([]);
  const push = useCallback((msg: string, tone: Tone = 'ok') => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, msg, tone }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="no-print pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6"
      >
        {items.map((i) => (
          <div
            key={i.id}
            className={cx(
              'pointer-events-auto rounded-xl px-4 py-2 text-sm font-semibold shadow-lg',
              TONE[i.tone],
            )}
          >
            {i.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

export function levelTone(level: string): Tone {
  return level === 'risk' || level === 'overdue'
    ? 'risk'
    : level === 'soon' || level === 'due7'
      ? 'warn'
      : level === 'check'
        ? 'info'
        : level === 'done' || level === 'ok'
          ? 'ok'
          : 'muted';
}

export function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function KV({ k, v, className }: { k: ReactNode; v: ReactNode; className?: string }) {
  return (
    <div className={cx('flex items-start justify-between gap-3 py-1.5 text-sm', className)}>
      <span className="text-muted">{k}</span>
      <span className="text-right font-medium">{v}</span>
    </div>
  );
}
