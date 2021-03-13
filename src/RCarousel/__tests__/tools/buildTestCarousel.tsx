import React from 'react';
import RCarousel from '../..';

export function buildTestCarousel({
  baseProps: {
    cursor = 0,
    maxItemSize = Number.MAX_VALUE,
    gestures = true,
    y = false,
    infinite = false,
    ...restProps
  } = {} as any,
  slidesCount = 3,
} = {}) {
  const items = Array(slidesCount)
    .fill(undefined)
    .map((_, i) => `slide ${i + 1}`);
  return {
    Component(props: any = {}) {
      return (
        <RCarousel
          {...{
            cursor,
            maxItemSize,
            gestures,
            y,
            infinite,
            ...restProps,
          }}
          {...props}
        >
          {items.map((item) => (
            <div key={item} data-testid={item}>
              {item}
            </div>
          ))}
        </RCarousel>
      );
    },
    items,
  };
}
