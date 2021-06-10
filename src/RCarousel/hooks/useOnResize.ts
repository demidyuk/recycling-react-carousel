import { useEffect, useState, useRef, RefObject, useCallback } from 'react';

type Size = {
  width: number;
  height: number;
};

export function useOnResize(staticRefs: RefObject<HTMLElement | null>[] = []) {
  const [sizes, setSizes] = useState<Size[]>([]);
  const refs = useRef(staticRefs);
  const observeRef = useRef<ResizeObserver>(
    new ResizeObserver(() => {
      const nodes = refs.current
        .filter(({ current }) => current)
        .map(({ current }) => current) as HTMLElement[];

      setSizes(
        nodes.map(({ offsetWidth: width, offsetHeight: height }) => ({
          width,
          height,
        }))
      );
    })
  );

  const update = useCallback(() => {
    const ro = observeRef.current;
    ro.disconnect();
    refs.current.forEach(({ current: node }) => node && ro.observe(node));
  }, []);

  const add = useCallback((ref: RefObject<HTMLElement>) => {
    const ro = observeRef.current;
    ro.observe(ref.current as Element);
    refs.current.push(ref);
  }, []);

  const remove = useCallback((ref: RefObject<HTMLElement>) => {
    const ro = observeRef.current;
    const i = refs.current.indexOf(ref);
    if (~i) {
      ro.unobserve(refs.current[i].current as Element);
      refs.current.splice(i, 1);
    }
  }, []);

  useEffect(() => {
    const ro = observeRef.current;

    update();

    return () => ro.disconnect();
  }, [update]);

  return { add, remove, update, sizes };
}
