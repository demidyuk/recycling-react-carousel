import React, {
  useEffect,
  useRef,
  memo,
  useCallback,
  useReducer,
  Children,
} from 'react';
import { useOnResize, usePrevious, useNeedUpdate } from '../hooks';
import { clampCursor, classNames, getLocalIndex } from './helpers';
import { reducer, initState } from './reducer';
import { animated, useSprings } from 'react-spring';
import { useDrag } from 'react-use-gesture';
import styles from './RCarousel.module.css';
import invariant from 'tiny-invariant';
import inRange from 'lodash.inrange';

export interface RCarouselProps extends React.HTMLAttributes<HTMLDivElement> {
  cursor?: number;
  defaultCursor?: number;
  maxItemSize?: number;
  displayAtOnce?: number;
  itemWrapperStyle?: React.CSSProperties;
  itemWrapperClass?: string;
  gestures?: boolean;
  y?: boolean;
  infinite?: boolean;
  onNextSwipe?: () => void;
  onPrevSwipe?: () => void;
  onCursorChange?: (cursor: number) => void;
  onRangeChange?: (from: number, to: number, slidesCount: number) => void;
  onVisibleActorsChange?: (actorsCount: number) => void;
}

const RCarousel: React.FC<RCarouselProps> = ({
  children,
  cursor,
  defaultCursor = 0,
  maxItemSize = Number.MAX_VALUE,
  displayAtOnce,
  itemWrapperStyle = {},
  itemWrapperClass,
  className,
  gestures = true,
  y = false,
  infinite = false,
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
  const [{ actors, curCursor }, dispatch] = useReducer(reducer, initState);
  const [springs, set] = useSprings(actors.length, (i) => actors[i].anim);
  const childrenArr = Children.toArray(children);
  const childrenCount = Children.count(children);
  const prevChildrenCount = usePrevious<number>(childrenCount);

  const lastCursor: number = cursor ?? curCursor ?? defaultCursor;

  invariant(
    Number.isSafeInteger(lastCursor + childrenCount) &&
      Number.isSafeInteger(lastCursor - childrenCount),
    `cursor is not valid, got ${lastCursor}`
  );
  invariant(maxItemSize >= 0, `maxItemSize must be positive or zero`);

  const itemSizePxOriginal =
    maxItemSize > containerSize ? containerSize : maxItemSize;

  invariant(
    (displayAtOnce ?? 0) >= 0,
    `displayAtOnce must be positive or zero`
  );

  const visibleItemsCount =
    displayAtOnce ??
    Math.ceil(itemSizePxOriginal ? containerSize / itemSizePxOriginal : 0);

  const itemSizePx = visibleItemsCount ? containerSize / visibleItemsCount : 0;
  const itemSizePercents = visibleItemsCount ? 1 / visibleItemsCount : 0;

  infinite = infinite && childrenCount >= visibleItemsCount;

  const [min, max] = [
    0,
    infinite ? Infinity : childrenCount && childrenCount - 1,
  ];

  const needViewUpdate =
    useNeedUpdate(visibleItemsCount, lastCursor) && visibleItemsCount > 0;
  const needRangeUpdate = useNeedUpdate(min, max, childrenCount);
  const needVICUpdate = useNeedUpdate(visibleItemsCount);

  const clamp = useCallback(
    (cursor) => {
      return clampCursor(cursor, min, max);
    },
    [max, min]
  );

  const update = useCallback(
    ({ immediate = false, cursor: nextCursor = lastCursor } = {}) => {
      dispatch({
        type: 'UPDATE',
        payload: {
          cursor: clamp(nextCursor),
          visibleItemsCount,
          immediate,
        },
      });
    },
    [clamp, lastCursor, visibleItemsCount]
  );

  const onMoveRequested = useCallback(
    (step: number) => {
      const nextCursor = clamp(lastCursor + step);
      const d = nextCursor - lastCursor;
      if (step > 0) {
        onNextSwipe();
      } else if (step < 0) {
        onPrevSwipe();
      }
      if (d) {
        onCursorChange(nextCursor);
        update({ cursor: nextCursor });
      }
      return d;
    },
    [clamp, lastCursor, onNextSwipe, onPrevSwipe, onCursorChange, update]
  );

  useEffect(() => {
    if (needRangeUpdate) {
      onRangeChange(min, max, childrenCount);
      if (!inRange(lastCursor, min, max && max + 1)) {
        const nextCursor = getLocalIndex(lastCursor, childrenCount);
        onCursorChange(nextCursor);
        update({ immediate: true, cursor: nextCursor });
      }
    }
  }, [
    childrenCount,
    lastCursor,
    onRangeChange,
    onCursorChange,
    min,
    max,
    needRangeUpdate,
    update,
    infinite,
  ]);

  useEffect(() => {
    if (needViewUpdate) {
      update();
    } else if (
      prevChildrenCount !== undefined &&
      Math.abs(childrenCount - prevChildrenCount) >= 1
    ) {
      const shift =
        Math.floor(lastCursor / prevChildrenCount) *
        (childrenCount - prevChildrenCount);
      if (Math.abs(shift) > 0) {
        const nextCursor = lastCursor + shift;
        update({ immediate: true, cursor: nextCursor });
        onCursorChange(nextCursor);
      } else {
        update({ immediate: true });
      }
    }
  }, [
    visibleItemsCount,
    lastCursor,
    clamp,
    needViewUpdate,
    childrenCount,
    prevChildrenCount,
    onCursorChange,
    update,
    containerSize,
  ]);

  useEffect(
    () => void (needVICUpdate && onVisibleActorsChange(visibleItemsCount)),
    [visibleItemsCount, onVisibleActorsChange, needVICUpdate]
  );

  useEffect(() => {
    // @ts-ignore
    set((i) => actors[i].anim);
  }, [actors, set]);

  const bind = useDrag(
    ({ down, movement, cancel, canceled }) => {
      if (canceled) return;
      const visibleItemsCount = actors.length / 3;
      const axis = +y;

      if (
        (!down && Math.abs(movement[axis]) > itemSizePx * 0.5) ||
        Math.abs(movement[axis]) / itemSizePx >= visibleItemsCount
      ) {
        cancel();
        if (onMoveRequested(-Math.round(movement[axis] / itemSizePx)) === 0) {
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

  return (
    <div
      ref={containerRef}
      className={classNames([
        styles.container,
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
          ? childrenArr[
              getLocalIndex(
                globalChildIndex,
                prevChildrenCount ?? childrenCount
              )
            ]
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
