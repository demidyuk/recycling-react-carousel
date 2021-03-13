import { useState, useCallback, useMemo } from 'react';
import { clampCursor } from '../RCarousel/helpers/clampCursor';

interface CursorProps {
  init?: number;
  step?: number;
}

export function useCursor({ init = 0, step = 1 }: CursorProps = {}) {
  const [[firstIndex, lastIndex], setRange] = useState([0, 0]);
  const [cursor, set] = useState(clampCursor(init, lastIndex));
  const clampAndSet = useCallback(
    (value: number | ((arg: number) => number)) => {
      set((prev: number) => {
        return clampCursor(
          typeof value === 'function' ? value(prev) : value,
          lastIndex
        );
      });
    },
    [lastIndex, set]
  );

  const move = useCallback(
    (step: number) => () => clampAndSet((cur: number) => cur + step),
    [clampAndSet]
  );

  const onRangeChange = useCallback(
    (min, max) => {
      setRange([min, max]);
      set((cursor: number) => {
        if (max < cursor) {
          return max;
        }
        return cursor;
      });
    },
    [setRange, set]
  );

  const next = useMemo(() => move(1 * step), [move, step]);
  const back = useMemo(() => move(-1 * step), [move, step]);

  const isMax = !(cursor + step <= lastIndex);
  const isMin = !(cursor - step >= firstIndex);

  return {
    cursor,
    clampAndSet,
    move,
    next,
    back,
    firstIndex,
    lastIndex,
    isMax,
    isMin,
    props: {
      cursor,
      onCursorChange: clampAndSet,
      onRangeChange,
    },
    nextBtnProps: { onClick: next, disabled: isMax },
    backBtnProps: { onClick: back, disabled: isMin },
  };
}
