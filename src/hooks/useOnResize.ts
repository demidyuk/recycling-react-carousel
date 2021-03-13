import { useEffect, useState, useRef, RefObject } from 'react';

export function useOnResize(containerRef: RefObject<HTMLDivElement>) {
  const [size, setSize] = useState([0, 0]);
  const observeRef = useRef<ResizeObserver>();

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    observeRef.current = new ResizeObserver(() => {
      if (containerRef.current) {
        const { offsetWidth: w, offsetHeight: h } = containerRef.current;
        setSize([w, h]);
      }
    });

    observeRef.current.observe(containerRef.current);

    return () => observeRef.current?.disconnect();
  }, [observeRef, containerRef]);

  return size;
}
