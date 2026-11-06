// @vitest-environment jsdom
import { act, createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { AnimatedNumber, transitionUI } from '../src/ui/motion';
import { Tabs } from '../src/ui/kit';

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  window.matchMedia = vi
    .fn()
    .mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('applies an action immediately when reduced motion is requested', () => {
  const update = vi.fn();
  const start = vi.fn();
  Object.defineProperty(document, 'startViewTransition', { value: start, configurable: true });
  transitionUI(update);
  expect(update).toHaveBeenCalledOnce();
  expect(start).not.toHaveBeenCalled();
  delete document.documentElement.dataset.uiTransition;
});
it('keeps navigation working when the browser has no View Transition API', () => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false });
  Object.defineProperty(document, 'startViewTransition', { value: undefined, configurable: true });
  const update = vi.fn();
  transitionUI(update);
  expect(update).toHaveBeenCalledOnce();
});
it('shows the actual final amount without interpolation in reduced motion', () => {
  act(() => root.render(createElement(AnimatedNumber, { value: 2091606 })));
  expect(host.querySelector('[aria-hidden]')?.textContent).toBe('2,091,606');
  expect(host.querySelector('.sr-only')?.textContent).toBe('2,091,606');
  act(() => root.render(createElement(AnimatedNumber, { value: 3000000 })));
  expect(host.querySelector('[aria-hidden]')?.textContent).toBe('3,000,000');
});
it('preserves keyboard tab selection when the animated indicator is present', () => {
  function Harness() {
    const [value, setValue] = useState('a');
    return createElement(Tabs<string>, {
      tabs: [
        { value: 'a', label: '첫 탭' },
        { value: 'b', label: '두 번째 탭' },
      ],
      value,
      onChange: setValue,
    });
  }
  act(() => root.render(createElement(Harness)));
  const first = host.querySelector<HTMLButtonElement>('[role="tab"]')!;
  first.focus();
  act(() => {
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  });
  const selected = host.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')!;
  expect(selected.textContent).toBe('두 번째 탭');
  expect(document.activeElement).toBe(selected);
  expect(host.querySelector('.selection-indicator')?.getAttribute('aria-hidden')).toBe('true');
});
