import clamp from 'lodash.clamp';
import { animTo } from './helpers/animTo';
import { getSnapshot } from './helpers/getSnapshot';

type Actor = {
  childIndex: number;
  anim: {
    d: number;
    immediate: boolean;
  };
};

type State = {
  actors: Actor[];
  actorsState: number;
  curCursor?: number;
};

export const initState: State = {
  actors: [],
  actorsState: 0,
  curCursor: undefined,
};

export function reducer(state: State, { type, payload }: any) {
  switch (type) {
    case 'UPDATE': {
      const { visibleItemsCount, cursor: newCursor } = payload;
      const { curCursor: cursor = 0 } = state;
      const totalItemsCount = visibleItemsCount * 3;
      const delta = newCursor - cursor;
      const deltaSign = Math.sign(delta);
      const relocated = Math.abs(delta) > visibleItemsCount;
      const clampedDelta = clamp(delta, -visibleItemsCount, visibleItemsCount);

      const actors = getSnapshot(
        relocated ? newCursor - visibleItemsCount * deltaSign : cursor,
        clampedDelta,
        totalItemsCount
      );

      const newActorsState = totalItemsCount
        ? (totalItemsCount + (state.actorsState + clampedDelta)) %
          totalItemsCount
        : state.actorsState;

      const curRoles = Array(totalItemsCount)
        .fill(undefined)
        .map((_, i, arr) => (i + state.actorsState) % arr.length);

      const nextRoles = Array(totalItemsCount)
        .fill(undefined)
        .map((_, i, arr) => (i + newActorsState) % arr.length);

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
          childIndex,
          anim: to(i),
        })),
        actorsState: newActorsState,
        curCursor: newCursor,
      };
    }
    default:
      return state;
  }
}