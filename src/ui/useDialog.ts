import { useEffect, useRef, useState, type PointerEvent, type SyntheticEvent } from 'react';

let locks = 0;
let originalOverflow = '';
function lockScroll() {
  if (locks++ === 0) {
    originalOverflow = document.documentElement.style.overflowY;
    document.documentElement.style.overflowY = 'hidden';
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--locks === 0) document.documentElement.style.overflowY = originalOverflow;
  };
}

/** Native focus containment, paired outside taps, scroll lock and a short exit. */
export function useDialog(open: boolean, onDismiss: () => void, surfaceSelector?: string) {
  const ref = useRef<HTMLDialogElement>(null);
  const [closing, setClosing] = useState(false);
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  const release = useRef<(() => void) | null>(null);
  const outsidePointer = useRef<number | null>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open) {
      setClosing(false);
      if (!dialog.open) dialog.showModal();
      release.current ??= lockScroll();
      return;
    }
    if (!dialog.open) return;
    setClosing(true);
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 140;
    const timer = window.setTimeout(() => {
      dialog.close();
      release.current?.();
      release.current = null;
      setClosing(false);
    }, duration);
    return () => window.clearTimeout(timer);
  }, [open]);
  useEffect(
    () => () => {
      ref.current?.close();
      release.current?.();
      release.current = null;
    },
    [],
  );
  const outside = (e: PointerEvent<HTMLDialogElement>) => {
    const surface = surfaceSelector ? e.currentTarget.querySelector(surfaceSelector) : e.currentTarget;
    const r = (surface ?? e.currentTarget).getBoundingClientRect();
    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  };
  return {
    ref,
    'data-state': closing ? 'closing' : 'open',
    onCancel: (e: SyntheticEvent<HTMLDialogElement>) => {
      e.preventDefault();
      dismiss.current();
    },
    onPointerDown: (e: PointerEvent<HTMLDialogElement>) => {
      outsidePointer.current = outside(e) ? e.pointerId : null;
    },
    onPointerUp: (e: PointerEvent<HTMLDialogElement>) => {
      if (outsidePointer.current === e.pointerId && outside(e)) dismiss.current();
      outsidePointer.current = null;
    },
    onPointerCancel: () => {
      outsidePointer.current = null;
    },
  };
}
