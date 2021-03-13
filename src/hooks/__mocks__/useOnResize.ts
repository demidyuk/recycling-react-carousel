import React from 'react';

export function useOnResize(containerRef: React.RefObject<HTMLDivElement>) {
  const [size, setSize] = React.useState([0, 0]);
  React.useEffect(() => {
    if (!containerRef.current) {
      return;
    }
    setSize([window.innerWidth, window.innerHeight]);
  }, [containerRef]);
  return size;
}
