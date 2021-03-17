import React, {
  useEffect,
  useRef,
  memo,
  useCallback,
  useReducer,
  Children,
  useMemo,
} from 'react';
import { useOnResize } from '../hooks/useOnResize';
import { clampCursor } from './helpers/clampCursor';
import { reducer, initState } from './reducer';
import { animated, useSprings } from 'react-spring';
import { useDrag } from 'react-use-gesture';
import styles from './RCarousel.module.css';
import { classNames } from './helpers/classNames';
import invariant from 'tiny-invariant';
import { ActorsCountConfig } from './helpers/types';

export interface RCarouselProps extends React.HTMLAttributes<HTMLDivElement> {
  cursor: number;
  maxItemSize?: number;
  displayAtOnce?: number;
  itemWrapperStyle?: React.CSSProperties;
  itemWrapperClass?: string;
  gestures?: boolean;
  y?: boolean;
  infinite?: boolean;
  alignCenter?: boolean;
  fitContent?: boolean;
  centerMode: boolean;
  centerPadding?: number;
  onNextSwipe?: () => void;
  onPrevSwipe?: () => void;
  onCursorChange?: (cursor: number) => void;
  onRangeChange?: (firstIndex: number, lastIndex: number) => void;
  onVisibleActorsChange?: (actorsCount: number) => void;
}

const RCarousel: React.FC<RCarouselProps> = ({
  children,
  cursor = 0,
  maxItemSize = Number.MAX_VALUE,
  displayAtOnce,
  itemWrapperStyle = {},
  itemWrapperClass,
  className,
  gestures = true,
  y = false,
  infinite = false,
  alignCenter = true,
  fitContent = false,
  centerMode = false,
  centerPadding = 0.3,
  onNextSwipe = () => void 0,
  onPrevSwipe = () => void 0,
  onCursorChange = () => void 0,
  onRangeChange = () => void 0,
  onVisibleActorsChange = () => void 0,
  ...rest
}) => {
  const x = !y;
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, containerHeight] = useOnResize(containerRef);
  const containerSize = x ? containerWidth : containerHeight;
  const [{ actors }, dispatch] = useReducer(reducer, initState);
  const [springs, set] = useSprings(actors.length, (i) => actors[i].anim);
  const childrenArr = Children.toArray(children);
  const childrenCount = Children.count(children);

  invariant(maxItemSize >= 0, `maxItemSize must be positive or zero`);

  const itemSizePxOriginal =
    maxItemSize > containerSize ? containerSize : maxItemSize;

  invariant(
    (displayAtOnce ?? 0) >= 0,
    `displayAtOnce must be positive or zero`
  );

  const visibleItemsCountDesired =
    displayAtOnce ??
    Math.ceil(itemSizePxOriginal ? containerSize / itemSizePxOriginal : 0);

  centerMode &&
    invariant(centerPadding >= 0, `centerPadding must be positive or zero`);

  const actorsCountConfig = useMemo<ActorsCountConfig>(
    () => ({
      visible:
        visibleItemsCountDesired +
        (centerMode ? 2 * Math.ceil(centerPadding) : 0),
      invisible: visibleItemsCountDesired,
      desired: visibleItemsCountDesired,
      get total() {
        return this.visible + this.invisible * 2;
      },
    }),
    [visibleItemsCountDesired, centerMode, centerPadding]
  );

  centerPadding *= +centerMode;

  const itemSizePercents = visibleItemsCountDesired
    ? 1 / (2 * centerPadding + visibleItemsCountDesired)
    : 0;

  const itemSizePx = visibleItemsCountDesired
    ? containerSize * itemSizePercents
    : 0;

  infinite = infinite && childrenCount >= visibleItemsCountDesired;
  centerPadding *= 100;

  let alignWrapperClass: string;

  if (alignCenter) {
    alignWrapperClass = x ? styles.alignCenterY : styles.alignCenterX;
  }

  const clamp = useCallback(
    (cursor) => {
      return clampCursor(cursor, infinite ? Infinity : childrenCount - 1);
    },
    [childrenCount, infinite]
  );

  const onMoveRequested = useCallback(
    (step: number) => {
      const newCursor = clamp(cursor + step);
      const d = newCursor - cursor;
      if (step > 0) {
        onNextSwipe();
      } else if (step < 0) {
        onPrevSwipe();
      }
      d && onCursorChange(newCursor);
      return d;
    },
    [cursor, onCursorChange, onNextSwipe, onPrevSwipe, clamp]
  );

  useEffect(() => {
    onRangeChange(0, infinite ? Infinity : childrenCount && childrenCount - 1);
  }, [infinite, childrenCount, onRangeChange]);

  useEffect(() => {
    dispatch({
      type: 'UPDATE',
      payload: { cursor: clamp(cursor), actorsCountConfig },
    });
  }, [actorsCountConfig, cursor, clamp]);

  useEffect(() => onVisibleActorsChange(visibleItemsCountDesired), [
    visibleItemsCountDesired,
    onVisibleActorsChange,
  ]);

  useEffect(() => {
    // @ts-ignore
    set((i) => actors[i].anim);
  }, [actors, set]);

  const bind = useDrag(
    ({ down, movement, cancel, canceled }) => {
      if (canceled) return;
      const axis = +y;

      if (
        (!down && Math.abs(movement[axis]) > itemSizePx * 0.5) ||
        Math.abs(movement[axis]) / itemSizePx >= visibleItemsCountDesired
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
      {...(gestures ? bind() : {})}
      {...rest}
    >
      {springs.map(({ d }, index) => {
        const { childIndex } = actors[index];
        const child =
          childIndex < 0
            ? undefined
            : childrenArr[infinite ? childIndex % childrenCount : childIndex];

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
                (d) =>
                  `translate3d(${`${+x * (d * 100 + centerPadding)}%, ${
                    +y * (d * 100 + centerPadding)
                  }%`}, 0)`
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

export default memo(RCarousel);
