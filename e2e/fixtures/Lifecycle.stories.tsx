import { Suspense, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import RCarousel, {
  useCarousel,
  type RCarouselProps,
} from 'recycling-react-carousel';

const pending = new Promise<never>(() => {});

function Pending({ active }: { active: boolean }) {
  if (active) throw pending;
  return null;
}

function LifecycleExample({
  mode = 'configuration',
  initialPosition,
  carouselMode,
}: {
  mode?: 'configuration' | 'count' | 'suspense';
  initialPosition?: number;
  carouselMode?: RCarouselProps['mode'];
}) {
  const carousel = useCarousel();
  const [position, setPosition] = useState(
    initialPosition ?? (mode === 'count' ? 100 : 0)
  );
  const [count, setCount] = useState(mode === 'count' ? 3 : 6);
  const [visible, setVisible] = useState(1);
  const [looping, setLooping] = useState(false);
  const [suspended, setSuspended] = useState(false);
  const [clicks, setClicks] = useState(0);
  const [requests, setRequests] = useState<
    Array<{ cursor: number; reason?: string }>
  >([]);

  return (
    <div style={{ padding: 24 }}>
      <output data-testid="lifecycle-cursor">{position}</output>
      <output data-testid="lifecycle-requests">
        {JSON.stringify(requests)}
      </output>
      <output data-testid="lifecycle-clicks">{clicks}</output>
      <button data-testid="lifecycle-next" onClick={carousel.next}>
        Next
      </button>
      <button
        data-testid="lifecycle-remove"
        onClick={() => setCount((value) => Math.max(0, value - 1))}
      >
        Remove last slide
      </button>
      <button
        data-testid="lifecycle-append"
        onClick={() => setCount((value) => value + 1)}
      >
        Append slide
      </button>
      <button
        data-testid="lifecycle-configure"
        onClick={() => setVisible((value) => (value === 1 ? 2 : 1))}
      >
        Change visible count
      </button>
      <button
        data-testid="lifecycle-mode"
        onClick={() => setLooping((value) => !value)}
      >
        Change collection mode
      </button>
      <button data-testid="lifecycle-hide" onClick={() => setSuspended(true)}>
        Suspend carousel
      </button>
      <button
        data-testid="lifecycle-reveal"
        onClick={() => setSuspended(false)}
      >
        Reveal carousel
      </button>
      <Suspense fallback={<div data-testid="lifecycle-fallback">Loading</div>}>
        <RCarousel
          crossAxisSize="container"
          controller={carousel}
          absoluteIndex={position}
          data-testid="lifecycle-carousel"
          aria-label="Lifecycle example"
          mode={
            carouselMode ??
            (mode === 'count' ? 'forward-loop' : looping ? 'loop' : 'finite')
          }
          slidesPerView={visible}
          animation={{ type: 'duration' as const, duration: 1000 }}
          onAbsoluteIndexChange={(cursor, details) => {
            setRequests((values) => [
              ...values,
              { cursor, reason: details.reason },
            ]);
            setPosition(cursor);
          }}
          style={{ width: 300, height: 180, userSelect: 'none' }}
        >
          {Array.from({ length: count }, (_, index) => (
            <button
              key={index}
              type="button"
              style={{ width: '100%', height: 150 }}
              onClick={() => setClicks((value) => value + 1)}
            >
              Item {index}
            </button>
          ))}
        </RCarousel>
        <Pending active={suspended} />
      </Suspense>
    </div>
  );
}

const meta = {
  title: 'Regression/Lifecycle',
  component: LifecycleExample,
} satisfies Meta<typeof LifecycleExample>;
export default meta;
type Story = StoryObj<typeof meta>;
export const CountCorrection: Story = { args: { mode: 'count' } };
export const SuspenseReattachment: Story = { args: { mode: 'suspense' } };
export const DelayedGestureCancellation: Story = {};
export const PositiveCountRemoval: Story = {
  args: { mode: 'count', initialPosition: 5, carouselMode: 'loop' },
};
export const NegativeCountRemoval: Story = {
  args: { mode: 'count', initialPosition: -1, carouselMode: 'loop' },
};
export const ForwardCountRemoval: Story = {
  args: { mode: 'count', initialPosition: 5, carouselMode: 'forward-loop' },
};
