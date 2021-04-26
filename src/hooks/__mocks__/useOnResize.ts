import React from 'react';

export function useOnResize(containerRef: React.RefObject<HTMLDivElement>) {
  const [size, setSize] = React.useState({ width: 0, height: 0 });
  React.useEffect(() => {
    if (!containerRef.current) {
      return;
    }
    setSize({ width: window.innerWidth, height: window.innerHeight });
  }, [containerRef]);
  return size;
}
