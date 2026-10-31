import '@testing-library/jest-dom/vitest';
import { motionEnvironment } from '../src/RCarousel/motion/ScalarMotion.js';
import { cleanup } from '@testing-library/react/pure';
import { afterEach, beforeEach, vi } from 'vitest';

beforeEach(() => {
  vi.spyOn(motionEnvironment, 'reducedMotion').mockReturnValue(true);
});

if (typeof MouseEvent !== 'undefined' && typeof PointerEvent === 'undefined') {
  class TestPointerEvent extends MouseEvent {
    pointerId: number;
    pointerType: string;
    isPrimary: boolean;

    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
      this.pointerType = init.pointerType ?? 'mouse';
      this.isPrimary = init.isPrimary ?? true;
    }
  }

  Object.defineProperty(globalThis, 'PointerEvent', {
    configurable: true,
    value: TestPointerEvent,
  });
}

if (typeof HTMLElement !== 'undefined') {
  Object.defineProperties(HTMLElement.prototype, {
    setPointerCapture: {
      configurable: true,
      value: () => {},
    },
    releasePointerCapture: {
      configurable: true,
      value: () => {},
    },
    hasPointerCapture: {
      configurable: true,
      value: () => true,
    },
  });
}

afterEach(() => {
  // Unmount while the test's observers, timers, and frame cancellation still exist.
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
