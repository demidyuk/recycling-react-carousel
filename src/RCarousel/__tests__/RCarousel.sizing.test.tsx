import { StrictMode } from 'react';
import { act, render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import RCarousel, { type RCarouselProps } from '../../index.js';
import { motionEnvironment } from '../motion/ScalarMotion.js';
import { swipe } from './tools/swipe.js';
import { mockMotionClock } from '../../../test-config/motionClock.js';

let axis: 'horizontal' | 'vertical';
let visible: number;

beforeEach(() => {
  axis = 'horizontal';
  visible = 1;
  // Deliberately never deliver a resize notification or a measurement frame.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn(() => 1)
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  for (const side of ['width', 'height'] as const) {
    const property = side === 'width' ? 'offsetWidth' : 'offsetHeight';
    vi.spyOn(HTMLElement.prototype, property, 'get').mockImplementation(
      function (this: HTMLElement) {
        const primary = side === (axis === 'horizontal' ? 'width' : 'height');
        if (this.dataset.testid === 'carousel')
          return primary ? 480 : parseFloat(this.style[side]) || 0;
        if (!this.parentElement?.hasAttribute('data-carousel-measure'))
          return 0;
        return primary
          ? 480 / visible
          : Number(
              this.querySelector('[data-cross-size]')?.getAttribute(
                'data-cross-size'
              ) ?? 0
            );
      }
    );
  }
});

const cards = Array.from({ length: 8 }, (_, index) => (
  <div
    key={index}
    data-testid={`sizing-${index}`}
    data-cross-size={index === 3 || index === 4 ? 320 : 120}
  >
    {index + 1}
  </div>
));

const Example = (props: RCarouselProps) => (
  <RCarousel
    data-testid="carousel"
    axis={axis}
    slidesPerView={visible}
    style={axis === 'horizontal' ? { width: 480 } : { height: 480 }}
    {...props}
  >
    {cards}
  </RCarousel>
);

test('content height automatically follows live motion and reversals under StrictMode', () => {
  vi.spyOn(motionEnvironment, 'reducedMotion').mockReturnValue(false);
  const clock = mockMotionClock();
  const example = (index: number) => (
    <StrictMode>
      <Example index={index} animation={{ type: 'duration', duration: 100 }} />
    </StrictMode>
  );
  const { rerender, unmount } = render(example(2));
  const carousel = screen.getByTestId('carousel');
  expect(carousel.style.height).toBe('120px');
  rerender(example(3));
  expect(carousel.style.height).toBe('120px');
  clock.advanceTo(25);
  expect(parseFloat(carousel.style.height)).toBeCloseTo(170);
  rerender(example(2));
  expect(parseFloat(carousel.style.height)).toBeCloseTo(170);
  clock.advanceTo(50);
  expect(parseFloat(carousel.style.height)).toBeCloseTo(157.5);
  clock.advanceTo(100);
  clock.advanceTo(125);
  expect(carousel.style.height).toBe('120px');
  unmount();
  clock.advanceTo(150);
});

test('settlement never writes the previous slide height while rebasing', () => {
  vi.spyOn(motionEnvironment, 'reducedMotion').mockReturnValue(false);
  const clock = mockMotionClock();
  let settleFrame: FrameRequestCallback = () => {};
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    settleFrame = callback;
    return 1;
  });
  const example = (index: number) => (
    <StrictMode>
      <Example index={index} animation={{ type: 'duration', duration: 100 }} />
    </StrictMode>
  );
  const { rerender } = render(example(2));
  const carousel = screen.getByTestId('carousel');
  rerender(example(3));
  clock.advanceTo(50);
  clock.advanceTo(100);
  expect(carousel.style.height).toBe('320px');
  const heights: string[] = [];
  const descriptor = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(carousel.style),
    'height'
  )!;
  vi.spyOn(carousel.style, 'height', 'set').mockImplementation(function (
    value: string
  ) {
    heights.push(value);
    descriptor.set!.call(carousel.style, value);
  });
  act(() => settleFrame(100));
  expect(carousel.style.height).toBe('320px');
  expect(heights).not.toContain('120px');
});

for (const direction of ['horizontal', 'vertical'] as const) {
  for (const count of [1, 2]) {
    for (const animation of [
      'disabled',
      'zero-duration',
      'reduced-motion',
    ] as const) {
      test(`${direction} V=${count} ${animation}: recycled short slides never inherit a hidden tall height`, () => {
        axis = direction;
        visible = count;
        vi.spyOn(motionEnvironment, 'reducedMotion').mockReturnValue(
          animation === 'reduced-motion'
        );
        const configuration =
          animation === 'disabled'
            ? false
            : animation === 'zero-duration'
              ? { type: 'duration' as const, duration: 0 }
              : undefined;
        const { rerender } = render(
          <Example index={3 - visible} animation={configuration} />
        );
        const carousel = screen.getByTestId('carousel');
        const side = axis === 'horizontal' ? 'height' : 'width';
        expect(carousel.style[side]).toBe('120px');
        rerender(<Example index={6} animation={configuration} />);
        expect(carousel.style[side]).toBe('120px');
      });
    }
  }

  test(`${direction}: swipe 6 → 7 stays short when overshoot recycles tall slide 5 into short slide 8`, () => {
    axis = direction;
    let now = 0;
    let frame: FrameRequestCallback = () => {};
    vi.spyOn(motionEnvironment, 'reducedMotion').mockReturnValue(false);
    vi.spyOn(motionEnvironment, 'now').mockImplementation(() => now);
    vi.spyOn(motionEnvironment, 'requestFrame').mockImplementation(
      (callback) => {
        frame = callback;
        return 2;
      }
    );
    vi.spyOn(motionEnvironment, 'cancelFrame').mockImplementation(() => {});
    render(
      <Example
        defaultIndex={5}
        animation={{
          type: 'duration',
          duration: 100,
          easing: (progress) => (progress < 1 ? progress * 2.002 : 1),
        }}
      />
    );
    const carousel = screen.getByTestId('carousel');
    const side = axis === 'horizontal' ? 'height' : 'width';
    const recycled = screen
      .getByTestId('sizing-4')
      .closest('[data-carousel-slide]')!;
    expect(carousel.style[side]).toBe('120px');
    swipe(
      carousel,
      [400, 400],
      axis === 'horizontal' ? [200, 400] : [400, 200]
    );
    now = 35;
    act(() => frame(now));
    expect(carousel.style[side]).toBe('120px');
    now = 50;
    act(() => frame(now));
    expect(recycled.querySelector('[data-testid="sizing-7"]')).not.toBeNull();
    expect(carousel.style[side]).toBe('120px');
  });
}

test.each(['horizontal', 'vertical'] as const)(
  '%s content sizing includes viewport padding and borders with border-box sizing',
  (direction) => {
    axis = direction;
    render(
      <Example
        style={{
          width: 480,
          height: 480,
          border: '12px solid',
          padding: 8,
          boxSizing: 'border-box',
        }}
      />
    );
    const cross = axis === 'horizontal' ? 'height' : 'width';
    expect(screen.getByTestId('carousel').style[cross]).toBe('160px');
  }
);
