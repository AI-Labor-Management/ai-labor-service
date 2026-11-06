// @vitest-environment jsdom
import { act, createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Field, Choice } from '../src/ui/kit';
import { AiQuestion } from '../src/ui/AiQuestion';
import { ServiceError } from '../src/adapters/api';
import { LocalStorageAdapter } from '../src/adapters/storage';
import { createEmptyState } from '../src/data/seed';
import { createMemoryRouter, Link, RouterProvider } from 'react-router';
import { UnsavedChanges } from '../src/ui/UnsavedChanges';
import { hasUnsavedForm, discardUnsavedForms } from '../src/ui/unsavedRegistry';
const { answer } = vi.hoisted(() => ({ answer: vi.fn() }));
vi.mock('../src/adapters/api', async (original) => ({
  ...(await original<typeof import('../src/adapters/api')>()),
  aiEnabled: true,
  askAi: answer,
}));
let root: Root, host: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  localStorage.clear();
  answer.mockReset();
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
it('associates field errors with their input and updates aria-invalid', () => {
  act(() =>
    root.render(
      createElement(Field, {
        label: '별칭',
        htmlFor: 'alias',
        error: '별칭이 필요해요',
        children: createElement('input', { id: 'alias' }),
      }),
    ),
  );
  const input = host.querySelector('input')!;
  expect(input.getAttribute('aria-invalid')).toBe('true');
  expect(document.getElementById(input.getAttribute('aria-describedby')!)?.textContent).toBe(
    '별칭이 필요해요',
  );
});
it('supports roving keyboard focus and selection in segmented radio choices', () => {
  function Harness() {
    const [value, setValue] = useState('a');
    return createElement(Choice<string>, {
      name: '선택',
      value,
      onChange: setValue,
      options: [
        { value: 'a', label: '처음' },
        { value: 'b', label: '다음' },
      ],
    });
  }
  act(() => root.render(createElement(Harness)));
  const a = host.querySelector<HTMLButtonElement>('[role="radio"]')!;
  a.focus();
  act(() => a.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
  expect(document.activeElement?.textContent).toBe('다음');
  expect(document.activeElement?.getAttribute('aria-checked')).toBe('true');
  expect(a.tabIndex).toBe(-1);
});
it('shows AI loading, a quota failure, and successful retry with cited evidence', async () => {
  let reject!: (error: unknown) => void;
  answer.mockImplementationOnce(
    () =>
      new Promise((_, r) => {
        reject = r;
      }),
  );
  await act(async () => root.render(createElement(AiQuestion, { question: '근무 관리', onExpert: vi.fn() })));
  await act(async () => host.querySelector('button')!.click());
  expect(host.textContent).toContain('근거를 찾고');
  await act(async () => reject(new ServiceError('DAILY_LIMIT', '오늘 한도', 429)));
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('오늘 한도');
  answer.mockResolvedValueOnce({
    status: 'answer',
    text: '출처가 있는 답변',
    citations: [{ title: '근거', url: 'https://example.org/evidence', checkedAt: '2026-11-06' }],
  });
  await act(async () => host.querySelector('button')!.click());
  expect(host.textContent).toContain('출처가 있는 답변');
  expect(host.querySelector('a')?.getAttribute('href')).toBe('https://example.org/evidence');
});
it('aborts an old question and ignores a late response after the question changes', async () => {
  let resolve!: (answer: unknown) => void;
  let signal!: AbortSignal;
  answer.mockImplementationOnce((_q, s) => {
    signal = s;
    return new Promise((r) => {
      resolve = r;
    });
  });
  await act(async () => root.render(createElement(AiQuestion, { question: '첫 질문', onExpert: vi.fn() })));
  await act(async () => host.querySelector('button')!.click());
  await act(async () => root.render(createElement(AiQuestion, { question: '둘째 질문', onExpert: vi.fn() })));
  expect(signal.aborted).toBe(true);
  await act(async () => resolve({ status: 'answer', text: '오래된 답변', citations: [] }));
  expect(host.textContent).not.toContain('오래된 답변');
});
it('does not overwrite another tab and retains the saved data after a conflict', async () => {
  const first = new LocalStorageAdapter(),
    second = new LocalStorageAdapter();
  await first.load();
  await second.load();
  const original = createEmptyState();
  original.seq = 1;
  await first.save(original);
  const stale = createEmptyState();
  stale.seq = 2;
  await expect(second.save(stale)).rejects.toThrow(/다른 창/);
  expect((await first.load())?.seq).toBe(1);
});
it('keeps unsaved input on cancelled navigation and leaves only after discard', async () => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: true });
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
  const bypass = { current: false };
  const router = createMemoryRouter([
    {
      path: '/',
      element: createElement(
        'div',
        null,
        createElement(UnsavedChanges, { when: true, bypass }),
        createElement(Link, { to: '/next' }, '다음'),
      ),
    },
    { path: '/next', element: createElement('p', null, '다음 화면') },
  ]);
  await act(async () => root.render(createElement(RouterProvider, { router })));
  await act(async () => host.querySelector('a')!.click());
  expect(host.querySelector('dialog')?.open).toBe(true);
  expect(router.state.location.pathname).toBe('/');
  await act(async () =>
    Array.from(host.querySelectorAll('button'))
      .find((b) => b.textContent === '계속 작성')!
      .click(),
  );
  expect(router.state.location.pathname).toBe('/');
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  expect(hasUnsavedForm()).toBe(true);
  await act(async () => host.querySelector('a')!.click());
  await act(async () =>
    Array.from(host.querySelectorAll('button'))
      .find((b) => b.textContent === '저장하지 않고 나가기')!
      .click(),
  );
  expect(router.state.location.pathname).toBe('/next');
  expect(hasUnsavedForm()).toBe(false);
  discardUnsavedForms();
  router.dispose();
});
