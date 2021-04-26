import React, {
  useEffect,
  useRef,
  useCallback,
  Children,
  useState,
} from 'react';
import { animated, useSprings, SpringConfig, config } from 'react-spring';
import { useDrag } from 'react-use-gesture';
import styles from './RCarousel.module.css';
import invariant from 'tiny-invariant';
import inRange from 'lodash/inRange';
import clamp from 'lodash/clamp';
import { useOnResize, useWindowWidth, useForceUpdate } from '../hooks';
import {
  clampCursor,
  classNames,
  getLocalIndex,
  UnitValue,
  parsePx,
  getDisplayedSlidesCount,
  DisplayRule,
} from './helpers';
import { useRCalc } from './useRCalc';

export enum ChangeReason {
  USER_SWIPE = 'user_swipe',
  SHIFT = 'shift',
}

export interface RCarouselProps extends React.HTMLAttributes<HTMLElement> {
  cursor?: number;
  defaultCursor?: number;
  maxItemSize?: UnitValue;
  displayAtOnce?: number | DisplayRule[];
  itemWrapperStyle?: React.CSSProperties;
  itemWrapperClass?: string;
  gestures?: boolean;
  y?: boolean;
  infinite?: boolean;
  loop?: boolean;
  alignCenter?: boolean;
  fitContent?: boolean;
  swipeThreshold?: UnitValue;
  userSelect?: boolean;
  springConfig?: SpringConfig;
  trimEnd?: boolean;
  includeChangeReason?: boolean;
  onNextSwipe?: () => void;
  onPrevSwipe?: () => void;
  onCursorChange?: (cursor: number, reason?: ChangeReason) => void;
  onRangeChange?: (...args: number[]) => void;
  onVisibleActorsChange?: (actorsCount: number) => void;
}

/**
 * The `RCarousel` component can be used to iterate over slides.
 * Main idea is to render the end number of nodes which participate in carousel transitions
 * to reduce memory consumption and page freezes when iterating over large collections.
 * There are no controls like arrow buttons or bullets shipped with this component. It's up to you what UI provide to control.
 *
 * The are two modes:
 *
 *  - *uncontrolled*: just to be, the main purpose is testing because the only way to interact with carousel in this mode is gestures
 *  - *controlled*: achieves by manipulating `cursor` prop, recommended way to use this carousel
 */
export const RCarousel: React.FC<RCarouselProps> = ({
  children,
  cursor: cursorProp,
  defaultCursor = 0,
  maxItemSize = '100%',
  displayAtOnce,
  itemWrapperStyle = {},
  itemWrapperClass,
  className,
  gestures = true,
  y = false,
  infinite = false,
  loop = false,
  alignCenter = false,
  fitContent = false,
  swipeThreshold = '50%',
  userSelect = true,
  trimEnd = false,
  includeChangeReason = false,
  springConfig = config.default,
  onNextSwipe = () => {},
  onPrevSwipe = () => {},
  onCursorChange = () => {},
  onRangeChange = () => {},
  onVisibleActorsChange = () => {},
  ...rest
}) => {
  const x = !y;
  const containerRef = useRef<HTMLDivElement>(null);
  const containerMainSideSize = useOnResize(containerRef)[
    x ? 'width' : 'height'
  ];
  const windowWidth = useWindowWidth();
  const [internalCursor, setInternalCursor] = useState<number | undefined>();
  const forceUpdate = useForceUpdate();
  const childrenArr = Children.toArray(children);
  const childrenCount = childrenArr.length;
  const cursor: number = internalCursor ?? cursorProp ?? defaultCursor;
  maxItemSize = parsePx(maxItemSize, containerMainSideSize);

  invariant(
    Number.isSafeInteger(cursor + childrenCount) &&
      Number.isSafeInteger(cursor - childrenCount),
    `cursor is not valid, got ${cursor}`
  );

  containerMainSideSize &&
    invariant(maxItemSize > 0, `maxItemSize must be positive`);

  displayAtOnce = getDisplayedSlidesCount(displayAtOnce, windowWidth);
  displayAtOnce !== undefined &&
    invariant(
      (displayAtOnce ?? 1) > 0 && Number.isSafeInteger(displayAtOnce),
      `displayAtOnce must be positive integer`
    );

  const itemSizePxOriginal =
    maxItemSize > containerMainSideSize ? containerMainSideSize : maxItemSize;

  const visibleItemsCount =
    displayAtOnce ??
    Math.ceil(
      itemSizePxOriginal ? containerMainSideSize / itemSizePxOriginal : 0
    );

  const itemSizePx = visibleItemsCount
    ? containerMainSideSize / visibleItemsCount
    : 0;
  swipeThreshold = parsePx(swipeThreshold, itemSizePx);

  itemSizePx &&
    invariant(swipeThreshold > 0, 'swipeThreshold must be positive');

  const itemSizePercents = visibleItemsCount ? 1 / visibleItemsCount : 0;

  const isEndless = (infinite || loop) && childrenCount >= visibleItemsCount;

  const [min, originalMax] = [
    isEndless && loop ? -Infinity : 0,
    isEndless ? Infinity : childrenCount && childrenCount - 1,
  ];
  const max = trimEnd
    ? clamp(originalMax - (visibleItemsCount - 1), 0, Infinity)
    : originalMax;

  let alignWrapperClass: string;

  if (alignCenter) {
    alignWrapperClass = x ? styles.alignCenterY : styles.alignCenterX;
  }

  const { actors, curCursor, shouldUpdateCursor } = useRCalc({
    cursor,
    visibleItemsCount,
    childrenCount,
    min,
    max,
  });

  const getSpringProps = (i: number) => {
    return { ...actors[i].anim, config: { ...springConfig } };
  };
  const [springs, set] = useSprings(actors.length, getSpringProps);
  // @ts-ignore
  set(getSpringProps);

  const fireChange = useCallback(
    (cursor: number, reason?: ChangeReason) => {
      includeChangeReason
        ? onCursorChange(cursor, reason)
        : onCursorChange(cursor);
      if (cursorProp === undefined) {
        setInternalCursor(cursor);
      } else {
        forceUpdate();
      }
    },
    [cursorProp, forceUpdate, includeChangeReason, onCursorChange]
  );

  const onMoveRequested = useCallback(
    (step: number) => {
      const clamp = (cursor: number) => clampCursor(cursor, min, max);
      const clampedCursor = clamp(cursor);
      const nextCursor = clamp(clampedCursor + step);
      const d = nextCursor - clampedCursor;
      if (step > 0) {
        onNextSwipe();
      } else if (step < 0) {
        onPrevSwipe();
      }

      d && fireChange(nextCursor, ChangeReason.USER_SWIPE);

      return d;
    },
    [cursor, min, max, onNextSwipe, onPrevSwipe, fireChange]
  );

  const bind = useDrag(
    ({ down, movement, cancel, canceled }) => {
      if (canceled) return;
      const visibleItemsCount = actors.length / 3;
      const axis = +y;

      if (
        (!down && Math.abs(movement[axis]) >= swipeThreshold) ||
        Math.abs(movement[axis]) / itemSizePx >= visibleItemsCount
      ) {
        cancel();
        if (
          onMoveRequested(
            -Math.sign(movement[axis]) *
              Math.max(Math.round(Math.abs(movement[axis]) / itemSizePx), 1)
          ) === 0
        ) {
          // for example, when we have reached the border, we must get back current positions
          // @ts-ignore
          set((i) => ({ ...getSpringProps(i), immediate: false }));
        }
      } else {
        // @ts-ignore
        set((i) => ({
          ...getSpringProps(i),
          d: actors[i].anim.d + (down ? movement[axis] / itemSizePx : 0),
          immediate: false,
        }));
      }
    },
    { delay: 1000 }
  );

  useEffect(
    () =>
      void (shouldUpdateCursor && fireChange(curCursor, ChangeReason.SHIFT)),
    [curCursor, shouldUpdateCursor, fireChange]
  );

  useEffect(() => void onRangeChange(min, max, childrenCount), [
    onRangeChange,
    min,
    max,
    childrenCount,
  ]);

  useEffect(() => void onVisibleActorsChange(visibleItemsCount), [
    visibleItemsCount,
    onVisibleActorsChange,
  ]);

  return (
    <div
      ref={containerRef}
      className={classNames([
        styles.container,
        gestures && styles.touchActionNone,
        !userSelect && styles.userSelectNone,
        styles.w100,
        styles.h100,
        className,
      ])}
      {...(gestures && bind())}
      {...rest}
    >
      {springs.map(({ d }, index) => {
        const { globalChildIndex } = actors[index];
        const child = inRange(
          globalChildIndex,
          min,
          originalMax + (childrenCount ? 1 : 0)
        )
          ? childrenArr[getLocalIndex(globalChildIndex, childrenCount)]
          : undefined;

        return (
          <animated.div
            key={index}
            className={classNames([
              styles.actor,
              x ? styles.h100 : styles.w100,
            ])}
            style={{
              [x ? 'width' : 'height']: itemSizePercents * 100 + '%',
              transform: d.interpolate(
                (d) => `translate3d(${`${+x * d * 100}%, ${+y * d * 100}%`}, 0)`
              ),
            }}
          >
            {child && (
              <div
                style={itemWrapperStyle}
                className={classNames([
                  styles.childWrapper,
                  x ? styles.w100 : styles.h100,
                  !fitContent && (x ? styles.h100 : styles.w100),
                  alignWrapperClass,
                  itemWrapperClass,
                ])}
              >
                {child}
              </div>
            )}
          </animated.div>
        );
      })}
    </div>
  );
};
