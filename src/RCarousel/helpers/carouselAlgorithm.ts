import type { CarouselChangeReason } from '../apiTypes.js';
import { getLocalIndex } from './getLocalIndex.js';

export interface CarouselState {
  cursor: number;
  requestedCursor: number;
  slideCount: number;
  ready: boolean;
}

export interface CarouselBounds {
  min: number;
  max: number;
}

export interface SlotPlan {
  /** Stable identity of the DOM actor backed by this slot. */
  slotIndex: number;
  globalSlideIndex: number;
  /** Visual position relative to the destination screen. */
  position: number;
  /** Integer coordinate on the spring's local visual grid. */
  basePosition: number;
  renderable: boolean;
}

export interface CursorChange {
  cursor: number;
  reason: CarouselChangeReason;
}

/** Content mapping for a local visual grid, independent of the global cursor. */
export interface CarouselProjection {
  cursor: number;
  position: number;
  phase: number;
  retained: ReadonlyMap<number, number>;
}

export function createProjection(cursor: number): CarouselProjection {
  return { cursor, position: 0, phase: 0, retained: new Map() };
}

export function projectSlide(projection: CarouselProjection, position: number) {
  return (
    projection.retained.get(position) ??
    projection.cursor + (position - projection.position)
  );
}

export function retargetProjection(
  projection: CarouselProjection,
  cursor: number,
  visiblePosition: number,
  visibleCount: number,
  viewStart = 0,
  viewEnd = visibleCount,
  contentSpan = 1,
  targetOffset = 0
): CarouselProjection {
  const delta = cursor - projection.cursor;
  if (!delta) return projection;
  if (!projection.retained.size && Math.abs(delta) <= visibleCount) {
    return { ...projection, cursor, position: projection.position + delta };
  }
  // Keep every partially visible slide attached to its physical carrier. Only
  // offscreen content may change when the next destination is placed nearby.
  const retained = new Map<number, number>();
  for (
    let position = Math.floor(visiblePosition + viewStart - contentSpan) + 1;
    position < Math.ceil(visiblePosition + viewEnd);
    position += 1
  ) {
    retained.set(position, projectSlide(projection, position));
  }
  let position =
    delta > 0
      ? Math.ceil(
          Math.ceil(visiblePosition + viewEnd) + targetOffset - viewStart
        )
      : Math.floor(
          Math.floor(visiblePosition + viewStart - contentSpan) +
            1 +
            targetOffset -
            viewEnd
        );
  // A reversal can target a screen that is still partly visible. Reuse its
  // carriers when the overlapping content fits, instead of adding a second copy.
  for (const [retainedPosition, slide] of retained) {
    const offset = slide - cursor;
    if (
      offset + contentSpan <= viewStart - targetOffset ||
      offset >= viewEnd - targetOffset
    )
      continue;
    const candidate = retainedPosition - offset;
    if (
      [...retained].every(
        ([p, index]) =>
          p + contentSpan <= candidate - targetOffset + viewStart ||
          p >= candidate - targetOffset + viewEnd ||
          index === cursor + (p - candidate)
      )
    ) {
      return { ...projection, cursor, position: candidate, retained };
    }
  }
  // If the mixed outgoing screen cannot be reused, matching incoming cards
  // must stay far enough away that both copies cannot be partly visible.
  const direction = Math.sign(delta);
  const minimumSeparation = Math.ceil(viewEnd - viewStart + contentSpan);
  let adjusted = true;
  while (adjusted) {
    adjusted = false;
    for (const [retainedPosition, slide] of retained) {
      const occurrence = position + (slide - cursor);
      const separation = occurrence - retainedPosition;
      const overlapStart = Math.max(occurrence, retainedPosition) - viewEnd;
      const overlapEnd =
        Math.min(occurrence, retainedPosition) + contentSpan - viewStart;
      const overlapOnPath =
        Math.max(
          overlapStart,
          Math.min(position - targetOffset, visiblePosition)
        ) <
        Math.min(
          overlapEnd,
          Math.max(position - targetOffset, visiblePosition)
        );
      if (!retained.has(occurrence) && overlapOnPath) {
        position += direction * minimumSeparation - separation;
        adjusted = true;
      }
    }
  }
  return { ...projection, cursor, position, retained };
}

/** Rotate the ring so rebasing coordinates does not remount visible children. */
export function rebaseProjection(
  projection: CarouselProjection,
  visibleCount: number
): CarouselProjection {
  return {
    cursor: projection.cursor,
    position: 0,
    phase: getLocalIndex(
      projection.phase + projection.position,
      visibleCount * 3
    ),
    retained: new Map(),
  };
}

export interface CarouselBoundsInput {
  slideCount: number;
  visibleCount: number;
  ready: boolean;
  mode: 'finite' | 'loop' | 'forward-loop';
  trimEnd: boolean;
}

export interface SwipeDecisionInput {
  down: boolean;
  movement: number;
  direction: number;
  itemSize: number;
  threshold: number;
  visibleCount: number;
  slidesToScroll?: number;
  /** Reached grid position relative to the nearest slide at grab time. */
  position?: number;
  /** Recent pointer velocity in pixels per millisecond. */
  velocity?: number;
  /** Physical endpoints relative to the gesture's integer anchor. */
  snapBounds?: CarouselBounds;
  /** Distance from the logical anchor to its earlier physical terminal snap. */
  snapOffset?: number;
}

export type SwipeDecision =
  | { type: 'drag'; offset: number }
  | { type: 'requestMove'; step: number }
  | { type: 'snapBack' }
  | { type: 'ignore' };

const THRESHOLD_EPSILON_PX = 1;
const SWIPE_VELOCITY_LOOKAHEAD_MS = 80;
const MAX_SWIPE_VELOCITY_BIAS_SLIDES = 0.25;
const MAX_EDGE_OVERSCROLL_SLIDES = 0.5;
const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const clampCursor = (cursor: number, bounds: CarouselBounds) =>
  clamp(cursor, bounds.min, bounds.max);

export function createCarouselBounds({
  slideCount,
  visibleCount,
  ready,
  mode,
  trimEnd,
}: CarouselBoundsInput): CarouselBounds {
  const endless =
    ready &&
    slideCount > 0 &&
    visibleCount > 0 &&
    slideCount >= visibleCount &&
    mode !== 'finite';
  const min = endless && mode === 'loop' ? -Infinity : 0;
  const originalMax = endless ? Infinity : Math.max(slideCount - 1, 0);
  const max = trimEnd
    ? clamp(
        Math.ceil(originalMax - Math.max(visibleCount - 1, 0) - 1e-10),
        0,
        Infinity
      )
    : originalMax;

  return {
    min,
    max,
  };
}

export function reconcileCursor(
  previous: CarouselState,
  cursor: number,
  slideCount: number,
  ready: boolean,
  bounds: CarouselBounds
): { state: CarouselState; cursorCorrection?: CursorChange } {
  let requestedCursor = cursor;
  let cursorCorrection: CursorChange | undefined;
  if (
    slideCount !== previous.slideCount &&
    cursor === previous.requestedCursor
  ) {
    const cycles = previous.slideCount
      ? Math.floor(previous.cursor / previous.slideCount)
      : 0;
    const localIndex = getLocalIndex(previous.cursor, previous.slideCount);
    const nextLocalIndex = Math.min(localIndex, Math.max(slideCount - 1, 0));
    const nextCursor = previous.slideCount
      ? cycles * slideCount + nextLocalIndex
      : previous.cursor;
    requestedCursor = Math.min(Math.max(nextCursor, bounds.min), bounds.max);
    if (
      requestedCursor !== previous.requestedCursor ||
      nextLocalIndex !== localIndex
    ) {
      cursorCorrection = {
        cursor: requestedCursor,
        reason: 'slides-change',
      };
    }
  }
  return {
    state: {
      cursor: Math.min(Math.max(requestedCursor, bounds.min), bounds.max),
      requestedCursor,
      slideCount,
      ready,
    },
    cursorCorrection,
  };
}

/** One visible range and one hidden range per side, independent of demand. */
export function createSlots({
  projection,
  windowCursor,
  visibleCount,
  slideCount,
  bounds,
}: {
  projection: CarouselProjection;
  windowCursor: number;
  visibleCount: number;
  slideCount: number;
  bounds: CarouselBounds;
}): SlotPlan[] {
  const slotCount = visibleCount * 3;
  const start = windowCursor - visibleCount;
  const renderMax = bounds.max === Infinity ? Infinity : slideCount - 1;
  return Array.from({ length: slotCount }, (_, slotIndex) => {
    const basePosition =
      start + getLocalIndex(slotIndex - projection.phase - start, slotCount);
    const globalSlideIndex = projectSlide(projection, basePosition);
    return {
      slotIndex,
      globalSlideIndex,
      position: basePosition - projection.position,
      basePosition,
      renderable:
        slideCount > 0 &&
        globalSlideIndex >= bounds.min &&
        globalSlideIndex <= renderMax,
    };
  });
}

export function requestCarouselMove(
  state: Pick<CarouselState, 'cursor'>,
  step: number,
  bounds: CarouselBounds
): CursorChange | undefined {
  const cursor = clampCursor(state.cursor + step, bounds);

  return cursor === state.cursor
    ? undefined
    : {
        cursor,
        reason: 'drag',
      };
}

export function decideSwipe({
  down,
  movement,
  direction,
  itemSize,
  threshold,
  visibleCount,
  slidesToScroll = 1,
  position = -movement / itemSize,
  velocity = 0,
  snapBounds,
  snapOffset = 0,
}: SwipeDecisionInput): SwipeDecision {
  if (
    itemSize <= 0 ||
    visibleCount <= 0 ||
    !Number.isFinite(itemSize) ||
    !Number.isFinite(movement)
  ) {
    return down ? { type: 'ignore' } : { type: 'snapBack' };
  }

  if (down) return { type: 'drag', offset: movement / itemSize };

  const distance = Math.abs(movement);
  const directionMatches =
    Math.sign(movement) === Math.sign(direction) || direction === 0;
  if (!distance || distance < threshold - THRESHOLD_EPSILON_PX)
    return { type: 'snapBack' };

  // A flick only biases the nearest stop; it never starts unbounded momentum.
  const bias = clamp(
    (-velocity * SWIPE_VELOCITY_LOOKAHEAD_MS) / itemSize,
    -MAX_SWIPE_VELOCITY_BIAS_SLIDES,
    MAX_SWIPE_VELOCITY_BIAS_SLIDES
  );
  const reached = position + bias;
  let step =
    Math.sign(reached) *
    Math.round(Math.abs(reached) / slidesToScroll) *
    slidesToScroll;
  if (snapBounds) {
    const lower = clamp(
      Math.floor(reached / slidesToScroll) * slidesToScroll,
      snapBounds.min,
      snapBounds.max
    );
    const upper = clamp(
      Math.ceil(reached / slidesToScroll) * slidesToScroll,
      snapBounds.min,
      snapBounds.max
    );
    const closest =
      Math.abs(reached - lower) < Math.abs(reached - upper) ? lower : upper;
    step = Math.ceil(closest - 1e-10);
  }
  if (
    !step &&
    directionMatches &&
    Math.sign(position + snapOffset) === -Math.sign(movement)
  )
    step = -Math.sign(movement) * slidesToScroll;
  return { type: 'requestMove', step: step || 0 };
}

/** Choose by physical snap distance when the final step is shorter than a slide. */
export function getDragAnchor(
  projection: CarouselProjection,
  position: number,
  bounds: CarouselBounds,
  snapLimit = bounds.max
) {
  if (snapLimit === bounds.max) return Math.round(position);
  const candidates = [Math.floor(position), Math.ceil(position)];
  if (Number.isFinite(bounds.max))
    candidates.push(projection.position + bounds.max - projection.cursor);
  let anchor = Math.round(position);
  let nearest = Infinity;
  for (const candidate of candidates) {
    const cursor = projectSlide(projection, candidate);
    if (cursor < bounds.min || cursor > bounds.max) continue;
    const physical = candidate - Math.max(0, cursor - snapLimit);
    const distance = Math.abs(position - physical);
    if (distance < nearest || (distance === nearest && candidate > anchor)) {
      anchor = candidate;
      nearest = distance;
    }
  }
  return anchor;
}

/** Translate finite limits onto the contiguous grid used by an active drag. */
export function getDragBounds(
  projection: CarouselProjection,
  bounds: CarouselBounds
): CarouselBounds {
  return {
    min: projection.position + bounds.min - projection.cursor,
    max: projection.position + bounds.max - projection.cursor,
  };
}

export function resistDrag(position: number, bounds: CarouselBounds) {
  const edge = clampCursor(position, bounds);
  const excess = position - edge;
  // Continuous at the edge, with at most half a slide of exposed empty space.
  return edge + excess / (1 + Math.abs(excess) / MAX_EDGE_OVERSCROLL_SLIDES);
}
