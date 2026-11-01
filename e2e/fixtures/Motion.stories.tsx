import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import RCarousel, { type RCarouselProps } from 'recycling-react-carousel';
import ExampleCard from './technical/ExampleCard.js';

const slides = [1, 2, 3, 4, 5, 6].map((value) => (
  <ExampleCard key={value}>{value}</ExampleCard>
));

const rapidLoopSlides = Array.from({ length: 32 }, (_, index) => {
  const value = index + 1;

  return (
    <ExampleCard key={value} data-testid={`rapid-slide-${value}`}>
      {value}
    </ExampleCard>
  );
});

const MillionSlideJumpExample = (args: RCarouselProps) => {
  const [cursor, setCursor] = useState(0);

  return (
    <>
      <button
        data-testid="million-jump"
        type="button"
        onClick={() => setCursor(1_000_000)}
      >
        Jump one million slides
      </button>
      <button
        data-testid="million-next"
        type="button"
        onClick={() => setCursor((current) => current + 1)}
      >
        Next
      </button>
      <button
        data-testid="million-back"
        type="button"
        onClick={() => setCursor(-1_000_000)}
      >
        Jump back one million slides
      </button>
      <RCarousel
        crossAxisSize="container"
        data-testid="carousel"
        {...args}
        absoluteIndex={cursor}
        onAbsoluteIndexChange={setCursor}
      >
        {slides}
      </RCarousel>
    </>
  );
};

const RapidControlledLoopExample = (args: RCarouselProps) => {
  const [cursor, setCursor] = useState(0);

  return (
    <>
      <button
        data-testid="rapid-back"
        type="button"
        onClick={() => setCursor((current) => current - 1)}
      >
        Previous
      </button>
      <output data-testid="rapid-cursor">{cursor}</output>
      <button
        data-testid="rapid-next"
        type="button"
        onClick={() => setCursor((current) => current + 1)}
      >
        Next
      </button>
      <RCarousel
        crossAxisSize="container"
        data-testid="carousel"
        {...args}
        absoluteIndex={cursor}
        onAbsoluteIndexChange={setCursor}
      >
        {rapidLoopSlides}
      </RCarousel>
    </>
  );
};

const ControlledMotionExample = (args: RCarouselProps) => {
  const [cursor, setCursor] = useState(0);

  return (
    <>
      <button
        data-testid="motion-back"
        type="button"
        onClick={() => setCursor((current) => current - 1)}
      >
        Previous
      </button>
      <output data-testid="motion-cursor">{cursor}</output>
      <button
        data-testid="motion-next"
        type="button"
        onClick={() => setCursor((current) => current + 1)}
      >
        Next
      </button>
      <RCarousel
        crossAxisSize="container"
        data-testid="carousel"
        {...args}
        absoluteIndex={cursor}
        onAbsoluteIndexChange={setCursor}
      >
        {slides}
      </RCarousel>
    </>
  );
};

const meta = {
  title: 'Regression/Motion',
  component: RCarousel,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="container d-flex align-items-center justify-content-center">
        <Story />
      </div>
    ),
  ],
  args: {
    style: { height: 250, userSelect: 'none' },
    slideStyle: { padding: 10 },
    animation: { type: 'duration' as const, duration: 1500 },
  },
} satisfies Meta<typeof RCarousel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RapidControlledLoop: Story = {
  render: RapidControlledLoopExample,
  args: {
    slidesPerView: 3,
    drag: false,
    mode: 'loop',
    animation: { type: 'spring', mass: 1, tension: 60, friction: 12 },
  },
};

export const SlowRecycling: Story = {
  render: ControlledMotionExample,
  args: {
    slidesPerView: 1,
    swipeThreshold: '50%',
    mode: 'loop',
    animation: { type: 'duration' as const, duration: 2000 },
  },
};

export const VerticalRecycling: Story = {
  render: ControlledMotionExample,
  args: {
    slidesPerView: 1,
    swipeThreshold: '50%',
    mode: 'loop',
    animation: { type: 'duration' as const, duration: 2000 },
    axis: 'vertical',
  },
};

export const Overshoot: Story = {
  render: ControlledMotionExample,
  args: {
    slidesPerView: 1,
    mode: 'loop',
    animation: {
      type: 'spring',
      mass: 1,
      tension: 120,
      friction: 8,
    },
  },
};

export const FastRecycling: Story = {
  render: ControlledMotionExample,
  args: {
    slidesPerView: 1,
    mode: 'loop',
    animation: { type: 'duration' as const, duration: 120 },
  },
};

export const MillionSlideJump: Story = {
  render: MillionSlideJumpExample,
  args: {
    slidesPerView: 3,
    mode: 'forward-loop',
  },
};
