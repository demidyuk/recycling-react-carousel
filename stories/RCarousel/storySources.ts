const imports =
  "import RCarousel, { useCarousel } from 'recycling-react-carousel';";
const slideSource = `const slides = Array.from({ length: 6 }, (_, index) => (
  <article key={index} style={{ height: 280, background: '#f0f4fb' }}>
    Slide {index + 1}
  </article>
));`;

export function numberedSource(configuration = '', controlled = true) {
  return `${imports}\n\n${configuration.includes('crossAxisSize') ? slideSource.replace('height: 280', "height: '100%'") : slideSource}\n\nexport function Example() {
  ${controlled ? 'const carousel = useCarousel();' : ''}
  return (
    <>
      <RCarousel ${controlled ? 'controller={carousel} ' : ''}${configuration} gap={16}
        aria-label="Example slides">
        {slides}
      </RCarousel>${
        controlled
          ? `\n      <button {...carousel.getPrevButtonProps()}>Previous slide</button>
      <button {...carousel.getNextButtonProps()}>Next slide</button>`
          : ''
      }
    </>
  );
}`;
}

export const paginationSource = `${imports}

${slideSource}

export function Example() {
  const carousel = useCarousel();
  return <>
    <RCarousel controller={carousel} gap={16} aria-label="Pagination slides">
      {slides}
    </RCarousel>
    <nav aria-label="Choose a page">
      {carousel.getPageIndexes().map(page => (
        <button key={page} {...carousel.getPageButtonProps(page)}>{page + 1}</button>
      ))}
    </nav>
  </>;
}`;

export const breakpointsSource = `import { useState } from 'react';
${imports}

${slideSource}

export function Example() {
  const carousel = useCarousel();
  const [width, setWidth] = useState(900);
  return <>
    <label>Container width
      <input type="range" min={280} max={900} value={width}
        onChange={event => setWidth(Number(event.currentTarget.value))} />
    </label>
    <div style={{ width, maxWidth: '100%' }}>
      <RCarousel controller={carousel} gap={16}
        breakpoints={{ 480: { slidesPerView: 2 }, 768: { slidesPerView: 3 } }}
        aria-label="Container breakpoint slides">
        {slides}
      </RCarousel>
      <button {...carousel.getPrevButtonProps()}>Previous slide</button>
      <button {...carousel.getNextButtonProps()}>Next slide</button>
    </div>
  </>;
}`;

export const contentSource = `${imports}

const notes = [
  { id: 'short', title: 'Short content', paragraphs: ['A short note.'] },
  { id: 'long', title: 'Long content', paragraphs: [
    'A longer note can use the space it needs.',
    'Each paragraph contributes to the slide’s natural height.',
    'The viewport follows this height during navigation and dragging.',
  ] },
];

export function Example() {
  const carousel = useCarousel();
  return <>
    <RCarousel controller={carousel} gap={16} aria-label="Content height slides">
      {notes.map(note => <article key={note.id} style={{ padding: 32 }}>
        <h2>{note.title}</h2>
        {note.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
      </article>)}
    </RCarousel>
    <button {...carousel.getPrevButtonProps()}>Previous slide</button>
    <button {...carousel.getNextButtonProps()}>Next slide</button>
  </>;
}`;

export const expandableSource = `import { useState, useId } from 'react';
${imports}

const items = Array.from({ length: 6 }, (_, id) => ({ id }));

export function Example() {
  const carousel = useCarousel();
  const region = useId();
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(() => new Set());
  function toggle(id: number) {
    setExpanded(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  return <>
    <RCarousel controller={carousel} gap={16} aria-label="Expandable slides">
      {items.map(item => <article key={item.id} style={{ padding: 32 }}>
        <h2>Slide {item.id + 1}</h2>
        <button type="button" aria-expanded={expanded.has(item.id)}
          aria-controls={region + item.id} onClick={() => toggle(item.id)}>
          {expanded.has(item.id) ? 'Show less' : 'Show more'}
        </button>
        <div id={region + item.id} hidden={!expanded.has(item.id)}>
          <p>Extra content changes the slide’s natural height.</p>
          <p>State stored in the parent survives slide recycling.</p>
        </div>
      </article>)}
    </RCarousel>
    <button {...carousel.getPrevButtonProps()}>Previous slide</button>
    <button {...carousel.getNextButtonProps()}>Next slide</button>
  </>;
}`;

export const collectionSource = `${imports}

const items = Array.from({ length: 1000 }, (_, id) => ({ id }));

export function Example() {
  const carousel = useCarousel();
  return <>
    <form onSubmit={event => {
      event.preventDefault();
      const number = Number(new FormData(event.currentTarget).get('slide'));
      if (Number.isInteger(number) && number >= 1 && number <= items.length)
        carousel.goTo(number - 1);
    }}>
      <label>Slide number
        <input name="slide" type="number" min={1} max={1000}
          step={1} defaultValue={950} required />
      </label>
      <button type="submit">Go to slide</button>
    </form>
    <RCarousel controller={carousel} items={items} gap={16}
      getItemKey={item => item.id}
      renderItem={item => <article style={{ height: 280 }}>Slide {item.id + 1}</article>}
      aria-label="Large collection slides" />
    <button {...carousel.getPrevButtonProps()}>Previous slide</button>
    <button {...carousel.getNextButtonProps()}>Next slide</button>
  </>;
}`;

export const infiniteSource = `import { useCallback, useEffect, useRef, useState } from 'react';
import RCarousel, { useCarousel } from 'recycling-react-carousel';

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

export function Example() {
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

  return <>
    <RCarousel ref={viewport} controller={carousel} slidesPerView={3} gap={16}
      aria-label="Infinite loading slides" aria-busy={loading}
      items={feed} getItemKey={item => item.id}
      renderItem={item => item.id === 'loading' ? (
        <article ref={setEndCard} style={{ height: 280, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 16,
          border: '1px dashed #d5e1fa', borderRadius: 14 }}>
          <span className="loading-spinner" aria-hidden="true" style={{
            display: 'inline-block', width: 28, height: 28,
            border: '2px solid #d5e1fa', borderTopColor: '#3568d4',
            borderRadius: '50%', animation: 'loadingSpin 0.7s linear infinite',
          }} />
          <p>Loading more items…</p>
        </article>
      ) : <article style={{ height: 280 }}>Slide {item.id}</article>} />
    <button {...carousel.getPrevButtonProps()}>Previous slide</button>
    <button {...carousel.getNextButtonProps()}>Next slide</button>
    <style>{'@keyframes loadingSpin { to { transform: rotate(360deg); } } @media (prefers-reduced-motion: reduce) { .loading-spinner { animation: none !important; } }'}</style>
    <p role="status" aria-label="Loading status">
      {loading ? 'Loading more items…' : 'Ready to load more'}
    </p>
    <button disabled={loading}
      onClick={loadMore}>
      Load more items
    </button>
  </>;
}`;
