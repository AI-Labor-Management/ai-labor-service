// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Modal } from '../src/ui/kit';

let root: Root;
let host: HTMLDivElement;
const dismissed = vi.fn();
function render(open: boolean) {
  act(() =>
    root.render(
      createElement(Modal, {
        open,
        onClose: dismissed,
        title: '검색',
        children: createElement('input', { 'aria-label': '검색어' }),
      }),
    ),
  );
  const dialog = host.querySelector('dialog')!;
  vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 100, 300, 200));
  return dialog;
}
function pointer(dialog: HTMLDialogElement, type: string, x: number, y: number) {
  const e = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
  Object.defineProperty(e, 'pointerId', { value: 1 });
  act(() => {
    dialog.dispatchEvent(e);
  });
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  window.matchMedia = vi.fn().mockReturnValue({ matches: false });
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  dismissed.mockClear();
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe('shared dialog dismissal and background scrolling', () => {
  it('dismisses a paired tap outside and keeps taps on internal whitespace open', () => {
    const dialog = render(true);
    pointer(dialog, 'pointerdown', 130, 130);
    pointer(dialog, 'pointerup', 130, 130);
    expect(dismissed).not.toHaveBeenCalled();
    pointer(dialog, 'pointerdown', 20, 20);
    pointer(dialog, 'pointerup', 20, 20);
    expect(dismissed).toHaveBeenCalledOnce();
  });
  it('does not dismiss when a text selection starts inside and ends outside', () => {
    const dialog = render(true);
    pointer(dialog, 'pointerdown', 130, 130);
    pointer(dialog, 'pointerup', 20, 20);
    expect(dismissed).not.toHaveBeenCalled();
  });
  it('routes Escape through the controlled state and restores scrolling after exit', () => {
    document.documentElement.style.overflowY = 'auto';
    const dialog = render(true);
    expect(dialog.open).toBe(true);
    expect(document.documentElement.style.overflowY).toBe('hidden');
    act(() => {
      dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    });
    expect(dismissed).toHaveBeenCalledOnce();
    render(false);
    act(() => vi.advanceTimersByTime(150));
    expect(dialog.open).toBe(false);
    expect(document.documentElement.style.overflowY).toBe('auto');
  });
  it('keeps scrolling locked until the last stacked dialog closes', () => {
    const renderStack = (first: boolean, second: boolean) =>
      act(() =>
        root.render(
          createElement(
            'div',
            null,
            createElement(Modal, { open: first, onClose: dismissed, title: '첫 창', children: '첫 창 내용' }),
            createElement(Modal, {
              open: second,
              onClose: dismissed,
              title: '두 번째 창',
              children: '두 번째 내용',
            }),
          ),
        ),
      );
    document.documentElement.style.overflowY = 'auto';
    renderStack(true, true);
    renderStack(false, true);
    act(() => vi.advanceTimersByTime(150));
    expect(document.documentElement.style.overflowY).toBe('hidden');
    renderStack(false, false);
    act(() => vi.advanceTimersByTime(150));
    expect(document.documentElement.style.overflowY).toBe('auto');
  });
});
