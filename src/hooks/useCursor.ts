import { useState, useCallback, useMemo } from 'react';
import { clampCursor, getLocalIndex } from '../RCarousel/helpers';

interface CursorProps {
  init?: number;
  step?: number;
}

export function useCursor({ init = 0, step = 1 }: CursorProps = {}) {
  const [[from, to, slidesCount], setRange] = useState<number[]>([0, 0, 0]);
  const [globalCursor, set] = useState(init);
  const getLocalCursor = (globalCursor: number, slidesCount: number) =>
    getLocalIndex(globalCursor, slidesCount);
  const localCursor = getLocalCursor(globalCursor, slidesCount);

  const clampAndSet = useCallback(
    (value: number | ((arg: number) => number)) => {
      set((prev: number) =>
        clampCursor(typeof value === 'function' ? value(prev) : value, from, to)
      );
    },
    [from, to]
  );

  const goTo = useCallback(
    (value: number) =>
      set(
        (prevGlobalCursor: number) =>
          clampCursor(value, 0, slidesCount - 1) -
          getLocalCursor(prevGlobalCursor, slidesCount) +
          prevGlobalCursor
      ),
    [slidesCount]
  );

  const move = useCallback(
    (step: number) => () =>
      clampAndSet((globalCursor: number) => globalCursor + step),
    [clampAndSet]
  );

  const onRangeChange = useCallback(
    (...range: number[]) => setRange(range),
    []
  );

  const next = useMemo(() => move(1 * step), [move, step]);
  const back = useMemo(() => move(-1 * step), [move, step]);

  const isMax = !(globalCursor + step <= to);
  const isMin = !(globalCursor - step >= from);

  return {
    cursor: localCursor,
    clampAndSet,
    goTo,
    move,
    next,
    back,
    firstIndex: from,
    lastIndex: to,
    length: slidesCount,
    isMax,
    isMin,
    props: {
      cursor: globalCursor,
      onCursorChange: set,
      onRangeChange,
    },
    nextBtnProps: { onClick: next, disabled: isMax },
    backBtnProps: { onClick: back, disabled: isMin },
  };
}
