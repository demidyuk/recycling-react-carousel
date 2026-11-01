import { useLayoutEffect } from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { useOnResize } from './useOnResize.js';

class TestResizeObserver {
  static instances: TestResizeObserver[] = [];

  readonly observe = vi.fn();
  readonly unobserve = vi.fn();
  readonly disconnect = vi.fn();

  constructor(private readonly callback: ResizeObserverCallback) {
    TestResizeObserver.instances.push(this);
  }

  resize() {
    this.callback([], this as unknown as ResizeObserver);
  }
}

const elementWithSize = (width: number, height: number) => {
  const element = document.createElement('div');
  Object.defineProperties(element, {
    offsetWidth: { configurable: true, value: width },
    offsetHeight: { configurable: true, value: height },
  });
  return element;
};

describe('useOnResize', () => {
  let frames: Map<number, FrameRequestCallback>;
  let nextFrame: number;

  const flushMeasurements = () => {
    const callbacks = [...frames.values()];
    frames.clear();
    act(() => callbacks.forEach((callback) => callback(performance.now())));
  };

  beforeEach(() => {
    TestResizeObserver.instances = [];
    frames = new Map();
    nextFrame = 0;
    vi.stubGlobal('ResizeObserver', TestResizeObserver);
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        const frame = ++nextFrame;
        frames.set(frame, callback);
        return frame;
      })
    );
    vi.stubGlobal(
      'cancelAnimationFrame',
      vi.fn((frame: number) => frames.delete(frame))
    );
  });

  test('measures, observes, adds, and removes element refs', () => {
    const firstRef = { current: elementWithSize(100, 40) };
    const secondRef = { current: elementWithSize(80, 60) };
    const { result, unmount } = renderHook(() => useOnResize([firstRef]));
    const observer = TestResizeObserver.instances[0];

    expect(result.current.sizes).toEqual([{ width: 100, height: 40 }]);
    expect(observer.observe).toHaveBeenCalledWith(firstRef.current);
    expect(TestResizeObserver.instances[1].observe).toHaveBeenCalledWith(
      firstRef.current,
      { box: 'border-box' }
    );

    act(() => result.current.add(secondRef));
    flushMeasurements();
    expect(result.current.sizes).toEqual([
      { width: 100, height: 40 },
      { width: 80, height: 60 },
    ]);

    act(() => result.current.remove(secondRef));
    expect(observer.unobserve).toHaveBeenCalledWith(secondRef.current);
    flushMeasurements();
    expect(result.current.sizes).toEqual([{ width: 100, height: 40 }]);

    unmount();
    expect(observer.disconnect).toHaveBeenCalled();
  });

  test('viewport measurements retain subpixels and exclude borders', () => {
    const element = elementWithSize(600, 320);
    Object.assign(element.style, {
      width: '599.6px',
      height: '319.6px',
      border: '12px solid',
      boxSizing: 'border-box',
      transform: 'scale(2)',
    });
    const { result } = renderHook(() => useOnResize([{ current: element }]));
    expect(result.current.sizes[0].width).toBeCloseTo(575.6);
    expect(result.current.sizes[0].height).toBeCloseTo(295.6);
    expect(result.current.sizes[0].contentBoxExtra).toEqual({
      width: 24,
      height: 24,
    });
  });

  test('animated viewport height does not publish frame updates, while content and width still resize', () => {
    const viewport = { current: elementWithSize(600, 200) };
    const content = { current: elementWithSize(600, 320) };
    const { result } = renderHook(() => useOnResize([viewport], true));
    act(() => result.current.add(content, 1));
    flushMeasurements();
    const previous = result.current.sizes;
    Object.defineProperty(viewport.current, 'offsetHeight', { value: 280 });
    act(() => TestResizeObserver.instances[0].resize());
    expect(result.current.sizes).toBe(previous);
    expect(result.current.sizesByKey.get(1)?.height).toBe(320);
    Object.defineProperty(viewport.current, 'offsetWidth', { value: 500 });
    Object.defineProperty(content.current, 'offsetHeight', { value: 400 });
    act(() => TestResizeObserver.instances[0].resize());
    expect(result.current.sizes[0]).toEqual({ width: 500, height: 0 });
    expect(result.current.sizesByKey.get(1)?.height).toBe(400);
  });

  test('content-box viewport measurements include padding without borders', () => {
    const element = elementWithSize(529, 340);
    Object.assign(element.style, {
      width: '500.5px',
      height: '320.25px',
      padding: '8px 12px',
      border: '2px solid',
      boxSizing: 'content-box',
    });
    const { result } = renderHook(() => useOnResize([{ current: element }]));
    expect(result.current.sizes[0]).toEqual({ width: 524.5, height: 336.25 });
  });

  test('a viewport without a layout box stays unmeasured despite explicit CSS dimensions', () => {
    const element = elementWithSize(0, 0);
    Object.assign(element.style, { width: '600px', height: '320px' });
    const { result } = renderHook(() => useOnResize([{ current: element }]));
    expect(result.current.sizes[0]).toEqual({ width: 0, height: 0 });
  });

  test('tracks border-box padding changes even when viewport dimensions do not change', () => {
    const element = elementWithSize(600, 320);
    Object.assign(element.style, {
      width: '600px',
      height: '320px',
      boxSizing: 'border-box',
    });
    const { result } = renderHook(() => useOnResize([{ current: element }]));
    expect(result.current.sizes[0].contentBoxExtra).toBeUndefined();
    document.body.appendChild(element);
    element.style.padding = '12px';
    act(() => TestResizeObserver.instances[0].resize());
    expect(result.current.sizes[0]).toEqual({
      width: 600,
      height: 320,
      contentBoxExtra: { width: 24, height: 24 },
    });
    element.remove();
  });

  test('falls back to one-time measurement without ResizeObserver', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    const ref = { current: elementWithSize(120, 30) };
    const { result } = renderHook(() => useOnResize([ref]));

    expect(result.current.sizes).toEqual([{ width: 120, height: 30 }]);
  });

  test('coalesces actor additions and removal of the tallest actor', () => {
    const containerRef = { current: elementWithSize(400, 0) };
    const tallRef = { current: elementWithSize(100, 180) };
    const shortRef = { current: elementWithSize(100, 60) };
    const { result } = renderHook(() => useOnResize([containerRef]));

    act(() => {
      result.current.add(tallRef);
      result.current.add(shortRef);
      result.current.add(shortRef);
    });
    expect(frames.size).toBe(1);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    flushMeasurements();
    expect(Math.max(...result.current.sizes.map(({ height }) => height))).toBe(
      180
    );

    act(() => result.current.remove(tallRef));
    flushMeasurements();
    expect(result.current.sizes).toEqual([
      { width: 400, height: 0 },
      { width: 100, height: 60 },
    ]);
  });

  test('keeps keyed sizes associated with their refs through removal and rekeying', () => {
    const tallRef = { current: elementWithSize(100, 180) };
    const shortRef = { current: elementWithSize(100, 60) };
    const { result } = renderHook(() => useOnResize());
    act(() => {
      result.current.add(tallRef, 7);
      result.current.add(shortRef, 2);
    });
    flushMeasurements();
    expect(result.current.sizesByKey.get(7)).toEqual({
      width: 100,
      height: 180,
    });
    act(() => result.current.add(tallRef, 9));
    flushMeasurements();
    expect(result.current.sizesByKey.has(7)).toBe(false);
    expect(result.current.sizesByKey.get(9)).toEqual({
      width: 100,
      height: 180,
    });
    Object.defineProperty(tallRef.current, 'offsetHeight', { value: 80 });
    act(() => TestResizeObserver.instances[0].resize());
    expect(result.current.sizesByKey.get(9)).toEqual({
      width: 100,
      height: 80,
    });
    act(() => result.current.remove(tallRef));
    flushMeasurements();
    expect([...result.current.sizesByKey]).toEqual([
      [2, { width: 100, height: 60 }],
    ]);
  });

  test('starts observation during layout rather than waiting for passive effects', () => {
    const ref = { current: elementWithSize(120, 30) };
    let observedDuringLayout = false;
    renderHook(() => {
      const result = useOnResize([ref]);
      useLayoutEffect(() => {
        observedDuringLayout =
          TestResizeObserver.instances[0]?.observe.mock.calls.some(
            ([node]) => node === ref.current
          ) ?? false;
      }, []);
      return result;
    });
    expect(observedDuringLayout).toBe(true);
  });

  test('refreshes immediately and cancels a queued measurement without reconnecting observation', () => {
    const ref = { current: elementWithSize(120, 320) };
    const { result } = renderHook(() => useOnResize());
    const observer = TestResizeObserver.instances[0];
    act(() => result.current.add(ref, 7));
    expect(frames.size).toBe(1);
    const observed = observer.observe.mock.calls.length;
    const disconnected = observer.disconnect.mock.calls.length;
    Object.defineProperty(ref.current, 'offsetHeight', { value: 120 });
    act(() => result.current.refresh());
    expect(frames.size).toBe(0);
    expect(result.current.sizesByKey.get(7)).toEqual({
      width: 120,
      height: 120,
    });
    expect(observer.observe).toHaveBeenCalledTimes(observed);
    expect(observer.disconnect).toHaveBeenCalledTimes(disconnected);
    const sizes = result.current.sizes;
    act(() => result.current.refresh());
    expect(result.current.sizes).toBe(sizes);
  });

  test('keeps the previous sizes object when measurements are unchanged', () => {
    const ref = { current: elementWithSize(120, 30) };
    const { result } = renderHook(() => useOnResize([ref]));
    const sizes = result.current.sizes;

    act(() => TestResizeObserver.instances[0].resize());
    expect(result.current.sizes).toBe(sizes);
    act(() => result.current.update());
    expect(result.current.sizes).toBe(sizes);
  });

  test('unobserves a removed node after its ref has been cleared', () => {
    const element = elementWithSize(120, 30);
    const ref: { current: HTMLElement | null } = { current: element };
    const { result } = renderHook(() => useOnResize([ref]));
    const observer = TestResizeObserver.instances[0];

    act(() => {
      ref.current = null;
      result.current.remove(ref);
    });
    expect(observer.unobserve).toHaveBeenCalledWith(element);
    flushMeasurements();
    expect(result.current.sizes).toEqual([]);
  });

  test('cancels pending measurements and ignores observer callbacks after unmount', () => {
    const readWidth = vi.fn(() => 120);
    const element = elementWithSize(120, 30);
    Object.defineProperty(element, 'offsetWidth', { get: readWidth });
    const ref = { current: element };
    const { result, unmount } = renderHook(() => useOnResize());
    const observer = TestResizeObserver.instances[0];

    act(() => result.current.add(ref));
    const pendingMeasurement = [...frames.values()][0];
    expect(frames.size).toBe(1);
    unmount();
    expect(frames.size).toBe(0);
    expect(cancelAnimationFrame).toHaveBeenCalledTimes(1);

    act(() => {
      pendingMeasurement(performance.now());
      observer.resize();
    });
    expect(readWidth).not.toHaveBeenCalled();
  });

  test('remeasures membership without ResizeObserver or animation frames', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    vi.stubGlobal('requestAnimationFrame', undefined);
    const ref = { current: elementWithSize(120, 30) };
    const { result } = renderHook(() => useOnResize());

    act(() => result.current.add(ref));
    expect(result.current.sizes).toEqual([{ width: 120, height: 30 }]);
    act(() => result.current.remove(ref));
    expect(result.current.sizes).toEqual([]);
  });

  test('restores observation after StrictMode effect replay', () => {
    const ref = { current: elementWithSize(120, 30) };
    const { result, unmount } = renderHook(() => useOnResize([ref]), {
      reactStrictMode: true,
    });
    expect(TestResizeObserver.instances).toHaveLength(4);
    expect(TestResizeObserver.instances[0].disconnect).toHaveBeenCalled();
    expect(TestResizeObserver.instances[1].disconnect).toHaveBeenCalled();
    expect(TestResizeObserver.instances[2].observe).toHaveBeenCalledWith(
      ref.current
    );
    expect(TestResizeObserver.instances[3].observe).toHaveBeenCalledWith(
      ref.current,
      { box: 'border-box' }
    );
    expect(result.current.sizes).toEqual([{ width: 120, height: 30 }]);

    unmount();
    expect(frames.size).toBe(0);
    expect(TestResizeObserver.instances[2].disconnect).toHaveBeenCalled();
    expect(TestResizeObserver.instances[3].disconnect).toHaveBeenCalled();
  });
});
