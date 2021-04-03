import React from 'react';
import RCarousel, { RCarouselProps } from '../..';

export function buildTestCarousel({
  baseProps: {
    cursor,
    defaultCursor = 0,
    maxItemSize = Number.MAX_VALUE,
    gestures = true,
    y = false,
    infinite = false,
    ...restProps
  } = {} as RCarouselProps,
  slidesCount = 3,
  prefix = 'slide',
} = {}) {
  const items = Array(slidesCount)
    .fill(undefined)
    .map((_, i) => `${prefix}${i + 1}`);
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
    prefix,
    matchPattern: new RegExp(prefix),
  };
}
