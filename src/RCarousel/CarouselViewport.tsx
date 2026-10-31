import React, {
  useEffect,
  useRef,
  useCallback,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from 'react';
import type { ScalarMotion, MotionConfig } from './motion/ScalarMotion.js';
import styles from './RCarousel.module.css';
import { invariant } from '../invariant.js';
import {
  useCarouselController,
  useIsomorphicLayoutEffect,
  useOnResize,
  useWindowWidth,
} from './hooks/index.js';
import {
  classNames,
  createCarouselBounds,
  getLocalIndex,
} from './helpers/index.js';
import type { SlotPlan } from './helpers/index.js';
import SlideWrapper from './SlideWrapper.js';

import { resolveLength } from './helpers/configuration.js';
import type { CarouselLength } from './apiTypes.js';
import type { CarouselChangeReason } from './apiTypes.js';
import type { CarouselLayout } from './helpers/layout.js';
import { interpolateSize } from './helpers/interpolateSize.js';
import { cancelCarouselWheel } from './hooks/useCarouselWheel.js';

// Consumers may observe input without replacing the handlers that keep the
// gesture controller in sync. A filtered drag click must not reach their code.
const mergeEventHandlers = (
  internal: React.HTMLAttributes<HTMLDivElement>,
  external: React.HTMLAttributes<HTMLDivElement>
) => {
  const merged = { ...external, ...internal };
  for (const key of Object.keys(internal)) {
    const name = key as keyof React.HTMLAttributes<HTMLDivElement>;
    const first = internal[name];
    const second = external[name];
    if (
      key.startsWith('on') &&
      typeof first === 'function' &&
      typeof second === 'function'
    ) {
      Object.assign(merged, {
        [key]: (event: React.SyntheticEvent<HTMLDivElement>) => {
          if (key === 'onPointerDown') {
            (second as (event: React.SyntheticEvent<HTMLDivElement>) => void)(
              event
            );
            if (!event.defaultPrevented && !event.isPropagationStopped())
              (first as (event: React.SyntheticEvent<HTMLDivElement>) => void)(
                event
              );
            return;
          }
          (first as (event: React.SyntheticEvent<HTMLDivElement>) => void)(
            event
          );
          if (!event.isPropagationStopped()) {
            (second as (event: React.SyntheticEvent<HTMLDivElement>) => void)(
              event
            );
          }
        },
      });
    }
  }
  return merged;
};

const CarouselActor = ({
  slot,
  animatedOffset,
  x,
  y,
  itemSize,
  gap,
  anchor,
  measurable,
  interactive,
  focusContainer,
  className,
  children,
  label,
}: {
  label?: string;
  slot: SlotPlan;
  animatedOffset: ScalarMotion;
  x: boolean;
  y: boolean;
  itemSize: string;
  gap: number;
  anchor: number;
  measurable: boolean;
  interactive: boolean;
  focusContainer: () => void;
  className: string;
  children: React.ReactNode;
}) => {
  const actorRef = useRef<HTMLDivElement>(null);
  useIsomorphicLayoutEffect(() => {
    const actor = actorRef.current;
    if (!actor) return;
    if (!interactive && actor.contains(actor.ownerDocument.activeElement)) {
      focusContainer();
    }
    // Set the native attribute directly: React 18 does not accept boolean
    // inert props, while React 19 does. Both must get the same browser behavior.
    actor.toggleAttribute('inert', !interactive);
  }, [focusContainer, interactive]);

  const transform = (offset: number) => {
    const position = slot.basePosition + offset;
    return `translate3d(${+x * position * 100}%, ${+y * position * 100}%, 0)`;
  };
  useIsomorphicLayoutEffect(() => {
    const actor = actorRef.current;
    if (!actor) return;
    const update = () => {
      actor.style.transform = transform(animatedOffset.get());
    };
    update();
    return animatedOffset.subscribe(update);
  });

  return (
    <div
      ref={actorRef}
      role="group"
      aria-roledescription="slide"
      aria-label={label}
      data-carousel-slide=""
      aria-hidden={!interactive || undefined}
      className={className}
      style={{
        [x ? 'width' : 'height']: itemSize,
        [x ? 'left' : 'top']: anchor,
        boxSizing: 'border-box',
        [x ? 'paddingRight' : 'paddingBottom']: gap,
        willChange: measurable ? 'transform' : 'auto',
        transform: transform(animatedOffset.get()),
      }}
    >
      {children}
    </div>
  );
};

export interface ViewportState {
  cursor: number;
  slideCount: number;
  visibleCount: number;
  step: number;
  ready: boolean;
  min: number;
  max: number;
  isMoving: boolean;
  settledCursor: number | null;
  freePosition: number;
  aligned: boolean;
  snapLimit: number;
}

interface ViewportProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'children'
> {
  slideCount: number;
  getSlide: (index: number) => React.ReactNode;
  cursor: number;
  slideStyle?: React.CSSProperties;
  slideClassName?: string;
  drag: boolean;
  dragMode: 'snap' | 'free';
  wheel: boolean;
  navigationRequest: number;
  onFocusAlign: () => void;
  axis?: 'horizontal' | 'vertical';
  mode?: 'finite' | 'loop' | 'forward-loop';
  swipeThreshold: CarouselLength;
  motionConfig: MotionConfig;
  trimEnd: boolean;
  crossAxisSize: 'content' | 'container';
  slideAlign: 'stretch' | 'start' | 'center' | 'end';
  onPositionRequest: (position: number, source?: 'drag' | 'wheel') => void;
  onDragNavigate: (
    direction: 'next' | 'prev',
    destination: number,
    source?: 'drag' | 'wheel',
    blocked?: boolean
  ) => void;
  resolveLayout: (
    containerWidth: number,
    windowWidth: number,
    primarySize: number
  ) => CarouselLayout;
  onResolvedStep?: (step: number) => void;
  onViewportState?: (state: ViewportState) => void;
  onViewportCorrection?: (
    cursor: number,
    reason: 'resize' | 'slides-change'
  ) => void;
  getSlideLabel?: (index: number, count: number) => string;
}

/** Internal viewport: numeric positions, one spring, and a bounded slide pool. */
export const CarouselViewport = /*#__PURE__*/ forwardRef(
  function CarouselViewport(
    {
      slideCount: childrenCount,
      getSlide,
      style,
      cursor,
      slideStyle,
      slideClassName,
      className,
      drag,
      dragMode,
      wheel,
      navigationRequest,
      onFocusAlign,
      axis = 'horizontal',
      mode = 'finite',
      swipeThreshold,
      trimEnd,
      motionConfig,
      crossAxisSize,
      slideAlign,
      onPositionRequest,
      onDragNavigate,
      resolveLayout,
      onResolvedStep,
      onViewportState,
      onViewportCorrection,
      getSlideLabel,
      onWheel,
      ...rest
    }: ViewportProps,
    forwardedRef: React.ForwardedRef<HTMLDivElement>
  ) {
    const WIDTH = 'width';
    const HEIGHT = 'height';
    const y = axis === 'vertical';
    const x = !y;
    const containerRef = useRef<HTMLDivElement>(null);
    useImperativeHandle(forwardedRef, () => containerRef.current!, []);
    const focusedSlideElementRef = useRef<HTMLElement | null>(null);
    const pendingFocusRef = useRef<HTMLElement | null>(null);
    const focusContainer = useCallback(() => {
      containerRef.current?.focus({ preventScroll: true });
      focusedSlideElementRef.current = null;
    }, []);
    const contentSized = crossAxisSize === 'content';
    const interpolateHeight = contentSized && x;
    // Our own height writes must not cause a React render on every motion frame.
    const { sizes, sizesByKey, add, remove, refresh } = useOnResize(
      [containerRef],
      interpolateHeight
    );
    const observer = useMemo(() => ({ add, remove }), [add, remove]);

    const containerPrimarySideLenPx = sizes[0]?.[x ? WIDTH : HEIGHT] ?? 0;

    const windowWidth = useWindowWidth();
    invariant(
      Number.isSafeInteger(cursor + childrenCount) &&
        Number.isSafeInteger(cursor - childrenCount),
      `cursor is not valid, got ${cursor}`
    );

    const layout = resolveLayout(
      sizes[0]?.width ?? 0,
      windowWidth,
      containerPrimarySideLenPx
    );
    const {
      count: visibleItemsCount,
      step: slidesToScroll,
      gap,
      size: itemSizePx,
      pitch: itemStepPx,
      ready,
      anchor,
    } = layout;
    const canDrag = drag && ready && childrenCount > 0;
    useIsomorphicLayoutEffect(() => {
      onResolvedStep?.(slidesToScroll);
    }, [slidesToScroll, onResolvedStep]);

    const threshold = resolveLength(
      swipeThreshold,
      itemSizePx,
      'swipeThreshold'
    );

    const itemSizePercents = visibleItemsCount ? 1 / visibleItemsCount : 0;
    const bounds = useMemo(
      () =>
        createCarouselBounds({
          slideCount: childrenCount,
          visibleCount: visibleItemsCount,
          ready,
          mode,
          trimEnd: trimEnd && !layout.centered,
        }),
      [childrenCount, mode, ready, trimEnd, visibleItemsCount, layout.centered]
    );
    const snapLimit =
      trimEnd && !layout.centered && Number.isFinite(bounds.max)
        ? Math.max(0, childrenCount - visibleItemsCount)
        : bounds.max;

    const onCursorRequest = useCallback(
      ({ cursor, reason }: { cursor: number; reason?: CarouselChangeReason }) =>
        onPositionRequest(cursor, reason === 'wheel' ? 'wheel' : 'drag'),
      [onPositionRequest]
    );
    const {
      bind,
      cursor: resolvedCursor,
      cursorCorrection,
      slots,
      animatedOffset,
      projection,
      isProjectionCurrent,
      isMoving,
      settledCursor,
    } = useCarouselController({
      cursor,
      slideCount: childrenCount,
      visibleCount: layout.poolCapacity,
      viewStart: layout.start,
      viewEnd: layout.end,
      snapLimit,
      ready,
      drag,
      dragMode,
      wheel,
      containerRef,
      navigationRequest,
      bounds,
      itemSize: itemStepPx,
      contentSpan: itemStepPx ? itemSizePx / itemStepPx : 1,
      swipeThreshold: threshold,
      slidesToScroll,
      y,
      motionConfig,
      onDragNavigate,
      onCursorRequest,
    });

    // A carrier can keep its ref and key while React replaces its content.
    // Refresh committed dimensions before paint, rather than waiting for RO.
    useIsomorphicLayoutEffect(() => {
      if (contentSized) refresh();
    });

    const freePosition =
      dragMode === 'free'
        ? projection.cursor - projection.position - animatedOffset.get()
        : 0;
    const aligned =
      dragMode !== 'free' ||
      Math.abs(freePosition - Math.min(resolvedCursor, snapLimit)) < 1e-8;
    useIsomorphicLayoutEffect(() => {
      onViewportState?.({
        cursor: resolvedCursor,
        slideCount: childrenCount,
        visibleCount: visibleItemsCount,
        step: slidesToScroll,
        ready,
        min: bounds.min,
        max: bounds.max,
        isMoving,
        settledCursor,
        freePosition,
        aligned,
        snapLimit,
      });
    }, [
      resolvedCursor,
      childrenCount,
      visibleItemsCount,
      slidesToScroll,
      ready,
      bounds.min,
      bounds.max,
      isMoving,
      settledCursor,
      onViewportState,
      freePosition,
      aligned,
      snapLimit,
    ]);

    // Include the remaining motion path so incoming content fits before it enters,
    // then shrink to the visible range once the outgoing slides leave.
    const visiblePosition = -animatedOffset.get();
    const targetPosition = isMoving ? -animatedOffset.goal : visiblePosition;
    const sizeStart = Math.min(visiblePosition, targetPosition) + layout.start;
    const slideSpan = itemStepPx ? itemSizePx / itemStepPx : 1;
    const sizeEnd = Math.max(visiblePosition, targetPosition) + layout.end;
    const measureWindow = (start: number, end: number) =>
      slots.reduce((maximum, slot) => {
        if (
          !slot.renderable ||
          slot.basePosition + slideSpan <= start ||
          slot.basePosition >= end
        )
          return maximum;
        return Math.max(
          maximum,
          sizesByKey.get(slot.slotIndex)?.[x ? HEIGHT : WIDTH] ?? 0
        );
      }, 0);

    const heightState = useRef<{
      projection: typeof projection;
      position: number;
      size: number;
      anchor?: { position: number; size: number };
    } | null>(null);
    const heightAtOffset = (offset: number) => {
      const previous = heightState.current;
      const compressed = projection.retained.size;
      const anchor =
        compressed && previous
          ? previous.projection === projection
            ? previous.anchor
            : { position: previous.position, size: previous.size }
          : undefined;
      const origin = projection.position - projection.cursor;
      // Retained outgoing endpoints can lie inside a compressed route. Only
      // the destination's own finite edge constrains that temporary grid.
      const min =
        compressed && projection.cursor !== bounds.min
          ? -Infinity
          : origin + bounds.min;
      const max =
        compressed && projection.cursor !== bounds.max
          ? Infinity
          : origin + snapLimit;
      return {
        projection,
        position: -offset,
        anchor,
        size: interpolateSize(
          -offset,
          min,
          max,
          (position) =>
            measureWindow(
              position + layout.start + 1e-10,
              position + layout.end - 1e-10
            ),
          anchor
        ),
      };
    };

    useIsomorphicLayoutEffect(() => {
      const container = containerRef.current;
      if (!interpolateHeight || !container) return;
      const update = () => {
        // A rebase changes the offset before React commits the matching slots.
        // Writing their old height even briefly can clamp the page's scroll.
        if (!isProjectionCurrent()) return;
        const state = heightAtOffset(animatedOffset.get());
        heightState.current = state;
        container.style.height = `${state.size + (sizes[0]?.contentBoxExtra?.height ?? 0)}px`;
      };
      update();
      return animatedOffset.subscribe(update);
    });

    const lastShiftNotification = useRef<string | null>(null);
    useEffect(() => {
      const correction =
        cursorCorrection ??
        (ready && cursor !== resolvedCursor
          ? { cursor: resolvedCursor }
          : undefined);
      if (!correction) {
        lastShiftNotification.current = null;
        return;
      }
      if (!ready && childrenCount > 0) return;

      const key = `${childrenCount}:${correction.cursor}:${cursor}:${bounds.min}:${bounds.max}`;
      if (lastShiftNotification.current !== key) {
        lastShiftNotification.current = key;
        onViewportCorrection?.(
          correction.cursor,
          cursorCorrection ? 'slides-change' : 'resize'
        );
      }
    }, [
      childrenCount,
      cursorCorrection,
      ready,
      cursor,
      resolvedCursor,
      bounds.min,
      bounds.max,
      onViewportCorrection,
    ]);

    useIsomorphicLayoutEffect(() => {
      const previousFocus = focusedSlideElementRef.current;
      const container = containerRef.current;
      if (
        container &&
        previousFocus &&
        !previousFocus.isConnected &&
        container.ownerDocument.activeElement === container.ownerDocument.body
      ) {
        focusContainer();
      }
    });

    useIsomorphicLayoutEffect(() => {
      const pending = pendingFocusRef.current;
      const container = containerRef.current;
      if (!pending || !container) return;
      if (!pending.isConnected) pendingFocusRef.current = null;
      else if (!isMoving && aligned && !pending.closest('[inert]')) {
        if (container.ownerDocument.activeElement === container)
          pending.focus({ preventScroll: true });
        pendingFocusRef.current = null;
      }
    });

    const inputProps = mergeEventHandlers(
      {
        ...bind,
        onWheel: (event) => {
          onWheel?.(event);
          if (event.defaultPrevented) cancelCarouselWheel(event.nativeEvent);
        },
        onDragStartCapture: (event) => {
          const target = event.target as Element;
          if (canDrag && target.closest?.('img, a')) event.preventDefault();
        },
        onFocusCapture: (event) => {
          focusedSlideElementRef.current =
            event.target === event.currentTarget
              ? null
              : (event.target as HTMLElement);
          const container = event.currentTarget;
          const target = event.target as HTMLElement;
          if (
            dragMode === 'free' &&
            !aligned &&
            !isMoving &&
            target !== container
          ) {
            const index = Array.from(container.children).findIndex((actor) =>
              actor.contains(target)
            );
            const viewport = container.getBoundingClientRect();
            const box = target.getBoundingClientRect();
            if (
              slots[index]?.globalSlideIndex === resolvedCursor &&
              (box.left + container.scrollLeft < viewport.left - 0.5 ||
                box.right + container.scrollLeft > viewport.right + 0.5 ||
                box.top + container.scrollTop < viewport.top - 0.5 ||
                box.bottom + container.scrollTop > viewport.bottom + 0.5)
            ) {
              pendingFocusRef.current = target;
              onFocusAlign();
            }
          }
        },
        onScroll: (event) => {
          if (dragMode === 'free' && event.target === event.currentTarget) {
            event.currentTarget.scrollLeft = 0;
            event.currentTarget.scrollTop = 0;
          }
        },
        onBlurCapture: (event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null))
            pendingFocusRef.current = null;
          // Clicking nonfocusable content or explicitly blurring can move focus
          // to body with no relatedTarget. Only retain a removed node so the
          // layout effect can recover focus lost during recycling.
          if (
            event.relatedTarget ||
            (event.target as HTMLElement).isConnected
          ) {
            focusedSlideElementRef.current = null;
          }
        },
      },
      rest
    );

    return (
      <div
        ref={containerRef}
        className={classNames([
          styles.container,
          dragMode === 'free' && styles.freeViewport,
          canDrag && (x ? styles.touchActionPanY : styles.touchActionPanX),
          styles.w100,
          !contentSized && styles.h100,
          className,
        ])}
        {...inputProps}
        tabIndex={rest.tabIndex ?? -1}
        style={{
          ...style,
          ...(contentSized && {
            [x ? HEIGHT : WIDTH]:
              (interpolateHeight
                ? heightAtOffset(animatedOffset.get()).size
                : measureWindow(sizeStart, sizeEnd)) +
              (sizes[0]?.contentBoxExtra?.[x ? HEIGHT : WIDTH] ?? 0),
          }),
        }}
      >
        {slots.map((slot) => {
          const child = slot.renderable
            ? getSlide(getLocalIndex(slot.globalSlideIndex, childrenCount))
            : undefined;

          return (
            <CarouselActor
              key={slot.slotIndex}
              slot={slot}
              animatedOffset={animatedOffset}
              x={x}
              y={y}
              itemSize={
                ready
                  ? `${itemStepPx}px`
                  : gap
                    ? `calc(${itemSizePercents * 100}% + ${gap / visibleItemsCount}px)`
                    : itemSizePercents * 100 + '%'
              }
              gap={gap}
              anchor={anchor}
              measurable={Boolean(containerPrimarySideLenPx)}
              interactive={
                ready &&
                !isMoving &&
                slot.renderable &&
                ((dragMode === 'free' &&
                  slot.globalSlideIndex === resolvedCursor) ||
                  (anchor +
                    (slot.basePosition + animatedOffset.get()) * itemStepPx >=
                    -0.5 &&
                    anchor +
                      (slot.basePosition + animatedOffset.get()) * itemStepPx +
                      itemSizePx <=
                      containerPrimarySideLenPx + 0.5))
              }
              label={
                slot.renderable
                  ? getSlideLabel?.(
                      getLocalIndex(slot.globalSlideIndex, childrenCount),
                      childrenCount
                    )
                  : undefined
              }
              focusContainer={focusContainer}
              className={classNames([
                styles.actor,
                x ? styles.h100 : styles.w100,
                styles.presentation,
                x ? styles.presentationHorizontal : styles.presentationVertical,
              ])}
            >
              <SlideWrapper
                measurementKey={slot.slotIndex}
                intrinsic={contentSized}
                measureWidth={y}
                observer={contentSized ? observer : undefined}
                style={slideStyle}
                className={classNames([
                  styles.childWrapper,
                  x ? styles.w100 : styles.h100,
                  slideAlign === 'stretch' && (x ? styles.h100 : styles.w100),
                  child === undefined && styles.displayNone,
                  slideAlign === 'center' &&
                    (x ? styles.alignCenterY : styles.alignCenterX),
                  slideAlign === 'end' &&
                    (x ? styles.alignEndY : styles.alignEndX),
                  slideClassName,
                ])}
              >
                {child}
              </SlideWrapper>
            </CarouselActor>
          );
        })}
      </div>
    );
  }
);
