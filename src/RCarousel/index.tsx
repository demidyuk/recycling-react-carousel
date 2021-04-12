import React, {
  useEffect,
  useRef,
  memo,
  useCallback,
  Children,
  useState,
} from 'react';
import { animated, useSprings } from 'react-spring';
import { useDrag } from 'react-use-gesture';
import styles from './RCarousel.module.css';
import invariant from 'tiny-invariant';
import inRange from 'lodash.inrange';
import { useOnResize } from '../hooks';
import {
  clampCursor,
  classNames,
  getLocalIndex,
  UnitValue,
  parsePx,
} from './helpers';
import { useRCalc } from './useRCalc';

export enum ChangeReason {
  USER_SWIPE = 'user_swipe',
  SHIFT = 'shift',
}

export interface RCarouselProps extends React.HTMLAttributes<HTMLDivElement> {
  cursor?: number;
  defaultCursor?: number;
  maxItemSize?: UnitValue;
  displayAtOnce?: number;
  itemWrapperStyle?: React.CSSProperties;
  itemWrapperClass?: string;
  gestures?: boolean;
  y?: boolean;
  infinite?: boolean;
  loop?: boolean;
  swipeThreshold?: UnitValue;
  includeChangeReason?: boolean;
  onNextSwipe?: () => void;
  onPrevSwipe?: () => void;
  onCursorChange?: (cursor: number, reason?: ChangeReason) => void;
  onRangeChange?: (...args: number[]) => void;
  onVisibleActorsChange?: (actorsCount: number) => void;
}

const RCarousel: React.FC<RCarouselProps> = ({
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
  swipeThreshold = '50%',
  includeChangeReason = false,
  onNextSwipe = () => {},
  onPrevSwipe = () => {},
  onCursorChange = () => {},
  onRangeChange = () => {},
  onVisibleActorsChange = () => {},
  ...rest
}) => {
  const x = !y;
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, containerHeight] = useOnResize(containerRef);
  const containerSize = x ? containerWidth : containerHeight;
  const [internalCursor, setInternalCursor] = useState<number | undefined>();
  const [, __updateState] = useState<any>();
  const refresh = () => __updateState({});
  const childrenArr = Children.toArray(children);
  const childrenCount = Children.count(children);
  const cursor: number = internalCursor ?? cursorProp ?? defaultCursor;
  maxItemSize = parsePx(maxItemSize, containerSize);

  invariant(
    Number.isSafeInteger(cursor + childrenCount) &&
      Number.isSafeInteger(cursor - childrenCount),
    `cursor is not valid, got ${cursor}`
  );

  containerSize && invariant(maxItemSize > 0, `maxItemSize must be positive`);

  displayAtOnce !== undefined &&
    invariant(
      (displayAtOnce ?? 1) > 0 && Number.isSafeInteger(displayAtOnce),
      `displayAtOnce must be positive integer`
    );

  const itemSizePxOriginal =
    maxItemSize > containerSize ? containerSize : maxItemSize;

  const visibleItemsCount =
    displayAtOnce ??
    Math.ceil(itemSizePxOriginal ? containerSize / itemSizePxOriginal : 0);

  const itemSizePx = visibleItemsCount ? containerSize / visibleItemsCount : 0;
  swipeThreshold = parsePx(swipeThreshold, itemSizePx);

  itemSizePx &&
    invariant(swipeThreshold > 0, 'swipeThreshold must be positive');

  const itemSizePercents = visibleItemsCount ? 1 / visibleItemsCount : 0;

  const isEndless = (infinite || loop) && childrenCount >= visibleItemsCount;

  const [min, max] = [
    isEndless && loop ? -Infinity : 0,
    isEndless ? Infinity : childrenCount && childrenCount - 1,
  ];

  const { actors, curCursor, shouldUpdateCursor } = useRCalc({
    cursor,
    visibleItemsCount,
    childrenCount,
    min,
    max,
  });

  const [springs, set] = useSprings(actors.length, (i) => actors[i].anim);
  // @ts-ignore
  set((i) => actors[i].anim);

  const fireChange = useCallback(
    (cursor: number, reason?: ChangeReason) => {
      includeChangeReason
        ? onCursorChange(cursor, reason)
        : onCursorChange(cursor);
      if (cursorProp === undefined) {
        setInternalCursor(cursor);
      } else {
        refresh();
      }
    },
    [cursorProp, includeChangeReason, onCursorChange]
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
          set((i) => ({ d: actors[i].anim.d, immediate: false }));
        }
      } else {
        // @ts-ignore
        set((i) => ({
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
        styles.w100,
        styles.h100,
        className,
      ])}
      {...(gestures && bind())}
      {...rest}
    >
      {springs.map(({ d }, index) => {
        const { globalChildIndex } = actors[index];
        const child = inRange(globalChildIndex, min, max && max + 1)
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
                  styles.w100,
                  styles.h100,
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

export default memo(RCarousel);
