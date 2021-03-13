import clamp from 'lodash.clamp';

export const clampCursor = (cursor: number, lastIndex: number) => {
  return clamp(cursor, 0, lastIndex < 0 ? 0 : lastIndex);
};
