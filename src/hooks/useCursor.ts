import { useCallback, useMemo, useReducer } from 'react';
import { clampCursor, getLocalIndex } from '../RCarousel/helpers';

interface CursorProps {
  init?: number;
  step?: number;
}

interface GoToOptions {
  length?: number;
}

type CursorState = {
  globalCursor: number;
  from: number;
  to: number;
  slidesCount: number;
};

const getLocalCursor = (globalCursor: number, slidesCount: number) =>
  getLocalIndex(globalCursor, slidesCount);

const getInitialState = (init: number): CursorState => ({
  globalCursor: init,
  from: 0,
  to: 0,
  slidesCount: 0,
});

const cursorReducer = (state: CursorState, action: any) => {
  switch (action.type) {
    case 'globalCursorChanged': {
      const cursor = action.payload;

      return {
        ...state,
        globalCursor: clampCursor(
          typeof cursor === 'function' ? cursor(state.globalCursor) : cursor,
          state.from,
          state.to
        ),
      };
    }
    case 'localCursorChanged': {
      const { cursor, ...options } = action.payload;

      return {
        ...state,
        globalCursor:
          clampCursor(
            typeof cursor === 'function' ? cursor(state.globalCursor) : cursor,
            0,
            options.length - 1
          ) -
          getLocalCursor(state.globalCursor, state.slidesCount) +
          state.globalCursor,
      };
    }
    case 'rangeChanged': {
      const [from, to, slidesCount] = action.payload;

      return {
        ...state,
        globalCursor: clampCursor(state.globalCursor, from, to),
        from,
        to,
        slidesCount,
      };
    }
    default:
      return state;
  }
};

export function useCursor({ init = 0, step = 1 }: CursorProps = {}) {
  const [{ globalCursor, from, to, slidesCount }, dispatch] = useReducer(
    cursorReducer,
    getInitialState(init)
  );
  const localCursor = getLocalCursor(globalCursor, slidesCount);

  const clampAndSet = useCallback(
    (value: number | ((arg: number) => number)) =>
      dispatch({ type: 'globalCursorChanged', payload: value }),
    []
  );

  const goTo = useCallback(
    (value: number | ((arg: number) => number), options?: GoToOptions) =>
      dispatch({
        type: 'localCursorChanged',
        payload: { cursor: value, ...options },
      }),
    []
  );

  const move = useCallback(
    (step: number) => () => clampAndSet((cursor) => cursor + step),
    [clampAndSet]
  );

  const onRangeChange = useCallback(
    (...range: number[]) => dispatch({ type: 'rangeChanged', payload: range }),
    []
  );

  const next = useMemo(() => move(1 * step), [move, step]);
  const back = useMemo(() => move(-1 * step), [move, step]);

  const isMax = !(globalCursor + step <= to);
  const isMin = !(globalCursor - step >= from);

  return {
    cursor: localCursor,
    firstIndex: from,
    lastIndex: to,
    length: slidesCount,
    isMax,
    isMin,
    clampAndSet,
    goTo,
    move,
    next,
    back,
    props: {
      cursor: globalCursor,
      onCursorChange: clampAndSet,
      onRangeChange,
    },
    nextBtnProps: { onClick: next, disabled: isMax },
    backBtnProps: { onClick: back, disabled: isMin },
  };
}
