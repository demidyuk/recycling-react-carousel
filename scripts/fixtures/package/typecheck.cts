// Compile-only fixture: accepted API shapes and intentional type errors.
import library = require('recycling-react-carousel');
import React = require('react');
type ResolveAnimation = typeof library.resolveAnimation;
type ResolveLength = typeof library.resolveLength;
const component: typeof library.RCarousel = library.default;
const props: library.RCarouselProps = {
  mode: 'loop',
  axis: 'horizontal',
  slidesPerView: 2,
  gap: 16,
  breakpoints: { 640: { gap: 24 } },
};
const animation: library.CarouselAnimation = { type: 'spring', mass: 1 };
const readController = (
  controller: ReturnType<typeof library.useCarousel>
): [number, number] => [controller.absoluteIndex, controller.index];
function readPagination(controller: library.CarouselController) {
  const pageCount: number = controller.pageCount;
  const pageIndex: number | null = controller.pageIndex;
  const pageSlideIndex: number | null = controller.getPageSlideIndex(1);
  const pageIndexes: number[] = controller.getPageIndexes(5);
  const move: void = controller.goToPage(1);
  const button: React.ButtonHTMLAttributes<HTMLButtonElement> =
    controller.getPageButtonProps(1, {
      'aria-label': 'Show second page',
      onClick: (event) => event.preventDefault(),
    });
  // @ts-expect-error window size requires a number
  controller.getPageIndexes('5');
  // @ts-expect-error pageIndex is read-only
  controller.pageIndex = 0;
  const snapshot: library.CarouselSnapshot = controller;
  // @ts-expect-error pagination is controller-only, not part of CarouselSnapshot
  void snapshot.pageIndex;
  return { pageCount, pageIndex, pageSlideIndex, pageIndexes, move, button };
}
type Product = { id: string; name: string };
const products: readonly Product[] = [{ id: 'first', name: 'First' }];
const itemProps: library.RCarouselItemsProps<Product> = {
  items: products,
  renderItem: (item, index) => `${index}: ${item.name}`,
  getItemKey: (item) => item.id,
};
const lazy = React.createElement(library.RCarousel<Product>, {
  ...itemProps,
  ref: React.createRef<HTMLDivElement>(),
});
const lazyDefault = React.createElement(library.default<Product>, {
  items: products,
  renderItem: (item) => item.name,
  getItemKey: (item) => item.id,
});
const MemoCarousel = React.memo(library.RCarousel<Product>);
const MemoDefaultCarousel = React.memo(library.default<Product>);
const memoNamed = React.createElement(MemoCarousel, {
  ...itemProps,
  ref: React.createRef<HTMLDivElement>(),
});
const memoDefault = React.createElement(MemoDefaultCarousel, {
  items: products,
  getItemKey: (item) => item.id,
  renderItem: (item, index) => {
    const product: Product = item;
    const local: number = index;
    return `${local}: ${product.name}`;
  },
});
const UnspecializedCarousel = React.memo(library.RCarousel);
// @ts-expect-error memo needs item type specialization to select items props
const unspecializedMemo = React.createElement(UnspecializedCarousel, itemProps);
// @ts-expect-error createElement needs item type specialization to select items props
const unspecializedFactory = React.createElement(library.default, itemProps);
// @ts-expect-error getItemKey is required in items mode
const missingKey: library.RCarouselItemsProps<Product> = {
  items: products,
  renderItem: (item) => item.name,
};
const mixedSources: library.RCarouselItemsProps<Product> = {
  ...itemProps,
  // @ts-expect-error items and children are mutually exclusive
  children: 'child',
};
// @ts-expect-error removed public export
type RemoveduseCursor = typeof library.useCursor;
// @ts-expect-error removed public export
type RemovedCursorProps = library.CursorProps;
// @ts-expect-error removed public export
type RemovedGoToOptions = library.GoToOptions;
// @ts-expect-error removed public export
type RemovedChangeReason = typeof library.ChangeReason;
// @ts-expect-error removed public export
type RemovedDisplayRule = library.DisplayRule;
// @ts-expect-error removed public export
type RemovedUnitValue = library.UnitValue;
// @ts-expect-error removed public export
type RemovedSpringConfig = library.SpringConfig;
// @ts-expect-error removed public prop
const removedProp0: library.RCarouselProps = { cursor: 0 };
// @ts-expect-error removed public prop
const removedProp1: library.RCarouselProps = { defaultCursor: 0 };
// @ts-expect-error removed public prop
const removedProp2: library.RCarouselProps = { displayAtOnce: 2 };
// @ts-expect-error removed public prop
const removedProp3: library.RCarouselProps = { maxItemSize: '100%' };
// @ts-expect-error removed public prop
const removedProp4: library.RCarouselProps = { gestures: true };
// @ts-expect-error removed public prop
const removedProp5: library.RCarouselProps = { autosize: true };
// @ts-expect-error removed public prop
const removedProp6: library.RCarouselProps = { fitContent: true };
// @ts-expect-error removed public prop
const removedProp7: library.RCarouselProps = { alignCenter: true };
// @ts-expect-error removed public prop
const removedProp8: library.RCarouselProps = { itemWrapperClass: 'slide' };
// @ts-expect-error removed public prop
const removedProp9: library.RCarouselProps = { itemWrapperStyle: {} };
// @ts-expect-error removed public prop
const removedProp10: library.RCarouselProps = { userSelect: false };
// @ts-expect-error removed public prop
const removedProp11: library.RCarouselProps = { springConfig: {} };
// @ts-expect-error removed public prop
const removedProp12: library.RCarouselProps = { onCursorChange: () => {} };
// @ts-expect-error removed public prop
const removedProp13: library.RCarouselProps = { onRangeChange: () => {} };
const removedProp14: library.RCarouselProps = {
  // @ts-expect-error removed public prop
  onVisibleActorsChange: () => {},
};
// @ts-expect-error removed public prop
const removedProp15: library.RCarouselProps = { onNextSwipe: () => {} };
// @ts-expect-error removed public prop
const removedProp16: library.RCarouselProps = { onPrevSwipe: () => {} };
// @ts-expect-error removed public prop
const removedProp17: library.RCarouselProps = { loop: true };
// @ts-expect-error removed public prop
const removedProp18: library.RCarouselProps = { infinite: true };
// @ts-expect-error removed public prop
const removedProp19: library.RCarouselProps = { y: true };
// @ts-expect-error removed public prop
const removedProp20: library.RCarouselProps = { includeChangeReason: true };
// @ts-expect-error removed public prop
const removedProp21: library.RCarouselProps = { maxBufferViewports: 8 };
// @ts-expect-error removed public prop
const removedProp22: library.RCarouselProps = { debugMetrics: true };
void [
  component,
  props,
  animation,
  readController,
  lazy,
  lazyDefault,
  memoNamed,
  memoDefault,
  unspecializedMemo,
  unspecializedFactory,
  missingKey,
  mixedSources,
];
