import React, { useRef } from 'react';
import { useIsomorphicLayoutEffect } from './hooks/index.js';

export interface SlideWrapperProps extends React.HTMLAttributes<HTMLElement> {
  measurementKey?: number;
  intrinsic?: boolean;
  measureWidth?: boolean;
  observer?: {
    add: (ref: React.RefObject<HTMLElement | null>, key?: number) => void;
    remove: (ref: React.RefObject<HTMLElement | null>) => void;
  };
}

const SlideWrapper = ({
  observer,
  measurementKey,
  intrinsic = false,
  measureWidth = false,
  children,
  ...props
}: SlideWrapperProps) => {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useIsomorphicLayoutEffect(() => {
    if (!wrapperRef.current || !observer) return;

    observer.add(wrapperRef, measurementKey);
    return () => observer.remove(wrapperRef);
  }, [intrinsic, measurementKey, observer]);

  return intrinsic ? (
    <div {...props} data-carousel-measure="">
      <div
        ref={wrapperRef}
        style={
          measureWidth ? { width: 'max-content', height: '100%' } : undefined
        }
      >
        {children}
      </div>
    </div>
  ) : (
    <div {...props} ref={wrapperRef}>
      {children}
    </div>
  );
};

export default SlideWrapper;
