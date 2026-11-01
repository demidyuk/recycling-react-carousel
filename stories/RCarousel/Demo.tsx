import { useEffect, useState, type ReactNode } from 'react';
import type {
  CarouselController,
  RCarouselProps,
} from 'recycling-react-carousel';
import styles from './Examples.module.css';

/** Keep presentation usable when Controls change axis or sizing in any story. */
export function demoViewportProps(args: RCarouselProps) {
  const vertical = args.axis === 'vertical';
  const fixed = args.crossAxisSize === 'container';
  return {
    ...args,
    // Initial-position Controls must start a fresh carousel, while controlled
    // position updates continue to navigate the existing instance.
    key: JSON.stringify([
      args.defaultIndex,
      args.defaultAbsoluteIndex,
      args.index !== undefined,
      args.absoluteIndex !== undefined,
    ]),
    className: [
      styles.viewport,
      vertical ? styles.vertical : fixed ? styles.fixed : '',
      args.className,
    ]
      .filter(Boolean)
      .join(' '),
    style: { ...(vertical || fixed ? { height: 320 } : {}), ...args.style },
  };
}

export function Demo({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className={styles.demo}>
      <header className={styles.header}>
        <div className={styles.kicker}>
          <span />
          RCarousel<span className={styles.divider}>/</span>Examples
        </div>
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
      <section className={styles.example} aria-label={`${title} demo`}>
        {children}
      </section>
    </main>
  );
}

export function SlideCard({
  index,
  count = 6,
}: {
  index: number;
  count?: number;
}) {
  return (
    <article
      className={styles.card}
      data-item-index={index}
      data-tone={index % 3}
    >
      <div className={styles.cardTop}>
        <span>Slide</span>
        <span>
          {String(index + 1).padStart(2, '0')} /{' '}
          {String(count).padStart(2, '0')}
        </span>
      </div>
      <span className={styles.cardNumber} aria-hidden="true">
        {String(index + 1).padStart(2, '0')}
      </span>
      <span className={styles.srOnly}>Slide {index + 1}</span>
      <div className={styles.cardBottom} aria-hidden="true">
        <span />
      </div>
    </article>
  );
}

export function NumberSlides({ count = 6 }: { count?: number }) {
  // Return separate children so RCarousel can measure each card.
  return Array.from({ length: count }, (_, index) => (
    <SlideCard key={index} index={index} count={count} />
  ));
}

export const slides = NumberSlides({});

export function Navigation({
  controller,
  vertical = false,
}: {
  controller: CarouselController;
  vertical?: boolean;
}) {
  return (
    <nav className={styles.navigation} aria-label="Slide navigation">
      <button
        {...controller.getPrevButtonProps({ 'aria-label': 'Previous slide' })}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          style={{ transform: vertical ? 'rotate(90deg)' : undefined }}
        >
          <path d="m14 6-6 6 6 6M8 12h12" />
        </svg>
      </button>
      <button
        {...controller.getNextButtonProps({ 'aria-label': 'Next slide' })}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          style={{ transform: vertical ? 'rotate(90deg)' : undefined }}
        >
          <path d="m10 6 6 6-6 6M16 12H4" />
        </svg>
      </button>
    </nav>
  );
}

export function Footer({
  controller,
  vertical,
  children,
}: {
  controller: CarouselController;
  vertical?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={styles.footer}>
      <output className={styles.position} aria-live="polite" aria-atomic="true">
        Slide{' '}
        <strong data-testid="slide-number">
          {String(controller.index + 1).padStart(2, '0')}
        </strong>
        <span className={styles.muted}>
          {' '}
          / {String(controller.slideCount).padStart(2, '0')}
        </span>
      </output>
      {children}
      <Navigation controller={controller} vertical={vertical} />
    </div>
  );
}

export function Selection({
  controller,
  labels,
}: {
  controller: CarouselController;
  labels: string[];
}) {
  return (
    <nav className={styles.selection} aria-label="Choose a slide">
      {labels.map((label, index) => (
        <button
          key={label}
          type="button"
          aria-pressed={controller.index === index}
          onClick={() => controller.goTo(index)}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}

export function SlotCount({
  viewport,
}: {
  viewport: React.RefObject<HTMLDivElement | null>;
}) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const root = viewport.current;
    if (!root) return;
    const update = () =>
      setCount(root.querySelectorAll(':scope > [data-carousel-slide]').length);
    const observer = new MutationObserver(update);
    observer.observe(root, { childList: true });
    update();
    return () => observer.disconnect();
  });
  return (
    <span className={styles.stat}>
      <strong data-testid="slot-count">{count}</strong> rendered slots
    </span>
  );
}
