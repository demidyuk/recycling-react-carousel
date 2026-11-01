import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { useWindowWidth } from './useWindowWidth.js';

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('innerWidth', 640);
});

test('publishes the latest width after a 60 ms quiet period', () => {
  const { result, unmount } = renderHook(() => useWindowWidth());
  expect(result.current).toBe(640);

  act(() => {
    vi.stubGlobal('innerWidth', 800);
    window.dispatchEvent(new Event('resize'));
    vi.advanceTimersByTime(40);
  });
  expect(result.current).toBe(640);

  act(() => {
    vi.stubGlobal('innerWidth', 1024);
    window.dispatchEvent(new Event('resize'));
    vi.advanceTimersByTime(59);
  });
  expect(result.current).toBe(640);
  act(() => vi.advanceTimersByTime(1));
  expect(result.current).toBe(1024);
  unmount();
});

test('cancels pending work and removes the resize listener on unmount', () => {
  const { unmount } = renderHook(() => useWindowWidth());
  act(() => window.dispatchEvent(new Event('resize')));
  expect(vi.getTimerCount()).toBe(1);

  unmount();
  expect(vi.getTimerCount()).toBe(0);
  window.dispatchEvent(new Event('resize'));
  expect(vi.getTimerCount()).toBe(0);
});
