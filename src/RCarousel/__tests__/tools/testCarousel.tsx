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
  baseProps = {} as RCarouselProps,
  slidesCount = 3,
} = {}) {
  const slides = getTestSlides(slidesCount);
  return {
    Component({ children, ...props }: any = {}) {
      return (
        <RCarousel {...baseProps} {...props}>
          {children || slides}
        </RCarousel>
      );
    },
  };
}
