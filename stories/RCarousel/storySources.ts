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

export const timePickerSource = `import { useEffect, useRef, useState } from 'react';
import RCarousel, { useCarousel } from 'recycling-react-carousel';

const hours = Array.from({ length: 24 }, (_, value) => value);
const minutes = Array.from({ length: 60 }, (_, value) => value);

function Wheel({ values, initial, label, unit }: {
  values: number[]; initial: number; label: string; unit: string;
}) {
  const carousel = useCarousel();
  const column = useRef<HTMLDivElement>(null);
  const current = useRef(initial);
  const [selected, setSelected] = useState(initial);

  useEffect(() => {
    let anchor: number | undefined;
    let size: number | undefined;
    return carousel.subscribeMotion(motion => {
      const surface = column.current;
      if (!surface) return;
      const radius = motion.slidePitch / (2 * Math.tan(Math.PI / 18));
      const side = label === 'Hours' ? 1 : -1;
      if (anchor !== motion.anchor) {
        anchor = motion.anchor;
        surface.style.setProperty('--anchor', anchor + 'px');
        surface.parentElement?.style.setProperty('--anchor', anchor + 'px');
      }
      if (size !== motion.slideSize) {
        size = motion.slideSize;
        surface.parentElement?.style.setProperty('--band-size', size * 1.4 + 'px');
      }
      let nearest = { value: initial, distance: Infinity };
      for (const slide of motion.slides) {
        const face = slide.element.querySelector<HTMLElement>('[data-number]');
        if (!face) continue;
        if (Math.abs(slide.distance) < nearest.distance)
          nearest = { value: slide.index, distance: Math.abs(slide.distance) };
        const angle = -slide.distance * 20;
        const visible = Math.abs(angle) < 85;
        const visibility = visible ? 'visible' : 'hidden';
        if (face.style.visibility !== visibility) face.style.visibility = visibility;
        if (!visible) continue;
        // Compensate for the carousel's flat positioning, then draw a cylinder.
        const offset = -slide.distance * motion.slidePitch;
        face.style.transformOrigin = 'calc(50% + ' + side * 130 + 'px) center';
        face.style.transform = 'translateX(' + side * 27 + 'px) translateY(' + offset + 'px) perspective(1000px) translateZ(' + radius + 'px) rotateX(' + angle + 'deg) translateZ(' + radius + 'px)';
      }
      if (nearest.value !== current.current) {
        current.current = nearest.value;
        setSelected(nearest.value);
      }
    });
  }, [carousel, initial, label]);

  return <div ref={column} className="time-column">
    <RCarousel controller={carousel} defaultIndex={initial}
      axis="vertical" mode="loop" slidesPerView={9} snapAlign="center" gap={0}
      dragMode="free-snap" wheel crossAxisSize="container"
      style={{ height: 360, width: '100%' }}
      role="spinbutton" aria-roledescription="picker wheel" aria-label={label}
      aria-valuemin={0} aria-valuemax={values.length - 1}
      aria-valuenow={selected} aria-valuetext={selected + ' ' + label.toLowerCase()}
      tabIndex={0} items={values} getItemKey={value => value}
      onKeyDown={event => {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        switch (event.key) {
          case 'ArrowUp': case 'ArrowRight': carousel.next(); break;
          case 'ArrowDown': case 'ArrowLeft': carousel.prev(); break;
          case 'PageUp': carousel.moveBy(5); break;
          case 'PageDown': carousel.moveBy(-5); break;
          case 'Home': carousel.goTo(0); break;
          case 'End': carousel.goTo(values.length - 1); break;
          default: return;
        }
        event.preventDefault();
      }}
      onClick={event => {
        const faces = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[data-number]'))
          .filter(face => face.style.visibility === 'visible');
        const distance = (face: HTMLElement) => {
          const box = face.getBoundingClientRect();
          return Math.abs(box.y + box.height / 2 - event.clientY);
        };
        const target = faces.sort((a, b) => distance(a) - distance(b))[0];
        if (target) carousel.goTo(Number(target.dataset.number));
      }}
      renderItem={value => <span className="time-number" data-number={value}
        aria-hidden="true">{value}</span>} />
    <span className={'time-unit' + (unit === 'min' ? ' time-minute-unit' : '')}
      aria-hidden="true">{unit}</span>
  </div>;
}

export function Example() {
  return <div className="time-picker">
    <Wheel values={hours} initial={12} label="Hours" unit="hours" />
    <Wheel values={minutes} initial={0} label="Minutes" unit="min" />
    <style>{\`
      .time-picker { -webkit-user-select: none; user-select: none; --anchor: 180px; --band-size: 56px; position: relative; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); max-width: 480px; margin: auto; font-family: system-ui, sans-serif; color: #303038; }
      .time-picker::before, .time-picker::after { content: ''; position: absolute; z-index: 4; left: 0; right: 0; pointer-events: none; }
      .time-picker::before { height: calc(var(--anchor) - var(--band-size) / 2); top: -0.5px; border-bottom: 1px solid #bfc1c7; background: linear-gradient(to top, #ffffffa6, #fff); }
      .time-picker::after { height: calc(100% - var(--anchor) - var(--band-size) / 2); bottom: -0.5px; border-top: 1px solid #bfc1c7; background: linear-gradient(to bottom, #ffffffa6, #fff); }
      .time-column { position: relative; min-width: 0; isolation: isolate; }
      .time-column:has(:focus-visible) { outline: 2px solid #3568d4; outline-offset: 4px; border-radius: 8px; }
      .time-number { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; font-size: 30px; font-variant-numeric: tabular-nums; line-height: 1; backface-visibility: hidden; visibility: hidden; }
      .time-unit { position: absolute; z-index: 5; top: var(--anchor, 50%); left: calc(50% + 32px); transform: translateY(-50%); font-size: 22px; font-weight: 600; line-height: 1; pointer-events: none; }
      .time-minute-unit { margin-left: 22px; }
      @media (max-width: 600px) { .time-number { font-size: 26px; } .time-unit { left: calc(50% + 26px); font-size: 18px; } }
    \`}</style>
  </div>;
}`;
