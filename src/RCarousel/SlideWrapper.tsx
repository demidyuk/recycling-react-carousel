import React, { useLayoutEffect, useRef } from 'react';

export interface SlideWrapperProps extends React.HTMLAttributes<HTMLElement> {
  observer?: {
    add: (ref: React.RefObject<HTMLElement>) => void;
    remove: (ref: React.RefObject<HTMLElement>) => void;
  };
}

const SlideWrapper = ({ observer, children, ...props }: SlideWrapperProps) => {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!wrapperRef.current || !observer) return;

    observer.add(wrapperRef);
    return () => observer.remove(wrapperRef);
  }, [observer]);

  return (
    <div {...props} ref={wrapperRef}>
      {children}
    </div>
  );
};

export default SlideWrapper;
