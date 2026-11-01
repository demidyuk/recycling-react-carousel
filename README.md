# recycling-react-carousel

A React carousel with spring animation, momentum dragging, and responsive layouts.
It recycles slide containers to keep the DOM small for large collections.

[Live examples](https://demidyuk.github.io/recycling-react-carousel/docs/)
· [API reference](https://github.com/demidyuk/recycling-react-carousel/blob/master/docs/api.md)
· [Usage guide](https://github.com/demidyuk/recycling-react-carousel/blob/master/docs/guide.md)

## Install

```sh
npm install recycling-react-carousel
```

Requires React and React DOM 18 or 19, Node.js >=22.18.0, and browsers with
Pointer Events, `ResizeObserver`, and native `inert`. Includes ESM, CommonJS,
and TypeScript declarations. CSS is injected automatically.

## Basic usage

```tsx
import RCarousel from 'recycling-react-carousel';

export function Gallery() {
  return (
    <RCarousel aria-label="Featured places">
      <article>Mountains</article>
      <article>Coast</article>
      <article>Forest</article>
    </RCarousel>
  );
}
```

By default, the carousel shows one slide, fits its content height, and stops at
the ends. Give images intrinsic dimensions so their space can be measured.

## Add navigation buttons

```tsx
import RCarousel, { useCarousel } from 'recycling-react-carousel';

export function Gallery() {
  const carousel = useCarousel();

  return (
    <section aria-label="Travel gallery">
      <button {...carousel.getPrevButtonProps()}>Previous</button>
      <RCarousel controller={carousel} aria-label="Featured places">
        <article>Mountains</article>
        <article>Coast</article>
        <article>Forest</article>
      </RCarousel>
      <button {...carousel.getNextButtonProps()}>Next</button>
    </section>
  );
}
```

Configure behavior on `RCarousel`. Each `useCarousel()` controller binds to one
mounted carousel and provides `next()`, `prev()`, `moveBy(delta)`, `goTo(index)`,
and `goToAbsolute(position)`.

`index` is the leading local slide index. `absoluteIndex` includes loop cycles.
`goTo(index)` selects the nearest occurrence; `goToAbsolute(position)` selects a
global position. Slide indexes and pagination pages are separate.

Build your own pagination UI with `pageIndex`, `pageCount`, `getPageIndexes()`,
`goToPage()`, and `getPageButtonProps()`. See the
[pagination guide](docs/guide.md#build-pagination-controls) for numbered controls,
counters, and bounded page windows.

## Large collections

Use `items` to create slide elements only for the visible and buffered pool:

```tsx
const products = [
  { id: 'first', name: 'First product' },
  { id: 'second', name: 'Second product' },
];

<RCarousel
  aria-label="Products"
  items={products}
  getItemKey={(product) => product.id}
  renderItem={(product) => <article>{product.name}</article>}
/>;
```

Supply both callbacks and stable, unique keys. Use either `items` or `children`.
Keep persistent slide state in the parent: recycled content can unmount. See the
[usage guide](https://github.com/demidyuk/recycling-react-carousel/blob/master/docs/guide.md)
for data updates, controlled navigation, and `memo`/`createElement` typing.

## Layout and behavior

- Set `slidesPerView={3}` for several slides and `gap={16}` for spacing in pixels.
- Set `slidesPerView={1.2}` and `snapAlign="center"` for centered slides with partial
  previews. Use `insetStart` and `insetEnd` to adjust the inner spacing.
- Use `breakpoints={{ 640: { slidesPerView: 2 }, 1024: { slidesPerView: 3 } }}`
  for rules based on container width.
- Set `mode="loop"` to repeat in both directions, or `mode="forward-loop"` to
  repeat at nonnegative absolute positions.
- Set `dragMode="free-snap"` for momentum that finishes on a slide, or
  `dragMode="free"` to stop between slides. `wheel` enables trackpad and wheel input.
- Use [`controller.subscribeMotion`](docs/guide.md#effects-during-motion) for
  fading, scaling, or picker effects during dragging and animation.
- For a fixed height, use `crossAxisSize="container"` and
  `style={{ height: 300 }}`. Vertical layouts always need a definite height.
- Supply an accessible name with `aria-label` or `aria-labelledby`. Native
  navigation buttons support keyboard activation.

SSR is supported. In React Server Component frameworks, use a client component
boundary. Reserve space when needed to avoid layout shifts before measurement.

See the [API reference](https://github.com/demidyuk/recycling-react-carousel/blob/master/docs/api.md)
for defaults, sizing, animation, callbacks, and controller details.

## Development

Use Node 24 and npm. Commands and test profiles are documented in the
[development guide](https://github.com/demidyuk/recycling-react-carousel/blob/master/docs/development.md).
