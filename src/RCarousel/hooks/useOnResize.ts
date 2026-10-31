import { useCallback, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { useIsomorphicLayoutEffect } from './useIsomorphicLayoutEffect.js';

type Size = {
  width: number;
  height: number;
  /** Padding and borders needed when fitting content with border-box sizing. */
  contentBoxExtra?: { width: number; height: number };
};

type ObservedRef = RefObject<HTMLElement | null>;
type Measurement = Size & { ref: ObservedRef; key?: number };

export function useOnResize(
  staticRefs: ObservedRef[] = [],
  ignoreViewportHeight = false
) {
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const refs = useRef<ObservedRef[]>([...staticRefs]);
  const viewportRefs = useRef(new Set(staticRefs));
  const keys = useRef(new Map<ObservedRef, number>());
  const observerRef = useRef<ResizeObserver | null>(null);
  const viewportObserverRef = useRef<ResizeObserver | null>(null);
  const observedNodesRef = useRef(new Map<ObservedRef, HTMLElement>());
  const mountedRef = useRef(false);
  const measurementFrameRef = useRef<number | null>(null);

  const measure = useCallback(() => {
    if (!mountedRef.current) return;

    const viewportSize = (node: HTMLElement, axis: 'width' | 'height') => {
      if (
        !node.getClientRects().length &&
        !node.offsetWidth &&
        !node.offsetHeight
      )
        return 0;
      const style = node.ownerDocument.defaultView?.getComputedStyle(node);
      const sides = axis === 'width' ? ['left', 'right'] : ['top', 'bottom'];
      const border = sides.reduce(
        (sum, side) =>
          sum +
          (parseFloat(style?.getPropertyValue(`border-${side}-width`) ?? '') ||
            0),
        0
      );
      const used = style?.getPropertyValue(axis) ?? '';
      // offsetWidth/Height round away subpixels and include borders. Absolute
      // slide carriers instead use the viewport's untransformed padding box.
      if (used.endsWith('px')) {
        const padding = sides.reduce(
          (sum, side) =>
            sum +
            (parseFloat(style?.getPropertyValue(`padding-${side}`) ?? '') || 0),
          0
        );
        return Math.max(
          0,
          parseFloat(used) +
            (style?.boxSizing === 'border-box' ? -border : padding)
        );
      }
      return Math.max(
        0,
        node[axis === 'width' ? 'offsetWidth' : 'offsetHeight'] - border
      );
    };

    const intrinsicSize = (node: HTMLElement, axis: 'width' | 'height') => {
      const parent = node.parentElement;
      const style = parent?.hasAttribute('data-carousel-measure')
        ? parent.ownerDocument.defaultView?.getComputedStyle(parent)
        : undefined;
      const sides = axis === 'width' ? ['Left', 'Right'] : ['Top', 'Bottom'];
      return (
        node[axis === 'width' ? 'offsetWidth' : 'offsetHeight'] +
        (style
          ? sides.reduce(
              (sum, side) =>
                sum +
                (parseFloat(
                  style.getPropertyValue(`padding-${side.toLowerCase()}`)
                ) || 0) +
                (parseFloat(
                  style.getPropertyValue(`border-${side.toLowerCase()}-width`)
                ) || 0),
              0
            )
          : 0)
      );
    };
    const contentBoxExtra = (node: HTMLElement) => {
      const style = node.ownerDocument.defaultView?.getComputedStyle(node);
      if (style?.boxSizing !== 'border-box') return;
      const side = (name: string) =>
        (parseFloat(style.getPropertyValue(`padding-${name}`)) || 0) +
        (parseFloat(style.getPropertyValue(`border-${name}-width`)) || 0);
      const width = side('left') + side('right');
      const height = side('top') + side('bottom');
      return width || height ? { width, height } : undefined;
    };
    const next = refs.current.flatMap((ref) =>
      ref.current
        ? [
            {
              ref,
              key: keys.current.get(ref),
              width: viewportRefs.current.has(ref)
                ? viewportSize(ref.current, 'width')
                : intrinsicSize(ref.current, 'width'),
              height: viewportRefs.current.has(ref)
                ? ignoreViewportHeight
                  ? 0
                  : viewportSize(ref.current, 'height')
                : intrinsicSize(ref.current, 'height'),
              contentBoxExtra: viewportRefs.current.has(ref)
                ? contentBoxExtra(ref.current)
                : undefined,
            },
          ]
        : []
    );
    setMeasurements((previous) =>
      previous.length === next.length &&
      previous.every(
        ({ ref, key, width, height, contentBoxExtra }, index) =>
          ref === next[index].ref &&
          key === next[index].key &&
          width === next[index].width &&
          height === next[index].height &&
          contentBoxExtra?.width === next[index].contentBoxExtra?.width &&
          contentBoxExtra?.height === next[index].contentBoxExtra?.height
      )
        ? previous
        : next
    );
  }, [ignoreViewportHeight]);

  const cancelMeasurement = useCallback(() => {
    if (measurementFrameRef.current === null) return;
    globalThis.cancelAnimationFrame?.(measurementFrameRef.current);
    measurementFrameRef.current = null;
  }, []);

  const scheduleMeasurement = useCallback(() => {
    if (!mountedRef.current || measurementFrameRef.current !== null) return;
    if (typeof globalThis.requestAnimationFrame !== 'function') {
      measure();
      return;
    }
    measurementFrameRef.current = globalThis.requestAnimationFrame(() => {
      measurementFrameRef.current = null;
      measure();
    });
  }, [measure]);

  const refresh = useCallback(() => {
    cancelMeasurement();
    measure();
  }, [cancelMeasurement, measure]);

  const update = useCallback(() => {
    const observer = observerRef.current;
    observer?.disconnect();
    viewportObserverRef.current?.disconnect();
    observedNodesRef.current.clear();
    refs.current.forEach((ref) => {
      if (!ref.current) return;
      observedNodesRef.current.set(ref, ref.current);
      observer?.observe(ref.current);
      if (viewportRefs.current.has(ref))
        viewportObserverRef.current?.observe(ref.current, {
          box: 'border-box',
        });
    });
    refresh();
  }, [refresh]);

  const add = useCallback(
    (ref: ObservedRef, key?: number) => {
      const added = !refs.current.includes(ref);
      if (added) {
        refs.current.push(ref);
      }
      const keyChanged = keys.current.get(ref) !== key;
      if (key === undefined) keys.current.delete(ref);
      else keys.current.set(ref, key);
      const observedNode = observedNodesRef.current.get(ref);
      if (observedNode !== ref.current) {
        if (observedNode) observerRef.current?.unobserve(observedNode);
        if (observedNode) viewportObserverRef.current?.unobserve(observedNode);
        observedNodesRef.current.delete(ref);
      }
      if (ref.current && observedNode !== ref.current) {
        observedNodesRef.current.set(ref, ref.current);
        observerRef.current?.observe(ref.current);
        if (viewportRefs.current.has(ref))
          viewportObserverRef.current?.observe(ref.current, {
            box: 'border-box',
          });
      }
      if (added || keyChanged || observedNode !== ref.current)
        scheduleMeasurement();
    },
    [scheduleMeasurement]
  );

  const remove = useCallback(
    (ref: ObservedRef) => {
      const index = refs.current.indexOf(ref);
      if (index < 0) return;
      const observedNode = observedNodesRef.current.get(ref);
      if (observedNode) observerRef.current?.unobserve(observedNode);
      if (observedNode) viewportObserverRef.current?.unobserve(observedNode);
      observedNodesRef.current.delete(ref);
      keys.current.delete(ref);
      refs.current.splice(index, 1);
      scheduleMeasurement();
    },
    [scheduleMeasurement]
  );

  useIsomorphicLayoutEffect(() => {
    const observedNodes = observedNodesRef.current;
    mountedRef.current = true;
    if (typeof ResizeObserver !== 'undefined') {
      observerRef.current = new ResizeObserver(measure);
      // Padding can change either box while the other remains fixed. Watch
      // both so content-box and border-box viewports update without a render.
      if (viewportRefs.current.size)
        viewportObserverRef.current = new ResizeObserver(measure);
    }

    update();

    return () => {
      mountedRef.current = false;
      cancelMeasurement();
      observerRef.current?.disconnect();
      observerRef.current = null;
      viewportObserverRef.current?.disconnect();
      viewportObserverRef.current = null;
      observedNodes.clear();
    };
  }, [cancelMeasurement, measure, update]);

  const sizes = useMemo(
    () =>
      measurements.map(({ width, height, contentBoxExtra }) => ({
        width,
        height,
        ...(contentBoxExtra && { contentBoxExtra }),
      })),
    [measurements]
  );
  const sizesByKey = useMemo(() => {
    const result = new Map<number, Size>();
    for (const { key, width, height } of measurements) {
      if (key !== undefined) result.set(key, { width, height });
    }
    return result;
  }, [measurements]);

  return { add, remove, update, refresh, sizes, sizesByKey };
}
