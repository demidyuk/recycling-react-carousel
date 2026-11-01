import { useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import RCarousel, {
  useCarousel,
  type RCarouselProps,
} from 'recycling-react-carousel';

const imageSource =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="160"><rect width="300" height="160" fill="steelblue"/></svg>'
  );

function InteractiveExample({
  kind = 'button',
  initialCursor = 0,
  contentSizing = false,
  axis = 'horizontal',
  animation = { type: 'duration', duration: 350 },
  dragMode = 'snap',
}: {
  kind?: 'button' | 'image' | 'link';
  initialCursor?: number;
  contentSizing?: boolean;
} & Pick<RCarouselProps, 'axis' | 'animation' | 'dragMode'>) {
  const carousel = useCarousel();
  const [cursor, setCursor] = useState(initialCursor);
  const [visible, setVisible] = useState(1);
  const [dragEnabled, setDragEnabled] = useState(true);
  const [clicks, setClicks] = useState(0);
  const [rootClicks, setRootClicks] = useState(0);
  const [pointerDowns, setPointerDowns] = useState(0);
  const [width, setWidth] = useState(300);
  const slides = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => {
        const content =
          kind === 'image' ? (
            <img
              alt={`Image ${index}`}
              src={imageSource}
              style={{ width: '100%', height: 160 }}
            />
          ) : (
            `Item ${index}`
          );
        const style = {
          display: 'block',
          width: '100%',
          height: contentSizing && index === 0 ? 400 : 100,
        };
        const onClick = () => setClicks((count) => count + 1);
        return kind === 'link' ? (
          <a
            key={index}
            href={`#item-${index}`}
            style={style}
            onClick={onClick}
          >
            {content}
          </a>
        ) : kind === 'button' ? (
          <button key={index} type="button" style={style} onClick={onClick}>
            {content}
          </button>
        ) : (
          <div key={index} style={style} onClick={onClick}>
            {content}
          </div>
        );
      }),
    [contentSizing, kind]
  );

  return (
    <div style={{ padding: 24 }}>
      <button data-testid="before">Before</button>
      <RCarousel
        controller={carousel}
        axis={axis}
        dragMode={dragMode}
        aria-label="Example products"
        data-testid="interaction-carousel"
        absoluteIndex={cursor}
        onAbsoluteIndexChange={setCursor}
        onPointerDown={() => setPointerDowns((count) => count + 1)}
        onClick={() => setRootClicks((count) => count + 1)}
        slidesPerView={visible}
        drag={dragEnabled}
        crossAxisSize={contentSizing ? 'content' : 'container'}
        animation={animation}
        style={{
          width,
          height: contentSizing ? undefined : 180,
          userSelect: 'none',
        }}
      >
        {slides}
      </RCarousel>
      <button data-testid="after">After</button>
      <output data-testid="interaction-cursor">{cursor}</output>
      <output data-testid="interaction-clicks">{clicks}</output>
      <output data-testid="interaction-root-clicks">{rootClicks}</output>
      <output data-testid="interaction-moving">
        {String(carousel.isAnimating)}
      </output>
      <output data-testid="interaction-pointer-downs">{pointerDowns}</output>
      <button
        data-testid="interaction-next"
        onClick={() => setCursor((value) => value + 1)}
      >
        Next
      </button>
      <button
        data-testid="interaction-visible"
        onClick={() => setVisible((value) => (value === 1 ? 2 : 1))}
      >
        Resize items
      </button>
      <button
        data-testid="interaction-drag-enabled"
        onClick={() => setDragEnabled((value) => !value)}
      >
        Toggle dragging
      </button>
      <button
        data-testid="interaction-width"
        onClick={() => setWidth((value) => value + 1)}
      >
        Resize width
      </button>
    </div>
  );
}

function HiddenExample() {
  const [hidden, setHidden] = useState(true);
  const carousel = useCarousel();
  const [position, setPosition] = useState(100);
  return (
    <div>
      <button
        data-testid="interaction-toggle-hidden"
        onClick={() => setHidden((value) => !value)}
      >
        Toggle visibility
      </button>
      <output data-testid="interaction-cursor">{position}</output>
      <button data-testid="interaction-next" {...carousel.getNextButtonProps()}>
        Next
      </button>
      <div style={{ display: hidden ? 'none' : 'block' }}>
        <RCarousel
          controller={carousel}
          absoluteIndex={position}
          onAbsoluteIndexChange={setPosition}
          crossAxisSize="container"
          mode="forward-loop"
          slidesPerView={1}
          data-testid="interaction-carousel"
          style={{ width: 300, height: 180, userSelect: 'none' }}
        >
          {[0, 1, 2].map((index) => (
            <button key={index}>Item {index}</button>
          ))}
        </RCarousel>
      </div>
    </div>
  );
}

const meta = {
  title: 'Regression/Interactions',
  component: InteractiveExample,
} satisfies Meta<typeof InteractiveExample>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Buttons: Story = {};
export const Keyboard: Story = { args: { initialCursor: 1 } };
export const Images: Story = { args: { kind: 'image' } };
export const Links: Story = { args: { kind: 'link' } };
export const ContentSize: Story = { args: { contentSizing: true } };
export const HiddenInitialization: Story = { render: () => <HiddenExample /> };
