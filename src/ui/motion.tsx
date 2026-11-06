import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { flushSync } from 'react-dom';

const ease = 'cubic-bezier(.22, 1, .36, 1)';
export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let transition: ViewTransition | undefined;

/** Capture layout/theme changes without animating live layout or delaying the action. */
export function transitionUI(update: () => void, kind: 'layout' | 'theme' = 'layout') {
  if (reducedMotion() || !document.startViewTransition) {
    update();
    return;
  }
  transition?.skipTransition();
  document.documentElement.dataset.uiTransition = kind;
  const next = document.startViewTransition(() => flushSync(update));
  void next.ready.catch(() => {});
  transition = next;
  void next.finished
    .catch(() => {})
    .finally(() => {
      if (transition === next) {
        delete document.documentElement.dataset.uiTransition;
        transition = undefined;
      }
    });
}

export function AnimatedNumber({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const previous = useRef<number | null>(null);
  const formatted = Math.round(value).toLocaleString('ko-KR');
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const start = previous.current ?? 0;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finish = () => {
      cancelAnimationFrame(frame);
      previous.current = value;
      el.textContent = formatted;
    };
    if (media.matches || start === value) {
      finish();
      return;
    }
    const at = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - at) / 650);
      const current = Math.round(start + (value - start) * (1 - Math.pow(1 - progress, 4)));
      previous.current = current;
      el.textContent = current.toLocaleString('ko-KR');
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const change = () => {
      if (media.matches) finish();
    };
    media.addEventListener('change', change);
    return () => {
      cancelAnimationFrame(frame);
      media.removeEventListener('change', change);
    };
  }, [value, formatted]);
  return (
    <span className="animated-number">
      <span ref={ref} aria-hidden="true">
        {formatted}
      </span>
      <span className="sr-only">{formatted}</span>
    </span>
  );
}

/** A single selection surface follows the actual button, including resized/scrolling tabs. */
export function useSelectionIndicator(value: string, selector = '[aria-pressed="true"]') {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>();
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const button = el.querySelector<HTMLElement>(selector);
      if (!button) return;
      setStyle({
        '--selection-x': button.offsetLeft + 'px',
        '--selection-y': button.offsetTop + 'px',
        '--selection-scale': button.offsetWidth / 100,
        '--selection-height': button.offsetHeight + 'px',
      } as CSSProperties);
    };
    measure();
    if (!window.ResizeObserver) {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    for (const button of el.querySelectorAll('button')) observer.observe(button);
    return () => observer.disconnect();
  }, [value, selector]);
  return {
    ref,
    indicator: <span className="selection-indicator" aria-hidden="true" style={style} data-ready={!!style} />,
  };
}

/** Retained rows move from their previous position; new rows enter without blocking clicks. */
export function useListMotion(key: string) {
  const ref = useRef<HTMLUListElement>(null);
  const positions = useRef(new Map<string, { x: number; y: number }>());
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const next = new Map<string, { x: number; y: number }>();
    const parent = el.getBoundingClientRect();
    Array.from(el.querySelectorAll<HTMLElement>('[data-motion-key]')).forEach((row, i) => {
      row.getAnimations?.().forEach((a) => a.cancel());
      const rect = row.getBoundingClientRect();
      const id = row.dataset.motionKey!;
      const old = positions.current.get(id);
      const point = { x: rect.left - parent.left, y: rect.top - parent.top };
      next.set(id, point);
      if (!positions.current.size || reducedMotion() || !row.animate) return;
      const dx = old ? old.x - point.x : 0;
      const dy = old ? old.y - point.y : 12;
      if (old && Math.abs(dx) + Math.abs(dy) < 1) return;
      row.animate(
        [
          { transform: `translate(${dx}px, ${dy}px)`, opacity: old ? 1 : 0 },
          { transform: 'translate(0, 0)', opacity: 1 },
        ],
        { duration: 300, delay: old ? 0 : Math.min(i * 24, 96), easing: ease, fill: 'backwards' },
      );
    });
    positions.current = next;
  }, [key]);
  return ref;
}

export function useScrollReveal(route: string) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root || reducedMotion() || !window.IntersectionObserver) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) {
            entry.target.animate?.(
              [
                { opacity: 0, transform: 'translateY(14px)' },
                { opacity: 1, transform: 'none' },
              ],
              { duration: 380, easing: ease },
            );
            observer.unobserve(entry.target);
          }
      },
      { threshold: 0.08 },
    );
    for (const el of root.querySelectorAll('.dashboard-panel, .surface-card, .employee-directory')) {
      if (el.getBoundingClientRect().top > window.innerHeight) observer.observe(el);
    }
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => {
      if (media.matches) {
        observer.disconnect();
        root.getAnimations?.({ subtree: true }).forEach((a) => a.cancel());
      }
    };
    media.addEventListener('change', change);
    return () => {
      observer.disconnect();
      media.removeEventListener('change', change);
    };
  }, [route]);
  return ref;
}
