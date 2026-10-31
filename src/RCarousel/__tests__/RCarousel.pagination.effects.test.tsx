import { memo, useEffect, useLayoutEffect, useState } from 'react';
import { act, render } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import RCarousel, { useCarousel } from '../../index.js';
import type { CarouselController } from '../../index.js';
import { createCarouselLayout } from '../../../test-config/carouselLayout.js';
import { useOnResize as mockedResize } from '../hooks/useOnResize.js';
import { getTestSlides } from './tools/index.js';

vi.mock('../hooks/useOnResize.js');
const MemoCarousel = memo(RCarousel);
const slides = getTestSlides(8);
const breakpoints = { 800: { slidesToScroll: 3 } };

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('innerWidth', 600);
  vi.mocked(mockedResize).mockReturnValue(
    createCarouselLayout([{ width: 600, height: 200 }])
  );
});

test.each([
  { effect: 'passive', useConsumerEffect: useEffect },
  { effect: 'layout', useConsumerEffect: useLayoutEffect },
])(
  'memoized window breakpoints publish the current step before ancestor $effect effects',
  ({ useConsumerEffect }) => {
    let navigation!: CarouselController;
    let updateWidth!: (width: number) => void;
    const targets: Array<number | null> = [];
    function Consumer() {
      navigation = useCarousel();
      const [width, setWidth] = useState(600);
      updateWidth = setWidth;
      useConsumerEffect(() => {
        if (width === 900) {
          targets.push(navigation.getPageSlideIndex(2));
          navigation.goToPage(2);
        }
      }, [width]);
      return (
        <MemoCarousel
          controller={navigation}
          slidesPerView={3}
          slidesToScroll={1}
          breakpointsBase="window"
          breakpoints={breakpoints}
          animation={false}
        >
          {slides}
        </MemoCarousel>
      );
    }
    render(<Consumer />);
    expect(navigation.pageCount).toBe(6);
    act(() => {
      vi.stubGlobal('innerWidth', 900);
      window.dispatchEvent(new Event('resize'));
      // Batch the child's debounced resize with the ancestor's own resize state.
      // Stable props let the memoized root skip rendering while its child commits.
      vi.advanceTimersByTime(60);
      updateWidth(900);
    });
    expect(targets).toEqual([5]);
    expect(navigation.index).toBe(5);
    expect(navigation.pageCount).toBe(3);
    expect(navigation.pageIndex).toBe(2);
  }
);
