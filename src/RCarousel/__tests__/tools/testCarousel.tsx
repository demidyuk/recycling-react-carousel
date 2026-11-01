import RCarousel, { type RCarouselProps } from '../../../index.js';

export function getTestSlides(count: number) {
  const items = Array.from(
    { length: count },
    (_, index) => `slide${index + 1}`
  );
  return items.map((item) => (
    <div key={item} data-testid={item}>
      {item}
    </div>
  ));
}

export function buildTestCarousel({
  baseProps = {},
  slidesCount = 3,
}: { baseProps?: RCarouselProps; slidesCount?: number } = {}) {
  const slides = getTestSlides(slidesCount);
  return {
    Component({ children, ...props }: RCarouselProps = {}) {
      return (
        <RCarousel {...baseProps} {...props}>
          {children ?? slides}
        </RCarousel>
      );
    },
  };
}
