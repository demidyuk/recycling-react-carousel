import { StrictMode, useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import RCarousel, {
  useCarousel,
  type RCarouselProps,
} from 'recycling-react-carousel';

type Args = RCarouselProps & {
  itemCount: number;
  responsive: boolean;
  decorated: boolean;
  initiallyHidden: boolean;
};
function LayoutExample({
  itemCount,
  responsive,
  decorated,
  initiallyHidden,
  ...props
}: Args) {
  const carousel = useCarousel();
  const [width, setWidth] = useState(600);
  const [visible, setVisible] = useState(!initiallyHidden);
  const [navigate, setNavigate] = useState('');
  const items = useMemo(
    () => Array.from({ length: itemCount }, (_, index) => index),
    [itemCount]
  );
  return (
    <StrictMode>
      <button {...carousel.getPrevButtonProps()}>Previous</button>
      <button {...carousel.getNextButtonProps()}>Next</button>
      <button onClick={() => carousel.goTo(0)}>First</button>
      <button onClick={() => carousel.goTo(itemCount - 1)}>Last</button>
      <button onClick={() => carousel.goToAbsolute(1_000_000)}>
        Large jump
      </button>
      <button onClick={() => carousel.goToAbsolute(-1_000_000)}>
        Reverse jump
      </button>
      <button
        onClick={() => setWidth((current) => (current === 600 ? 360 : 600))}
      >
        Resize
      </button>
      <button onClick={() => setVisible((value) => !value)}>
        Toggle visibility
      </button>
      <div
        style={{
          display: visible ? undefined : 'none',
          width,
          maxWidth: '100%',
        }}
      >
        <RCarousel
          {...props}
          children={undefined}
          style={
            decorated
              ? {
                  ...props.style,
                  width: 599.6,
                  height: 319.6,
                  border: '12px solid transparent',
                  boxSizing: 'border-box',
                }
              : props.style
          }
          onNavigate={(details) => {
            props.onNavigate?.(details);
            setNavigate(JSON.stringify(details));
          }}
          controller={carousel}
          data-testid="carousel"
          aria-label="Layout slides"
          breakpoints={
            responsive
              ? {
                  500: {
                    slidesPerView: 2.5,
                    snapAlign: 'center',
                    insetStart: '10%',
                    insetEnd: 20,
                  },
                }
              : undefined
          }
          items={items}
          getItemKey={(item) => item}
          renderItem={(item) => (
            <article
              data-item-index={item}
              style={{
                height:
                  props.axis === 'vertical' ? '100%' : item === 4 ? 220 : 120,
                background: '#d9e5ff',
                boxSizing: 'border-box',
                width: '100%',
              }}
            >
              <h2 style={{ margin: 0 }}>Slide {item}</h2>
              <button>Action {item}</button>
            </article>
          )}
        />
      </div>
      <output data-testid="navigate">{navigate}</output>
      <output data-testid="cursor">{carousel.absoluteIndex}</output>
      <output data-testid="ready">{String(carousel.isReady)}</output>
      <output data-testid="moving">{String(carousel.isAnimating)}</output>
      <output data-testid="capacity">{carousel.slidesPerView}</output>
    </StrictMode>
  );
}
const meta = {
  title: 'Regression/Layouts',
  component: LayoutExample,
  args: {
    itemCount: 8,
    responsive: false,
    decorated: false,
    initiallyHidden: false,
    slidesPerView: 1.2,
    snapAlign: 'center',
    insetStart: 24,
    insetEnd: 24,
    gap: 16,
    mode: 'finite',
    axis: 'horizontal',
    defaultIndex: 3,
    animation: { type: 'duration', duration: 0 },
    crossAxisSize: 'container',
    style: { height: 320 },
  },
} satisfies Meta<Args>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Geometry: Story = {};
