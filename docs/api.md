# API reference

[README](../README.md) · [Usage guide](guide.md) · [Development](development.md)

The package exports default and named `RCarousel`, `useCarousel`, and their
TypeScript types. Configure the carousel through `RCarousel` props. The optional
controller provides state and navigation methods.

## Component props

The root forwards an `HTMLDivElement` ref and ordinary div attributes, including
`style`, `className`, and accessibility attributes.

| Prop                                    | Default                          | Meaning                                                                                                                                                 |
| --------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `children`                              | —                                | Slide content; use this or the items API.                                                                                                               |
| `items`, `renderItem`, `getItemKey`     | —                                | Lazy data source; all three are required together.                                                                                                      |
| `index`, `defaultIndex`                 | uncontrolled, `0`                | Controlled or initial local navigation anchor.                                                                                                          |
| `absoluteIndex`, `defaultAbsoluteIndex` | —                                | Controlled or initial global position, including loop cycles.                                                                                           |
| `controller`                            | —                                | A controller returned by `useCarousel()`.                                                                                                               |
| `slidesPerView`                         | `1`                              | Finite number >= 1, including fractions, or `'auto'` to calculate a whole count from the available space.                                               |
| `maxSlideSize`                          | `'100%'` in auto mode            | Maximum primary-axis slide size within the insets; requires `slidesPerView="auto"`.                                                                     |
| `slidesToScroll`                        | `1`                              | Positive safe integer; navigation distance and drag snapping increment.                                                                                 |
| `gap`                                   | `0`                              | Nonnegative space between slides in pixels.                                                                                                             |
| `snapAlign`                             | `'start'`                        | Align the navigation anchor at the inner start or center (`'start'`, `'center'`).                                                                       |
| `insetStart`, `insetEnd`                | `0`                              | Nonnegative pixels or percentages defining the inner alignment area; previews may occupy the insets.                                                    |
| `breakpoints`                           | —                                | Minimum-width keys with sizing and movement overrides.                                                                                                  |
| `breakpointsBase`                       | `'container'`                    | `'container'` or `'window'`; uses width on both axes.                                                                                                   |
| `mode`                                  | `'finite'`                       | `'finite'`, `'loop'`, or `'forward-loop'`.                                                                                                              |
| `axis`                                  | `'horizontal'`                   | `'horizontal'` or `'vertical'`.                                                                                                                         |
| `trimEnd`                               | `true`                           | Trim the last start-aligned finite viewport; ignored with center alignment.                                                                             |
| `drag`                                  | `true`                           | Enable mouse and touch dragging.                                                                                                                        |
| `dragMode`                              | `'snap'`                         | `'snap'` selects slide anchors; `'free'` coasts between slides; `'free-snap'` projects momentum and finishes on a slide stop.                           |
| `wheel`                                 | `false`                          | Enable axis-matched wheel/trackpad gestures, including Shift+wheel horizontally. Vertical gestures continue scrolling the page on horizontal carousels. |
| `swipeThreshold`                        | `30`                             | Positive pixels or a percentage of one slide's content size, excluding its gap.                                                                         |
| `crossAxisSize`                         | `'content'`                      | Fit content and adjust height during horizontal motion, or use `'container'` for a size set by your layout.                                             |
| `slideAlign`                            | `'stretch'`                      | Cross-axis alignment: `'stretch'`, `'start'`, `'center'`, or `'end'`.                                                                                   |
| `slideClassName`, `slideStyle`          | —                                | Style the content wrapper inside each slide container.                                                                                                  |
| `animation`                             | spring                           | Spring configuration, duration configuration, or `false`.                                                                                               |
| `getSlideLabel`                         | `(index, count) => "n of count"` | Accessible slide label; receives a zero-based local index.                                                                                              |

Local position props (`index`, `defaultIndex`) cannot be combined with absolute
position props (`absoluteIndex`, `defaultAbsoluteIndex`). Default props initialize
the position once; changing them later does not navigate. Keep the same
controlled/uncontrolled model throughout the component's lifetime.

`CarouselLength` accepts numbers, pixel strings such as `'280px'`, and percentage
strings such as `'30%'`. Other CSS units are unsupported. Percentage bases are
the outer primary viewport for insets, its inner size after insets for
`maxSlideSize`, and one slide's content size excluding gaps for `swipeThreshold`.
Lengths must be positive and finite, except insets also accept zero. Numeric
`slidesPerView` must be finite and at least one; navigation positions and
`slidesToScroll` must be safe integers.

## Modes and bounds

- `finite` stops at the collection boundaries. With `trimEnd`, the final navigation
  index is `max(ceil(slideCount - slidesPerView), 0)`. With fractional
  `slidesPerView`, the last position keeps the viewport full while the index
  stays an integer. Center alignment reaches every slide and keeps both endpoints
  centered, ignoring `trimEnd`.
- `loop` allows global positions in both directions.
- `forward-loop` allows repeating content at nonnegative global positions;
  previous navigation remains available until zero.

Repeating bounds become active after measurement when the collection can fill a
viewport. Otherwise finite bounds apply. Navigation remains positional when
items are reordered. When the count changes, the current cycle is retained and a
removed local index is clamped before bounds are applied. Corrections notify
change handlers with the `slides-change` reason.

## Responsive sizing

Matching breakpoint rules merge in ascending minimum-width order over the base
props. Each `CarouselBreakpoint` can override `slidesPerView`, `maxSlideSize`,
`slidesToScroll`, `gap`, `snapAlign`, `insetStart`, and `insetEnd`. Container rules
respond to container resizing without a window resize; window rules use
`window.innerWidth`.

Use a fraction such as `slidesPerView={1.2}` to reveal neighboring slides.
`snapAlign="center"` centers the indexed slide within the inner alignment area,
including at finite endpoints. Asymmetric insets shift that center. `slideAlign`
controls only cross-axis alignment.

`slidesPerView="auto"` computes the smallest whole count that keeps uniformly
sized slides within `maxSlideSize`, including gaps. It does not enable variable
slide widths. Auto mode uses one slide before measurement; numeric counts use the
base value to produce deterministic server HTML.

## Animation

```tsx
<RCarousel
  animation={{ type: 'spring', tension: 170, friction: 26, mass: 1 }}
/>;
<RCarousel
  animation={{
    type: 'duration',
    duration: 300,
    easing: (t) => 1 - (1 - t) ** 3,
  }}
/>;
<RCarousel animation={false} />;
```

Spring defaults are tension 170, friction 26, and mass 1. Duration is in
milliseconds and defaults to linear easing. Reduced-motion preferences and zero
duration skip animation. Updated settings apply to the next animation start;
retargeting retains the current position and velocity.

Large jumps skip intermediate slides and use a monotonic ease-out transition
capped at 500 ms instead of the configured spring or easing. Shorter durations
are honored, and dragging resumes after the compressed transition settles.

## Controller

```tsx
const carousel = useCarousel();
// Bind with <RCarousel controller={carousel}>...</RCarousel>.
```

Each controller binds to one mounted carousel at a time. Navigation methods run
immediately. Before measurement and after detachment, commands do nothing and
navigation buttons are disabled. A controller can be rebound after unmounting.

| Member                                                     | Meaning                                                                                                                             |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `index`                                                    | Local navigation anchor, not a pagination page; centered with `snapAlign="center"`.                                                 |
| `absoluteIndex`                                            | Global position, including repeated cycles.                                                                                         |
| `slideCount`                                               | Supplied item or normalized child count.                                                                                            |
| `slidesPerView`                                            | Resolved `slidesPerView`, excluding buffered slides.                                                                                |
| `canPrev`, `canNext`                                       | Whether navigation is available within the current bounds.                                                                          |
| `isReady`, `isAnimating`                                   | Measurement and motion state.                                                                                                       |
| `absoluteBounds`                                           | `{ min, max }`, or `null` before measurement; repeating bounds can contain infinities.                                              |
| `next()`, `prev()`                                         | Move by `slidesToScroll`, clamped to bounds.                                                                                        |
| `moveBy(delta)`                                            | Move by a signed safe integer; zero does nothing.                                                                                   |
| `goTo(index)`                                              | Select the nearest reachable local occurrence; forward wins equal-distance ties.                                                    |
| `goToAbsolute(position)`                                   | Select a global position, clamped to bounds.                                                                                        |
| `getPrevButtonProps(props?)`, `getNextButtonProps(props?)` | Compose native button props and navigation handlers.                                                                                |
| `subscribeMotion(listener)`                                | Receive a `CarouselMotion` frame immediately when measured and on committed layout/motion changes. Returns an unsubscribe function. |

Button getters supply `type="button"`, `disabled`, and `aria-controls`. A supplied
`onClick` runs first; `event.preventDefault()` cancels navigation. A consumer's
`disabled` prop can also disable the button.

Finite end trimming can clamp `goTo(lastIndex)` to an earlier leading index to
keep the last viewport full. The pagination helpers below account for this;
`index` continues to describe the slide anchor rather than the selected page.

### Motion subscriptions

`CarouselMotion`, `CarouselSlideMotion`, and `CarouselDragMode` are exported types.
Register `controller.subscribeMotion` in an effect and return its unsubscribe
function. Delivery starts after measurement and pauses while detached.
Subscriptions remain registered across detach/rebind until unsubscribed.
Callbacks can repeat a position after a layout commit.

| Frame field  | Meaning                                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------ |
| `position`   | Current physical global position in slide-pitch units, including fractional values and loop cycles.          |
| `axis`       | Resolved `'horizontal'` or `'vertical'` axis.                                                                |
| `slideSize`  | Slide content size in pixels along the scrolling axis.                                                       |
| `slidePitch` | Slide content size plus gap, in pixels.                                                                      |
| `anchor`     | Center of an aligned slide in pixels from the viewport's primary start, accounting for insets and alignment. |
| `slides`     | Rendered content, including buffered slides and distinct loop occurrences; empty for empty content.          |

Each `CarouselSlideMotion` contains `element`, `index`, `absoluteIndex`, and
`distance`. The element is the slide's content wrapper, not the positioning
carrier. Apply opacity or transform your own content inside it. Its parent is
owned by the carousel. Elements can be reused for different items; do not cache
their indexes. Frame fields are read-only and represent one committed update.

Distance is signed in slide pitches from the alignment point: zero is aligned,
positive lies after it, and negative lies before it. A slide's center in viewport
pixels is `anchor + distance * slidePitch`.
They describe layout before consumer transforms; rendered subpixel coordinates
can be rounded by the browser.
`position` follows physical movement, while controller indexes describe the
navigation destination. Large API jumps skip intermediate indexes, so `position`
can jump when a compressed route changes its nearest item. Per-slide distances
continue to describe the actual geometry along that route; use them for effects.

`dragMode="free-snap"` projects a destination from bounded release velocity, then
selects the nearest stop in `slidesToScroll` increments from the grabbed slide,
including finite terminal stops. The default spring starts with release velocity;
custom spring settings or an explicit duration are honored. It ignores
`swipeThreshold`. A new press catches motion;
release aligns it. Wheel streams retain device momentum and only align afterward.
Reduced motion and disabled animation select the reached stop immediately.

### Headless pagination

The controller calculates pagination from the resolved `slidesToScroll`.
You render and style the controls. Pagination state belongs to the controller;
`CarouselSnapshot` and the slide `index` stay separate.

| Member                                  | Meaning                                                                                 |
| --------------------------------------- | --------------------------------------------------------------------------------------- |
| `pageCount`                             | Number of logical pages; zero before measurement, with empty data, or after detachment. |
| `pageIndex`                             | Zero-based selected page, or `null` when there are no pages.                            |
| `getPageSlideIndex(pageIndex)`          | Local slide anchor for a page; `null` when unavailable.                                 |
| `getPageIndexes(limit = 7)`             | A contiguous window of at most `limit` page indexes around the selected page.           |
| `goToPage(pageIndex)`                   | Navigate to the page target using `goTo`'s nearest-occurrence behavior.                 |
| `getPageButtonProps(pageIndex, props?)` | Compose native button props, an accessible label, and cancellable navigation.           |

Finite page targets start at zero, advance by the resolved movement step, and
include the final allowed leading index exactly once. For eight slides, three
visible, and a step of three, targets are `[0, 3, 5]` with end trimming, or
`[0, 3, 6, 7]` without it. The selected page is the last target at or before the
local slide anchor, including after direct navigation between targets.

Repeating pagination describes one logical collection: targets are step multiples
less than the slide count. The same example has `[0, 3, 6]` in repeating modes,
regardless of the current cycle. `forward-loop` retains its nonnegative bounds.
If looping falls back to finite bounds because there are too few slides, pagination
uses the finite rules. Previous/next navigation and dragging retain their existing
movement rules; they are not realigned to page targets.

`getPageIndexes()` returns only the requested window and shifts it inward near
either end. For even limits, the extra position appears after the selected page.
It does not add first/last-page entries or ellipses. To get every page, use
`getPageIndexes(pageCount)` when `pageCount > 0`.

Page arguments must be safe integers; negative or out-of-range integers refer to
unavailable pages. Such pages return `null`, have disabled button props, and do not
navigate. Window limits must be positive safe integers. Page state follows logical
navigation and controlled props rather than individual animation frames, and
updates for breakpoints, sizing, and collection changes.

Page button getters supply `type="button"`, `aria-controls`, and the default label
`"Go to page n of count"`. Override the label through the supplied button props for
localization. The selected button has `aria-current="page"` and
`aria-disabled="true"`; it stays focusable, but activation does not navigate.
Unavailable pages and a consumer's `disabled` prop use native `disabled`.
A supplied `onClick` runs first, and `event.preventDefault()` cancels navigation.
Click handlers resolve targets against current state, including after resizing.
The helpers do not move focus or intercept keyboard events. Consumers should label
the group containing their page controls.

## Callbacks

| Callback                                        | Contract                                                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `onIndexChange(index, details)`                 | Requests a local index change.                                                                   |
| `onAbsoluteIndexChange(absoluteIndex, details)` | Requests a global position change, including full-cycle moves.                                   |
| `onStateChange(snapshot)`                       | Observes logical state, including readiness, bounds, counts, and motion; does not run per frame. |
| `onNavigate({ direction, source, blocked })`    | Observes drag, wheel, and API attempts, including attempts at a boundary.                        |
| `onSettle(snapshot)`                            | Runs when a transition settles, including immediate transitions; does not run on mount.          |

`CarouselChangeDetails` contains `{ index, absoluteIndex, reason }`. The reason is
`'drag'`, `'wheel'`, `'api'`, `'resize'`, or `'slides-change'`. Change handlers also
run when bounds or collection changes require a position correction.
Updating position props does not trigger change handlers.

`CarouselNavigateDetails.direction` is `'next'` or `'prev'`; its `source` is
`'drag'`, `'wheel'`, or `'api'`. A full-cycle move can leave the local index
unchanged and notify only the absolute handler. Interrupted transitions do not
call `onSettle`. A rejected controlled drag can settle back at its original
position.

## Exported types

`RCarouselProps` describes children-based carousels; `RCarouselItemsProps<T>`
describes items-based carousels. Shared types are `CarouselController`,
`CarouselSnapshot`, `CarouselBreakpoint`, `CarouselLength`, `CarouselAnimation`,
`CarouselChangeReason`, `CarouselChangeDetails`, and `CarouselNavigateDetails`.
