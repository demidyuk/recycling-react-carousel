// Compile-only fixture: accepted API shapes and intentional type errors.
import Carousel, {
  RCarousel,
  useCarousel,
  type RCarouselProps,
  type RCarouselItemsProps,
  type CarouselSnapshot,
  type CarouselAnimation,
  type CarouselChangeReason,
  type CarouselLength,
  type CarouselDragMode,
  type CarouselMotion,
  type CarouselSlideMotion,
} from 'recycling-react-carousel';
import { createElement, createRef, memo } from 'react';
import type { resolveAnimation, resolveLength } from 'recycling-react-carousel';
type ResolveAnimation = typeof resolveAnimation;
type ResolveLength = typeof resolveLength;
// The existing type-only resolver export retains its complete return shape.
const legacyAnimationShape: ReturnType<ResolveAnimation> = {
  frequency: 0.5,
  damping: 0.8,
  velocity: [0.01],
  precision: 0.001,
  restVelocity: 0.0001,
  progress: 0.2,
  clamp: true,
  bounce: 0.5,
  decay: true,
  round: 0.01,
};
void legacyAnimationShape;
// @ts-expect-error removed public export
import type { useCursor as RemoveduseCursor } from 'recycling-react-carousel';
// @ts-expect-error removed public export
import type { CursorProps as RemovedCursorProps } from 'recycling-react-carousel';
// @ts-expect-error removed public export
import type { GoToOptions as RemovedGoToOptions } from 'recycling-react-carousel';
// @ts-expect-error removed public export
import type { ChangeReason as RemovedChangeReason } from 'recycling-react-carousel';
// @ts-expect-error removed public export
import type { DisplayRule as RemovedDisplayRule } from 'recycling-react-carousel';
// @ts-expect-error removed public export
import type { UnitValue as RemovedUnitValue } from 'recycling-react-carousel';
// @ts-expect-error removed public export
import type { SpringConfig as RemovedSpringConfig } from 'recycling-react-carousel';
const animation: CarouselAnimation = { type: 'duration', duration: 100 };
const length: CarouselLength = '30%';
const root = createRef<HTMLDivElement>();
const props: RCarouselProps = {
  mode: 'forward-loop',
  dragMode: 'free-snap' satisfies CarouselDragMode,
  wheel: true,
  axis: 'vertical',
  slidesPerView: 1.2,
  snapAlign: 'center',
  insetStart: '10%',
  insetEnd: 24,
  gap: 16,
  animation,
  breakpoints: {
    640: { gap: 24, slidesPerView: 2.5, snapAlign: 'start', insetEnd: '0px' },
  },
  onAbsoluteIndexChange: (_position, details) => {
    const reason: CarouselChangeReason = details.reason;
    void reason;
  },
  onStateChange: (snapshot) => {
    void [snapshot.absoluteBounds, snapshot.slidesPerView];
  },
};
// @ts-expect-error boundary mode remains independent of free dragging
const invalidFreeMode = <RCarousel mode="free" />;
// @ts-expect-error wheel is an explicit boolean opt-in
const invalidWheelMode = <RCarousel wheel="horizontal" />;
void [invalidFreeMode, invalidWheelMode];
function Consumer() {
  const controller = useCarousel();
  const snapshot: CarouselSnapshot = controller;
  void snapshot;
  return (
    <>
      <button {...controller.getNextButtonProps()}>Next</button>
      <Carousel {...props} ref={root} controller={controller}>
        <div>slide</div>
      </Carousel>
    </>
  );
}
function checkNavigation(controller: ReturnType<typeof useCarousel>) {
  const unsubscribe: () => void = controller.subscribeMotion(
    (motion: CarouselMotion) => {
      const position: number = motion.position;
      for (const slide of motion.slides) {
        const frame: CarouselSlideMotion = slide;
        const element: HTMLElement = frame.element;
        element.style.opacity = String(
          Math.max(0, 1 - Math.abs(frame.distance))
        );
        void position;
        // @ts-expect-error frame values are read-only
        slide.distance = 0;
      }
    }
  );
  unsubscribe();
  const index: number = controller.index;
  const absoluteIndex: number = controller.absoluteIndex;
  const move: void = controller.moveBy(1);
  const pageCount: number = controller.pageCount;
  const pageIndex: number | null = controller.pageIndex;
  const pageSlideIndex: number | null = controller.getPageSlideIndex(1);
  const pageIndexes: number[] = controller.getPageIndexes();
  const limitedPageIndexes: number[] = controller.getPageIndexes(5);
  const pageMove: void = controller.goToPage(1);
  const pageButton: React.ButtonHTMLAttributes<HTMLButtonElement> =
    controller.getPageButtonProps(1, {
      'aria-label': 'Show second page',
      onClick: (event) => event.preventDefault(),
    });
  // @ts-expect-error page navigation requires a number
  controller.goToPage('1');
  // @ts-expect-error pageCount is read-only
  controller.pageCount = 10;
  const snapshot: CarouselSnapshot = controller;
  // @ts-expect-error pagination is controller-only, not part of CarouselSnapshot
  void snapshot.pageCount;
  controller.goTo(2);
  controller.goToAbsolute(100);
  return {
    index,
    absoluteIndex,
    move,
    pageCount,
    pageIndex,
    pageSlideIndex,
    pageIndexes,
    limitedPageIndexes,
    pageMove,
    pageButton,
  };
}
const element = (
  <RCarousel {...props}>
    <Consumer />
  </RCarousel>
);
type Product = { id: string; name: string };
const products: readonly Product[] = [{ id: 'first', name: 'First' }];
const itemProps: RCarouselItemsProps<Product> = {
  items: products,
  renderItem: (item, index) => (
    <span>
      {index}: {item.name}
    </span>
  ),
  getItemKey: (item) => item.id,
};
const lazyDefault = (
  <Carousel
    items={products}
    ref={root}
    getItemKey={(item) => item.id}
    renderItem={(item, index) => {
      const product: Product = item;
      const local: number = index;
      return (
        <span>
          {local}: {product.name}
        </span>
      );
    }}
  />
);
const lazyNamed = <RCarousel {...itemProps} ref={root} />;
const MemoCarousel = memo(Carousel<Product>);
const MemoNamedCarousel = memo(RCarousel<Product>);
const memoDefault = <MemoCarousel {...itemProps} ref={root} />;
const memoNamed = (
  <MemoNamedCarousel
    items={products}
    ref={root}
    getItemKey={(item) => item.id}
    renderItem={(item, index) => {
      const product: Product = item;
      const local: number = index;
      return (
        <span>
          {local}: {product.name}
        </span>
      );
    }}
  />
);
const factoryDefault = createElement(Carousel<Product>, {
  ...itemProps,
  ref: root,
});
const factoryNamed = createElement(RCarousel<Product>, {
  ...itemProps,
  ref: root,
});
const factoryMemo = createElement(MemoNamedCarousel, itemProps);
const UnspecializedCarousel = memo(Carousel);
// @ts-expect-error memo needs item type specialization to select items props
const unspecializedMemo = <UnspecializedCarousel {...itemProps} />;
// @ts-expect-error createElement needs item type specialization to select items props
const unspecializedFactory = createElement(RCarousel, itemProps);
const wrongMemoItem = (
  <MemoNamedCarousel
    items={products}
    getItemKey={(item) => item.id}
    renderItem={(item) => {
      // @ts-expect-error memoized item types must stay specific, not any
      return item.missing;
    }}
  />
);
const missingMemoKey = (
  // @ts-expect-error memoized items mode still requires getItemKey
  <MemoCarousel items={products} renderItem={(item) => item.name} />
);
const missingKey = (
  // @ts-expect-error getItemKey is required in items mode
  <Carousel items={products} renderItem={(item: Product) => item.name} />
);
const missingRenderer = (
  // @ts-expect-error renderItem is required in items mode
  <RCarousel items={products} getItemKey={(item: Product) => item.id} />
);
const missingItems = (
  // @ts-expect-error item callbacks require items
  <Carousel
    renderItem={(item: Product) => item.name}
    getItemKey={(item: Product) => item.id}
  />
);
const mixedSources = (
  // @ts-expect-error items and children are mutually exclusive
  <RCarousel {...itemProps}>
    <div>child</div>
  </RCarousel>
);
const wrongItem = (
  <RCarousel
    items={products}
    getItemKey={(item) => item.id}
    renderItem={(item) => {
      // @ts-expect-error item types must be inferred, not any
      return item.missing;
    }}
  />
);
const wrongKey = (
  <Carousel
    items={products}
    renderItem={(item) => item.name}
    // @ts-expect-error item keys must be React keys
    getItemKey={() => ({ id: 1 })}
  />
);
// @ts-expect-error only pixels and percentages are supported
const invalidUnit: RCarouselProps = { swipeThreshold: '10rem' };
// @ts-expect-error gap is a pixel number
const invalidGap: RCarouselProps = { gap: '16px' };
const invalidAnimation: CarouselAnimation = {
  type: 'duration',
  duration: 100,
  // @ts-expect-error duration configurations do not accept spring options
  tension: 170,
};
// @ts-expect-error change details are required
props.onAbsoluteIndexChange?.(0);
// @ts-expect-error removed public prop
const removedProp0: RCarouselProps = { cursor: 0 };
// @ts-expect-error removed public prop
const removedProp1: RCarouselProps = { defaultCursor: 0 };
// @ts-expect-error removed public prop
const removedProp2: RCarouselProps = { displayAtOnce: 2 };
// @ts-expect-error removed public prop
const removedProp3: RCarouselProps = { maxItemSize: '100%' };
// @ts-expect-error removed public prop
const removedProp4: RCarouselProps = { gestures: true };
// @ts-expect-error removed public prop
const removedProp5: RCarouselProps = { autosize: true };
// @ts-expect-error removed public prop
const removedProp6: RCarouselProps = { fitContent: true };
// @ts-expect-error removed public prop
const removedProp7: RCarouselProps = { alignCenter: true };
// @ts-expect-error removed public prop
const removedProp8: RCarouselProps = { itemWrapperClass: 'slide' };
// @ts-expect-error removed public prop
const removedProp9: RCarouselProps = { itemWrapperStyle: {} };
// @ts-expect-error removed public prop
const removedProp10: RCarouselProps = { userSelect: false };
// @ts-expect-error removed public prop
const removedProp11: RCarouselProps = { springConfig: {} };
// @ts-expect-error removed public prop
const removedProp12: RCarouselProps = { onCursorChange: () => {} };
// @ts-expect-error removed public prop
const removedProp13: RCarouselProps = { onRangeChange: () => {} };
// @ts-expect-error removed public prop
const removedProp14: RCarouselProps = { onVisibleActorsChange: () => {} };
// @ts-expect-error removed public prop
const removedProp15: RCarouselProps = { onNextSwipe: () => {} };
// @ts-expect-error removed public prop
const removedProp16: RCarouselProps = { onPrevSwipe: () => {} };
// @ts-expect-error removed public prop
const removedProp17: RCarouselProps = { loop: true };
// @ts-expect-error removed public prop
const removedProp18: RCarouselProps = { infinite: true };
// @ts-expect-error removed public prop
const removedProp19: RCarouselProps = { y: true };
// @ts-expect-error removed public prop
const removedProp20: RCarouselProps = { includeChangeReason: true };
// @ts-expect-error removed public prop
const removedProp21: RCarouselProps = { maxBufferViewports: 8 };
// @ts-expect-error removed public prop
const removedProp22: RCarouselProps = { debugMetrics: true };
void [
  element,
  length,
  checkNavigation,
  invalidUnit,
  invalidGap,
  invalidAnimation,
  lazyDefault,
  lazyNamed,
  memoDefault,
  memoNamed,
  factoryDefault,
  factoryNamed,
  factoryMemo,
  unspecializedMemo,
  unspecializedFactory,
  wrongMemoItem,
  missingMemoKey,
  missingKey,
  missingRenderer,
  missingItems,
  mixedSources,
  wrongItem,
  wrongKey,
];

// @ts-expect-error unsupported snap alignment
const invalidSnap: RCarouselProps = { snapAlign: 'end' };
// @ts-expect-error unsupported inset unit
const invalidInset: RCarouselProps = { insetStart: '1rem' };
void [invalidSnap, invalidInset];

// @ts-expect-error height interpolation has no public toggle
const invalidHeightToggle = <RCarousel animateHeight={false} />;
void invalidHeightToggle;
