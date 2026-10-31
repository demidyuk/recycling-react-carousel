import { useCallback, useRef } from 'react';
import type { MouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useIsomorphicLayoutEffect } from './useIsomorphicLayoutEffect.js';

export interface CarouselDrag {
  down: boolean;
  movement: number;
  direction: number;
  velocity?: number;
  canceled?: boolean;
  source?: 'drag' | 'wheel';
  /** Per-event movement for wheel streams, which already contain device inertia. */
  delta?: number;
}

interface DragOptions {
  enabled: boolean;
  vertical: boolean;
  onDrag: (drag: CarouselDrag) => void;
  onStart?: () => void;
}

interface PointerSession {
  id: number;
  element: HTMLElement;
  x: number;
  y: number;
  last: number;
  movedAt: number;
  directionPosition: number;
  direction: number;
  intentional: boolean;
  samples: { position: number; time: number }[];
  dispose: () => void;
}

const DIRECTION_TIMEOUT_MS = 100;
const INTENT_THRESHOLD_PX = 3;

/** Pointer input, axis intent and click filtering for a single carousel axis. */
export function useCarouselDrag(options: DragOptions) {
  const committed = useRef(options);
  const session = useRef<PointerSession | null>(null);
  const suppressClick = useRef(false);

  const cancel = useCallback((notify = false) => {
    const pointer = session.current;
    if (!pointer) return;
    session.current = null;
    pointer.dispose();
    if (pointer.element.hasPointerCapture?.(pointer.id))
      pointer.element.releasePointerCapture(pointer.id);
    if (notify && pointer.intentional)
      committed.current.onDrag({
        down: false,
        movement: pointer.last,
        direction: pointer.direction,
        canceled: true,
      });
  }, []);

  useIsomorphicLayoutEffect(() => {
    const previous = committed.current;
    committed.current = options;
    if (
      previous.enabled !== options.enabled ||
      previous.vertical !== options.vertical
    )
      cancel(true);
  });
  useIsomorphicLayoutEffect(() => () => cancel(), [cancel]);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.isPrimary === false) {
        cancel(true);
        return;
      }
      if (event.defaultPrevented || event.button !== 0 || session.current)
        return;
      // A fresh press ends suppression even when its target cannot start a drag.
      suppressClick.current = false;
      const target = event.target as Element;
      if (
        target.closest?.(
          'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [data-carousel-no-drag]'
        )
      )
        return;
      if (!committed.current.enabled) return;
      committed.current.onStart?.();
      const element = event.currentTarget;
      const document = element.ownerDocument;
      const view = document.defaultView;
      const pointer: PointerSession = {
        id: event.pointerId,
        element,
        x: event.clientX,
        y: event.clientY,
        last: 0,
        movedAt: 0,
        directionPosition: 0,
        direction: 0,
        intentional: false,
        samples: [{ position: 0, time: performance.now() }],
        dispose: () => {},
      };
      session.current = pointer;
      const move = (event: PointerEvent) => {
        if (event.pointerId !== pointer.id || session.current !== pointer)
          return;
        const vertical = committed.current.vertical;
        const primary = vertical
          ? event.clientY - pointer.y
          : event.clientX - pointer.x;
        const cross = vertical
          ? event.clientX - pointer.x
          : event.clientY - pointer.y;
        if (!pointer.intentional) {
          if (
            Math.max(Math.abs(primary), Math.abs(cross)) < INTENT_THRESHOLD_PX
          )
            return;
          if (Math.abs(cross) > Math.abs(primary)) {
            cancel();
            return;
          }
          pointer.intentional = true;
          suppressClick.current = true;
          element.setPointerCapture?.(pointer.id);
        }
        const now = performance.now();
        if (pointer.direction && now - pointer.movedAt > DIRECTION_TIMEOUT_MS) {
          pointer.direction = 0;
          pointer.directionPosition = pointer.last;
        }
        const delta = primary - pointer.directionPosition;
        // Accumulate small events into meaningful motion, ignoring lift jitter.
        if (Math.abs(delta) >= INTENT_THRESHOLD_PX) {
          if (pointer.direction && pointer.direction !== Math.sign(delta))
            pointer.samples = [
              { position: pointer.directionPosition, time: pointer.movedAt },
            ];
          pointer.direction = Math.sign(delta);
          pointer.directionPosition = primary;
          pointer.movedAt = now;
        }
        pointer.samples.push({ position: primary, time: now });
        while (
          pointer.samples.length > 1 &&
          pointer.samples[0].time < now - DIRECTION_TIMEOUT_MS
        )
          pointer.samples.shift();
        pointer.last = primary;
        committed.current.onDrag({
          down: true,
          movement: primary,
          direction: pointer.direction,
        });
      };
      const end = (event: PointerEvent) => {
        if (event.pointerId !== pointer.id || session.current !== pointer)
          return;
        const primary = committed.current.vertical
          ? event.clientY - pointer.y
          : event.clientX - pointer.x;
        if (pointer.intentional && primary !== pointer.last) {
          // The release can contain a final position with no preceding move.
          move(event);
          if (session.current !== pointer) return;
        }
        const intentional = pointer.intentional;
        // After a pause, snap by displacement. An old reversing delta (even
        // one pixel of finger jitter) must not veto a completed, stopped drag.
        const direction =
          performance.now() - pointer.movedAt > DIRECTION_TIMEOUT_MS
            ? 0
            : pointer.direction;
        const first = pointer.samples[0];
        const last = pointer.samples[pointer.samples.length - 1];
        const velocity =
          direction && last.time > first.time
            ? (last.position - first.position) / (last.time - first.time)
            : 0;
        cancel();
        if (intentional)
          committed.current.onDrag({
            down: false,
            movement: pointer.last,
            direction,
            velocity,
          });
      };
      const abort = (event: PointerEvent) => {
        if (event.pointerId === pointer.id) cancel(true);
      };
      // Implicit touch capture belongs to the pressed child until we take it.
      // Its bubbling loss event is not a loss of the carousel's own capture.
      const lostCapture = (event: PointerEvent) => {
        if (event.target === element) abort(event);
      };
      const blur = () => cancel(true);
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', end);
      document.addEventListener('pointercancel', abort);
      element.addEventListener('lostpointercapture', lostCapture);
      view?.addEventListener('blur', blur);
      pointer.dispose = () => {
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', end);
        document.removeEventListener('pointercancel', abort);
        element.removeEventListener('lostpointercapture', lostCapture);
        view?.removeEventListener('blur', blur);
      };
    },
    [cancel]
  );

  const onClickCapture = useCallback((event: MouseEvent<HTMLElement>) => {
    if (suppressClick.current && event.detail > 0) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, []);
  return {
    cancel,
    isPointerDown: () => session.current !== null,
    bind: { onPointerDown, onClickCapture },
  };
}
