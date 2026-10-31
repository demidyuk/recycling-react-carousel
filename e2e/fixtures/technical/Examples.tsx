import { useCallback, useId, useMemo } from 'react';
import RCarousel, {
  useCarousel,
  type RCarouselProps,
  type CarouselAnimation,
} from 'recycling-react-carousel';
import ExampleCard from './ExampleCard.js';
import styles from './Examples.module.css';

export interface ExampleArgs extends RCarouselProps {
  itemCount: number;
  cardContent: 'simple' | 'rich';
  motion: 'spring' | 'bouncy' | 'duration';
}

const motionPresets: Record<
  ExampleArgs['motion'],
  CarouselAnimation | undefined
> = {
  spring: undefined,
  bouncy: { type: 'spring', tension: 180, friction: 12 },
  duration: {
    type: 'duration',
    duration: 500,
    easing: (value) => 1 - (1 - value) ** 3,
  },
};

function Example({
  args,
  title,
  description,
  controlled = true,
  jumps = false,
  sizing = false,
}: {
  args: ExampleArgs;
  title: string;
  description: string;
  controlled?: boolean;
  jumps?: boolean;
  sizing?: boolean;
}) {
  const { itemCount, cardContent, motion, ...carouselProps } = args;
  const navigation = useCarousel();
  const selectionId = useId();
  const items = useMemo(
    () => Array.from({ length: itemCount }, (_, index) => index),
    [itemCount]
  );
  const renderItem = useCallback(
    (index: number) => (
      <ExampleCard
        key={index}
        data-item-index={index}
        index={index}
        rich={cardContent === 'rich'}
        intrinsic={sizing}
        tall={sizing && (index === 3 || index === 4)}
      >
        {index + 1}
      </ExampleCard>
    ),
    [cardContent, sizing]
  );
  const slides = useMemo(
    () => (jumps ? undefined : items.map(renderItem)),
    [items, jumps, renderItem]
  );
  const viewportProps = {
    ...carouselProps,
    controller: controlled ? navigation : undefined,
    role: 'group',
    'aria-label': `${title} slides`,
    'data-testid': 'carousel',
    animation:
      carouselProps.animation ?? (jumps ? motionPresets[motion] : undefined),
    style: sizing
      ? { height: carouselProps.crossAxisSize === 'content' ? undefined : 280 }
      : carouselProps.style,
  };

  return (
    <section className={styles.example} aria-label={title}>
      <header className={styles.header}>
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
      {controlled && (
        <nav className={styles.controls} aria-label="Slide navigation">
          <button {...navigation.getPrevButtonProps()}>Previous slide</button>
          <button {...navigation.getNextButtonProps()}>Next slide</button>
          <div className={styles.selection}>
            <label htmlFor={selectionId}>Go to slide</label>
            <select
              id={selectionId}
              value={navigation.index}
              onChange={(event) =>
                navigation.goTo(Number(event.currentTarget.value))
              }
            >
              {items.map((index) => (
                <option key={index} value={index}>
                  {index + 1}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() =>
              jumps ? navigation.goToAbsolute(0) : navigation.goTo(0)
            }
          >
            First slide
          </button>
          <button
            type="button"
            onClick={() =>
              jumps
                ? navigation.goToAbsolute(itemCount - 1)
                : navigation.goTo(itemCount - 1)
            }
          >
            Last slide
          </button>
        </nav>
      )}
      {jumps && (
        <div className={styles.controls}>
          <button
            type="button"
            onClick={() => navigation.goToAbsolute(1_000_000)}
          >
            Jump +1,000,000
          </button>
          <button
            type="button"
            onClick={() => navigation.goToAbsolute(-1_000_000)}
          >
            Jump −1,000,000
          </button>
        </div>
      )}
      {jumps ? (
        <RCarousel
          {...viewportProps}
          children={undefined}
          items={items}
          renderItem={renderItem}
          getItemKey={(index) => index}
        />
      ) : (
        <RCarousel {...viewportProps}>{slides}</RCarousel>
      )}
      {controlled ? (
        <p className={styles.position}>
          Slide{' '}
          <output data-testid="slide-number">{navigation.index + 1}</output> of{' '}
          {itemCount} <span aria-hidden="true">·</span> Absolute index{' '}
          <output data-testid="cursor">{navigation.absoluteIndex}</output>
        </p>
      ) : (
        <p className={styles.position}>
          Drag a slide left or right to navigate.
        </p>
      )}
    </section>
  );
}

// Reset example-owned navigation when Controls change its starting configuration.
const exampleKey = (args: ExampleArgs) =>
  JSON.stringify([
    args.mode,
    args.axis,
    args.slidesPerView,
    args.defaultIndex,
    args.itemCount,
  ]);

export const BasicExample = (args: ExampleArgs) => (
  <Example
    key={exampleKey(args)}
    args={args}
    controlled={false}
    title="Swipe through slides"
    description="Adjust gestures and the swipe threshold in Controls."
  />
);

export const ControlledExample = (args: ExampleArgs) => (
  <Example
    key={exampleKey(args)}
    args={args}
    title="Control navigation"
    description="Navigate with buttons or select a slide."
  />
);

export const ResponsiveExample = (args: ExampleArgs) => (
  <Example
    key={exampleKey(args)}
    args={args}
    title="Adapt to the container"
    description="The available container width controls the visible count and navigation step."
  />
);

export const VerticalExample = (args: ExampleArgs) => (
  <Example
    key={exampleKey(args)}
    args={args}
    title="Navigate vertically"
    description="Swipe up or down, or use the navigation buttons."
  />
);

export const LargeJumpsExample = (args: ExampleArgs) => (
  <Example
    key={exampleKey(args)}
    args={args}
    jumps
    title="Explore a large collection"
    description={`Browse ${args.itemCount} items or jump a million positions in either direction.`}
  />
);

export const ContentSizingExample = (args: ExampleArgs) => (
  <Example
    key={exampleKey(args)}
    args={args}
    sizing
    title="Fit the content"
    description="Navigate between short and tall cards to explore content sizing."
  />
);
