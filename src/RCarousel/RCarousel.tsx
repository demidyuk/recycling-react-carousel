import React, {
  useEffect,
  useRef,
  useCallback,
  Children,
  useState,
  useMemo,
} from 'react';
import { animated, useSprings, SpringConfig, config } from 'react-spring';
import { useDrag } from 'react-use-gesture';
import styles from './RCarousel.module.css';
import invariant from 'tiny-invariant';
import inRange from 'lodash/inRange';
import clamp from 'lodash/clamp';
import getMax from 'lodash/max';
import {
  useOnResize,
  useWindowWidth,
  useForceUpdate,
  useShouldUpdate,
  useRCalc,
} from './hooks';
import {
  clampCursor,
  classNames,
  getLocalIndex,
  UnitValue,
  parsePx,
  getDisplayedSlidesCount,
  DisplayRule,
  ChangeReason,
} from './helpers';
import SlideWrapper from './SlideWrapper';

export { DisplayRule, ChangeReason, UnitValue };

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
  autosize?: boolean;
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
  style,
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
  autosize = false,
  onNextSwipe = () => {},
  onPrevSwipe = () => {},
  onCursorChange = () => {},
  onRangeChange = () => {},
  onVisibleActorsChange = () => {},
  ...rest
}) => {
  const WIDTH = 'width';
  const HEIGHT = 'height';
  const THRESHOLD_EPSILON_PX = 1;
  const x = !y;
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<boolean>(false);
  const { sizes, add, remove } = useOnResize([containerRef]);
  const observer = useMemo(() => ({ add, remove }), [add, remove]);

  if (sizes.length > 1) {
    sizes[0][x ? HEIGHT : WIDTH] = 0;
  }

  const containerSize = {
    width: getMax(sizes.map(({ width }) => width)) || 0,
    height: getMax(sizes.map(({ height }) => height)) || 0,
  };

  autosize && (fitContent = true);

  const containerPrimarySideLenPx = containerSize
    ? containerSize[x ? WIDTH : HEIGHT]
    : 0;
  const windowWidth = useWindowWidth();
  const [internalCursor, setInternalCursor] = useState<number | undefined>();
  const forceUpdate = useForceUpdate();
  const childrenArr = Children.toArray(children);
  const childrenCount = childrenArr.length;
  const cursor: number = internalCursor ?? cursorProp ?? defaultCursor;
  maxItemSize = parsePx(maxItemSize, containerPrimarySideLenPx);

  invariant(
    Number.isSafeInteger(cursor + childrenCount) &&
      Number.isSafeInteger(cursor - childrenCount),
    `cursor is not valid, got ${cursor}`
  );

  containerPrimarySideLenPx &&
    invariant(maxItemSize > 0, `maxItemSize must be positive`);

  const displayAtOnceRule = getDisplayedSlidesCount(displayAtOnce, windowWidth);
  displayAtOnce = displayAtOnceRule && displayAtOnceRule.value;

  displayAtOnce !== undefined &&
    invariant(
      displayAtOnce > 0 && Number.isSafeInteger(displayAtOnce),
      `displayAtOnce must be positive integer`
    );

  const itemSizePxOriginal =
    maxItemSize > containerPrimarySideLenPx
      ? containerPrimarySideLenPx
      : maxItemSize;

  const visibleItemsCount =
    displayAtOnce ??
    Math.ceil(
      itemSizePxOriginal ? containerPrimarySideLenPx / itemSizePxOriginal : 0
    );

  const itemSizePx = visibleItemsCount
    ? containerPrimarySideLenPx / visibleItemsCount
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

  alignCenter &&
    (alignWrapperClass = x ? styles.alignCenterY : styles.alignCenterX);

  const { actors, curCursor, shouldUpdateCursor } = useRCalc({
    cursor,
    visibleItemsCount,
    childrenCount,
    min,
    max,
  });

  const shouldRangeUpdate = useShouldUpdate(min, max, childrenCount);
  const shouldVICUpdate = useShouldUpdate(visibleItemsCount);

  const getSpringProps = (i: number) => {
    return { ...actors[i].anim, config: { ...springConfig } };
  };
  const [springs, set] = useSprings(actors.length, getSpringProps);

  if (!draggingRef.current) {
    // @ts-ignore
    set(getSpringProps);
  }

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
      if (canceled) {
        return;
      }
      draggingRef.current = true;

      const visibleItemsCount = actors.length / 3;
      const axis = +y;
      if (
        (!down &&
          Math.abs(movement[axis]) >=
            (swipeThreshold as number) - THRESHOLD_EPSILON_PX) ||
        Math.abs(movement[axis]) / itemSizePx >= visibleItemsCount
      ) {
        cancel();
        draggingRef.current = false;

        if (
          onMoveRequested(
            -Math.sign(movement[axis]) *
              (displayAtOnceRule?.slidesToSwipe ||
                Math.max(Math.round(Math.abs(movement[axis]) / itemSizePx), 1))
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
    { delay: true, axis: x ? 'x' : 'y' }
  );

  useEffect(
    () =>
      void (shouldUpdateCursor && fireChange(curCursor, ChangeReason.SHIFT)),
    [curCursor, shouldUpdateCursor, fireChange]
  );

  useEffect(
    () => void (shouldRangeUpdate && onRangeChange(min, max, childrenCount)),
    [onRangeChange, min, max, childrenCount, shouldRangeUpdate]
  );

  useEffect(
    () => void (shouldVICUpdate && onVisibleActorsChange(visibleItemsCount)),
    [visibleItemsCount, onVisibleActorsChange, shouldVICUpdate]
  );

  return (
    <div
      ref={containerRef}
      className={classNames([
        styles.container,
        gestures && (x ? styles.touchActionPanY : styles.touchActionPanX),
        !userSelect && styles.userSelectNone,
        styles.w100,
        styles.h100,
        className,
      ])}
      {...(gestures && bind())}
      {...rest}
      style={{
        ...style,
        ...(autosize && {
          [x ? HEIGHT : WIDTH]: containerSize[x ? HEIGHT : WIDTH],
        }),
      }}
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
              [x ? WIDTH : HEIGHT]: itemSizePercents * 100 + '%',
              willChange: !containerPrimarySideLenPx ? 'auto' : 'transform',
              transform: d.interpolate(
                (d) => `translate3d(${`${+x * d * 100}%, ${+y * d * 100}%`}, 0)`
              ),
            }}
          >
            <SlideWrapper
              observer={autosize ? observer : undefined}
              style={itemWrapperStyle}
              className={classNames([
                styles.childWrapper,
                x ? styles.w100 : styles.h100,
                !fitContent && (x ? styles.h100 : styles.w100),
                !child && styles.displayNone,
                alignWrapperClass,
                itemWrapperClass,
              ])}
            >
              {child}
            </SlideWrapper>
          </animated.div>
        );
      })}
    </div>
  );
};
