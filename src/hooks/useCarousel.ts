import { useState, useSyncExternalStore } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { invariant } from '../invariant.js';
import type {
  CarouselMotion,
  CarouselSnapshot,
} from '../RCarousel/apiTypes.js';
import { assertInteger } from '../RCarousel/helpers/configuration.js';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;
export type CarouselCommand =
  | { type: 'next' | 'prev' }
  | { type: 'moveBy' | 'goTo' | 'goToAbsolute'; value: number };

export interface CarouselController extends Readonly<CarouselSnapshot> {
  /** Subscribe to measured slide motion. Returns a function to unsubscribe. */
  subscribeMotion(listener: (motion: CarouselMotion) => void): () => void;
  /** Number of logical pages, or zero until ready and after detachment. */
  readonly pageCount: number;
  /** Zero-based page containing the local slide anchor, or null without pages. */
  readonly pageIndex: number | null;
  /** Move forward immediately by slidesToScroll, within bounds. */
  next(): void;
  /** Move back immediately by slidesToScroll, within bounds. */
  prev(): void;
  /** Move by a signed safe integer. Zero does nothing. */
  moveBy(delta: number): void;
  /** Select the nearest reachable local occurrence; forward wins ties. */
  goTo(index: number): void;
  /** Select a global position, clamped to the current bounds. */
  goToAbsolute(absoluteIndex: number): void;
  /** Compose button props; onClick can cancel navigation with preventDefault. */
  getPrevButtonProps(props?: ButtonProps): ButtonProps;
  /** Compose button props; onClick can cancel navigation with preventDefault. */
  getNextButtonProps(props?: ButtonProps): ButtonProps;
  /** Resolve a page to its local slide anchor; unavailable pages return null. */
  getPageSlideIndex(pageIndex: number): number | null;
  /** Return a contiguous window around the selected page; at most seven by default. */
  getPageIndexes(limit?: number): number[];
  /** Select a page using goTo's nearest-occurrence behavior; unavailable pages do nothing. */
  goToPage(pageIndex: number): void;
  /** Compose native button props; the selected page stays focusable but does not navigate. */
  getPageButtonProps(pageIndex: number, props?: ButtonProps): ButtonProps;
}

const emptySnapshot: CarouselSnapshot = {
  index: 0,
  absoluteIndex: 0,
  slideCount: 0,
  slidesPerView: 1,
  canPrev: false,
  canNext: false,
  isReady: false,
  isAnimating: false,
  absoluteBounds: null,
};

interface ControllerState {
  snapshot: CarouselSnapshot;
  step: number;
  aligned: boolean;
}

const emptyState: ControllerState = {
  snapshot: emptySnapshot,
  step: 1,
  aligned: true,
};

function getPagination({ snapshot, step }: ControllerState) {
  const bounds = snapshot.absoluteBounds;
  if (!snapshot.isReady || !snapshot.slideCount || !bounds)
    return { pageCount: 0, pageIndex: null, lastSlideIndex: 0 };

  const finite = Number.isFinite(bounds.max);
  const lastSlideIndex = finite ? bounds.max : snapshot.slideCount - 1;
  const pageCount =
    (finite
      ? Math.ceil(lastSlideIndex / step)
      : Math.floor(lastSlideIndex / step)) + 1;
  return {
    pageCount,
    pageIndex:
      snapshot.index >= lastSlideIndex
        ? pageCount - 1
        : Math.floor(snapshot.index / step),
    lastSlideIndex,
  };
}

interface ControllerStore {
  state: ControllerState;
  owner?: object;
  id?: string;
  dispatch?: (command: CarouselCommand) => void;
  listeners: Set<() => void>;
  motionListeners: Set<(motion: CarouselMotion) => void>;
  readMotion?: () => CarouselMotion | null;
  lastMotion?: { frame: CarouselMotion; content: (ChildNode | null)[] };
}

const stores = new WeakMap<CarouselController, ControllerStore>();

function getStore(controller: CarouselController) {
  const store = stores.get(controller);
  invariant(store, 'controller must come from useCarousel()');
  return store;
}

function createController() {
  const store: ControllerStore = {
    state: emptyState,
    listeners: new Set(),
    motionListeners: new Set(),
  };
  const dispatch = (command: CarouselCommand) => store.dispatch?.(command);
  const buttonProps = (
    direction: 'next' | 'prev',
    props: ButtonProps = {}
  ) => ({
    ...props,
    type: 'button' as const,
    'aria-controls': store.id,
    disabled: Boolean(
      props.disabled ||
      !store.state.snapshot[direction === 'next' ? 'canNext' : 'canPrev']
    ),
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
      props.onClick?.(event);
      if (!event.defaultPrevented && !props.disabled)
        dispatch({ type: direction });
    },
  });
  const getPageSlideIndex = (pageIndex: number) => {
    assertInteger(pageIndex, 'pageIndex');
    const { pageCount, lastSlideIndex } = getPagination(store.state);
    return pageIndex >= 0 && pageIndex < pageCount
      ? Math.min(pageIndex * store.state.step, lastSlideIndex)
      : null;
  };
  const goToPage = (pageIndex: number) => {
    const target = getPageSlideIndex(pageIndex);
    if (target !== null) dispatch({ type: 'goTo', value: target });
  };
  const getPageButtonProps = (
    pageIndex: number,
    props: ButtonProps = {}
  ): ButtonProps => {
    const target = getPageSlideIndex(pageIndex);
    const { pageCount, pageIndex: currentPage } = getPagination(store.state);
    const selected = currentPage === pageIndex;
    const disabled = Boolean(props.disabled || target === null);
    return {
      ...props,
      type: 'button',
      'aria-controls': store.id,
      'aria-label':
        props['aria-label'] ?? `Go to page ${pageIndex + 1} of ${pageCount}`,
      'aria-current': selected ? 'page' : undefined,
      'aria-disabled':
        (selected && store.state.aligned) || disabled || undefined,
      disabled,
      onClick: (event) => {
        props.onClick?.(event);
        if (
          !event.defaultPrevented &&
          !props.disabled &&
          (getPagination(store.state).pageIndex !== pageIndex ||
            !store.state.aligned)
        )
          goToPage(pageIndex);
      },
    };
  };
  const controller = {
    subscribeMotion: (listener: (motion: CarouselMotion) => void) => {
      const first = !store.motionListeners.size;
      store.motionListeners.add(listener);
      const motion = readControllerMotion(store);
      // A late subscriber must not replace the frame being delivered to others.
      if (first) store.lastMotion = motion ? rememberMotion(motion) : undefined;
      if (motion) listener(motion);
      return () => {
        store.motionListeners.delete(listener);
        if (!store.motionListeners.size) store.lastMotion = undefined;
      };
    },
    next: () => dispatch({ type: 'next' }),
    prev: () => dispatch({ type: 'prev' }),
    moveBy: (value: number) => dispatch({ type: 'moveBy', value }),
    goTo: (value: number) => dispatch({ type: 'goTo', value }),
    goToAbsolute: (value: number) => dispatch({ type: 'goToAbsolute', value }),
    getPrevButtonProps: (props?: ButtonProps) => buttonProps('prev', props),
    getNextButtonProps: (props?: ButtonProps) => buttonProps('next', props),
    getPageSlideIndex,
    getPageIndexes: (limit = 7) => {
      assertInteger(limit, 'limit', true);
      const { pageCount, pageIndex } = getPagination(store.state);
      const count = Math.min(limit, pageCount);
      const start = Math.min(
        Math.max((pageIndex ?? 0) - Math.floor((count - 1) / 2), 0),
        pageCount - count
      );
      return Array.from({ length: count }, (_, index) => start + index);
    },
    goToPage,
    getPageButtonProps,
  } as CarouselController;
  for (const key of Object.keys(emptySnapshot) as Array<
    keyof CarouselSnapshot
  >) {
    Object.defineProperty(controller, key, {
      enumerable: true,
      get: () => store.state.snapshot[key],
    });
  }
  for (const key of ['pageCount', 'pageIndex'] as const) {
    Object.defineProperty(controller, key, {
      enumerable: true,
      get: () => getPagination(store.state)[key],
    });
  }
  stores.set(controller, store);
  return {
    controller,
    subscribe: (listener: () => void) => {
      store.listeners.add(listener);
      return () => store.listeners.delete(listener);
    },
    getSnapshot: () => store.state,
  };
}

/** Navigation controller for one carousel. Configure RCarousel through props. */
export function useCarousel(): CarouselController {
  const [binding] = useState(createController);
  useSyncExternalStore(
    binding.subscribe,
    binding.getSnapshot,
    () => emptyState
  );
  return binding.controller;
}

/** Internal: attach after commit so StrictMode remounts can safely rebind. */
export function attachController(
  controller: CarouselController,
  owner: object,
  id: string,
  dispatch: (command: CarouselCommand) => void
) {
  const store = getStore(controller);
  invariant(
    !store.owner || store.owner === owner,
    'A controller can bind to only one RCarousel'
  );
  store.owner = owner;
  store.id = id;
  store.dispatch = dispatch;
  return () => {
    if (store.owner !== owner) return;
    store.owner = undefined;
    store.id = undefined;
    store.dispatch = undefined;
    store.lastMotion = undefined;
    store.state = {
      ...store.state,
      snapshot: {
        ...store.state.snapshot,
        isReady: false,
        isAnimating: false,
        canNext: false,
        canPrev: false,
      },
    };
    store.listeners.forEach((listener) => listener());
  };
}

export function publishController(
  controller: CarouselController,
  snapshot: CarouselSnapshot,
  step: number,
  aligned = true
) {
  const store = getStore(controller);
  if (
    store.state.snapshot === snapshot &&
    store.state.step === step &&
    store.state.aligned === aligned
  )
    return;
  store.state = { snapshot, step, aligned };
  store.listeners.forEach((listener) => listener());
}

/** Internal: a memoized parent can skip the child's layout-changing commit. */
export function publishControllerStep(
  controller: CarouselController,
  step: number
) {
  const store = getStore(controller);
  if (store.owner)
    publishController(
      controller,
      store.state.snapshot,
      step,
      store.state.aligned
    );
}

/** Internal: the viewport owns the reader and releases its DOM references on cleanup. */
export function bindControllerMotion(
  controller: CarouselController,
  read: () => CarouselMotion | null
) {
  const store = getStore(controller);
  store.readMotion = read;
  // Descendant layout effects run before the RCarousel controller commits.
  // The parent publishes synchronously after committing; this fallback covers
  // viewport-only layout updates without exposing an intermediate snapshot.
  queueMicrotask(() => {
    if (store.readMotion === read) publishControllerMotion(controller);
  });
  return () => {
    if (store.readMotion === read) store.readMotion = undefined;
  };
}

/** Internal: keep the frame channel separate from useSyncExternalStore. */
export function publishControllerMotion(controller: CarouselController) {
  const store = getStore(controller);
  if (!store.motionListeners.size) return;
  const motion = readControllerMotion(store);
  if (!motion) {
    store.lastMotion = undefined;
    return;
  }
  const last = store.lastMotion;
  if (last && sameMotion(last, motion)) return;
  const publication = rememberMotion(motion);
  store.lastMotion = publication;
  let read = store.readMotion;
  for (const listener of [...store.motionListeners]) {
    if (store.lastMotion !== publication) break;
    if (store.readMotion !== read) {
      const current = readControllerMotion(store);
      if (!current || !sameMotion(publication, current)) break;
      read = store.readMotion;
    }
    if (store.motionListeners.has(listener)) listener(motion);
  }
}

function readControllerMotion(store: ControllerStore) {
  return store.owner && store.state.snapshot.isReady
    ? store.readMotion?.()
    : null;
}

function rememberMotion(frame: CarouselMotion) {
  return {
    frame,
    content: frame.slides.map((slide) => slide.element.firstChild),
  };
}

function sameMotion(
  last: NonNullable<ControllerStore['lastMotion']>,
  next: CarouselMotion
) {
  const previous = last.frame;
  return (
    previous.position === next.position &&
    previous.axis === next.axis &&
    previous.slideSize === next.slideSize &&
    previous.slidePitch === next.slidePitch &&
    previous.anchor === next.anchor &&
    previous.slides.length === next.slides.length &&
    next.slides.every((slide, index) => {
      const before = previous.slides[index];
      return (
        slide.element === before.element &&
        slide.index === before.index &&
        slide.absoluteIndex === before.absoluteIndex &&
        slide.distance === before.distance &&
        slide.element.firstChild === last.content[index]
      );
    })
  );
}
