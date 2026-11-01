import React, {
  Children,
  Fragment,
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { CarouselViewport } from './CarouselViewport.js';
import type { ViewportState } from './CarouselViewport.js';
import { useIsomorphicLayoutEffect } from './hooks/useIsomorphicLayoutEffect.js';
import { getLocalIndex } from './helpers/getLocalIndex.js';
import {
  attachController,
  publishController,
  publishControllerStep,
  publishControllerMotion,
} from '../hooks/useCarousel.js';
import type {
  CarouselCommand,
  CarouselController,
} from '../hooks/useCarousel.js';
import {
  assertInteger,
  resolveAnimation,
  validateProps,
} from './helpers/configuration.js';
import { resolveCarouselLayout } from './helpers/layout.js';
import type {
  CarouselAnimation,
  CarouselBreakpoint,
  CarouselChangeDetails,
  CarouselChangeReason,
  CarouselDragMode,
  CarouselLength,
  CarouselNavigateDetails,
  CarouselSnapshot,
} from './apiTypes.js';

export type * from './apiTypes.js';

export interface RCarouselProps extends React.HTMLAttributes<HTMLDivElement> {
  items?: never;
  renderItem?: never;
  getItemKey?: never;
  axis?: 'horizontal' | 'vertical';
  /** forward-loop repeats at nonnegative absolute positions. */
  mode?: 'finite' | 'loop' | 'forward-loop';
  /** Keep the last start-aligned finite viewport full; defaults to true. */
  trimEnd?: boolean;
  /** Controlled local navigation anchor, independent of repetition cycles. */
  index?: number;
  /** Initial local index; later changes do not navigate. */
  defaultIndex?: number;
  /** Controlled global position, including repetition cycles. Cannot mix with local index props. */
  absoluteIndex?: number;
  /** Initial global position; later changes do not navigate. */
  defaultAbsoluteIndex?: number;
  /** A useCarousel() controller bound to one mounted carousel at a time. */
  controller?: CarouselController;
  /** Visible slide count >= 1, including fractions; auto calculates a whole count. */
  slidesPerView?: number | 'auto';
  /** Requires auto sizing. Percentages use the inner primary size after insets. */
  maxSlideSize?: CarouselLength;
  /** Number of slides moved by buttons and drag snapping. */
  slidesToScroll?: number;
  /** Nonnegative space between slides in pixels. */
  gap?: number;
  /** Primary-axis anchor alignment. Center keeps finite endpoints centered. */
  snapAlign?: 'start' | 'center';
  /** Inner alignment insets. Percentages use the outer primary viewport size. */
  insetStart?: CarouselLength;
  insetEnd?: CarouselLength;
  /** Minimum-width rules merge in ascending order over the base configuration. */
  breakpoints?: Record<number, CarouselBreakpoint>;
  /** Uses width even for vertical layouts; defaults to container. */
  breakpointsBase?: 'container' | 'window';
  drag?: boolean;
  /** Snap to slides (default), coast freely, or snap with release momentum. */
  dragMode?: CarouselDragMode;
  /** Enable wheel/trackpad input along the carousel axis. Horizontal carousels keep vertical page scrolling. */
  wheel?: boolean;
  /** Positive pixels or a percentage of one slide's content size, excluding gap. */
  swipeThreshold?: CarouselLength;
  /** Fit content by default; horizontal height follows motion. Vertical layouts need a definite height. */
  crossAxisSize?: 'content' | 'container';
  slideAlign?: 'stretch' | 'start' | 'center' | 'end';
  slideClassName?: string;
  /** Styles the content wrapper; use gap for spacing between slides. */
  slideStyle?: React.CSSProperties;
  /** Updated settings apply on the next animation start. Reduced motion skips animation. */
  animation?: CarouselAnimation;
  /** Receives a local index, including in loops; customize for localization. */
  getSlideLabel?: (index: number, count: number) => string;
  /** Requests a local index change; changing position props does not call it. */
  onIndexChange?: (index: number, details: CarouselChangeDetails) => void;
  /** Includes full-cycle moves that leave the local index unchanged. */
  onAbsoluteIndexChange?: (
    absoluteIndex: number,
    details: CarouselChangeDetails
  ) => void;
  /** State changes, excluding animation frames. */
  onStateChange?: (snapshot: CarouselSnapshot) => void;
  /** Navigation attempts from input or API, including blocked attempts. */
  onNavigate?: (details: CarouselNavigateDetails) => void;
  /** Runs when motion settles, including immediate moves. Skips mounting and interrupted targets. */
  onSettle?: (snapshot: CarouselSnapshot) => void;
}

export interface RCarouselItemsProps<T> extends Omit<
  RCarouselProps,
  'children' | 'items' | 'renderItem' | 'getItemKey'
> {
  children?: never;
  /** Reads items only for visible and buffered slides. */
  items: readonly T[];
  /** A pure renderer receiving the item and its local index. */
  renderItem: (item: T, index: number) => React.ReactNode;
  /** A stable, unique key within the collection. */
  getItemKey: (item: T, index: number) => React.Key;
}

// Keep forwardRef's static properties without tying React 18's propTypes and
// defaultProps to just the children overload.
interface RCarouselComponent extends Pick<
  React.ForwardRefExoticComponent<unknown>,
  keyof React.ForwardRefExoticComponent<unknown>
> {
  <T>(
    props: RCarouselItemsProps<T> & React.RefAttributes<HTMLDivElement>
  ): React.ReactElement | null;
  (
    props: RCarouselProps & React.RefAttributes<HTMLDivElement>
  ): React.ReactElement | null;
}

type CarouselProps = RCarouselProps | RCarouselItemsProps<unknown>;

const defaultAnimation: CarouselAnimation = {
  type: 'spring',
  tension: 170,
  friction: 26,
  mass: 1,
};
const defaultSlideLabel = (index: number, count: number) =>
  `${index + 1} of ${count}`;
const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/** Choose the nearest occurrence; forward wins ties. */
function nearestIndex(
  index: number,
  current: number,
  count: number,
  min: number,
  max: number
) {
  if (!count) return 0;
  const local = clamp(index, 0, count - 1);
  const cycle = Math.floor((current - local) / count);
  const candidates = [
    local + cycle * count,
    local + (cycle + 1) * count,
  ].filter((candidate) => candidate >= min && candidate <= max);
  return candidates.length
    ? candidates.reduce((best, candidate) =>
        Math.abs(candidate - current) <= Math.abs(best - current)
          ? candidate
          : best
      )
    : clamp(local, min, max);
}

/** A recycling carousel with local indexes and optional external navigation. */
export const RCarousel = /*#__PURE__*/ forwardRef(function RCarousel(
  props: CarouselProps,
  forwardedRef: React.ForwardedRef<HTMLDivElement>
) {
  validateProps(props);
  const {
    children,
    items,
    renderItem,
    getItemKey,
    axis = 'horizontal',
    mode = 'finite',
    index,
    defaultIndex,
    absoluteIndex,
    defaultAbsoluteIndex,
    controller,
    slidesPerView,
    maxSlideSize,
    slidesToScroll,
    gap = 0,
    snapAlign = 'start',
    insetStart = 0,
    insetEnd = 0,
    breakpoints,
    breakpointsBase = 'container',
    drag = true,
    dragMode = 'snap',
    wheel = false,
    crossAxisSize = 'content',
    slideAlign = 'stretch',
    slideClassName,
    slideStyle,
    animation,
    getSlideLabel = defaultSlideLabel,
    onIndexChange,
    onAbsoluteIndexChange,
    onStateChange,
    onNavigate,
    onSettle,
    trimEnd = true,
    swipeThreshold = 30,
    id: providedId,
    ...domProps
  } = props;
  const generatedId = useId();
  const id = providedId ?? `rcarousel-${generatedId}`;
  const normalizedChildren = useMemo(
    () => (items === undefined ? Children.toArray(children) : []),
    [children, items]
  );
  const childCount =
    items === undefined ? normalizedChildren.length : items.length;
  const getSlide = useCallback(
    (index: number) => {
      if (items !== undefined && renderItem && getItemKey) {
        const item = items[index];
        return (
          <Fragment key={getItemKey(item, index)}>
            {renderItem(item, index)}
          </Fragment>
        );
      }
      return normalizedChildren[index];
    },
    [getItemKey, items, normalizedChildren, renderItem]
  );
  const [internalPosition, setInternalPosition] = useState(
    () =>
      absoluteIndex ??
      defaultAbsoluteIndex ??
      clamp(index ?? defaultIndex ?? 0, 0, Math.max(childCount - 1, 0))
  );
  const [viewport, setViewport] = useState<ViewportState | null>(null);
  const [navigationRequest, requestAlignment] = useReducer(
    (value: number) => value + 1,
    0
  );
  const [, rerender] = useReducer((value: number) => value + 1, 0);
  const owner = useRef({});
  const pending = useRef<{ index: number; absoluteIndex: number } | null>(null);
  const controlledAbsolute = absoluteIndex;
  const current = viewport?.cursor ?? internalPosition;
  const min = viewport?.ready ? viewport.min : mode === 'loop' ? -Infinity : 0;
  const max = viewport?.ready
    ? viewport.max
    : mode !== 'finite'
      ? Infinity
      : Math.max(childCount - 1, 0);
  const requestedPosition =
    controlledAbsolute ??
    (index !== undefined
      ? pending.current?.index === index
        ? pending.current.absoluteIndex
        : getLocalIndex(current, childCount) === index
          ? current
          : nearestIndex(index, current, childCount, min, max)
      : internalPosition);

  const resolveLayout = useCallback(
    (containerWidth: number, windowWidth: number, primarySize: number) => {
      const options: CarouselBreakpoint = {
        slidesPerView: slidesPerView ?? 1,
        maxSlideSize,
        slidesToScroll: slidesToScroll ?? 1,
        gap,
        snapAlign,
        insetStart,
        insetEnd,
      };
      const width =
        breakpointsBase === 'container' ? containerWidth : windowWidth;
      for (const [minimum, overrides] of Object.entries(breakpoints ?? {}).sort(
        ([a], [b]) => Number(a) - Number(b)
      )) {
        if (width >= Number(minimum)) Object.assign(options, overrides);
      }
      return resolveCarouselLayout(options, primarySize);
    },
    [
      slidesPerView,
      maxSlideSize,
      slidesToScroll,
      gap,
      snapAlign,
      insetStart,
      insetEnd,
      breakpoints,
      breakpointsBase,
    ]
  );
  const resolvedMotion = useMemo(
    () => resolveAnimation(animation ?? defaultAnimation),
    [animation]
  );
  const resolvedStep = useRef(1);
  const receiveStep = useCallback(
    (step: number) => {
      resolvedStep.current = step;
      if (controller) publishControllerStep(controller, step);
    },
    [controller]
  );

  const receiveViewport = useCallback((next: ViewportState) => {
    setViewport((previous) =>
      previous &&
      Object.keys(next).every(
        (key) =>
          previous[key as keyof ViewportState] ===
          next[key as keyof ViewportState]
      )
        ? previous
        : next
    );
  }, []);
  const snapshot = useMemo<CarouselSnapshot>(() => {
    const position = viewport?.ready ? viewport.cursor : requestedPosition;
    return {
      index: getLocalIndex(position, childCount),
      absoluteIndex: position,
      slideCount: childCount,
      slidesPerView:
        viewport?.visibleCount ??
        (typeof slidesPerView === 'number' ? slidesPerView : 1),
      canPrev: Boolean(
        viewport?.ready &&
        childCount &&
        (position > viewport.min ||
          (dragMode !== 'snap' &&
            position === viewport.cursor &&
            viewport.freePosition > viewport.min))
      ),
      canNext: Boolean(
        viewport?.ready &&
        childCount &&
        (position < viewport.max ||
          (dragMode !== 'snap' &&
            position === viewport.cursor &&
            viewport.freePosition < viewport.snapLimit))
      ),
      isReady: viewport?.ready ?? false,
      isAnimating: viewport?.isMoving ?? false,
      absoluteBounds: viewport?.ready
        ? { min: viewport.min, max: viewport.max }
        : null,
    };
  }, [viewport, requestedPosition, childCount, slidesPerView, dragMode]);

  const committed = useRef<{
    snapshot: CarouselSnapshot;
    requestedPosition: number;
    controlled: boolean;
    localControlled: boolean;
    aligned: boolean;
    physicalPosition: number;
    onIndexChange: typeof onIndexChange;
    onAbsoluteIndexChange: typeof onAbsoluteIndexChange;
    onNavigate: typeof onNavigate;
  } | null>(null);
  useIsomorphicLayoutEffect(() => {
    committed.current = {
      snapshot,
      requestedPosition,
      controlled: controlledAbsolute !== undefined || index !== undefined,
      localControlled: index !== undefined,
      aligned: viewport?.aligned ?? true,
      physicalPosition:
        dragMode !== 'snap'
          ? (viewport?.freePosition ?? requestedPosition)
          : requestedPosition,
      onIndexChange,
      onAbsoluteIndexChange,
      onNavigate,
    };
    if (
      index !== undefined &&
      viewport?.ready &&
      getLocalIndex(requestedPosition, childCount) === index &&
      internalPosition !== requestedPosition
    )
      setInternalPosition(requestedPosition);
    pending.current = null;
  });

  const emitChange = useCallback(
    (position: number, reason: CarouselChangeReason) => {
      const state = committed.current;
      if (!state) return;
      const previousPosition = state.requestedPosition;
      const previousIndex = getLocalIndex(
        previousPosition,
        state.snapshot.slideCount
      );
      const nextIndex = getLocalIndex(position, state.snapshot.slideCount);
      const details = { index: nextIndex, absoluteIndex: position, reason };
      if (state.localControlled)
        pending.current = { index: nextIndex, absoluteIndex: position };
      if (
        !state.controlled ||
        (state.localControlled && nextIndex === previousIndex)
      ) {
        state.requestedPosition = position;
        setInternalPosition(position);
      } else rerender();
      if (
        nextIndex !== previousIndex ||
        reason === 'resize' ||
        reason === 'slides-change'
      )
        state.onIndexChange?.(nextIndex, details);
      if (
        position !== previousPosition ||
        reason === 'resize' ||
        reason === 'slides-change'
      )
        state.onAbsoluteIndexChange?.(position, details);
    },
    []
  );
  const correction = useCallback(
    (position: number, reason: 'resize' | 'slides-change') =>
      emitChange(position, reason),
    [emitChange]
  );
  const swipe = useCallback(
    (position: number, source: 'drag' | 'wheel' = 'drag') =>
      emitChange(position, source),
    [emitChange]
  );
  const attempt = useCallback(
    (
      direction: 'next' | 'prev',
      source: 'drag' | 'wheel' | 'api',
      target?: number,
      blocked?: boolean
    ) => {
      const state = committed.current;
      if (!state) return;
      const position = state.requestedPosition;
      const bounds = state.snapshot.absoluteBounds;
      const destination =
        target ??
        position + (direction === 'next' ? 1 : -1) * resolvedStep.current;
      const clamped = bounds
        ? clamp(destination, bounds.min, bounds.max)
        : position;
      state.onNavigate?.({
        direction,
        source,
        blocked:
          blocked ??
          (!state.snapshot.isReady ||
            !state.snapshot.slideCount ||
            (clamped === position && state.aligned)),
      });
      return clamped;
    },
    []
  );
  const dragNavigate = useCallback(
    (
      direction: 'next' | 'prev',
      destination: number,
      source: 'drag' | 'wheel' = 'drag',
      blocked?: boolean
    ) => {
      attempt(direction, source, destination, blocked);
    },
    [attempt]
  );
  const dispatch = useCallback(
    (command: CarouselCommand) => {
      const state = committed.current;
      if (!state?.snapshot.isReady || !state.snapshot.slideCount) return;
      const position = state.requestedPosition;
      const { slideCount, absoluteBounds } = state.snapshot;
      if (!absoluteBounds) return;
      if ('value' in command) assertInteger(command.value, command.type);
      let destination: number;
      switch (command.type) {
        case 'next':
          destination = position + resolvedStep.current;
          break;
        case 'prev':
          destination = position - resolvedStep.current;
          break;
        case 'moveBy':
          destination = position + command.value;
          break;
        case 'goTo':
          destination = nearestIndex(
            command.value,
            position,
            slideCount,
            absoluteBounds.min,
            absoluteBounds.max
          );
          break;
        case 'goToAbsolute':
          destination = command.value;
          break;
      }
      assertInteger(destination, 'absoluteIndex');
      if (destination === position && state.aligned) return;
      const target = attempt(
        destination > position ||
          (destination === position && destination > state.physicalPosition)
          ? 'next'
          : 'prev',
        'api',
        destination
      );
      if (target !== undefined && target !== position) {
        requestAlignment();
        emitChange(target, 'api');
      } else if (target === position && !state.aligned) requestAlignment();
    },
    [attempt, emitChange]
  );

  useIsomorphicLayoutEffect(() => {
    if (controller)
      return attachController(controller, owner.current, id, dispatch);
  }, [controller, id, dispatch]);
  useIsomorphicLayoutEffect(() => {
    // The child commits its resolved step before this effect, while the
    // viewport state update may still be queued until after ancestor effects.
    if (controller) {
      publishController(
        controller,
        snapshot,
        resolvedStep.current,
        viewport?.aligned ?? true
      );
      publishControllerMotion(controller);
    }
  });

  const previousNotification = useRef<CarouselSnapshot | null>(null);
  const settlement = useRef({
    position: requestedPosition,
    moving: false,
    ready: false,
  });
  useEffect(() => {
    const previous = previousNotification.current;
    if (
      !previous ||
      Object.keys(snapshot).some((key) =>
        key === 'absoluteBounds'
          ? previous.absoluteBounds?.min !== snapshot.absoluteBounds?.min ||
            previous.absoluteBounds?.max !== snapshot.absoluteBounds?.max
          : previous[key as keyof CarouselSnapshot] !==
            snapshot[key as keyof CarouselSnapshot]
      )
    ) {
      previousNotification.current = snapshot;
      onStateChange?.(snapshot);
    }
    const last = settlement.current;
    const settled =
      snapshot.isReady &&
      !snapshot.isAnimating &&
      viewport?.settledCursor === snapshot.absoluteIndex;
    if (
      settled &&
      last.ready &&
      (last.moving || last.position !== snapshot.absoluteIndex)
    )
      onSettle?.(snapshot);
    settlement.current = {
      position: settled ? snapshot.absoluteIndex : last.position,
      moving: snapshot.isAnimating || (!settled && last.moving),
      ready: last.ready || settled,
    };
  }, [snapshot, onStateChange, onSettle, viewport?.settledCursor]);

  return (
    <CarouselViewport
      {...domProps}
      ref={forwardedRef}
      axis={axis}
      mode={mode}
      id={id}
      role={domProps.role ?? 'group'}
      aria-roledescription={domProps['aria-roledescription'] ?? 'carousel'}
      cursor={requestedPosition}
      slideCount={childCount}
      getSlide={getSlide}
      resolveLayout={resolveLayout}
      onResolvedStep={receiveStep}
      drag={drag}
      dragMode={dragMode}
      motionController={controller}
      wheel={wheel}
      navigationRequest={navigationRequest}
      onFocusAlign={requestAlignment}
      crossAxisSize={crossAxisSize}
      slideAlign={slideAlign}
      slideClassName={slideClassName}
      slideStyle={slideStyle}
      motionConfig={resolvedMotion}
      trimEnd={trimEnd}
      swipeThreshold={swipeThreshold}
      getSlideLabel={getSlideLabel}
      onPositionRequest={swipe}
      onViewportCorrection={correction}
      onViewportState={receiveViewport}
      onDragNavigate={dragNavigate}
    />
  );
}) as RCarouselComponent;
