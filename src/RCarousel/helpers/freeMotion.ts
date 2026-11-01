import type { CarouselBounds } from './carouselAlgorithm.js';

const SNAP_LOOKAHEAD_MS = 80;

/** Pixel-based coast projection, or a velocity lookahead for spring snapping. */
export function freeMotion(
  position: number,
  velocity: number,
  itemSize: number,
  bounds: CarouselBounds,
  animate: boolean,
  snap?: { step: number; origin: number }
) {
  const speed = animate ? Math.max(-3, Math.min(3, velocity)) : 0;
  const duration = Math.min(750, Math.abs(speed) / 0.004);
  let destination = Math.max(
    bounds.min,
    Math.min(
      bounds.max,
      position - (speed * (snap ? SNAP_LOOKAHEAD_MS : duration / 2)) / itemSize
    )
  );
  if (snap) {
    const reached = (destination - snap.origin) / snap.step;
    const stops = [Math.floor(reached), Math.ceil(reached)].map((step) =>
      Math.max(bounds.min, Math.min(bounds.max, snap.origin + step * snap.step))
    );
    destination =
      Math.abs(destination - stops[0]) < Math.abs(destination - stops[1])
        ? stops[0]
        : stops[1];
  }
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
