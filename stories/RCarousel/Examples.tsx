import { useState, useRef, useId } from 'react';
import RCarousel, {
  useCarousel,
  type RCarouselProps,
} from 'recycling-react-carousel';
import {
  Demo,
  demoViewportProps,
  Footer,
  Selection,
  SlideCard,
  SlotCount,
  slides,
} from './Demo.js';
import styles from './Examples.module.css';

export function BasicExample(args: RCarouselProps) {
  return (
    <Demo
      title="Basic dragging"
      description="Drag or swipe between slides without a controller."
    >
      <RCarousel
        {...demoViewportProps(args)}
        aria-label="Basic dragging slides"
        data-testid="carousel"
      >
        {slides}
      </RCarousel>
      <p className={styles.hint}>
        <span aria-hidden="true">{args.axis === 'vertical' ? '↕' : '↔'}</span>{' '}
        Drag a slide {args.axis === 'vertical' ? 'up or down' : 'left or right'}
      </p>
    </Demo>
  );
}

export function ControlledExample(args: RCarouselProps) {
  const carousel = useCarousel();
  return (
    <Demo
      title="Navigation buttons"
      description="Navigation buttons are disabled at either end."
    >
      <RCarousel
        {...demoViewportProps(args)}
        controller={carousel}
        aria-label="Navigation buttons slides"
        data-testid="carousel"
      >
        {slides}
      </RCarousel>
      <Footer
        controller={carousel}
        vertical={args.axis === 'vertical'}
      ></Footer>
    </Demo>
  );
}

export function LoopExample(args: RCarouselProps) {
  const carousel = useCarousel();
  return (
    <Demo title="Loop" description="Keep browsing past either end.">
      <RCarousel
        {...demoViewportProps(args)}
        controller={carousel}
        aria-label="Loop slides"
        data-testid="carousel"
      >
        {slides}
      </RCarousel>
      <Footer controller={carousel} vertical={args.axis === 'vertical'}>
        <span className={styles.stat}>
          Absolute position{' '}
          <strong data-testid="absolute-index">{carousel.absoluteIndex}</strong>
        </span>
      </Footer>
    </Demo>
  );
}

export function InspirationExample(args: RCarouselProps) {
  const carousel = useCarousel();
  return (
    <Demo
      title="Forward loop"
      description="Loop forwards, then go back as far as the starting position."
    >
      <RCarousel
        {...demoViewportProps(args)}
        controller={carousel}
        aria-label="Forward loop slides"
        data-testid="carousel"
      >
        {slides}
      </RCarousel>
      <Footer controller={carousel} vertical={args.axis === 'vertical'}>
        <span className={styles.stat}>
          Absolute position{' '}
          <strong data-testid="absolute-index">{carousel.absoluteIndex}</strong>
        </span>
      </Footer>
    </Demo>
  );
}

export function MultipleSlidesExample(args: RCarouselProps) {
  const carousel = useCarousel();
  return (
    <Demo
      title="Multiple slides"
      description="Show three slides and move one at a time."
    >
      <RCarousel
        {...demoViewportProps(args)}
        controller={carousel}
        aria-label="Multiple slides"
        data-testid="carousel"
      >
        {slides}
      </RCarousel>
      <Footer
        controller={carousel}
        vertical={args.axis === 'vertical'}
      ></Footer>
    </Demo>
  );
}

export function ScrollStepExample(args: RCarouselProps) {
  const carousel = useCarousel();
  return (
    <Demo
      title="Scroll step"
      description="Show three slides and move two at a time."
    >
      <RCarousel
        {...demoViewportProps(args)}
        controller={carousel}
        aria-label="Scroll step slides"
        data-testid="carousel"
      >
        {slides}
      </RCarousel>
      <Footer
        controller={carousel}
        vertical={args.axis === 'vertical'}
      ></Footer>
    </Demo>
  );
}

export function GalleryExample(args: RCarouselProps) {
  const carousel = useCarousel();
  return (
    <Demo
      title="Centered slides"
      description="Center the active slide and preview its neighbors."
    >
      <RCarousel
        {...demoViewportProps(args)}
        controller={carousel}
        aria-label="Centered slides"
        data-testid="carousel"
      >
        {slides}
      </RCarousel>
      <Footer
        controller={carousel}
        vertical={args.axis === 'vertical'}
      ></Footer>
    </Demo>
  );
}

export function ResponsiveExample(args: RCarouselProps) {
  const carousel = useCarousel();
  return (
    <Demo
      title="Auto sizing"
      description="Keep slides equally sized and no wider than 280 pixels."
    >
      <RCarousel
        {...demoViewportProps(args)}
        controller={carousel}
        aria-label="Auto sizing slides"
        data-testid="carousel"
      >
        {slides}
      </RCarousel>
      <Footer
        controller={carousel}
        vertical={args.axis === 'vertical'}
      ></Footer>
    </Demo>
  );
}

export function VerticalExample(args: RCarouselProps) {
  const carousel = useCarousel();
  return (
    <Demo
      title="Vertical axis"
      description="Swipe up or down within a carousel with a fixed height."
    >
      <RCarousel
        {...demoViewportProps(args)}
        controller={carousel}
        aria-label="Vertical axis slides"
        data-testid="carousel"
      >
        {slides}
      </RCarousel>
      <Footer
        controller={carousel}
        vertical={args.axis === 'vertical'}
      ></Footer>
    </Demo>
  );
}

export function FreeFlowExample(args: RCarouselProps) {
  const carousel = useCarousel();
  return (
    <Demo
      title="Free dragging"
      description="Drag to stop between slides, or flick to coast."
    >
      <RCarousel
        {...demoViewportProps(args)}
        controller={carousel}
        aria-label="Free dragging slides"
        data-testid="carousel"
      >
        {slides}
      </RCarousel>
      <Footer
        controller={carousel}
        vertical={args.axis === 'vertical'}
      ></Footer>
    </Demo>
  );
}

export function WheelExample(args: RCarouselProps) {
  const carousel = useCarousel();
  return (
    <Demo
      title="Wheel input"
      description="Use horizontal trackpad gestures or Shift+wheel. Vertical gestures scroll the page."
    >
      <RCarousel
        {...demoViewportProps(args)}
        controller={carousel}
        aria-label="Wheel input slides"
        data-testid="carousel"
      >
        {slides}
      </RCarousel>
      <Footer
        controller={carousel}
        vertical={args.axis === 'vertical'}
      ></Footer>
    </Demo>
  );
}

export function VerticalWheelExample(args: RCarouselProps) {
  const carousel = useCarousel();
  return (
    <Demo
      title="Vertical wheel"
      description="Scroll through slides with a wheel or trackpad. At either end, the page scrolls."
    >
      <RCarousel
        {...demoViewportProps(args)}
        controller={carousel}
        aria-label="Vertical wheel slides"
        data-testid="carousel"
      >
        {slides}
      </RCarousel>
      <Footer
        controller={carousel}
        vertical={args.axis === 'vertical'}
      ></Footer>
    </Demo>
  );
}

export function FixedHeightExample(args: RCarouselProps) {
  const carousel = useCarousel();
  return (
    <Demo
      title="Fixed height"
      description="Keep the viewport at 320 pixels high."
    >
      <RCarousel
        {...demoViewportProps(args)}
        controller={carousel}
        aria-label="Fixed height slides"
        data-testid="carousel"
      >
        {slides}
      </RCarousel>
      <Footer
        controller={carousel}
        vertical={args.axis === 'vertical'}
      ></Footer>
    </Demo>
  );
}

export function SpringExample(args: RCarouselProps) {
  const carousel = useCarousel();
  return (
    <Demo
      title="Spring animation"
      description="Adjust spring tension and friction in Controls."
    >
      <RCarousel
        {...demoViewportProps(args)}
        controller={carousel}
        aria-label="Spring animation slides"
        data-testid="carousel"
      >
        {slides}
      </RCarousel>
      <Footer
        controller={carousel}
        vertical={args.axis === 'vertical'}
      ></Footer>
    </Demo>
  );
}

export function DurationExample(args: RCarouselProps) {
  const carousel = useCarousel();
  return (
    <Demo
      title="Duration animation"
      description="Animate each move over 600 ms."
    >
      <RCarousel
        {...demoViewportProps(args)}
        controller={carousel}
        aria-label="Duration animation slides"
        data-testid="carousel"
      >
        {slides}
      </RCarousel>
      <Footer
        controller={carousel}
        vertical={args.axis === 'vertical'}
      ></Footer>
    </Demo>
  );
}

export function PaginationExample(args: RCarouselProps) {
  const carousel = useCarousel();
  return (
    <Demo
      title="Pagination"
      description="Choose a page with numbered buttons. The active page stays focusable."
    >
      <RCarousel
        {...demoViewportProps(args)}
        controller={carousel}
        aria-label="Pagination slides"
        data-testid="carousel"
      >
        {slides}
      </RCarousel>
      <nav className={styles.pagination} aria-label="Choose a page">
        {carousel.getPageIndexes().map((page) => (
          <button key={page} {...carousel.getPageButtonProps(page)}>
            {page + 1}
          </button>
        ))}
      </nav>
    </Demo>
  );
}

export function BreakpointsExample(args: RCarouselProps) {
  const carousel = useCarousel();
  const [width, setWidth] = useState(900);
  return (
    <Demo
      title="Container breakpoints"
      description="Resize the container to change how many slides are visible."
    >
      <label className={styles.resizeControl}>
        Container width
        <input
          type="range"
          min="280"
          max="900"
          step="1"
          value={width}
          onChange={(event) => setWidth(Number(event.currentTarget.value))}
        />
        <output>{width}px maximum</output>
      </label>
      <div className={styles.resizable} style={{ width }}>
        <RCarousel
          {...demoViewportProps(args)}
          controller={carousel}
          aria-label="Container breakpoint slides"
          data-testid="carousel"
        >
          {slides}
        </RCarousel>
        <Footer controller={carousel} vertical={args.axis === 'vertical'}>
          <span className={styles.stat}>
            <strong data-testid="visible-count">
              {carousel.slidesPerView}
            </strong>{' '}
            in view
          </span>
        </Footer>
      </div>
    </Demo>
  );
}

const content = [
  {
    title: 'Short content',
    paragraphs: ['This short note only needs a little space.'],
  },
  {
    title: 'Long content',
    paragraphs: [
      'This slide has several paragraphs to show how the carousel handles longer content. Its height comes from the text, without a fixed height.',
      'Drag slowly toward the next slide. The viewport changes height as the content moves, rather than waiting for the slide to settle.',
      'Try changing direction halfway through a drag. The height follows the movement back toward the previous slide.',
      'At narrower widths, the text wraps onto more lines. The carousel measures the new height when its container resizes.',
      'Use the buttons below to compare this slide with the shorter notes on either side.',
    ],
  },
  {
    title: 'Medium content',
    paragraphs: [
      'This slide has two short paragraphs.',
      'Resize the container to see the text wrap and the viewport adjust.',
    ],
  },
  {
    title: 'Another short note',
    paragraphs: ['Hidden slides do not keep the viewport tall.'],
  },
  {
    title: 'A second medium note',
    paragraphs: [
      'Each slide uses the space its content needs.',
      'Return to the first slide to compare their heights.',
    ],
  },
  {
    title: 'The final note',
    paragraphs: [
      'The Next button is disabled at the end. Use Previous to go back.',
    ],
  },
];

export function ContentSizingExample(args: RCarouselProps) {
  const carousel = useCarousel();
  return (
    <Demo
      title="Content height"
      description="The viewport height follows the content, even while dragging."
    >
      <RCarousel
        {...demoViewportProps(args)}
        controller={carousel}
        aria-label="Content height slides"
        data-testid="carousel"
      >
        {content.map((item, index) => (
          <figure
            key={item.title}
            className={styles.contentCard}
            data-content-index={index}
          >
            <figcaption>
              <strong>{item.title}</strong>
              <span>{String(index + 1).padStart(2, '0')}</span>
            </figcaption>
            <div className={styles.prose}>
              {item.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </figure>
        ))}
      </RCarousel>
      <Footer controller={carousel} vertical={args.axis === 'vertical'} />
      <Selection
        controller={carousel}
        labels={content.map((item) => item.title)}
      />
    </Demo>
  );
}

export function ExpandableExample(args: RCarouselProps) {
  const carousel = useCarousel();
  const region = useId();
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(
    () => new Set()
  );
  return (
    <Demo
      title="Expandable content"
      description="Expand a slide to resize it. It stays expanded when you return."
    >
      <RCarousel
        {...demoViewportProps(args)}
        controller={carousel}
        aria-label="Expandable content slides"
        data-testid="carousel"
      >
        {Array.from({ length: 6 }, (_, id) => (
          <figure key={id} className={styles.contentCard} data-item-index={id}>
            <figcaption>
              <strong>Slide {id + 1}</strong>
              <span>Expandable</span>
            </figcaption>
            <div className={styles.prose}>
              <p>
                Expand this slide to reveal more text and watch the viewport
                grow.
              </p>
            </div>
            <button
              type="button"
              className={styles.expandButton}
              aria-expanded={expanded.has(id)}
              aria-controls={`${region}-${id}`}
              onClick={() =>
                setExpanded((current) => {
                  const next = new Set(current);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                })
              }
            >
              {expanded.has(id) ? 'Show less' : 'Show more'}
            </button>
            <div
              id={`${region}-${id}`}
              hidden={!expanded.has(id)}
              className={styles.prose}
            >
              <p>
                Leave this slide, then come back. It stays expanded because the
                parent stores its state by item ID, even when the carousel
                unmounts the slide.
              </p>
              <p>
                The carousel measures the extra content and adjusts the viewport
                height. Select Show less to collapse it again.
              </p>
            </div>
          </figure>
        ))}
      </RCarousel>
      <Footer controller={carousel} vertical={args.axis === 'vertical'} />
    </Demo>
  );
}

const items = Array.from({ length: 1000 }, (_, id) => ({ id }));

export function LargeJumpsExample(args: RCarouselProps) {
  const carousel = useCarousel();
  const viewport = useRef<HTMLDivElement>(null);
  return (
    <Demo
      title="Large collections"
      description="Jump through 1,000 items using a small pool of slides."
    >
      <form
        className={styles.jumpForm}
        onSubmit={(event) => {
          event.preventDefault();
          const value = Number(new FormData(event.currentTarget).get('slide'));
          if (Number.isInteger(value) && value >= 1 && value <= items.length)
            carousel.goTo(value - 1);
        }}
      >
        <label htmlFor="collection-slide">Slide number</label>
        <input
          id="collection-slide"
          name="slide"
          type="number"
          min="1"
          max="1000"
          step="1"
          defaultValue="950"
          required
        />
        <button type="submit" className={styles.primaryButton}>
          Go to slide
        </button>
        <SlotCount viewport={viewport} />
      </form>
      <RCarousel
        {...demoViewportProps(args)}
        ref={viewport}
        children={undefined}
        controller={carousel}
        aria-label="Large collection slides"
        data-testid="carousel"
        items={items}
        getItemKey={(item) => item.id}
        renderItem={(item) => (
          <SlideCard index={item.id} count={items.length} />
        )}
      />
      <Footer controller={carousel} vertical={args.axis === 'vertical'} />
    </Demo>
  );
}
