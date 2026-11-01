import { invariant } from '../../invariant.js';
import type { RCarouselProps, RCarouselItemsProps } from '../RCarousel.js';
import type {
  CarouselAnimation,
  CarouselBreakpoint,
  CarouselLength,
} from '../apiTypes.js';
import type { SpringConfig } from '../motion/ScalarMotion.js';

export function assertInteger(value: number, name: string, positive = false) {
  invariant(
    Number.isSafeInteger(value) && (!positive || value > 0),
    `${name} must be a ${positive ? 'positive ' : ''}safe integer`
  );
}

export function validateProps(
  props: RCarouselProps | RCarouselItemsProps<unknown>
) {
  invariant(
    props.dragMode === undefined ||
      props.dragMode === 'snap' ||
      props.dragMode === 'free' ||
      props.dragMode === 'free-snap',
    'dragMode must be snap, free, or free-snap'
  );
  invariant(
    props.wheel === undefined || typeof props.wheel === 'boolean',
    'wheel must be a boolean'
  );
  if (props.items !== undefined) {
    invariant(Array.isArray(props.items), 'items must be an array');
    invariant(
      props.children === undefined,
      'items and children are mutually exclusive'
    );
    invariant(
      typeof props.renderItem === 'function',
      'items requires renderItem'
    );
    invariant(
      typeof props.getItemKey === 'function',
      'items requires getItemKey'
    );
  } else {
    invariant(
      props.renderItem === undefined && props.getItemKey === undefined,
      'renderItem and getItemKey require items'
    );
  }
  const local = props.index !== undefined || props.defaultIndex !== undefined;
  const absolute =
    props.absoluteIndex !== undefined ||
    props.defaultAbsoluteIndex !== undefined;
  invariant(
    !(local && absolute),
    'Local and absolute index props are mutually exclusive'
  );
  for (const name of [
    'index',
    'defaultIndex',
    'absoluteIndex',
    'defaultAbsoluteIndex',
  ] as const) {
    if (props[name] !== undefined) assertInteger(props[name], name);
  }
  const checkSizing = (options: CarouselBreakpoint) => {
    if (options.slidesPerView !== undefined && options.slidesPerView !== 'auto')
      invariant(
        Number.isFinite(options.slidesPerView) &&
          options.slidesPerView >= 1 &&
          options.slidesPerView <= Number.MAX_SAFE_INTEGER,
        'slidesPerView must be finite and at least one'
      );
    if (options.slidesToScroll !== undefined)
      assertInteger(options.slidesToScroll, 'slidesToScroll', true);
    if (options.gap !== undefined)
      invariant(
        Number.isFinite(options.gap) && options.gap >= 0,
        'gap must be finite and nonnegative'
      );
    if (options.maxSlideSize !== undefined)
      resolveLength(options.maxSlideSize, 100, 'maxSlideSize');
    for (const name of ['insetStart', 'insetEnd'] as const)
      if (options[name] !== undefined)
        resolveLength(options[name], 100, name, true);
    invariant(
      options.snapAlign === undefined ||
        options.snapAlign === 'start' ||
        options.snapAlign === 'center',
      'snapAlign must be start or center'
    );
  };
  checkSizing(props);
  for (const [width, options] of Object.entries(props.breakpoints ?? {})) {
    invariant(
      Number.isFinite(Number(width)) && Number(width) >= 0,
      'Breakpoint widths must be finite and nonnegative'
    );
    checkSizing(options);
  }
  if (props.swipeThreshold !== undefined)
    resolveLength(props.swipeThreshold, 100, 'swipeThreshold');
  const animation = props.animation;
  invariant(
    animation === undefined ||
      animation === false ||
      (animation !== null &&
        typeof animation === 'object' &&
        (animation.type === 'spring' || animation.type === 'duration')),
    'animation must be false, a spring, or a duration configuration'
  );
  if (animation && animation.type === 'duration')
    invariant(
      Number.isFinite(animation.duration) && animation.duration >= 0,
      'Animation duration must be finite and nonnegative'
    );
  if (animation && animation.type === 'spring') {
    for (const field of ['tension', 'friction', 'mass'] as const) {
      const value = animation[field];
      if (value !== undefined)
        invariant(
          Number.isFinite(value) &&
            (field === 'friction' ? value >= 0 : value > 0),
          `Animation ${field} is invalid`
        );
    }
  }
}

export function resolveAnimation(animation: CarouselAnimation): SpringConfig {
  if (animation === false) return { duration: 0 };
  if (animation.type === 'duration') {
    return {
      duration: animation.duration,
      easing: animation.easing ?? ((progress) => progress),
    };
  }
  return {
    tension: animation.tension ?? 170,
    friction: animation.friction ?? 26,
    mass: animation.mass ?? 1,
  };
}

/** Internal conversion shared by layout and gesture thresholds. */
export function resolveLength(
  value: CarouselLength,
  total: number,
  name: string,
  allowZero = false
) {
  invariant(
    typeof value === 'number' ||
      /^(?:\d+(?:\.\d*)?|\.\d+)(?:px|%)$/.test(value),
    `${name} must be pixels or a percentage`
  );
  const result =
    typeof value === 'number'
      ? value
      : parseFloat(value) * (value.endsWith('%') ? total / 100 : 1);
  invariant(
    Number.isFinite(result) &&
      (result > 0 ||
        (allowZero && result === 0) ||
        (total === 0 && typeof value === 'string' && value.endsWith('%'))),
    `${name} must be ${allowZero ? 'nonnegative' : 'positive'} and finite`
  );
  return result;
}
