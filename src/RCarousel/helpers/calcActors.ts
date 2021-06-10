import clamp from 'lodash/clamp';
import times from 'lodash/times';
import { animTo } from './animTo';
import { getSnapshot } from './getSnapshot';
import { CalcResult } from './types';

export interface CalcActorsInput {
  cursor: number;
  visibleItemsCount: number;
  shift: number;
}

export function calcActors(
  previousResult: CalcResult,
  { visibleItemsCount, cursor: newCursor, shift = 0 }: CalcActorsInput
): CalcResult {
  const { cursor = 0 } = previousResult;
  const totalItemsCount = visibleItemsCount * 3;
  const delta = newCursor - cursor;
  const immediate = delta === 0;
  const deltaSign = Math.sign(delta);
  const relocated = immediate || Math.abs(delta) > visibleItemsCount;
  const clampedDelta = clamp(delta, -visibleItemsCount, visibleItemsCount);

  const actors = getSnapshot(
    relocated
      ? newCursor + shift - visibleItemsCount * deltaSign
      : cursor + shift,
    clampedDelta,
    totalItemsCount
  );

  const newActorsState = totalItemsCount
    ? (totalItemsCount + (previousResult.actorsState + clampedDelta)) %
      totalItemsCount
    : previousResult.actorsState;

  const curRoles = times(
    totalItemsCount,
    (i) => (i + previousResult.actorsState) % totalItemsCount
  );

  const nextRoles = times(
    totalItemsCount,
    (i) => (i + newActorsState) % totalItemsCount
  );

  for (let i = 0, actorsCopy = actors.slice(); i < curRoles.length; i++) {
    actors[curRoles[i]] = actorsCopy[i];
  }

  const to = animTo({
    delta: clampedDelta,
    curRoles,
    nextRoles,
    totalItemsCount,
    relocated,
  });

  return {
    actors: actors.map((childIndex, i) => ({
      globalChildIndex: childIndex,
      anim: to(i),
    })),
    actorsState: newActorsState,
    cursor: newCursor + shift,
  };
}
