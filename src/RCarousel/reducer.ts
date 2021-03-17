import clamp from 'lodash.clamp';
import { animTo } from './helpers/animTo';
import { getSnapshot } from './helpers/getSnapshot';

interface Actor {
  childIndex: number;
  anim: {
    d: number;
    immediate: boolean;
  };
}

interface State {
  actors: Actor[];
  actorsState: number;
  curCursor?: number;
}

export const initState: State = {
  actors: [],
  actorsState: 0,
  curCursor: undefined,
};

export function reducer(state: State, { type, payload }: any) {
  switch (type) {
    case 'UPDATE': {
      const { cursor: newCursor, actorsCountConfig } = payload;
      const { curCursor: cursor = 0 } = state;
      const { desired, total } = actorsCountConfig;
      const delta = newCursor - cursor;
      const deltaSign = Math.sign(delta);
      const relocated = Math.abs(delta) > desired; // TODO: check relocated state in center mode
      const clampedDelta = clamp(delta, -desired, desired);

      const actors = getSnapshot(
        relocated ? newCursor - desired * deltaSign : cursor,
        clampedDelta,
        actorsCountConfig
      );

      const newActorsState = total
        ? (total + (state.actorsState + clampedDelta)) % total
        : state.actorsState;

      const curRoles = Array(total)
        .fill(undefined)
        .map((_, i, arr) => (i + state.actorsState) % arr.length);

      const nextRoles = Array(total)
        .fill(undefined)
        .map((_, i, arr) => (i + newActorsState) % arr.length);

      for (let i = 0, actorsCopy = actors.slice(); i < curRoles.length; i++) {
        actors[curRoles[i]] = actorsCopy[i];
      }

      const to = animTo({
        delta: clampedDelta,
        curRoles,
        nextRoles,
        actorsCountConfig,
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
