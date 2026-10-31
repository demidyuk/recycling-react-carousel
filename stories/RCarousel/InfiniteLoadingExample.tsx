import { useCallback, useEffect, useRef, useState } from 'react';
import RCarousel, {
  useCarousel,
  type RCarouselProps,
} from 'recycling-react-carousel';
import { Demo, Footer, SlideCard, demoViewportProps } from './Demo.js';
import styles from './Examples.module.css';

type RecordItem = { id: number };
const loadingItem = { id: 'loading' } as const;
type FeedItem = RecordItem | typeof loadingItem;

const BATCH_SIZE = 6;
const REQUEST_DELAY = 900;

// Keep IDs unique when batches are appended.
function recordPage(offset: number, count = BATCH_SIZE): RecordItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: offset + index + 1,
  }));
}

export function InfiniteLoadingExample(args: RCarouselProps) {
  const carousel = useCarousel();
  const viewport = useRef<HTMLDivElement>(null);
  const [endCard, setEndCard] = useState<HTMLElement | null>(null);
  const [{ records: crate, offset }, setCollection] = useState<{
    records: RecordItem[];
    offset: number | null;
  }>(() => ({ records: recordPage(0, 9), offset: null }));
  const loading = offset !== null;
  const loadMore = useCallback(() => {
    setCollection((current) =>
      current.offset !== null
        ? current
        : { ...current, offset: current.records.length }
    );
  }, []);
  // Keep the end card mounted so starting a request cannot change geometry.
  // Appended records replace it in place; the end card moves after the batch.
  const feed: FeedItem[] = [...crate, loadingItem];

  useEffect(() => {
    if (offset === null) return;
    const timer = setTimeout(() => {
      setCollection((current) =>
        current.offset === offset
          ? {
              records: [...current.records, ...recordPage(offset)],
              offset: null,
            }
          : current
      );
    }, REQUEST_DELAY);
    return () => clearTimeout(timer);
  }, [offset]);

  useEffect(() => {
    if (!endCard) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.intersectionRatio >= 0.01 && endCard.isConnected) loadMore();
      },
      { root: viewport.current, threshold: 0.01 }
    );
    observer.observe(endCard);
    return () => observer.disconnect();
  }, [endCard, loadMore]);

  return (
    <Demo
      title="Infinite loading"
      description="Browse three slides at a time. The loading card at the end is replaced by the next batch."
    >
      <div className={styles.metrics}>
        <span className={styles.stat} data-testid="loaded-records">
          {crate.length} items loaded
        </span>
      </div>
      <RCarousel
        {...demoViewportProps(args)}
        ref={viewport}
        controller={carousel}
        aria-label="Infinite loading slides"
        aria-busy={loading}
        data-testid="carousel"
        children={undefined}
        items={feed}
        getItemKey={(record) => record.id}
        renderItem={(record) =>
          record.id === 'loading' ? (
            <article
              ref={setEndCard}
              className={`${styles.card} ${styles.loadingCard}`}
              data-testid="loading-card"
            >
              <span
                className={styles.spinner}
                data-testid="loading-spinner"
                aria-hidden="true"
              />
              <p>Loading more items…</p>
            </article>
          ) : (
            <SlideCard index={record.id - 1} count={crate.length} />
          )
        }
      />
      <Footer controller={carousel} vertical={args.axis === 'vertical'} />
      <div className={styles.loadingFooter}>
        <div
          className={styles.status}
          role="status"
          aria-label="Loading status"
          aria-atomic="true"
        >
          <span>{loading ? 'Loading more items…' : 'Ready to load more'}</span>
        </div>
        <button
          type="button"
          className={styles.primaryButton}
          disabled={loading}
          onClick={loadMore}
        >
          Load more items
        </button>
      </div>
    </Demo>
  );
}
