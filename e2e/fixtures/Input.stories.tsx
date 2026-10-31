import { StrictMode, useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import RCarousel, {
  useCarousel,
  type RCarouselProps,
} from 'recycling-react-carousel';

type Args = RCarouselProps & {
  controlled: boolean;
  accept: boolean;
  count: number;
  focusEdges: boolean;
};

function InputExample({
  controlled,
  accept,
  count,
  focusEdges,
  wheel: initialWheel,
  dragMode: initialMode,
  drag: initialDrag,
  ...args
}: Args) {
  const carousel = useCarousel();
  const [cursor, setCursor] = useState(0);
  const [wheel, setWheel] = useState(initialWheel);
  const [dragMode, setDragMode] = useState(initialMode);
  const [drag, setDrag] = useState(initialDrag);
  const [settles, setSettles] = useState(0);
  const [source, setSource] = useState('');
  const [blocked, setBlocked] = useState(false);
  const [reason, setReason] = useState('');
  const [clicks, setClicks] = useState(0);
  const [cancelWheelEvents, setCancelWheelEvents] = useState(false);
  const items = useMemo(
    () => Array.from({ length: count }, (_, id) => ({ id })),
    [count]
  );
  return (
    <main style={{ padding: 20 }}>
      <div style={{ height: 120 }}>Page scrolling before the carousel</div>
      <nav aria-label="Input navigation">
        <button
          type="button"
          onClick={() => setCancelWheelEvents((value) => !value)}
        >
          Cancel wheel events
        </button>
        <button {...carousel.getPrevButtonProps()}>Previous</button>
        <button {...carousel.getNextButtonProps()}>Next</button>
        <button type="button" onClick={() => carousel.goTo(carousel.index)}>
          Select current
        </button>
        <button
          type="button"
          {...carousel.getPageButtonProps(carousel.pageIndex ?? 0, {
            'aria-label': 'Current page',
          })}
        >
          Current page
        </button>
        <button type="button" onClick={() => carousel.goTo(700)}>
          Jump to 700
        </button>
        <button type="button" onClick={() => setWheel((value) => !value)}>
          Toggle wheel
        </button>
        <button
          type="button"
          onClick={() =>
            setDragMode((value) => (value === 'free' ? 'snap' : 'free'))
          }
        >
          Toggle free
        </button>
        <button type="button" onClick={() => setDrag((value) => !value)}>
          Toggle dragging
        </button>
      </nav>
      <output data-testid="cursor">{carousel.absoluteIndex}</output>
      <output data-testid="moving">{String(carousel.isAnimating)}</output>
      <output data-testid="settles">{settles}</output>
      <output data-testid="source">{source}</output>
      <output data-testid="blocked">{String(blocked)}</output>
      <output data-testid="reason">{reason}</output>
      <output data-testid="clicks">{clicks}</output>
      <RCarousel
        {...args}
        drag={drag}
        dragMode={dragMode}
        wheel={wheel}
        controller={carousel}
        {...(controlled ? { absoluteIndex: cursor } : {})}
        onAbsoluteIndexChange={(next, details) => {
          setReason(details.reason);
          if (accept) setCursor(next);
        }}
        onNavigate={(details) => {
          setSource(details.source);
          setBlocked(details.blocked);
        }}
        onSettle={() => setSettles((value) => value + 1)}
        data-testid="carousel"
        onWheel={(event) => {
          if (cancelWheelEvents) event.preventDefault();
        }}
        aria-label="Free input regression"
        crossAxisSize="container"
        style={{
          width: 480,
          maxWidth: '100%',
          height: 240,
          touchAction: args.axis === 'vertical' ? 'pan-x' : 'pan-y',
        }}
        items={items}
        children={undefined}
        getItemKey={(item) => item.id}
        renderItem={(item) => (
          <article
            data-input-index={item.id}
            style={{
              position: 'relative',
              height: '100%',
              background: '#e4e9df',
              padding: 16,
            }}
          >
            <h2>Item {item.id}</h2>
            <button
              type="button"
              onClick={() => setClicks((value) => value + 1)}
            >
              Open item {item.id}
            </button>
            <input
              aria-label={`Quantity ${item.id}`}
              type="number"
              defaultValue="1"
              style={
                focusEdges
                  ? { position: 'absolute', right: 16, bottom: 16, width: 70 }
                  : { width: 70 }
              }
            />
            <div
              data-native-scroll=""
              style={{ width: 130, height: 45, overflow: 'auto' }}
            >
              <div style={{ width: 600, height: 600 }}>Nested scroll area</div>
            </div>
          </article>
        )}
      />
      {focusEdges && <input aria-label="After carousel" />}
      <div style={{ height: 1600 }}>Page scrolling after the carousel</div>
    </main>
  );
}

const meta = {
  title: 'Regression/Input',
  component: InputExample,
  tags: ['!autodocs'],
  decorators: [
    (Story) => (
      <StrictMode>
        <Story />
      </StrictMode>
    ),
  ],
  args: {
    drag: true,
    dragMode: 'free',
    wheel: true,
    mode: 'finite',
    axis: 'horizontal',
    slidesPerView: 1,
    controlled: false,
    accept: true,
    count: 1000,
    focusEdges: false,
    animation: { type: 'duration', duration: 150 },
  },
} satisfies Meta<typeof InputExample>;
export default meta;
export const Free: StoryObj<typeof meta> = {};

function NestedWheelExample() {
  const outer = useCarousel();
  const inner = useCarousel();
  const [enabled, setEnabled] = useState(false);
  return (
    <main style={{ padding: 20 }}>
      <button type="button" onClick={() => setEnabled((value) => !value)}>
        Toggle inner wheel
      </button>
      <output data-testid="cursor">{inner.absoluteIndex}</output>
      <output data-testid="moving">
        {String(inner.isAnimating || outer.isAnimating)}
      </output>
      <RCarousel
        controller={outer}
        data-testid="outer-carousel"
        dragMode="free"
        wheel
        crossAxisSize="container"
        style={{ width: 600, maxWidth: '100%', height: 280 }}
      >
        {Array.from({ length: 8 }, (_, id) => (
          <article
            key={id}
            data-outer-index={id}
            style={{ height: '100%', background: '#ccd', padding: 20 }}
          >
            {id === 0 ? (
              <RCarousel
                controller={inner}
                data-testid="carousel"
                dragMode="free"
                wheel={enabled}
                crossAxisSize="container"
                style={{ width: 300, maxWidth: '100%', height: 180 }}
              >
                {Array.from({ length: 3 }, (_, index) => (
                  <div key={index} data-input-index={index}>
                    Inner {index}
                  </div>
                ))}
              </RCarousel>
            ) : (
              `Outer ${id}`
            )}
          </article>
        ))}
      </RCarousel>
    </main>
  );
}

export const NestedWheel: StoryObj<typeof meta> = {
  render: () => <NestedWheelExample />,
};
