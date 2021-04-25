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
      const { cursor, clamp } = action.payload;

      return {
        ...state,
        globalCursor: clamp
          ? clampCursor(
              typeof cursor === 'function'
                ? cursor(state.globalCursor)
                : cursor,
              state.from,
              state.to
            )
          : cursor,
      };
    }
    case 'localCursorChanged': {
      const { cursor, ...options } = action.payload;
      const length = options.length ?? state.slidesCount;
      const curLocalCursor = getLocalCursor(
        state.globalCursor,
        state.slidesCount
      );

      return {
        ...state,
        globalCursor:
          clampCursor(
            typeof cursor === 'function' ? cursor(curLocalCursor) : cursor,
            0,
            length - 1
          ) -
          curLocalCursor +
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
      dispatch({
        type: 'globalCursorChanged',
        payload: { cursor: value, clamp: true },
      }),
    []
  );

  const set = useCallback(
    (value: number | ((arg: number) => number)) =>
      dispatch({
        type: 'globalCursorChanged',
        payload: { cursor: value },
      }),
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
      onCursorChange: set,
      onRangeChange,
    },
    nextBtnProps: { onClick: next, disabled: isMax },
    backBtnProps: { onClick: back, disabled: isMin },
  };
}
