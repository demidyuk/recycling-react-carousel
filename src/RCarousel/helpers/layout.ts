import type { CarouselBreakpoint } from '../apiTypes.js';
import { invariant } from '../../invariant.js';
import { resolveLength } from './configuration.js';

/** Geometry in pixels and slide-pitch units; indexes stay integers. */
export function resolveCarouselLayout(
  options: CarouselBreakpoint,
  viewport: number
) {
  const gap = options.gap ?? 0;
  const insetStart = resolveLength(
    options.insetStart ?? 0,
    viewport,
    'insetStart',
    true
  );
  const insetEnd = resolveLength(
    options.insetEnd ?? 0,
    viewport,
    'insetEnd',
    true
  );
  const available = Math.max(0, viewport - insetStart - insetEnd);
  invariant(
    options.maxSlideSize === undefined || options.slidesPerView === 'auto',
    'maxSlideSize requires slidesPerView="auto"'
  );
  const count =
    options.slidesPerView === 'auto'
      ? Math.max(
          1,
          Math.ceil(
            (available + gap) /
              (resolveLength(
                options.maxSlideSize ?? '100%',
                available,
                'maxSlideSize'
              ) +
                gap)
          ) || 1
        )
      : (options.slidesPerView ?? 1);
  const size = Math.max(0, (available - (count - 1) * gap) / count);
  const pitch = size + gap;
  const ready = viewport > 0 && available > 0 && size > 0;
  const centered = options.snapAlign === 'center';
  const anchor = insetStart + (centered ? (available - size) / 2 : 0);
  const start = ready ? -anchor / pitch : centered ? -(count - 1) / 2 : 0;
  const end = ready ? (viewport - anchor) / pitch : start + count;
  return {
    count,
    step: options.slidesToScroll ?? 1,
    gap,
    size,
    pitch,
    ready,
    anchor,
    start,
    end,
    centered,
    poolCapacity: ready
      ? Math.max(1, Math.ceil(viewport / pitch - 1e-10))
      : Math.ceil(count),
  };
}

export type CarouselLayout = ReturnType<typeof resolveCarouselLayout>;
