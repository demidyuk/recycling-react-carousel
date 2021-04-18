import { useEffect, useState, useRef, RefObject } from 'react';

export function useOnResize(containerRef: RefObject<HTMLDivElement>) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const observeRef = useRef<ResizeObserver>();

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    observeRef.current = new ResizeObserver(() => {
      if (containerRef.current) {
        const {
          offsetWidth: width,
          offsetHeight: height,
        } = containerRef.current;
        setSize({ width, height });
      }
    });

    observeRef.current.observe(containerRef.current);

    return () => observeRef.current?.disconnect();
  }, [containerRef]);

  return size;
}
