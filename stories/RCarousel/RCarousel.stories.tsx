import { StrictMode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import RCarousel from 'recycling-react-carousel';
import {
  BasicExample,
  ControlledExample,
  PaginationExample,
  LoopExample,
  InspirationExample,
  MultipleSlidesExample,
  ScrollStepExample,
  GalleryExample,
  ResponsiveExample,
  BreakpointsExample,
  VerticalExample,
  FreeFlowExample,
  WheelExample,
  VerticalWheelExample,
  ContentSizingExample,
  ExpandableExample,
  FixedHeightExample,
  SpringExample,
  DurationExample,
  LargeJumpsExample,
} from './Examples.js';
import { InfiniteLoadingExample } from './InfiniteLoadingExample.js';
import { TimePickerExample } from './TimePickerExample.js';
import {
  numberedSource,
  paginationSource,
  breakpointsSource,
  contentSource,
  expandableSource,
  collectionSource,
  infiniteSource,
  timePickerSource,
} from './storySources.js';

const describe = (story: string, code: string) => ({
  parameters: {
    docs: { description: { story }, source: { code, language: 'tsx' } },
  },
});

const meta = {
  title: 'RCarousel',
  component: RCarousel,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <StrictMode>
        <Story />
      </StrictMode>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
    controls: { expanded: true },
    docs: {
      description: {
        component:
          'Every example starts with a focused preset. All carousel configuration Controls remain available in every story; Show code shows the starting preset.',
      },
    },
  },
  argTypes: {
    mode: { control: 'select', options: ['finite', 'loop', 'forward-loop'] },
    axis: { control: 'radio', options: ['horizontal', 'vertical'] },
    slidesPerView: {
      control: 'object',
      mapping: {},
      type: { name: 'other', value: "number | 'auto'" },
      description:
        'A number of at least 1, including fractions, or "auto". Edit the JSON value to use either form.',
    },
    slidesToScroll: {
      control: { type: 'number', min: 1, step: 1 },
      type: 'number',
    },
    gap: { control: { type: 'number', min: 0 }, type: 'number' },
    snapAlign: { control: 'radio', options: ['start', 'center'] },
    insetStart: {
      control: 'text',
      type: { name: 'other', value: 'CarouselLength' },
    },
    insetEnd: {
      control: 'text',
      type: { name: 'other', value: 'CarouselLength' },
    },
    maxSlideSize: {
      control: 'text',
      type: { name: 'other', value: 'CarouselLength' },
      description:
        'Requires slidesPerView="auto". Clear this value before choosing a numeric slide count.',
    },
    trimEnd: { control: 'boolean', type: 'boolean' },
    drag: { control: 'boolean', type: 'boolean' },
    dragMode: { control: 'radio', options: ['snap', 'free', 'free-snap'] },
    wheel: { control: 'boolean', type: 'boolean' },
    swipeThreshold: {
      control: 'text',
      type: { name: 'other', value: 'CarouselLength' },
    },
    crossAxisSize: { control: 'radio', options: ['content', 'container'] },
    slideAlign: {
      control: 'radio',
      options: ['stretch', 'start', 'center', 'end'],
    },
    // Animation supports both object configurations and false.
    animation: {
      control: 'object',
      mapping: {},
      type: { name: 'object', value: {} },
    },
    breakpoints: { control: 'object', type: { name: 'object', value: {} } },
    breakpointsBase: { control: 'radio', options: ['container', 'window'] },
    index: {
      control: { type: 'number', min: 0, step: 1 },
      type: 'number',
      description:
        'Controlled local index. Do not combine local and absolute position props.',
    },
    absoluteIndex: {
      control: { type: 'number', step: 1 },
      type: 'number',
      description:
        'Controlled global position. Do not combine local and absolute position props.',
    },
    defaultIndex: {
      control: { type: 'number', min: 0, step: 1 },
      type: 'number',
      description:
        'Initial local index. Changing this Control remounts the demo carousel.',
    },
    defaultAbsoluteIndex: {
      control: { type: 'number', step: 1 },
      type: 'number',
      description:
        'Initial global position. Changing this Control remounts the demo carousel.',
    },
    style: {
      control: 'object',
      type: { name: 'object', value: {} },
      description:
        'Viewport styles. Vertical and container-sized demos use 320px height unless overridden here.',
    },
    slideStyle: { control: 'object', type: { name: 'object', value: {} } },
    className: { control: 'text' },
    slideClassName: { control: 'text' },
    children: { control: false, table: { disable: true } },
    controller: { control: false, table: { disable: true } },
    items: { control: false, table: { disable: true } },
    renderItem: { control: false, table: { disable: true } },
    getItemKey: { control: false, table: { disable: true } },
    getSlideLabel: { control: false, table: { disable: true } },
    onIndexChange: { control: false, table: { disable: true } },
    onAbsoluteIndexChange: { control: false, table: { disable: true } },
    onStateChange: { control: false, table: { disable: true } },
    onNavigate: { control: false, table: { disable: true } },
    onSettle: { control: false, table: { disable: true } },
  },
  args: {
    mode: 'finite',
    axis: 'horizontal',
    slidesPerView: 1,
    slidesToScroll: 1,
    gap: 16,
    snapAlign: 'start',
    insetStart: '0px',
    insetEnd: '0px',
    trimEnd: true,
    drag: true,
    dragMode: 'snap',
    wheel: false,
    swipeThreshold: '30px',
    crossAxisSize: 'content',
    slideAlign: 'stretch',
    animation: { type: 'spring', tension: 170, friction: 26, mass: 1 },
    breakpoints: {},
    breakpointsBase: 'container',
    style: {},
    slideStyle: {},
    className: '',
    slideClassName: '',
  },
} satisfies Meta<typeof RCarousel>;

export default meta;
type Story = StoryObj<typeof meta>;

// Existing export names preserve published rcarousel--... story links.
export const Basic: Story = {
  name: 'Basic dragging',
  render: BasicExample,
  args: { drag: true, swipeThreshold: '30px' },
  ...describe('Drag or swipe between slides.', numberedSource('', false)),
};

export const Controlled: Story = {
  name: 'Navigation buttons',
  render: ControlledExample,
  args: {},
  ...describe(
    'Use the controller to add buttons that are disabled at either end.',
    numberedSource('', true)
  ),
};

export const Pagination: Story = {
  name: 'Pagination',
  render: PaginationExample,
  args: {},
  ...describe(
    'Select a page using accessible numbered buttons.',
    paginationSource
  ),
};

export const Loop: Story = {
  name: 'Loop',
  render: LoopExample,
  args: { mode: 'loop' },
  ...describe(
    'Keep browsing past either end.',
    numberedSource('mode="loop"', true)
  ),
};

export const Inspiration: Story = {
  name: 'Forward loop',
  render: InspirationExample,
  args: { mode: 'forward-loop' },
  ...describe(
    'Loop forwards and go back as far as absolute position zero.',
    numberedSource('mode="forward-loop"', true)
  ),
};

export const MultipleSlides: Story = {
  name: 'Multiple slides',
  render: MultipleSlidesExample,
  args: { slidesPerView: 3 },
  ...describe(
    'Show three slides and move one at a time.',
    numberedSource('slidesPerView={3}', true)
  ),
};

export const ScrollStep: Story = {
  name: 'Scroll step',
  render: ScrollStepExample,
  args: { slidesPerView: 3, slidesToScroll: 2 },
  ...describe(
    'Move two slides at a time.',
    numberedSource('slidesPerView={3} slidesToScroll={2}', true)
  ),
};

export const Gallery: Story = {
  name: 'Centered slides',
  render: GalleryExample,
  args: { slidesPerView: 1.4, snapAlign: 'center' },
  ...describe(
    'Center the active slide and preview its neighbors.',
    numberedSource('slidesPerView={1.4} snapAlign="center"', true)
  ),
};

export const Responsive: Story = {
  name: 'Auto sizing',
  render: ResponsiveExample,
  args: { slidesPerView: 'auto', maxSlideSize: '280px' },
  ...describe(
    'Keep slides equally sized and no wider than 280 pixels.',
    numberedSource('slidesPerView="auto" maxSlideSize="280px"', true)
  ),
};

export const Breakpoints: Story = {
  name: 'Container breakpoints',
  render: BreakpointsExample,
  args: {
    breakpoints: { 480: { slidesPerView: 2 }, 768: { slidesPerView: 3 } },
  },
  ...describe(
    'Resize the container to change how many slides are visible.',
    breakpointsSource
  ),
};

export const Vertical: Story = {
  name: 'Vertical axis',
  render: VerticalExample,
  args: { axis: 'vertical', crossAxisSize: 'container' },
  ...describe(
    'Swipe up or down within a carousel with a fixed height.',
    numberedSource(
      'axis="vertical" crossAxisSize="container" style={{ height: 320 }}',
      true
    )
  ),
};

export const FreeFlow: Story = {
  name: 'Free dragging',
  render: FreeFlowExample,
  args: { dragMode: 'free' },
  ...describe(
    'Drag to stop between slides, or flick to coast.',
    numberedSource('dragMode="free"', true)
  ),
};

export const WheelBrowsing: Story = {
  name: 'Wheel input',
  render: WheelExample,
  args: { wheel: true },
  ...describe(
    'Use horizontal trackpad gestures or Shift+wheel. Vertical gestures scroll the page.',
    numberedSource('wheel', true)
  ),
};

export const VerticalScroll: Story = {
  name: 'Vertical wheel',
  render: VerticalWheelExample,
  args: { axis: 'vertical', crossAxisSize: 'container', wheel: true },
  ...describe(
    'Scroll through slides with a wheel or trackpad. At either end, the page scrolls.',
    numberedSource(
      'axis="vertical" crossAxisSize="container" wheel style={{ height: 320 }}',
      true
    )
  ),
};

export const ContentSizing: Story = {
  name: 'Content height',
  render: ContentSizingExample,
  args: {},
  ...describe(
    'The viewport height follows the content, even while dragging.',
    contentSource
  ),
};

export const FieldNotes: Story = {
  name: 'Expandable content',
  render: ExpandableExample,
  args: {},
  ...describe(
    'Keep expansion state in the parent so it survives slide recycling.',
    expandableSource
  ),
};

export const FixedHeight: Story = {
  name: 'Fixed height',
  render: FixedHeightExample,
  args: { crossAxisSize: 'container' },
  ...describe(
    'Keep the viewport at a fixed height.',
    numberedSource('crossAxisSize="container" style={{ height: 320 }}', true)
  ),
};

export const SpringAnimation: Story = {
  name: 'Spring animation',
  render: SpringExample,
  args: { animation: { type: 'spring', tension: 180, friction: 16 } },
  ...describe(
    'Adjust spring tension and friction in Controls.',
    numberedSource(
      'animation={{ type: "spring", tension: 180, friction: 16 }}',
      true
    )
  ),
};

export const DurationAnimation: Story = {
  name: 'Duration animation',
  render: DurationExample,
  args: { animation: { type: 'duration', duration: 600 } },
  ...describe(
    'Animate each move over 600 ms.',
    numberedSource('animation={{ type: "duration", duration: 600 }}', true)
  ),
};

export const LargeJumps: Story = {
  name: 'Large collections',
  render: LargeJumpsExample,
  args: {},
  ...describe(
    'Jump through 1,000 items using a small pool of slides.',
    collectionSource
  ),
};

export const InfiniteLoading: Story = {
  name: 'Infinite loading',
  render: InfiniteLoadingExample,
  args: { slidesPerView: 3 },
  ...describe(
    'Browse three slides at a time. A loading card inside the carousel is replaced in place when the next batch arrives.',
    infiniteSource
  ),
};

export const TimePicker: Story = {
  name: 'Time picker',
  render: TimePickerExample,
  args: {
    axis: 'vertical',
    mode: 'loop',
    slidesPerView: 9,
    snapAlign: 'center',
    gap: 0,
    wheel: true,
    dragMode: 'free-snap',
    crossAxisSize: 'container',
    style: { height: 360 },
  },
  ...describe('Two looping wheels select hours and minutes.', timePickerSource),
};
