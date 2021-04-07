import React from 'react';
import RCarousel, { RCarouselProps } from '../..';

export function getTestSlides(count: number) {
  const items = Array(count)
    .fill(undefined)
    .map((_, i) => `slide${i + 1}`);
  return items.map((item) => (
    <div key={item} data-testid={item}>
      {item}
    </div>
  ));
}

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
} = {}) {
  const slides = getTestSlides(slidesCount);
  return {
    Component({ children, ...props }: any = {}) {
      return (
        <RCarousel
          {...{
            cursor,
            defaultCursor,
            maxItemSize,
            gestures,
            y,
            infinite,
            ...restProps,
          }}
          {...props}
        >
          {children || slides}
        </RCarousel>
      );
    },
  };
}
