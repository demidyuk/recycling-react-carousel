import { vi } from 'vitest';
import type { useOnResize } from '../src/RCarousel/hooks/useOnResize.js';

type Size = { width: number; height: number };

/** Component layout stub; observer behavior is tested with the real resize hook. */
export function createCarouselLayout(
  sizes: Size[],
  sizesByKey = new Map<number, Size>()
): ReturnType<typeof useOnResize> {
  return {
    sizes,
    sizesByKey,
    add: vi.fn(),
    remove: vi.fn(),
    update: vi.fn(),
    refresh: vi.fn(),
  };
}
