import { StrictMode, useEffect, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import RCarousel, {
  useCarousel,
  type RCarouselProps,
} from 'recycling-react-carousel';

function MotionSubscriptionExample(args: RCarouselProps) {
  const carousel = useCarousel();
  const root = useRef<HTMLDivElement>(null);
  const report = useRef<HTMLOutputElement>(null);
  const renders = useRef(0);
  renders.current++;
  const [mounted, setMounted] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [width, setWidth] = useState(600);
  const audit = useRef({
    frames: 0,
    maxError: 0,
    mismatches: 0,
    unreadyFrames: 0,
    maxPosition: 0,
  });
  useEffect(() => {
    if (!enabled) return;
    return carousel.subscribeMotion((motion) => {
      const bounds = root.current?.getBoundingClientRect();
      if (!bounds || !report.current) return;
      if (!carousel.isReady) audit.current.unreadyFrames++;
      const vertical = motion.axis === 'vertical';
      const origin = vertical ? bounds.y : bounds.x;
      const values = [];
      for (const slide of motion.slides) {
        const box = slide.element.getBoundingClientRect();
        const actual =
          (vertical ? box.y + box.height / 2 : box.x + box.width / 2) - origin;
        const expected = motion.anchor + slide.distance * motion.slidePitch;
        audit.current.maxError = Math.max(
          audit.current.maxError,
          Math.abs(actual - expected)
        );
        const child = slide.element.querySelector<HTMLElement>(
          '[data-motion-index]'
        );
        if (
          !slide.element.isConnected ||
          Number(child?.dataset.motionIndex) !== slide.index
        )
          audit.current.mismatches++;
        if (child)
          child.style.opacity = String(
            Math.max(0.2, 1 - Math.abs(slide.distance) * 0.1)
          );
        values.push({
          index: slide.index,
          absoluteIndex: slide.absoluteIndex,
          distance: slide.distance,
        });
      }
      audit.current.frames++;
      audit.current.maxPosition = Math.max(
        audit.current.maxPosition,
        motion.position
      );
      report.current.textContent = JSON.stringify({
        ...audit.current,
        position: motion.position,
        axis: motion.axis,
        slides: values,
      });
    });
  }, [carousel, enabled]);
  return (
    <main style={{ padding: 20 }}>
      <button type="button" onClick={() => setMounted((value) => !value)}>
        Toggle mounted
      </button>
      <button type="button" onClick={() => setEnabled((value) => !value)}>
        Toggle subscription
      </button>
      <button type="button" onClick={() => carousel.next()}>
        Next
      </button>
      <button type="button" onClick={() => carousel.goToAbsolute(-1000)}>
        Jump backwards
      </button>
      <button type="button" onClick={() => carousel.goToAbsolute(1000)}>
        Jump forwards
      </button>
      <label>
        Container width
        <input
          type="range"
          min="260"
          max="800"
          value={width}
          onChange={(event) => setWidth(Number(event.target.value))}
        />
      </label>
      <output ref={report} data-testid="motion-data" />
      <output data-testid="consumer-renders">{renders.current}</output>
      <output data-testid="moving">{String(carousel.isAnimating)}</output>
      {mounted && (
        <RCarousel
          {...args}
          controller={carousel}
          ref={root}
          aria-label="Motion subscription regression"
          data-testid="carousel"
          crossAxisSize="container"
          style={{ width, maxWidth: '100%', height: 280 }}
          items={Array.from({ length: 40 }, (_, index) => index)}
          children={undefined}
          getItemKey={(value) => value}
          renderItem={(value) => (
            <article
              data-motion-index={value}
              style={{ height: '100%', background: '#eef2f9' }}
            >
              {value}
            </article>
          )}
        />
      )}
    </main>
  );
}
const meta = {
  title: 'Regression/Motion subscription',
  component: MotionSubscriptionExample,
  decorators: [
    (Story) => (
      <StrictMode>
        <Story />
      </StrictMode>
    ),
  ],
  args: {
    mode: 'loop',
    axis: 'horizontal',
    slidesPerView: 3,
    gap: 16,
    snapAlign: 'center',
    insetStart: 24,
    insetEnd: 8,
    wheel: true,
    dragMode: 'free-snap',
    animation: { type: 'duration', duration: 1000 },
  },
} satisfies Meta<typeof MotionSubscriptionExample>;
export default meta;
export const Example: StoryObj<typeof meta> = {};
export const Spring: StoryObj<typeof meta> = {
  args: {
    dragMode: 'snap',
    animation: { type: 'spring', tension: 180, friction: 12 },
  },
};
