import type { CarouselBounds } from './carouselAlgorithm.js';

/** Constant deceleration in pixels, independent of slide size or frame rate. */
export function freeMotion(
  position: number,
  velocity: number,
  itemSize: number,
  bounds: CarouselBounds,
  animate: boolean
) {
  const speed = animate ? Math.max(-3, Math.min(3, velocity)) : 0;
  const duration = Math.min(750, Math.abs(speed) / 0.004);
  const destination = Math.max(
    bounds.min,
    Math.min(bounds.max, position - (speed * duration) / (2 * itemSize))
  );
  const distance = Math.abs(destination - position);
  return {
    position: destination,
    duration:
      !animate || !distance
        ? 0
        : speed
          ? Math.min(duration, (2 * distance * itemSize) / Math.abs(speed))
          : 220,
  };
}
