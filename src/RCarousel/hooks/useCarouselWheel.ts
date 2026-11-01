import { useCallback, useRef } from 'react';
import type { RefObject } from 'react';
import type { CarouselDrag } from './useCarouselDrag.js';
import { useIsomorphicLayoutEffect } from './useIsomorphicLayoutEffect.js';

interface WheelOptions {
  enabled: boolean;
  vertical: boolean;
  canMove: (delta: number) => boolean;
  onDrag: (input: CarouselDrag) => void;
}

const handled = new WeakSet<WheelEvent>();
type WheelHandler = (event: WheelEvent) => void;
const documents = new WeakMap<
  Document,
  { roots: Map<EventTarget, WheelHandler>; listener: WheelHandler }
>();

function registerWheel(root: HTMLElement, handler: WheelHandler) {
  const document = root.ownerDocument;
  let registry = documents.get(document);
  if (!registry) {
    const roots = new Map<EventTarget, WheelHandler>();
    const listener = (event: WheelEvent) => {
      if (handled.has(event)) {
        event.preventDefault();
        return;
      }
      // DOM order, rather than effect registration order, owns nested input.
      for (const target of event.composedPath()) {
        roots.get(target)?.(event);
        if (handled.has(event)) break;
      }
    };
    registry = { roots, listener };
    documents.set(document, registry);
    document.addEventListener('wheel', listener, { passive: false });
  }
  registry.roots.set(root, handler);
  return () => {
    registry.roots.delete(root);
    if (!registry.roots.size) {
      document.removeEventListener('wheel', registry.listener);
      documents.delete(document);
    }
  };
}

/** Bridge React's passive wheel event to the non-passive native listener. */
export function cancelCarouselWheel(event: WheelEvent) {
  handled.add(event);
}

/** Trackpads supply their own inertia; only snap/settle after the stream stops. */
export function useCarouselWheel(
  ref: RefObject<HTMLElement | null> | undefined,
  options: WheelOptions
) {
  const committed = useRef(options);
  const session = useRef<{
    movement: number;
    direction: number;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const cancel = useCallback((notify = false) => {
    const current = session.current;
    if (!current) return;
    clearTimeout(current.timer);
    session.current = null;
    if (notify)
      committed.current.onDrag({
        down: false,
        movement: current.movement,
        direction: current.direction,
        velocity: 0,
        source: 'wheel',
      });
  }, []);
  useIsomorphicLayoutEffect(() => {
    committed.current = options;
  });
  useIsomorphicLayoutEffect(() => {
    const root = ref?.current;
    if (!options.enabled || !root) return;
    const wheel = (event: WheelEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey) return;
      const { vertical, canMove, onDrag } = committed.current;
      const primary = vertical
        ? event.deltaY
        : event.deltaX || (event.shiftKey ? event.deltaY : 0);
      const cross = vertical ? event.deltaX : event.shiftKey ? 0 : event.deltaY;
      if (
        !Number.isFinite(primary) ||
        !primary ||
        Math.abs(primary) < Math.abs(cross)
      )
        return;
      const target = event.composedPath()[0] as Element;
      if (!target || target.nodeType !== 1) return;
      if (
        target.closest?.(
          'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [data-carousel-no-wheel]'
        )
      )
        return;
      // A nested scroll area gets first use of an event it can actually scroll.
      for (
        let node = target;
        node && node !== root;
        node = node.parentElement!
      ) {
        const style = root.ownerDocument.defaultView?.getComputedStyle(node);
        const scrollable = vertical
          ? node.scrollHeight - node.clientHeight
          : node.scrollWidth - node.clientWidth;
        const position = vertical ? node.scrollTop : node.scrollLeft;
        if (
          /auto|scroll/.test(
            (vertical ? style?.overflowY : style?.overflowX) ?? ''
          ) &&
          (primary > 0 ? position < scrollable - 1 : position > 0)
        )
          return;
      }
      const delta =
        primary *
        (event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? vertical
              ? root.clientHeight
              : root.clientWidth
            : 1);
      if (!Number.isFinite(delta) || !canMove(delta)) return;
      handled.add(event);
      event.preventDefault();
      const movement = (session.current?.movement ?? 0) - delta;
      const direction = -Math.sign(delta);
      cancel();
      session.current = {
        movement,
        direction,
        timer: setTimeout(() => cancel(true), 120),
      };
      onDrag({
        down: true,
        movement,
        direction,
        delta: -delta,
        source: 'wheel',
      });
    };
    // React's delegated onWheel runs first, so consumers can cancel input.
    const unregister = registerWheel(root, wheel);
    const blur = () => cancel(true);
    root.ownerDocument.defaultView?.addEventListener('blur', blur);
    return () => {
      cancel();
      unregister();
      root.ownerDocument.defaultView?.removeEventListener('blur', blur);
    };
  }, [ref, options.enabled, cancel]);
  return cancel;
}
