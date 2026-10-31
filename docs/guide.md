# Usage guide

[README](../README.md) · [API reference](api.md) · [Live examples](https://demidyuk.github.io/recycling-react-carousel/docs/)

## Controlled navigation

```tsx
import { useState } from 'react';
import RCarousel from 'recycling-react-carousel';

export function Gallery() {
  const [index, setIndex] = useState(0);

  return (
    <RCarousel index={index} onIndexChange={setIndex} aria-label="Places">
      <article>Mountains</article>
      <article>Coast</article>
      <article>Forest</article>
    </RCarousel>
  );
}
```

`index` selects the leading slide, or the centered slide with `snapAlign="center"`.
To select a specific loop cycle or make large jumps, use `absoluteIndex` with
`onAbsoluteIndexChange` instead. Local and absolute position props cannot be mixed.
Change callbacks request updates; the position changes only when you update the
controlled prop. A rejected drag returns to that position.

For an uncontrolled carousel, use `defaultIndex` or `defaultAbsoluteIndex` to set
the initial position. Later changes to a default prop do not navigate. You can
attach `useCarousel()` to either model for buttons and navigation methods.

## Build pagination controls

Use the controller to build pagination with numbered buttons, dots, or a counter.
You provide the markup and styling:

```tsx
import RCarousel, { useCarousel } from 'recycling-react-carousel';

export function Gallery({ slides }: { slides: React.ReactNode[] }) {
  const carousel = useCarousel();

  return (
    <section aria-label="Travel gallery">
      <RCarousel
        controller={carousel}
        aria-label="Destinations"
        slidesPerView={3}
        slidesToScroll={3}
      >
        {slides}
      </RCarousel>
      <div role="group" aria-label="Choose a page">
        {carousel.getPageIndexes().map((pageIndex) => (
          <button key={pageIndex} {...carousel.getPageButtonProps(pageIndex)}>
            {pageIndex + 1}
          </button>
        ))}
      </div>
      {carousel.pageIndex !== null && (
        <p>
          Page {carousel.pageIndex + 1} of {carousel.pageCount}
        </p>
      )}
    </section>
  );
}
```

`getPageIndexes()` returns at most seven nearby pages; pass a positive limit such
as `getPageIndexes(5)` to change the window. It shifts toward the start or end as
needed. You decide whether to add first/last buttons or ellipses. For your own
controls, use `goToPage(pageIndex)` and `getPageSlideIndex(pageIndex)`. To display
all pages for a small collection, use `getPageIndexes(carousel.pageCount)` after
checking that `pageCount > 0`.

Pages follow the resolved `slidesToScroll`, including breakpoint overrides.
For eight slides, three visible, and a step of three, finite targets are slides
`0`, `3`, and `5`, keeping the final viewport full. `pageIndex` describes the
selected page; `index` still describes the leading slide. Direct navigation
between page targets selects the page whose target is at or before that slide.
Repeating modes provide pages for one logical collection and navigate to the
nearest reachable occurrence. Before measurement, with empty data, and after
detachment, `pageCount` is zero and `pageIndex` is `null`.

The selected button stays focusable with `aria-current="page"` and
`aria-disabled="true"`, and activating it does not navigate. Other unavailable or
explicitly disabled buttons use native `disabled`. The helpers keep native
keyboard behavior and compose your click handler; calling `event.preventDefault()`
cancels navigation. Pass an `aria-label` to customize or translate the default
"Go to page n of count" label. See the [API reference](api.md#headless-pagination)
for pagination details.

## Create slides lazily

The `items` API avoids creating React elements for the entire collection:

```tsx
import RCarousel, { type RCarouselItemsProps } from 'recycling-react-carousel';

type Product = { id: string; name: string };
const products: readonly Product[] = [
  { id: 'first', name: 'First product' },
  { id: 'second', name: 'Second product' },
];

const props: RCarouselItemsProps<Product> = {
  items: products,
  getItemKey: (product) => product.id,
  renderItem: (product, index) => (
    <article>
      {index + 1}. {product.name}
    </article>
  ),
};

<RCarousel {...props} aria-label="Products" />;
```

Both callbacks receive the item and its zero-based local index, including in
repeating modes. Both are required with `items`; do not combine them with
`children` or supply callbacks without `items`.

Only visible and buffered slots read items and call these functions. The carousel
does not create elements or scan keys for the whole collection, or keep a growing
element cache.
Callbacks must be pure: React may repeat them during StrictMode or interrupted
renders. Put Hooks inside components returned by `renderItem`.

Every array entry counts as one slide, even when its renderer returns `null`.
Empty arrays and primitive or undefined entries are supported. This API accepts
your array; it does not fetch data.

### Keys and updates

Keys must be stable and unique within the collection. They identify the
content inside a recycled slot and prevent state leaking to another item.
Recycling can unmount content, and repeated occurrences have independent state.
Keep persistent state in the parent, keyed by item ID. Avoid fixed DOM IDs in
repeated slide content.

Replace arrays and changed items when updating data. Selection follows the slide
index when items are reordered, rather than the previously selected item ID. Count
changes use the same position correction rules as children-based carousels.

### React helpers and TypeScript

Direct JSX infers the item type from `items`. For `memo` or `createElement`,
specialize the component first, using the `Product` and `props` defined above:

```tsx
import { createElement, memo } from 'react';

const ProductCarousel = RCarousel<Product>;
const MemoProductCarousel = memo(ProductCarousel);

<MemoProductCarousel {...props} />;
createElement(ProductCarousel, props);
```

Without specialization, these React helpers infer the children overload and
reject items props. This applies to both default and named `RCarousel` exports.

## Layout

The default horizontal carousel fills its parent's width and fits the height of
its content. Give images intrinsic dimensions so their space can be measured.
The height adjusts as horizontal slides move, including during dragging and
direction changes. It uses the navigation animation without extra configuration
or a CSS height transition. Disabled animation and reduced motion settle
immediately. Content can be clipped during motion; once settled, the viewport
fits its visible content.

```tsx
<RCarousel gap={16}>{quotes}</RCarousel>
```

When free dragging stops between slides, the viewport keeps its current height
and clips adjacent content. Selecting a slide brings it into view for reading.

For a fixed viewport, set `crossAxisSize="container"` and a height or aspect ratio:

```tsx
<RCarousel
  aria-label="Photos"
  crossAxisSize="container"
  slideAlign="center"
  style={{ height: 300 }}
>
  <article>Mountains</article>
  <article>Coast</article>
</RCarousel>
```

Vertical carousels always need a definite height. With `axis="vertical"`, content
sizing fits the width, includes incoming and outgoing slides during motion, and
shrinks when outgoing content leaves. Hidden buffers do not set the settled
size. `slideAlign` controls presentation across the carousel's axis,
independently of viewport sizing.

Use `gap={16}` for spacing. Slide sizing uses the inner area after `insetStart`
and `insetEnd`, both zero by default. Use `slideStyle` padding for a slide's own
content.

### Centered slides and partial previews

```tsx
<RCarousel
  aria-label="Featured products"
  slidesPerView={1.2}
  snapAlign="center"
  insetStart={24}
  insetEnd={24}
  gap={16}
>
  {products}
</RCarousel>
```

`slidesPerView` accepts fractions; slides still have equal sizes. Insets
accept nonnegative pixels or percentages of the outer viewport. They define the
inner sizing and alignment area while neighboring slides may appear in inset
space. Asymmetric insets shift the center of that area. Both axes support this
layout; vertical carousels still require a definite height.

Centered selection keeps the first and last slide centered in finite mode,
leaving empty space beyond the collection and ignoring `trimEnd`. Start alignment
keeps trimming enabled by default, including at fractional final positions.
Navigation indexes remain integers. Only fully visible slides are interactive;
partial previews remain inert until they become fully visible. Content sizing
includes visible previews.

### Responsive layouts

```tsx
<RCarousel
  aria-label="Products"
  gap={16}
  breakpoints={{
    640: { slidesPerView: 2 },
    1024: { slidesPerView: 3, slidesToScroll: 2, gap: 24 },
  }}
>
  <article>First product</article>
  <article>Second product</article>
  <article>Third product</article>
</RCarousel>
```

Rules use container width by default. Use `breakpointsBase="window"` for page-wide
breakpoints. Matching rules merge over base props in ascending width order.

For uniformly sized slides with a maximum size, use
`slidesPerView="auto" maxSlideSize={280}`. The carousel chooses a whole count;
slides do not have independent variable widths. See the [API reference](api.md)
for defaults and percentage units.

## Dragging

Slides follow the pointer, even across multiple viewports. With the default
`dragMode="snap"`, releasing snaps in `slidesToScroll` increments from the slide
where the drag began. A short swipe that passes the threshold moves at least one
increment; reversing can return to the starting slide. Recent velocity biases
the nearest stop by at most a quarter slide, without momentum scrolling. After a pause, only the reached
position determines the stop. Finite edges resist dragging and settle in bounds.

The carousel waits for three pixels of movement to detect the gesture's axis,
separately from `swipeThreshold`. Perpendicular touch movement scrolls the page.
Pointer cancellation, lost capture, blur, layout changes, collection removal or
changes to a repeating period, and unmounting cancel the gesture. Appending finite
items preserves an active drag when the slide geometry stays the same. Taps and keyboard activation still work;
completed drags suppress pointer clicks.

Inputs, textareas, selects, editable content, and descendants of
`data-carousel-no-drag` do not initiate dragging. A root `onPointerDown` can cancel
initiation with `event.preventDefault()`. Set `style.userSelect` when needed to
control text selection.

Set `dragMode="free"` to stop between slides. Slow drags stay where released;
quick releases coast with bounded, decelerating momentum. A new press stops the
coast. `mode` still controls finite, loop, and forward-loop
boundaries; it is independent of `dragMode`. Finite free movement settles inside
its physical edges, including a fractional trimmed final viewport.

```tsx
<RCarousel dragMode="free" wheel mode="loop" slidesPerView={2.5} gap={16}>
  {photographs}
</RCarousel>
```

Free movement does not use `swipeThreshold` or `slidesToScroll` for its resting
position. Buttons, `goTo`, `goToAbsolute`, and pagination still select slide
anchors. Indexes remain integers and describe the nearest resting anchor;
controlled props can accept or reject that selection. Reduced motion and disabled
animation keep the release point without momentum.

`wheel` is opt-in and independent of `drag`. Horizontal trackpad gestures and
Shift+wheel move horizontal carousels; ordinary vertical gestures scroll the
page. Vertical carousels use vertical gestures and release them to the page at
finite edges. Wheel input normalizes pixel, line, and page deltas. It follows the
device’s own momentum, then snaps or rests according to `dragMode` after the
stream ends; it does not add a second fling. Pinch-to-zoom gestures, form controls,
editable content, and scrollable descendants keep their native behavior.
Use `data-carousel-no-wheel` to exclude another interactive region.
A root `onWheel` can cancel carousel input with `event.preventDefault()`.

## Accessibility and server rendering

Name the carousel with `aria-label` or `aria-labelledby`. The root defaults to
`role="group"` and `aria-roledescription="carousel"`; use `role="region"` when
appropriate for the page's landmarks. Slide containers have group/slide semantics
and numbered labels. Customize `getSlideLabel` for localization or descriptive
names. Native navigation buttons support keyboard activation; the carousel does
not intercept global arrow keys.

Buffered, partially clipped, and moving slides are inert and hidden from
assistive technology. If focused content leaves the interactive region, focus
returns to the root without scrolling it.

Browserless imports and `renderToString` are supported. Server HTML includes one
slide by default, including auto mode before measurement. CSS loads with client
JavaScript; reserve a height or aspect ratio when layout shift matters. React
Server Component frameworks should use a client component boundary.

## Recycling

A pool of slide containers covers the viewport and one hidden viewport on each
side. Its size is `3 * ceil(viewportSize / slidePitch)`, where slide pitch includes
the gap.
Default integer layouts use `3 * slidesPerView` containers. Slides are recycled
as they move.

Large jumps place the destination next to the visible range and skip intermediate
items, preserving partially visible content. Travel is limited to the visible
count, including gaps, plus at most one slide for an interrupted transition.
New requests retarget immediately. When motion settles, local coordinates reset
without remounting visible components.

Dragging pauses during these jumps. They use an ease-out transition with no
overshoot, capped at 500 ms, so even heavy or undamped springs finish promptly.
Shorter durations are honored; disabled animation and reduced motion skip the
transition. Ordinary next/previous transitions use the configured animation and
can be interrupted by dragging.

With `children`, recycling limits mounted DOM while the caller creates the full
element collection and the carousel normalizes it. With `items`, element creation
is limited to the pool. Neither mode retains an ever-growing element cache.
