import { useRef } from 'react';
import { usePrevious } from '../hooks';
import { clampCursor, calcActors, CalcResult } from './helpers';

interface RCalcProps {
  cursor: number;
  visibleItemsCount: number;
  childrenCount: number;
  min: number;
  max: number;
}

const initResult = {
  actors: [],
  actorsState: 0,
  curCursor: undefined,
};

export function useRCalc({
  cursor,
  visibleItemsCount,
  childrenCount,
  min,
  max,
}: RCalcProps) {
  const calcResultRef = useRef<CalcResult>(initResult);
  const prevChildrenCount = usePrevious<number>(childrenCount) ?? childrenCount;
  const { current: prevResult } = calcResultRef;

  const calc = () => {
    const shift =
      Math.floor(
        clampCursor(prevResult.cursor ?? cursor, min, max) / prevChildrenCount
      ) *
      (childrenCount - prevChildrenCount);
    const { cursor: curCursor, actors } = (calcResultRef.current = calcActors(
      prevResult,
      {
        cursor: clampCursor(cursor, min, max),
        visibleItemsCount,
        shift,
      }
    ));
    return {
      curCursor: curCursor as number,
      actors,
      shouldUpdateCursor: !!shift,
    };
  };

  return calc();
}
