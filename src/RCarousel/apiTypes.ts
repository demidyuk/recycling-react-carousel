// Preserve type-only exports for the validation helpers.
export type {
  resolveAnimation,
  resolveLength,
} from './helpers/configuration.js';

/** Pixel values or percentages; the percentage base depends on the prop. */
export type CarouselLength = number | `${number}px` | `${number}%`;
export type CarouselChangeReason =
  'drag' | 'wheel' | 'api' | 'resize' | 'slides-change';
export type CarouselDragMode = 'snap' | 'free' | 'free-snap';

export interface CarouselSlideMotion {
  /** Content wrapper; transform its content rather than the positioning carrier. */
  readonly element: HTMLElement;
  readonly index: number;
  readonly absoluteIndex: number;
  /** Signed slide pitches from the anchor: zero is aligned, positive is after it. */
  readonly distance: number;
}

export interface CarouselMotion {
  /** Physical global position in slide pitches. Large API jumps can skip indexes. */
  readonly position: number;
  readonly axis: 'horizontal' | 'vertical';
  /** Slide content size and pitch (content plus gap), in pixels. */
  readonly slideSize: number;
  readonly slidePitch: number;
  /** Center of an aligned slide, in pixels from the viewport's primary start. */
  readonly anchor: number;
  /** Rendered content only, including buffers and distinct loop occurrences. */
  readonly slides: readonly CarouselSlideMotion[];
}
export type CarouselAnimation =
  | false
  | { type: 'spring'; tension?: number; friction?: number; mass?: number }
  | {
      type: 'duration';
      /** Duration in milliseconds. Zero skips animation. */
      duration: number;
      easing?: (progress: number) => number;
    };

export interface CarouselBreakpoint {
  slidesPerView?: number | 'auto';
  maxSlideSize?: CarouselLength;
  slidesToScroll?: number;
  /** Space between slides in pixels. */
  gap?: number;
  /** Alignment of the navigation anchor along the scrolling axis. */
  snapAlign?: 'start' | 'center';
  /** Inner alignment insets; neighboring slides may occupy this space. */
  insetStart?: CarouselLength;
  insetEnd?: CarouselLength;
}

export interface CarouselChangeDetails {
  index: number;
  absoluteIndex: number;
  reason: CarouselChangeReason;
}

export interface CarouselSnapshot {
  /** Local navigation anchor (centered with snapAlign="center"), not a page. */
  index: number;
  /** Global position, including repetition cycles. */
  absoluteIndex: number;
  slideCount: number;
  /** Resolved visible slide count, excluding buffered slots. */
  slidesPerView: number;
  canPrev: boolean;
  canNext: boolean;
  isReady: boolean;
  isAnimating: boolean;
  /** Null until measured. Repeating modes can have infinite bounds. */
  absoluteBounds: { min: number; max: number } | null;
}

export interface CarouselNavigateDetails {
  direction: 'next' | 'prev';
  source: 'drag' | 'wheel' | 'api';
  blocked: boolean;
}
