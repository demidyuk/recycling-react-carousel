import { useCallback, useReducer, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { ScalarMotion, motionEnvironment } from '../motion/ScalarMotion.js';
import { freeMotion } from '../helpers/freeMotion.js';
import { useCarouselWheel } from './useCarouselWheel.js';
import type { RefObject } from 'react';
import type { MotionConfig } from '../motion/ScalarMotion.js';
import { useCarouselDrag } from './useCarouselDrag.js';
import type { CarouselDrag } from './useCarouselDrag.js';
import {
  createSlots,
  createProjection,
  decideSwipe,
  getDragAnchor,
  getDragBounds,
  projectSlide,
  rebaseProjection,
  reconcileCursor,
  requestCarouselMove,
  resistDrag,
  retargetProjection,
} from '../helpers/index.js';
import type {
  CarouselBounds,
  CursorChange,
  CarouselState,
} from '../helpers/index.js';
import { useIsomorphicLayoutEffect } from './useIsomorphicLayoutEffect.js';

const MAX_COMPRESSED_JUMP_DURATION_MS = 500;
const linear = (progress: number) => progress;
const compressedJumpEasing = (progress: number) => 1 - (1 - progress) ** 3;

interface UseCarouselControllerProps {
  cursor: number;
  slideCount: number;
  visibleCount: number;
  drag: boolean;
  dragMode?: 'snap' | 'free';
  wheel?: boolean;
  containerRef?: RefObject<HTMLElement | null>;
  navigationRequest?: number;
  ready: boolean;
  bounds: CarouselBounds;
  itemSize: number;
  /** Fraction of a movement step occupied by content, excluding its gap. */
  contentSpan: number;
  /** Outer viewport edges in slide-pitch coordinates relative to the anchor. */
  viewStart?: number;
  viewEnd?: number;
  /** Physical finite endpoint; can lie between integer navigation anchors. */
  snapLimit?: number;
  swipeThreshold: number;
  slidesToScroll?: number;
  y: boolean;
  motionConfig: MotionConfig;
  onDragNavigate: (
    direction: 'next' | 'prev',
    destination: number,
    source?: 'drag' | 'wheel',
    blocked?: boolean
  ) => void;
  onCursorRequest: (change: CursorChange) => void;
}

export function useCarouselController({
  cursor,
  slideCount,
  visibleCount,
  drag,
  dragMode = 'snap',
  wheel = false,
  containerRef,
  navigationRequest = 0,
  ready,
  bounds,
  itemSize,
  contentSpan,
  viewStart = 0,
  viewEnd = visibleCount - 1 + contentSpan,
  snapLimit = bounds.max,
  swipeThreshold,
  slidesToScroll,
  y,
  motionConfig,
  onDragNavigate,
  onCursorRequest,
}: UseCarouselControllerProps) {
  const [initialState] = useState<CarouselState>(() => ({
    cursor: Math.min(Math.max(cursor, bounds.min), bounds.max),
    requestedCursor: cursor,
    slideCount,
    ready,
  }));
  const stateRef = useRef(initialState);
  const unmeasuredStateRef = useRef<CarouselState | null>(
    ready ? null : { ...initialState, cursor }
  );
  // The spring moves a local grid. Its content can target any global cursor.
  const projectionRef = useRef(createProjection(initialState.cursor));
  const [animatedOffset] = useState(() => new ScalarMotion(0));
  const [windowCursor, setWindowCursor] = useState(0);
  const windowCursorRef = useRef(0);
  const contentWindowRef = useRef({ first: 0, last: visibleCount - 1 });
  const [isMoving, setIsMoving] = useState(false);
  const [settledCursor, setSettledCursor] = useState<number | null>(
    initialState.cursor
  );
  const draggingRef = useRef(false);
  const activeInputRef = useRef<'drag' | 'wheel' | null>(null);
  const dragOffsetRef = useRef(0);
  const dragOverflowRef = useRef(0);
  const dragAnchorRef = useRef(0);
  const dragDirectionRef = useRef(0);
  const dragTargetRef = useRef<{
    cursor: number;
    position: number;
    offset?: number;
    duration?: number;
  } | null>(null);
  const releasedGestureRef = useRef(false);
  const freeMotionRef = useRef(false);
  const settlementFrameRef = useRef<number | null>(null);
  const mountedRef = useRef(false);
  const committingRef = useRef(false);
  const reattachedRef = useRef(false);
  const hasCommittedRef = useRef(false);
  const motionConfigRef = useRef(motionConfig);
  const currentConfiguration = {
    slideCount,
    visibleCount,
    ready,
    itemSize,
    contentSpan,
    viewStart,
    viewEnd,
    snapLimit,
    y,
    drag,
    dragMode,
    wheel,
    navigationRequest,
    min: bounds.min,
    max: bounds.max,
  };
  const configurationRef = useRef(currentConfiguration);
  const [, requestReconciliation] = useReducer((value: number) => value + 1, 0);
  const {
    cancel: cancelDrag,
    isPointerDown,
    bind,
  } = useCarouselDrag({
    // Compressed jumps temporarily place nonadjacent screens side by side.
    // Resume pointer input once settlement restores a contiguous slide grid.
    enabled:
      drag && ready && slideCount > 0 && !projectionRef.current.retained.size,
    vertical: y,
    onDrag: handleDrag,
    onStart: () => {
      cancelWheel(true);
      if (
        dragMode === 'free' &&
        freeMotionRef.current &&
        !draggingRef.current
      ) {
        animatedOffset.stop();
        dragOffsetRef.current = animatedOffset.get();
        handleDrag({ down: false, movement: 0, direction: 0, velocity: 0 });
      }
    },
  });

  const cancelWheel = useCarouselWheel(containerRef, {
    enabled:
      wheel && ready && slideCount > 0 && !projectionRef.current.retained.size,
    vertical: y,
    canMove: (delta) => {
      if (isPointerDown()) return false;
      const edge = getDragBounds(projectionRef.current, {
        ...bounds,
        max: snapLimit,
      });
      const position = -animatedOffset.get();
      return delta > 0
        ? position < edge.max - 1e-10
        : position > edge.min + 1e-10;
    },
    onDrag: handleDrag,
  });

  const cancelSettlement = useCallback(() => {
    if (settlementFrameRef.current !== null) {
      globalThis.cancelAnimationFrame?.(settlementFrameRef.current);
      settlementFrameRef.current = null;
    }
  }, []);

  const updateWindow = useCallback(
    (synchronous: boolean) => {
      if (!mountedRef.current) return;
      const position = -animatedOffset.get();
      const {
        contentSpan: span,
        viewStart,
        viewEnd,
      } = configurationRef.current;
      const next = Math.floor(position + viewStart);
      // Gaps introduce content edges between the integer recycling boundaries.
      // Reconcile when an actual card enters or leaves, including overshoot.
      const first = Math.floor(position + viewStart - span) + 1;
      const last = Math.ceil(position + viewEnd) - 1;
      const contentChanged =
        first !== contentWindowRef.current.first ||
        last !== contentWindowRef.current.last;
      const windowChanged = next !== windowCursorRef.current;
      if (!windowChanged && !contentChanged) return;
      windowCursorRef.current = next;
      contentWindowRef.current = { first, last };
      const commit = () => {
        if (windowChanged) setWindowCursor(next);
        else requestReconciliation();
      };
      // The base index and its React child must commit atomically. Spring frames
      // flush only at recycling or content boundaries. Inside our layout commit
      // (including reduced motion), a normal update is already synchronous.
      if (synchronous && !committingRef.current) {
        flushSync(commit);
      } else {
        commit();
      }
    },
    [animatedOffset]
  );

  const settleMotion = useCallback(() => {
    if (!mountedRef.current || draggingRef.current) return;
    const projection = projectionRef.current;
    const config = configurationRef.current;
    const restOffset = freeMotionRef.current
      ? animatedOffset.get() + projection.position
      : Math.max(0, projection.cursor - config.snapLimit);
    if (
      freeMotionRef.current ||
      animatedOffset.get() === -projection.position + restOffset
    ) {
      projectionRef.current = rebaseProjection(
        projection,
        configurationRef.current.visibleCount
      );
      animatedOffset.set(restOffset);
      windowCursorRef.current = Math.floor(-restOffset + config.viewStart);
      contentWindowRef.current = {
        first:
          Math.floor(-restOffset + config.viewStart - config.contentSpan) + 1,
        last: Math.ceil(-restOffset + config.viewEnd) - 1,
      };
      setWindowCursor(windowCursorRef.current);
      requestReconciliation();
    }
    freeMotionRef.current = false;
    setIsMoving(false);
    setSettledCursor(stateRef.current.cursor);
  }, [animatedOffset]);

  const startMotion = useCallback(
    (offset: number, freeDuration?: number) => {
      cancelSettlement();
      freeMotionRef.current = freeDuration !== undefined;
      setIsMoving(true);
      setSettledCursor(null);
      animatedOffset.start(
        offset,
        {
          ...motionConfigRef.current,
          easing: motionConfigRef.current.easing ?? linear,
          ...(freeDuration !== undefined && {
            duration: freeDuration,
            easing: (progress: number) => 1 - (1 - progress) ** 2,
          }),
          // Skipped slides form a temporary seam, not a continuous spring path.
          // Leave it promptly without overshoot, even for heavy or undamped springs.
          ...(projectionRef.current.retained.size
            ? {
                duration: Math.min(
                  motionConfigRef.current.duration ??
                    MAX_COMPRESSED_JUMP_DURATION_MS,
                  MAX_COMPRESSED_JUMP_DURATION_MS
                ),
                easing: compressedJumpEasing,
              }
            : {}),
        },
        {
          onChange: () => updateWindow(true),
          onRest: () => {
            if (draggingRef.current) return;
            if (committingRef.current) {
              settleMotion();
              return;
            }
            settlementFrameRef.current = globalThis.requestAnimationFrame(
              () => {
                settlementFrameRef.current = null;
                // Rebase the content mapping, coordinates and ring rotation in
                // one commit, before another frame can paint the destination.
                flushSync(settleMotion);
              }
            );
          },
        }
      );
    },
    [animatedOffset, cancelSettlement, settleMotion, updateWindow]
  );

  const plan = (() => {
    const previous =
      ready && unmeasuredStateRef.current
        ? unmeasuredStateRef.current
        : stateRef.current;
    const reconciled = reconcileCursor(
      previous,
      cursor,
      slideCount,
      ready,
      bounds
    );
    const configuration = configurationRef.current;
    const cursorChanged = reconciled.state.cursor !== stateRef.current.cursor;
    // Appending finite items keeps the current grid and gesture intact. A new
    // repeating period, changed layout, or fractional terminal snap must rebase.
    const appending =
      slideCount > configuration.slideCount &&
      Number.isFinite(bounds.max) &&
      bounds.max > configuration.max &&
      bounds.min === configuration.min &&
      itemSize === configuration.itemSize &&
      contentSpan === configuration.contentSpan &&
      !cursorChanged &&
      !projectionRef.current.retained.size &&
      (draggingRef.current ||
        dragMode === 'free' ||
        cursor !== configuration.max ||
        configuration.snapLimit === configuration.max);
    const configurationChanged =
      (!appending &&
        (configuration.slideCount !== slideCount ||
          configuration.min !== bounds.min ||
          configuration.max !== bounds.max ||
          configuration.snapLimit !== snapLimit)) ||
      configuration.visibleCount !== visibleCount ||
      configuration.ready !== ready ||
      configuration.y !== y ||
      configuration.dragMode !== dragMode ||
      configuration.viewStart !== viewStart ||
      configuration.viewEnd !== viewEnd ||
      (isPointerDown() &&
        (configuration.itemSize !== itemSize ||
          configuration.contentSpan !== contentSpan));
    const relocate =
      configurationChanged ||
      !hasCommittedRef.current ||
      (!ready && cursorChanged);

    return {
      ...reconciled,
      appending,
      configurationChanged,
      inputChanged:
        configuration.drag !== drag || configuration.wheel !== wheel,
      commandChanged: configuration.navigationRequest !== navigationRequest,
      cursorChanged,
      relocate,
      slots: createSlots({
        projection: projectionRef.current,
        windowCursor,
        visibleCount,
        slideCount,
        bounds,
      }),
    };
  })();

  useIsomorphicLayoutEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      reattachedRef.current = true;
      cancelSettlement();
      animatedOffset.stop();
      draggingRef.current = false;
      cancelDrag();
      releasedGestureRef.current = false;
    };
  }, [animatedOffset, cancelDrag, cancelSettlement]);

  useIsomorphicLayoutEffect(() => {
    committingRef.current = true;
    try {
      if (!ready && !unmeasuredStateRef.current)
        unmeasuredStateRef.current = stateRef.current;
      else if (ready) unmeasuredStateRef.current = null;
      motionConfigRef.current = motionConfig;
      stateRef.current = plan.state;
      configurationRef.current = currentConfiguration;
      if (plan.commandChanged || (plan.cursorChanged && draggingRef.current)) {
        cancelDrag();
        cancelWheel();
        draggingRef.current = false;
        releasedGestureRef.current = false;
        dragTargetRef.current = null;
        activeInputRef.current = null;
      }
      if (!plan.configurationChanged && plan.inputChanged) {
        if (
          activeInputRef.current === 'wheel' &&
          !wheel &&
          draggingRef.current
        ) {
          cancelWheel();
          handleDrag({
            down: false,
            movement: (animatedOffset.get() - dragOffsetRef.current) * itemSize,
            direction: dragDirectionRef.current,
            velocity: 0,
            source: 'wheel',
          });
        }
        // A pointer cancellation can also have requested a new logical cursor.
        // Reconcile its fractional target only after that request has committed.
        if (releasedGestureRef.current) {
          requestReconciliation();
          return;
        }
      }
      if (plan.configurationChanged) {
        cancelDrag();
        cancelWheel();
        activeInputRef.current = null;
        draggingRef.current = false;
        releasedGestureRef.current = false;
        dragTargetRef.current = null;
      }
      if (plan.appending && draggingRef.current) {
        // Discard resistance at the old end so the next pointer event continues
        // from the displayed position instead of jumping to its raw overshoot.
        dragOffsetRef.current += dragOverflowRef.current;
        dragOverflowRef.current = 0;
      }
      if (plan.relocate || reattachedRef.current) {
        reattachedRef.current = false;
        freeMotionRef.current = false;
        cancelSettlement();
        projectionRef.current = createProjection(plan.state.cursor);
        const restOffset = Math.max(0, plan.state.cursor - snapLimit);
        animatedOffset.set(restOffset);
        windowCursorRef.current = Math.floor(-restOffset + viewStart);
        contentWindowRef.current = {
          first: Math.floor(-restOffset + viewStart - contentSpan) + 1,
          last: Math.ceil(-restOffset + viewEnd) - 1,
        };
        setWindowCursor(windowCursorRef.current);
        setIsMoving(false);
        setSettledCursor(plan.state.cursor);
        releasedGestureRef.current = false;
        requestReconciliation();
      } else if (
        !draggingRef.current &&
        (plan.cursorChanged ||
          releasedGestureRef.current ||
          plan.commandChanged)
      ) {
        releasedGestureRef.current = false;
        const current = projectionRef.current;
        const target = dragTargetRef.current;
        dragTargetRef.current = null;
        const acceptTarget =
          target?.cursor === plan.state.cursor &&
          target.cursor - target.position === current.cursor - current.position;
        const projection = acceptTarget
          ? { ...current, cursor: target.cursor, position: target.position }
          : retargetProjection(
              current,
              plan.state.cursor,
              -animatedOffset.get(),
              visibleCount,
              viewStart,
              viewEnd,
              contentSpan,
              Math.max(0, plan.state.cursor - snapLimit)
            );
        if (projection !== projectionRef.current) {
          projectionRef.current = projection;
          // Calculate from committed, actually visible geometry. A speculative
          // or suspended render must never change the live content mapping.
          requestReconciliation();
        }
        startMotion(
          acceptTarget && target.offset !== undefined
            ? target.offset
            : -projection.position + Math.max(0, projection.cursor - snapLimit),
          acceptTarget ? target.duration : undefined
        );
      }
      hasCommittedRef.current = true;
    } finally {
      committingRef.current = false;
    }
  });

  const reconcileToCursor = useCallback(() => {
    draggingRef.current = false;
    activeInputRef.current = null;
    releasedGestureRef.current = true;
    requestReconciliation();
  }, []);
  function releaseFree(
    position: number,
    velocity: number,
    movement: number,
    source: 'drag' | 'wheel'
  ) {
    const projection = projectionRef.current;
    const dragBounds = getDragBounds(projection, { ...bounds, max: snapLimit });
    const target = freeMotion(
      position,
      velocity,
      itemSize,
      dragBounds,
      motionConfigRef.current.duration !== 0 &&
        !motionEnvironment.reducedMotion()
    );
    const anchor = getDragAnchor(
      projection,
      target.position,
      bounds,
      snapLimit
    );
    const targetCursor = projectSlide(projection, anchor);
    dragTargetRef.current = {
      cursor: targetCursor,
      position: anchor,
      offset: -target.position,
      duration: target.duration,
    };
    const blocked = Math.abs(target.position + dragOffsetRef.current) < 1e-8;
    if (movement || !blocked)
      onDragNavigate(
        targetCursor > stateRef.current.cursor || movement < 0
          ? 'next'
          : 'prev',
        targetCursor,
        source,
        blocked
      );
    const request = requestCarouselMove(
      stateRef.current,
      targetCursor - stateRef.current.cursor,
      bounds
    );
    if (request) onCursorRequest({ ...request, reason: source });
    reconcileToCursor();
  }
  function handleDrag({
    down,
    movement,
    direction,
    velocity,
    canceled,
    source = 'drag',
    delta = 0,
  }: CarouselDrag) {
    if (canceled) {
      if (draggingRef.current) {
        if (dragMode === 'free')
          releaseFree(-animatedOffset.get(), 0, 0, source);
        else reconcileToCursor();
      }
      return;
    }
    if (!draggingRef.current && down) {
      activeInputRef.current = source;
      dragOffsetRef.current = animatedOffset.get();
      dragAnchorRef.current = isMoving
        ? getDragAnchor(
            projectionRef.current,
            -dragOffsetRef.current,
            bounds,
            snapLimit
          )
        : projectionRef.current.position;
      dragDirectionRef.current = 0;
    }
    if (down && direction) dragDirectionRef.current = direction;
    const projection = projectionRef.current;
    const dragBounds = getDragBounds(projection, { ...bounds, max: snapLimit });
    const rawPosition =
      source === 'wheel'
        ? -animatedOffset.get() - delta / itemSize
        : -dragOffsetRef.current - movement / itemSize;
    const position =
      source === 'wheel'
        ? Math.max(dragBounds.min, Math.min(dragBounds.max, rawPosition))
        : resistDrag(rawPosition, dragBounds);
    if (down)
      dragOverflowRef.current =
        source === 'drag' ? Math.max(0, rawPosition - position) : 0;
    if (dragMode === 'free' && !down) {
      releaseFree(
        position,
        source === 'wheel' ? 0 : (velocity ?? 0),
        movement,
        source
      );
      return;
    }

    const decision = decideSwipe({
      down,
      movement,
      direction: direction || dragDirectionRef.current,
      itemSize,
      threshold: swipeThreshold,
      visibleCount,
      slidesToScroll,
      position: position - dragAnchorRef.current,
      velocity,
      snapOffset: Math.max(
        0,
        projectSlide(projection, dragAnchorRef.current) - snapLimit
      ),
      ...(snapLimit !== bounds.max && {
        snapBounds: {
          min: dragBounds.min - dragAnchorRef.current,
          max: dragBounds.max - dragAnchorRef.current,
        },
      }),
    });
    if (decision.type === 'ignore') return;
    if (decision.type === 'drag') {
      draggingRef.current = true;
      cancelSettlement();
      setIsMoving(true);
      setSettledCursor(null);
      animatedOffset.set(-position, () => updateWindow(true));
      return;
    }
    if (decision.type === 'requestMove') {
      draggingRef.current = false;
      cancelDrag();
      const physicalTarget = Math.min(
        Math.max(dragAnchorRef.current + decision.step, dragBounds.min),
        dragBounds.max
      );
      // Only the terminal snap may sit between grid points. Map it back to its
      // integer anchor before resolving content or publishing navigation.
      const targetPosition = Math.ceil(physicalTarget - 1e-10);
      const targetCursor = projectSlide(projection, targetPosition);
      dragTargetRef.current = {
        cursor: targetCursor,
        position: targetPosition,
      };
      const step = targetCursor - stateRef.current.cursor;
      // A reversal can snap to the same slide. Edge attempts still notify.
      if (step || decision.step)
        onDragNavigate(
          (decision.step || -Math.sign(movement)) > 0 ? 'next' : 'prev',
          targetCursor,
          source
        );
      const request = requestCarouselMove(stateRef.current, step, bounds);
      if (request) onCursorRequest({ ...request, reason: source });
    }
    reconcileToCursor();
  }
  const renderedProjection = projectionRef.current;
  return {
    bind,
    settledCursor,
    cursor: plan.state.cursor,
    cursorCorrection: plan.cursorCorrection,
    slots: plan.slots,
    animatedOffset,
    projection: renderedProjection,
    isProjectionCurrent: () => projectionRef.current === renderedProjection,
    isMoving: isMoving || (plan.cursorChanged && !plan.relocate),
  };
}
