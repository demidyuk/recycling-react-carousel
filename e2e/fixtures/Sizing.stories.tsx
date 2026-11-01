import { StrictMode, useMemo } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import RCarousel, {
  useCarousel,
  type CarouselAnimation,
} from 'recycling-react-carousel';

interface SizingArgs {
  axis: 'horizontal' | 'vertical';
  slidesPerView: number;
  gap: number;
  initialIndex: number;
  animation: CarouselAnimation;
}

function SizingExample({
  axis,
  slidesPerView,
  gap,
  initialIndex,
  animation,
}: SizingArgs) {
  const carousel = useCarousel();
  const vertical = axis === 'vertical';
  const slides = useMemo(
    () =>
      Array.from({ length: 8 }, (_, index) => {
        const cross = index === 3 || index === 4 ? 320 : 120;
        return (
          <div
            key={index}
            data-item-index={index}
            style={{
              width: vertical ? cross : '100%',
              height: vertical ? '100%' : cross,
              background: '#e8eef8',
            }}
          >
            {index + 1}
          </div>
        );
      }),
    [vertical]
  );
  return (
    <main style={{ padding: 16 }}>
      <nav aria-label="Slide navigation">
        <button {...carousel.getPrevButtonProps()}>Previous slide</button>
        <button {...carousel.getNextButtonProps()}>Next slide</button>
        <label>
          Go to slide
          <select
            value={carousel.index}
            onChange={(event) =>
              carousel.goTo(Number(event.currentTarget.value))
            }
          >
            {slides.map((_, index) => (
              <option key={index} value={index}>
                {index + 1}
              </option>
            ))}
          </select>
        </label>
      </nav>
      <output data-testid="cursor">{carousel.absoluteIndex}</output>
      <output data-testid="moving">{String(carousel.isAnimating)}</output>
      <RCarousel
        controller={carousel}
        defaultIndex={initialIndex}
        axis={axis}
        slidesPerView={slidesPerView}
        gap={gap}
        animation={animation}
        data-testid="carousel"
        aria-label="Intrinsic sizing regression"
        slideStyle={{ padding: 8 }}
        style={
          vertical
            ? { height: 400, maxWidth: '100%' }
            : { width: 480, maxWidth: '100%', userSelect: 'none' }
        }
      >
        {slides}
      </RCarousel>
    </main>
  );
}

const meta = {
  title: 'Regression/Sizing',
  component: SizingExample,
  decorators: [
    (Story) => (
      <StrictMode>
        <Story />
      </StrictMode>
    ),
  ],
  argTypes: {
    axis: { control: 'radio', options: ['horizontal', 'vertical'] },
    animation: { control: 'object' },
  },
  args: {
    axis: 'horizontal',
    slidesPerView: 1,
    gap: 0,
    initialIndex: 5,
    animation: { type: 'spring', tension: 180, friction: 12 },
  },
} satisfies Meta<typeof SizingExample>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Content: Story = {};
