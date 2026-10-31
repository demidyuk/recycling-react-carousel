import { StrictMode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import RCarousel from 'recycling-react-carousel';
import {
  BasicExample,
  ControlledExample,
  ResponsiveExample,
  VerticalExample,
  LargeJumpsExample,
  ContentSizingExample,
  type ExampleArgs,
} from './technical/Examples.js';

const controlNames = [
  'mode',
  'axis',
  'slidesPerView',
  'gap',
  'snapAlign',
  'insetStart',
  'insetEnd',
  'maxSlideSize',
  'swipeThreshold',
  'animation',
  'slidesToScroll',
  'breakpoints',
  'breakpointsBase',
  'drag',
  'trimEnd',
  'crossAxisSize',
  'slideAlign',
  'defaultIndex',
  'itemCount',
  'cardContent',
  'motion',
];

const describe = (story: string, code: string, controls: string[]) => ({
  parameters: {
    // Hide unrelated controls without breaking URL arguments used by tests.
    controls: { include: controlNames },
    docs: {
      description: { story },
      source: { code, language: 'tsx' },
    },
  },
  argTypes: Object.fromEntries(
    controlNames.map((name) => [
      name,
      controls.includes(name)
        ? {}
        : { control: false, table: { disable: true } },
    ])
  ),
});
const navigationControls = [
  'mode',
  'slidesPerView',
  'gap',
  'snapAlign',
  'insetStart',
  'insetEnd',
  'trimEnd',
  'drag',
  'swipeThreshold',
  'animation',
  'slidesToScroll',
  'breakpoints',
  'breakpointsBase',
];

const meta = {
  title: 'Regression/Feature harness',
  component: RCarousel,
  tags: ['!autodocs'],
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <StrictMode>
        <Story />
      </StrictMode>
    ),
  ],
  render: BasicExample,
  argTypes: {
    mode: { control: 'select', options: ['finite', 'loop', 'forward-loop'] },
    axis: { control: 'radio', options: ['horizontal', 'vertical'] },
    slidesPerView: {
      control: 'object',
      type: { name: 'other', value: "number | 'auto'" },
    },
    maxSlideSize: {
      control: 'text',
      type: { name: 'other', value: 'number | px string | % string' },
      description:
        'Requires auto sizing. Percentages use the inner viewport size after insets.',
    },
    snapAlign: { control: 'radio', options: ['start', 'center'] },
    insetStart: { control: 'text' },
    insetEnd: { control: 'text' },
    gap: {
      control: { type: 'number', min: 0, step: 1 },
      description: 'Space between slides in pixels.',
    },
    swipeThreshold: {
      control: 'text',
      type: { name: 'other', value: 'number | px string | % string' },
      description:
        'Percentages use one slide’s content size, excluding its gap.',
    },
    animation: {
      control: 'object',
      type: { name: 'object', value: {} },
      description:
        'Spring, duration, or false. Overrides the Large Jumps preset.',
    },
    slidesToScroll: { control: { type: 'number', min: 1 } },
    breakpoints: { control: 'object' },
    breakpointsBase: { control: 'radio', options: ['container', 'window'] },
    drag: { control: 'boolean' },
    trimEnd: { control: 'boolean' },
    crossAxisSize: { control: 'radio', options: ['content', 'container'] },
    slideAlign: {
      control: 'radio',
      options: ['stretch', 'start', 'center', 'end'],
    },
    itemCount: {
      control: { type: 'number', min: 6, max: 10000, step: 1 },
      type: 'number',
    },
    cardContent: {
      control: 'radio',
      options: ['simple', 'rich'],
    },
    motion: {
      control: 'radio',
      options: ['spring', 'bouncy', 'duration'],
    },
    children: { control: false },
    index: { control: false },
    controller: { control: false },
  },
  args: {
    mode: 'finite',
    axis: 'horizontal',
    slidesPerView: 1,
    swipeThreshold: '30px',
    drag: true,
    trimEnd: true,
    slidesToScroll: 1,
    crossAxisSize: 'container',
    slideAlign: 'stretch',
    gap: 16,
    style: { height: 250, userSelect: 'none' },
    itemCount: 6,
    cardContent: 'simple',
    motion: 'spring',
  },
} satisfies Meta<ExampleArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  ...describe(
    'Try dragging and swipe thresholds. Use slidesPerView={1.2} and snapAlign="center" for previews; adjust their spacing with insetStart and insetEnd.',
    `<RCarousel slidesPerView={1} gap={16} drag swipeThreshold="30px">
  {slides}
</RCarousel>`,
    [
      'drag',
      'snapAlign',
      'insetStart',
      'insetEnd',
      'gap',
      'snapAlign',
      'insetStart',
      'insetEnd',
      'swipeThreshold',
      'animation',
      'slidesToScroll',
      'breakpoints',
      'breakpointsBase',
      'defaultIndex',
    ]
  ),
};

export const Controlled: Story = {
  render: ControlledExample,
  args: { slidesPerView: 3 },
  ...describe(
    'Use useCarousel for buttons and slide selection across finite, loop, and forward-loop modes.',
    `const carousel = useCarousel();

<button {...carousel.getPrevButtonProps()}>Previous slide</button>
<RCarousel controller={carousel} slidesPerView={3} gap={16} crossAxisSize="container" style={{ height: 250 }}>
  {slides}
</RCarousel>
<button {...carousel.getNextButtonProps()}>Next slide</button>
// carousel.goTo(index) selects the nearest occurrence.`,
    navigationControls
  ),
};

export const Responsive: Story = {
  render: ResponsiveExample,
  args: {
    itemCount: 12,
    breakpoints: {
      480: { slidesPerView: 2 },
      720: { slidesPerView: 3 },
      880: { slidesPerView: 4, slidesToScroll: 2, gap: 24 },
    },
  },
  ...describe(
    'Container width controls how many slides are visible and how far navigation moves.',
    `<RCarousel
  gap={16}
  breakpoints={{
    480: { slidesPerView: 2 },
    720: { slidesPerView: 3 },
    880: { slidesPerView: 4, slidesToScroll: 2, gap: 24 },
  }}
>
  {slides}
</RCarousel>`,
    [
      'slidesPerView',
      'gap',
      'snapAlign',
      'insetStart',
      'insetEnd',
      'maxSlideSize',
      'drag',
      'swipeThreshold',
      'animation',
      'slidesToScroll',
      'breakpoints',
      'breakpointsBase',
    ]
  ),
};

export const Vertical: Story = {
  render: VerticalExample,
  args: { axis: 'vertical', style: { height: 300 } },
  ...describe(
    'Vertical navigation in a fixed-height viewport.',
    `<RCarousel axis="vertical" slidesPerView={1} gap={16} crossAxisSize="container" style={{ height: 300 }}>
  {slides}
</RCarousel>`,
    navigationControls
  ),
};

export const LargeJumps: Story = {
  render: LargeJumpsExample,
  args: { mode: 'loop', slidesPerView: 3, itemCount: 500 },
  ...describe(
    'Jump through 500 items with different animation settings.',
    `const carousel = useCarousel();

<button onClick={() => carousel.goToAbsolute(1_000_000)}>Jump +1,000,000</button>
<RCarousel
  controller={carousel}
  items={products}
  getItemKey={(product) => product.id}
  renderItem={(product) => <ProductCard product={product} />}
  mode="loop"
  slidesPerView={3}
  gap={16}
  crossAxisSize="container"
  style={{ height: 250 }}
/>
// Optional: animation={{ type: 'spring', tension: 180, friction: 12 }}
// Or: animation={{ type: 'duration', duration: 500, easing: t => 1 - (1 - t) ** 3 }}`,
    [...navigationControls, 'motion', 'cardContent', 'itemCount']
  ),
};

export const ContentSizing: Story = {
  render: ContentSizingExample,
  args: { crossAxisSize: 'content', itemCount: 8, style: undefined },
  ...describe(
    'Compare content sizing and cross-axis alignment using cards of different heights.',
    `<RCarousel slidesPerView={1} gap={16}>
  {cardsWithDifferentHeights}
</RCarousel>

// Fixed viewport with intrinsic, centered content:
<RCarousel gap={16} crossAxisSize="container" slideAlign="center" style={{ height: 280 }}>
  {cardsWithDifferentHeights}
</RCarousel>`,
    ['crossAxisSize', 'slideAlign', 'animation', 'gap']
  ),
};
